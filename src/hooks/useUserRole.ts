// Backward-compatible re-export.
// The real implementation now lives in src/context/RoleContext.tsx
// (depends only on Auth + Settings — never on DataContext, so the old
// "useUserRole -> useSettings -> useData" chain no longer exists).
export { useUserRole } from "@/src/context/RoleContext";
