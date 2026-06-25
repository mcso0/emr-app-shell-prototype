---
id: "WORKSPACE-TABS-PR-002"
status: "human_review"
area: "app-shell"
priority: "P0"
target_pr: "Workspace tab work-surface independence"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/app-shell/WORKSPACE-TABS-PR-001-workspace-tabs-v1-shipping-closeout.md"
dependencies:
  - "WORKSPACE-TABS-PR-001"
updated: "2026-06-25"
---

# Workspace Tab Work-Surface Independence

## Goal

Make workspace tabs independent at the concrete work-surface level instead of sharing only module-level global selection state.

## Problem

The first workspace-tab pass could show two `진료/차트` tabs, but the active chart selection still came from global stores. That made two chart tabs drift toward the same patient/encounter and caused duplicate warnings for module-level navigation instead of only the same concrete work surface.

## Scope

- New workspace tabs start from `/w/:workspaceId/home?modulePanel=open`, not a clone of the current module route.
- Shell component slots receive an optional workspace-surface navigation callback so side-panel selections can pass through App Shell tab history and duplicate detection.
- `진료/차트` selection writes `encounterId` to the route.
- `조제/처치`, `검사`, `영상`, and `수납` selections write concrete surface IDs to the route: `encounterId`, `labResultId`, `imagingStudyId`, and `invoiceId`.
- Duplicate warnings ignore module-only identities and only warn on concrete surface dedupe keys.
- Workspace tab previews derive inactive-tab patient context from each tab's route/surface metadata instead of the current global selected store.

## Behavior Rules

- Same `encounterId` in another workspace tab is a duplicate warning target.
- Same patient with a different `encounterId` is allowed as a separate tab.
- A module-only `진료/차트` tab with no selected encounter is not a duplicate warning target.
- URL query is the restore source of truth for this scope.

## Explicit Non-Goals

- No DB or migration change.
- No component keep-alive or inactive DOM preservation.
- No full per-tab store partitioning beyond route-driven surface restore.
- No change to SOAP conflict handling from `WORKSPACE-TABS-PR-001`.

## Implementation Notes

- Added `src/shell/workspace-surface-route.ts` as the shared route builder for workspace-surface navigation.
- Extended `ShellComponentProps` with `onNavigateWorkspaceSurface`.
- Kept direct store selection fallback for contexts rendered outside App Shell.
- Adjusted Playwright expectations to wait for Next.js route changes when asserting query updates.

## Verification Evidence

- Passed: `./node_modules/.bin/tsc --noEmit`
- Passed: `npm run docs:check`
- Passed: `npx eslint src/types/emr.ts src/shell/shell-main.tsx src/shell/workspace-frame.tsx src/shell/app-shell.tsx src/shell/workspace-tabs-bar.tsx src/shell/workspace-surface-route.ts src/features/chart/module.tsx src/features/dispensing/module.tsx src/features/lab-imaging/module.tsx src/features/billing/module.tsx tests/app-shell.spec.ts tests/lab-imaging.spec.ts tests/billing.spec.ts`
  - Warning only: existing `react-hooks/exhaustive-deps` warning in `src/features/chart/module.tsx` around `persistDefaultSoapContent`.
- Passed: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs warn only before opening the same concrete work surface in another tab" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs|workspace tab chrome" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/lab-imaging.spec.ts --grep "lab workspace renders result input|imaging workspace renders reading" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/billing.spec.ts --grep "billing workspace renders waiting invoice" --timeout=90000 --reporter=line`
- Passed: `npx playwright test tests/workspace-tabs-session-server.spec.ts --reporter=line`
- Passed: `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`

## Remaining Risks

- Full App Shell and full module Playwright suites were not run in this PR-002 pass.
- Global stores still exist; this PR uses URL as the tab-level source of truth rather than implementing complete store isolation.
- The route-driven surface pattern should be extended consistently when new clinical/billing surfaces are introduced.

## Follow-Up UI Polish

2026-06-25 post-merge duplicate-warning dialog polish:

- Shortened the duplicate-warning title and body copy while keeping product UX writing in 존댓말.
- Removed the low-value `기존 탭: ...` body box.
- Kept the footer on one line so the `다시 보지 않기` checkbox and action buttons do not wrap.
- Shortened the actions to `닫기` and `이동하기`; `닫기` only dismisses the warning, while `이동하기` activates the existing tab.
- Focused verification: `npx playwright test tests/app-shell.spec.ts --grep "workspace tabs warn only before opening the same concrete work surface in another tab" --timeout=90000 --reporter=line`.

## Closeout Report

- `docs/completed/app-shell/2026-06-25-workspace-tabs-pr-002-surface-independence-report.html`
