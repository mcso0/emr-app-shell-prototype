---
id: "HOME-PR-002"
status: "done"
area: "home"
priority: "P1"
target_pr: "PR 2"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/home/home-v1-reference-research.md"
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/product/features/home/home-v1-epic-plan.md"
  - "docs/product/features/home/home-v1-ui-spec.md"
dependencies:
  - "HOME-PR-001"
updated: "2026-05-09"
---

# Home Work Entry v1

## Goal

Rework the existing Home command dashboard into a staff work-entry surface centered on `내 업무`.

## PR Gate

- Goal: 홈 기본 화면이 `오늘/지금 내가 뭘 해야 하지?`에 답하도록 한다.
- PR-sized scope: home feature module, home mock data shape, My Work timeline, quick status chips, role queue/unassigned presentation, empty state launcher, compact flow summary, focused Playwright coverage, docs/status updates.
- Out of scope: live DB/API persistence, server-side permission enforcement, realtime sockets, full notification center, hospital management dashboard, revenue/visitor/staff/inventory KPI cards, drag/drop personalization, claim/complete/finalize actions on Home.
- Done criteria: `/w/clair-demo/home` shows My Work-first Home v1, default Home no longer renders the three-column command dashboard, Home task actions only route to source workflows, and demo launcher remains available at `?view=demo`.
- Source docs: Home v1 reference research, command entry planning, work generation rules, epic plan, and UI spec.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`, browser visual check.
- Status/dependencies: done; depends on completed `HOME-PR-001`.
- Duplicate check: `HOME-PR-001` is complete and covered the first role-command foundation; this item supersedes the default Home layout direction but should preserve its route, mock auth role mapping, and Sales Demo launcher.

## Scope

- Replace the default Home body with a My Work-first layout:
  - header/search
  - Quick Status chips
  - My Work header
  - work filters/lens
  - My Work timeline or empty launcher
  - compact flow summary
- Refactor home mock data to represent requested/assigned work, unassigned role work, and empty-state launcher data.
- Represent unassigned role queue work as Home work visible to matching role users, without exposing claim action.
- Ensure claimed/assigned examples appear only for the relevant user/role in mock data.
- Remove the large default `Alerts & Exceptions` panel and role widget grid from Home v1 default.
- Keep global notification center as out of scope; do not replace it with a Home panel.
- Keep Sales Demo launcher available at `/w/clair-demo/home?view=demo`.
- Update or add focused Playwright coverage for Home v1.

## Implementation Guidance

- Read the relevant Next.js docs under `node_modules/next/dist/docs/` before editing application code.
- Reuse existing `src/features/home/components/*` where the component still matches Home v1; refactor or replace only where the v1 information architecture requires it.
- Prefer existing project components and wrappers first:
  - `EmrPageHeader` for page/title action structure when appropriate.
  - `Badge`, `Button`/`buttonVariants`, `Input`, `ScrollArea`, `Skeleton`, `SegmentedControl` from `src/components/ui/*`.
  - Existing app icons from `src/components/icons.ts` or `src/components/cds-icons/*`.
- Use shadcn primitives already present in the repo through the project token/style system. Do not introduce new UI libraries.
- Use Clair/shadcn tokens and existing density patterns; avoid one-off CSS systems.
- Do not extract broad shared components during this PR unless the pattern is already stable and reused in at least two screens. Keep Home-specific components under `src/features/home/components/`.
- Do not create custom SVG icons when an existing icon component is available.
- Use the Browser skill for in-app browser visual verification after frontend changes.

## Out Of Scope

- Live data sources or persistence.
- Actual cross-user claim state synchronization.
- Implementing the app-level notification center.
- Implementing 병원관리 dashboard or KPI widgets.
- Completing, cancelling, claiming, sending messages, confirming lab results, completing charts, or completing payments from Home.
- Pixel-level alignment to a stored reference screenshot.

## Done When

- Default Home answers `오늘/지금 내가 뭘 해야 하지?` with My Work as the dominant content.
- Home task cards include patient/work context, source/reason, time/urgency state, recommended next action, and one entry action.
- Home card actions are limited to `열기` or `확인하러 가기` style navigation.
- Empty My Work state shows a compact role/responsibility launcher instead of unrelated hospital-wide dashboard data.
- Quick Status chips filter or focus My Work signals such as `내 업무`, `긴급`, `오늘 마감`, `지연`, and `미배정 큐`.
- Compact flow summary remains secondary and does not become a large flow board in the default Home body.
- Default Home excludes hospital management KPI cards and large notification/alert panels.
- Sales Demo launcher remains available at `?view=demo`.
- Verification commands pass or failures are recorded.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open`
- Browser check on `/w/clair-demo/home?view=demo`

## Completion Notes

Completed on 2026-05-09.

- Default Home now uses a My Work-first work-entry surface with quick status chips, work/domain filters, role queue presentation, and compact flow summary.
- The default Home body no longer renders the old large Alerts & Exceptions panel, role widget grid, or full hospital flow board.
- Desk role has the empty My Work fixture with `예약/접수 열기`, `현장 접수`, and `수납 대기 보기` launchers.
- `billing_admin` maps to `수납 담당`; `hospital_admin` maps to `원장/관리자`.
- Home task cards only route into source workflows and do not expose claim, complete, finalize, send, or payment/lab/chart completion actions.
- Sales Demo launcher remains available at `/w/clair-demo/home?view=demo`.

Verification passed:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open`
- Browser route check on `/w/clair-demo/home?view=demo`
