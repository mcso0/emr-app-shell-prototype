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
updated: "2026-07-05"
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
- Remote DB execution was attempted but not applied because this environment has no Supabase project link or access token.
- Follow-up production hotfix: when the aggregate RPC is not present in remote Supabase yet, the server read path falls back to existing live reception-calendar and fulfillment readers without restoring Home mock fallback.
