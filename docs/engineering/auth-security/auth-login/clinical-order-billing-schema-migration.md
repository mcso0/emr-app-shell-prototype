---
title: "Clinical Order Billing Schema Migration"
status: "human_review"
updated: "2026-05-19"
source:
  - "DEN-68"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-002-schema-migration.md"
---

# Clinical Order Billing Schema Migration

Linear: DEN-68
Project: `04 Chart, Order & Billing Persistence`

## Summary

DEN-68 adds the local-first schema foundation required for Project 04 chart, order, and billing persistence.

The migration is intentionally schema-only. It does not implement route handlers, UI persistence, final domain RLS policies, remote Supabase validation, production deployment, or real data access.

DEN-69 adds the first route-owned SOAP persistence boundary on top of this schema. DEN-70 adds chart completion persistence as the next route-owned handoff. DEN-81 closes the Project 04 persistence sequence with an audit/security handoff. All remain local-first and do not apply anything to remote Supabase.

## Migration

File:

- `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`
- `supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql`
- `supabase/migrations/20260519180000_chart_soap_note_persistence_rpc.sql`
- `supabase/migrations/20260519190000_chart_completion_persistence_rpc.sql`
- `supabase/migrations/20260519200000_chart_diagnosis_persistence_rpc.sql`
- `supabase/migrations/20260519210000_chart_order_draft_persistence_rpc.sql`
- `supabase/migrations/20260519220000_chart_order_action_persistence_rpc.sql`
- `supabase/migrations/20260519230000_chart_order_lifecycle_persistence_rpc.sql`
- `supabase/migrations/20260520090000_billing_invoice_candidate_sync_rpc.sql`
- `supabase/migrations/20260520100000_billing_invoice_line_persistence_rpc.sql`
- `supabase/migrations/20260520110000_billing_payment_status_persistence_rpc.sql`

New table groups:

| Group | Tables |
| --- | --- |
| Service catalog foundation | `service_categories`, `service_items`, `service_item_prices` |
| Chart and diagnosis | `soap_notes`, `soap_note_revisions`, `diagnosis_catalog`, `diagnoses` |
| Order foundation | `order_groups`, `orders`, `order_events`, `order_revisions`, `order_revision_fields` |
| Billing foundation | `invoices`, `invoice_lines`, `payments` |

DEN-100 adds a follow-up bridge migration for chart-applied order rows. It extends `orders` rather than creating the full hospital-admin catalog schema, so Project 04 can save rows created from individual orders, order sets, and set children while preserving the source and snapshot needed for billing.

DEN-69 adds local-first RPC functions:

- `public.clair_get_chart_soap_note(p_workspace_id, p_encounter_id)`
- `public.clair_save_chart_soap_note(p_workspace_id, p_actor_user_id, p_encounter_id, p_note, p_mode)`

These functions check active workspace membership and encounter workspace scope. The app route still performs the domain permission check before calling the persistence gateway.

DEN-70 adds local-first chart completion fields and RPC functions:

- `encounters.chart_completed_at`
- `encounters.chart_completed_by_user_id`
- `public.clair_get_chart_completion(p_workspace_id, p_encounter_id)`
- `public.clair_complete_chart(p_workspace_id, p_actor_user_id, p_encounter_id)`

Chart completion moves clinical work to `ready_for_billing` and keeps `encounters.completed_at` reserved for invoice/payment completion.

DEN-71 adds local-first diagnosis RPC functions:

- `public.clair_get_chart_diagnoses(p_workspace_id, p_encounter_id)`
- `public.clair_save_chart_diagnoses(p_workspace_id, p_actor_user_id, p_encounter_id, p_diagnoses)`

These functions check active workspace membership and encounter workspace scope. The app route still performs `chart:view`/`chart:update` permission checks before calling the persistence gateway.

CHART-PR-024 adds nullable `diagnoses.closed_at` and `diagnoses.closed_by_user_id`, keeps at most one primary diagnosis per encounter, and extends the same RPC payload with `isClosed`. The reader requires active membership plus `chart:view`; the writer also requires actor/session equality plus `chart:update`. The writer preserves the first closure timestamp and actor while the diagnosis remains closed, and clears both fields when reopened. No new route or permission is introduced.

DEN-72 adds local-first order draft RPC functions:

- `public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id)`
- `public.clair_save_chart_order_draft(p_workspace_id, p_actor_user_id, p_encounter_id, p_orders)`

These functions check active workspace membership and encounter workspace scope. The save RPC updates editable `orders.billing_display_name` and `orders.quantity`, recalculates generated amount fields from stored unit price snapshots, records an `order_events` handoff, and can remove omitted draft/pending rows that have no invoice line. The app route still performs `chart:view`/`chart:update` permission checks before calling the persistence gateway.

DEN-73 adds local-first order action RPC functions:

- `public.clair_get_chart_order_actions(p_workspace_id, p_encounter_id)`
- `public.clair_save_chart_order_action(p_workspace_id, p_actor_user_id, p_encounter_id, p_action, p_order_ids)`

These functions check active workspace membership, encounter workspace scope, and selected order ownership. `confirm` updates confirmation status, actor, and timestamp. `bill` updates billing candidate status and `billing_candidate_id` as a hook point for later invoice candidate generation without finalizing invoices or payments. The app route still performs `chart:view`/`chart:update` permission checks before calling the persistence gateway.

DEN-74 adds local-first order lifecycle RPC functions:

- `public.clair_get_chart_order_lifecycle(p_workspace_id, p_encounter_id)`
- `public.clair_save_chart_order_lifecycle(p_workspace_id, p_actor_user_id, p_encounter_id, p_order_id, p_status, p_cancellation_reason)`

These functions check active workspace membership, encounter workspace scope, selected order ownership, and minimal lifecycle transition rules for `requested`, `re_requested`, `in_progress`, `completed`, and `cancelled`.

DEN-75 adds local-first billing invoice candidate RPC functions:

- `public.clair_list_billing_invoice_candidates(p_workspace_id, p_encounter_id)`
- `public.clair_sync_billing_invoice_candidates(p_workspace_id, p_actor_user_id, p_encounter_id, p_order_ids)`

These functions check active workspace membership, encounter workspace scope, selected order ownership, confirmed/candidate-created order state, and duplicate invoice line generation. Candidate line amount fields are derived from server-owned `orders.quantity` and `orders.unit_price_snapshot`; invoice/payment finalization remains out of scope.

DEN-77 adds local-first billing invoice line RPC functions:

- `public.clair_get_billing_invoice_lines(p_workspace_id, p_invoice_id)`
- `public.clair_save_billing_invoice_lines(p_workspace_id, p_actor_user_id, p_invoice_id, p_lines, p_confirm_billing)`

These functions check active workspace membership, invoice workspace scope, invoice line ownership, and editable invoice status. Line totals remain generated from stored quantity and unit price, invoice subtotal/total are recalculated server-side, and billing confirmation stores `issued_by_user_id` plus `issued_at` without completing payment.

DEN-78 adds local-first billing payment status RPC functions:

- `public.clair_get_billing_payment_status(p_workspace_id, p_invoice_id)`
- `public.clair_save_billing_payment_status(p_workspace_id, p_actor_user_id, p_invoice_id, p_action, p_payment_method, p_unpaid_reason)`

These functions check active workspace membership and invoice workspace scope. They persist selected payment method, unpaid state, completed payment state, synthetic approved payment rows, and completed encounter handoff without integrating a real PG provider or accounting settlement.

## Scope And Constraint Decisions

- Every clinical and billing row carries `workspace_id`.
- Encounter-scoped tables use composite foreign keys such as `(workspace_id, encounter_id)` to avoid cross-workspace joins.
- Service item and invoice/order references also use workspace-scoped composite foreign keys where possible.
- Money uses `numeric(12,2)`, not floating point.
- `orders.line_total_snapshot` and `invoice_lines.line_total` are generated columns so stored totals follow quantity and unit price fields.
- `orders.row_type`, `source_order_id`, `source_set_id`, `set_item_id`, `parent_chart_order_line_id`, and `row_depth` represent chart-applied hierarchy without turning Project 04 into the hospital-admin order catalog project.
- `orders.applied_snapshot`, `applied_price_snapshot`, `calculation_inputs`, and `calculation_outputs` separate frozen catalog values, price rules, user-entered source values, and server-derived values.
- `orders.order_confirmation_status` and `orders.billing_candidate_status` intentionally stay separate so Order 확정 and Order 청구 are not collapsed into one boolean.
- `invoice_lines.source_order_snapshot`, `billing_candidate_id`, `billing_name_snapshot`, `tax_type`, `non_tax_reason`, and `discount_adjustment_reason` preserve the billing handoff from the chart order row.
- Invoice unpaid/paid state is tracked through `payment_state`, while invoice lifecycle remains `draft`, `issued`, `paid`, `refund_requested`, `refunded`, `voided`.
- `encounters.chart_completed_at` and `encounters.chart_completed_by_user_id` track chart completion separately from invoice/payment completion.
- RLS is enabled on every new table, but final domain policies are intentionally deferred.
- Full service catalog management is not implemented; only the table foundation needed by order and billing rows is present.

## Synthetic Seed Contract

`supabase/seed.sql` now includes synthetic DEN-68 rows linked to the existing DEN-56 synthetic encounter:

- one service category, item, and active price;
- one SOAP note;
- one diagnosis row;
- one order group and `ready_for_billing` order;
- one issued unpaid invoice and invoice line.

These rows are development fixtures only. They do not represent real patient, hospital, or payment data.

## Remaining Gaps

- Actual local Supabase SQL replay depends on Docker/local Supabase availability.
- DEN-69 implements the first route-owned SOAP write/read boundary with server permission checks. DEN-70 implements the chart completion boundary. DEN-71 implements diagnosis rows. DEN-72 implements editable order draft rows. DEN-73 implements order confirmation/submit actions. DEN-74 implements order lifecycle status. DEN-75 implements invoice candidate sync. DEN-77 implements invoice line edits and billing confirmation. DEN-78 implements payment method, unpaid, and completed payment state persistence. DEN-79/DEN-80 add regression hardening, and DEN-81 closes Project 04 with audit/security handoff docs.
- Final clinical/billing RLS policies and Supabase advisor review remain future work.
- Lab/imaging/dispensing/treatment detail schemas, PG transaction schema, and full service catalog live conversion remain out of scope.

## Verification

- `npx playwright test tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-snapshot-bridge-migration.spec.ts --reporter=line`
- `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-completion-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-diagnosis-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-draft-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-action-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-lifecycle-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/billing-invoice-candidate-sync-server.spec.ts --reporter=line`
- `npx playwright test tests/billing-invoice-line-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/billing-payment-status-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/reception-domain-schema-migration.spec.ts tests/reception-patient-guardian-lookup-server.spec.ts tests/reception-patient-guardian-registration-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run security:secrets`
- `npm run docs:check`
