---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-017-shared-emr-components-token-cleanup.md"
---

# Shared EMR Components Semantic Token Cleanup Closeout

## Summary

Completed the shared EMR secondary component cleanup after the primary feature screens and shell chrome cleanup. This pass scoped shared components in `src/components/emr/**`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Content history group labels and chevrons used direct Clair label tokens.
- EMR data table diff previous values, arrows, canceled text, assignee placeholder, select text, table headers, and selection footer used direct Clair label tokens.
- Order queue fallback status used a direct generated gray atomic token.
- Order queue summary, subpanel title/list titles, and patient context lock icon used direct Clair label tokens.

## Completed

- Converted shared history/subpanel/summary labels to shadcn semantic text tokens or EMR text aliases.
- Converted EMR data table muted, tertiary, canceled, header, and footer text colors to semantic/EMR aliases while preserving warning diff semantics.
- Converted order queue fallback status color to the neutral status alias.
- Added a shared EMR component source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- `src/components/ui/**` wrapper audit if a later broad scan finds local color drift.
- PWA manifest/theme metadata and generated icon/asset-like files.
- Demo-only button gallery or non-production visual sample files.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "shared EMR component source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 248 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/customer.spec.ts --reporter=line` (`86 passed`)
