import { TeamMember } from "@/src/types";
import { Scope } from "@/src/context/RoleContext";

export interface ScopeUser {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

interface ScopeableLead {
  agentId?: string;
  agentName?: string;
  managerId?: string;
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

/**
 * Pure function — no hooks, no Firestore, no side effects.
 * Logic Layer: given a resolved role + the signed-in user + the full lead
 * set + (for managers) their team members, returns exactly the leads that
 * role is allowed to see.
 *
 * Call this from hooks/pages — NEVER from DataContext.
 */
export function scopeLeadsToRole<T extends ScopeableLead>(
  role: Scope,
  user: ScopeUser,
  leads: T[],
  teamMembers: TeamMember[] = []
): T[] {
  if (!leads?.length) return [];

  switch (role) {
    case "admin":
      return leads;

    case "manager": {
      const teamIds = new Set(teamMembers.map(m => norm(m.id)));
      const teamUids = new Set(teamMembers.map(m => norm(m.uid)));
      const teamNames = new Set(teamMembers.map(m => norm(m.name)));
      return leads.filter(lead =>
        norm(lead.managerId) === norm(user.id) ||
        teamUids.has(norm(lead.agentId)) ||
        teamIds.has(norm(lead.agentId)) ||
        teamNames.has(norm(lead.agentName)) // fallback while agentId backfill is incomplete
      );
    }

    case "agent":
      return leads.filter(lead =>
        (lead.agentId && norm(lead.agentId) === norm(user.id)) ||
        norm(lead.agentName) === norm(user.name)
      );

    default:
      return []; // unknown/unauthenticated role sees nothing — fail closed, not open
  }
}
