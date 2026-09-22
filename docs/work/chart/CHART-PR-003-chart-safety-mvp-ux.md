---
id: CHART-PR-003
status: done
area: chart
priority: P1
target_pr: PR 3
source_docs:
  - docs/engineering/current-status.md
  - docs/work/chart/CHART-PR-001-workspace-restructure.md
  - docs/work/chart/CHART-PR-002-soap-order-scroll-boundary.md
  - docs/design/reference-screen-index.md
dependencies:
  - CHART-PR-001
  - CHART-PR-002
updated: 2026-09-22
---

# Chart Safety MVP UX

## Goal

Reduce wrong-patient, chart completion, and order confirmation mistakes in the 진료(차트) workspace without changing live data or persistence behavior.

## PR Gate

- Goal: make the active patient, chart number, draft/autosave status, and selected order confirmation scope clearer during clinical work.
- PR-sized scope: chart workspace UX only, focused React changes, focused Playwright coverage, work/status/closeout docs.
- Out of scope: live DB/API persistence, audit log events, actual chart/order status transitions, large layout restructuring, repeated order recommendation.
- Done criteria: patient context and chart info show the chart number and guardian context; SOAP status includes last save time; chart completion and order bill/confirm actions show explicit confirmation dialogs; order bill/confirm actions require selected orders.
- Source docs: current MVP status, chart PR 1/2 work items, reference screen index, user-provided UX review.
- Verification: lint, TypeScript, chart/app-shell Playwright checks.
- Status/dependencies: done; depends on the existing chart workspace and SOAP/order scroll boundary work.
- Duplicate check: no existing chart safety UX work item was listed in `docs/work/index.md`.

## Scope

- Update `src/features/chart/module.tsx` only for chart UI behavior.
- Add explicit chart number and guardian context to active patient and chart info areas.
- Change SOAP save copy from generic save to draft save and show autosave time.
- Disable `Order 청구` and `Order 확정` until at least one order is selected.
- Add confirmation dialogs for chart completion and order bill/confirm actions using `EmrConfirmDialogContent`.
- Add Playwright regression coverage in `tests/chart.spec.ts`.

## Out Of Scope

- Mutating mock order status or SOAP status after confirmation.
- Adding backend, Supabase, audit, billing, or order workflow integration.
- Changing 조제/처치 screen behavior.
- Pixel-level alignment with a chart reference image; no chart binary reference asset is currently stored.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`

Completed on 2026-05-07. Closeout: `docs/completed/chart/2026-05-07-chart-safety-mvp-ux.md`.


## 2026-09-22 — Order confirmation review follow-up

Status: local implementation and focused verification complete; delivery in progress. Historical 2026-05 completion
above is retained. Parent supervises; GPT-5.6 Sol High owns implementation/tests.

### Approved scope

- Replace the order confirmation presentation with the approved named-order list,
  count, canonical neutral type badges, current selected amount, and `취소` /
  `N건 확정` actions. Remove identity, quantity subtitles and technical copy.
- Preserve exact row/CAB selection, scoped amount semantics (including #819),
  server authorization, revision validation and idempotency.
- Legacy V1 required actual records use a separate preceding record step; the
  final review stays simple. Normal/deferred V2 orders have no added step.
- Canonical contract: [Order Selection CAB](../../design/flows/order-selection-cab-interaction-spec.md).
- Approved visual: [proposal and prototype](../../design/screens/chart/planning/order-confirmation/index.html).
- No DB migrations, remote data mutation, new dependencies, or unrelated WIP.

### Delivery authorization and candidate

승욱 explicitly requested documentation, Sol implementation under parent supervision,
visual verification, then commit/push/PR/origin-main merge and deployment on pass.
The same narrow operation/target/scope approval is retained through delivery.

- Clean branch: `codex/order-confirmation-review`.
- Integrated base: `f13227a0d7d0989464cba7a06b39af5a9af9656c` (`origin/main`, PR #820); scoped amount semantics from PR #819 retained.
- Production rollback deployment observed Ready before work:
  `dpl_CM29YkDqJifRxcZ4HmgDRWXVDjxS`.
- Existing environment/secret sources retained; no values copied to artifacts.
- Required checks: focused chart confirmation/actual-record tests, local visual
  inspection, secret scan, docs, UX copy, lint, typecheck, build, exact-candidate
  manual Release Check and Ready Preview before main merge.
- Smoke: synthetic chart confirmation review, cancel without mutation, production
  alias/deployment and scoped route checks after release. Do not confirm live orders.
- Stop for failing checks, stale candidate, secret exposure, missing Ready deployment,
  or an unexpected data/authorization change. Rollback via previous deployment or
  revert of this scoped change; never reset the dirty original checkout.

### Verification and delivery evidence

- Parent visually inspected desktop and 390px mobile single/multiple review captures,
  legacy final review and persisted set disclosure. Count, badges, amount alignment,
  opaque surface and horizontal mobile actions matched the approved hierarchy.
- Final focused synthetic browser tests: 8/8 passed. Coverage: V1 explicit records/payload, deferred V2,
  single/multiple/mixed selections, selection-preserving cancel, idempotent retry,
  and set root count/included-only disclosure/scoped charge total.
- Local docs, UX-copy, secret, lint, TypeScript and production build checks passed;
  lint retains five existing script warnings and no errors. Native dialog close/focus
  restoration passed for row entry and selection entry; the popup is retained through
  its close lifecycle. Exact-candidate remote Release Check is required before merge.
- Preview/production deployment identifiers and exact candidate/merge evidence will
  be recorded on the linked PR after delivery. Human acceptance is separate.
