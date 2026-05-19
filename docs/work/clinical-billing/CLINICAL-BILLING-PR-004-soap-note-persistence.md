---
id: "CLINICAL-BILLING-PR-004"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-69"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/reception-chart-order-billing-handoff-closeout.md"
  - "docs/product/demo-data/README.md"
dependencies:
  - "CLINICAL-BILLING-PR-002"
updated: "2026-05-19"
---

# SOAP Note Persistence

## Goal

Persist SOAP subjective, objective, assessment, and plan fields plus autosave metadata through a server route.

## Scope

- Add a route-backed SOAP note read/save boundary for chart encounters.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership plus `chart:view`/`chart:update` permission in the server core.
- Validate that SOAP reads/writes stay scoped to an encounter in the active workspace.
- Add a local-first Supabase RPC migration boundary for future local SQL replay.
- Wire the chart SOAP editor to route-backed manual save and autosave.
- Add focused server route and chart UI regression coverage.

## Out Of Scope

- Diagnosis persistence.
- Order persistence, confirmation, billing candidate generation, or invoice sync.
- Template/snippet library.
- Rich audit UI or full audit persistence.
- Remote Supabase push/link/query, production deploy, or real patient/hospital data.

## Done When

- SOAP content can be saved through the route and read back after reload.
- Unauthorized SOAP mutation is denied.
- Encounter/workspace mismatch is denied.
- Docs and Linear identify DEN-70 as the next Project 04 unit.

## Handoff Notes

Ready for Human Review.

DEN-70 should persist chart completion state using the same route-owned pattern: active membership, domain permission, encounter workspace validation, mock fallback, and local-first Supabase boundary only.

## Verification

- `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run security:secrets`
