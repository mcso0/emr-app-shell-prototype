---
id: "DESIGN-SYSTEM-PR-079"
status: implemented
area: design-system
priority: P1
target_pr: "User request / required-field indicator Neutral 900 follow-up"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-078-required-field-indicator-component.md"
updated: 2026-07-15
---

# DESIGN-SYSTEM-PR-079: Required-Field Indicator Neutral 900 Follow-up

## Goal

Change the shared required-field indicator from Neutral 800 to Neutral 900 after visual review, without changing component ownership or field semantics.

## Scope

- Remap `--emr-form-required-indicator` to `--clair-color-atomic-neutral-900`.
- Update the shared Storybook copy and focused regression contract.
- Record the follow-up in the design-system work index and completion report.

## Out of scope

- Replacing the shared `EmrRequiredIndicator` component.
- Changing required-field spacing, markup, accessibility semantics, or validation behavior.
- Changing other Neutral 800 usages, error/status colors, database, API, auth, or permissions.

## Done criteria

- The shared token resolves to Clair Neutral 900.
- The guardian registration browser test confirms the indicator still renders and resolves through the shared token.
- Storybook, lint, typecheck, build, docs, secret, and diff checks pass.

## Verification

- Baseline required-indicator suite: 2 passed on the merged Neutral 800 implementation.
- TDD RED: the updated 900 contract failed against the existing 800 token.
- TDD GREEN: focused required-indicator suite passes after the token remap.
- Final verification is recorded in the completion report and PR description: focused Playwright 2 passed, lint, TypeScript, production build, Storybook build, docs check, secret scan, and diff checks passed.

## Result report

- `docs/completed/design/2026-07-15-design-system-pr-079-required-field-indicator-neutral-900-report.html`
