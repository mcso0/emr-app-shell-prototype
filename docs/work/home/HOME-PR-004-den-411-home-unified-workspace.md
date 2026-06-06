---
id: "HOME-PR-004"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-411"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/home/HOME-PR-003-home-kanban-workspace.md"
dependencies:
  - "HOME-PR-003"
updated: "2026-06-05"
---

# DEN-411 Home Unified Workspace

## Goal

Redesign Home into one desktop operations workspace for CSS 1920x1080 hospital use, merging the former `홈` and `업무 현황` decision points into a single work surface.

## PR Gate

- Goal: one Home surface with a left `다음 행동` side panel, a central `업무 현황` Kanban board, board-level filters, and a right-side task detail drawer.
- PR-sized scope: Home feature component, focused Home Playwright coverage, repo work item/index updates, and completion report.
- Out of scope: live DB/Supabase/RLS, server permission enforcement, realtime task data, claim/complete/cancel mutations, mobile-first redesign, non-Home module redesign.
- Done criteria: Home no longer asks users to choose between Home and Work Status tabs; filters sit above the Kanban board; `업무 상태` replaces patient-state language; selecting a card opens an overlay drawer; existing EMR side-panel/card/sheet/filter tokens and primitives are reused.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test tests/home.spec.ts --reporter=line`, browser visual check on `/w/clair-demo/home?modulePanel=open`.

## Scope

- Use the existing module side-panel visual language for `다음 행동`.
- Keep the Kanban board as the main workspace and preserve status-group collapse behavior.
- Move operating mode, assignee, workstream, work status, and delayed-only filters directly above the board.
- Replace the permanent right detail panel pattern with a `Sheet` drawer opened from selected work cards.
- Preserve Sales Demo routing through `?view=demo`.

## Out Of Scope

- New data models or persistence.
- Live task assignment or completion flows.
- Broad design-system token creation.
- DEN-412 through DEN-416 audit backlog work.

## Completion Notes

Handed to human review on 2026-06-04.

- Home now opens as one unified operations workspace instead of separate `홈` and `업무 현황` body tabs.
- The left `다음 행동` panel reuses EMR side-panel/card primitives and surfaces delayed, urgent/attention, and assignment-needed work.
- The main workspace uses `업무 현황` as the primary board with operating-mode chips and board-level filters.
- Filters now sit above the Kanban board: `담당자`, `업무`, `업무 상태`, and `지연만 보기`.
- `업무 상태` uses work/task status language and renders user-facing labels such as `전체`, not internal values.
- Kanban card selection opens a right `Sheet` detail drawer; the drawer is closed by default and clears selection on close.
- Sales Demo remains available behind `?view=demo`.

Verification passed:

- `npm run lint` (passes with 4 pre-existing warnings outside this scope)
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Browser visual check on `http://localhost:3000/w/clair-demo/home?modulePanel=open` at CSS `1920x1080`

Visual artifact:

- `output/den-411/local-home-unified-workspace-1920css-2026-06-04.png`

QA addendum on 2026-06-04:

- Disabled the non-scoped `담당 배정` drawer action so Home does not present a working-looking mutation button before assignment behavior is implemented in the source workflow.
- Updated the Home loading skeleton to match the unified left side-panel plus central board structure.
- Updated Sales Demo flow tests to match the current Billing screen contract: invoice number and encounter number render separately, and `수납 완료` requires `담당하기` first.
- Re-ran focused QA across Home and Sales Demo.

Additional verification passed:

- `npm run lint` (passes with the same 4 pre-existing warnings outside this scope)
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (19 tests)
- Browser manual QA on local Home at CSS `1920x1080`: unified headings, side panel, Kanban, drawer open/close, and disabled non-scoped drawer action checked.

Additional visual artifact:

- `output/den-411/qa-home-unified-workspace-1920css-2026-06-04.png`

Staging Preview deployment on 2026-06-05:

- Vercel Preview URL: `https://emr-app-shell-prototype-ndhyc0a3r-mcso0s-projects.vercel.app`
- Home review URL: `https://emr-app-shell-prototype-ndhyc0a3r-mcso0s-projects.vercel.app/w/clair-demo/home?modulePanel=open`
- Deployment ID: `dpl_8fCn6qMvRXsuyrQY9tTyCoR4gNXa`
- `npx vercel@latest inspect https://emr-app-shell-prototype-ndhyc0a3r-mcso0s-projects.vercel.app --wait --timeout 3m` reported target `preview` and status `Ready`.
- Pre-deploy verification passed: `npm run security:secrets`, `git diff --check`, and `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (19 tests).
- Remote unauthenticated smoke returned Vercel Deployment Protection `401`; browser-level authenticated review must use the logged-in/protected Preview access path.
