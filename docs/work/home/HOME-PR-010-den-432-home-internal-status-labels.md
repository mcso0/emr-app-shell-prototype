---
id: "HOME-PR-010"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-432"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/home/HOME-PR-009-den-431-home-shell-sidepanel.md"
dependencies:
  - "HOME-PR-009"
updated: "2026-06-05"
---

# DEN-432 Home 원내 현황 Labels

## Goal

Rename Home-facing navigation and side-panel labels from generic `홈` or `다음 행동` wording to `원내 현황`.

## Scope

- Change the Home side-panel title to `원내 현황`.
- Change the Home nav hover tooltip/label to `원내 현황`.
- Keep `/home` route and module id stable.
- Update focused Home regression tests for the new labels.

## Out Of Scope

- URL or module id changes.
- Live data, Supabase, RLS, or server enforcement.
- Non-Home module label changes.

## Done Criteria

- Home nav hover tooltip shows `원내 현황`.
- Home side panel title shows `원내 현황`.
- Existing Home route continues to work.
- Focused Home regression tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Browser visual QA on `/w/clair-demo/home?modulePanel=open`.

## Completion Notes

Handed to human review on 2026-06-05.

- Renamed the Home shell side-panel title to `원내 현황`.
- Updated the Home module registry label and nav hover label to `원내 현황`.
- Updated top menu and workspace tab activity labels from `홈` to `원내 현황`.
- Preserved the `/home` route and `home` module id.
- Added regression coverage for the updated label and removed `다음 행동` heading.
