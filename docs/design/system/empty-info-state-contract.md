---
status: "approved"
area: "design-system"
updated: "2026-07-05"
linear_issue: "DEN-434"
linear_project: "공통 UX/UI 기준 정리 및 화면 적용"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/global-feedback-ui-audit.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md"
---

# Empty State And Info Box Contract

This contract defines how CLAiR EMR distinguishes empty states from info boxes, alerts, loading states, and permission or scope boundaries. It is the source of truth for follow-up UI work after DEN-434.

## Intent

CLAiR EMR screens are dense and clinical. A blank area must not force staff to guess whether data is still loading, unavailable, hidden by filters, outside the current workspace scope, or simply not created yet.

Empty states explain the missing object and the next useful action. Info boxes explain context, prerequisites, boundaries, or caution while the workflow remains available.

## Do Not Confuse These States

| State | Meaning | Use | Do not use |
| --- | --- | --- | --- |
| Loading | data is being fetched or prepared | `Skeleton` or local loading copy when the domain object matters | Empty state copy such as "no data" |
| Empty state | the expected object list or section has no visible items | Empty state pattern from this contract | Error, degraded, or permission warning copy |
| Info box | the workflow needs context, guidance, precondition, or boundary explanation | Info box pattern from this contract | Blocking error or destructive confirmation |
| Inline alert | read/save failure, degraded live/demo state, permission blocker, risky preflight | `EmrInlineAlert` when persistent feedback or recovery action is needed | Passive guidance that does not require attention |
| Field error | one input is invalid | `FieldError` | Panel-level empty or info state |
| Toast | transient confirmation or mock/session-only feedback | Sonner toast | Persistent empty, warning, or recovery state |

## Empty State Types

| Type | Use when | Required copy | Default action | Visual strength |
| --- | --- | --- | --- | --- |
| Not created yet | the workspace or section is valid but no item exists yet | object + creation context | create/add action when allowed | E0 panel, E1 action |
| No search results | query returns no matches | query or searched object + reset option | clear search, broaden search, or create new record | E0 panel, E1 action |
| No filtered results | filters hide all visible rows | active filter context | clear filters or adjust filter | E0 panel, E1 action |
| No scope result | current date, workspace, patient, encounter, or module scope has no visible data | scope name + how to change scope | change date/scope or go to source workflow | E0 panel, E1 action |
| No permission or range access | user cannot see items in the current role/scope | neutral explanation without claiming security completion | request/admin/workspace resolution if available | E0 panel or warning/info box depending severity |
| Pending upstream state | upstream workflow has not produced the object yet | upstream dependency + source screen | go to source workflow or wait | E0 panel, optional info tone |

Empty states should not imply live persistence, server enforcement, or permission guarantees when the app is still mock/local-first for that boundary.

## Info Box Types

| Type | Use when | Tone | Action rule |
| --- | --- | --- | --- |
| General guidance | short explanation helps the user interpret the section | neutral/info | optional secondary action |
| Work prerequisite | the user needs a prior step before this section becomes useful | info/warning depending risk | one clear next action when available |
| Caution | action is available but needs care, review, or clinical/business attention | warning | action only when it reduces risk |
| System boundary | mock/local-first/live boundary, future-scope feature, or disconnected provider | info/warning | action may open details or source workflow; do not imply live completion |
| Persistent success | in-context confirmation after a local action where toast is not enough | success | optional verify/view action |
| Unavailable action explanation | a visible action is intentionally disabled or future-scoped | neutral/info | explain why and what to do instead |

Use `EmrInlineAlert` instead of a passive info box when the state is a failure, degraded read/write, permission blocker, or recovery path.

## Layout And Visual Rules

- Empty states and info boxes are in-flow surfaces, so they default to E0 flat from `border-shadow-depth-contract.md`.
- Primary action controls inside those surfaces use E1 shadow when enabled.
- Use a small icon only when it improves scanning; do not rely on icon alone.
- Keep the title short: one line when possible.
- Keep body copy to one or two short sentences in dense screen contexts.
- Use status tones only when the state has semantic meaning. Neutral empty states should not look like warnings.
- Put the state where the missing content would have appeared, not in global chrome.
- If an upstream failure caused the empty area, place the alert above the stale or empty panel.

## Copy Shape

Empty state copy should answer:

1. What object is missing?
2. Why is it missing, if known?
3. What is the next useful action?

Info box copy should answer:

1. What should the user know before continuing?
2. Is this guidance, caution, system boundary, or success?
3. Is there one useful action, or should the box remain passive?

Avoid vague copy such as "No data", "Empty", "준비 중", or "표시할 항목이 없습니다" when the user needs to know whether to create, search again, change filters, wait, or go to another workflow.

## Component Ownership

Do not create a shared component merely because the copy repeats.

Use this order:

1. Keep feature-local markup for one-off empty or info states tied to one workflow.
2. Use `EmrInlineAlert` for persistent alert, degraded, permission, and recovery states.
3. Consider a small `EmrEmptyState` only after at least two screen families share the same layout contract.
4. Consider an `EmrInfoBox` only after info, prerequisite, caution, and unavailable patterns repeat across screen families without feature-specific behavior.

Shared components must expose slots for title, body, icon, action, secondary action, tone, and test IDs without owning route, permission, persistence, or logging behavior.

As of `DESIGN-SYSTEM-PR-070`, `EmrEmptyState` covers the shared empty-state layer for repeated queue, content, drawer, table, widget, and global-shell surfaces. It uses `kind`, `surface`, and `priority` to keep state reason, placement, and CTA ownership explicit. Screen adoption remains separate from the component contract.

## Surface Adoption Rules

`EmrEmptyState` adoption must be surface-led. Do not replace every local "없습니다" message at once.

| Surface | Current default | `EmrEmptyState` adoption rule | Action ownership |
| --- | --- | --- | --- |
| Queue side panel | Keep `EmrQueueEmptyState` compact by default | Do not replace with the standard 64px icon pattern until a queue-specific compact variant is approved. Queue empty states should stay quiet and list-local. | Queue may own only local recovery such as clearing search or filters. It should not own screen-level create/navigation actions when content is also empty. |
| Content body | Adopt for main operational absence states | Use `surface="content"` when the main work area has no selected object, no upstream work object, or no scope result. When no upstream work object exists in the operational modules that have adopted this pattern, render the design-system content empty state in the main content surface and suppress the content aside/history panel. | Content body carries the primary information/action weight for the screen-level absence state. Queue/list placeholders remain compact supporting states and do not own the primary screen-level action. |
| Table body | Preferred second pilot surface | Use `surface="table"` for no rows, no filter results, or no search results inside table/list bodies when the table layout can preserve header/scroll alignment. Keep very dense tables on the existing empty row until spacing is verified. | Table owns local recovery such as reset filters. It should not trigger source workflow navigation unless the whole content surface is table-only. |
| Drawer/detail panel | Adopt selectively | Use `surface="drawer"` for selected-object absence or passive detail guidance. Use `EmrInlineAlert` instead for permission blockers, read failures, failed saves, or degraded data. | Drawer should not own primary workflow creation. It may own close, retry, or local selection guidance. |
| Widget/card | Adopt selectively | Use `surface="widget"` for dashboard cards and small summaries only when the copy needs an icon and repeated structure. Plain one-line widget empty copy is still allowed. | Widget actions stay secondary unless the widget is explicitly a launcher. |
| Global shell/module | Last resort | Use only when the whole module or workspace surface cannot show its normal structure. Do not use it for transient loading, API failure, or permission denial that needs alert treatment. | Global shell may own a primary action only when there is no more specific content owner. |

## Current Empty-State Inventory

This inventory is the pre-implementation checkpoint for `DESIGN-SYSTEM-PR-070`. It names representative existing owners and the initial adoption posture.

| Area | Current owner / example | Current state | Adoption posture |
| --- | --- | --- | --- |
| Shared queue panels | `src/components/emr/subpanel.tsx` `EmrQueueEmptyState`, `EmrListSearchEmptyState`, `EmrQueueLoadingState` | Compact 40px queue placeholder used by reception, chart/order queue, lab/imaging, billing, and related side panels | Keep as-is for the first implementation pilot. Revisit only through a compact queue variant. |
| Reception queue | `src/features/reception/module.tsx`, `src/features/reception/reception-list-search.tsx` | `접수/예약이 없습니다`, shared queue search empty | Keep existing compact queue behavior. Do not add create CTA inside the queue. |
| Shared order queues | `src/components/emr/order-queue-side-panel.tsx`, `src/features/lab-imaging/module.tsx`, `src/features/billing/module.tsx` | `조건에 맞는 ... 업무가 없습니다` or `... 업무가 없습니다` through queue wrappers | Keep existing queue wrapper; use future compact variant only after visual QA. |
| Chart content body | `src/features/chart/module.tsx` `EmptyChartState` | `EmrEmptyState` content pilot for selected patient absence in the main content area | Adopted as the first content-body pilot on 2026-07-01. It stays passive because queue selection is the next step. If queue is also empty in a future flow, content should own any source-workflow CTA. |
| Chart order table | `src/features/chart/module.tsx` order table empty row | `EmrEmptyState` table pilot for filter/category-empty order rows | Adopted as the first table-body pilot on 2026-07-01. It keeps local recovery copy and no CTA until a table-local reset action is wired. |
| Customer tables | `src/features/customer/module.tsx` `CustomerDataTable` | `EmrEmptyState` table surface for no-data and filter-empty rows | Adopted as a table-body follow-up after the chart pilot. Search/filter/reset behavior remains owned by `CustomerDataTable`; drawer/profile behavior is unchanged. |
| Hospital admin tables | `src/features/hospital-admin/module.tsx` | Order catalog uses `EmrEmptyState` table surface for no-data and filter/search-empty rows; audit log keeps its existing local empty row | Order catalog adopted as a table-body follow-up after the chart pilot. Audit log remains a later surface because it has a different review context. |
| Dispensing/treatment content body | `src/features/dispensing/module.tsx` | Main content true-empty/no-selection branches use `EmrEmptyState` with `surface="content"`; no-upstream-work states suppress the history aside | Adopted for the operational content surface. Shared queue panels remain on compact queue placeholders. Selected work item states keep their detail/history surfaces where applicable. |
| Lab content body | `src/features/lab-imaging/module.tsx` lab branch | Main content true-empty/no-selection branches use `EmrEmptyState` with `surface="content"`; no-upstream-work states suppress the lab history aside | Adopted for the operational content surface. Lab result table empty, permission, retry, save, and catalog states remain separate. Selected detail states keep their aside/history where applicable. |
| Imaging content body | `src/features/lab-imaging/module.tsx` imaging branch | Main content true-empty/no-selection branches use `EmrEmptyState` with `surface="content"`; no-upstream-work states suppress the imaging history aside | Adopted for the operational content surface. Shared queue panels remain compact. Selected detail states keep their aside/history where applicable. |
| Billing content body | `src/features/billing/module.tsx` | Main content true-empty/no-selection branches use `EmrEmptyState` with `surface="content"`; no-upstream-work states suppress the billing history aside | Adopted for the operational content surface without changing checkout, ledger, payment, or API state handling. Selected invoice states keep their aside/history where applicable. |
| Home and notification widgets | `src/features/home/components/*`, `src/features/notifications/global-notification-drawer.tsx` | Home work-status source-empty now uses `EmrEmptyState` in the main board and `EmrQueueEmptyState` in the side panel; small notification/widget empty messages remain local | Adopt Home work-status source-empty through the operational queue-empty contract. Keep unrelated notification/widget one-line empties local until repeated structure needs icon/copy/action. |
| Reception profile drawer | `src/features/reception/profile-drawer.tsx` | Not-found, no linked item, no history, and permission-like copy | Do not bulk replace. Classify each case as drawer empty, info box, inline alert, or field/toast feedback first. |
| Lab/imaging detail content | `src/features/lab-imaging/module.tsx` | Lab result input table uses `EmrEmptyState` for true-empty result rows; linked result, preview, permission, save, and retry states remain separate | True-empty lab result rows adopted as a table-body follow-up. Permission/save failure and retry states remain `EmrInlineAlert` or feature-local recovery UI. |

## Initial Implementation Order

1. Pilot `EmrEmptyState` in one content-body absence case and one table-body no-result case.
2. Verify visual weight in the actual app shell with the module panel open and closed.
3. Keep queue side panels on `EmrQueueEmptyState` until a compact `queue` density is separately reviewed.
4. Add focused Playwright checks only for the touched surfaces. Do not rewrite broad queue tests unless queue behavior changes.
5. Update this inventory after each adopted surface so future work does not re-audit the whole repo.

## 2026-07-01 Pilot Adoption

- `src/features/chart/module.tsx` `EmptyChartState` now uses `EmrEmptyState` with `surface="content"` and `kind="no-scope-result"`.
- `src/features/chart/module.tsx` order table no-result row now uses `EmrEmptyState` with `surface="table"` and `kind="no-filter-results"`.
- Queue side panels were intentionally left on the existing compact queue placeholder contract.

## 2026-07-02 Table Surface Adoption

- `src/features/customer/module.tsx` `CustomerDataTable` now uses `EmrEmptyState` with `surface="table"` for no-data and filter-empty animal/guardian table rows.
- `src/features/hospital-admin/module.tsx` order catalog empty row now uses `EmrEmptyState` with `surface="table"` for catalog no-data and filter/search-empty results.
- `src/features/lab-imaging/module.tsx` `LabResultInputSection` now uses `EmrEmptyState` with `surface="table"` for true-empty lab result rows. Live fulfillment empty rows use `kind="upstream-pending"`; non-live true-empty rows use `kind="no-data"`.
- Hospital Admin audit-log empty rows, shared queue panels, billing queue/content, home widgets, reception profile drawer states, permission/error/retry/loading/save states, and imaging fallback states were intentionally left unchanged.

## 2026-07-02 Operational Content Adoption

- Dispensing/treatment, lab, imaging, and billing main content no-upstream-work branches now use `EmrEmptyState` with `surface="content"` and suppress the corresponding content aside/history panel.
- Queue/list placeholders in those modules remain compact supporting states through the existing queue components. They were not replaced by content-surface empty states.
- No-selection content branches also use the content-surface empty state, while selected work item/detail/invoice states keep their aside/history surfaces where applicable.
- Loading, permission, error, retry, save, checkout, catalog, result-table, and API state handling remain outside this content empty-state adoption.

## 2026-07-05 Queue-Empty Content Contract

- Operational queue screens distinguish source-empty from visible-empty. Source-empty means the queue has zero work items before search, sort, or filter. Visible-empty means work exists but the current query or filters hide it.
- Source-empty states show the domain-specific no-work message in both the compact queue panel and the main content body, for example `진료 업무가 없습니다`, `검사 업무가 없습니다`, `영상 업무가 없습니다`, `조제/처치 업무가 없습니다`, and `수납 업무가 없습니다`.
- When source work exists but no item is selected, the main content body keeps the selection guidance state instead of auto-selecting the first queue item.
- Source-empty queue panels keep search available so the user's query is preserved, but sort and filter controls are disabled because they cannot change an empty source queue.
- The main content body owns the screen-level refresh action for source-empty operational states. Queue side panels remain compact supporting placeholders.
- Home work-status surfaces now use the same source-empty principle for `원내 업무가 없습니다` when the hospital work source has zero tasks.

## Implementation Acceptance Criteria

Follow-up implementation issues should satisfy these checks:

- Loading, empty, error, permission/scope, and info states are visually and textually distinct.
- Empty states name the missing object and include the next useful action when one exists.
- Info boxes do not hide errors, degraded reads, failed saves, or permission blockers.
- Enabled empty/info actions use E1 click affordance; passive surfaces remain E0 flat.
- Copy does not imply live persistence, RLS, server enforcement, provider integration, or real data when not implemented.
- Any shared extraction follows `component-ownership-rules.md` and keeps feature behavior local.
- Dense screens are checked for state panels taking over too much vertical space.

## Follow-Up Candidates

- Apply this contract to queue empty states in DEN-436 if filter/sort leaves no visible work.
- Apply this contract to patient context memo or no-note states in DEN-437.
- Apply this contract to SOAP section empty/editing guidance in DEN-438.
- Revisit shared `EmrEmptyState` only after those implementation issues prove repeated structure.
