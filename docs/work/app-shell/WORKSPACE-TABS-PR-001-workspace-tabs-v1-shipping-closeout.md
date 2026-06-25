---
id: "WORKSPACE-TABS-PR-001"
status: "human_review"
area: "app-shell"
priority: "P0"
target_pr: "Workspace Tabs v1 shipping closeout"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/app-shell/APP-SHELL-PR-001-workspace-tabs.md"
dependencies: []
updated: "2026-06-25"
---

# Workspace Tabs V1 Shipping Closeout

## Goal

Prepare the first workspace-tabs implementation for review by separating shipping evidence from new feature work.

## Context

The original `APP-SHELL-PR-001` covered session-only workspace tabs. The current implementation now also includes server-backed tab restore, duplicate work-surface warnings, mobile tablist hiding, and SOAP stale-save conflict protection.

This closeout records the shipped scope and verification evidence instead of adding another product feature.

## Checkout Finding

- Actual checkout: `/Users/iseung-ug/project/emr-app-shell-prototype`
- Uppercase path `/Users/iseung-ug/Projects/emr-app-shell-prototype`: not present in this environment.
- Current branch before closeout work: `main`
- `main` and `origin/main` were aligned and clean before this docs-only closeout branch.

## Shipped Scope Classification

Workspace tabs:

- `WorkspaceTab` identity fields: `surfaceType`, `surfaceId`, `dedupeKey`, `lastRoute`, `updatedAt`.
- Server tab session route: `GET` and `PUT /api/workspaces/:workspaceId/app-shell/workspace-tabs`.
- Server session core and Supabase gateway.
- Duplicate work-surface warning dialog with existing-tab navigation, continue-current-tab, and hide-warning preference.
- Mobile tablist hidden while preserving tab history controls.
- App Shell route normalization race guard and server-restore race guard.

SOAP conflict guard:

- `expectedUpdatedAt` passed into SOAP note save.
- RPC conflict parameter `p_expected_updated_at`.
- Stale save response: `409 soap_note_conflict`.
- Chart UI preserves current input and shows conflict guidance.

Tests and migrations:

- Workspace tabs server-session Playwright coverage.
- SOAP note persistence conflict coverage.
- App Shell focused workspace-tab regression coverage.
- Workspace tab session migration.

## PR Unit Decision

Safest review unit: keep this as one shipped capability review named **Workspace Tabs v1 + SOAP conflict guard**.

Rationale:

- The duplicate-tab warning and SOAP conflict guard are coupled by the same user risk: opening the same clinical surface in multiple logical tabs.
- Splitting after landing would create artificial review boundaries without lowering runtime risk.
- Future conflict handling outside SOAP remains a follow-up, not a reason to block this first shipping closeout.

## Explicit Non-Goals

- No mobile workspace tab UX beyond hiding the desktop tablist.
- Duplicate access is not blocked; users can switch to the existing tab or continue in the current tab.
- SOAP conflict guard does not yet cover every chart/order/billing mutation.
- This closeout does not claim full launch readiness, remote Supabase replay, or production monitoring.

## Verification Evidence

Latest local verification recorded during closeout:

- Passed: `npx tsc --noEmit`
- Passed: `npm run docs:check`
- Passed: `npx eslint src/stores/workspace-tabs-store.ts tests/app-shell.spec.ts`
- Passed: `npm run lint` with 0 errors and 11 warnings
- Passed: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs keep navigation history per active tab" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs|workspace tab chrome" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/workspace-tabs-session-server.spec.ts --reporter=line`
- Passed: `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`

## Remaining Risks

- Full App Shell Playwright suite was not re-run as part of this closeout.
- Production browser smoke against the Cheongdam Vercel deployment remains recommended after merge.
- SOAP conflict protection should be extended to other high-risk clinical/billing mutations in later scoped work.

## Closeout Report

- `docs/completed/app-shell/2026-06-25-workspace-tabs-v1-shipping-closeout-report.html`
