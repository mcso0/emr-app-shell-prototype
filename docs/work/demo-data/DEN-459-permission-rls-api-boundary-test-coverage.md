---
id: "DEN-459"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-459"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/auth-security/mvp-auth-transition-roadmap.md"
  - "docs/engineering/auth-security/auth-login/README.md"
  - "docs/engineering/auth-security/auth-login/launch-route-permission-enforcement-inventory.md"
dependencies:
  - "DEN-452"
  - "DEN-454"
  - "DEN-456"
  - "DEN-458"
updated: "2026-06-11"
---

# Permission, RLS, and API Boundary Test Coverage Expansion

## Goal

Add focused regression coverage that proves the connected lab, fulfillment, and billing demo APIs do not rely on client-only permission gating for the core denial paths.

## Scope

- Add Playwright API-boundary coverage for unauthenticated requests.
- Add insufficient-role and cross-workspace denial coverage for fulfillment and billing mutation/read paths.
- Add static source assertions that connected demo APIs continue to call server session and server mutation/read helpers.
- Update the relevant security inventory and current status docs.

## Out Of Scope

- New role or permission policy.
- Production or remote Supabase work.
- Migration push or broad RLS replay.
- UI rewiring or mock fallback removal.
- Real hospital, patient, guardian, or payment data.

## Boundary Matrix

| Area | Route | Operation | Expected denial coverage | Evidence |
| --- | --- | --- | --- | --- |
| Lab result entry | `/api/workspaces/[workspaceId]/lab-imaging/result-entries` | read/save | unauthenticated request is rejected; `lab:view` and `lab:complete` stay server-side | `tests/api-boundary-permission-regression.spec.ts` |
| Fulfillment queue | `/api/workspaces/[workspaceId]/fulfillment/work-items` | queue read | unauthenticated and cross-workspace reads are rejected | `tests/api-boundary-permission-regression.spec.ts` |
| Fulfillment mutation | `/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]` | work item status update | insufficient role is rejected before local UI state can claim success | `tests/api-boundary-permission-regression.spec.ts` |
| Billing invoice lines | `/api/workspaces/[workspaceId]/billing/invoice-lines` | invoice line read | unauthenticated request is rejected | `tests/api-boundary-permission-regression.spec.ts` |
| Billing payment status | `/api/workspaces/[workspaceId]/billing/payment-status` | payment status update | insufficient role is rejected | `tests/api-boundary-permission-regression.spec.ts` |
| Billing checkout | `/api/workspaces/[workspaceId]/billing/guardian-checkout` | checkout session preparation | non-member/cross-boundary actor is rejected | `tests/api-boundary-permission-regression.spec.ts` |

## Commands

```bash
npx playwright test tests/api-boundary-permission-regression.spec.ts --reporter=line
npx tsc --noEmit
npm run lint
npm run docs:check
npm run security:secrets
```

## Acceptance Criteria

- The focused API-boundary spec passes.
- The spec includes unauthenticated, insufficient-role, and workspace-boundary denial paths.
- The spec asserts that the connected routes keep authorization and mutation/read decisions in server-side route/helper code, not browser storage.
- Docs clearly state that DEN-459 is regression coverage, not a completed production RLS or remote Supabase claim.

## Result

DEN-459 adds `tests/api-boundary-permission-regression.spec.ts` and updates security/current-status docs. It strengthens regression coverage for the demo workflow APIs without changing UI, schema, seed data, remote Supabase, or production policy.
