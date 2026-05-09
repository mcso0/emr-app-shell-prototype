---
id: CUSTOMER-MANAGEMENT-WORKSPACE-CLOSEOUT
status: done
area: customer
doc_type: closeout
related_work:
  - docs/work/customer/CUSTOMER-PR-001-customer-management-workspace.md
completed: 2026-05-06
---

# Customer Management Workspace Closeout

## Summary

Implemented the first customer management workspace as a session-only guardian/animal master data screen.

## Completed

- Added `docs/reference/customer/customer-management-wireframe.html`.
- Added `customer` module route and linked `고객관리` from the nav rail.
- Built a text navigation side panel for `보호자/동물 관리`.
- Built animal and guardian dense tables with search filtering.
- Added common `patient` and `guardian` drawer types in the shell while preserving reception drawer URL compatibility.
- Reused the existing patient/guardian registration and profile drawer flows.
- Extracted the title/action row used by chart, dispensing, and lab result pages into `EmrPageHeader`, then reused it for the customer content header.
- Corrected the content header hierarchy so it shows the selected leaf page (`동물`, `보호자`, or deleted records) instead of the parent `보호자/동물 관리`, and removed duplicate upper-work tabs from that header.
- Reworked the animal and guardian tables with shadcn Data Table patterns: selectable rows, column visibility menu, row actions, and bottom selection/pagination state.
- Removed the redundant side-panel `Customer` label and made each side-panel group collapse/expand with motion.
- Reused the shared `EmrSubpanelTitle` for the customer side-panel title/collapse header while omitting the 조제/처치 tab group.

## Out Of Scope Preserved

- Real DB/API persistence.
- Real KakaoTalk/message/document/referral integrations.
- Full schedule, outbound message, document, CS-wide, or referral inbox management.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/customer.spec.ts tests/reception.spec.ts --reporter=line`
