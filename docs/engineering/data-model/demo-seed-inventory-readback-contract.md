---
status: "active"
owner_area: "engineering"
updated: "2026-06-09"
source_docs:
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/current-status.md"
  - "supabase/seed.sql"
  - "supabase/snippets/demo_seed_inventory_readback.sql"
---

# Demo Seed Inventory Readback Contract

This document started as the Demo DB PR 1 contract for `workspace_id = 'clair-demo'` and was updated through Demo DB PR 5. UI PR 1 adds the first reception/chart API wiring and route-boundary E2E coverage without changing the seed. UI PR 2 extends downstream UI/API adoption for lab result-sheet catalog, local/dev result entry, fulfillment route transitions, billing checkout, and audit review without changing the seed. This document defines what the current synthetic `supabase/seed.sql` proves, how to read it back from a local/dev Supabase database, and which demo data families remain for later UI/API adoption work.

## Current Judgment

The project is not just a frontend prototype: it has a partial multi-tenant EMR SaaS backend foundation with Supabase Auth users, workspace membership, role policies, reception/customer tables, chart/order/billing tables, audit events, API/server boundaries, migrations, and deterministic synthetic seed rows.

It is also not yet a fully API-backed demo DB product. The current seed proves the outpatient demo spine from login/workspace through reception, chart, orders, fulfillment queues, lab result-sheet catalog linkage, billing, payment allocation, checkout session, audit, and hospital-admin order catalog/order set search foundation for five synthetic scenarios. The remaining work is UI rewiring, API-backed read/write adoption, and end-to-end demo flow verification, not a missing seed-family gap.

UI PR 1 starts that adoption work by making reception hydrate patient/guardian profile context from the reception lookup route, making the chart side panel load through the chart live-queue route, and adding a focused Playwright spec that exercises the synthetic outpatient route boundary from reception through chart order confirmation, fulfillment completion, billing checkout/payment status, and audit readback. UI PR 2 adds the next downstream slice: live lab work items can hydrate empty result rows from the seeded lab result-sheet catalog, result entry can cross a local/dev server boundary, treatment/dispensing fulfillment transitions are covered in the route-boundary test, and visible billing checkout plus audit review UI consumption are covered.

## Scope

- Workspace: `clair-demo`
- Seed family: deterministic synthetic rows in `supabase/seed.sql`
- Runtime target: local/dev/test Supabase only
- Out of scope: UI rewiring, remote Supabase replay, production DB work, real hospital data, real patient data, large seed expansion

## Evidence Summary

| Area | Current Seed Coverage | Evidence | Demo Scenario Proof | Status |
| --- | --- | --- | --- | --- |
| Auth users / app users | Synthetic Supabase Auth users and app users exist for canonical roles. | `supabase/seed.sql` lines with `insert into auth.users`, `insert into auth.identities`, `insert into public.users` | Role-specific demo login for admin, vet, technician, and front desk. | Covered |
| Workspace | `clair-demo` workspace exists and is renamed to `CLAiR Medium Animal Hospital`. | `supabase/seed.sql` `public.workspaces` rows and DEN-194 workspace update | Select one demo hospital workspace. | Covered |
| Memberships | Active memberships exist for hospital admin, vets, technicians, and front desk staff. | `supabase/seed.sql` `public.user_memberships` rows | Multi-role hospital operation demo. | Covered |
| Permission policies | Workspace-scoped permission policy seed exists. | `supabase/seed.sql` `public.permission_policies`; migration `20260518023715_workspace_auth_schema_foundation.sql` | Permission matrix foundation for route/server checks. | Covered |
| Guardians | DEN-194 synthetic guardians exist. | `supabase/seed.sql` `DEN-194-G-%` rows | Reception/customer lookup and billing guardian context. | Covered |
| Patients | DEN-194 synthetic patients exist. | `supabase/seed.sql` `P-DEN194-%` rows | Patient lookup, chart context, and scenario continuity. | Covered |
| Patient guardians | DEN-194 relationship rows exist. | `supabase/seed.sql` `patient_guardians` rows | Guardian-patient readback. | Covered |
| Appointments | DEN-194 appointment rows exist. | `supabase/seed.sql` `appointments` rows | Daily reception schedule. | Covered |
| Encounters | DEN-194 encounter rows exist. | `supabase/seed.sql` `encounters` rows | Outpatient chart entry points. | Covered |
| Waiting queue entries | DEN-194 queue rows exist. | `supabase/seed.sql` `waiting_queue_entries` rows | Reception queue and status handoff. | Covered |
| SOAP notes | DEN-194 SOAP note rows exist. | `supabase/seed.sql` `soap_notes` rows | Chart SOAP readback. | Covered |
| Diagnoses | DEN-194 diagnosis rows exist. | `supabase/seed.sql` `diagnoses` rows | Assessment/billing context. | Covered |
| Service categories | DEN-194 service category rows exist, but not the full desired catalog breadth. | `supabase/seed.sql` `service_categories` rows | Category grouping for seeded orders. | Partial |
| Service items / prices | DEN-194 service item and price rows exist for lab, imaging, treatment, and dispensing. | `supabase/seed.sql` `service_items`, `service_item_prices` rows | Orderable/billable items for seeded chart orders. | Covered baseline, partial desired breadth |
| Order catalog items | DEMO-DB-PR-002 seeds nine `den194-catalog-%` rows mapped to DEN-194 service item/order meanings. | `supabase/seed.sql` `insert into public.order_catalog_items`; migration `20260520152000_hospital_admin_order_catalog_persistence.sql`; RPC `clair_list_order_catalog_chart_search` | Hospital-admin Order management and chart catalog search seed proof. | Catalog/set seed covered |
| Order sets | DEMO-DB-PR-002 seeds Kong vomiting and Mango wellness compact sets. | `supabase/seed.sql` `insert into public.order_sets`; `insert into public.order_set_items` | Order set management and set application demo. | Catalog/set seed covered |
| Order set items | DEMO-DB-PR-002 seeds five included-order rows linked to the seeded catalog rows. | `supabase/seed.sql` `den194-setitem-%` rows | Compact set expansion order and child price snapshot proof. | Catalog/set seed covered |
| Order groups | DEN-194 order groups exist. | `supabase/seed.sql` `order_groups` rows | Encounter-owned chart order grouping. | Covered |
| Orders | DEN-194 orders exist across lab, imaging, treatment, and dispensing. | `supabase/seed.sql` `orders` rows | Chart order confirmation and billing reflection. | Covered |
| Order events | DEN-194 result/completion events exist. | `supabase/seed.sql` `order_events` rows | Result/completion evidence. | Covered |
| Fulfillment work items | DEMO-DB-PR-003 seeds eleven `19431000-%` rows mapped one-to-one to DEN-194 orders. | `supabase/seed.sql` `insert into public.order_fulfillment_work_items`; migration `20260523094400_order_fulfillment_work_item_contract.sql`; RPC `clair_list_fulfillment_work_items` | Queue starts populated after reset for lab, imaging, treatment, and dispensing without clicking through chart sync. | Fulfillment seed covered |
| Lab result-sheet catalog | DEMO-DB-PR-004 seeds two categories, eight result items, and eight catalog links for CBC and urinalysis. | `supabase/seed.sql` `insert into public.lab_test_categories`, `insert into public.lab_test_items`, `insert into public.order_catalog_lab_test_item_links`; migration `20260520152000_hospital_admin_order_catalog_persistence.sql` | Structured CBC/urinalysis result entry foundation. | Lab result-sheet seed covered |
| Invoices | DEN-194 invoice rows exist. | `supabase/seed.sql` `invoices` rows | Billing desk invoice list. | Covered |
| Invoice lines | DEN-194 invoice line rows exist and reference orders/service items. | `supabase/seed.sql` `invoice_lines` rows | Billing reflection from chart orders. | Covered |
| Payments | DEN-194 approved payments exist for paid scenarios. | `supabase/seed.sql` `payments` rows | Paid/unpaid billing state demo. | Covered |
| Billing checkout session family | DEMO-DB-PR-005 seeds two paid checkout sessions, two invoice snapshots, and two payment allocation rows. | `supabase/seed.sql` `insert into public.billing_checkout_sessions`, `insert into public.billing_checkout_session_invoices`, `insert into public.payment_allocations`; migration `20260601093000_billing_guardian_checkout_hardening.sql` | Guardian-level checkout and payment allocation proof for Nabi card and Mango cash scenarios. | Billing checkout seed covered |
| Audit events | DEN-194 audit events exist for order and billing actions. | `supabase/seed.sql` `audit_events` rows | History/audit proof. | Covered |

## Readback Checklist

Run the SQL snippet after applying local migrations and seed:

```bash
npx supabase db reset --local
psql "${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}" \
  -v ON_ERROR_STOP=1 \
  -f supabase/snippets/demo_seed_inventory_readback.sql
```

The SQL returns one JSON object named `demo_seed_inventory_readback_contract`.

Pass criteria:

- `baselineFailureCount` is `0`.
- Every `coverage` item with `policy = "baseline_required"` has `status = "pass"`.
- `roleCoverage`, `orderTypeCoverage`, `fulfillmentQueueCoverage`, `labResultSheetCoverage`, `billingCheckoutCoverage`, `scenarioCoverage`, `invoiceIntegrity`, and `syntheticGuard` have only `pass` statuses.

Expected current gaps:

- `knownGapCount` is expected to be `0` after Demo DB PR 5.
- `coverage` rows for `order catalog items`, `order sets`, and `order_set_items` are expected to return `status = "pass"`.
- `coverage` row for `order_fulfillment_work_items` is expected to return `status = "pass"` with eleven deterministic seed rows.
- `coverage` rows for `lab_test_categories`, `lab_test_items`, and `order_catalog_lab_test_item_links` are expected to return `status = "pass"`.
- `coverage` row for `billing checkout session family` is expected to return `status = "pass"` with two deterministic paid checkout sessions.
- Any future `gap` row means a new seed family was intentionally added to the contract without seed coverage and should be scheduled before relying on that demo capability.

Failure interpretation:

- `fail` means the current baseline seed contract regressed and should be fixed before demo DB adoption continues.
- `gap` means the data family is known missing from the current seed and should be scheduled into a later PR.
- If the SQL itself cannot run because a table is missing, local migrations have not been applied or the migration set is incomplete.

## Demo Scenario Mapping

| Scenario Code | Seeded Proof | What It Demonstrates | Remaining Gap |
| --- | --- | --- | --- |
| `kong-vomit` | Guardian, patient, appointment, encounter, queue, SOAP, diagnosis, four orders, four fulfillment work items, CBC result-sheet catalog links, order events, invoice lines, unpaid invoice, audit event, four catalog rows, one compact set | Full outpatient flow from reception to chart orders, order set search, department queues, structured CBC result sheet foundation, and unpaid billing candidate. | UI still needs consistent API-backed read/write adoption. |
| `nabi-urinary` | Lab order, imaging order, two fulfillment work items, urinalysis result-sheet catalog links, result events, paid card invoice, card checkout session, payment allocation, audit event | Lab/imaging queue readback, structured urinalysis result sheet foundation, paid billing state, and guardian checkout allocation proof. | UI still needs consistent API-backed read/write adoption. |
| `bori-allergy` | Treatment order, dispensing order, two fulfillment work items, unpaid invoice, audit event | Treatment/dispensing completion and unpaid billing state. | UI still needs consistent API-backed read/write adoption. |
| `mango-wellness` | Preventive treatment order, one fulfillment work item, paid cash invoice, cash checkout session, payment allocation, audit event, wellness vaccine catalog row, one compact set | Simple wellness payment, preventive set search, completed treatment queue scenario, and cash checkout allocation proof. | UI still needs consistent API-backed read/write adoption. |
| `choco-rehab` | Imaging order, pending treatment order, two fulfillment work items, unpaid invoice, audit event | Imaging completion plus in-progress treatment queue state and follow-up billing context. | UI still needs consistent API-backed read/write adoption. |

## Confirmed Coverage

Current `supabase/seed.sql` contains seed inserts for:

- `auth.users`, `auth.identities`, `public.users`, `public.workspaces`, `public.user_memberships`, `public.permission_policies`
- `public.guardians`, `public.patients`, `public.patient_guardians`, `public.appointments`, `public.encounters`, `public.waiting_queue_entries`
- `public.service_categories`, `public.service_items`, `public.service_item_prices`, `public.soap_notes`, `public.diagnoses`
- `public.order_catalog_items`, `public.order_sets`, `public.order_set_items`
- `public.lab_test_categories`, `public.lab_test_items`, `public.order_catalog_lab_test_item_links`
- `public.order_groups`, `public.orders`, `public.order_events`, `public.order_fulfillment_work_items`
- `public.invoices`, `public.invoice_lines`, `public.payments`, `public.billing_checkout_sessions`, `public.billing_checkout_session_invoices`, `public.payment_allocations`, `public.audit_events`

The DEN-194 medium hospital seed contract also includes five scenario codes:

- `kong-vomit`
- `nabi-urinary`
- `bori-allergy`
- `mango-wellness`
- `choco-rehab`

## Confirmed Seed Gaps

No current seed-family gap is tracked by the readback SQL after Demo DB PR 5.

Remaining work is implementation adoption:

- Rewire visible mock/local-store screens to read seeded DB data through API/server boundaries.
- Add end-to-end demo flow tests that exercise login, reception, chart, fulfillment, lab result-sheet lookup, billing checkout, and audit readback.
- Keep payment provider, receipt, refund, settlement, production accounting, and remote Supabase replay approval-gated and out of the seed contract.

The readback SQL tracks `order_catalog_items`, `order_sets`, `order_set_items`, `order_fulfillment_work_items`, `lab_test_categories`, `lab_test_items`, `order_catalog_lab_test_item_links`, and billing checkout session family rows as baseline-required after Demo DB PR 5.

## UI Adoption Status

The seed contract remains fully covered after Demo DB PR 5. UI PR 1 and UI PR 2 do not add seed rows or schema changes; they prove that selected reception/chart/downstream surfaces and outpatient mutation routes can be exercised through existing API/server boundaries.

Covered by UI PR 1:

- Reception queue/calendar/profile lookup route calls are covered in a focused UI wiring spec.
- Chart live queue route adoption is covered in the chart side panel.
- Order action, fulfillment work-item status, result-review billing, guardian checkout, payment status, and audit readback routes are covered in the synthetic E2E route-boundary spec.

Covered by UI PR 2:

- Live lab fulfillment work items with empty result rows hydrate from the seeded CBC/urinalysis lab result-sheet catalog through a new API route.
- Lab result value entry crosses a local/dev server-boundary route and reports save state in the visible UI.
- Lab/imaging mock runtime appends API-only fulfillment work items instead of hiding unmatched live queue items.
- Treatment and dispensing fulfillment work-item transitions are included in the synthetic route-boundary test.
- Billing checkout route consumption and hospital-admin audit review route consumption are included in visible UI E2E coverage.

Remaining adoption work:

- Prefer Supabase-backed local/dev login and session replay for the `clair-demo` dataset.
- Design durable DB persistence for entered lab result values if result data should survive server restart and replay.
- Rewire dispensing/treatment execution and remaining billing invoice/list/detail store state to avoid mock-first visible state.
- Add a full browser E2E flow that drives visible UI controls end to end after those screens read/write the seeded DB consistently.

## Suggested Next PR

The next work should move from seed coverage to API-backed UI adoption:

Recommended options:

- Fulfillment/lab/dispensing/billing seeded read adoption, one module at a time.
- Supabase local/dev login replay for the `clair-demo` synthetic scenario.
- Full browser-level end-to-end synthetic demo flow over visible UI controls.
- Audit review UI hardening for the seeded/mutated demo path.

Keep payment provider, receipt, refund, settlement, and production accounting outside this demo seed scope.
