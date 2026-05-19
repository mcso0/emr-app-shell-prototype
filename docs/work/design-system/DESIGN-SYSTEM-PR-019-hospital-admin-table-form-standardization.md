---
id: "DESIGN-SYSTEM-PR-019"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 06 / DEN-129"
linear: "DEN-129"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-debt-inventory.md"
  - "docs/design/system/ui-refactor-dod.md"
dependencies:
  - "DESIGN-SYSTEM-PR-012"
  - "DESIGN-SYSTEM-PR-141"
  - "DESIGN-SYSTEM-PR-142"
updated: "2026-05-20"
---

# Hospital Admin Table And Form Standardization

## Goal

Standardize the hospital admin order catalog table and drawer form structure while preserving the current session-only product behavior.

## Scope

- Refactor the order catalog table to use an explicit local column sizing recipe instead of scattered one-off width classes.
- Compose drawer form rows from shadcn `Field`, `FieldLabel`, `FieldContent`, and `FieldDescription`.
- Keep workflow-specific select and catalog editing behavior feature-local.
- Remove the drawer footer overlap risk by making the action footer part of the drawer layout flow.
- Preserve order catalog filtering, row selection, form editing, delete confirmation, and audit review behavior.

## Out Of Scope

- Supabase, DB schema, RLS, migrations, server API, or live persistence changes.
- Role-policy or permission model changes.
- Order set, pricing, billing, or clinical workflow logic changes.
- Real patient, guardian, hospital, or production data access.

## Implementation Notes

- The order catalog table keeps its dense minimum width intentionally because the current admin workflow benefits from stable columns and horizontal scrolling on narrow screens.
- `DrawerField` now delegates label/content/description structure to shadcn field primitives while keeping the local two-column admin drawer layout.
- `DrawerSelect` remains feature-local because the option sets and label behavior are specific to the hospital admin catalog.
- The audit review surface received a small effect cleanup so focused lint can pass without changing data loading behavior.

## Verification

- `npx eslint src/features/hospital-admin/module.tsx`
- `npx tsc --noEmit`
- `npx playwright test tests/hospital-admin.spec.ts --reporter=line`
- Browser QA on desktop and narrow viewport for `/w/clair-demo/orders?modulePanel=open`
- `npm run docs:check`
- `npm run security:secrets`

## Handoff Notes

Ready for Human Review as DEN-129. The implementation stays frontend-only and session-only; no DB or production boundary was touched.
