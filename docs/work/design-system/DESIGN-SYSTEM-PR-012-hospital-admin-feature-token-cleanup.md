---
id: "DESIGN-SYSTEM-PR-012"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 12"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-011-customer-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-011"
updated: "2026-05-14"
---

# Hospital Admin Feature Semantic Token Cleanup

## Goal

Convert the 병원관리 feature screen's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/hospital-admin/module.tsx`.
- Change Order management side-nav labels, workspace surfaces, table header/row selection, active status text, drawer field labels, static drawer surfaces, drawer footer, and destructive delete affordance.
- Add focused source audit coverage so future hospital-admin work does not reintroduce direct local color tokens in the scoped feature screen.
- Preserve Order category/subcategory navigation, filtering/search, selection, duplication, drawer edit/save/delete, and session-only store behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing chart, reception, lab/imaging, dispensing/treatment, billing, inpatient, customer, home, auth/login, or drawer screens outside this feature.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, hospital-admin workflow enforcement, or server enforcement.
- Implementing Order set management or expanding hospital-admin product behavior.
- Broad component extraction or shared primitive API changes.

## Done When

- The hospital-admin source audit in `tests/design-tokens.spec.ts` passes for `src/features/hospital-admin/module.tsx`.
- Semantic status meaning is preserved: active status remains success, destructive delete remains danger, selection remains selected/neutral surface, and structural surfaces stay neutral.
- Focused hospital-admin verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/hospital-admin.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-012-hospital-admin-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-hospital-admin-feature-token-cleanup.md`.
