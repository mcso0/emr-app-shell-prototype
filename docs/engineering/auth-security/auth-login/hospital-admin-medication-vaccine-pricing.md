---
title: "Hospital Admin Medication Vaccine Pricing"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-116"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-008-medication-vaccine-pricing.md"
---

# Hospital Admin Medication Vaccine Pricing

Linear: DEN-116
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

Medication metadata, vaccine metadata, and pricing rules are first-class catalog fields in the server core and JSONB migration columns.

`createOrderPricingSnapshot` freezes applied display name, billing name, price, sales unit, tax, amount basis, and billing reflection state for chart-applied order rows. Later admin price edits do not rewrite already-created snapshots.

These fields are workflow metadata only and are not medical dose or safety recommendations.
