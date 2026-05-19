---
id: "CLINICAL-BILLING-PR-005"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-70"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-004-soap-note-persistence.md"
dependencies:
  - "CLINICAL-BILLING-PR-004"
updated: "2026-05-19"
---

# Chart Completion Persistence

## Goal

Persist chart completion as a server-owned clinical handoff to `ready_for_billing`.

## Scope

- Add a route-backed chart completion read/save boundary for chart encounters.
- Preserve mock/local fallback for the portfolio demo and Playwright default session.
- Enforce active workspace membership plus `chart:view`/`chart:update` permission in the server core.
- Validate encounter ownership through workspace-scoped encounter lookup.
- Add `chart_completed_at` and `chart_completed_by_user_id` local-first columns without reusing payment-oriented `completed_at`.
- Add local-first Supabase RPCs for chart completion read/write.
- Wire the chart completion dialog to persist state and show reload-stable completion status.
- Keep SOAP status visible while showing chart completion status separately.

## Out Of Scope

- Remote Supabase push/link/query, production deploy, or real patient/hospital data.
- Diagnosis persistence.
- Order confirmation, billing candidate generation, invoice sync, or payment completion.
- Final RLS policy hardening and audit log persistence.
- Full queue orchestration outside the local-first RPC handoff shape.

## Done When

- `차트 작성완료` stores a chart completion snapshot through the route.
- Reload preserves the `작성완료` status in mock/local mode.
- Unauthorized mutation is denied.
- Encounter/workspace mismatch is denied.
- Completion moves clinical work toward `ready_for_billing` without marking invoice/payment as completed.

## Handoff Notes

Ready for Human Review.

DEN-71 should continue the same route-owned pattern for diagnosis/assessment persistence. DEN-72/73/75 should consume the DEN-100 chart-applied order snapshot contract instead of expanding DEN-70.

## Verification

- `npx playwright test tests/chart-completion-persistence-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
