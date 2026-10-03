---
id: "NOTIFICATION-PR-028"
status: "human_review"
area: "notifications"
priority: "P1"
target_pr: "Audit item 3 / PR Preview and exact Production preparation"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/work/notifications/NOTIFICATION-PR-027-waiting-toast-dismiss-persistence.md"
dependencies: ["NOTIFICATION-PR-027"]
updated: "2026-10-03"
---

# Reception Waiting Threshold Idempotency

## Goal And Authorized Scope

Stop repeated reception snapshot/queue reads from mutating unchanged waiting
notifications. Initial authorization covered local synthetic implementation and
tests. The owner subsequently approved proceeding through deployment; authorized
preparation now includes a scoped feature commit/push, draft PR, Preview, exact
Release Check and this DB/release packet. The repository still requires approval
of the completed exact candidate/migration/rollback packet before hosted DDL and
Production merge. No clinical/financial test writes. Audit items 1/2 are excluded.

Fetched `origin/main` was `533a8e498a0a101fe502a4d6fea78fe96f5a31ac` (#894).
A separate clean worktree preserves the original checkout's extensive WIP.

## Contract And Implementation

- The only runtime change is `20261003090000_notification_waiting_threshold_idempotency.sql`, replacing the public emitter's waiting branch.
- Transaction advisory lock keys include workspace, normalized event scope and dedupe key, covering concurrent first creation.
- INSERT constraints/casts and legacy procedural validation still execute before a conditional conflict update. Same-threshold requests return the existing notification with `action=unchanged`; high-to-urgent escalation bumps once; stale high requests never downgrade urgent.
- Waiting notifications never delete, restore or update per-user acknowledgement rows, including during escalation. This also removes the old snapshot/delete/restore race with a concurrent first acknowledgement.
- Queue exit emits nothing; restoration preserves ID and entered time, so acknowledgement survives. A new queue entry has an independent key and starts its own 30-minute clock.
- Text/metadata are retained from the poll that created or escalated the alert. This deliberately stops per-minute refreshes of the notification snapshot.
- Other events still delegate to the legacy emitter. Authenticated wrapper grants, active membership/actor/role checks, protected order-set scope, RLS and table permissions remain enforced; `pg_catalog` is first in the pinned search path.

## Verification Evidence

A dedicated local PostgreSQL 17.6 database `reception_idempotency_local` was
populated with **schema only**, preserving ACLs, from the existing local synthetic
Supabase container. Candidate and prior wrapper migrations were tested there;
no source-database data was copied. Sequential fixtures roll back; concurrent
fixtures remove their own synthetic records and triggers afterward.

- Before the fix, the unchanged-action regression failed on its first repeated poll.
- Trigger counters over 20 unchanged legacy calls with two acknowledged users: **20 event UPDATE + 40 state DELETE + 40 state INSERT**.
- After the fix: **0 repeated row mutations** over 20 calls; exactly **1 event UPDATE** for escalation; **0 state mutations** by the emitter. Entire event and state rows remain equal on repeats.
- Actual concurrent sessions: 16 first requests yield 1 insert / 15 unchanged; 20 mixed high/urgent requests yield 1 escalation / 19 unchanged. Concurrent first high/urgent requests end urgent with at most 2 total event mutations.
- A first read/archive held uncommitted during escalation survives; escalation completes before acknowledgement commits and produces no state mutations.
- SQL tests cover independent scopes/workspaces/new entries, same-entry restoration, stale downgrade, malformed same-key inputs, forbidden actor/role/member/workspace, table access denial, grants, RLS, and other-event bump/reset preservation.
- Producer regression covers 29:59.999, 30:00, 59:59.999 and 60:00, queue exit/restoration and fresh-entry timer/identity.

- Reception/notification UI/API/permission regression: **57 passed**. Typecheck and default Turbopack production build passed. Lint passed with 5 existing unused-variable warnings; build retains the unrelated existing dynamic docs file-tracing warning. Docs links, secret scan and whitespace checks passed.

- Additional snapshot/cancel/restore suite: **20 passed, 1 existing failure** in `tests/reception-read-performance.spec.ts:126` (missing `veterinarian-lane-name`, expected `청담 원장`). That test and all application source files are byte-identical to fetched main; its fixture still intercepts separate queue/calendar/staff endpoints. The local DB-only candidate cannot affect this mock UI path. A separate clean baseline worktree at exact `533a8e498a0a101fe502a4d6fea78fe96f5a31ac`
  ran the same single test on port 3164 and reproduced the identical missing
  `veterinarian-lane-name` failure at line 206. Baseline git status remained clean.
  This is an existing failure, not a candidate regression; Audit item 1 was not
  reopened to repair it.

Commands:

```sh
# Candidate migration and SQL test: dedicated local test DB only.
docker exec -i supabase_db_emr-app-shell-prototype psql -U supabase_admin -d reception_idempotency_local -v ON_ERROR_STOP=1 < supabase/migrations/20261003090000_notification_waiting_threshold_idempotency.sql
docker exec -i supabase_db_emr-app-shell-prototype psql -U supabase_admin -d reception_idempotency_local -v ON_ERROR_STOP=1 < tests/sql/notification-waiting-threshold-idempotency.sql
node scripts/test-notification-waiting-concurrency.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3163 npx playwright test tests/reception-queue-read-server.spec.ts tests/notification-persistence-contract.spec.ts tests/notification-live-api-server.spec.ts tests/server-permission-enforcement.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/api-boundary-permission-regression.spec.ts tests/notification-toast.spec.ts --reporter=line
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3163 npx playwright test tests/reception-read-performance.spec.ts tests/reception-encounter-restore-server.spec.ts tests/reception-encounter-cancel-server.spec.ts --reporter=line
npx tsc --noEmit
npm run lint
npm run build
npm run docs:check
npm run security:secrets
git diff --check
```

## Limits And Release Requirement

- The server still invokes one RPC per eligible waiting patient on each read; **RPC call reduction is zero**. The change removes repeated event/state row mutations, not serialization/row-lock overhead. Conflict tuple locks may still generate WAL; no WAL/egress bytes or current hosted occurrence rate were measured.
- Existing historical bump counts remain intact; no backfill, row reset, archive reset or schema/table change is needed.
- An entry created before 60 minutes needs at most one event insert and one escalation update, independent of subsequent poll count. First observation after 60 minutes needs one urgent insert.
- The legacy function's pre-existing direct execution privileges are unchanged. Direct legacy callers bypass this wrapper policy; the reception producer uses the public wrapper exclusively.
- Full clean replay of every repository migration and hosted runtime behavior are outside this verification. Local SQL used the schema-only clone plus the relevant wrapper migrations.
- Release requires separately approved application of the additive migration to the hosted DB. Until then, hosted behavior is unchanged. Rollback restores the prior wrapper function from `20260913085259_notification_waiting_toast_archive_persistence.sql`; no data repair is required.
- Documentation sources reviewed before implementation: repository engineering changelog, [Supabase database functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html), [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html). Installed `createdb` and `npm ci` options were checked with `--help`; no Supabase CLI installation was necessary.

## DB And Production Preparation

- Verified target: connected synthetic/demo project **clair-emr-staging / qmerxgzrwaaahpkhjqlc**, PostgreSQL 17, ACTIVE_HEALTHY. Read-only metadata confirmed existing migration `20260913085259 / notification_waiting_toast_archive_persistence`.
- Hosted wrapper `pg_get_functiondef` MD5: **5281ed6e3521449824cf7a89a91265d5**; legacy MD5: **477b2ac24a0d44ea66797689ef8f5fd2**. Both grant execution to authenticated only; both notification tables retain RLS and no authenticated direct table privilege.
- Candidate is exactly **20261003090000_notification_waiting_threshold_idempotency.sql**: CREATE OR REPLACE of the one public emitter, matching REVOKE/GRANT and COMMENT. No table DDL, data DML, backfill, deletion, resets or role-policy change. INSERT/UPDATE statements are the function body and execute later only through the existing authenticated API contract.
- Old/new app compatibility: signature, JSON return format and grants remain identical; `unchanged` is already accepted by the gateway. The existing Production app can use either wrapper. The DB function change affects the existing app immediately when applied, so hosted DDL is itself a release action.
- Proposed approved order: recheck exact PR head/check/Preview + existing hosted function fingerprint and grants; apply only the candidate SQL to the exact project through scoped `apply_migration`; verify history SQL digest/function fingerprint/ACL/RLS; merge exact head; verify Production Ready and official alias SHA; run only safe login and unauthenticated denial probes. No bulk db push, history repair or unrelated pending migrations.
- If Supabase assigns a generated remote version, record the exact returned version/name and compare stored SQL bytes to the canonical candidate. Do not reapply SQL merely to align timestamps; use the existing history-reconciliation policy for a subsequent reviewed comment-only alias.
- Local rollback transaction restored **5281ed6e3521449824cf7a89a91265d5**, identical to hosted baseline, using `20260913085259_notification_waiting_toast_archive_persistence.sql`; rollback left the candidate installed at MD5 **772ab0fdecc517161d37eeb86be53932**. Hosted restoration would use a separately tracked rollback migration, not erase history or restore user rows.
- Current Ready Production/official alias: **dpl_AUT7Cr8GAGnmrhDPqtS8NHYtDZ55**, `https://emr-app-shell-prototype-1zpt0b70g-mcso0s-projects.vercel.app`, SHA **533a8e498a0a101fe502a4d6fea78fe96f5a31ac**; alias `https://emr-app-shell-prototype.vercel.app`. Vercel identifies this as an eligible rollback candidate. Read-only baseline probes: `/login` 200; unauthenticated reception snapshot 401.
- A Vercel deployment rollback alone cannot revert the shared DB function. If the DB change is faulty, restore the tested previous wrapper SQL with separate approved DDL. If only the app deployment is faulty, use the previous Ready deployment or a reviewed revert PR. No data compensation is required; old repeated-write behavior returns after DB rollback.
- Stop conditions: candidate/base/function drift, Release Check or Preview not Ready, newly failing relevant checks, ACL/RLS changes, missing exact approval, fingerprint/history mismatch after apply, login/denial smoke failure, or any implied clinical/financial write.
- Supabase official `changelog.md` and current function privilege/search-path docs were reviewed. Relevant PostgreSQL minor-upgrade breaking changes concern extensions/custom operators; this candidate changes no extension or operator and the hosted engine remains Postgres 17.
- The existing staff UI failure remains disclosed in the exact approval packet; all candidate-specific regressions passed. Production merge and hosted DDL remain pending the exact gate.
