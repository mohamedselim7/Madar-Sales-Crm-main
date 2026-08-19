import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useSettings } from "@/src/context/SettingsContext";
import { TeamMember } from "@/src/types";

export type Scope = "admin" | "manager" | "agent" | "unknown";

interface RoleContextType {
  isAdmin: boolean;
  isMember: boolean;
  hasAccess: boolean;
  memberInfo: TeamMember | null;
  allowedPages: string[];
  allowedDepartments: string[];
  role: Scope;
  teamMembers: TeamMember[]; // populated only when role === "manager"
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);
const MASTER_EMAIL = "abdelrahmanahmed011147@gmail.com";
const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

/**
 * Role Layer — depends ONLY on Auth (who is signed in) and Settings
 * (the team/department config). It never imports DataContext, so it can
 * never throw "must be used within a DataProvider" and it can never
 * participate in a circular dependency with the data-fetching layer.
 */
export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  const value = useMemo<RoleContextType>(() => {
    const loading = authLoading || settingsLoading;

    if (loading || !user) {
      return {
        isAdmin: false,
        isMember: false,
        hasAccess: false,
        memberInfo: null,
        allowedPages: [],
        allowedDepartments: [],
        role: "unknown",
        teamMembers: [],
        loading,
      };
    }

    // Check if user is in any team dynamically across all department team lists
    const allTeams = settings.teamSettings
      ? (Object.values(settings.teamSettings).filter(Array.isArray).flat() as TeamMember[])
      : [];

    const matchingMembers = allTeams.filter(m => norm(m.email) === norm(user.email));
    // Sort descending by id to get the latest created or edited member record for this email
    const member = matchingMembers.length > 0
      ? [...matchingMembers].sort((a, b) => String(b.id || "").localeCompare(String(a.id || "")))[0]
      : null;

    const isAdmin = member?.role === "Admin" || member?.role === "admin" || norm(user.email) === MASTER_EMAIL;

    let userAllowedPages = member?.allowedPages ? [...member.allowedPages] : [];
    userAllowedPages = userAllowedPages.map(p => (p === "sales" ? "sales_agent" : p));
    if (!userAllowedPages.includes("home")) {
      userAllowedPages.push("home");
    }

    if (member?.department) {
      const deptLower = norm(member.department);
      if (deptLower === "telesales" && !userAllowedPages.includes("telesales_agent")) {
        userAllowedPages.push("telesales_agent");
      }
      if ((deptLower === "sales" || deptLower === "مبيعات" || deptLower.includes("سيلز")) && !userAllowedPages.includes("sales_agent")) {
        userAllowedPages.push("sales_agent");
      }
    }

    const allowedPages = isAdmin
      ? ["home", "telesales", "telesales_agent", "sales_agent", "sales_hub", "settings", "sales_tools", "whatsapp_automation"]
      : userAllowedPages.filter(p => p !== "cr" && p !== "marketing");

    const allowedDepartments = isAdmin
      ? (settings.departments ? settings.departments.map(d => d.id) : ["ads", "seo", "content", "design", "editor"])
      : (member?.department ? [member.department] : []);

    // Role resolution for data-scoping purposes (separate from page-access "allowedPages" above).
    const role: Scope = isAdmin
      ? "admin"
      : member?.role === "manager"
        ? "manager"
        : member
          ? "agent"
          : "unknown";

    // A manager's team = every TeamMember whose managerId points back at this member.
    const teamMembers = role === "manager" && member
      ? allTeams.filter(m => m.managerId === member.id)
      : [];

    return {
      isAdmin,
      isMember: !!member,
      hasAccess: isAdmin || (!!member && allowedPages.length > 0),
      memberInfo: member || null,
      allowedPages,
      allowedDepartments,
      role,
      teamMembers,
      loading: false,
    };
  }, [user, authLoading, settings, settingsLoading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useUserRole = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useUserRole must be used within a RoleProvider");
  }
  return context;
};
