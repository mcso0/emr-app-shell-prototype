---
id: "RECEPTION-LIVE-PR-018"
type: "Work Item"
title: "Reception encounter cancel contract repair"
description: "Repair the live reception cancel RPC contract and keep encounter and consultation queue cancellation atomic."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "supabase"
  - "cancellation"
  - "authorization"
target_pr: "User report / reception cancel HTTP 500"
source_docs:
  - "docs/product/domain/outpatient-workflow-state-model.md"
  - "docs/product/domain/workspace-auth-permissions.md"
dependencies:
  - "RECEPTION-QA-PR-001"
updated: "2026-08-30"
report: "docs/completed/reception/2026-08-30-reception-encounter-cancel-contract-repair-report.html"
---

# Reception Encounter Cancel Contract Repair

## Goal

Restore live reception cancellation by aligning the application RPC call with the
database function and schema while preserving workspace, actor, permission, and
atomic state-transition boundaries.

## Scope

- Add the nullable encounter cancellation-reason column and require a nonblank
  reason for cancelled encounters.
- Add the four-argument cancellation RPC used by the application.
- Require the authenticated actor to match the requested actor and hold
  `reception:update` in the target workspace.
- Lock and cancel the encounter and its consultation queue row in one database
  transaction.
- Append the cancellation audit event in that same transaction so an audit
  failure rolls back both status changes.
- Forward only a bounded, safe request correlation ID into the database audit
  transaction, and require both the database audit marker and event ID before
  suppressing the server audit fallback.
- Remove authenticated execution from the obsolete three-argument RPC.
- Map database authorization denials to HTTP 403 and add focused regression
  coverage for the live contract.
- Verify the remote migration with rollback-only synthetic data before using the
  normal application flow.

## Out Of Scope

- Appointment cancellation.
- Reception queue card or status-label redesign.
- A user-entered cancellation-reason field; the current reception source reason
  remains unchanged.
- Applying the unrelated historical chart CTA migration as a bundle.
- Using an existing visible encounter as a release probe.

## Done When

- The exact four-argument RPC exists and authenticated callers cannot execute the
  obsolete three-argument overload.
- Actor mismatch, inactive/cross-workspace access, and missing
  `reception:update` are denied at the database boundary.
- Encounter status/reason and consultation queue status/finished time change
  atomically for waiting or in-consultation work.
- The cancellation audit event is committed with those state changes, and an
  induced audit failure leaves the encounter and queue unchanged.
- Non-cancelable, missing, and already-cancelled cases retain their conflict
  semantics.
- Focused tests, migration validation, secret/docs/lint/type/build gates, exact
  candidate Release Check, fixed staging smoke, and rollback-only remote replay
  pass before production release.

## Verification Plan

- `npx playwright test tests/reception-encounter-cancel-server.spec.ts`
- `npx playwright test tests/reception.spec.ts`
- `npx supabase db reset`
- `npx supabase db lint --local --schema public`
- `npm run security:secrets`
- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Remote catalog/grant inspection and rollback-only synthetic cancellation replay.
- Fixed staging and production smoke against a dedicated synthetic encounter only.

## Rollback

- Stop before remote application if migration validation, catalog checks, or the
  synthetic replay fails.
- Preserve the additive cancellation-reason column and any recorded reason data;
  do not drop it during rollback.
- Never re-enable the prior three-argument overload: it does not write a reason
  and cannot satisfy the new cancelled-state constraint.
- If the RPC contract is faulty, block new cancel requests and apply a forward
  correction; roll back only the application deployment when the DB contract is
  healthy and the application release is faulty.
- Keep the previous production deployment id as the application rollback target.

## Current Result

Implementation and local verification are complete. Focused server tests (11),
TypeScript, ESLint, docs, secret scan, and production build pass. The new
migration applies to the pre-existing locally reproducible schema, and the
rollback-only replay passes actor, permission, inactive-member, cross-workspace,
audit-failure rollback, atomic audit marker/readback, and zero-residue checks. Full local DB reset
still stops before this migration at the pre-existing
`20260826160000_clinical_master_dispensing_service_review` seed-order foreign-key
failure. Remote Supabase mutation, fixed staging, and production release remain
gated by the exact-candidate release packet.
