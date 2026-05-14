---
id: "DESIGN-SYSTEM-PR-011"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 11"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-010-inpatient-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-010"
updated: "2026-05-14"
---

# Customer Feature Semantic Token Cleanup

## Goal

Convert the 고객관리 feature screen's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/customer/module.tsx`.
- Change customer work badges, table header/row selected surfaces, workspace background, and title icon color.
- Add focused source audit coverage so future customer work does not reintroduce direct local color tokens in the scoped feature screen.
- Preserve animal/guardian switching, master table behavior, search, registration entry, common drawer URL compatibility, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing chart, reception, lab/imaging, dispensing/treatment, billing, inpatient, hospital-admin, home, auth/login, or drawer screens outside this feature.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, customer workflow enforcement, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The customer source audit in `tests/design-tokens.spec.ts` passes for `src/features/customer/module.tsx`.
- Semantic status meaning is preserved: active/customer badges keep info, completed/consented badges keep success, pending/recent work badges keep warning, neutral/deleted/unknown structure stays neutral.
- Focused customer verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/customer.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-011-customer-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-customer-feature-token-cleanup.md`.
