---
id: "HOME-V1-UI-SPEC"
status: implemented
area: product
doc_type: ui-spec
related_docs:
  - "docs/product/features/home/home-v1-reference-research.md"
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-operations-work-status-contract-v0.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/product/features/home/home-v1-epic-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
related_work:
  - "docs/work/home/HOME-PR-014-home-workspace-and-personal-work.md"
last_updated: "2026-09-07"
---

# Home Workspace UI Spec

## Scope

Approved Home consists of `원내 현황` and independent `내 업무`. Default entry is `원내 현황`. The collapsible module sidebar orders `원내 현황`, `내 업무`, disabled `인박스 · 예정`, disabled `메시지 · 예정`. The rail tooltip is `홈 화면`. Inbox and messaging behavior remains future work.

Home is a read and navigation surface. Processing, assignment, approval, result confirmation and payment remain in source workflows.

## Hospital View

Use existing EMR page header, module sidebar, date navigator, task queue card, row menu, table, status icon and feedback components. Keep semantic shared tokens. The title row shows current patient counts as small unboxed text: `원내 N마리 · 진료 대기 N마리 · 진료 중 N마리`. These are distinct patients from current active encounters, independent of selected date and work filters. Read failure displays `—`; task counts never substitute for patients. Billing-ready patients remain present but are not counted as currently in consultation. Inpatient/session-only data is not fabricated into these counts.

Below the title, date is left aligned. Completion inclusion, owner/work multiselects, search, filter reset and board/list controls are right aligned. No separate view-settings menu or title-area sidebar toggle.

Work order: 접수, 예약, 진료, 임상병리, 영상검사, 조제, 처치, 수납.

- Board columns contain status groups: 대기, 진행 중, optional 완료. Column collapse is approximately 52px wide and hugs content vertically.
- Column controls appear on hover, keyboard focus or open menu and remain accessible on touch. Overflow hides the column; the work-type multiselect uses the same state.
- Hidden work stays in a content-height panel fixed to the right outside horizontal board scrolling. `표시` restores one column in original order; `모두 표시` restores all work types.
- Owner and work-type filters support multiple selections, select all and clear. `필터 해제` resets owner/type only, preserving date and search. Clearing search only clears search.
- Board and list render the same filtered work set. Lists group by work type and support collapse.
- Previous unfinished work is labeled `이전 미완료`, distinct from `긴급 요청` and `재요청`. Previous date alone must not create a delay color or official SLA claim.

## Personal View

`내가 할 업무` includes records assigned to the current user ID. Operational reception/reservation staff assignments are independent of the primary veterinarian; all assigned staff IDs participate. Consultation ownership and fulfillment assignment use their authoritative source IDs. Unassigned/team work remains in hospital view.

`내가 요청한 업무` includes records requested by the current user ID, including unassigned requests. Do not infer requester identity from role or matching display names in live reads. No synthetic review/approval tasks are introduced where the source has no assignment model.

Each tab is a list grouped into previous unfinished/current date or source progress groups. Columns include 환자/보호자, 업무 종류 as a neutral badge, 세부 업무, 상태, 담당자 and 경과. Personal queries are independent of hospital search, owner selection, hidden columns and layout.

## Date And Navigation

Use scheduled processing date when available, otherwise requested date. Selected-date work and older unfinished work are shown with latest current state; this is not a historical snapshot. Completed work is excluded by default and enabled with `완료 포함`. Cancelled work is not shown in this UI.

Card body is noninteractive. Its overflow action names and opens the source module. List rows use the shared hover surface and gradient action overlay naming the destination. No Home detail drawer or processing action. Source identity is retained: appointment, encounter, fulfillment item or invoice. Date context accompanies fulfillment navigation.

Returning Home preserves queries, scroll and collapse. Persistent display preferences (board/list, hidden work, collapsed columns/groups) are browser-local and keyed by user and workspace. Query/date/completion/scroll state is session-local; sign-out clears it. A new tab/session begins at today with no search and all owners. No cross-device synchronization is claimed.

## Verification Boundary

Use [HOME-PR-014](../../../work/home/HOME-PR-014-home-workspace-and-personal-work.md) for exact implementation, test and delivery evidence. Synthetic fixtures and mocked API browser checks prove UI behavior; they do not prove a production DB read or authenticated deployment smoke.
