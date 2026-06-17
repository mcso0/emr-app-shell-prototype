---
title: "Reception Legacy Sales Demo And Mock Fallback Transition Note"
status: "superseded"
updated: "2026-06-17"
source:
  - "DEN-64"
  - "docs/work/reception/RECEPTION-LIVE-PR-011-sales-demo-mock-fallback-preservation.md"
superseded_by:
  - "docs/work/demo-data/DEMO-DATA-PR-002-legacy-mock-cleanup-inventory.md"
---

# Reception Legacy Sales Demo And Mock Fallback Transition Note

Linear: DEN-64

## Summary

DEN-64 originally kept the `kong-vomit` sales demo and local mock fallback while Project 03 added server-owned reception persistence boundaries.

This is now historical context, not current preservation policy. As of 2026-06-17, Cheongdam seed workspace verification (`workspace-clair-cheongdam`) is the default operating proof, and DEMO-DATA-PR-002 owns legacy Sales Demo fallback migration or removal.

The reception queue and day calendar readers intentionally return an empty persisted overlay in mock fallback mode. That means existing mock fixtures remain the visible demo source unless a successful server response returns real persisted-shaped rows.

## Historical Demo Paths

- Home sales demo launcher to reception.
- Reception `kong-vomit` query context with `patient-kong` and `encounter-kong-260501`.
- Cross-module navigation from reception to treatment, lab, imaging, dispensing, and billing.
- Appointment card and patient context for Kong remain visible when queue/calendar live readers return empty mock fallback overlays.

## Fallback Mode Summary

Mock/local mode:

- server routes may accept the demo actor header through the existing mock-mode identity seam;
- queue/calendar readers use empty persisted overlays by default;
- existing in-memory mock fixtures remain visible;
- UI state can merge successful persisted-shaped responses without deleting unrelated mock demo data.

Supabase mode:

- server routes require a verified Supabase session;
- demo actor headers are ignored when the identity source is not mock fallback;
- read gateways call local-first RPC boundaries;
- remote Supabase push/link/query remains out of scope unless separately approved.

## Test Coverage

Added a sales demo regression that intercepts both reception live readers with empty success responses and verifies that:

- both reader paths are requested;
- `scenario=kong-vomit`, `patientId=patient-kong`, and `encounterId=encounter-kong-260501` remain in the URL;
- the Kong appointment card still appears;
- the side panel patient context remains visible.

## Out Of Scope

- New demo scenario creation.
- Sales copy changes.
- Billing/chart persistence.
- Remote Supabase, production deploy, or real patient, guardian, hospital, clinic, or staff data.

## Verification

- `npx playwright test tests/sales-demo-flow.spec.ts -g "reception live reader mock fallbacks" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npx playwright test tests/reception.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`: 30 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

Broader final verification is recorded in the DEN-64 report:

- `docs/completed/reception/2026-05-19-den-64-sales-demo-mock-fallback-preservation-report.html`
