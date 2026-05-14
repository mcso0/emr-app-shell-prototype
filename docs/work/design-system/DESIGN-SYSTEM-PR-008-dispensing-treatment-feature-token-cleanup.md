---
id: "DESIGN-SYSTEM-PR-008"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 8"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-007-imaging-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-007"
updated: "2026-05-14"
---

# Dispensing/Treatment Feature Semantic Token Cleanup

## Goal

Convert the 조제/처치 feature screen's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/dispensing/module.tsx`.
- Change the dispensing/treatment history aside divider, assignment status action, order group meta/action divider, and related instruction header controls.
- Add focused source audit coverage so future dispensing/treatment work does not reintroduce direct local color tokens in the scoped feature screen.
- Preserve current queue selection, assignment, completion, drawer, panel, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing chart, reception, lab/imaging, billing, inpatient, customer, hospital-admin, home, auth/login, or drawer screens outside this feature.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The dispensing/treatment source audit in `tests/design-tokens.spec.ts` passes for `src/features/dispensing/module.tsx`.
- Semantic status meaning is preserved: in-progress remains informational/active, completed remains success/complete, warnings/danger are not repurposed, and neutral structure stays neutral.
- Focused dispensing/treatment verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-008-dispensing-treatment-token-cleanup`. Existing user-owned change in `src/shell/nav-rail.tsx` is unrelated and must remain unstaged.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-dispensing-treatment-feature-token-cleanup.md`.
