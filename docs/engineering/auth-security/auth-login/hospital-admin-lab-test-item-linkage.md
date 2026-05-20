---
title: "Hospital Admin Lab Test Item Linkage"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-115"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-007-lab-test-item-linkage.md"
---

# Hospital Admin Lab Test Item Linkage

Linear: DEN-115
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

Lab categories, lab test items, and order-to-item/category links are represented in the migration and server core.

`readLabTestItemDeleteLock` blocks deletion when an item is linked to an order or has saved result usage. Linked-order locks take priority over saved-result locks in the returned reason.

Route: `GET /api/workspaces/[workspaceId]/hospital-admin/lab-test-items/[testItemId]/delete-lock`.
