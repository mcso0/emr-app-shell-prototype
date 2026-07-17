---
id: "DESIGN-SYSTEM-PR-080"
status: implemented
area: design-system
priority: P1
target_pr: "Browser comment / EmrEmptyState whole-content read-error state"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md"
updated: 2026-07-18
---

# DESIGN-SYSTEM-PR-080: EmrEmptyState Whole-content Read Error

## Goal

Register the patient pre-call full-content read failure as a real shared `EmrEmptyState` state instead of a report-only `feedback-card` imitation.

## Scope

- Add `read-error` to `EmrEmptyStateKind`.
- Reuse the existing CDS alert-triangle icon inside the established CDS.V2 empty-state slot.
- Add Storybook coverage for the patient pre-call retry and safe-exit use case.
- Clarify that only whole-content read failures use this exception; partial/degraded failures remain `EmrInlineAlert`.
- Rebuild the interactive HTML report without the legacy `feedback-card` contract.

## Out of scope

- Wiring a real reception fetch, retry request, route transition, logging, or persistence behavior.
- Converting partial reads, stale data, save/write failures, loading, or permission blockers to empty states.
- Changing existing empty-state sizes, tokens, action ordering, queue placement, or feature screens.

## Done criteria

- `EmrEmptyState kind="read-error"` is accepted by the public component contract.
- The default state uses the existing CDS alert-triangle icon and preserves the `lg` 48px area / 24px icon contract.
- Storybook documents and verifies secondary-first / primary-second recovery actions.
- The interactive patient pre-call report exposes the same `read-error` use case and contains no `feedback-card` selector.
- Focused type, lint, Storybook-build, and report-contract checks pass; any browser-policy limitation is recorded explicitly.

## Verification

- TDD RED: the Storybook `read-error` story failed TypeScript because the kind was not registered.
- TDD GREEN: `scripts/test-emr-empty-state-read-error-contract.mjs` passes after the public kind, CDS icon mapping, Storybook story, and documentation exception were added.
- TypeScript and focused ESLint checks pass.
- The complete Storybook static build passes and includes the updated `empty-state.stories` bundle.
- The standalone report's Figma source contract, build, and structure checks pass; the generated HTML includes `read-error` and contains no rendered `feedback-card` or legacy `feedback-screen` contract.
- The in-app browser retained the rebuilt standalone report as the deliverable tab. Browser-controlled `file://` reload is blocked by browser policy, so the file artifact was validated by the standalone structure test rather than an automated reload.
