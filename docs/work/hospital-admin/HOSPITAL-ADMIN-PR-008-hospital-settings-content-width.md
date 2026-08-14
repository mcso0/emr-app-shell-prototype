---
id: "HOSPITAL-ADMIN-PR-008"
status: "implemented"
area: "hospital-admin"
priority: "P1"
target_pr: "Browser comment / shared hospital settings content width"
completion_report: "docs/completed/hospital-admin/2026-07-27-hospital-settings-content-width-report.html"
source_docs:
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/product/features/hospital-admin/workspace-vital-settings.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-006"
  - "HOSPITAL-ADMIN-PR-007"
updated: "2026-07-27"
---

# Hospital Settings Content Width

## Goal

Unify the maximum content width of the major hospital-admin settings screens
at `720px` without changing their information, persistence, permission, or
interaction contracts.

## Scope

- Add one hospital-settings content-width token and consume it from the shared
  settings page shell, space management, and role/permission management.
- Apply the contract to hospital basic settings, contact and channels,
  operating hours, space management, vital settings, and role/permission
  hub/detail screens.
- Keep content centered and preserve existing full-width shrink behavior and
  mobile gutters.
- Keep the role/permission outer wrapper at up to `752px`, including its
  existing `16px` side gutters, while constraining the actual settings surfaces
  to `720px`.
- Keep the shared settings change bar's independent `808px` boundary unchanged.

## Out Of Scope

- Card, form, button, copy, navigation, dialog, data, API, RLS, audit, or
  permission behavior changes.
- New dependencies or a broad hospital-admin layout refactor.
- Rewriting historical completion reports that recorded the earlier `920px`
  implementation.

## Verification

- Desktop DOM geometry checks cover all six target screens and the
  role/permission hub, role, job-position, and work-default detail surfaces.
- Compact checks cover hospital settings at `390px`, space management, and
  role/permission screens without horizontal overflow.
- Focused Playwright geometry and compact regression run: 8/8 passed, including
  the vital-settings reset Dialog flow.
- Final lint, typecheck, build, docs, secret, and diff checks are recorded in
  the pull request and completion report.

## Handoff Notes

- `--clair-layout-hospital-settings-content` is the shared contract for these
  hospital-admin settings surfaces.
- The role/permission screen explicitly uses a shrinkable grid track so long
  metadata cannot force the `720px` surface wider.
- The vital-settings reset regression uses the ordinary pointer path; compact
  keyboard coverage remains in the dedicated role/permission scenario.
