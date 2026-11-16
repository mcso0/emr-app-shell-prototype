---
id: CHART-PR-038
type: Work Item
title: Plan/Order 26-column table contract and linked adjustment
status: in_progress
area: chart
priority: P1
source_docs:
  - docs/design/screens/chart/planning/plan-order-table/implementation.md
updated: 2026-09-20
---

# Plan/Order table implementation

## Goal and authorization

Implement the owner-approved 26-column contract (revision decisions-4).
The owner requested Luna 5.6 xhigh implementation supervised by the parent,
Jev advisory review, and TDD. On 2026-09-20 the owner additionally authorized
commit, push, PR, origin/main merge and deployment after verification passes.
Production candidate, checks, smoke and rollback evidence remain required.
After the separate scoped DB approval question, the owner approved remote
deployment on 2026-09-20. This covers only the described optional-reason CHECK/RPC
change and synthetic verification, not unrelated DB or real-data operations.

## Scope and boundaries

- Header/body geometry, widths, fixed/scroll boundary line, optional resize,
  narrow fallback, units/sorting, and scroll-layer containment.
- Existing Input/Switch/badge/status/avatar presentation, linked signed amount
  and percent, optional free-text reason across UI/core and a new SQL migration.
- Preserve selection, sets, lifecycle, workspace permissions, CAS, idempotency,
  audit, billing authority, toolbar/footer and unrelated WIP.
- Local synthetic tests, scoped optional-reason migration and synthetic remote
  verification are in scope. No real data, unrelated remote SQL, environment
  changes or fixed staging alias changes.

## Execution and dependencies

Isolated branch `codex/plan-order-table-contract`, starting at origin/main
`ca46880bccc1d06de9029c29673a756ba6e73722`. Primary dirty checkout is untouched.
CHART-PR-032 and CHART-PR-036 are historical/deployed dependencies, not this item.
Canonical MD/HTML are copied as the reviewed contract, not application evidence.

## Done criteria and verification

- Red tests first, then green implementation and regression checks.
- All 26 widths/order, 8px gutters, density, responsive pinning, pointer/keyboard
  resize, no sort propagation; component alignment and accessible states.
- Signed paired adjustment, optional arbitrary/empty reason, source/rounding,
  zero base, conflicts and preservation of authority guards.
- Focused browser/server/domain tests; lint, typecheck, build, docs and secrets.
- Exact candidate Release Check and preview evidence before merge; Ready
  production and scoped smoke after authorized delivery; rollback recorded.
- Remote DB apply is a separate dependency; never label mock tests as live proof.

## Evidence

Baseline at ca46880b: lint passes (five pre-existing warnings), typecheck,
production build (existing NFT tracing warning), docs and secrets pass.

TDD RED before backend implementation:
- `tests/plan-order-adjustment-contract.spec.ts`: initially 3 failing, 1 passing;
  with zero-base and unsafe-total cases added, 5 failing and 1 passing.
  Blank reason rejection, mock null-clear retention, malformed type exception
  reproduced; signed charge and negative-half domain rounding already pass.
- `tests/sql/plan_order_optional_reason_contract.sql`: synthetic fixture and
  confirmation succeed, then the real RPC rejects with adjustment_reason_required.
  Transaction abort leaves no fixture order behind.
- Owned local Docker container `chart-pr038-postgres`, DB `chart_pr038_verified`.
  Baseline is the existing documented synthetic CHART-PR-037 schema rehearsal,
  copied without publications/subscriptions into a network-isolated container.
  This is not a fresh full migration replay. Original local DBs remain unchanged.
- Remote read-only function metadata matches local baseline body MD5
  ef723cd228a66965d864dcb61d12a572; reason-required/allowlist present.
  Remote DB apply was subsequently approved and completed after local checks.
- Production environment inspection (without printing values) confirms its
  Supabase target matches the approved project. Remote catalog preflight confirms
  the exact reason-only CHECK name, unchanged baseline RPC hash, security definer,
  pinned search_path, RLS, authenticated-only execution and the six other CHECKs.

Additional RED coverage before the corresponding implementation:
- Zero-base percentage-source input incorrectly loses its explicit rate.
- Safe-integer inputs can produce an unsafe final money total.
- Browser assertions cover exact column/body geometry, density, status color,
  input insets and requester avatar. Intermediate passes are not release proof;
  the complete suite must pass against the final candidate.

## Local SQL rehearsal

Current GREEN evidence (2026-09-20, before final candidate):
- Independent domain/server regression: 30/30 passed across adjustment,
  authority, prebilling and intended-assignee suites, excluding HTTP route tests.
- Exact migration `20260920082736_plan_order_optional_adjustment_reason.sql`
  passes the local runner below: apply/reapply, signed linkage, optional reason,
  unknown-field rejection, actor/workspace/CAS/idempotency, immutable history,
  audit, privileges/RLS and transaction rollback.
- Review caught and restored the payload-key allowlist. The migration removes
  only the reason-required CHECK and reason-required/policy-reason-list checks;
  arbitrary unknown JSON fields remain rejected.
- Browser/API suite: 27/27; shared table/primitive/Switch/status stories: 36/36.
  Existing chart regressions: 7/7 and quick-add pinned-span regression: 1/1.
  Linked-editor test was strengthened and rerun: amount and percent sources,
  reason-only save, actual simulated HTTP 422, error feedback and draft retention.
- The legacy Field Matrix test initially lacked a synthetic catalog and billing
  quantity. Its fixture now supplies the catalog and explicitly enters quantity
  through the UI; no application defaults or validation were weakened. Rerun passed.
- Typecheck, full lint (only five unchanged script warnings), production build
  (unchanged NFT tracing warning), docs (1036), secrets (4391) and UX copy passed.
- Jev compact review flagged possible remaining verification uncertainty; the
  concrete legacy fixture issue was investigated and resolved as above. Jev is
  advisory, not release or security proof. No dependencies were added.

## Approved remote DB result

- Applied `plan_order_optional_adjustment_reason`, remote history version
  `20260920082736`. The CLI-generated local migration was renamed to match this
  recorded version; SQL behavior is unchanged and old migrations are untouched.
- Remote transactional synthetic fixture returned PASS and rolled back. Scoped
  patient, encounter, order, catalog, override and audit residue count is zero.
- New function body MD5 `2d82b25dda96df6d93c63f884bd7e2da` matches the local SQL.
  Reason CHECK is absent; all six other CHECKs and RLS remain. Authenticated
  execution remains allowed; anon and service-role execution remain denied.
- Code commit/PR candidate, exact Release Check, Ready Preview and Production
  delivery evidence remain the release phase. Local/mock UI tests are not an
  authenticated Production acceptance test.

## 2026-09-20 row-action follow-up

The owner approved the Figma row-hover action treatment and asked that the
remaining gray zones follow the recommended behavior. The table now keeps a
fixed three-slot, 114px overlay with 24px controls. Draft rows use confirm,
delete and more; confirmed rows use detail, state-aware edit and more. Set
children retain the same three-slot geometry while confirm and delete stay
disabled with an explanatory tooltip. History and repeat request remain in
the overflow menu. User-facing order terminology is `수정` and `수정 후 재요청`.

Candidate deletion hides the row immediately without a `삭제 중` label and
restores it only when persistence fails or conflicts. A single-row confirm no
longer replaces the current checkbox/CAB selection. Focused Chromium coverage
for the three-slot geometry and selection preservation, successful deletion,
and failed-deletion restoration passes 3/3. The catalog-dependent set and
confirmed-lifecycle scenarios remain blocked before the changed assertions by
the existing disabled `전체 오더 검색 열기` control; this is recorded as a
separate current-main test precondition, not as proof for this follow-up.

Final local gates pass: secret scan, docs check, lint with the same five script
warnings, TypeScript, production build with the existing NFT trace warning, and
`git diff --check`.

After the new migration is generated, run the exact path through
`node scripts/test-plan-order-table-sql.mjs <migration-path>`.
The runner accepts only this work item's optional-reason migration name and
the owned Docker container with `NetworkMode=none`. It applies the migration
twice inside a transaction, executes the synthetic RPC contract fixture and
requires both the PASS marker and ROLLBACK. It is not a remote migration runner
or evidence of a fresh replay of the entire repository migration history.

## 2026-09-27 trailing-space follow-up

The owner requested 110px of visible empty space after the final Plan/Order
column when horizontally scrolled to the right edge, then commit, PR, and
`origin/main` delivery after verification. The implementation uses a
presentation-only terminal table space shared by header and rows; the 26 data
columns and their widths remain unchanged. Verify its measured width and
visibility in Chromium at the rightmost scroll position before delivery.
The isolated local Chromium run measured 110px in both header and row at
1386px viewport width; the four focused Plan/Order geometry, column, and row
action checks passed. Secret scan, docs check, and `git diff --check` passed.
Lint passed with five existing script warnings; TypeScript and production build
passed.

## 2026-09-27 left row actions follow-up

The owner requested removal of the final `요청 수의사` resize handle and a stable
left-side position for the floating row actions. Keep the avatar-only column's
sorting, width and 110px trailing space. Anchor the existing 114px action group
at the left edge of the scrolling region after the four pinned columns, so
horizontal scrolling does not move it or cover pinned row controls. Preserve
the shared table's default right-side overlay for other callers and verify the
start, middle and end scroll positions plus existing row actions.
Local Chromium verified fixed overlay coordinates at all three scroll positions
and both ends of the narrow unpinned layout; the last-column resize handle is
absent while sorting stays available. The 110px trailing-space and three-slot
row-action checks pass (3/3). Secret scan, docs check, diff check, lint (five
existing script warnings), TypeScript and production build pass.

## 2026-09-27 right row actions correction

The owner corrected the intended side to the viewport's right edge. Place the
zero-width row-action anchor after the 110px presentation-only trailing space
in the header, body, skeleton and colgroup. Keep the action group's right edge
fixed to the scroll viewport at the start, middle and end scroll positions,
including the narrow unpinned layout. The 110px space remains visible when the
row is idle; hovering a row presents its 114px action group at the viewport
edge. Keep the final column's resize handle absent and sorting available.
Local Chromium confirms the action group's right edge matches the scroll
viewport at the start, middle and end positions and at both narrow-layout
ends. The 110px trailing-space, final-column and three-slot row-action checks
pass (3/3); the rightmost hovered-row screenshot was visually inspected.

## Release dependency and rollback boundaries

The owner authorized code delivery after TDD and subsequently approved the scoped
remote optional-reason constraint/RPC change. Verify the exact target and local
migration first; do not merge/deploy a frontend that permits optional reasons
against a DB that still rejects them.

Do not delete adjustment history to restore the former required-reason CHECK.
Once optional-reason rows exist, prefer an application rollback that remains
compatible with the additive DB behavior. Reinstating the old CHECK requires
a separate compatibility check and must not rewrite immutable history.

## Approved column-width follow-up — 2026-11-02

The owner approved applying the reviewed HTML width proposal, preserving the
existing Order 명 (180px) and 업무 상태 (88px) implementations, and setting
실 조제량 to 120px. They authorized local screen verification followed by
Production delivery when checks pass. This is bounded conditional release
approval; it does not authorize unrelated WIP, data/API, DB or provider changes.

Application changes are limited to `src/features/chart/module.tsx` column sizing
and compact padding/chevrons for the affected frequency, basis and dose-unit
selectors, so common values remain visible at the approved widths. The actual chart
workspace story documents the new default and continues using the same app
component and synthetic fixture. Column order, pinning, content, rounding,
save behavior, permission enforcement and other screens retain their contracts.

| Columns | Default size, CSS px |
| --- | --- |
| 분류 / 확정 여부 | 72 / 80 |
| Order 명 / 업무 상태 | 180 / 88, unchanged |
| 청구서명 / 청구반영 | 144 / 64 |
| 일수 / 횟수 / 총횟수 / head/kg당 | 56 / 72 / 64 / 80 |
| 처방 용량 / 용량 단위 | 88 / 88 |
| 1회 조제량 / 성분량 / 총 조제량 / 실 조제량 | 96 / 104 / 96 / 120 |
| 보관 / 투여·복약 | 88 / 120 |
| 단가 / 수량 / 합계 | 96 / 64 / 104 |
| 할인·할증 / % / 총 청구금액 / 사유 | 104 / 64 / 112 / 126 |
| 과세 / 업무 담당 / 요청 수의사 | 56 / 72 / 88 |

Selection stays 20px. The 29 content widths total 2,606px, compared with the
previous 2,972.5px. Existing 8px table gutters are additional: rendered table
width is 2,830px. This is geometry evidence, not measured clinical task-time
improvement. The actual-dispense minimum is also 120px; its old 240px lower
bound must not prevent the approved compact size.

Local verification on the isolated `codex/plan-order-column-widths` branch:
- Actual chart workspace Storybook browser suite: 15/15 passed, including
  invalid input, save, prescription recalculation and unit-selection flows.
- Full lint, TypeScript, production build, docs links and secret scan passed.
- Local Chromium geometry: all 29 content widths match the approved proposal;
  Order 명 and 업무 상태 retain 180/88px. The 120px actual-dispense content
  column renders as 128px including its existing 8px gutter, with an 80.125px
  input and visible mL unit. The displayed number fits without clipping.
- Screen evidence is retained locally in `output/playwright/plan-order-column-widths/`;
  captures and helper scripts are excluded from the release commit.

Release requires the final candidate's current automatic Release Check and
Ready Preview, then a merge protected by the expected head SHA and a Ready
Production deployment. Smoke: `/login` and the same scoped chart table layout.
Rollback candidate is the Ready Production deployment recorded before merge.
No remote clinical mutation is part of this width follow-up.

- Full local production-build app route with synthetic intercepted API responses:
  1,440px and 1,200px screenshots, header/body alignment and actual-dispense
  keyboard resize passed. The width grows to 128px and returns to its 120px
  minimum. These are local UI results, not live API/DB authorization evidence.
- Final visual review found default SID/head selector text clipping; compact
  selector insets/chevrons fix it without changing column widths or text size.
  The existing editing story now checks that selected values fit their controls.

## 2026-11-09 header width follow-up

The default and minimum content widths are 88px for 확정 여부, 96px for
업무 상태, 72px for 총횟수, and 96px for 요청 수의사. 확정 여부 and
요청 수의사 have fixed widths.

Local Chromium verification at 1,673 × 867 confirmed that all four labels fit
on first open. 업무 상태 and 총횟수 still fit after keyboard resizing to their
minimum widths. Six focused Plan/Order browser tests passed.
