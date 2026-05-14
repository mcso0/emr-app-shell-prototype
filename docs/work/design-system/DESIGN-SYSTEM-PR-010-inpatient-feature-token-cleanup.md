---
id: "DESIGN-SYSTEM-PR-010"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 10"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-009-billing-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-009"
updated: "2026-05-14"
---

# Inpatient Feature Semantic Token Cleanup

## Goal

Convert the 입원 feature screen's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/inpatient/module.tsx`.
- Change inpatient status/caution badges, KPI card tones, selected table row, ward section header, page background, and title icon color.
- Add focused source audit coverage so future inpatient work does not reintroduce direct local color tokens in the scoped feature screen.
- Preserve current date picker, ward filtering, search, row drawer, chart/discharge actions, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing chart, reception, lab/imaging, dispensing/treatment, billing, customer, hospital-admin, home, auth/login, or drawer screens outside this feature.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, admission/discharge workflow enforcement, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The inpatient source audit in `tests/design-tokens.spec.ts` passes for `src/features/inpatient/module.tsx`.
- Semantic status meaning is preserved: admitted/info remains info, critical remains danger, discharge-ready/care remains success, notice remains warning, and neutral structure stays neutral.
- Focused inpatient verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/inpatient.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-010-inpatient-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-inpatient-feature-token-cleanup.md`.
