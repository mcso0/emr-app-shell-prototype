---
id: "NOTIFICATION-PR-029"
status: "human_review"
area: "notifications"
priority: "P1"
target_pr: "Bound notification snapshots and correct full-set acknowledgement"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
dependencies: ["NOTIFICATION-PR-024", "NOTIFICATION-PR-028"]
updated: "2026-10-04"
---

# Bounded Notification Snapshot And State Correction

## Scope And Baseline

The owner approved local implementation and synthetic verification after the
read-only notification audit. The owner subsequently approved scoped commit,
push, draft PR, Preview and exact-head release preparation. Hosted migration,
main merge and Production deployment remain behind the exact-candidate approval
gate. No hosted clinical/financial writes, hosted
fixtures, stats resets, load tests or cancelled DevTools Network inspection.

An isolated detached worktree initially used verified main
`0701ea78187fc8a5aab8a3c2e6e5d773936c350f` (#907), then integrated latest main
`10f0df3369be23922da2a9d24878c2a9e9d4bd0b` (#908). Its four UI/docs files
do not overlap this change. The upper-right toast/live-card placement is preserved
byte-for-byte from #908. Release preparation also preserved #909, #910, #914,
#911, #915, #913 and #916 through verified main
`e412d5fe8220c1e0650a64dfca3225d3c3ceb5de`. The PR's notification diff remains
15 files; nullable overall-attachment schema/types/parser/API from #911 are
preserved. The original checkout's WIP
and dependencies remain untouched. Local dependencies were restored from the
exact lockfile/cache because the original copied node_modules lacked main's
react-pdf and react-zoom-pan-pinch packages.

Before changes, a network-blocked synthetic run of actual main helpers proved:
rank-51 read = 404; archived restore = 404; read-all on 200 unread rows updated
50 and left 150; a successful single mutation made four full-history list RPCs
before the client's reload. This corrects remaining read/state defects and does
not indicate a failure of PR895 waiting-threshold write idempotency.

## Implementation

- Additive migration `20261004041632_notification_bounded_snapshot_and_state.sql`: two public v2 RPCs and two private helpers; no table/index/RLS or legacy RPC changes.
- One SQL CTE snapshot applies the existing DB visibility AND notification-specific effective role-policy permission check before global counts and list bounds. Admin bypass, DB multi-role CASE priority, permission assignment precedence, role-only fallback and current assignment status behavior are preserved. The generic workspace permission helper has different semantics and is not reused.
- Cap detailed event JSON at 100 snapshot / 50 filtered rows. Omit four constant legacy fields and empty/out-of-page state rows. Exact global counts still scan authorized metadata; reduced transfer is not proof of reduced production DB CPU.
- Preserve external filter/limit normalization. SQL authorizes returned rows/counts together; Next preflight validates request membership/filter and the final mapper sanitizes source routes without re-filtering through an earlier, potentially stale permission adapter.
- ID mutations include archived and older records; no 50/100-page dependency. Full read-all includes every authorized nonarchived unread row, with deterministic event-row locks and atomic conflict rechecks. Read does not overwrite archive/read acknowledgement; restore retains read. New events after the mutation snapshot may correctly remain unread.
- The drawer summary/action use the global unread total so read-all remains enabled when only older, unloaded rows are unread. Filter counters still describe loaded rows; layout and delivery remain unchanged. A browser regression covers this boundary.
- The in-memory mock path uses the same full-set mutation semantics while its public list stays bounded. Producer-only test doubles reject unexpected snapshot/state calls.
- New RPCs grant only authenticated execution and verify active membership, actor = auth.uid, and actor-specific state scope. Private helpers are inaccessible to application roles; search paths are pinned with pg_catalog first. Direct table grants are unchanged.

## Measured Synthetic Payload

Same local PostgreSQL 17.6 fixtures, before state mutations; legacy combines event
and actor-state responses. Three historical actor-state records are deliberately
outside the bounded page (and outside small fixtures) to verify irrelevant state
is not returned. Byte counts below are UTF-8 PostgreSQL JSONB text, not HTTP wire
bytes, billing egress or a production timing measurement.

| Fixture events | Legacy events → bounded events | Legacy PG JSON text B | Bounded PG JSON text B | Global unread |
|---:|---:|---:|---:|---:|
| 0 | 0 → 0 | 502 | 150 | 0 |
| 100 | 100 → 100 | 150,742 | 136,495 | 100 |
| 1,000 | 1,000 → 100 | 1,503,893 | 136,519 | 997 |
| 1,750 | 1,750 → 100 | 2,632,268 | 136,521 | 1,747 |

At 1,750 events: **94.8% less PG JSON text**. Separately measured JSON.stringify
UTF-8 size was 2,537,747 → 131,913 B, also 94.8% less. Empty pages cost more
metadata relative to a bare event-only result, but the comparison includes both
legacy RPCs and their historical state payload. Snapshot RPC count is 2 → 1;
single mutation is one atomic RPC instead of pre/post full-history reads and a
state write. Client reload and permission-adapter queries remain.

## Verification

All DB fixtures use a new `notification_bounded_local` database populated with
schema only, without copying source data. Sequential fixtures roll back;
concurrency/browser fixtures guard the database and synthetic namespace before
cleanup. The source database and hosted project are untouched.

- 103 Playwright tests passed: 94 notification/API/producer, 8 existing drawer/navigation/mobile regressions, and 1 opt-in SQL-to-browser fixture. 11 visible-refresh/staff-heartbeat Vitest tests passed; polling behavior remains unchanged.
- 250-event SQL regression passed: limits/filter counts, rank 51/200, archived restore preserving read, complete/idempotent read-all, actor/workspace/event-scope isolation, assignment precedence including inactive assigned role, multi-role restriction, user-only policy exclusion, inactive membership, spoofed actor/scope, table and RPC grants.
- Concurrency passed: legacy uncommitted archive against read-all, six overlapping read-all requests, concurrent archive/read, restore, and PR895 escalation retaining acknowledgement.
- Opt-in SQL → production server mapper → Chromium drawer test passed with 250 rows. HTTP is intercepted locally; this verifies transport/DTO/UI behavior, not a hosted Next/Supabase login or deployed endpoint. Browser list stays 100 while counts remain global; rank 51 UI triage, rank 200 API read and full read-all work.
- Local `plpgsql_check` returned no diagnostics for new PL/pgSQL functions; SECURITY DEFINER, pinned search paths, ACLs, RLS and existing indexes were inspected. No hosted advisor call or remote schema change.
- Typecheck and production build passed. Lint passed with five pre-existing unused-variable warnings. Build retains the pre-existing dynamic docs file tracing warning in unchanged next.config/doc-reader/docs-page source.
- Docs links, secrets, Korean UX copy and whitespace checks passed. New untracked files are scanned explicitly before handoff.

Reproduce locally (isolated schema-only DB with the candidate migration required):

```sh
docker exec -i supabase_db_emr-app-shell-prototype psql -X -qAt -U supabase_admin -d notification_bounded_local -v ON_ERROR_STOP=1 < tests/sql/notification-bounded-snapshot.sql
node scripts/test-notification-bounded-concurrency.mjs
node scripts/measure-notification-bounded-payload.mjs
NOTIFICATION_LOCAL_SQL=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3178 npx playwright test tests/notification-bounded-browser.spec.ts
```

## Migration And Rollback Packet

Future hosted DDL and Production deployment require exact owner approval.
Target project is `clair-emr-staging / qmerxgzrwaaahpkhjqlc` (ACTIVE_HEALTHY,
PostgreSQL 17.6). Read-only inspection confirmed v2 RPCs are absent, PR895 emitter
MD5 `772ab0fdecc517161d37eeb86be53932`, notification RLS enabled and direct
authenticated SELECT denied. Migration name is `notification_bounded_snapshot_and_state`;
source filename is `20261004041632_notification_bounded_snapshot_and_state.sql`.
SQL SHA-256: `1e3a172e0ebcbce5c15bdc950dc71bdf8a0a0031d5f283f75ccd2b744fb66b09`.
Hosted migration history may receive the apply tool's execution-time version;
verify name, exact stored SQL digest and function fingerprints rather than assume
the local filename timestamp equals hosted history.

Compatible Production/rollback baseline verified at 2026-10-04 05:54 UTC:
`dpl_8UeiEU9LZv8GMfmxypzr7TfqhQni`,
`https://emr-app-shell-prototype-mco5afm0q-mcso0s-projects.vercel.app`,
source SHA `e412d5fe8220c1e0650a64dfca3225d3c3ceb5de`, READY and serving
`https://emr-app-shell-prototype.vercel.app`; login200, anonymous notification
list401/counts401. This post-#911 source accepts explicit `rowId:null` overall
attachments. Hosted schema metadata confirms nullable `row_id`, explicit-null
prepare support and `lab_overall_result_attachments / 20261004052400` history.
No attachment records were queried or assumed to exist. Pre-#911 efadd50a and
dpl_77uqrDPz38MwBDM1ay3zEUgxaujg are superseded, not approved rollback candidates.
Reconfirm deployment/source/alias and compatibility immediately before approval.

Safe smoke is GET `/login`, unauthenticated GET notification list/counts (401),
and read-only DB history/fingerprint/ACL/RLS checks. Authenticated notification
GET may be separately included in the exact approval if an owner session is
available; log counts/row lengths only. Do not visit authenticated reception/home
or queue/snapshot producer reads, or invoke read/archive/restore/read-all remotely.
All state mutation verification remains local synthetic.

Apply the additive notification migration
before deploying the new app; there is intentionally no fallback to full-history
RPCs if v2 is missing. Read-only session/count/limit/denial smoke may be included
in exact release approval. Old-ID/state mutation checks remain local synthetic.
No hosted mutation fixture is authorized by this work item.

For application rollback, use the separately approved compatible post-#911
baseline above; legacy notification RPCs/tables remain intact. Notification RPC
compatibility alone does not establish compatibility of pre-#911 apps with
nullable attachment data.
Leaving unused v2 functions is the smallest DB rollback. If removing them is
required, after application rollback run in a separately approved migration:

```sql
drop function public.clair_mutate_notification_user_state_v2(text,uuid,text,text,text,text);
drop function public.clair_read_notification_snapshot_v2(text,uuid,text,text,text,integer,text);
drop function private.clair_notification_validate_actor_v2(text,uuid,text);
drop function private.clair_notification_visible_v2(public.notification_events);
```

Do not delete user acknowledgement rows during rollback. No historical cleanup,
poll interval/cross-tab changes, UI history pagination, retention or realtime
publication changes are included. The rollback drop packet was transactionally verified in the isolated DB,
and the old reader/emitter remained present. Hosted DDL/main/Production approval
remains pending. Exact head, CI/Preview and current baseline evidence are reported
in the PR approval packet; this document grants no remote action authorization.
