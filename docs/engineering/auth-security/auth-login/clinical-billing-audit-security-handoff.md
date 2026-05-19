---
title: "Clinical Billing Audit Security Handoff"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-81"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-016-audit-security-readiness-handoff.md"
---

# Clinical Billing Audit Security Handoff

Linear: DEN-81
Project: `04 Chart, Order & Billing Persistence`
Next project: `05 Audit, Security & MVP Readiness`

## Summary

Project 04 converted the core outpatient chart, order, and billing path to route-backed local-first persistence contracts on top of persisted reception encounters.

This handoff is documentation-only. It does not start audit persistence, remote Supabase validation, production deployment, provider integration, or real patient/hospital data access.

## Completed Clinical Billing Scope

| Area | Completed handoff |
| --- | --- |
| Scope and schema | Encounter dependency, permission boundary, schema foundation, and chart-applied order snapshot bridge are documented and migration-backed. |
| SOAP and chart completion | SOAP subjective/objective/assessment/plan saves, autosave metadata, and chart completion state have route-backed read/save contracts. |
| Diagnosis rows | Catalog-selected and free-text diagnosis rows keep row order, confirmed/focus flags, and encounter/workspace scope. |
| Order draft and action | Editable order draft rows, order confirmation, billing-submit hook, and lifecycle status transitions have route-backed contracts. |
| Billing candidates | Confirmed orders can create deterministic invoice candidate lines without duplicate generation. |
| Invoice and payment state | Invoice line edits, billing confirmation, selected payment method, unpaid state, and completed payment state have route-backed contracts. |
| Regression | The outpatient persistence path is covered from SOAP save through order confirmation, invoice candidate sync, and billing completion. |

## Mutation And Event Hook Matrix

| Domain | Route/RPC boundary | Mutation | Audit event candidate | Required audit payload |
| --- | --- | --- | --- | --- |
| Chart SOAP | `/chart/soap-notes`, `clair_save_chart_soap_note` | Save/autosave SOAP fields | `chart.soap_saved` | workspace id, encounter id, actor id, changed fields, save mode, timestamp |
| Chart completion | `/chart/completion`, `clair_complete_chart` | Mark chart ready for billing | `chart.completed` | workspace id, encounter id, actor id, previous status, next status, timestamp |
| Diagnosis | `/chart/diagnoses`, `clair_save_chart_diagnoses` | Add/update/delete/reorder diagnosis rows | `diagnosis.changed` | workspace id, encounter id, actor id, row ids, before/after summary |
| Order draft | `/chart/order-drafts`, `clair_save_chart_order_draft` | Edit billing name, quantity, remove draft rows | `order.draft_changed` | workspace id, encounter id, actor id, order ids, server-calculated amounts |
| Order action | `/chart/order-actions`, `clair_save_chart_order_action` | Confirm selected orders or mark billing candidate intent | `order.confirmed`, `billing.invoice_candidate_requested` | workspace id, encounter id, actor id, selected order ids, action, timestamp |
| Order lifecycle | `/chart/order-lifecycle`, `clair_save_chart_order_lifecycle` | Move requested/in progress/completed/cancelled | `order.status_changed` | workspace id, encounter id, order id, actor id, previous status, next status, cancellation reason when present |
| Billing candidate | `/billing/invoice-candidates`, `clair_sync_billing_invoice_candidates` | Create invoice candidate lines from confirmed orders | `billing.invoice_candidate_generated` | workspace id, encounter id, invoice id, order ids, line ids, server price/quantity basis |
| Invoice lines | `/billing/invoice-lines`, `clair_save_billing_invoice_lines` | Edit line quantities and issue invoice | `billing.invoice_line_changed`, `billing.invoice_issued` | workspace id, invoice id, actor id, line ids, recalculated subtotal/total, issued timestamp |
| Payment state | `/billing/payment-status`, `clair_save_billing_payment_status` | Select method, mark unpaid, complete payment | `billing.payment_state_changed` | workspace id, invoice id, encounter id, actor id, previous payment state, next payment state, method/unpaid reason summary |

Audit payloads must never include service role keys, DB passwords, authorization headers, raw provider payloads, stack traces, or real patient/clinic data.

## Security Readiness Notes

- Server routes are the application boundary for chart/order/billing mutations; client UI gating is only convenience.
- Route cores enforce active workspace membership and domain permissions before persistence gateways are used.
- RPC migrations add local-first database-side membership and workspace/encounter or invoice ownership checks, but final domain RLS policies remain a Project 05 readiness item.
- Billing totals must remain server-calculated from stored quantity and price snapshots. Client-submitted totals are display hints only.
- Mock fallback remains deterministic and synthetic. It is not a live-data escape hatch.
- Remote Supabase, production deploy, staging/live migration, and real patient/hospital data remain approval-gated.

## Known Risks And Post-MVP Gaps

| Risk or gap | Current disposition | Recommended next action |
| --- | --- | --- |
| Final clinical/billing RLS policy baseline is not complete. | Local-first RPC checks exist; no remote validation was performed. | Project 05 should design and locally replay RLS policies before any remote database action. |
| Audit persistence is not implemented. | Event hook matrix is ready; no audit rows are written by these routes yet. | Add an append-only audit writer behind route/core boundaries. |
| Lab, imaging, dispensing, and treatment execution are not fully live-persisted. | Project 04 intentionally covered chart/order/billing handoff only. | Treat each operational module as a separate persistence project. |
| Payment provider and accounting settlement are excluded. | Payment completion is synthetic workflow state only. | Add PG/accounting contracts only after MVP readiness review. |
| Local SQL replay depends on local Supabase/Docker availability. | Migrations are authored and tested by file/route regression. | Run local Supabase replay when the local environment is approved and available. |

## Next Recommended Issue

Start Project 05 from the first open issue in `05 Audit, Security & MVP Readiness`. The first slice should be audit/security scoping over the Project 04 mutation matrix, not broad feature implementation.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
