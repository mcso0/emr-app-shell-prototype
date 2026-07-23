---
id: "HOSPITAL-ADMIN-PR-007"
status: "implemented"
area: "hospital-admin"
priority: "P0"
target_pr: "User-approved hospital settings screen split and CDS V2 interaction contract"
completion_report: "docs/completed/hospital-admin/2026-07-23-hospital-settings-screen-split-report.html"
source_docs:
  - "docs/product/domain/workspace-hospital-profile.md"
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
  - "docs/design/screens/hospital-admin/hospital-basic-settings-linear-interactive-prototype.html"
  - "docs/engineering/data-model/workspace-hospital-settings.md"
  - "docs/superpowers/plans/2026-07-23-hospital-settings-live-implementation.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-005"
  - "HOSPITAL-ADMIN-LIVE-PR-012"
updated: "2026-07-23"
---

# Hospital Settings Screen Split

## Goal

Replace the combined basic-settings page with three independent CDS V2-aligned
screens while preserving the existing operating-hours persistence boundary.

## Scope

- Add distinct side-panel items for `병원 기본 설정`, `연락처 및 채널`, and
  `운영시간 관리`; they switch screens and do not scroll one page.
- Group the hospital-admin side panel under `병원 설정`, `조직 및 접근`, and
  `진료 카탈로그`.
- Keep `section=settings` as the compatible hospital-basic deep link and add
  `section=settings-contact` and `section=settings-hours`.
- Rebuild the content with existing EMR/shadcn components and the approved
  prototype measurements/copy.
- Add the shadcn `ToggleGroup` primitive for the seven operating-day controls.
- Remove per-row operating switches and the operating switch from the time
  dialog. Closed-day time actions are disabled.
- Keep operating hours and public-holiday/date exceptions on one
  `운영시간 관리` screen.
- Add the logo hover/focus edit affordance and Dialog shell; persistence lands
  in the dependent live logo work item.
- Use a multi-line `Textarea` for the customer guide memo.
- Remove the page breadcrumb/toolbar.
- Use Sonner toasts for explicit action outcomes and formal Korean UX copy.

## Out Of Scope

- New profile/contact tables, RPCs, or live writes.
- Private Storage, image normalization, or signed upload.
- Operator processing of a registered-information request.
- Renaming or replacing the existing operating-hours API/RPC/tables.
- Unrelated hospital-admin concept screens or order-catalog behavior.

## Done When

- Every approved side-panel item opens a distinct screen with a stable active
  state and browser-compatible query section.
- Existing operating-hours reads/writes still use the current live boundary.
- Weekday selection has one control source only; time editing has no redundant
  operating toggle.
- Logo hover/focus, Dialog focus return, contact memo height, exception empty
  state, dirty navigation guard, action toasts, and responsive stacking match
  the approved prototype.
- Shared side-panel group labels are additive and verified in Storybook.
- Focused UI/model tests, typecheck, lint, Storybook build, docs, UX-copy, and
  diff checks pass.

## Verification

- `npx playwright test tests/hospital-basic-settings-model.spec.ts tests/hospital-admin.spec.ts --project=chromium --grep "hospital settings" --reporter=line`
- `npx tsc --noEmit`
- `npx eslint src/components/emr/module-list-side-panel.tsx src/components/emr/module-list-side-panel.stories.tsx src/features/hospital-admin/module.tsx src/features/hospital-admin/settings tests/hospital-admin.spec.ts tests/hospital-basic-settings-model.spec.ts`
- `npm run build-storybook`
- `npm run docs:check`
- `npm run ux-copy:check`
- `git diff --check`

## Handoff Notes

- The screen split is intentionally separated from new persistence so visual
  and navigation regressions can be reviewed before schema/storage rollout.
- Existing shadcn primitives are reused. `ToggleGroup` is the only new generated
  primitive; no new package dependency is planned.

## Implementation Result

Implemented and locally verified on 2026-07-23.

- `병원 기본 설정`, `연락처 및 채널`, and `운영시간 관리` now render as
  independent screens instead of anchors in one long page.
- The hospital-admin panel uses the approved three information groups and no
  page breadcrumb/toolbar remains.
- Weekday open/closed state has one `ToggleGroup` source; day rows and the time
  Dialog contain no duplicate switches.
- The contact memo uses a resizable multiline `Textarea`; the logo trigger has
  matching hover/focus edit affordances and Dialog focus return.
- The dedicated settings browser spec passed 4 tests and the latest-main
  hospital-admin regression spec passed 29 tests. Lint, TypeScript, production
  build, Storybook build, docs, and Korean honorific checks passed.
- Remote deployment and review remain intentionally unclaimed.
