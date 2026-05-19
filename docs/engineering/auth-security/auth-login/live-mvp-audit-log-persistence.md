---
title: "Live MVP Audit Log Persistence"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-84"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-003-live-mvp-audit-log-persistence.md"
---

# Live MVP Audit Log Persistence

Linear: DEN-84
Project: `05 Audit, Security & MVP Readiness`

## Summary

DEN-84 adds the local-first audit persistence foundation for later live MVP mutation routes.

This work creates the `audit_events` schema and a server-only append helper boundary. DEN-85 now wires the helper into selected business mutation routes. This document still excludes audit review UI, external log sinks, analytics aggregation, production deploy, remote Supabase changes, and real patient/hospital data access.

## Schema

Migration:

- `supabase/migrations/20260520120000_live_mvp_audit_events.sql`

Table:

- `public.audit_events`

Core fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable audit event id. The helper can generate deterministic ids. |
| `workspace_id` | Workspace scope for every event. |
| `actor_user_id` / `actor_membership_id` | Server-verified actor context when available. |
| `event_type` | Canonical dotted event type from DEN-83. |
| `target_type` / `target_id` | Changed target. |
| `encounter_id`, `patient_id`, `guardian_id` | Clinical workflow context when applicable. |
| `request_id` | Route trace id when available. |
| `reason` | Optional user-supplied reason. |
| `before_snapshot`, `after_snapshot`, `metadata` | JSON object summaries only. |
| `occurred_at`, `created_at` | Server timestamps. |

RLS is enabled. Direct table grants are revoked from `public`, `anon`, and `authenticated`; append goes through `public.clair_append_audit_event(...)`.

Indexes cover workspace timeline, event type, target, encounter, and actor review paths.

## Append Helper

Files:

- `src/features/audit/server-audit-log-persistence-core.ts`
- `src/features/audit/server-audit-log-persistence.ts`

Behavior:

- Normalizes required workspace, event, target, timestamp, snapshots, and metadata.
- Generates deterministic `audit_<sha256>` ids when the caller does not pass an id.
- Rejects unsupported event types.
- Requires `before`, `after`, and `metadata` to be JSON objects.
- Rejects sensitive payload keys before gateway writes, including token, password, secret, service role, raw payload, stack trace, SQL error, full SOAP, and full chart keys.
- Provides a mock gateway for tests and a Supabase RPC gateway for future server route integration.

## Transaction Decision

The helper is intentionally a callable boundary, not an automatic side effect.

DEN-85 follow-up status:

- Critical workspace/member, reception, chart, order, and billing mutation boundaries now call the audit append helper through `src/features/audit/server-mutation-audit-core.ts`.
- Supabase-backed routes pass the Supabase audit append gateway; mock/demo mode remains local-first.
- Full SOAP/chart bodies and raw payloads remain excluded from audit event snapshots.

Continuing rule:

- Critical auth, membership, chart, order, billing, and payment-state audit events should append in the same server mutation transaction or RPC whenever practical.
- If append fails for a critical event, the business mutation should fail rather than silently dropping audit evidence.
- Non-critical review-only events may be retried or classified as follow-up only after the product explicitly accepts that risk.

## Verification

- `npx playwright test tests/live-audit-log-persistence.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
