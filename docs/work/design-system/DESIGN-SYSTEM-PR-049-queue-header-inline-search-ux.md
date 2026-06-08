---
id: "DESIGN-SYSTEM-PR-049"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "Project 공통 UX/UI 기준 정리 및 화면 적용 / DEN-441"
linear: "DEN-441"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/design/system/tab-table-density-contract.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-047-queue-filter-sort-task-action-ux.md"
  - "docs/completed/design-system/2026-06-07-queue-header-search-interaction-plan-report.html"
updated: "2026-06-08"
---

# Queue Header Inline Search UX

## Goal

Implement inline search mode for side-panel queue headers so queue search icons become functional, focused, and consistent across shared queue surfaces.

## Scope

- Convert the queue header search icon into an inline search mode trigger.
- Replace the header label/actions with a focused search input and close action while search mode is active.
- Filter visible task cards by query while preserving the current tab/scope, detail filter, and sort state.
- Show a compact `검색 결과 N건` summary while a query is active.
- Provide a no-results empty state with a clear recovery action.
- Apply the behavior to shared order queues and verify lab/imaging queue coverage.

## Out Of Scope

- Global command palette search.
- Server/API query contracts, live Supabase, migrations, RLS, production deploy, or real data access.
- Fuzzy search, 초성 search, persisted search preference, or URL query state.
- Automatic detail-panel selection changes from search results.
- Table body search or diagnosis/order table search.

## Implementation Notes

- Search is local, session-only UI state.
- Search should operate after the current scope/filter narrowing and before the rendered grouped queue list.
- Closing search clears the query and restores the existing header controls.
- Selection remains explicit: typing does not change the selected task/card.
- The shared queue header search mode is implemented through `EmrListHeader.search`; treatment/dispensing order queues, lab queues, and imaging queues reuse the same inline header pattern.

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint` passed with 5 pre-existing warnings outside this work item:
  - `scripts/owner-os.mjs`
  - `src/features/auth/workspace-membership-management.tsx`
  - `src/features/chart/module.tsx`
  - `src/features/hospital-admin/store.ts`
- `npm run docs:check` passed.
- Playwright interaction checks passed:
  - treatment queue: `코코` -> `검색 결과 1건`
  - lab queue: `CBC` -> `검색 결과 2건`
  - imaging queue: `X-ray` -> `검색 결과 1건`
  - each queue opens search, focuses the input, filters to matching cards, shows the compact result count, shows the no-result state, clears the query, and closes search from focused empty input with Escape.
- `npm run build` passed locally.
- Vercel preview deployment completed:
  - Preview: `https://emr-app-shell-prototype-e7sadsvn0-mcso0s-projects.vercel.app`
  - Fixed staging alias: `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app`
  - Deployment: `dpl_HyJK9UUJSF6zuxr4MKrNRmfTJxEB`
  - Agent-side remote browser verification is blocked by Vercel SSO/deployment protection; alias mapping and READY status were verified with Vercel CLI.

## Handoff Notes

Ready for Linear Human Review.
