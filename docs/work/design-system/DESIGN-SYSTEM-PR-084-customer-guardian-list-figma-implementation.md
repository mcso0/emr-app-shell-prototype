---
id: "DESIGN-SYSTEM-PR-084"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "User request / CDS.V2 customer guardian list implementation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
dependencies:
  - "DESIGN-SYSTEM-PR-024"
  - "DESIGN-SYSTEM-PR-029"
  - "DESIGN-SYSTEM-PR-050"
updated: "2026-07-26"
---

# Customer Guardian List Figma Implementation

## Goal

Implement the approved CDS.V2 guardian-list report contract with the installed
TanStack Table and shadcn/Base UI primitives while preserving customer data,
search, filters, sorting, selection, drawer, and registration behavior.

## Scope

- Align the shared shadcn/Base UI Checkbox with Figma component set
  `27814:152534`, including unchecked, checked, indeterminate, focus, invalid,
  invalid-focus, and disabled states.
- Keep `EmrTableCheckbox` as a semantic table-selection alias without separate
  visual overrides.
- Move customer list title, count, search, filter, density, column visibility,
  and registration controls into the Figma two-row header composition.
- Rebuild the customer feature table state boundary on the installed
  `@tanstack/react-table` package and existing project `Table` primitives.
- Apply the Figma 36px header, 40px default row, 20px table inset, 10px cell
  content inset, 48px page/footer inset, and fluid width/height contracts.
- Use one label-plus-sort-icon button per data header. Keep only currently
  contracted sortable fields active.
- Render `1/1 페이지` with disabled previous/next controls until real
  pagination is separately approved.
- Preserve loading, empty, no-result, read-error, long-content, selected, and
  row-action states.

## Out Of Scope

- New API, persistence, permission, Supabase, RLS, or real-data behavior.
- New external table or checkbox dependency.
- A generic cross-feature DataTable core.
- Real client/server pagination.
- New sorting rules for compound guardian columns.
- Global table density, `EmrPageHeader`, or design-token changes.

## Done Criteria

- The guardian list matches the inspected Figma header, table, row, and footer
  geometry at the 1540x1024 reference viewport.
- Width and height remain fluid, with fixed Figma insets and horizontal table
  scrolling at narrow widths.
- Existing customer workflows and table state behavior remain covered by
  focused tests.
- Shared Checkbox consumers keep their semantic behavior and receive the
  approved Figma visual states.
- TypeScript, focused lint, focused Playwright, build, docs validation, and
  browser console/accessibility checks are recorded.

## Verification

- `npx eslint` for touched source and customer tests.
- `npx tsc --noEmit`.
- Focused `tests/customer.spec.ts` Playwright coverage.
- Focused shared Checkbox consumer regression coverage.
- `npm run build`.
- `npm run docs:check`.
- Browser screenshots at primary, narrow, and wide viewports.
- Keyboard focus, reduced motion, horizontal scroll, and console error checks.

## Handoff Notes

Implementation is explicitly approved by the user after review of the
standalone Figma implementation report. Keep the application change separate
from the report artifact and do not claim pagination or new data behavior.

## Result

- Replaced the customer-only table state engine with a feature-owned TanStack
  Table composition using the installed dependency and existing project Table
  primitives.
- Added typed patient/guardian ColumnDef schemas, a label-plus-sort-icon header
  button, a rich ReactNode cell boundary, the Figma list header, and the visual
  footer.
- Preserved search, filter builder, density, column visibility, row selection,
  row action, drawer, registration, loading, empty, no-result, and read-error
  behavior.
- Implemented the shared shadcn/Base UI Checkbox visual contract from Figma
  node `27814:152534`, with exact exported check/minus assets and no new
  dependency.
- Applied feature-local `#FAFAFA` table-header and `#FCFCFC` footer surfaces
  because the project has no exact semantic tokens for those two Figma values.
  Shared tokens were not changed.
- Kept pagination as a visual `1/1 페이지` contract with disabled previous/next
  buttons. No pagination data logic was added.

## Verification Result

- Touched-source ESLint: pass.
- `npx tsc --noEmit`: pass.
- `npx playwright test tests/customer.spec.ts`: 14/14 pass.
- Figma geometry browser contract: pass at 1540×1024; 108px header,
  36–36.5px collapsed-border header row, 40px default data row, 64px footer,
  48/20/10px insets, exact default backgrounds, and 1120px narrow overflow.
- Keyboard Space selection, indeterminate select-all, focus ring, responsive
  overflow, density switching, reduced-motion, and unexpected page errors:
  pass.
- Shared Checkbox focused consumers: billing, home, and hospital-admin pass.
  Dispensing two tests and chart one test fail before reaching Checkbox
  assertions because expected demo rows/copy are absent; treat as separate
  baseline follow-up.
- `npm run build`: pass with the existing broad NFT trace warning from
  `src/lib/prd-viewer/doc-reader.ts`.
- `npm run build-storybook`: pass with existing font-resolution, lottie eval,
  and large-chunk warnings.
- `npm run docs:check` and `npm run security:secrets`: pass.
- Updated standalone analysis report build, offline test, source contract
  validation, and embedded contract validation: pass.

## Remaining Decisions

- Keep the five compound guardian columns visually button-shaped but disabled
  for sorting until their comparison and null-ordering rules are approved
  (`APR-008` / `CNF-013`).
- Human review should compare the real customer data density and registration
  dropdown behavior against the Figma placeholder content. No behavior was
  removed to create a purely decorative match.

## Review Artifact

- `docs/completed/design-system/2026-07-26-customer-guardian-list-figma-implementation-report.html`
