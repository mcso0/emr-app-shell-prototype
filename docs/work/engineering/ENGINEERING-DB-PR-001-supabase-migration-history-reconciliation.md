---
id: ENGINEERING-DB-PR-001
status: human_review
area: engineering
type: Work Item
title: Supabase Migration History Reconciliation
description: Reconciles remote-only migration versions without executing unrelated pending migrations.
tags:
  - supabase
  - migrations
  - release
---

# ENGINEERING-DB-PR-001 — Supabase Migration History Reconciliation

## Goal

Make every remotely recorded Supabase migration version discoverable in the repository while preserving genuinely pending local migrations as pending.

## Scope

- verify identical SQL before mapping timestamp aliases
- preserve four remote-only SQL migrations in `supabase/migrations`
- add twelve no-op remote-history alias files for byte-normalized identical SQL
- document all thirty-eight reviewed alias pairs, including the existing
  `20260715180209` → `20260716030000` history mapping
- repair exactly the twenty-six behavior-applied canonical history rows on
  remote project `qmerxgzrwaaahpkhjqlc`, without executing migration SQL
- document the remaining fourteen genuinely pending migrations as a hard gate

## Out Of Scope

- applying the fourteen pending migrations
- repairing remote history outside the exact twenty-six approved versions
- changing application data, schema objects, RLS, or functions during history repair
- deleting remote migration records

## Verification

- fresh local Supabase reset/replay
- focused alias and remote-SQL preservation test
- the verified pre-change snapshot is 158 local / 130 remote / 118 common /
  12 remote-only / 40 local-only
- the final verified snapshot is 170 local / 156 remote / 156 common /
  0 remote-only / 14 local-only
- the focused test covers all 38 aliases, four preserved SQL hashes, and
  comment-only/no-executable-SQL safety
- the exact-project history-only repair marked 26 canonical versions applied;
  no migration SQL, schema, or data mutation was executed
- read-only verification returned schema fingerprint
  `5b6046943b4317bf828110285007a24f82e8aaf74ae1e2bfa0b20695952170b4`,
  `master.master_records` 29 rows with fingerprint
  `8d51fb069dc582fc2bbaf7a96565c10f5a6d3e177711fab90e842c0bf5859901`,
  and zero rows in the three new diagnosis tables
- linked dry-run exited 1 with `LegacyDbPushMissingRemoteError` and listed
  exactly the 14 pending versions; `--include-all` remains prohibited

## Result

Local and remote history reconciliation completed on 2026-08-23. The work item
remains `human_review`; the fourteen pending migrations remain outside this
scope and require an independently approved release.
