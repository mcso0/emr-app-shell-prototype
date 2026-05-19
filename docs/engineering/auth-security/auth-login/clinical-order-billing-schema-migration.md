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

DEN-69 adds the first route-owned SOAP persistence boundary on top of this schema. DEN-70 adds chart completion persistence as the next route-owned handoff. Both remain local-first and do not apply anything to remote Supabase.

## Migration

File:

- `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`
- `supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql`
- `supabase/migrations/20260519180000_chart_soap_note_persistence_rpc.sql`
- `supabase/migrations/20260519190000_chart_completion_persistence_rpc.sql`

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
- DEN-69 implements the first route-owned SOAP write/read boundary with server permission checks. DEN-70 implements the chart completion boundary. DEN-71+ must continue this pattern for diagnosis, order, and billing writes.
- Final clinical/billing RLS policies and Supabase advisor review remain future work.
- Lab/imaging/dispensing/treatment detail schemas, PG transaction schema, and full service catalog live conversion remain out of scope.

## Verification

- `npx playwright test tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx playwright test tests/chart-order-snapshot-bridge-migration.spec.ts --reporter=line`
- `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart-completion-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/reception-domain-schema-migration.spec.ts tests/reception-patient-guardian-lookup-server.spec.ts tests/reception-patient-guardian-registration-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run security:secrets`
- `npm run docs:check`
