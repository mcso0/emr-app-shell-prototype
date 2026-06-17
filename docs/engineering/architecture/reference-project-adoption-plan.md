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
last_updated: 2026-06-17
---

# Reference Project Adoption Plan

This document turns external GitHub and SaaS starter references into a bounded adoption plan for CLAiR EMR. It is not permission to rewrite the app, copy incompatible code, run remote provider setup, or change production/live boundaries.

## Current CLAiR Fit

CLAiR EMR is already a Next.js 16, React 19, Supabase, shadcn/Tailwind, Playwright, and local-first veterinary EMR prototype. The project has many visible workflows and local-first server/API/Supabase foundations. The recurring risk is not a missing starter kit. The recurring risk is that several complex concerns are being advanced at once:

- `auth / tenant / permission`: login, workspace membership, role union, server permission checks, RLS, audit, and mock fallback.
- `queue / appointment / calendar`: reception queue, walk-in, appointment state, encounter handoff, and calendar display/write boundaries.
- `chart / order / billing`: SOAP, order draft/confirmation, fulfillment handoff, invoice candidates, checkout state, payment state, audit, and amount integrity.

Use external projects to compare patterns and constrain the next PRs, not to replace existing CLAiR contracts.

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

1. Start with `auth / tenant / permission` stabilization. This is the base trust boundary for every workflow.
2. Then stabilize `queue / appointment / calendar`. This gives the outpatient day a predictable entry point.
3. Then stabilize `chart / order / billing` and add a provider-neutral Korea payment boundary. Keep actual Toss/PortOne/Stripe provider calls out of scope until a separate approved payment work item exists.

This sequence should keep the current product visible while reducing error churn. Each step should be one PR-sized work item with a focused source-doc read, reference comparison notes, implementation boundary, and verification commands.

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

Internal source docs:

- [Current Status](../current-status.md)
- [Mock And Live Boundary Map](mock-live-boundary-map.md)
- [Outpatient Workflow State Model](../../product/domain/outpatient-workflow-state-model.md)
- [Order Fulfillment Handoff](../../product/domain/order-fulfillment-handoff.md)
- [Role And Permission Source Map](../../product/domain/role-permission-source-map.md)
