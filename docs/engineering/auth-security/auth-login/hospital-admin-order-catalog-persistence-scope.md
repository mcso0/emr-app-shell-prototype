---
title: "Hospital Admin Order Catalog Persistence Scope"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-103"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-001-order-catalog-persistence-scope.md"
---

# Hospital Admin Order Catalog Persistence Scope

Linear: DEN-103
Project: `07 Hospital Admin Order Catalog Persistence`

## Scope

Project 07 owns hospital-admin master data for individual order catalog rows, order sets, lab test items, medication/vaccine metadata, and pricing rules.

Project 04 owns encounter/chart-applied order rows, invoice candidate sync, billing confirmation, and historical applied snapshots.

Order sets remain a separate hospital-admin surface from individual Order 관리. Chart search may show individual orders and sets together, but admin editing surfaces stay separate.

## Out Of Scope

- Real clinical recommendation or dose safety.
- Real hospital order import.
- Device, PACS, Kakao, PG, inventory, or prescription label provider integration.
- Remote Supabase validation and production deploy.

## Handoff

DEN-104 should convert this boundary into schema tables and snapshot rules using DEN-99 product data contracts.
