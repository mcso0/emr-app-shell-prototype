---
id: ENGINEERING-ARCHITECTURE-REFERENCE-PROJECT-ADOPTION-PLAN
type: Architecture Reference
title: "Reference Project Adoption Plan"
description: "Compares external SaaS, veterinary PIMS, scheduling, and payment references against CLAiR EMR boundaries."
status: draft
area: engineering
doc_type: architecture-reference
tags: [reference-projects, saas, veterinary-pims, scheduling, payments, korea-pg, stabilization]
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-06-18
---

# Reference Project Adoption Plan

This document turns external GitHub and SaaS starter references into a bounded adoption plan for CLAiR EMR. It is not permission to rewrite the app, copy incompatible code, run remote provider setup, or change production/live boundaries.

## Current CLAiR Fit

CLAiR EMR is already a Next.js 16, React 19, Supabase, shadcn/Tailwind, Playwright, and local-first veterinary EMR prototype. The project has many visible workflows and local-first server/API/Supabase foundations. The recurring risk is not a missing starter kit. The recurring risk is that several complex concerns are being advanced at once:

- `auth / tenant / permission`: login, workspace membership, role union, server permission checks, RLS, audit, and mock fallback.
- `queue / appointment / calendar`: reception queue, walk-in, appointment state, encounter handoff, and calendar display/write boundaries.
- `chart / order / billing`: SOAP, order draft/confirmation, fulfillment handoff, invoice candidates, checkout state, payment state, audit, and amount integrity.

Use external projects to compare patterns and constrain the next PRs, not to replace existing CLAiR contracts.

## Current Repo Evidence

The current codebase already has several production-shaped foundations that should be reused before adding new vendors:

| Area | Current evidence | Planning implication |
| --- | --- | --- |
| Framework and UI | `package.json` uses Next.js 16, React 19, Tailwind/shadcn-oriented dependencies, Storybook 10, Playwright, and Vitest. | Do not add another full SaaS boilerplate or component system. Borrow patterns only. |
| Supabase auth/data | `@supabase/ssr`, `@supabase/supabase-js`, `src/lib/supabase/*`, auth/workspace routes, migrations, RLS/RPC work, and seed checks already exist. | Supabase remains the default platform. Strengthen local replay, RLS, and route permissions instead of replacing auth with Clerk/Auth.js. |
| Local state | Zustand is already used for UI/session stores across modules. TanStack Table/Virtual is installed, but TanStack Query is not. | Keep Zustand for local UI state. Consider TanStack Query only for repeated API read loading/retry/cache state after a scoped work item. |
| Seed-backed demo | `docs/engineering/data-model/demo-seed-inventory-readback-contract.md` and `docs/engineering/testing/api-backed-demo-runbook.md` define the local/dev synthetic proof. | External tools must serve the seed-backed demo plan, not bypass it with provider sandboxes or unrelated mock data. |
| Providers | No Trigger.dev, Novu, PostHog, Toss, PortOne, Stripe, Clerk, Auth.js, or Cal.com packages are installed. Resend is called through a gated fetch path, not as an installed SDK. | Treat these as future integrations behind adapters and approval gates, not current assumptions. |

## Reference Set

| Reference | Primary use | License / copy posture | Fit for CLAiR |
| --- | --- | --- | --- |
| [NextBase](https://github.com/imbhargav5/nextbase-nextjs-supabase-starter) | Supabase SaaS foundation, SSR auth, RLS migrations/tests, data-access separation, Playwright/Vitest discipline | MIT. Small patterns may be adapted with attribution/license preservation where needed. | Best technical fit: Next.js 16, React 19, Supabase, RLS, shadcn/Tailwind, Playwright. Do not adopt its whole monorepo or new packages without a work item. |
| [OpenVPM](https://github.com/evangauer/openvpm) | Veterinary PIMS domain reference: clients, patients, appointments, SOAP, billing, inventory, API-first shape | GitHub marks AGPL-3.0. Do not copy code into CLAiR. Use only product/domain and workflow ideas unless legal approval says otherwise. | Best domain fit. Useful for checking veterinary workflow assumptions and API nouns. |
| [Cal.diy](https://github.com/calcom/cal.diy) | Scheduling, booking, availability, calendar integration, time-slot UX, self-hosted scheduling infrastructure | MIT, but the README warns it is a self-hosted community edition and recommends commercial/enterprise scheduling use cases use Cal.com. Copy only small isolated patterns after review. | Strong reference for appointment/calendar UX and availability constraints. Too large to import. |
| [Vercel Stripe & Supabase SaaS Starter Kit](https://vercel.com/templates/next.js/stripe-supabase-saas-starter-kit) / [repo](https://github.com/dzlau/stripe-supabase-saas-template) | SaaS checkout/subscription flow, dashboard protection, Stripe webhook shape, Vercel deployment notes | GitHub API did not show a clear license on 2026-06-17. Do not copy code. | Useful billing/subscription flow reference only. Stack is older Next 14/React 18 and Drizzle-centric, so it does not match CLAiR directly. |
| [Next.js SaaS Starter](https://github.com/nextjs/saas-starter) | Official Next.js SaaS example: dashboard, basic RBAC, activity logs, middleware, Stripe portal/webhook flow | MIT. Small patterns may be adapted. | Useful for activity logging and route/action protection concepts. Payment stack is Stripe-first, so Korea payment use is not directly applicable. |
| [Razikus Supabase Next.js Template](https://github.com/Razikus/supabase-nextjs-template) | Supabase auth, user management, storage, task demos, RLS policy examples | Apache-2.0. Small patterns may be adapted with notice preservation. | Secondary Supabase reference if NextBase is too opinionated for a specific PR. |
| [ixartz SaaS Boilerplate](https://github.com/ixartz/SaaS-Boilerplate) | Multi-tenancy, roles/permissions, logging, testing, SaaS operations | MIT. Small patterns may be adapted. | Useful as a secondary architecture comparison. Stack differs from CLAiR because it is not Supabase-first. |

## General SaaS Tooling Input

The user-supplied SaaS tooling summary is useful as a broad-market checklist for fast SaaS prototyping. In CLAiR, treat it as category guidance, not as dependency approval or permission to replace current architecture.

| Category | Tools mentioned | CLAiR interpretation |
| --- | --- | --- |
| Boilerplate and full-stack framework | Next.js, ShipFast / Next.js SaaS Boilerplate, Supabase, Firebase | Next.js and Supabase are already core CLAiR choices. Use SaaS boilerplates as comparison references only. Do not add Firebase or replace the current Supabase/server/API/RLS direction without a scoped architecture decision. |
| Payments and subscriptions | Stripe, RevenueCat | Stripe is a lifecycle and webhook reference, not the Korea-default provider. RevenueCat applies mainly to mobile in-app subscriptions and is not a fit for current web-based clinic billing. For Korea, keep Toss Payments direct and PortOne as the priority candidates. |
| Authentication | Clerk, NextAuth.js / Auth.js | Useful references for onboarding speed and session UX, but CLAiR should not replace its current Supabase/auth/workspace/permission boundaries without a separate work item and approval. Server-side permission and RLS remain more important than auth UI convenience. |
| UI and styling | Tailwind CSS, shadcn/ui, Chakra UI, Ant Design | Tailwind and shadcn/ui already match the project direction. Chakra UI and Ant Design may be used as UX references, but do not mix in a second component system without an approved design-system migration. |
| Data fetching and state management | TanStack Query, Zustand | TanStack Query can be considered for route/API read state only if it reduces repeated loading, retry, and cache logic. Zustand is appropriate for local UI/session state, not for canonical clinical, billing, permission, or payment truth. |
| Onboarding and analytics | Driver.js, PostHog, Mixpanel | Product tours and analytics can help after the core demo paths stabilize. External analytics is approval-gated when it can expose patient, guardian, hospital, identity, payment, or behavior data; use synthetic/demo data and privacy review first. |
| AI and modern infrastructure | AI-assisted prototyping and integration workflow | AI can speed up comparison, scaffolding, and draft implementation, but generated code and recommendations remain untrusted until checked against CLAiR source docs, licenses, provider constraints, tests, and manual QA. |

## Adoption Decision Matrix

This matrix is the current planning stance for using external libraries, plugins, services, or reference projects to accelerate the core SaaS/EMR demo.

| Candidate | Decision | Use for | Do not use for |
| --- | --- | --- | --- |
| Supabase local/Auth/RLS | Adopt directly; already core. | Auth session, workspace membership, local/dev/test seed replay, RLS, RPCs, API-backed demo readback. | Bypassing server permission checks or treating local validation as production/live readiness. |
| NextBase / Supabase SaaS starters | Pattern-only unless a PR scopes a small MIT-compatible extraction. | SSR client separation, protected route conventions, migration/RLS test discipline, data-access naming. | Replacing the existing repo structure, auth model, domain contracts, or Storybook/design system. |
| OpenVPM | Domain reference only. | Veterinary PIMS nouns, appointment-to-visit flow, SOAP/order/billing/inventory coverage checks. | Code copying, because the repository is AGPL-3.0. |
| Cal.com / Cal.diy | Defer internal adoption; use as scheduling reference. | Availability, booking-state, conflict, timezone, and optional public booking embed ideas. | Replacing CLAiR's reception queue, encounter state, or internal appointment workflow. |
| Trigger.dev | Candidate later, behind a work item. | Background jobs, retries, reminders, demo reset/replay tasks, webhook post-processing. | Canonical clinical workflow state or payment truth. |
| Resend | Candidate later; invite delivery path already has a gate. | Transactional invitation email after staging/live approval and secret setup. | Real email delivery by default, storing secrets in repo, or sending patient/guardian communications without approval. |
| Novu | Candidate later for notification orchestration. | Multi-channel notification workflow modeling and in-app notification feeds after privacy review. | Replacing internal audit, clinical state, or sending real Kakao/SMS/email by default. |
| PostHog / Mixpanel | Candidate later for product analytics. | Synthetic demo funnel analysis, organization-level activation metrics, QA telemetry after privacy review. | Capturing patient/guardian/medical/payment data or enabling paid analytics without approval. |
| HubSpot / Attio | Defer; external business CRM only. | Sales pipeline and clinic prospect management outside EMR PHI/clinical records. | Patient/guardian CRM, medical record truth, or clinic operational workflow state. |
| Toss Payments direct | Priority Korea payment provider candidate. | First Korea-local provider integration behind a provider-neutral payment adapter. | Direct card handling, live captures/refunds, or credentials without explicit approval. |
| PortOne | Priority Korea payment abstraction candidate. | PG portability across Korean payment providers if business needs provider switching. | Adding abstraction before the billing/payment domain boundary is stable. |
| Stripe | Reference only for Korea-first plan. | Lifecycle concepts: checkout, webhook idempotency, billing portal, subscriptions. | Default Korea provider for a Korea-registered CLAiR business. |

## Core Feature Adoption Blueprint

Use this blueprint when turning the reference plan into PR-sized work. Each row names the fastest safe path for the current seed-backed demo target without rebuilding the app from a starter.

| Product capability | Current CLAiR anchor | External leverage | Recommended design |
| --- | --- | --- | --- |
| Login and session | Supabase Auth, `src/lib/supabase/*`, `src/features/auth/*`, workspace invitation routes, local auth tests | Supabase SSR docs, NextBase protected-route and SSR-client patterns | Keep Supabase as the only auth platform. Improve local seeded login replay, session read consistency, invite acceptance UX, and denial shape. Do not add Clerk/Auth.js unless Supabase becomes a blocker. |
| Multi-tenancy / workspace | `src/app/api/workspaces/*`, memberships, permission policies, workspace seed rows | NextBase and ixartz multi-tenant reference patterns | Keep workspace id, active membership, and permission policy as CLAiR-owned truth. Borrow naming/test structure only. |
| RLS / role permissions | Supabase migrations/RPCs, server permission resolver, API denial regression specs | Supabase RLS docs, Next.js SaaS Starter activity/route-protection ideas | Treat client gating as UX only. Every seed-backed flow that mutates clinical, billing, or workspace state needs server permission checks and RLS-aligned local/dev tests. |
| Scheduling and reception | Reception queue/calendar/appointment routes, outpatient state model | Cal.com/Cal.diy booking-state and availability ideas; OpenVPM clinic workflow vocabulary | Keep internal appointment, encounter, and queue state. Use scheduling references to model conflict errors, idempotent check-in/cancel, and optional public booking later. |
| Task management | `order_fulfillment_work_items`, fulfillment routes, lab/imaging/dispensing screens | Trigger.dev for delayed jobs/retries only after route truth is stable | Do not buy/build a generic task manager first. Use fulfillment work items as clinical task truth, and add Trigger.dev only for reminders, retryable jobs, demo reset/replay, or webhook follow-up. |
| Chart/order/billing | SOAP/order routes, fulfillment handoff, billing checkout/payment state routes, audit | OpenVPM domain comparison; Stripe starter lifecycle ideas; Toss/PortOne provider docs | Keep order and invoice snapshots server-owned. Add provider-neutral payment attempts before Toss/PortOne. Use synthetic payment for the demo until a payment work item is approved. |
| Customer CRM | Guardian/patient profile routes, relationship/archive server boundaries, customer seed rows | HubSpot/Attio only for external sales CRM; OpenVPM for veterinary client/patient data shape | Keep patient/guardian CRM internal to CLAiR because it is clinical/operational truth. Do not sync PHI or guardian records to HubSpot/Attio for the demo. If needed, create a separate non-PHI clinic prospect CRM integration later. |
| User communication / messenger | Notification drawer/toast surfaces, invitation email delivery gate, audit events | Resend for transactional email, Novu for workflow orchestration, possible chat provider only after privacy review | For the demo, model internal staff communication as seed-backed in-app notifications or case/task comments, not real chat. Defer real user-to-user messaging, Kakao/SMS, or provider chat until message retention, PHI, audit, and tenant isolation rules are explicit. |
| Onboarding and analytics | Existing app shell, Storybook, Playwright route-boundary tests | Driver.js, PostHog/Mixpanel | Add product tours and analytics only after the seed-backed demo path is stable. Payloads must be synthetic/demo-safe and avoid patient, guardian, medical, payment, and identity details. |
| Data fetching state | API-backed demo routes, visible loading/error states in recent work | TanStack Query | Evaluate one narrow pilot for GET route state if repeated loading/error/retry code continues to slow work. Do not put clinical mutations, permissions, invoice totals, or payment state into client cache as source of truth. |

## Korea Payment Constraint

Do not assume the Vercel or Next.js SaaS starters' Stripe billing path is directly usable for a Korea-based CLAiR business.

Current source check, 2026-06-17:

- Stripe's global availability list does not include South Korea as a supported country/region for opening a normal Stripe business account. Stripe says once Stripe is supported in a country/region, businesses can sell to customers worldwide; South Korea is absent from that list.
- Stripe separately documents "South Korean payment methods" for businesses located in specific countries such as the US, Japan, Singapore, the UK, and several EU countries. That page is about accepting Korean cards/wallets from supported business locations, not evidence that a Korea-registered CLAiR business can use Stripe as the default provider.
- Stripe can remain a reference for payment lifecycle concepts, webhook idempotency, subscriptions, and customer portal UX. It should not be the default Korea implementation plan.

Korea-first provider candidates:

| Provider route | Use when | Notes |
| --- | --- | --- |
| Toss Payments direct | Korea-only payments, straightforward checkout widget, direct provider relationship, payment confirmation/cancel APIs | Toss Payment Widget supports cards, bank transfer, virtual account, wallets, mobile payment, BrandPay, key-in, and PayPal depending on contract. Prefer hosted/widget flows; do not store card data in CLAiR. |
| PortOne | Need PG abstraction across Toss Payments, KG Inicis, KCP, NICE, Naver Pay, Kakao Pay, Payco, Toss Pay, bank transfer, and possible later international methods | PortOne Korea documents many KRW payment method keys and sandbox availability. Good fit if CLAiR wants provider portability. Adds another abstraction/vendor layer. |
| Stripe | Foreign entity/global expansion scenario, or accepting Korean local methods from a Stripe-supported business location | Not the Korea-default path. Use only after business/legal decision. |
| Manual/synthetic payment | MVP demo, local-first billing state, no real payment provider side effects | Current safest default. Keep provider confirmation language out of product claims. |

Payment setup, real provider credentials, webhook forwarding to an external provider, real checkout attempts, refunds, subscriptions, or production merchant onboarding are approval-gated. A future payment PR must name the provider, environment, test mode/live mode, verification plan, rollback/stop condition, and whether any real external side effect can happen.

## Adoption Rules

- Repo-first: read the current CLAiR source docs, affected code, migrations, tests, and active work item before borrowing any reference pattern.
- Reference-second: inspect the external project only for the narrow concern in scope.
- No broad rewrites: keep existing CLAiR `src/features/*`, `src/app/api/*`, Supabase migrations, mock fallback, and Sales Demo boundaries unless a work item explicitly scopes removal.
- No incompatible copying: AGPL/GPL/no-license/unknown-license projects are idea references only. Do not paste source code into CLAiR.
- Preserve current contracts: `Outpatient Workflow State Model`, `Order Fulfillment Handoff`, `Role And Permission Source Map`, and `Mock And Live Boundary Map` are more authoritative than external starter assumptions.
- Server first for security: external UI patterns do not complete security. Workspace, role, amount, and state transitions need server/API/DB/RLS enforcement.
- Provider adapters before provider-specific UI: payment code should model `payment_attempt`, provider reference, confirmation, cancellation/refund request, webhook event, and audit evidence before choosing Toss, PortOne, or Stripe-specific UI.

## Stabilization Specs

### 1. Auth / Tenant / Permission

Goal: make workspace/session/permission behavior easier to reason about before touching more clinical and billing workflows.

Reference comparison:

- Use NextBase for Supabase SSR client separation, protected route discipline, migration/RLS tests, and data-access boundary naming.
- Use Next.js SaaS Starter only for simple middleware/activity-log ideas.
- Do not import a new auth framework, Clerk/NextAuth model, or wholesale monorepo structure.

CLAiR target:

- Keep `src/features/auth/*`, `src/lib/supabase/*`, `src/app/api/workspaces/*`, and existing server permission resolver boundaries.
- Normalize one path for session read, workspace membership read, effective permission resolution, and denial response shape.
- Keep mock/demo actor fallback explicitly marked as demo-only.

Out of scope:

- Canonical role/permission policy changes.
- Remote Supabase, production secrets, real identity data, real email delivery.
- Removing Sales Demo/mock fallback.

Suggested verification:

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/server-session-reader.spec.ts tests/permission-resolver.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/server-permission-enforcement.spec.ts tests/cross-tenant-denial-regression.spec.ts tests/api-boundary-permission-regression.spec.ts --reporter=line`

### 2. Queue / Appointment / Calendar

Goal: stabilize reception queue and appointment/calendar transitions before adding more scheduling features.

Reference comparison:

- Use Cal.diy for availability, time-zone, conflict, booking-state, and calendar-integration ideas.
- Use OpenVPM for clinic/PIMS domain naming and operational appointment-to-visit flow.
- Do not import Cal.diy; it is a full scheduling platform and not shaped like CLAiR's EMR workflow.

CLAiR target:

- Keep appointment state separate from encounter state and queue state.
- Make create/check-in/cancel/update transitions idempotent where practical and always actor/workspace scoped.
- Keep queue state as operational display state, not canonical clinical truth.
- Capture scheduling conflicts as explicit states/errors rather than silent UI failures.

Out of scope:

- Google Calendar, Microsoft Calendar, SMS/KakaoTalk, real external reminders, or real customer messaging.
- Production clinic scheduling integrations.
- Broad design-system table/calendar redesign unless separately scoped.

Suggested verification:

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/reception-appointment-create-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/reception-queue-read-server.spec.ts tests/reception-encounter-cancel-server.spec.ts tests/reception.spec.ts --reporter=line`

### 3. Chart / Order / Billing

Goal: stabilize clinical order and billing state transitions before adding a real Korea PG.

Reference comparison:

- Use OpenVPM for veterinary PIMS flow vocabulary and workflow coverage.
- Use Next.js SaaS Starter and the Vercel Stripe/Supabase starter for payment lifecycle ideas: checkout start, webhook readback, subscription/customer portal separation, activity/audit logs.
- Use Toss Payments and PortOne docs for Korea payment provider shape, not Stripe as the default implementation.

CLAiR target:

- Preserve product rule: `Order 청구` creates or refreshes billing candidates; `수납 진행` snapshots final payable amount; `수납 완료` changes payment state.
- Keep client-submitted amounts untrusted. Server-owned service item and invoice snapshots remain authoritative.
- Add a provider-neutral payment boundary before any provider-specific integration:
  - `checkout_prepare` / `payment_attempt_created`
  - provider name and provider payment key/reference
  - signed or retrieved provider confirmation
  - webhook event idempotency key
  - cancel/refund request and response records
  - audit events with safe payloads
- For Korea, prefer Toss Payment Widget direct for a simple first provider or PortOne if gateway portability is a stronger business requirement.

Out of scope:

- Real payment capture, live refund, live subscription, production merchant onboarding, real payment credentials, or real guardian payment data.
- Stripe as the default Korea provider.
- Card key-in, stored card data, or direct card-number handling in CLAiR.
- Accounting/settlement integration.

Suggested verification:

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart-order-action-persistence-server.spec.ts tests/fulfillment-work-item-server.spec.ts tests/billing-invoice-candidate-sync-server.spec.ts tests/billing-invoice-line-persistence-server.spec.ts tests/billing-payment-status-persistence-server.spec.ts tests/billing-guardian-checkout-hardening-server.spec.ts tests/fulfillment-handoff-replay.spec.ts tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`

## Practical Next Sequence

1. Start with `auth / tenant / permission` stabilization. This is the base trust boundary for every workflow. Use Supabase and NextBase-style patterns to reduce session, membership, permission, denial, and local replay ambiguity.
2. Normalize API read state for the seed-backed demo before adding providers. If repeated loading/retry/cache code keeps spreading across visible modules, evaluate a narrow TanStack Query adoption for GET route state only. Mutations, permission checks, billing amounts, and clinical state transitions stay server-owned.
3. Stabilize `queue / appointment / calendar`. Use Cal.com/Cal.diy as scheduling references, but keep CLAiR appointment, queue, and encounter state internal.
4. Stabilize fulfillment/task readback. Keep `order_fulfillment_work_items` as the canonical operational task table. Consider Trigger.dev only for background retries, reminders, demo replay, and webhook follow-up after core routes are stable.
5. Stabilize `chart / order / billing` and add a provider-neutral Korea payment boundary. Keep actual Toss/PortOne/Stripe provider calls out of scope until a separate approved payment work item exists.
6. Keep CRM, notifications, messaging, analytics, and onboarding secondary. Use internal seed-backed patient/guardian/workspace data for the demo first; add HubSpot/Attio, Novu, PostHog/Mixpanel, Driver.js, or real messaging only after privacy and provider boundaries are explicitly scoped.

This sequence should keep the current product visible while reducing error churn. Each step should be one PR-sized work item with a focused source-doc read, reference comparison notes, implementation boundary, and verification commands.

## Review And Counterarguments

This plan was checked against the user's request to reduce custom build effort while still reaching a seed-backed EMR demo. The main risks and corrections are:

| Challenge | Risk if ignored | Correction in this plan |
| --- | --- | --- |
| "Use a SaaS boilerplate to go faster" | Replacing the app would discard existing EMR flows, seed contracts, tests, and domain rules. | Use starters as pattern references only; keep CLAiR repo structure and Supabase contracts. |
| "Add a ready-made scheduler" | Cal.com-style systems optimize public booking, not CLAiR's appointment-to-encounter-to-queue handoff. | Borrow availability/conflict patterns, but keep internal scheduling state in CLAiR. |
| "Use a generic task manager" | Clinical task truth could split from orders, fulfillment, billing, and audit. | Keep `order_fulfillment_work_items` as task truth; add Trigger.dev only for background execution. |
| "Use external CRM to avoid building customer management" | Patient/guardian CRM is clinical and operational data, not sales-pipeline data. | Keep patient/guardian CRM internal; use HubSpot/Attio only for non-PHI clinic prospect/sales work. |
| "Add chat quickly" | Real messages can contain medical or payment data and need retention, audit, tenant isolation, and provider review. | Demo internal communication as notifications/comments first; defer real chat/Kakao/SMS. |
| "Use Stripe because starters do" | Korea business setup is not the default Stripe path, and payment side effects are approval-gated. | Use Stripe only as lifecycle reference; prioritize Toss direct or PortOne behind an adapter. |
| "Client libraries can speed up state" | Caching can hide permission, payment, or cross-tenant bugs. | Use TanStack Query only for GET/read UI state after a pilot; keep mutations and authority server-owned. |

## Seed-Backed Demo Acceleration Plan

Use this as the next planning split if 승욱 chooses to turn this document into implementation work:

| Slice | Goal | External acceleration | Verification |
| --- | --- | --- | --- |
| 0. Safety and baseline | Keep `main` aligned, docs accurate, and provider effects disabled. | None. Repo-first. | `npm run docs:check`, `npm run security:secrets`, `npm run demo:seed:check` |
| 1. Supabase local replay | Make local/dev login plus seeded workspace readback the fastest proof path. | Supabase docs and NextBase patterns. | `npm run demo:seed:check -- --readback` when local DB tools exist; focused auth/workspace tests. |
| 2. API read-state cleanup | Reduce duplicated loading, empty, permission, and retry states across seeded demo screens. | Possible narrow TanStack Query evaluation for GET reads only. | Existing API boundary specs plus visible UI specs for reception/chart/fulfillment/billing. |
| 3. Scheduling/reception | Make appointment creation/check-in/cancel/calendar errors predictable. | Cal.com/Cal.diy scheduling-state references. | Reception appointment, calendar, queue, and encounter route specs. |
| 4. Fulfillment/task work | Make lab, imaging, treatment, and dispensing queues consistently seed/API-backed. | Trigger.dev only if background job/retry pressure is real. | Fulfillment work-item specs and `tests/ui-demo-api-wiring-e2e.spec.ts`. |
| 5. Billing/payment boundary | Model provider-neutral payment attempts before any Korea PG integration. | Toss/PortOne docs for provider shape; Stripe only for lifecycle patterns. | Billing checkout/payment status specs and amount-integrity regression tests. |
| 6. Communications/analytics | Add non-clinical onboarding, notifications, and analytics only after privacy-safe payloads are defined. | Resend, Novu, PostHog/Mixpanel, Driver.js as opt-in integrations. | Secret scan, payload redaction tests, provider-disabled fallback tests. |

## Explicit Non-Goals

- Do not copy AGPL/GPL/no-license/unknown-license source code into CLAiR.
- Do not replace Supabase Auth/RLS/server permission foundations with Clerk, Auth.js, Firebase, or a SaaS boilerplate.
- Do not import Cal.com/Cal.diy as the internal EMR scheduling engine.
- Do not treat HubSpot, Attio, Novu, PostHog, Mixpanel, or any chat/messaging provider as a clinical record system.
- Do not integrate real Toss, PortOne, Stripe, Resend, KakaoTalk, SMS, analytics, or webhook provider side effects without explicit approval.
- Do not use external tools to bypass the synthetic seed-backed demo contract or the mock/live boundary map.

## Sources Checked

External sources checked on 2026-06-17:

- NextBase GitHub repository: <https://github.com/imbhargav5/nextbase-nextjs-supabase-starter>
- OpenVPM GitHub repository: <https://github.com/evangauer/openvpm>
- Cal.diy GitHub repository: <https://github.com/calcom/cal.diy>
- Vercel Stripe & Supabase SaaS Starter Kit: <https://vercel.com/templates/next.js/stripe-supabase-saas-starter-kit>
- Vercel starter GitHub repository: <https://github.com/dzlau/stripe-supabase-saas-template>
- Next.js SaaS Starter GitHub repository: <https://github.com/nextjs/saas-starter>
- Stripe global availability: <https://stripe.com/global>
- Stripe South Korean payment methods: <https://docs.stripe.com/payments/countries/korea>
- Toss Payments widget docs: <https://docs.tosspayments.com/en/integration-widget>
- Toss Payments API docs: <https://docs.tosspayments.com/en/api-guide>
- PortOne Korea docs: <https://docs.portone.cloud/docs/portone-korea>
- Supabase SSR client docs: <https://supabase.com/docs/guides/auth/server-side/creating-a-client>
- Supabase RLS docs: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Cal.com embed docs: <https://cal.com/embed>
- Trigger.dev docs: <https://trigger.dev/docs>
- Resend Next.js docs: <https://resend.com/docs/send-with-nextjs>
- Novu workflow docs: <https://docs.novu.co/platform/concepts/workflows>
- PostHog group analytics docs: <https://posthog.com/docs/product-analytics/group-analytics>
- User-supplied general SaaS tooling summary from the 2026-06-18 chat.

Internal source docs:

- [Current Status](../current-status.md)
- [Mock And Live Boundary Map](mock-live-boundary-map.md)
- [API-Backed Demo Runbook](../testing/api-backed-demo-runbook.md)
- [Demo Seed Inventory Readback Contract](../data-model/demo-seed-inventory-readback-contract.md)
- [Outpatient Workflow State Model](../../product/domain/outpatient-workflow-state-model.md)
- [Order Fulfillment Handoff](../../product/domain/order-fulfillment-handoff.md)
- [Role And Permission Source Map](../../product/domain/role-permission-source-map.md)
