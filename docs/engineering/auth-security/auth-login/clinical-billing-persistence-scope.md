---
title: "Clinical Billing Persistence Scope"
status: "human_review"
updated: "2026-05-19"
source:
  - "DEN-67"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-001-scope-encounter-dependency.md"
---

# Clinical Billing Persistence Scope

Linear: DEN-67
Project: `04 Chart, Order & Billing Persistence`

## Decision Summary

Project 04 should convert the core outpatient chart, order, and billing path to local-first live persistence on top of the persisted reception `encounter`.

The project starts from the encounter created by reception/check-in. It should not broaden into full lab/imaging/dispensing/treatment execution, payment provider integration, production deployment, remote Supabase, or real clinic/patient data.

## Included MVP Persistence Scope

| Area | Included in Project 04 | Primary dependency |
| --- | --- | --- |
| SOAP/chart notes | Save SOAP subjective, objective, assessment, plan fields; preserve autosave metadata; persist chart completion state. | `encounter.id`, `workspaceId`, actor membership |
| Diagnoses | Save catalog-linked or free-text diagnosis rows, confirmed/focus flags or equivalent MVP markers, and row order. | `encounter.id`, chart mutation permission |
| Order draft | Save order draft rows, billing display name, quantity, deletion/cancel intent, and server-calculated amount basis. | `encounter.id`, service item/price snapshot |
| Order confirmation/lifecycle | Persist selected order confirmation, actor/timestamp, order lifecycle state, and status transition hooks. | `encounter.id`, order rows |
| Billing invoice candidates | Generate invoice candidate lines from confirmed orders and service prices without duplicate candidate creation. | confirmed order rows |
| Billing confirmation/status | Persist invoice line edits, issue/confirmation state, payment method selection, unpaid state, and completed payment state without real PG integration. | invoice/invoice lines, guardian context |
| Regression/handoff | Add outpatient persistence regression and audit/security readiness handoff. | route contracts and deterministic fixtures |

## Explicitly Out Of Scope

- Full live conversion of lab result, imaging study, dispensing execution, and treatment execution workspaces.
- PACS, device result ingestion, Kakao/provider delivery, file storage, or message provider effects.
- Real PG/payment provider authorization, settlement, refund provider workflow, accounting export, or tax complexity.
- AI/drug-safety automation, order recommendation automation, or real diagnosis catalog API.
- Production deploy, remote Supabase link/push/query, staging/live migration, or real patient/hospital data.
- Final domain RLS policy completion unless a later Project 04 issue explicitly scopes it.

## Encounter Dependency Contract

Every Project 04 read/write must carry and validate:

- `workspaceId`: server-enforced workspace scope.
- `encounterId`: durable join target for chart, diagnosis, orders, invoices, and queue/status handoff.
- `patientId`: display/context link only; not an authorization source.
- `guardianId`: billing and communication context when available; validate workspace/link when used.
- `appointmentId`: origin context only; do not infer encounter existence from appointment.
- `primaryVeterinarianId`: initial clinician hint; not necessarily final signer.
- `encounter.status`: high-level workflow state.

Status handoff:

| Event | Encounter status target |
| --- | --- |
| First chart/SOAP write starts clinical work | `in_consultation` |
| Orders are confirmed or active | `ordered` |
| Clinical work is ready to bill | `ready_for_billing` |
| Invoice/payment is completed without cancellation | `completed` |
| Reception or clinical cancellation removes active workflow | `cancelled` |

Queue rows remain operational placement records. They are not the source of encounter existence.

## Fallback Strategy

- Mock/local demo mode must keep the current session-only and `kong-vomit` sales demo paths usable.
- Supabase mode must not silently trust browser storage for protected clinical or billing writes.
- Route-mocked Playwright tests may use deterministic persisted-shaped fixtures when a real local DB is unnecessary for the issue.
- Actual local Supabase SQL replay should be attempted only against local Docker/Supabase, never remote Supabase.

## Permission Boundary

Use active workspace membership plus domain-specific permissions. Personal profile data, query strings, client storage, and user-editable metadata are not permission sources.

| Operation | Minimum boundary |
| --- | --- |
| Read chart/order/billing context | Active membership plus existing module read permission. |
| Save SOAP/chart or diagnosis | Active membership plus chart mutation permission; MVP roles: `hospital_admin` or `vet`. |
| Create/update/confirm clinical orders | Active membership plus order mutation permission; `hospital_admin` or `vet` for clinical order authoring. |
| Complete assigned operational work | Active membership plus operational completion permission; technician support actions only where a later issue scopes it. |
| Issue/edit invoice and billing state | Active membership plus billing mutation permission; MVP allows `hospital_admin` and approved front-desk billing actions, with refund final approval reserved for `hospital_admin`. |
| Change role/policy or bypass amount calculation | Not allowed in Project 04 clinical routes. |

DEN-67 does not change the canonical product role matrix. Later implementation issues must map exact permission ids to existing resolver vocabulary before writing route code.

## Audit Event Candidates

Project 04 should prepare hook points, even if full audit persistence remains a later project.

| Event candidate | Trigger |
| --- | --- |
| `chart.soap_saved` | SOAP fields are saved or autosaved. |
| `chart.completed` | Chart completion state changes. |
| `diagnosis.changed` | Diagnosis row is added, edited, deleted, or reordered. |
| `order.draft_changed` | Order draft line is created, edited, deleted, or restored. |
| `order.confirmed` | Selected order rows are confirmed/submitted. |
| `order.status_changed` | Order lifecycle or work status changes. |
| `billing.invoice_candidate_generated` | Confirmed order creates invoice candidate lines. |
| `billing.invoice_line_changed` | Billing quantity/adjustment/line edits are saved. |
| `billing.invoice_issued` | Billing confirmation issues an invoice. |
| `billing.payment_state_changed` | Payment method, unpaid, paid, or void-like state changes. |

Audit payloads must include stable ids and before/after summaries when practical. They must not include secrets, raw provider payloads, DB passwords, service role keys, authorization headers, or stack traces.

## Recommended Project 04 Order

1. DEN-68: implement the minimum clinical/order/billing schema migration.
2. DEN-69: persist SOAP field saves and autosave metadata.
3. DEN-70: persist chart completion state.
4. DEN-71: persist diagnosis rows.
5. DEN-72: persist editable order draft table changes.
6. DEN-73: persist order confirmation.
7. DEN-74: implement order lifecycle status changes.
8. DEN-75: sync confirmed orders to billing invoice candidates.
9. DEN-76: read persisted order/invoice candidate state across chart and billing.
10. DEN-77: persist invoice line edits and billing confirmation.
11. DEN-78: persist payment method, unpaid, and completed payment states.
12. DEN-79: add billing permission and amount integrity regression coverage.
13. DEN-80: add full outpatient chart/order/billing persistence regression.
14. DEN-81: produce audit/security readiness handoff and Project 04 closeout.

DEN-81 output is captured in `docs/engineering/auth-security/auth-login/clinical-billing-audit-security-handoff.md` and the representative-facing HTML closeout report under `docs/completed/clinical-billing/`.

## Remaining Risks

- Local Supabase SQL runtime replay depends on Docker/local Supabase availability.
- Project 04 should avoid mixing clinical authoring, operational work completion, and final billing approval into one route or permission.
- Billing amount integrity must be server-calculated from stored service price/order data; client-submitted totals are display hints only.
- Remote/staging/live Supabase remains approval-gated.
- Project 05 should begin with audit/security review and RLS readiness over the DEN-81 mutation matrix before broadening into new module persistence.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
