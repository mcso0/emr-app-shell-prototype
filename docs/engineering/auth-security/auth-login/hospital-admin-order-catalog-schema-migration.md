---
title: "Hospital Admin Order Catalog Schema Migration"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-111"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-003-order-catalog-schema-migration.md"
---

# Hospital Admin Order Catalog Schema Migration

Linear: DEN-111
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

Added local-first migration `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql`.

The migration creates order catalog, order set, set item, lab category, lab item, and lab linkage tables. It also adds chart-search and lab delete-lock views.

Remote Supabase application, live replay, production deploy, and final RLS validation remain out of scope.
