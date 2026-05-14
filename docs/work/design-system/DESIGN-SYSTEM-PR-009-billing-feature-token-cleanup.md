---
id: "DESIGN-SYSTEM-PR-009"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 9"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-008-dispensing-treatment-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-008"
updated: "2026-05-14"
---

# Billing Feature Semantic Token Cleanup

## Goal

Convert the 수납 feature screen's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/billing/module.tsx`.
- Change billing title guidance, guardian group cards, warning notice, invoice table header, summary lines, and right-panel note surfaces.
- Add focused source audit coverage so future billing work does not reintroduce direct local color tokens in the scoped feature screen.
- Preserve current queue selection, invoice quantity editing, combine/uncombine, payment method, invoice issue/unpaid/paid actions, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing chart, reception, lab/imaging, dispensing/treatment, inpatient, customer, hospital-admin, home, auth/login, or drawer screens outside this feature.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, payment provider integration, receipt generation, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The billing source audit in `tests/design-tokens.spec.ts` passes for `src/features/billing/module.tsx`.
- Semantic status meaning is preserved: warning remains warning, selected remains selected, emphasized amount remains command/primary emphasis, and neutral structure stays neutral.
- Focused billing verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/billing.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-009-billing-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-billing-feature-token-cleanup.md`.
