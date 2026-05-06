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
- Use a `대분류 > 세부 분류 > 오더 목록` layout with shell side panel, content aside, and main data table.
- Provide search, filters, row selection, row actions, and session-only create/update/delete/duplicate/toggle behavior.
- Open a wide right drawer when a single order row is selected so the order can be viewed, edited, deleted, and saved.
- Add a static HTML wireframe under `docs/reference/hospital-admin/`.

## Out Of Scope

- Order 세트 implementation.
- Live DB/API persistence, Supabase integration, server-side permission enforcement, and audit persistence.
- Pixel-level matching to chat-provided reference images.

## Done When

- 병원관리 nav opens the Order 관리 workspace instead of the placeholder.
- Category and subcategory selection changes the visible order list.
- Selecting a row opens the wide edit drawer; checkbox selection only drives bulk actions.
- Drawer edit/save/delete actions update the session-only store.
- Playwright coverage verifies navigation, filtering, drawer CRUD, and bulk-selection behavior.

## Verification

- `npx playwright test tests/hospital-admin.spec.ts tests/service-catalog.spec.ts --reporter=line`
- `npx playwright test tests/app-shell.spec.ts --reporter=line`
- `npm run lint`
- `npx tsc --noEmit`

## Handoff Notes

The URL remains `/orders`, but the user-facing module is 병원관리. Order 세트 should be shaped as a separate follow-up screen rather than being folded into this PR.
