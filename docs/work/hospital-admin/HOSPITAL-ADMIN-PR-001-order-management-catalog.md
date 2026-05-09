---
id: "HOSPITAL-ADMIN-PR-001"
status: "done"
area: "hospital-admin"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/design/reference-screen-index.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
dependencies: []
updated: "2026-05-06"
---

# Order Management Catalog

## Goal

Implement the 병원관리 Order 관리 catalog screen for session-only order lookup and mock CRUD.

## Scope

- Replace the `/w/[workspaceId]/orders` placeholder with a 병원관리 Order 관리 workspace.
- Reuse the customer-style text side panel for 병원관리 navigation. `Order 관리` expands in the left panel, its child order groups/subgroups are selected there, and the main page header shows the selected leaf screen.
- Show only the selected leaf's internal order-type tabs in the main page header above the data table.
- Provide search, filters, row selection, row actions, and session-only create/update/delete/duplicate/toggle behavior.
- Open a wide right drawer when a single order row is selected so the order can be viewed, edited, deleted, and saved.
- Add a static HTML wireframe under `docs/reference/hospital-admin/`.

## Out Of Scope

- Order 세트 implementation.
- Live DB/API persistence, Supabase integration, server-side permission enforcement, and audit persistence.
- Pixel-level matching to chat-provided reference images.

## Done When

- 병원관리 nav opens the Order 관리 workspace instead of the placeholder.
- Selecting an `Order 관리` child in the left side panel changes the page header and visible order list.
- Selecting a row opens the wide edit drawer; checkbox selection only drives bulk actions.
- Drawer edit/save/delete actions update the session-only store.
- Playwright coverage verifies navigation, filtering, drawer CRUD, and bulk-selection behavior.

## Verification

- `npx playwright test tests/hospital-admin.spec.ts tests/customer.spec.ts tests/app-shell.spec.ts --reporter=line`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`

## Handoff Notes

The URL remains `/orders`, but the user-facing module is 병원관리. Order 세트 should be shaped as a separate follow-up screen rather than being folded into this PR.

2026-05-06 follow-up: 병원관리의 left module panel now reuses the 고객관리 text-navigation side panel structure. The `Hospital` side-panel label was removed.

2026-05-06 follow-up: Removed the hospital-admin content aside. `Order 관리` child navigation now lives in the left side panel, so only one leaf item is visually selected at a time.

2026-05-06 follow-up: The main page header now reflects the selected leaf (`임상병리 검사`, `처방`, `영상검사`, etc.). Header tabs are reserved for the next level inside that leaf, such as `임상병리 검사`'s internal order types.

2026-05-06 follow-up: 병원관리 side panel header now uses the shared `EmrSubpanelTitle` header rule from 조제/처치 without the order-type tab group.
