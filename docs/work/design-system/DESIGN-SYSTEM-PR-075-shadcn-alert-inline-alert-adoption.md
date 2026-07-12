---
id: "DESIGN-SYSTEM-PR-075"
status: implemented
area: design-system
priority: P1
target_pr: "User request / shadcn Alert adoption for EMR inline feedback"
source_docs:
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/system/cta-risk-taxonomy.md"
  - "docs/superpowers/plans/2026-07-12-shadcn-alert-inline-alert-adoption.md"
updated: 2026-07-12
---

# Shadcn Alert Adoption For EMR Inline Feedback

## Goal

Compose the persistent EMR inline-alert pattern on the project shadcn `base-nova` Alert primitive, while keeping the EMR severity and recovery-action contract stable.

## Scope

- Add the generated shadcn Alert source under `src/components/ui/alert.tsx`.
- Refactor `EmrInlineAlert` to compose the shadcn alert structure.
- Keep the current `info`, `success`, `warning`, and `error` semantic token rules and ARIA role mapping.
- Add an optional top-end `dismissAction` slot without changing the placement of existing recovery actions.
- Change the chart unavailable-action notice from a text acknowledgement to an accessible X dismiss control.
- Cover the chart user interaction with focused Playwright coverage.

## Out Of Scope

- Changing recovery actions in billing, reception, notifications, dispensing, customer, or authentication flows.
- Changing alert copy, server behavior, permissions, API contracts, or persistence.
- Replacing all EMR components with shadcn components.
- Adding a runtime dependency, changing the shadcn preset, or updating unrelated shadcn sources.

## Done Criteria

- `EmrInlineAlert` composes shadcn Alert structure without breaking its existing severity or action API.
- The alert has an optional labelled top-end dismiss slot.
- Clicking `Order 출력` shows the current explanatory copy, no `확인` action, and a working X dismiss control.
- Focused browser coverage, typecheck, lint, docs check, secret scan, and whitespace check pass.

## Verification

- `npx playwright test tests/chart.spec.ts -g "chart unavailable order actions" --reporter=line`
- `npx tsc --noEmit`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Verification Results (2026-07-12)

- Passed focused Playwright coverage for the unavailable chart action using an
  isolated local port: the X control is visible, the text acknowledgement is
  absent, and dismissal hides the alert.
- Passed `npx tsc --noEmit`.
- Passed `npm run lint -- --ignore-pattern '.worktrees/**'`.
- Passed `npm run docs:check` and `npm run security:secrets`.
- Passed `git diff --check`.
- Passed `npm run build`.
  - Existing worktree-only warnings remain: Next.js detects multiple lockfiles
    and the PRD viewer's dynamic source-path tracing is broad. Neither warning
    is caused by this alert change.
