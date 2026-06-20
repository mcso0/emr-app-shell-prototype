---
title: "Live MVP Audit Event Matrix"
status: "human_review"
updated: "2026-06-18"
source:
  - "DEN-83"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-002-live-mvp-audit-event-matrix.md"
---

# Live MVP Audit Event Matrix

Linear: DEN-83
Project: `05 Audit, Security & MVP Readiness`

## Summary

This document defines the audit event contract for live MVP mutations across workspace administration, reception, chart, order, billing, and payment-state boundaries.

It is a contract for DEN-84+ implementation. It does not add audit persistence, analytics dashboards, legal compliance certification, remote Supabase changes, production deploy, or real data access.

## Common Event Envelope

Every persisted audit event should use this stable envelope:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Deterministic or database-generated immutable event id. |
| `workspaceId` | yes | The workspace whose data changed. Never infer from client query only. |
| `actorUserId` | yes for user actions | Server-verified actor. Use a system actor only for explicitly system-owned jobs. |
| `actorMembershipId` | should | Membership row used for authorization when available. |
| `eventType` | yes | Canonical dotted event name from the matrix below. |
| `targetType` | yes | Domain target, such as `workspace`, `membership`, `encounter`, `order`, or `invoice`. |
| `targetId` | yes | Stable id of the changed target. |
| `encounterId` | when applicable | Required for reception/chart/order/billing clinical workflow events. |
| `patientId` | when applicable | Store ids only; do not store full personal snapshots. |
| `guardianId` | when applicable | Store ids only; do not store full personal snapshots. |
| `requestId` | should | Route request id for server traceability. |
| `occurredAt` | yes | Server timestamp. |
| `reason` | optional | User-supplied reason when the product explicitly asks for one. |
| `before` / `after` | should | Minimal before/after summary, not full raw record dumps. |
| `metadata` | optional | Safe scalar context needed for review, such as `saveMode` or `paymentState`. |

## Event Matrix

### Workspace, Member, And Profile

| Event type | Trigger | Target | Required payload summary | Sensitive exclusions |
| --- | --- | --- | --- | --- |
| `workspace.created` | New workspace is created. | `workspace` | workspace id, creator user id, creator membership id, initial role. | Subscription secrets, billing provider payloads. |
| `workspace.invitation_created` | Staff invite is created. | `workspace_invitation` | invitation id, target email domain or masked email, roles, expiration. | Invite token, raw email body, provider message id if sensitive. |
| `workspace.invitation_resent` | Invite resend is requested. | `workspace_invitation` | invitation id, resend count or timestamp. | Invite token, email provider secret/payload. |
| `workspace.invitation_canceled` | Invite is canceled. | `workspace_invitation` | invitation id, previous status, next status. | Token, cancellation internals. |
| `workspace.invitation_accepted` | Invite is accepted and membership activates. | `membership` | invitation id, user id, membership id, roles. | Invite token, auth provider raw payload. |
| `workspace.membership_roles_changed` | Admin changes member roles. | `membership` | target user id, before roles, after roles, last-admin guard result. | Profile personal notes, auth claims raw token. |
| `workspace.membership_status_changed` | Member is activated/deactivated. | `membership` | target user id, previous status, next status, last-admin guard result. | Internal stack traces, auth provider payload. |
| `workspace.last_admin_change_blocked` | Last active admin removal is blocked. | `membership` | target user id, attempted action, guard reason. | Full member list snapshots. |
| `user.profile_updated` | User edits own profile. | `user_profile` | changed field names, before/after safe values for display fields. | Passwords, tokens, government identifiers, secrets. |

### Reception And Encounter

| Event type | Trigger | Target | Required payload summary | Sensitive exclusions |
| --- | --- | --- | --- | --- |
| `reception.patient_guardian_registered` | Patient/guardian registration route succeeds. | `patient` or `guardian` | patient id, guardian id, registration branch, duplicate-check decision. | Raw resident numbers, unmasked phone if not required, consent signature image. |
| `reception.walk_in_created` | Walk-in encounter route succeeds. | `encounter` | encounter id, patient id, guardian id, veterinarian id, initial status. | Free-form private notes beyond safe summary. |
| `reception.appointment_checked_in` | Appointment check-in creates/links encounter. | `encounter` | appointment id, encounter id, previous appointment status, next status. | Message provider payloads. |
| `reception.appointment_restored` | Cancelled appointment is restored. | `appointment` | appointment id, previous status, next status, scheduled time. | Message provider payloads. |
| `reception.encounter_restored` | Cancelled reception encounter is restored to the queue. | `encounter` | encounter id, queue id, previous status, next status. | Internal scheduling debug data. |
| `reception.queue_status_changed` | Queue placement/status changes in a future route. | `waiting_queue_entry` | queue id, encounter id, previous status, next status. | Internal scheduling debug data. |

### Chart And Diagnosis

| Event type | Trigger | Target | Required payload summary | Sensitive exclusions |
| --- | --- | --- | --- | --- |
| `chart.soap_saved` | SOAP manual save/autosave succeeds. | `soap_note` | encounter id, changed SOAP fields, save mode, autosave timestamp. | Full SOAP rich text body unless explicitly required by legal policy. |
| `chart.completed` | Chart completion route succeeds. | `encounter` | encounter id, previous encounter status, next status, chart completion timestamp. | Full chart body. |
| `diagnosis.changed` | Diagnosis rows are added/updated/deleted/reordered. | `diagnosis` | row ids, operation summary, catalog/free-text marker, row order changes. | Raw clinical narrative beyond diagnosis labels and ids. |

### Order

| Event type | Trigger | Target | Required payload summary | Sensitive exclusions |
| --- | --- | --- | --- | --- |
| `order.draft_changed` | Editable order draft route saves row changes. | `order` | order ids, changed fields, server quantity, server amount basis. | Client-submitted total amounts as authority. |
| `order.confirmed` | Selected orders are confirmed. | `order` | order ids, previous confirmation status, next status, confirmed timestamp. | Full order snapshot when compact ids and labels suffice. |
| `order.billing_candidate_requested` | Order billing action marks candidate intent. | `order` | order ids, previous billing candidate status, next status. | Payment details. |
| `order.status_changed` | Lifecycle status route changes order status. | `order` | order id, previous status, next status, cancellation reason when present. | Device/PACS raw payloads. |

### Billing And Payment

| Event type | Trigger | Target | Required payload summary | Sensitive exclusions |
| --- | --- | --- | --- | --- |
| `billing.invoice_candidate_generated` | Confirmed orders create candidate invoice lines. | `invoice` | encounter id, invoice id, source order ids, generated line ids, subtotal/total. | Client-submitted amount as authority. |
| `billing.invoice_line_changed` | Invoice line edit route saves changes. | `invoice_line` | invoice id, line ids, server quantity, server unit price, recalculated line totals. | Raw payment provider data. |
| `billing.invoice_issued` | Billing confirmation issues invoice. | `invoice` | invoice id, previous status, next status, issued by, issued at, total. | Receipt provider payloads. |
| `billing.payment_state_changed` | Payment method, unpaid, or paid state changes. | `payment` or `invoice` | invoice id, previous payment state, next payment state, method label, unpaid reason summary. | Card numbers, approval secrets, raw PG payloads. |
| `billing.refund_requested` | Future refund request starts. | `invoice` | invoice id, requested amount, reason code, requester. | Bank account data, raw PG payloads. |

## Sensitive Data Exclusions

Never store these in audit payloads:

- service role keys, API keys, DB passwords, authorization headers, cookies, session tokens, invite tokens;
- raw Supabase, PG, KakaoTalk, PACS, device, or email provider payloads;
- stack traces, SQL error details, internal network addresses, local file paths containing secrets;
- full SOAP/chart body, full personal profile snapshots, raw consent signature images, or real patient/hospital data unless a later legal policy explicitly requires a narrow field;
- client-submitted totals as billing authority.

Audit payloads may store stable ids, safe display labels, enum states, masked contact hints, changed field names, before/after status summaries, and server-calculated amount summaries.

## Implementation Order

1. DEN-84: add `audit_events` schema and server-only append helper using the common envelope.
2. DEN-85: emit events from workspace/member, reception encounter, chart, order, and billing mutations.
3. DEN-86: add a minimal hospital-admin audit review surface.
4. DEN-87/DEN-88: review live auth/RLS/workspace and clinical/billing mutation boundaries against the matrix.
5. DEN-89/DEN-90/DEN-91: QA full outpatient workflow, role/workspace denial UX, and representative pilot rehearsal using audit evidence as part of readiness.

## Open Implementation Decisions

- Whether `before`/`after` are JSONB columns or normalized field-change child rows should be decided in DEN-84.
- Whether SOAP full text is ever retained in audit should remain default-no until a legal/compliance requirement is accepted.
- Whether audit append failure blocks the business mutation must be explicit per event class in DEN-84. Critical auth/billing events should prefer transactional append where feasible.

DEN-84 output is captured in `docs/engineering/auth-security/auth-login/live-mvp-audit-log-persistence.md`. DEN-85 should emit events through that helper boundary.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
