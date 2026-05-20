---
title: "Hospital Admin Order Set Persistence"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-114"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-006-order-set-persistence.md"
---

# Hospital Admin Order Set Persistence

Linear: DEN-114
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

Order sets are represented as separate master rows with included-order composition rows. `expandOrderSetForChart` returns a parent set snapshot and ordered child order snapshots.

Route: `GET /api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/expand`.

Existing chart-applied rows should keep their Project 04 snapshots even when set composition changes later.
