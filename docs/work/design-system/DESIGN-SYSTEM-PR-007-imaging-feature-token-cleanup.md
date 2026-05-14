---
id: "DESIGN-SYSTEM-PR-007"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 7"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-006-lab-feature-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-006"
updated: "2026-05-14"
---

# Imaging Feature Semantic Token Cleanup

## Goal

Convert the 영상검사 feature screen's safe direct Clair atomic/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in the imaging-specific ranges of `src/features/lab-imaging/module.tsx`.
- Change imaging queue, imaging history aside, imaging order detail, reading sections, media strip, and right summary panel.
- Add focused source audit coverage so future imaging work does not reintroduce direct local color tokens in the scoped imaging ranges.
- Preserve current imaging queue, reading, attachment, right panel, and session-only mock behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Recoloring lab-specific ranges already completed in DESIGN-SYSTEM-PR-006.
- Changing chart, reception, dispensing/treatment, billing, inpatient, customer, hospital-admin, home, or drawer screens.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, or server enforcement.
- Broad component extraction or shared primitive API changes.

## Done When

- The imaging-scoped source audit in `tests/design-tokens.spec.ts` passes for `src/features/lab-imaging/module.tsx`.
- Semantic status meaning is preserved: success remains success, warning remains warning, danger remains danger, info/link remains informational, and neutral structure stays neutral.
- Focused lab/imaging verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/lab-imaging.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/imaging-feature-token-cleanup`. This work intentionally scopes the same source file to imaging-specific ranges after the lab cleanup in DESIGN-SYSTEM-PR-006.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-imaging-feature-token-cleanup.md`.
