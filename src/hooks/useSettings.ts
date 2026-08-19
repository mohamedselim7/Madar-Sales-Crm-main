// Backward-compatible re-export.
// The real implementation now lives in src/context/SettingsContext.tsx
// (an independent provider — it no longer reads from DataContext).
// Kept here so existing `import { useSettings } from "@/src/hooks/useSettings"`
// call sites across the app keep working unchanged.
export { useSettings, DEFAULT_TELESALES_FORM, DEFAULT_SALES_FORM } from "@/src/context/SettingsContext";
