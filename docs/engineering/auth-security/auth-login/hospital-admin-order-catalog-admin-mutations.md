---
title: "Hospital Admin Order Catalog Admin Mutations"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-113"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-005-order-catalog-admin-mutations.md"
---

# Hospital Admin Order Catalog Admin Mutations

Linear: DEN-113
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

Order catalog create/update/pause is handled by `mutateOrderCatalogItem`, guarded by `service_catalog:manage` and active workspace membership.

The mutation boundary validates required names, non-negative prices, and pricing-rule integrity. Paused records remain visible to admin reads but are removed from new chart search.

Route: `POST/PATCH /api/workspaces/[workspaceId]/hospital-admin/order-catalog`.
