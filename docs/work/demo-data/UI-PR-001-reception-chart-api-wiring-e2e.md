---
id: "UI-PR-001"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "UI PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
  - "docs/work/demo-data/DEMO-DB-PR-005-billing-checkout-session-family-seed-foundation.md"
dependencies:
  - "DEMO-DB-PR-001"
  - "DEMO-DB-PR-002"
  - "DEMO-DB-PR-003"
  - "DEMO-DB-PR-004"
  - "DEMO-DB-PR-005"
updated: "2026-06-09"
---

# Reception and Chart API Wiring E2E

## Goal

Start the post-seed UI/API adoption phase for the `clair-demo` synthetic dataset by wiring the reception and chart entry points through existing API boundaries and adding a focused end-to-end route-boundary test.

## Scope

- Hydrate reception patient/guardian profile context from the existing reception patient/guardian lookup route.
- Keep reception queue and day-calendar reads on the existing reception API routes.
- Make the chart side panel load queue context through the existing chart live-queue route in mock-session and Supabase-session modes.
- Add a focused Playwright spec for:
  - reception profile/queue/calendar API calls
  - chart live queue API calls
  - chart order confirmation
  - fulfillment work-item completion
  - result-review billing handoff
  - guardian checkout/payment status
  - audit readback
- Leave legacy Sales Demo and unconfigured local fallback cleanup to a later cleanup item; this historical PR only proves the API-backed route boundary.

## Out Of Scope

- Seed expansion or seed reshaping.
- Schema changes, migrations, RLS changes, or remote Supabase work.
- UI redesign.
- Production DB, production deploy, real hospital data, real patient data, real guardian data, real payment data, or provider integrations.
- Full browser-level visible-control workflow across every downstream screen.

## Done Criteria

- Reception can merge lookup-route patient/guardian records into its profile store.
- Chart side panel calls the live-queue route instead of waiting for Supabase-only mode.
- Focused E2E coverage proves the outpatient API boundary from reception to audit using synthetic demo data and headers.
- Current status and demo seed contract docs describe that seed coverage is complete and UI adoption has started.
- Existing seed readback contract remains intact.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run docs:check`
- `npm run security:secrets`

## Result

UI PR 1 starts API-backed adoption without changing the seeded dataset. Reception now hydrates profile context through the lookup route, chart queue context loads through the live-queue route, and the new focused Playwright spec covers the synthetic outpatient route boundary through checkout/payment and audit readback.
