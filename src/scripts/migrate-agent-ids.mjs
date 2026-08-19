/**
 * scripts/migrate-agent-ids.mjs
 *
 * One-off admin migration: backfills sales_leads.agentId from the legacy
 * TeamMember settings-record id ("member_<timestamp>") to the matching
 * TeamMember's real Firebase Auth uid, now that SalesHub.tsx assigns using
 * uid going forward.
 *
 * Scope (intentionally narrow, per instructions):
 *   - Does NOT touch firestore.rules, collection structure, or permissions.
 *   - Does NOT touch lead status/pipeline fields — only `agentId`.
 *   - Does NOT touch telesales_leads (same pattern could apply there later,
 *     but it's out of scope for this fix — see NOTE at the bottom).
 *   - Only auto-writes on an EXACT match of lead.agentId === TeamMember.id.
 *     Name/email based matches are logged for manual review, never
 *     auto-applied — we should not silently reassign a customer on a guess.
 *
 * Usage:
 *   node scripts/migrate-agent-ids.mjs                 # dry run (no writes)
 *   node scripts/migrate-agent-ids.mjs --apply          # actually writes
 *
 * Requires:
 *   - firebase-admin installed (npm i -D firebase-admin)
 *   - A service account key. Either:
 *       a) set GOOGLE_APPLICATION_CREDENTIALS to the key file path, or
 *       b) place the key at ./serviceAccountKey.json (gitignored) and this
 *          script will pick it up automatically.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

function initAdmin() {
  const keyPath = "./serviceAccountKey.json";
  if (existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS env var.
    initializeApp({ credential: applicationDefault() });
  }
}

// Same normalization scopeLeadsToRole.ts uses, kept identical on purpose.
const norm = (v) => (v ?? "").toString().trim().toLowerCase();

async function loadTeamMemberIndex(db) {
  const snap = await db.collection("settings").doc("teamSettings").get();
  if (!snap.exists) {
    throw new Error("settings/teamSettings document not found.");
  }
  const data = snap.data();
  const depts = ["adsTeam", "seoTeam", "contentTeam", "designTeam", "editorTeam"];

  const byId = new Map();   // TeamMember.id -> member
  const byName = new Map(); // normalized name -> member (first match wins)
  const noUid = [];         // members missing uid, for the report

  depts.forEach((dept) => {
    const team = Array.isArray(data[dept]) ? data[dept] : [];
    team.forEach((member) => {
      if (member.id) byId.set(member.id, member);
      if (member.name && !byName.has(norm(member.name))) {
        byName.set(norm(member.name), member);
      }
      if (member.name && !member.uid) noUid.push(member.name);
    });
  });

  return { byId, byName, noUid };
}

async function migrate() {
  initAdmin();
  const db = getFirestore();

  console.log(APPLY ? "Running in APPLY mode (writes enabled).\n" : "Running in DRY-RUN mode (no writes). Pass --apply to write.\n");

  const { byId, byName, noUid } = await loadTeamMemberIndex(db);

  if (noUid.length) {
    console.log("⚠ Team members with no linked uid yet (they must log in once before assignment will work for them):");
    noUid.forEach((n) => console.log(`   - ${n}`));
    console.log("");
  }

  const leadsSnap = await db.collection("sales_leads").get();

  const toFix = [];          // exact id match, safe to auto-apply
  const needsReview = [];    // legacy-format id but no exact TeamMember.id match

  leadsSnap.forEach((doc) => {
    const lead = doc.data();
    const agentId = lead.agentId || "";
    if (!agentId.startsWith("member_")) return; // not a legacy id, skip

    const member = byId.get(agentId);
    if (member && member.uid) {
      toFix.push({ leadId: doc.id, clientName: lead.clientName, oldAgentId: agentId, newAgentId: member.uid, matchedBy: "id" });
    } else if (member && !member.uid) {
      needsReview.push({ leadId: doc.id, clientName: lead.clientName, agentId, reason: `Matched TeamMember "${member.name}" by id, but that member has no uid yet (hasn't logged in).` });
    } else {
      // No exact id match (member may have been deleted/edited since).
      // Try a name-based fallback for the report only — never auto-applied.
      const byNameMatch = lead.agentName ? byName.get(norm(lead.agentName)) : null;
      needsReview.push({
        leadId: doc.id,
        clientName: lead.clientName,
        agentId,
        reason: byNameMatch
          ? `No TeamMember.id match. Possible name match: "${byNameMatch.name}"${byNameMatch.uid ? ` (uid: ${byNameMatch.uid})` : " — but that member has no uid yet"}. Review manually before fixing.`
          : "No TeamMember.id or name match found. Review manually."
      });
    }
  });

  console.log(`Found ${toFix.length} lead(s) with a safe, exact-match fix.`);
  console.log(`Found ${needsReview.length} lead(s) needing manual review.\n`);

  if (APPLY && toFix.length) {
    // Firestore batches are capped at 500 writes.
    const chunkSize = 450;
    for (let i = 0; i < toFix.length; i += chunkSize) {
      const chunk = toFix.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((fix) => {
        batch.update(db.collection("sales_leads").doc(fix.leadId), {
          agentId: fix.newAgentId,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.log(`Committed batch of ${chunk.length} update(s).`);
    }
    console.log("\n✅ Migration applied.");
  } else if (!APPLY) {
    console.log("Dry run only — no writes performed. Re-run with --apply to write these changes:");
  }

  const report = { generatedAt: new Date().toISOString(), applied: APPLY, toFix, needsReview };
  writeFileSync("./migrate-agent-ids-report.json", JSON.stringify(report, null, 2));
  console.log("\nFull report written to migrate-agent-ids-report.json");

  // NOTE: telesales_leads has an analogous agentId field written by the
  // same TeamMember.id-based logic (TelesalesHub.tsx / TelesalesAgent.tsx).
  // If the same "no customers visible" symptom shows up there, this script
  // can be pointed at that collection too by changing the collection name
  // below — deliberately not done here to keep this change scoped to the
  // reported sales assignment issue.
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
