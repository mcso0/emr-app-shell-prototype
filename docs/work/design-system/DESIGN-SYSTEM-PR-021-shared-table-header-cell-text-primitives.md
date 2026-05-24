---
id: "DESIGN-SYSTEM-PR-021"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 12 / DEN-264"
linear: "DEN-264"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DEN-250"
  - "DEN-251"
updated: "2026-05-24"
---

# Shared Table Header And Cell Text Primitives

## Goal

Implement the first PR-sized slice from DEN-250 and DEN-251 by adding reusable EMR table header and cell text primitives, then pilot them in the dispensing/treatment order table.

## Scope

- Add a shared header cell primitive for header interaction roles and resize affordance policy.
- Add a shared cell text primitive for one-line default and limited two-line preview modes.
- Pilot the primitives in the dispensing/treatment order table.
- Keep scalar values one-line by default.
- Allow limited two-line text only for order names and warning/change messages where aggressive clipping loses meaning.
- Exclude checkbox, assignment control, and workflow action columns from resize affordances.
- Capture browser evidence with mock auth so the report shows the actual workspace, not the login screen.

## Out Of Scope

- Broad adoption across all EMR tables.
- New sort, filter, column menu, or resize behavior beyond existing resize mechanics.
- Live Supabase validation, migrations, RLS, server enforcement, persistence, payment, email, deploy, or production data work.
- DEN-250 Human Review status transition or DEN-251 Done status changes.

## Implementation Notes

- `src/components/ui/table.tsx` remains the generic table primitive.
- The new reusable EMR ownership layer lives in `src/components/emr/table-primitives.tsx`.
- `src/components/emr/emr-data-table.tsx` remains the pilot because it already backs the dispensing/treatment dense worklist.
- Header role props are recorded through shared API/data attributes without adding fake sort/filter behavior.
- Resize handles are retained only where the TanStack column remains resize-eligible.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/app-shell.spec.ts -g "dispensing table (supports hover selection|column grips resize)"`
- Browser QA for `/w/clair-demo/dispensing?modulePanel=open&aside=closed&right=closed` with mock auth storage state.
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-264. The shared primitives are intentionally narrow and only piloted in the dispensing/treatment table; wider table adoption should be handled by follow-up issues.
