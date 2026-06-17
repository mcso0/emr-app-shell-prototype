---
id: "DEMO-DATA-PR-002-LEGACY-MOCK-CLEANUP-INVENTORY"
status: "draft"
area: "demo-data"
priority: "P0"
related_work:
  - "DEMO-DATA-PR-002"
updated: "2026-06-17"
---

# Legacy Mock Cleanup Inventory

## Purpose

This inventory prepares code cleanup before broad refactoring. The current verification target is the Cheongdam seed workspace, `workspace-clair-cheongdam`, not the legacy `clair-demo` Sales Demo path. Legacy fixtures and silent mock fallback must not hide Cheongdam seed/API failures.

## Search Basis

Initial scan terms:

- `clair-demo`
- `LEGACY_SALES_DEMO_WORKSPACE_ID`
- `Sales Demo`
- `mock fallback`
- `allowMockFallback`
- `/w/clair-demo`
- `kong-vomit`
- `2026-05-01`

Use `rg` before every removal PR and verify each candidate still exists at the time of editing.

## Classification Rules

| Class | Meaning | Default action |
| --- | --- | --- |
| `delete-candidate` | Sales Demo launcher, fixed scenario route, stale fixture copy, or test that only preserves old Sales Demo behavior | Remove after Cheongdam replacement coverage exists |
| `cheongdam-migrate` | Behavior still valuable but currently scoped to `clair-demo` or fixed May 2026 data | Repoint to `workspace-clair-cheongdam`, current operating date, or seed/API fixture |
| `local-only-mock` | Explicit mock mode for unconfigured local development | Keep only when clearly isolated from seed-backed verification |
| `test-fixture` | Unit/server test fixture proving a route contract rather than product default behavior | Keep temporarily, then rename or duplicate with Cheongdam coverage |
| `needs-manual-review` | Dynamic route, Next.js convention, Playwright route mock, auth/session boundary, or safety/security path | Review before deleting |

## Current Inventory

| Area | Representative files | Classification | Cleanup direction |
| --- | --- | --- | --- |
| Current status and boundary docs | `docs/engineering/current-status.md`, `docs/engineering/architecture/mock-live-boundary-map.md` | `cheongdam-migrate` | Keep Cheongdam seed as the default claim; remove Sales Demo preservation language. |
| Active work item and product data docs | `docs/work/demo-data/DEMO-DATA-PR-002-clinic-start-state-demo-operations.md`, `docs/product/demo-data/clinic-start-state-and-demo-operations-v1.md` | `cheongdam-migrate` | Treat legacy Sales Demo as cleanup target; keep local mock caveats. |
| Earlier demo DB/UI work items | `docs/work/demo-data/DEMO-DB-PR-*`, `docs/work/demo-data/UI-PR-*`, `docs/work/demo-data/DEN-45*` | `test-fixture` | Do not rewrite historical scope broadly; replace wording only when it reads like current Sales Demo preservation policy. |
| Workspace constants | `src/lib/emr-domain/demo-workspaces.ts` | `needs-manual-review` | Keep constants during transition; later remove `LEGACY_SALES_DEMO_WORKSPACE_ID` only after all call sites are gone. |
| Global entry points | `src/features/home/home.mock.ts`, `src/features/home/components/hospital-flow-board.tsx`, `src/shell/app-shell.tsx`, `src/shell/global-command-palette.tsx`, `src/features/notifications/mock-notifications.ts`; deleted in Candidate 5: `src/features/home/demo-launcher.tsx`, `src/features/placeholders/module.tsx` | `delete-candidate` / `cheongdam-migrate` | Keep global navigation scoped to the active workspace; ensure Cheongdam does not display legacy notifications or work cards. |
| Reception/customer Cheongdam guards | `src/features/reception/data.ts`, `src/features/reception/module.tsx`, `src/features/customer/module.tsx` | `cheongdam-migrate` / `needs-manual-review` | Preserve Cheongdam seed/API flow; remove legacy fixture inheritance only after focused reception/customer tests cover it. |
| Chart, lab, imaging, dispensing, billing fallback | `src/features/chart/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/dispensing/module.tsx`, `src/features/billing/module.tsx` | `cheongdam-migrate` | Prefer API/seed readback for Cheongdam; do not let `allowMockFallback` produce visible stale work in Cheongdam. |
| Server-core mock gateways | `src/features/**/server-*-core.ts` | `local-only-mock` / `test-fixture` | Keep route-contract tests working while adding Cheongdam seed-backed cases; do not delete security/session fallbacks without auth review. |
| Legacy scenario helpers | `src/lib/emr-domain/demo-scenarios.ts`, `src/lib/emr-domain/demo-date.ts`, Sales Demo `kong-vomit` references | `delete-candidate` / `test-fixture` | Remove launcher-only helpers now; keep explicit scenario fixtures only until replacement QA scripts no longer depend on fixed May 2026 data. |
| Existing Sales Demo tests | `tests/sales-demo-flow.spec.ts`, `tests/ui-demo-api-wiring-e2e.spec.ts`, broad `/w/clair-demo` Playwright specs | `delete-candidate` / `test-fixture` | Replace with Cheongdam seed/API workflow tests before removal. |
| Cheongdam regression tests | `tests/demo-reality-start-state.spec.ts`, `tests/cheongdam-seed-workflow-replacement.spec.ts`, Cheongdam cases in `tests/reception.spec.ts`, `tests/customer.spec.ts`, `tests/chart-live-queue-server.spec.ts`, `tests/lab-imaging.spec.ts`, `tests/dispensing-fulfillment.spec.ts`, `tests/demo-session-reset-server.spec.ts` | `cheongdam-migrate` | Keep and expand as the primary regression suite. |

## Cleanup Priority

1. Remove Sales Demo preservation wording from current docs and active work handoff. `2026-06-17: direct preservation wording cleanup started; DEN-64 is superseded by this cleanup direction.`
2. Rename or replace tests whose only purpose is preserving old Sales Demo fallback. `2026-06-17: test titles now label legacy Sales Demo coverage as explicit fixture coverage; behavior removal still requires Cheongdam replacement coverage.`
3. Remove global `/w/clair-demo` default navigation from home, shell, command palette, and notifications. `2026-06-17: runtime Home and notification routes now scope to the active workspace; command palette was already workspace-scoped and Cheongdam-safe.`
4. Tighten Cheongdam module guards so API failure shows loading/error/empty states instead of old fixture work. `2026-06-17: missing workspace fallback now resolves to Cheongdam seed verification scope instead of legacy Sales Demo for customer, reception, registration drawer, lab/imaging, dispensing, and billing screens.`
5. Migrate or delete workflow-module `allowMockFallback` paths after Cheongdam seed/API tests cover the same behavior. `2026-06-17: chart, lab/imaging, dispensing, and billing runtime fixture fallback now requires explicit legacy Sales Demo workspace scope instead of every non-Cheongdam workspace.`
6. Delete Sales Demo launcher, fixed `2026-05-01` scenario routes, and `kong-vomit` helpers after no tests or routes require them. `2026-06-17: Home ?view=demo launcher and launcher-only helpers were removed; explicit kong-vomit route-contract fixtures remain because multiple focused tests still depend on them.`
7. Replace direct legacy Kong flow coverage with Cheongdam seed/API workflow coverage before deleting the remaining scenario registry. `2026-06-17: added a Cheongdam seed/API workflow replacement test for reception -> chart -> lab -> imaging -> dispensing -> billing, and blocked reception central detail fallback from reading legacy mock patients in Cheongdam. Later on 2026-06-17, moved the billing paid-action proof from legacy Kong coverage into the Cheongdam seed/API test and reduced the Kong billing assertion to fixture availability. Candidate 8 then removed fixed Kong clinical-content assertions for chart diagnosis/order text, lab WBC 21.4, and imaging impression text from the broad Sales Demo flow test while strengthening Cheongdam chart/imaging seed/API visibility assertions.`

## Candidate 1 Progress - Sales Demo Preservation Wording

Updated on 2026-06-17:

- Reworded UI PR 1, UI PR 2, DEN-452, DEN-454, and DEN-456 handoff text so old Sales Demo/local fallback scope reads as historical or cleanup debt, not a current preservation requirement.
- Marked the DEN-64 reception Sales Demo preservation note as `superseded` and linked it back to this cleanup inventory.
- Updated auth briefing/work-order, QA, and reception persistence guidance so legacy Sales Demo coverage is no longer described as current product proof.
- Renamed legacy Sales Demo Playwright titles to make the route explicit fixture coverage, not the current golden path.
- Did not remove runtime Sales Demo behavior, `/w/clair-demo` navigation, fixture constants, or fallback code in this pass.

## Candidate 2 Progress - Global Entrypoint Workspace Scope

Updated on 2026-06-17:

- Home mock data now rewrites task, hospital task, role launcher, flow summary, and role-next-action links to the active `workspaceId` before returning dashboard data.
- The hospital flow board fallback link now defaults to the Cheongdam prepared clinic workspace instead of `/w/clair-demo`.
- Notification fixture routes remain legacy raw fixture data, but shell runtime now uses `getWorkspaceScopedNotifications(workspaceId)` so notification source navigation cannot silently jump from another workspace into `/w/clair-demo`.
- The command palette did not need code changes in this pass because quick actions already use the active `workspaceId`, and Cheongdam already suppresses legacy patient, guardian, appointment, and encounter fixtures.
- Did not remove the explicit Sales Demo launcher, `LEGACY_SALES_DEMO_WORKSPACE_ID`, or raw fixture literals. Those remain delete/migration candidates for later priority items.

## Candidate 3 Progress - Cheongdam Module Fallback Guard

Updated on 2026-06-17:

- Added shared workspace resolution helpers in `src/lib/emr-domain/demo-workspaces.ts` so missing route/path workspace values default to `workspace-clair-cheongdam`, while explicitly addressed `clair-demo` routes still stay available for legacy fixture coverage.
- Replaced direct `clair-demo` fallback defaults in customer, reception, registration drawer, lab/imaging, dispensing, and billing screen code with the shared Cheongdam seed verification resolver.
- Added regression coverage that missing workspace fallback resolves to Cheongdam seed verification scope and explicit legacy Sales Demo routing remains explicit.
- Did not touch server-core mock gateways, explicit Sales Demo launcher behavior, or broad workflow-module `allowMockFallback` paths. Those remain later cleanup candidates.

## Candidate 4 Progress - Workflow Module Mock Fallback Shrink

Updated on 2026-06-17:

- Chart fallback bundles and queue fixture items now require `isLegacySalesDemoWorkspace(workspaceId)` instead of the previous non-Cheongdam condition.
- Lab/imaging detail fallback, queue fixture items, history fixture lists, and right-panel fixture summaries now require explicit legacy Sales Demo workspace scope.
- Dispensing/treatment queue fixture items, selected fixture item fallback, history fixtures, and default order table fixture cloning now require explicit legacy Sales Demo workspace scope.
- Billing detail fallback, queue rows, invoice/payment store fallback, and fixed May 2026 side-panel date now require explicit legacy Sales Demo workspace scope.
- Added regression coverage to prevent workflow modules from returning to `!isPreparedEmptyClinicWorkspace(workspaceId)` as the broad mock fallback gate.
- Did not delete explicit Sales Demo launcher, `kong-vomit`, server-core mock gateways, or route-contract fixtures. Those remain later cleanup candidates.

## Candidate 5 Progress - Sales Demo Launcher Removal

Updated on 2026-06-17:

- Removed the Home `view=demo` branch and deleted the Sales Demo launcher component, so `/w/clair-demo/home?view=demo` now falls through to the normal Home workspace instead of opening the old guided launcher.
- Deleted the unused placeholder module that duplicated launcher-style placeholder behavior and was not imported by the application.
- Removed launcher-only scenario helper surface from `src/lib/emr-domain/demo-scenarios.ts`: `DemoRoleId`, `GOLDEN_DEMO_SCENARIO_ID`, `getGoldenDemoScenario`, `createDemoHref`, and the unused `demo` query alias.
- Updated Home regression coverage to assert the old launcher no longer opens, and updated Sales Demo flow coverage to use direct explicit fixture routes when legacy Kong fixture behavior is still being tested.
- Kept `scenario=kong-vomit`, `LEGACY_FIXTURE_OPERATING_DATE`, and legacy fixture data because route-contract tests and module-specific regressions still use them. Remove those only after Cheongdam seed/API replacement coverage exists for the same behavior.

## Candidate 6 Progress - Cheongdam Seed/API Replacement Coverage

Updated on 2026-06-17:

- Added `tests/cheongdam-seed-workflow-replacement.spec.ts` as the first direct replacement for broad legacy Kong flow coverage.
- The test uses `workspace-clair-cheongdam`, API-shaped route responses, and a live chart handoff to verify reception -> chart -> lab -> imaging -> dispensing -> billing continuity without `scenario=kong-vomit`.
- The test asserts that legacy Kong/Coco/Nabi and `26.05.01` fixture text do not appear while the Cheongdam API patient, fulfillment work items, and billing candidates render.
- Tightened `src/features/reception/module.tsx` so Cheongdam reception does not use global mock patient bundles or cross-workspace selected mock patients for the central visit context/detail fallback.
- Remaining legacy Kong tests are still `test-fixture` coverage until each direct module fixture assertion has a Cheongdam seed/API equivalent.

## Candidate 7 Progress - Billing Paid Action Replacement

Updated on 2026-06-17:

- Extended `tests/cheongdam-seed-workflow-replacement.spec.ts` so Cheongdam seed/API coverage now verifies billing checkout preparation, 담당하기, 수납 완료 confirmation, paid-state readback, and paid invoice checkout exclusion without `scenario=kong-vomit`.
- Updated `src/features/billing/module.tsx` so Cheongdam live invoice details can merge server/API payment snapshots from the billing store without reusing the default legacy Coco selected invoice.
- The billing checkout workspace and right-side payment panel now derive checkout invoice IDs from the active Cheongdam detail/group instead of blindly reusing stale global `selectedInvoiceIds`.
- Reduced `tests/sales-demo-flow.spec.ts` so the legacy Kong billing step only proves explicit fixture availability and no longer owns the current paid-action proof.
- Kept the legacy Kong route fixture tests because direct route availability still protects fixture-contract cleanup until the remaining module-specific assertions have Cheongdam seed/API equivalents.

## Candidate 8 Progress - Fixed Clinical Fixture Assertion Reduction

Updated on 2026-06-17:

- Removed broad Sales Demo flow assertions that treated fixed Kong clinical content as current product proof:
  - chart diagnosis/order text: `급성 위장관염 의심`, `구토 완화 처방`
  - lab fixed result value: `WBC 21.4`
  - imaging fixed impression text: `급성 위장관염 가능성이 높으며`
- Kept legacy Kong route availability checks for chart, lab, imaging, and billing so explicit fixture routes can still be verified until the scenario registry is deleted.
- Strengthened `tests/cheongdam-seed-workflow-replacement.spec.ts` with Cheongdam chart patient-context visibility and imaging work-item patient visibility. This keeps the current proof tied to `workspace-clair-cheongdam` seed/API data instead of fixed May 2026 clinical fixture text.
- Did not delete module-specific Kong tests such as `tests/lab-imaging.spec.ts` or `tests/chart.spec.ts`; those need separate focused Cheongdam replacements before deletion.

## Required Checks Before Deleting Code

- Confirm the symbol or file is not referenced by `rg`.
- Check whether the candidate is a Next.js route, dynamic import, Playwright route mock, fixture used by a server-core test, or auth/session boundary.
- Verify Cheongdam seed/API coverage exists for the behavior being removed.
- Run the smallest focused test first, then broaden to `npm run lint`, `npx tsc --noEmit`, and the Cheongdam regression set when risk requires it.
- Do not use local mock fallback as evidence that seed-backed persistence works.

## Skill And Plugin Guidance

- Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` for implementation batches.
- Use `superpowers:systematic-debugging` when a cleanup test fails.
- Use `superpowers:verification-before-completion` before reporting completion.
- Use Supabase guidance before changing seed, RLS, RPC, auth, or persistence boundaries.
- Use Playwright/browser verification skills when cleanup affects visible Cheongdam workflows.
