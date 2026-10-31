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

## Approved follow-up — 2026-10-31

승욱 authorized local implementation from `origin/main` (`7baa5f89`) and rendered verification of the integrated panel-height proposal.

- Scope: 240px shared top row, 280px expanded order panel, matching pointer/keyboard/resize bounds, scroll access on short viewports, adaptive empty feedback below 160px, and Assessment empty-row/header-gutter repair.
- Preserve collapsed height, search focus, disabled actions, filter semantics, loading/errors, clinical data, API and permission contracts. No remote writes or deployment are included.
- Completion checks: rendered panel geometry, empty/filtered/populated states, short/narrow viewport access, collapse/expand, focused existing chart tests, type/lint and doc checks. Local implementation is ready for human review; no delivery is included.

### Follow-up verification

- Local Chromium with synthetic/mock data: Home/End and pointer extremes measured 240px top and 280px order; collapse/expand retained 38px/280px. At 1024×600, workspace height was 432px and scroll height 536px. Finance actions remained reachable.
- Empty Assessment: table viewport client/scroll height both 156px; compact body was about 40px with its icon hidden. Search focus passed. Taller bodies restored the original icon/copy/action arrangement.
- 30 synthetic diagnoses: viewport 156px, content 1236px, scrollTop 400; all six header/body column widths matched. Filtered Assessment preserved `no-filter-results` and fit its 120px body. Filtered orders fit a 108px body without the icon.
- Injected save failure: notice stayed inside the 240px Assessment panel at desktop and 1024px widths. Loading and disabled controls passed the existing Storybook cases. This proves presentation only, not remote persistence or permissions.
- Passed: focused chart collapse/divider Playwright tests (3), Assessment Storybook browser cases (5, including short body/search focus), TypeScript, scoped ESLint, docs links, secret scan, and diff whitespace checks.
- Existing broader chart checks remain failing: order header action count (expected 4, current 5), no-horizontal-scroll assertion at 443px vs 480px table minimum, and legacy Assessment geometry/fixture timing. Original `7baa5f89` also failed those three tests in a baseline comparison; Assessment failed at an earlier fixture/208px-row assertion there. The initial cold-server collapse failure passed on the final focused run. No unrelated test expectations were changed.
- At initial implementation closeout, full production build, deployment, authenticated production testing, and native browser zoom were not run. Local screenshots, scripts, and measured results are retained under `output/playwright/chart-panel-height/` and are not published.

### PR preparation — 2026-10-31

- 승욱 approved the full build and commit/push/PR of this follow-up only. No main merge or Production action is authorized.
- `npm run build` passed, including TypeScript and 25 static pages. It retained one unrelated filesystem-tracing warning at `src/lib/prd-viewer/doc-reader.ts:78`.
- Full `npm run lint` completed with zero errors; three warnings belong only to untracked local browser-verification scripts excluded from the PR. Secret scan, docs checks, and whitespace checks passed.
- The candidate includes only the panel/feedback implementation, its Assessment story, this work record, and the owning layout contract. Screenshots, logs, browser scripts, and unrelated primary-checkout WIP remain local.
