---
id: "HOSPITAL-ADMIN-PR-006"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / local-first role and permission management UI"
source_docs:
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-002"
updated: "2026-07-26"
---

# Role and Permission Management UI

## Goal

Replace the static role-work concept with a dedicated, local-first `역할 및 권한` surface. Hospital administrators can inspect system roles, safely manage custom role and job catalogs, and set browser-local work defaults without claiming a server authorization change.

## Delivered Scope

- `권한 역할`, `직무`, and `업무 기본값` as one grouped settings hub that opens independent detail screens in the existing hospital-admin panel.
- Role summary/detail view, grouped permission explanations, locked system roles, and assigned-member sheet.
- Human Review refinement: match the hospital-basic-settings `920px` content boundary, express detail state with `roleSettings` in the URL, and keep permission categories visible only inside the `권한 역할` detail screen.
- Role-item refinement: replace the detached segmented selector with at-most-one-open role items. Each item shows all assigned member names and owns its expanded member summary and permission sections; selecting the open item collapses it.
- Permission rows use switches with explicit `허용` / `차단` text. System roles remain disabled; custom roles support inline draft, cancel, and save against the existing safe allow-list.
- Custom role creation/editing limited to the existing safe allow-only permission set.
- Job creation/editing outside the invitation sheet; invitations only assign a person to an existing role and job.
- Workspace-scoped browser storage for work defaults, with save, cancel, reload, and cross-tab synchronization.
- Legacy effective role/job key helpers shared by member detail, editor initialization, mutation payload, and last-owner protection.
- Read-only `role_permission:view` fixture coverage; no API, RPC, resolver, RLS, or remote deployment changes.

## Intentionally Out Of Scope

- Server persistence for role and job catalogs, including migrations, RLS, RPC, and API/resolver changes.
- Claiming that client-side controls are an authorization boundary.
- Connecting work defaults to real work routing or task assignment.
- Resolving the legacy keyless `hospital_admin` ambiguity in durable data. This requires explicit owner metadata and server enforcement in `AUTH-PR-044`.

## Verification

- Passed: focused role, invitation, non-admin, work-default, compact-layout, and keyboard Playwright coverage.
- Passed: role permission view-model and legacy effective-key regression coverage.
- Passed: targeted ESLint and TypeScript checks.
- Passed: `npm run build`, `npm run docs:check`, and `git diff --check`.
- 2026-07-22 hub/detail refinement: focused coverage now targets the `920px` boundary, URL-backed detail navigation, browser back, role tabs, visible permission sections, mobile overflow, and keyboard activation.
- Broader hospital-admin run on 2026-07-22: 25/26 passed. The unrelated hospital-basic-settings save test repeatedly timed out while waiting for the existing `대표 전화 *` label; the role/permission tests stayed green.
- 2026-07-23 role-item refinement: focused Playwright coverage passed for exclusive role expansion, system-role read-only switches, custom-role inline permission save, member-management navigation, work-default persistence, and URL/history behavior.
- 2026-07-23 browser QA: `1440×1000` and `390×844` both had no horizontal overflow; role changes kept at most one panel open; no console errors were reported.
- 2026-07-23 human-review correction: the open role item now collapses when selected again. Focused Playwright, targeted ESLint, TypeScript, and authenticated local-browser verification passed.
- 2026-07-23 UX audit follow-up: 7 focused Playwright scenarios passed for deterministic detail back, dirty role/work-default navigation, browser-back draft preservation, cross-tab saved defaults, static system jobs, and compact keyboard behavior. Authenticated local-browser verification also passed.
- 2026-07-26 CDS.V2 alignment: verified Figma nodes `27804:125858`, `27804:127072`, `27804:128057`, `27804:128167`, and `27804:128277` with node metadata and screenshots, then applied their shared `920px` surface, `85px` row, title, spacing, border, radius, shadow, icon, badge, and expanded-permission patterns without changing product copy or behavior.
- 2026-07-26 focused verification: 9 Playwright scenarios passed, including exact desktop DOM geometry, narrow-viewport overflow, read-only access, and custom role/job catalog checks. Authenticated local-browser review covered all four screens with no console warnings or errors.

## Handoff

- Browser-local state is scoped by workspace ID and may be unavailable after browser storage is cleared.
- System roles remain read-only. Custom roles cannot select owner-only or unknown permissions.
- The default screen is a quiet three-row settings hub. Each row opens one independent detail screen and browser back returns to the hub.
- Permission categories are not accordions. The selected role's categories and rows remain visible in the role detail screen, while system-role controls stay disabled and explicit.
- Role headers show live workspace member names when assignments exist. Empty assignment data is shown explicitly rather than replaced with sample names.
- Result report: `docs/completed/hospital-admin/2026-07-11-role-permission-management-ui-report.html`.
- Layout refinement report: `docs/completed/hospital-admin/2026-07-22-role-permission-layout-refinement-report.html`.
- Role-item implementation report: `docs/completed/hospital-admin/2026-07-23-role-permission-role-item-implementation-report.html`.

## 2026-07-22 Human Review Follow-up

- Human review found that the segmented `소유자 / 관리자 / 일반` selector and the permission content below do not read as one connected setting unit.
- The next candidate keeps the top-level hub-to-detail navigation, but changes role selection inside the detail page to a one-open role-item accordion. Each expanded role owns its member names, role summary, and permission rows.
- Permission checkboxes should become switches. System roles remain disabled with explicit `허용 / 차단` text; only custom roles may edit and save.
- Permission categories remain visible inside the selected role and must not become nested accordions.
- The reviewed structure was implemented on 2026-07-23 without changing permission policy, API, RLS, or assignment behavior.
- Interactive review report: `docs/completed/hospital-admin/2026-07-22-role-permission-role-item-structure-review.html`.

## 2026-07-23 UX Audit Follow-up

- Fixed locally: selecting the currently open role item collapses it; selecting another role still closes the previous item and opens only the new item.
- Fixed locally: the detail header back action now deterministically returns to the settings hub, including direct deep-link entry.
- Fixed locally: dirty role/work-default navigation uses the existing confirmation dialog; browser back preserves the draft and the hub identifies unsaved changes.
- Fixed locally: system and read-only job-position rows are static. Only editable custom positions expose button, chevron, hover, and focus affordances.

## 2026-07-26 CDS.V2 Figma Alignment

- Figma remains the visual source of truth; the existing product remains the source of truth for copy, information architecture, URLs, permissions, persistence, and all loading/error/empty/read-only behavior.
- The two role nodes represent collapsed and expanded role-list states. Both are covered by the existing exclusive open/close interaction and the updated inline permission surface.
- Current product differences are intentional: the hub and detail title remain `권한 역할`, and work defaults remain the existing four fields even though the Figma reference contains different sample copy and an additional example row.
- Existing CLAiR semantic variables, shared buttons, badges, switches, selects, dialogs, fields, and icon components were reused. No dependency, API, migration, RLS, permission-model, or data-model change was introduced.

## 2026-07-26 Role Detail Final Parity

- Preserved the current product copy, URL flow, role data, permission data, exclusive open/close behavior, dialogs, and member-management entry.
- Matched the confirmed role-detail surfaces and geometry: page `#FCFCFC`, expanded detail `rgba(0,0,0,0.02)`, `84px` role-row content height, `44px` detail header, and `24px` detail padding/gap.
- Matched the action and permission dimensions: `129×32px` custom-role action, `113×32px` member action with edit icon, `872px` permission lists, and `75px` permission-row content height.
- Rejected the earlier `90px` vertical-offset finding after matching the expanded role state: it came from comparing Figma's first expanded role with a runtime capture of the second expanded role.
- No API, persistence, permission-policy, dependency, Figma, or deployment changes are included.
