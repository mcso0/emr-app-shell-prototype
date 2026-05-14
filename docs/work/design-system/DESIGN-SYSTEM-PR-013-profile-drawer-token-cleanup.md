---
id: "DESIGN-SYSTEM-PR-013"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 13"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-012-hospital-admin-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-012"
updated: "2026-05-14"
---

# Profile Drawer Semantic Token Cleanup

## Goal

Convert the shared 환자/보호자 profile drawer and registration dialog's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/reception/profile-drawer.tsx`.
- Change drawer field labels, section legends, search icons, popover rows, selected states, helper/notice panels, mode cards, summary icons, and warning/error surfaces.
- Add focused source audit coverage so future profile drawer work does not reintroduce direct local color tokens in this shared drawer.
- Preserve existing patient/guardian drawer URL compatibility, registration branching, validation copy, session-only profile store behavior, and toast/action behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing primary feature screens already cleaned up.
- Changing home kanban/workspace, auth/login, or other residual screens outside this drawer.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, profile workflow enforcement, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The profile drawer source audit in `tests/design-tokens.spec.ts` passes for `src/features/reception/profile-drawer.tsx`.
- Semantic status meaning is preserved: selection remains selected/info, destructive/error surfaces remain danger, warning notices remain warning, success summary remains success, and structural surfaces stay neutral.
- Focused profile drawer verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/reception.spec.ts tests/customer.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-013-profile-drawer-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-profile-drawer-token-cleanup.md`.
