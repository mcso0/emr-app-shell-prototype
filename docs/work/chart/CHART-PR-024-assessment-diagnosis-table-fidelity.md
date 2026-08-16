---
id: "CHART-PR-024"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Browser comments / Figma Assessment diagnosis table fidelity"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/work/chart/CHART-PR-019-figma-exact-chart-screen.md"
  - "docs/work/chart/CHART-PR-021-chart-contents-v2-fidelity.md"
dependencies:
  - "CHART-PR-019"
  - "CHART-PR-021"
  - "CLINICAL-BILLING-PR-006"
updated: "2026-08-15"
---

# Assessment Diagnosis Table Fidelity

## Goal

Align the chart Assessment diagnosis table with Figma node `27985:75982` while preserving the existing chart search, save, permission, and encounter contracts.

## Approved Scope

- Replace the presentation-only diagnosis grid with the existing semantic shadcn/EMR table composition.
- Match the Figma toolbar, table header, row, column, typography, border, radius, badge, checkbox, and action geometry at the source viewport.
- Add the visible column order `진단계통`, `진단명`, `주진단`, `확진`, `종결`, `수의사`, action.
- Use the shared `EmrTableCheckbox`; add a backwards-compatible brand checked tone for `주진단` that resolves through the project `sky/500` token. Keep `확진` and `종결` neutral.
- Make `진단계통` and `진단명` locally sortable through the existing `EmrTableHeaderCell`, including keyboard activation and `aria-sort`, without changing persisted `sortOrder`.
- Enforce at most one primary diagnosis per encounter in the client and server input boundary.
- Expose contextual delete on pointer hover and row focus, and keep it visible on coarse-pointer/touch environments.
- Persist diagnosis closure as nullable `closed_at` and `closed_by_user_id` fields through the existing chart diagnosis route/RPC permission boundary.
- Add focused shared-component, browser, server, migration-contract, token, and responsive verification.

## Ownership Decision

- Keep the low-level shadcn checkbox primitive unchanged.
- Extend only `EmrTableCheckbox` because the tone is a table-semantic state and the default must remain neutral for all current consumers.
- Keep Assessment column sizing, sorting state, contextual action visibility, and clinical labels feature-local.
- Reuse the existing shared `Table`, `EmrTableHeaderCell`, `Badge`, `Button`, `Input`, `Select`, `Separator`, and icon components; add no dependency. Define the brand checked state as one EMR semantic token that aliases the approved atomic `sky/500` value.

## Out Of Scope

- A real diagnosis catalog API, diagnosis recommendations, billing automation, or clinical decision support.
- Reordering stored diagnosis rows when the user changes the visible sort.
- Changing SOAP, Order, chart-completion, encounter, role/permission, or audit-event policy.
- Editing global CLAiR token values or hardcoding the Figma raw `sky/500` hex.
- Applying a migration remotely, deploying, committing, pushing, or opening a PR.

## Done Criteria

1. At the Figma source width, Assessment spacing, sizes, typography, colors, column alignment, and control geometry match the inspected node except for the approved project-token value of `sky/500`.
2. Primary, confirmed, and closed states are independent, accessible checkboxes; primary remains mutually exclusive.
3. Sort headers expose correct semantic table markup, keyboard behavior, and `aria-sort` state.
4. Delete is operable with pointer, keyboard focus, and touch/coarse-pointer input.
5. Diagnosis closure round-trips through mock and Supabase gateway mappings without weakening the existing workspace/encounter/permission checks.
6. Focused Storybook, Playwright, type, lint, build, docs, secret, and diff checks pass.

## Verification

- `npx playwright test tests/chart-diagnosis-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --grep "diagnosis|Assessment" --reporter=line`
- `npx playwright test tests/design-tokens.spec.ts --reporter=line`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build-storybook`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Verification Result — 2026-08-15

- Passed focused Assessment visual/geometry, semantic sorting, primary exclusivity, confirmation, closure, keyboard-focus delete, and touch delete Playwright coverage. Added the approved 567×452 Assessment snapshot.
- Passed all 7 diagnosis route/core/gateway/migration tests, including closure round-trip, actor/session equality, `chart:view`/`chart:update`, and multiple-primary rejection contracts.
- Passed the focused `sky/500` semantic-token test and two existing customer-table checkbox regressions; neutral remains the shared default.
- Passed TypeScript, ESLint with zero warnings, production build, Storybook build, docs links, secret scan, and `git diff --check`.
- The chart suite passed 58 of 59 tests after excluding the full-workspace snapshot, which reports unrelated Order/status pixel drift in addition to the intentional Assessment change. The remaining unrelated Order alert test compares against a `display: contents` parent with a zero-width bounding box and fails in isolation while the document itself has no horizontal overflow; this slice does not change that test or Order layout.
- The full design-token suite retains unrelated baseline failures across existing reception, lab, imaging, billing, customer, admin, home, auth, shell, and shared-component sources. The new Assessment token assertion passes and this slice introduces no raw color literal in its new component files.

## Result Report

- `docs/completed/chart/2026-08-16-chart-pr-024-assessment-diagnosis-table-report.html`

## Remote Verification — 2026-08-16

- Applied the additive migration to the linked synthetic/demo Supabase project as remote version `20260816062243` (`chart_diagnosis_closure`).
- Catalog verification confirmed `closed_at` as `timestamptz`, `closed_by_user_id` as `uuid`, and an empty `search_path` on both diagnosis RPCs.
- Function privilege verification confirmed `anon` cannot execute either RPC while `authenticated` can execute both.
- Post-migration advisors reported the existing project-wide RLS-without-policy and performance notices; no new CHART-PR-024-specific advisor category was introduced.
