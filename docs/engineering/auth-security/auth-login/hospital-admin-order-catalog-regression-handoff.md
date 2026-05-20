---
title: "Hospital Admin Order Catalog Regression Handoff"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-117"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-009-order-catalog-regression-handoff.md"
---

# Hospital Admin Order Catalog Regression Handoff

Linear: DEN-117
Project: `07 Hospital Admin Order Catalog Persistence`

## Summary

Project 07 has a local-first order-catalog persistence foundation covering scope, schema, migration, admin/chart reads, individual mutations, order set expansion, lab item delete locks, and medication/vaccine/pricing snapshots.

## Verification

- `npx playwright test tests/hospital-admin-order-catalog-schema-migration.spec.ts tests/hospital-admin-order-catalog-server.spec.ts --reporter=line`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npm run security:secrets`

## Remaining Gaps

- UI wiring beyond server routes remains follow-up.
- Remote Supabase runtime replay and final RLS validation remain out of scope.
- Real medical/import/provider behavior remains out of scope.
