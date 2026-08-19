# MADAR Blue - Agent Instructions & Project Rules

## Versioning Policy
**CRITICAL:** This project enforces a strict versioning policy. 
- Before making any significant new changes, you MUST create a new version snapshot.
- Use the naming pattern: `VERSION_02`, `VERSION_03`, etc.
- Current Baseline: `VERSION_01` (Stable Baseline).

### Procedure for New Updates:
1.  **Snapshot:** Create a new record in the `system_versions` Firestore collection.
2.  **Log:** Update `/system_versions.md` with details of the changes.
3.  **Code:** Apply modifications to the active codebase.

### Current Version Status:
- **Active Version:** VERSION_221
- **Status:** Added full-stack WhatsApp Automation module integrating WasenderAPI with secure credentials backend routing, trigger-based status workflows, manual campaign runners, dynamic variables support, and meticulous log monitoring.
- **Created:** 2026-07-02

## Project Conventions
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Custom Indigo/Sky theme)
- **State:** React Context + Hooks
- **Persistence:** Firebase Firestore
- **AI:** Gemini Flash 1.5 via `@google/genai`
