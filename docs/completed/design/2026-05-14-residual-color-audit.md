---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-018-residual-color-audit.md"
---

# Residual Color Audit Closeout

## Summary

Completed the final residual app-source cleanup after the primary feature screens, shell chrome, and shared EMR component passes.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Button gallery forced hover samples used direct Clair background tokens.
- The Excel file icon used hard-coded green and white SVG paints.
- Chart and default order queue status seed data used direct Clair atomic/status tokens.
- The placeholder demo launcher used direct Clair surface/primary tokens and `bg-white`.

## Completed

- Converted button gallery sample hover states to shadcn semantic state colors.
- Converted the Excel file icon to EMR success and inverse text aliases.
- Converted chart/order queue status color seeds to semantic status aliases.
- Updated the side panel collapsible group status-token resolver so semantic status aliases keep the correct count badge background/foreground pair.
- Converted the placeholder demo launcher surfaces and primary labels to shadcn semantic tokens.
- Added a residual eligible source audit test in `tests/design-tokens.spec.ts`.

## Intentional Exceptions

- Generated Clair token output remains in `src/styles/tokens/clair.css`.
- Token definition files may reference generated Clair tokens and literal seed colors by design.
- PWA manifest/theme color values and generated PWA icon SVG/PNG assets remain literal asset metadata.
- Figma/exported SVG assets and public framework placeholder SVGs remain asset files, not app screen source.
- Tests may contain literal expected colors when checking rendered browser metadata or token contracts.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "residual eligible source" --reporter=line` (`1 passed`, failed first before implementation)
- `npx playwright test tests/app-shell.spec.ts -g "order queue side panel renders status groups with design token colors|dispensing shell supports panels" --reporter=line` (`2 passed`, run after fixing semantic status alias badge mapping)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 250 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts tests/chart.spec.ts tests/button-gallery.spec.ts --reporter=line --workers=1` (`56 passed`)
