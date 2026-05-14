---
id: "DESIGN-SYSTEM-PR-005"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 5"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-004-chart-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-004"
updated: "2026-05-14"
---

# Reception Feature Semantic Token Cleanup

## Goal

Convert the 접수/예약 feature screen's safe direct Clair atomic/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/reception/module.tsx`.
- Change only `src/features/reception/module.tsx` for the feature implementation pass.
- Add focused audit coverage so future reception work does not reintroduce direct local color tokens.
- Preserve current reception appointment, walk-in check-in, registration entry, calendar, drawer, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Editing `src/shell/nav-rail.tsx` or unrelated shell behavior.
- Recoloring `src/features/reception/profile-drawer.tsx`, lab/imaging, home kanban, auth/login, inpatient, customer, hospital-admin, billing, or dispensing screens.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- `src/features/reception/module.tsx` no longer matches the direct color audit pattern for `clair-color-*`, hex literals, rgba/rgb literals, and local Tailwind palette utilities in the scoped source audit.
- Semantic status meaning is preserved: success remains success, warning remains warning, danger remains danger, info/link remains informational, and neutral structure stays neutral.
- Remaining follow-up feature screens are listed for later cleanup.
- Focused reception verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/reception.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/reception-feature-token-cleanup`. Initial status check showed no local `src/shell/nav-rail.tsx` changes.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-reception-feature-token-cleanup.md`.
