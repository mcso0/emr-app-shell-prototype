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

## Migration

File:

- `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`

New table groups:

| Group | Tables |
| --- | --- |
| Service catalog foundation | `service_categories`, `service_items`, `service_item_prices` |
| Chart and diagnosis | `soap_notes`, `soap_note_revisions`, `diagnosis_catalog`, `diagnoses` |
| Order foundation | `order_groups`, `orders`, `order_events`, `order_revisions`, `order_revision_fields` |
| Billing foundation | `invoices`, `invoice_lines`, `payments` |

## Scope And Constraint Decisions

- Every clinical and billing row carries `workspace_id`.
- Encounter-scoped tables use composite foreign keys such as `(workspace_id, encounter_id)` to avoid cross-workspace joins.
- Service item and invoice/order references also use workspace-scoped composite foreign keys where possible.
- Money uses `numeric(12,2)`, not floating point.
- `orders.line_total_snapshot` and `invoice_lines.line_total` are generated columns so stored totals follow quantity and unit price fields.
- Invoice unpaid/paid state is tracked through `payment_state`, while invoice lifecycle remains `draft`, `issued`, `paid`, `refund_requested`, `refunded`, `voided`.
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
- DEN-69+ must implement route-owned writes and server permission checks before UI live persistence is considered complete.
- Final clinical/billing RLS policies and Supabase advisor review remain future work.
- Lab/imaging/dispensing/treatment detail schemas, PG transaction schema, and full service catalog live conversion remain out of scope.

## Verification

- `npx playwright test tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx playwright test tests/reception-domain-schema-migration.spec.ts tests/reception-patient-guardian-lookup-server.spec.ts tests/reception-patient-guardian-registration-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run security:secrets`
- `npm run docs:check`
