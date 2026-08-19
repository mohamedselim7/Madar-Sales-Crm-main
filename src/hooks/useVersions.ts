import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, convertTimestamps } from "@/src/lib/firebase";
import { SystemVersion } from "@/src/types";

export function useVersions() {
  const [versions, setVersions] = useState<SystemVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVersions = async () => {
    try {
      const q = query(collection(db, "system_versions"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const versionList = querySnapshot.docs.map(doc => {
        return convertTimestamps<SystemVersion>({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // If no versions exist, create the baseline VERSION_01
      if (versionList.length === 0) {
        await addBaseline();
      } else {
        const hasV15 = versionList.some(v => v.versionName === "VERSION_15");
        const hasV16 = versionList.some(v => v.versionName === "VERSION_16");
        const hasV17 = versionList.some(v => v.versionName === "VERSION_17");
        const hasV18 = versionList.some(v => v.versionName === "VERSION_18");
        const hasV19 = versionList.some(v => v.versionName === "VERSION_19");
        const hasV27 = versionList.some(v => v.versionName === "VERSION_27");
        const hasV28 = versionList.some(v => v.versionName === "VERSION_28");
        const hasV29 = versionList.some(v => v.versionName === "VERSION_29");
        const hasV30 = versionList.some(v => v.versionName === "VERSION_30");
        const hasV31 = versionList.some(v => v.versionName === "VERSION_31");
        const hasV32 = versionList.some(v => v.versionName === "VERSION_32");
        const hasV33 = versionList.some(v => v.versionName === "VERSION_33");
        const hasV34 = versionList.some(v => v.versionName === "VERSION_34");
        const hasV35 = versionList.some(v => v.versionName === "VERSION_35");
        const hasV36 = versionList.some(v => v.versionName === "VERSION_36");
        const hasV37 = versionList.some(v => v.versionName === "VERSION_37");
        const hasV38 = versionList.some(v => v.versionName === "VERSION_38");
        const hasV39 = versionList.some(v => v.versionName === "VERSION_39");
        const hasV211 = versionList.some(v => v.versionName === "VERSION_211");
        const hasV212 = versionList.some(v => v.versionName === "VERSION_212");
        const hasV213 = versionList.some(v => v.versionName === "VERSION_213");
        const hasV214 = versionList.some(v => v.versionName === "VERSION_214");
        const hasV215 = versionList.some(v => v.versionName === "VERSION_215");
        
        let needsRefresh = false;
        if (!hasV15) {
          await addVersionRecord({
            versionName: "VERSION_15",
            modifiedModules: ["TelesalesAgent.tsx", "system_versions.md", "AGENTS.md"],
            notes: "Removed Personal KPI cards strip from the lead details list view and renamed tab to 'بيانات العملاء'.",
            rollbackAvailable: true,
            status: "ARCHIVED"
          });
          needsRefresh = true;
        }
        
        if (!hasV16) {
          await addVersionRecord({
            versionName: "VERSION_16",
            modifiedModules: ["TelesalesAgent.tsx", "useVersions.ts", "system_versions.md", "AGENTS.md"],
            notes: "Excel Client Data Import & Live Matching Engine - Added Excel/CSV file parsing with column synonyms matching, valid records verification, and dynamic assignee assignment before CRM sync.",
            rollbackAvailable: true,
            status: "ARCHIVED"
          });
          needsRefresh = true;
        }

        if (!hasV17) {
          await addVersionRecord({
            versionName: "VERSION_17",
            modifiedModules: ["TelesalesHub.tsx"],
            notes: "Configurable Telesales Dropdowns & Unified Agent Management.",
            rollbackAvailable: true,
            status: "ARCHIVED"
          });
          needsRefresh = true;
        }

        if (!hasV18) {
          await addVersionRecord({
            versionName: "VERSION_18",
            modifiedModules: ["SalesHub.tsx", "SalesAgent.tsx", "Layout.tsx", "useUserRole.ts"],
            notes: "Sales Hub & Sales Agent CRM pages rollout with customized lead status filtering, layout routes integration, and analytics dashboard.",
            rollbackAvailable: true,
            status: "ARCHIVED"
          });
          needsRefresh = true;
        }

        if (!hasV19) {
          await addVersionRecord({
            versionName: "VERSION_19",
            modifiedModules: ["TelesalesAgent.tsx", "TelesalesHub.tsx", "SalesHub.tsx", "useVersions.ts", "system_versions.md"],
            notes: "Dynamic Sales Lead Mutual Flow Distribution & Agent Allocations - Automatically transfer scheduled telesales meetings to Sales Hub with inline assignment selectors linking Sales Agents directly in the CRM.",
            rollbackAvailable: true,
            status: "ARCHIVED"
          });
          needsRefresh = true;
        }

        if (!hasV27) {
          await addVersionRecord({
            versionName: "VERSION_27",
            modifiedModules: ["SalesTools.tsx", "system_versions.md", "AGENTS.md"],
            notes: "Advanced Semantic Column Mapping & Cross-Validation Engine.",
            rollbackAvailable: true,
            status: "ARCHIVED"
          });
          needsRefresh = true;
        }

        if (!hasV28) {
          await addVersionRecord({
            versionName: "VERSION_28",
            modifiedModules: ["firebase.ts", "firestore.rules", "firebase-blueprint.json", "system_versions.md", "AGENTS.md"],
            notes: "Resilient Firestore Caching, Iframe Sandboxing Compatibility & Full Missing Rules Allowlist.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV29) {
          await addVersionRecord({
            versionName: "VERSION_29",
            modifiedModules: ["SalesTools.tsx", "firebase.ts", "useVersions.ts", "system_versions.md", "AGENTS.md"],
            notes: "Rollback to VERSION_26: Restored stable Excel column mapping scorer & streamlined database connectivity.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV30) {
          await addVersionRecord({
            versionName: "VERSION_30",
            modifiedModules: ["SalesTools.tsx", "useVersions.ts", "system_versions.md", "AGENTS.md"],
            notes: "Resilient Multi-Column Candidate Tracking: Enable scanning all candidate phone columns to extract valid data from populated columns when other columns are empty during filtering.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV31) {
          await addVersionRecord({
            versionName: "VERSION_31",
            modifiedModules: ["SalesTools.tsx", "useVersions.ts", "system_versions.md", "AGENTS.md"],
            notes: "Complete Customer Data Pipeline Rewrite: High-accuracy multi-file support, semantic cell content analysis, robust Saudi phone check, intelligent link categorization, automatic deduplication merge, and consolidated multi-tab Excel downloads.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV32) {
          await addVersionRecord({
            versionName: "VERSION_32",
            modifiedModules: ["customerParser.ts", "SalesTools.tsx"],
            notes: "Advanced Mixed-Cell Name-Remark Splitting, Confidence Scoring & Doubt-Triggered Manual Review Assignment.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV33) {
          await addVersionRecord({
            versionName: "VERSION_33",
            modifiedModules: ["SalesTools.tsx", "customerParser.ts"],
            notes: "Data Integrity Auditor Panel, Hierarchy Disjoint Partitioning and Structural Error Prevention Engine.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV34) {
          await addVersionRecord({
            versionName: "VERSION_34",
            modifiedModules: ["customerParser.ts", "SalesTools.tsx", "package.json"],
            notes: "Advanced Styled ExcelJS Multi-Tab Spreadsheet Export Engine (Freeze Panes, WrapText, Column Auto-Widths, Link Hyperlinks, Zebra Stripes, Metadata Sheet) & Lead Scoring Simplification.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV35) {
          await addVersionRecord({
            versionName: "VERSION_35",
            modifiedModules: ["SalesTools.tsx"],
            notes: "Simple Egyptian Arabic Sales & Telesales Copywriting Alignment for Filtering Engine.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV36) {
          await addVersionRecord({
            versionName: "VERSION_36",
            modifiedModules: ["server.ts"],
            notes: "Excel Download Compilation Bugfix: Await Promise Blobs on Server side in sendExcelBlob handler.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV37) {
          await addVersionRecord({
            versionName: "VERSION_37",
            modifiedModules: ["SalesTools.tsx"],
            notes: "Removed interactive 20-row preview card and previously processed sessions history card as requested by the user.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV38) {
          await addVersionRecord({
            versionName: "VERSION_38",
            modifiedModules: ["SalesTools.tsx"],
            notes: "Added high-contrast Show Data (عرض البيانات) actions and active filename viewing banner on top of the filter layout.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV39) {
          await addVersionRecord({
            versionName: "VERSION_39",
            modifiedModules: ["SalesTools.tsx", "server.ts", "firestore.rules"],
            notes: "Account isolation: Enabled client and backend per-user processing queues and security rule filtration.",
            rollbackAvailable: true,
            status: "ACTIVE"
          });
          needsRefresh = true;
        }

        if (!hasV211) {
          await addVersionRecord({
            versionName: "VERSION_211",
            modifiedModules: ["SalesAgent.tsx", "TelesalesAgent.tsx", "system_versions.md"],
            notes: "Integrated Department and Individual Target tracking with progress visualizations.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV212) {
          await addVersionRecord({
            versionName: "VERSION_212",
            modifiedModules: ["SalesAgent.tsx", "useVersions.ts", "system_versions.md"],
            notes: "Added client detailed information view modal with complete fields bento-grid presentation inside the Customer Data tab of SalesAgent.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV213) {
          await addVersionRecord({
            versionName: "VERSION_213",
            modifiedModules: ["useSettings.ts", "useVersions.ts", "system_versions.md"],
            notes: "Resolved Firestore Quota Exceeded issue by eliminating automated write-backs from in-memory snapshot sanitizers.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV214) {
          await addVersionRecord({
            versionName: "VERSION_214",
            modifiedModules: ["DataContext.tsx", "Layout.tsx", "useSettings.ts", "useSalesLeads.ts", "useTelesalesLeads.ts", "useClients.ts"],
            notes: "Integrated shared global context data caching, ultra-responsive 0-latency page switches, and high-fidelity Arabic progressive percentage loading screen.",
            rollbackAvailable: true,
            status: "SUPERCEDED"
          });
          needsRefresh = true;
        }

        if (!hasV215) {
          await addVersionRecord({
            versionName: "VERSION_215",
            modifiedModules: ["firebase.ts", "DataContext.tsx", "Layout.tsx", "SalesCRM.tsx", "ClientDetailsModal.tsx", "useVersions.ts", "system_versions.md"],
            notes: "Configured local persistent IndexedDB cache, handled Firestore Quota Exceeded error events gracefully, supported nested dot notation updates, and designed an informative Arabic stable local fallback banner.",
            rollbackAvailable: true,
            status: "ACTIVE"
          });
          needsRefresh = true;
        }

        if (needsRefresh) {
          // Retrieve refreshed list
          const refreshedq = query(collection(db, "system_versions"), orderBy("createdAt", "desc"));
          const refreshedSnapshot = await getDocs(refreshedq);
          const refreshedList = refreshedSnapshot.docs.map(doc => {
            return convertTimestamps<SystemVersion>({
              id: doc.id,
              ...doc.data()
            });
          });
          setVersions(refreshedList);
        } else {
          setVersions(versionList);
        }
      }
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const addVersionRecord = async (vData: Partial<SystemVersion>) => {
    try {
      await addDoc(collection(db, "system_versions"), {
        ...vData,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding version record:", error);
    }
  };

  const addBaseline = async () => {
    const baseline = {
      versionName: "VERSION_01",
      createdAt: new Date().toISOString(),
      modifiedModules: ["All modules"],
      notes: "Stable Baseline - Initial captured version",
      rollbackAvailable: true,
      status: "Stable Baseline"
    };

    try {
      const docRef = await addDoc(collection(db, "system_versions"), {
        ...baseline,
        createdAt: serverTimestamp()
      });
      setVersions([{ ...baseline, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding baseline:", error);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  return { versions, loading, fetchVersions };
}
