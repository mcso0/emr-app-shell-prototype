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

## Release dependency and rollback boundaries

The owner authorized code delivery after TDD and subsequently approved the scoped
remote optional-reason constraint/RPC change. Verify the exact target and local
migration first; do not merge/deploy a frontend that permits optional reasons
against a DB that still rejects them.

Do not delete adjustment history to restore the former required-reason CHECK.
Once optional-reason rows exist, prefer an application rollback that remains
compatible with the additive DB behavior. Reinstating the old CHECK requires
a separate compatibility check and must not rewrite immutable history.
