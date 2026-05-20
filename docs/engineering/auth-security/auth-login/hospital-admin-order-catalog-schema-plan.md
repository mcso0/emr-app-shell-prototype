---
title: "Hospital Admin Order Catalog Schema Plan"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-104"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-002-order-catalog-schema-plan.md"
---

# Hospital Admin Order Catalog Schema Plan

Linear: DEN-104
Project: `07 Hospital Admin Order Catalog Persistence`

## Planned Tables

| Table | Purpose |
| --- | --- |
| `order_catalog_items` | Workspace-owned individual order rows copied from synthetic standard presets. |
| `order_sets` | Set-level hospital-admin master rows. |
| `order_set_items` | Ordered included-order composition rows. |
| `lab_test_categories` | Result item category groups. |
| `lab_test_items` | Result-sheet item metadata. |
| `order_catalog_lab_test_item_links` | Order-to-category or order-to-item linkage with snapshot metadata. |

## Snapshot Rules

Chart search and chart application must copy names, billing name, price, tax, sales unit, amount basis, target species, source preset id/version, and relevant metadata. Later admin edits affect future chart additions only.

## Status Rules

Admin reads include `active`, `paused`, and `inactive` records. Chart search offers only `active` records while historical applied rows remain readable through Project 04 snapshots.
