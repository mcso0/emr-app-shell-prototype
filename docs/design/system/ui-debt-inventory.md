---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-140"
linear_project: "00 UI 시스템 인벤토리 및 리팩토링 기준"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/qa/2026-05-10-ui-consistency-audit.md"
  - "docs/engineering/current-status.md"
---

# UI Debt Inventory

This inventory records current UI hardcoding, duplicated patterns, oversized UI files, and reusable component candidates for the `[UI/UX] 화면 컴포넌트 오딧 및 리팩토링` initiative.

It is audit-only. Do not treat this document as permission to refactor multiple screens in one issue. Screen projects should use it to shortlist scoped work and then verify behavior locally.

## Scan Method

Commands used:

- `find src/features src/components/emr src/components/ui src/shell src/app -type f \( -name '*.tsx' -o -name '*.ts' \) -print0 | xargs -0 wc -l | sort -nr | head -40`
- `rg -c "<button|<input|<select|<textarea|<table|<thead|<tbody|<tr|<td|<th" src/features src/components/emr src/components/ui src/shell src/app -g '*.tsx'`
- `rg -c "\b(min-w|w|h|max-w|max-h|grid-cols|grid-rows|basis|flex-\[|text)-\[[^\]]+\]|style=\{\{" src/features src/components/emr src/components/ui src/shell src/app -g '*.tsx'`
- `rg -c "className=.*(status-|Badge|badge|chip|tone|danger|warning|success|info|destructive)|const .*tone|const .*status|variant=\{.*destructive|variant=\"destructive\"" src/features src/components/emr src/shell src/app -g '*.tsx'`
- `rg -c "표시할|없습니다|검색 결과가 없습니다|Loading|loading|로딩|준비 중|error|Error|Skeleton|empty|Empty" src/features src/components/emr src/shell src/app -g '*.tsx'`

The repo had unrelated dirty worktree changes during this audit. Findings are based on the current local source tree and should be rechecked at each screen project start.

## Oversized UI Files

| File | Lines | Primary risk | Recommended destination |
|---|---:|---|---|
| `src/features/reception/profile-drawer.tsx` | 3789 | patient/guardian drawer, registration dialogs, forms, popovers, validation panels, server mutation state, and profile rendering live together | split feature-local first; promote only stable form field, registration dialog shell, and profile section patterns later |
| `src/features/chart/module.tsx` | 3518 | queue, patient context, SOAP editor, diagnosis search, order table, confirmation dialogs, empty state, and workflow actions share one module | split by chart workflow area; reuse existing EMR queue/history/status/dialog primitives before new components |
| `src/features/reception/module.tsx` | 3215 | calendar, queue side panel, walk-in dialog, appointment drawer, reception drawer, raw controls, and popovers are coupled | split feature-local calendar/dialog/drawer first; use existing `EmrSidePanelCard` and shadcn forms where practical |
| `src/features/lab-imaging/module.tsx` | 2448 | lab and imaging UI share a file while result table/chart, media, reading panels, queue/history, and dialogs have different domain semantics | split lab vs imaging feature-local surfaces before shared extraction |
| `src/features/home/components/home-kanban-workspace.tsx` | 1326 | dashboard/work-board modes, filters, grouped task cards, detail panel, and table view are one component | split feature-local board controls, cards, detail panel, and table view; consider EMR work-card only after screen passes |
| `src/features/hospital-admin/module.tsx` | 1235 | catalog table, filters, drawer form, destructive confirmation, and text side nav are coupled | reuse shadcn `Table`, `Dialog`, `Input`, `Select`, and existing `EmrTextSidePanel`; split drawer fields locally first |
| `src/features/billing/module.tsx` | 1235 | billing list, invoice edit table, payment method, summary panel, and persistence state surfaces are coupled | keep billing semantics local; consider shared invoice table wrapper only after billing project |
| `src/features/auth/workspace-membership-management.tsx` | 937 | membership table, role edit dialog, confirm dialogs, status/error panels, and auth-sensitive UI live together | defer broad extraction; auth/security behavior must remain unchanged |
| `src/features/dispensing/module.tsx` | 847 | lower risk because it already uses many EMR primitives, but drawer and action/status handling remain local | reuse as reference for queue/table/panel adoption |
| `src/shell/global-command-palette.tsx` | 617 | indexing, filtering, dialog layout, keyboard active item behavior, and result row UI are coupled | project `08`; extract command result row and search indexing carefully |

## Hardcoded Layout Concentration

Top arbitrary/fixed layout counts:

| File | Count | Notes |
|---|---:|---|
| `src/features/reception/profile-drawer.tsx` | 116 | dialog widths, field sizing, icon sizes, text sizes, selected rows, popover sizing |
| `src/features/lab-imaging/module.tsx` | 111 | result table/chart widths, side panel sizing, right panel layout, text sizes |
| `src/features/reception/module.tsx` | 100 | calendar grid, queue cards, dialog widths, popover widths, raw date controls |
| `src/features/home/components/home-kanban-workspace.tsx` | 88 | board columns, right panel width, task cards, table columns, filter widths |
| `src/features/hospital-admin/module.tsx` | 66 | management table columns, drawer field layout, fixed control widths |
| `src/features/chart/module.tsx` | 64 | SOAP/order split layout, popover widths, order table columns, dialog widths |
| `src/features/billing/module.tsx` | 34 | invoice table widths, summary panel heights, amount/status text hierarchy |
| `src/features/inpatient/module.tsx` | 33 | ward table columns, KPI cards, popover/filter widths |
| `src/features/auth/workspace-membership-management.tsx` | 32 | membership table and role dialog sizing |
| `src/features/auth/login-form.tsx` | 27 | login form and role card dimensions |

Recommended rule: promote only repeated role-level values, such as table column recipes, side panel widths, compact dialog shells, and dense text roles. Keep one-off clinical or screen-specific layout constraints local and document them as intentional exceptions.

## Raw Control And Markup Findings

Raw control counts are low compared with the app size, but concentrated in high-risk screens:

| File | Raw controls found | Recommendation |
|---|---:|---|
| `src/features/reception/module.tsx` | 10 | replace simple raw buttons with `Button` where semantics match; keep calendar grid buttons local until calendar behavior is isolated |
| `src/features/reception/profile-drawer.tsx` | 9 | standardize dialog close/search row buttons through existing `Button`/feature-local wrappers |
| `src/features/chart/module.tsx` | 7 | editor toolbar and diagnosis search rows should become feature-local components before shared extraction |
| `src/features/home/components/home-kanban-workspace.tsx` | 7 | filter/action buttons should use existing `Button`, `SegmentedControl`, `Select`, and table primitives consistently |
| `src/shell/nav-rail.tsx` | 3 | nav rail icon buttons are shell-specific; optimize under project `08` rather than generic shared UI |
| `src/shell/global-command-palette.tsx` | 1 | command result row is shell-specific and should be handled in project `08` |

Existing shared raw controls in `src/components/ui/*` and `src/components/emr/*` are expected because they implement primitives.

## Component Family Inventory

| Family | Concrete files | Current pattern | Recommended destination |
|---|---|---|---|
| Dense tables | `src/features/chart/module.tsx`, `src/features/billing/module.tsx`, `src/features/hospital-admin/module.tsx`, `src/features/inpatient/module.tsx`, `src/features/home/components/home-kanban-workspace.tsx`, `src/features/customer/module.tsx`, `src/components/emr/emr-data-table.tsx`, `src/components/ui/table.tsx` | shared `Table` exists; `EmrDataTable` is order-specific and not a generic data table despite its name; table widths and empty rows are local | use shadcn `Table` for generic tables; keep `EmrDataTable` order/dispensing-specific until redesigned; consider a new EMR table recipe guide before a new component |
| Forms and field groups | `src/features/reception/profile-drawer.tsx`, `src/features/reception/module.tsx`, `src/features/hospital-admin/module.tsx`, `src/features/auth/login-form.tsx`, `src/features/auth/personal-profile-settings.tsx`, `src/features/auth/workspace-onboarding.tsx` | shadcn `Field`, `Input`, `Select`, `Textarea`, `Switch` exist, but feature-local field wrappers differ | use existing shadcn primitives first; consider a new EMR `FieldRow` or `DrawerField` only after profile, hospital admin, and auth forms are compared |
| Dialogs and confirmations | `src/components/emr/confirm-dialog-content.tsx`, `src/features/chart/module.tsx`, `src/features/reception/module.tsx`, `src/features/reception/profile-drawer.tsx`, `src/features/auth/workspace-membership-management.tsx`, `src/features/hospital-admin/module.tsx`, `src/features/lab-imaging/module.tsx` | confirm dialogs use `EmrConfirmDialogContent`, but large create/edit dialogs define local header/body/footer shells | use existing `EmrConfirmDialogContent` for confirmations; keep workflow dialogs feature-local; consider a new EMR dialog shell only if reception/profile/hospital-admin share the same structure after split |
| Side panels and list items | `src/components/emr/subpanel.tsx`, `src/components/emr/side-panel-card.tsx`, `src/components/emr/order-queue-side-panel.tsx`, `src/components/emr/content-history-list.tsx`, `src/components/emr/text-side-panel.tsx`, `src/features/reception/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/home/components/home-kanban-workspace.tsx` | strong EMR primitives already exist; some feature modules still implement local cards, status grouping, and meta badges | prefer existing EMR primitives; add variants only when a second screen proves the same role cannot be expressed |
| Status badges and chips | `src/components/emr/status-badge.tsx`, `src/features/reception/module.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/home/components/*.tsx`, `src/features/customer/module.tsx`, `src/features/inpatient/module.tsx`, `src/features/auth/workspace-membership-management.tsx` | many local `tone`/status maps use semantic tokens; `EmrStatusBadge` is label-based and domain-limited | keep status meaning local when domain-specific; consider a new status tone resolver API before expanding `EmrStatusBadge` |
| Search, filters, and command rows | `src/shell/global-command-palette.tsx`, `src/features/chart/module.tsx`, `src/features/reception/profile-drawer.tsx`, `src/features/reception/module.tsx`, `src/features/home/components/home-kanban-workspace.tsx`, `src/features/customer/module.tsx` | shadcn `Input`, `Popover`, `DropdownMenu`, `SegmentedControl`, `Select` exist; result row rendering is local | use shadcn primitives; extract feature-local result rows before any global search result component |
| Loading, empty, and error states | `src/features/reception/profile-drawer.tsx`, `src/features/chart/module.tsx`, `src/features/reception/module.tsx`, `src/features/billing/module.tsx`, `src/features/auth/workspace-membership-management.tsx`, `src/features/home/*`, `src/app/profile/page.tsx`, `src/app/workspace/new/page.tsx` | `Skeleton` exists but many empty/error messages are custom local blocks | keep copy local; consider EMR empty/error panel primitives only after project `08` feedback UI audit |
| Navigation and shell controls | `src/shell/nav-rail.tsx`, `src/shell/workspace-tabs-bar.tsx`, `src/shell/workspace-chrome-tabs.tsx`, `src/shell/top-menu.tsx`, `src/shell/global-command-palette.tsx` | shell controls carry route/tab semantics and custom sizing | handle in project `08`; do not generalize into feature components |

## Strongest Extraction Shortlist

| Candidate | Evidence | Recommendation | First project |
|---|---|---|---|
| Chart workflow component split | `src/features/chart/module.tsx` has 3518 lines and 64 arbitrary/fixed layout hits | split into feature-local SOAP, diagnosis, order table, and action dialog units; reuse existing EMR queue/history/status/dialog primitives | `01` |
| Reception profile and registration split | `src/features/reception/profile-drawer.tsx` has 3789 lines, 116 arbitrary/fixed layout hits, 77 empty/error/loading copy hits | split profile sections and registration dialogs locally; compare form field wrappers before shared extraction | `05` |
| Reception calendar and walk-in dialog split | `src/features/reception/module.tsx` has 3215 lines, 100 arbitrary/fixed layout hits, and the highest raw-control count | split calendar, queue, walk-in dialog, and drawer logic; defer shared calendar abstraction | `05` |
| Lab/imaging separation | `src/features/lab-imaging/module.tsx` has 2448 lines and 111 arbitrary/fixed layout hits | split lab and imaging surfaces first; avoid forcing shared abstractions across different clinical meanings | `03` |
| Home work-board decomposition | `src/features/home/components/home-kanban-workspace.tsx` has 1326 lines and 88 arbitrary/fixed layout hits | split filters, board column, task card, detail panel, and table view locally | `04` |
| Hospital admin drawer fields | `src/features/hospital-admin/module.tsx` has local `DrawerField` and `DrawerSelect`, table/filter/drawer coupling, and 66 arbitrary/fixed layout hits | keep feature-local initially; compare with profile/auth fields before promoting to EMR | `06` |
| Global command palette result rows | `src/shell/global-command-palette.tsx` has 617 lines and combines index building, filtering, dialog, keyboard behavior, and row rendering | split search indexing from row rendering; preserve keyboard/focus behavior | `08` |

## Defer Or Split Carefully

- `src/features/auth/workspace-membership-management.tsx`: UI duplication exists, but auth/session/security behavior must not change. Refactor only in project `07` with focused regression coverage.
- `src/components/emr/emr-data-table.tsx`: name suggests generic reuse, but implementation is order/technician/status-specific. Do not force unrelated tables into it.
- `src/components/emr/status-badge.tsx`: current label-based Korean status map works for a narrow order/status set. Expand only through an explicit tone API or domain mapper.
- `src/shell/workspace-frame.tsx`, `src/shell/workspace-tabs-bar.tsx`, and `src/shell/workspace-chrome-tabs.tsx`: shell behavior is cross-cutting. Any UI extraction must preserve tab route history, drawer routing, and panel layout semantics.
- Local fixed widths in dense tables should not be removed blindly. Some are intentional column readability constraints and need responsive overflow QA before changes.

## Recommended Starting Point

After project `00` finishes, start screen-level refactoring with project `01` Chart.

Reason: Chart has the clearest combination of oversized file risk, visible dense workspace complexity, existing EMR primitives to reuse, and manageable user-facing regression checks. It is also earlier in the Linear sequence and can establish the pattern for later clinical and billing screens without touching DB, live persistence, or server enforcement.
