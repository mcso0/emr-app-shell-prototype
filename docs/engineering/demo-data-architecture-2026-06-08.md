# Demo Data Architecture

Updated: 2026-06-08

Scope: planning and architecture only. This document does not authorize remote Supabase changes, production data access, real hospital data import, payment integration, email delivery, provider integration, migration push, or RLS policy changes.

## Current State Summary

Demo DB PR 1 follow-up contract: `docs/engineering/data-model/demo-seed-inventory-readback-contract.md`.

CLAiR EMR is no longer only a static frontend mock. The repository already has a local/dev Supabase foundation: auth users, workspace, memberships, permission policies, reception records, customer records, chart notes, diagnoses, orders, invoices, payments, audit events, migrations, RLS helpers, and API routes.

The important gap is not "no database exists." The gap is that many screens still read `src/mocks/emr-domain.ts`, local Zustand state, `sessionStorage`, or `localStorage`, while the seeded Supabase data is only partially wired through API/RPC routes. For portfolio demonstration, "Real DB" should mean "synthetic demo data stored in local/dev Supabase and accessed through server/API boundaries," not real hospital or patient data.

The target architecture should therefore be called **Seeded Demo DB**:

- Synthetic only: no real clinic, staff, guardian, patient, billing, identity, or medical data.
- Local/dev only: use local Supabase reset/seed and optional dev/staging replay only after explicit approval.
- API-backed: screens read and mutate through existing Next.js API routes, server actions, or server-only gateways.
- Resettable: demo state can be rebuilt deterministically from seed data.
- Workspace-scoped: every demo EMR object belongs to `workspace_id = 'clair-demo'` or an explicitly synthetic isolation workspace.

Current evidence:

- `docs/engineering/current-status.md` says local-first DB/RLS/persistence foundations exist, while remote Supabase validation and production/live readiness are incomplete.
- `docs/engineering/architecture/mock-live-boundary-map.md` defines mock/session-only, local-first, remote staging, and production/live boundaries.
- `supabase/seed.sql` already seeds synthetic auth/workspace/users, reception, customer, clinical, billing, audit, and medium-hospital demo data.
- `src/app/api/**/route.ts` contains route boundaries for workspace, auth, reception, chart, fulfillment, billing, customer, hospital admin, and audit.
- `src/mocks/emr-domain.ts` and multiple feature stores/modules still drive many visible screens directly.

## Mock vs Seeded Demo DB Matrix

| Area | Current Data Source | Desired Demo Data Source | Evidence Files | Status | Risk |
| --- | --- | --- | --- | --- | --- |
| Auth / demo users | Mixed. Mock login uses browser storage; Supabase auth is available when configured. `supabase/seed.sql` seeds local `auth.users`, `auth.identities`, and app `users`. | Seeded local/dev Supabase auth users with fixed demo emails and password, read through Supabase cookie claims. Keep mock login only as explicit fallback. | `src/features/auth/mock-session.ts`, `src/features/auth/session-store.ts`, `src/features/auth/auth-client.ts`, `src/lib/supabase/config.ts`, `supabase/seed.sql` | Partially seeded and partially wired. | Mock mode can hide auth/RLS defects if demo users keep entering through `x-clair-demo-session-user-id`. |
| Workspace / hospital | `clair-demo` exists in mock paths and in Supabase seed. Workspace display can fall back to browser state. | `public.workspaces` as the workspace source, with `clair-demo` seeded as the portfolio hospital. | `src/features/auth/workspace-session.ts`, `src/features/auth/workspace-display.ts`, `src/app/api/workspaces/route.ts`, `supabase/migrations/20260518023715_workspace_auth_schema_foundation.sql`, `supabase/seed.sql` | Seeded DB exists; UI fallback remains. | Browser-state workspace names may diverge from DB. |
| Membership / roles / permissions | Permission resolver exists. Mock adapters are defaults in many server cores when no Supabase gateway is supplied. Supabase seed includes memberships and permission policies. | `public.user_memberships` and `public.permission_policies` loaded through `loadWorkspacePermissionAdapterFromDb` for all demo API-backed routes. | `src/features/auth/permission-resolver.ts`, `src/features/auth/db-workspace-permission-adapter-core.ts`, `src/features/auth/supabase-workspace-permission-gateway-core.ts`, `supabase/seed.sql` | Strong foundation, incomplete adoption. | Default mock permission adapters can make a route look secure before it is fully DB-backed. |
| Client / patient | Customer and reception screens still import `mockGuardians`, `mockPatients`, `mockPatientGuardians`, and related mock arrays in several places. Customer profile API/server cores also have Supabase gateway paths and mock gateway defaults. | `public.guardians`, `public.patients`, `public.patient_guardians`, `public.consents`, customer delta tables, and API-backed profile/search reads. | `src/features/customer/data.ts`, `src/features/reception/data.ts`, `src/features/customer/server-guardian-profile-core.ts`, `src/features/customer/server-patient-profile-core.ts`, `supabase/migrations/20260519090000_reception_domain_schema_foundation.sql`, `supabase/migrations/20260520140000_customer_management_schema_delta.sql`, `supabase/seed.sql` | Seeded and API-capable, with visible mock reads still present. | Profile drawer/search can show mock records that do not match seeded DB records. |
| Appointment / reception | Reception screen data still joins mocks and local persisted drafts. API routes exist for lookup, registration, walk-in encounter, check-in, queue, and day calendar. Seed includes appointments, encounters, and waiting queue entries. UI PR 1 adds first-pass profile hydration from the reception patient/guardian lookup API and keeps queue/calendar route reads active. | Reception list/calendar/detail should read `appointments`, `encounters`, `waiting_queue_entries`, `guardians`, `patients` through existing reception API routes. | `src/features/reception/data.ts`, `src/features/reception/module.tsx`, `src/features/reception/patient-profile-store.ts`, `src/features/reception/server-reception-queue-read-core.ts`, `src/features/reception/server-reception-calendar-read-core.ts`, `src/app/api/workspaces/[workspaceId]/reception/**/route.ts`, `supabase/seed.sql` | API read adoption started. | Current UI can still fall back to mock or local draft records when route reads are loading, unavailable, or running without a Supabase-backed session. |
| Visit / encounter / chart | Chart server routes exist for SOAP, diagnoses, completion, order drafts, order actions, lifecycle, live queue, and result-review billing. UI PR 1 makes the chart side panel call the live-queue route in both Supabase and mock-session modes, with route-level E2E coverage for order action, fulfillment, billing, payment, and audit boundaries. | Chart should load encounter spine from DB and use API routes for SOAP, diagnosis, draft orders, confirmation, lifecycle, and completion. | `src/features/chart/module.tsx`, `src/features/chart/server-soap-note-persistence-core.ts`, `src/features/chart/server-diagnosis-persistence-core.ts`, `src/features/chart/server-order-draft-persistence-core.ts`, `src/features/chart/server-order-action-persistence-core.ts`, `src/app/api/workspaces/[workspaceId]/chart/**/route.ts`, `tests/ui-demo-api-wiring-e2e.spec.ts`, `supabase/seed.sql` | API read/write boundary adoption started. | Full seeded Supabase replay still depends on local Supabase auth/session configuration; mock route gateways remain available for Sales Demo regression. |
| Order / order_item | Current schema uses `service_items`, `service_item_prices`, `order_catalog_items`, `order_sets`, `order_set_items`, `orders`, `order_groups`, and invoice lines. Mock data has service/order arrays. | Seeded `order_catalog_items` for admin/search and encounter-owned `orders` for applied chart rows; preserve snapshot fields when chart orders are confirmed. | `src/mocks/emr-domain.ts`, `src/features/hospital-admin/server-order-catalog-core.ts`, `src/features/chart/server-order-action-persistence-core.ts`, `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`, `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql`, `supabase/seed.sql` | Schema exists; seed has service items/orders, but order catalog seed coverage should be expanded. | "Order item" terminology can drift unless mapped to actual tables. |
| Fulfillment work item / task queue | Fulfillment API/RPC foundation exists. Lab/imaging and dispensing/treatment screens call fulfillment routes for queue status in some paths, but also retain mock staff and local screen state. Demo DB PR 3 seeds eleven deterministic `order_fulfillment_work_items` rows for DEN-194 orders. | Read seeded `public.order_fulfillment_work_items` through lab/imaging/dispensing/treatment queue routes, then later wire remaining screen state to API mutations. | `src/features/fulfillment/server-fulfillment-work-item-core.ts`, `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/**/route.ts`, `src/features/lab-imaging/module.tsx`, `src/features/dispensing/module.tsx`, `supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql`, `supabase/seed.sql` | Seed foundation covered; screen adoption still needs completion. | Queue rows now survive reset, but UI may still mix seeded data with mock staff/local state. |
| Lab / imaging | Visible workspaces exist. Mock lab results, imaging studies, attachments, and equipment receipts remain in `src/mocks/emr-domain.ts` and feature data files. DB has orders, order events, fulfillment work items, and Demo DB PR 4 seeds CBC/urinalysis result-sheet catalog/link rows. | Seed order/fulfillment/event/result-sheet catalog rows for demo queues now; add explicit synthetic result values/study persistence only after a scoped data-model decision. | `src/features/lab-imaging/data.ts`, `src/features/lab-imaging/module.tsx`, `src/mocks/emr-domain.ts`, `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql`, `supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql`, `supabase/seed.sql` | Queue and result-sheet catalog seed foundation exists; result artifacts remain mostly mock. | Overclaim risk: lab/imaging result values and imaging study storage are not fully live-persisted. |
| Dispensing / treatment | Dispensing/treatment screen calls fulfillment routes in selected paths and uses mock staff/users. Mock order data still exists. | Seed fulfillment work items for dispensing and treatment, then use API mutation for status changes and downstream billing/lifecycle sync. | `src/features/dispensing/module.tsx`, `src/features/fulfillment/server-fulfillment-work-item-core.ts`, `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]/route.ts`, `supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql` | Good second-wave API-backed demo candidate after reception/chart spine. | Treatment/dispensing share phase-1 permissions; controlled-substance workflows are explicitly out of scope. |
| Billing / invoice / payment | Billing store initializes from `mockInvoices`, `mockInvoiceLines`, and `mockPayments`. Server routes/RPCs exist for invoice candidates, invoice lines, payment status, and guardian checkout. Demo DB PR 5 seeds invoices, invoice lines, payments, checkout sessions, checkout invoice snapshots, payment allocations, and audit events. | Billing screen should read invoices/lines/payments/checkout sessions from Supabase through billing API routes, with synthetic payments only. | `src/features/billing/store.ts`, `src/features/billing/server-invoice-candidate-sync-core.ts`, `src/features/billing/server-invoice-line-persistence-core.ts`, `src/features/billing/server-payment-status-persistence-core.ts`, `src/features/billing/server-guardian-checkout-core.ts`, `src/app/api/workspaces/[workspaceId]/billing/**/route.ts`, `supabase/seed.sql` | Strong seed/API foundation; visible store still mock-first. | Amount-integrity demos are weak if UI mutates local store instead of server recalculation. |
| Audit log / history | Audit append/review APIs exist. Mock audit review events and legacy mock audit logs remain. Seed includes synthetic `audit_events`. | Audit review surface should use `public.audit_events` through `clair_list_audit_events`; mutation routes should append synthetic audit events. | `src/features/audit/server-audit-log-persistence-core.ts`, `src/features/audit/server-audit-event-review-core.ts`, `src/app/api/workspaces/[workspaceId]/audit/events/route.ts`, `supabase/migrations/20260520120000_live_mvp_audit_events.sql`, `supabase/seed.sql` | Foundation exists; mock review fallback remains. | Audit may look complete while some screens still mutate local-only state. |
| Home / operational dashboard | Current status says session-only mock data. Home modules use mock home data and role widgets. | Read a compact seeded DB snapshot: today's appointments, active encounters, queue counts, unpaid invoices, pending fulfillment items, and recent audit events. | `src/features/home/home.mock.ts`, `src/features/home/module.tsx`, `docs/engineering/current-status.md` | Mock/session-only. | Home may be the first screen but should not be first DB migration target because it depends on many downstream entities. |
| Inpatient | Current status says session-only ward board. Inpatient has its own mock admissions data. | Leave mock for portfolio phase unless an inpatient DB scope is explicitly approved. | `src/features/inpatient/data.ts`, `docs/engineering/current-status.md` | Mock/session-only. | Pulling inpatient into seeded DB would expand scope without improving the outpatient portfolio proof. |

## Demo Hospital Scenario

Use one synthetic hospital day for `clair-demo`: **CLAiR Medium Animal Hospital**, a small multi-role veterinary clinic operating reception, charting, lab/imaging, dispensing/treatment, billing, and audit review.

Recommended demo day:

1. Morning setup: hospital admin logs in, confirms workspace members and role permissions.
2. 09:30 appointment: "Kong Synthetic" arrives for vomiting/diarrhea. Reception checks in, vet opens chart, adds SOAP/diagnosis, confirms lab, imaging, treatment, and dispensing orders.
3. Lab/imaging handoff: technician sees CBC and abdominal ultrasound work items, moves them through accepted/in-progress/completed.
4. Treatment/dispensing handoff: technician completes fluid therapy and dispensing work items.
5. Chart readback: vet sees order lifecycle/result markers and requests billing.
6. Billing: front desk reviews invoice lines, leaves Kong unpaid as a follow-up case or marks a separate case paid.
7. Midday secondary case: "Nabi Synthetic" walk-in demonstrates cat-friendly reception, lab/imaging completion, and paid invoice.
8. Revisit case: "Bori Synthetic" demonstrates repeat customer/profile context and unpaid invoice review.
9. Wellness case: "Mango Synthetic" demonstrates lower-risk vaccine/wellness flow and completed cash payment.
10. Rehab case: "Choco Synthetic" demonstrates pending treatment/rehab work that remains visible in task queues.
11. Audit review: hospital admin opens audit events and sees order confirmation, invoice issue, payment state changes, and pending rehab order history.

This scenario is portfolio-safe because it uses fictional names, deterministic IDs, `.local`/`.test` emails, masked placeholder identifiers, synthetic prices, and no clinical accuracy claims.

## Required Seed Data

| Entity | Example Count | Purpose | Required Fields | Related Tables |
| --- | --- | --- | --- | --- |
| Auth users | 6-10 active users plus 2 negative-test users | Login and role switching in local/dev Supabase | `id`, `email`, confirmed password identity, display metadata | `auth.users`, `auth.identities`, `public.users` |
| Workspace | 1 primary demo workspace plus 1 isolation workspace | Tenant boundary and cross-tenant denial demo | `id`, `display_name`, `status`, `created_by_user_id` | `public.workspaces` |
| Memberships | 1 hospital admin, 2 vets, 3 technicians, 2 front desk, 1 inactive | Role and permission proof | `workspace_id`, `user_id`, `roles`, `status`, `department`, `title` | `public.user_memberships` |
| Permission policies | 4 role policies | Server permission resolver data | `workspace_id`, `scope`, `target_role`, `permissions.allowed` | `public.permission_policies` |
| Guardians | 8-12 | Search, registration, profile, billing owner, duplicate review | `workspace_id`, `name`, normalized phone, synthetic email, code, masked tax/cash fields, memo | `public.guardians`, `public.guardian_referral_sources` |
| Patients | 12-15 | Patient search, chart context, status labels, multi-species demo | `workspace_id`, `patient_no`, `name`, species, breed, sex, neuter status, weight, status, handling notes, synthetic identifiers | `public.patients` |
| Patient-guardian links | 12-16 | Relationship model and multi-patient guardian demo | `patient_id`, `guardian_id`, relationship, primary flag, message consent | `public.patient_guardians` |
| Consents | 5-10 | Registration/profile consent proof | `guardian_id`, `patient_id`, `consent_type`, `status`, `source_surface`, document version | `public.consents` |
| Appointments | 3-6 for the demo day | Reception calendar and check-in | patient, guardian, assigned vet, scheduled times, purpose, symptom note, status | `public.appointments` |
| Encounters | 5 active/completed cases | Outpatient workflow spine | patient, guardian, appointment, vet, encounter no, type, department, chief complaint, status, timestamps | `public.encounters` |
| Waiting queue entries | 5-8 | Reception, billing, and work queue visibility | encounter, queue type, status, priority, sort order, entered/finished times | `public.waiting_queue_entries` |
| Service categories | 3-5 | Order catalog grouping | workspace, parent, name, sort order | `public.service_categories` |
| Service items / order catalog items | 20-40 | Chart order search and hospital-admin proof | name, item/order type, destination, billable flag, active flag, price linkage, species/routing metadata | `public.service_items`, `public.service_item_prices`, `public.order_catalog_items` |
| Order sets | 3-5 sets | Realistic hospital-admin Order 세트 and chart search | set name, category, amount basis, active status, child rows | `public.order_sets`, `public.order_set_items` |
| Lab test items | 20-40 result fields | Lab result-sheet structure and delete locks | category, item name, input type, unit, sort order, linkage | `public.lab_test_categories`, `public.lab_test_items`, `public.order_catalog_lab_test_item_links` |
| SOAP notes | 5 | Chart proof and signed/autosaved states | encounter, author, S/O/A/P text, status, autosaved/signed time | `public.soap_notes` |
| Diagnoses | 5-10 | Chart diagnosis panel and billing context | encounter, text, type, primary flag, author/updater | `public.diagnoses`, optional `public.diagnosis_catalog` |
| Order groups | 5 | Encounter order grouping | encounter, group type, title, status, priority | `public.order_groups` |
| Orders | 10-16 encounter-owned orders | Chart-to-fulfillment-to-billing flow | encounter, group, service item/catalog snapshot, type, display/billing names, status, work status, quantity, price, assignee, timestamps | `public.orders`, `public.order_events` |
| Fulfillment work items | 8-12 | Lab/imaging/dispensing/treatment queues | workspace, encounter, order, queue type, status, assignee, priority, source snapshot, timestamps | `public.order_fulfillment_work_items` |
| Lab/imaging result markers | 5-8 now, explicit tables later | Result readback without provider integration | order event payload, source snapshot, result/study marker, synthetic attachment reference | `public.order_events`, future result tables if scoped |
| Invoices | 5 | Billing queue and paid/unpaid states | encounter, guardian, invoice no, status, payment state, totals, timestamps | `public.invoices` |
| Invoice lines | 10-16 | Amount integrity and order-to-billing trace | invoice, service item, order, description, quantity, unit price, discount | `public.invoice_lines` |
| Payments | 2-4 synthetic payment records | Paid-state demo without provider confirmation | invoice, method, amount, status, paid time, synthetic metadata | `public.payments` |
| Billing checkout session | 1-2 optional | Combined guardian checkout demo after route adoption | guardian, selected invoices, totals, adjustment state | `public.billing_checkout_sessions`, `public.billing_checkout_session_invoices`, `public.payment_allocations` |
| Audit events | 8-15 | Change history and safety proof | workspace, actor, target, encounter/patient/guardian links, event type, before/after, metadata | `public.audit_events` |

## Recommended Demo Users

Use deterministic local/dev accounts only. Passwords should remain local seed values, never production credentials.

| Demo User | Email | Role(s) | Demo Purpose |
| --- | --- | --- | --- |
| 송민재 | `admin@clair.local` | `hospital_admin` | Workspace, membership, permission, audit, hospital-admin order catalog review |
| 이수지 | `vet@clair.local` | `vet` | Primary chart author, SOAP/diagnosis/order confirmation |
| DEN-194 Vet Internal | `vet2@clair.local` | `vet` | Internal medicine cases such as Kong and Bori |
| DEN-194 Vet Surgery | `vet3@clair.local` | `vet` | Wellness/rehab/surgery-adjacent demo cases |
| 송하윤 | `technician@clair.local` | `technician` | General lab/imaging/dispensing/treatment completion |
| DEN-194 Lab Tech | `tech2@clair.local` | `technician` | Lab queue ownership |
| DEN-194 Imaging Tech | `tech3@clair.local` | `technician` | Imaging queue ownership |
| DEN-194 Treatment Tech | `tech4@clair.local` | `technician` | Treatment and dispensing queue ownership |
| 최유나 | `front-desk@clair.local` | `front_desk` | Reception, check-in, customer profile, billing |
| DEN-194 Reception Billing | `front-desk2@clair.local` | `front_desk` | Billing-focused front desk workflow |
| DEN-194 Reception Triage | `front-desk3@clair.local` | `front_desk` | Reception and triage workflow |
| Foreign Admin | `foreign-admin@clair.local` | `hospital_admin` in `clair-foreign-demo` | Cross-tenant denial testing |
| No Membership Actor | `no-membership@clair.local` | none | Unauthorized access testing |

## Recommended Order Flow Demo

Minimum seeded-demo flow:

1. Login as `vet2@clair.local` or `vet@clair.local`.
2. Open `clair-demo` reception queue and select the Kong encounter.
3. Open chart and read seeded SOAP/diagnosis context.
4. Add or confirm a small set of orders:
   - CBC lab order
   - Abdominal ultrasound imaging order
   - Fluid therapy treatment order
   - Dispensing order
5. `PATCH /api/workspaces/[workspaceId]/chart/order-actions` confirms selected orders. In Supabase mode this should call the chart order action RPC and then sync fulfillment work items and billing candidates where applicable.
6. Lab/imaging/dispensing/treatment screens read `GET /api/workspaces/[workspaceId]/fulfillment/work-items?queueType=...`.
7. Technician updates each work item with `PATCH /api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]`.
8. Fulfillment completion syncs chart lifecycle and, where billing reflection is enabled, billing candidates.
9. Billing screen reads invoice candidates, invoice lines, and payment status from billing API routes.
10. Front desk marks one invoice paid with synthetic payment state or leaves it unpaid for review.
11. Audit screen reads mutation history from `GET /api/workspaces/[workspaceId]/audit/events`.

Implementation note: the seed should include both "already completed" cases for immediate demo screens and one "pending/in-progress" case for live mutation during the presentation.

## Implementation Roadmap

Sequence adjustment on 2026-06-09: actual Demo DB PR 2 is **Order Catalog & Order Set Seed Foundation**, Demo DB PR 3 is **Fulfillment Work Item Seed Foundation**, Demo DB PR 4 is **Lab Result-Sheet Catalog Seed Foundation**, and Demo DB PR 5 is **Billing Checkout Session Family Seed Foundation**. The earlier auth/workspace read-adoption row remains a later candidate and should be renumbered during the next planning pass.

| PR | Scope | Out Of Scope | Verification |
| --- | --- | --- | --- |
| Demo DB PR 1: seed inventory and readback contract | Normalize local/dev seed naming, document scenario IDs, add SQL readback checks for auth/workspace/reception/chart/billing/audit seed presence. No UI changes. | No new remote Supabase operation, no production data, no UI rewiring. | `npm run docs:check`, `npm run security:secrets`, focused SQL/static seed checks. |
| Demo DB PR 2: Order catalog and order set seed foundation | Seed deterministic `order_catalog_items`, two compact `order_sets`, and included `order_set_items` for `clair-demo`; move catalog/set readback from gap to baseline. | No UI rewiring, no fulfillment work item seed, no lab result-sheet seed. | Focused demo seed inventory spec, docs check, secret scan, local readback when available. |
| Demo DB PR 3: Fulfillment work item seed foundation | Seed deterministic `order_fulfillment_work_items` for lab, imaging, dispensing, and treatment queues across the five DEN-194 scenarios; move fulfillment readback from gap to baseline. | No UI rewiring, no lab result-sheet seed, no billing checkout session seed. | Focused demo seed inventory spec, docs check, secret scan, local readback when available. |
| Demo DB PR 4: Lab result-sheet catalog seed foundation | Seed deterministic `lab_test_categories`, `lab_test_items`, and `order_catalog_lab_test_item_links` for CBC and urinalysis result-sheet structure; move lab catalog readback from gap to baseline. | No UI rewiring, no result value persistence, no imaging study persistence, no billing checkout session seed. | Focused demo seed inventory spec, docs check, secret scan, local readback when available. |
| Demo DB PR 5: Billing checkout session family seed foundation | Seed deterministic `billing_checkout_sessions`, `billing_checkout_session_invoices`, and `payment_allocations` for paid Nabi and Mango scenarios; move checkout readback from gap to baseline. | No UI rewiring, no payment provider, no receipt/refund/settlement/accounting integration. | Focused demo seed inventory spec, billing checkout specs, docs check, secret scan, local readback when available. |
| UI PR 1: Reception/chart API wiring and E2E route-boundary proof | Hydrate reception patient/guardian profiles through the existing lookup route, load chart queue through the chart live-queue route, and add a focused E2E test for reception, chart order confirmation, fulfillment completion, result-review billing, checkout/payment status, and audit readback. | No seed expansion, no schema change, no UI redesign, no remote Supabase or production DB work. | `tests/ui-demo-api-wiring-e2e.spec.ts`, focused seed readback contract spec, docs check, secret scan. |
| Demo DB PR 2: Auth/workspace Supabase demo entry | Make Supabase local/dev login the preferred demo path; keep mock fallback explicit. Verify workspace list and membership policy reads. | No role policy change beyond seeded demo policies. No production auth. | Auth/workspace server specs, route permission specs, local Supabase reset/readback. |
| Demo DB PR 3: Reception seeded read adoption | Connect reception queue/calendar/search to API-backed seeded DB reads while preserving mock fallback only behind explicit mode. | No broad chart/billing UI refactor. | Reception server specs, reception Playwright smoke, seed readback. |
| Demo DB PR 4: Customer/profile seeded read adoption | Connect guardian/patient profile and relationship surfaces to customer API reads/writes. | No real customer data import. | Customer server specs, profile/relationship tests, cross-tenant denial checks. |
| Demo DB PR 5: Chart seeded spine | Ensure chart loads encounter, SOAP, diagnosis, draft/order action/lifecycle data from API/RPC for seeded cases. | No provider integrations, no clinical safety claims. | Chart server specs, chart Playwright, order action persistence specs. |
| Demo DB PR 6: Fulfillment queue UI adoption | Make queue screens consistently read API-backed seeded work items and persist status updates through fulfillment routes. | No full lab result/PACS/device persistence; no new seed breadth beyond the PR 3 deterministic rows unless separately scoped. | Fulfillment server specs, `tests/fulfillment-handoff-replay.spec.ts`, queue Playwright specs. |
| Demo DB PR 7: Billing seeded read/write adoption | Make billing invoice candidates, lines, payment status, and optional guardian checkout read/write through API-backed seeded DB data. | No payment provider, receipt, refund, settlement, or real accounting. | Billing server specs, amount-integrity tests, billing Playwright. |
| Demo DB PR 8: Audit demo closeout | Ensure mutation flows append audit events and audit review reads seeded/mutated events. | No compliance certification claim. | Audit server specs, launch/audit matrix specs, docs check. |
| Demo DB PR 9: Home dashboard snapshot | Build a read-only seeded DB dashboard summary after dependent modules are stable. | No new canonical workflow truth. | Home Playwright plus API-backed snapshot tests. |

## Suggested First PR

Start with **Demo DB PR 1: seed inventory and readback contract**.

Why this PR should be first:

- The seed already exists and is non-trivial, but the repository does not yet have one concise engineering contract that says which seeded records prove which demo workflow.
- It avoids risky UI rewiring before the team agrees on the deterministic demo spine.
- It can verify the local/dev Supabase baseline without touching remote Supabase or production.
- It gives every later screen PR a stable target: specific users, workspace, patients, encounters, orders, invoices, payments, and audit events.
- It reduces overclaim risk by separating "seed exists" from "screen is API-backed."

Suggested PR 1 deliverables:

- Add a seed inventory/readback checklist for `supabase/seed.sql`.
- Add one SQL snippet or test helper that checks required seeded entity counts by `workspace_id = 'clair-demo'`.
- Confirm the target demo accounts and scenario IDs are stable.
- Record explicit gaps: fulfillment work item seed breadth, lab/imaging result persistence, billing store mock-first behavior, home/inpatient mock-only surfaces.

Suggested first implementation boundary: local/dev only. No remote Supabase, no migration push, no production deploy, and no real data.
