---
id: "CLINICAL-MASTER-PR-021"
type: "Work Item"
title: "Dispensing order catalog detail columns"
description: "Makes dispensing defaults, review state, billing name, and price directly scannable in the Hospital Admin Order table while preserving pinned identity and unrelated Order tables."
status: "completed"
area: "clinical-master"
priority: "P0"
tags:
  ["clinical-master", "dispensing", "hospital-admin", "table", "accessibility"]
target_pr: "Dispensing order catalog detail columns"
source_docs:
  - "docs/product/domain/workspace-order-catalog-platform.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-020-workspace-dispensing-preset-management.md"
dependencies: ["CLINICAL-MASTER-PR-020"]
updated: "2026-08-29"
remote_writes: 0
---

# Clinical Master PR-021: Dispensing order catalog detail columns

## Goal

Make the prescribing and dispensing defaults that a veterinarian reviews
visible directly in the Hospital Admin Order table. Keep selection, standard
Order identity, and in-hospital Order identity pinned while detailed medication,
review, billing, and price columns remain horizontally scrollable.

## Scope

- Apply a dispensing-specific column set to the existing `dispensing` category.
- Show ingredient and strength, dosage form, dose, route, frequency, duration,
  total quantity, medication timing, storage, target, review state, use state,
  billing name, and sale price.
- Keep selection plus standard and in-hospital Order names pinned on the left.
- Add explicit initial/minimum/maximum widths and preserve the existing column
  visibility control and horizontal scroll owner.
- Extend dispensing search and advanced filters with the newly visible facts.
- Add keyboard resizing to the existing shared resize grip without changing
  feature state ownership.
- Verify the 108-row Cheongdam synthetic service-review catalog and unrelated
  Order leaf behavior.

## Out Of Scope

- Changing clinical approval, catalog availability, pricing, or master data.
- Adding or mutating Airtable, Supabase, migrations, RLS, or remote records.
- Correcting the existing prescription/dispensing leaf routing taxonomy.
- Persisting column width or visibility preferences across reloads.
- Moving compound instructions, guardian guidance, or manual quantity reasons
  from the existing Order drawer into the table.

## Done Criteria

- The Cheongdam dispensing table exposes the approved column order and bounded
  widths, with the structural selection control plus standard and in-hospital
  Order names pinned at 524px initially.
- Service-review master rows display `임상 미검토` separately from `사용`.
- Billing name and sale price remain visible by default in the scroll region.
- Ingredient/dosage-form search and dosage-form/route/frequency/review filters
  operate on the same derived values shown in the table.
- Missing lineage values render as `미설정`; the UI never infers clinical facts
  from product names.
- Pointer, touch, and keyboard resize respect each column's min/max bounds.
- Non-dispensing Order tables preserve their current columns and behavior.
- Focused Playwright, lint, TypeScript, docs, secret, build, and release gates
  pass before production merge.

## Verification

- `npx playwright test tests/hospital-admin.spec.ts -g "priced service-review|shows all service-review|uses shared header|supports single sort and section filter builder|exposes 검사 카테고리|row action menu" --reporter=line`
- `npx playwright test tests/app-shell.spec.ts -g "column grips resize" --reporter=line`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`
- `npm run build`

All listed gates passed on the scoped candidate. Browser inspection covered the
left and right scroll extents at 1920px and the 1024px pinned layout. An
independent read-only release review returned `APPROVE` with MUST-FIX 0 and
SHOULD-FIX 0.

## Result

- [Implementation review report](../../completed/clinical-master/2026-08-29-clinical-master-pr-021-dispensing-order-table-details-report.html)
- No catalog, clinical, billing, workspace, Airtable, or Supabase record was
  changed by this work item.

## Rollback

Revert the application commit. No catalog, clinical, billing, or remote data
rollback is required because this slice performs no data mutation.
