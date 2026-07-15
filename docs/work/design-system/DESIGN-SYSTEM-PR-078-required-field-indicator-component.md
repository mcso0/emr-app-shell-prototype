---
id: "DESIGN-SYSTEM-PR-078"
status: implemented
area: design-system
priority: P1
target_pr: "User request / shared required-field indicator"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/ux-ui-research-before-implementation.md"
updated: 2026-07-15
---

# DESIGN-SYSTEM-PR-078: Shared Required-Field Indicator

## Goal

Make the required-field asterisk a shared EMR component so its visual color can be changed in one source of truth across registration, reception, popover, profile, and hospital-admin forms.

## Scope

- Add `EmrRequiredIndicator` under `src/components/emr/`.
- Add `--emr-form-required-indicator` to the hand-authored EMR token layer and map it to Neutral 800.
- Replace inline required-marker markup and the hospital-basic-settings literal `대표 전화 *` label.
- Preserve existing label spacing and field validation behavior.
- Add Storybook documentation and focused source/browser regression coverage.

## Out of scope

- Changing error, destructive, primary-command, or status colors.
- Replacing all feature-local form-row wrappers with a single field-row component.
- Changing server validation, persistence, permissions, auth, or database behavior.
- Broad required-semantics propagation to every control; the marker remains decorative and control semantics stay with each field implementation.

## Done criteria

- All known visual required markers use `EmrRequiredIndicator`.
- The component uses `--emr-form-required-indicator` and the token resolves to `--clair-color-atomic-neutral-800`.
- The guardian registration screen renders the marker with the Neutral 800 color and `aria-hidden="true"`.
- Storybook, focused Playwright coverage, lint, typecheck, build, docs check, secret scan, and diff checks pass.

## Verification

- TDD RED: the new shared-marker contract failed because the component and token did not exist.
- TDD GREEN: focused source contract and guardian registration browser checks pass after implementation.
- Final verification is recorded in the completion report and PR description: focused Playwright 2 passed, lint, TypeScript, production build, Storybook build, docs check, secret scan, and diff checks passed.

## Result report

- `docs/completed/design/2026-07-15-design-system-pr-078-required-field-indicator-report.html`
