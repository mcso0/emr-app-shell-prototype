---
id: PRODUCT-CLOSEOUT-PRD-VIEWER-READONLY
status: approved
area: product
doc_type: closeout
related_work:
  - PRD-VIEWER-PR-001
supersedes: []
superseded_by: []
last_updated: 2026-06-11
---

# Closeout: Product Docs Read-Only PRD Viewer

## Summary

Added an internal `/prd` read-only viewer for curated `docs/product` Markdown while keeping the Markdown files as the only product source of truth.

## Changed Docs or Files

- Added the `/prd` app route and PRD viewer support files under `src/app/prd/` and `src/lib/prd-viewer/`.
- Added `tests/prd-viewer.spec.ts`.
- Added `docs/work/product/PRD-VIEWER-PR-001-product-docs-readonly-viewer.md`.
- Updated docs portal and meta guidance to make `/prd` the active internal product-doc reader and GitBook inactive/deprecated.
- Added epic and user-story templates plus README guidance.

## Verification

- `npm run docs:check` passed.
- `npx playwright test tests/prd-viewer.spec.ts` passed.
- `npm run lint` passed with pre-existing warnings only.
- `npx tsc --noEmit` passed after current Next build types were regenerated.
- `npm run build` passed.

## Remaining Risk

- The Markdown renderer intentionally supports a practical v1 subset. Mermaid and Prism-style advanced rendering remain follow-up polish.
- `/prd` is not auth-gated in v1, so its registry must remain limited to non-sensitive product docs.

## Next Steps

- Review the `/prd` reading experience and decide whether Mermaid rendering, better mobile layout, or additional product docs should become a follow-up work item.
