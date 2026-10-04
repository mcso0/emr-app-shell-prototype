---
id: "HOME-PR-011"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "User request / Home operations live work items"
source_docs:
  - "docs/product/features/home/home-operations-work-status-contract-v0.md"
  - "docs/engineering/data-model/home-operations-work-status-read-model.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/engineering/current-status.md"
dependencies:
  - "HOME-PR-010"
updated: "2026-10-04"
---

# Home Operations Live Work Items

## Goal

Connect `원내 현황` to live, server-owned operations work items so the screen behaves as a hospital-wide work board instead of a mock or false-empty state.

## Scope

- Add an additive Supabase read-model RPC for Home operations work items.
- Add `GET /api/workspaces/[workspaceId]/operations/work-items`.
- Normalize appointments, reception/waiting queue entries, consultation-like queue states, order fulfillment work items, and billing invoice/invoice-line candidates into the common Home operations status contract.
- Connect non-legacy Home UI and side panel to the API without mock fallback.
- Hide Home board header/filter/Kanban chrome when the API returns a true empty state.
- Preserve API error and permission-denied states as visible states, not empty work.
- Keep card click as a detail drawer and route to source workflows through drawer/footer or overflow actions.

## Out Of Scope

- Claim, assign, complete, cancel, bill, chart, or settle work directly from Home.
- Inpatient operations source mapping.
- Official SLA/`지연` policy.
- Chart/order urgent-request authoring UI.
- Production data changes, real customer/patient/guardian/payment data, provider integrations, or external communications.
- Destructive DB operations such as drop, truncate, or source-table mutation.

## Done Criteria

- Cheongdam/prepared-clinic Home uses the operations API instead of Home mock data.
- Completed/cancelled work is excluded by default and appears only through `완료 포함` / `취소 포함`.
- `scope=mine` includes personal assignments and processable team queues.
- `team_queue`, `assignment_missing`, `re_requested`, `urgent`, and `long_stay` are represented as attention/assignment signals.
- API failures and permission denial cannot render as `원내 업무가 없습니다`.
- Focused server/API/UI coverage passes.
- Docs and this work item reflect the implementation boundary and remaining follow-up.

## Verification

- `npx playwright test tests/home-operations-work-items-server.spec.ts tests/home.spec.ts --reporter=line`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npm run lint`
- `git diff --check`
- Remote synthetic/demo DB migration and smoke test attempted only when configured credentials and linked project are available.

## Completion Notes

Handed to human review on 2026-07-05.

- Added additive migration `20260705120000_home_operations_work_items_reader.sql`.
- Added server/API read path and Home UI adapter for live operations work items.
- Removed Home operations mock fallback for non-legacy workspaces.
- Added focused server and Playwright coverage for the new contract.
- Completion report: `docs/completed/home/2026-07-05-home-operations-live-work-items-report.html`.
- Initial remote DB execution was attempted but not applied because the earlier environment had no Supabase project link or access token.
- Follow-up remote DB application on 2026-07-05: applied additive migration `home_operations_work_items_reader` to the approved `clair-emr-staging` Supabase project. Read-only Cheongdam smoke confirmed the aggregate RPC returns `sourceStatus=live`, total 7 active items, including consultation 3, lab 2, imaging 1, and treatment 1.
- Follow-up production hotfix: when the aggregate RPC is not present in a remote Supabase environment yet, the server read path falls back to existing live reception-calendar and fulfillment readers without restoring Home mock fallback.
- Follow-up UI correction: Home Kanban cards now use the same queue-card field contract as source modules, carry source card fields through the read model, group billing cards at invoice/work-item grain, and no longer inject Home-only `나`/status-decision labels into the card body.

## 2026-09-08 Selected-date hospital view

User approved separating `원내 현황` from `내 업무`, implementation, tests, commit/push/PR, main merge and production deployment.

- Hospital board/list use source operating-date equality; My Work retains unfinished carry-over.
- Owner options and task counts use the visible date scope; date navigation resets owner selection.
- Shared API, patient summary, permissions, source dates/statuses and persistence remain unchanged.
- Isolated branch: `codex/home-selected-date`. Base: `74dcfe53ab7954a85dccf6390c35edb2d61aaf6d`.
- Rollback candidate: previous production `dpl_HBSoDE993212uyWtmUTBWVB3Gnct`, or revert this scoped change.
- Verification: Home UI and server tests, lint, typecheck, build, docs, secrets and exact-candidate Release Check before merge. Stop on required check/preview failure.
- Production smoke: app/login and Cheongdam home route; distinguish HTTP/unauthenticated checks from authenticated workflow evidence.

Local verification: 12 Home UI tests and 10 Home server tests passed; lint, typecheck, docs, UX copy and secret scan passed. Build and remote release gates are recorded in the PR delivery evidence.

## 2026-10-04 Hospital list identity presentation

User approved implementing the reviewed HTML design, investigating before edits, commit/push/PR preparation and Production delivery. Exact candidate release evidence remains required before merge.

- Hospital list work types use outline badges. Patient and guardian names have 20px fallback avatars.
- Home toolbar hints retain the focused button's name when pointer movement over the search input or automatic action scrolling occurs. Focus/hover regression coverage verifies this behavior.
- Requester and assignee cells center 24px round avatars. Hover and keyboard focus reveal names without navigating the row. More than three assignees use two avatars and a remaining-count avatar with the other names in its tooltip.
- Request time includes a clock icon. Hospital status uses an 8px icon/text gap (reviewed HTML had 6px; prior application had 4px).
- The existing 36px row geometry and horizontal scrolling remain. Avatar sizes are local to this Home list, with no viewport breakpoint or shared avatar-size change.
- Registered user photos are read through the existing active-workspace staff gateway and joined by requester/assignee IDs. Private photo signing and removed-legacy-image rules remain owned by the staff profile reader. Optional photo-read failure preserves work and names.
- Responses with user photos older than four minutes refresh once on hospital-list activation, visible-filter changes or window focus, before the five-minute private URL lifetime. No polling or URL lifetime change is introduced.
- Patient/guardian profiles currently show fixed Figma images and have no photo registration/storage contract. Home does not treat those images as registered photos. The requested persistence expansion is pending the user's scope decision; it requires a separate explicit photo-storage/read/write scope before any remote migration.
- No DB, storage, permission policy, real identity data, or existing Home source/mutation contract changes are included in this slice.
- Branch: `codex/home-list-profile-avatars`; base: `efadd50a8f7c354511d8cda5415fafddc4b20742`.
- Required checks: Home/staff reader and UI regression coverage, lint, typecheck, build, docs, UX copy, secrets, exact-candidate Release Check and Ready Preview.
- Planned Production smoke: `/login` and the existing authenticated synthetic Cheongdam Home list, including avatars, tooltips and navigation.
- Initial rollback candidate: Ready Production `dpl_77uqrDPz38MwBDM1ay3zEUgxaujg`; recheck the current deployment before merge.
