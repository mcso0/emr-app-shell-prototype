---
id: ENGINEERING-DB-PR-002
status: human_review
area: engineering
type: Work Item
title: Fulfillment RLS helper execution grant
description: Restore authenticated RLS evaluation with one explicit function grant.
tags: [supabase, permissions, regression]
---

# Fulfillment RLS Helper Execution Grant

## Goal and Authorization

The user authorized isolated local implementation of the verified single function
EXECUTE grant and regression coverage on 2026-10-27. Preserve the original checkout
and remote DB. The subsequent user request authorizes committing the verified
changes, pushing this branch, and opening a PR. Remote DB apply and main merge
remain explicitly excluded.

## Scope

- Add one forward migration granting authenticated EXECUTE on
  `private.clair_queue_permission_for_destination(text,text)`.
- Test the actual mapper and RLS policy after 199 real baseline migrations in a
  disposable, network-isolated Supabase Postgres container with automatic grants removed.
- Preserve policy expressions, table grants, mapper body, and other roles.
- Exclude the six missing RLS flags and complete replay repair; track separately.

## Evidence and Sources

At source `aa26f7c424967a627be498a48f47820562a8702b`, the universal task migration
revokes this mapper's execution from all API roles but uses it in the
`order_fulfillment_work_items` SELECT policy. Authenticated SELECT fails with
`42501 / permission denied for function clair_queue_permission_for_destination`.
The mapper is immutable, reads no data, and only maps module/action to a permission
name. Membership and queue capability enforcement remains in the existing RLS policy.

- [Universal task migration](../../../supabase/migrations/20260825235000_chart_order_universal_task_contract.sql)
- [Forward migration](../../../supabase/migrations/20261027133855_fulfillment_rls_helper_execute_grant.sql)
- [Fulfillment contract](../../engineering/data-model/order-fulfillment-handoff-contract.md)
- [RLS follow-up](ENGINEERING-DB-PR-003-public-table-rls-replay-gap.md)
- [Full replay follow-up](ENGINEERING-DB-PR-004-clean-migration-replay.md)

## Verification and Done Criteria

Run `node scripts/test-fulfillment-rls-helper-grant.mjs` with Docker and the four
cached image versions named in the script. It accepts no database URL, creates its
own container without external network or host ports, and removes it in finally.
The test must reproduce the pre-fix denial, apply the real candidate twice, read an
authorized synthetic 업무 row, deny other-workspace/inactive/missing-capability
reads and direct writes, compare unchanged policies/table ACL, verify no
anon/service_role expansion, and roll back. Also run `npm run docs:check` and
`git diff --check`.

This is focused SQL coverage on a real 199-migration baseline, not a successful
311-file replay, hosted DB validation, or app/browser acceptance. The earlier
96-case HTTP diagnostic used a partially reconstructed DB; it is not the
verification baseline for this change.

## Result

On 2026-10-27, the isolated SQL runner passed all 199 baseline migrations,
pre-fix reproduction, candidate apply/reapply, row-level positive/negative checks,
policy/table ACL comparisons, other-role denial and rollback. Documentation links
and whitespace checks passed. No frontend/runtime application code changed.
Remote delivery and human acceptance remain separate.
