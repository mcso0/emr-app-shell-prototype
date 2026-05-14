---
id: "DESIGN-SYSTEM-PR-006"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 6"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-004-chart-feature-token-cleanup.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-005-reception-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-004"
  - "DESIGN-SYSTEM-PR-005"
updated: "2026-05-14"
---

# Lab Feature Semantic Token Cleanup

## Goal

Convert the 임상병리 feature screen's safe direct Clair atomic/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in the lab-specific ranges of `src/features/lab-imaging/module.tsx`.
- Change lab queue, lab result document, lab history aside, lab equipment receipt panel, and the shared attachment strip used by lab.
- Add focused source audit coverage so future lab work does not reintroduce direct local color tokens in the scoped lab ranges.
- Preserve current lab queue, result entry, equipment receipt, attachment, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Recoloring imaging-only ranges in `src/features/lab-imaging/module.tsx`.
- Changing chart, reception, dispensing/treatment, billing, inpatient, customer, hospital-admin, home, or drawer screens.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The lab-scoped source audit in `tests/design-tokens.spec.ts` passes for `src/features/lab-imaging/module.tsx`.
- Semantic status meaning is preserved: success remains success, warning remains warning, danger remains danger, info/link remains informational, and neutral structure stays neutral.
- Imaging-only direct colors remain explicitly deferred to the next PR.
- Focused lab/imaging verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/lab-imaging.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/lab-feature-token-cleanup`. This work intentionally scopes the same source file to lab-specific ranges and leaves imaging-only cleanup for the next feature-screen PR.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-lab-feature-token-cleanup.md`.
