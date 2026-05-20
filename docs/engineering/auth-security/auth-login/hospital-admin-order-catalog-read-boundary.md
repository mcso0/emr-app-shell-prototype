---
title: "Hospital Admin Order Catalog Read Boundary"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-112"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-004-order-catalog-read-boundary.md"
---

# Hospital Admin Order Catalog Read Boundary

Linear: DEN-112
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

`src/features/hospital-admin/server-order-catalog-core.ts` adds shared admin and chart-search read boundaries.

Admin catalog reads include paused and inactive rows. Chart search excludes paused/inactive rows and includes active order sets with applied snapshots.

Route: `GET /api/workspaces/[workspaceId]/hospital-admin/order-catalog?mode=chart-search`.
