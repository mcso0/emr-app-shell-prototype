---
id: "PRD-VIEWER-PR-001"
status: "human_review"
area: "product"
priority: "P0"
target_pr: "PRD viewer PR 1"
source_docs:
  - "docs/product/README.md"
  - "docs/product/prd/clair-emr-saas-prd.md"
  - "docs/_meta/agent-rag-map.md"
  - "docs/_meta/intake-rules.md"
dependencies: []
updated: "2026-06-11"
---

# Product Docs Read-Only PRD Viewer

## Goal

Create an internal `/prd` read-only viewer that renders canonical `docs/product` Markdown without creating duplicate product documentation.

## Scope

- Add `/prd` as a standalone Next.js App Router page outside the workspace shell.
- Render only a curated registry of product Markdown files from `docs/product`.
- Keep Markdown source only under `docs/`; do not copy docs into `site/`, `public/`, CMS, or a generated duplicate store.
- Treat `/Users/iseung-ug/Documents/clair-prd` as UX reference only; do not import its document content.
- Mark GitBook as no longer the active reader path while preserving existing GitBook files as inactive/deprecated history.
- Add epic and user-story operating templates without bulk-writing epics or stories.
- Add focused Playwright coverage for the `/prd` viewer.

## Out Of Scope

- Remote Supabase, migrations, RLS, production deploy, real data, provider integrations, and payment work.
- Workspace shell integration, auth/permission policy changes, or server-side security completion claims.
- Publishing or configuring GitBook.
- Exposing auth/security, DB/RLS, launch, operations, or completed-report documents in the viewer registry.
- Mermaid/Prism advanced rendering polish.
- Bulk product-planning rewrite or mass creation of epics and user stories.

## Done When

- `/prd` shows the default PRD from `docs/product/prd/clair-emr-saas-prd.md`.
- Users can switch among registered product docs without leaving `/prd`.
- The page shows the source Markdown path and keeps invalid `doc` values inside a safe empty state.
- Product docs README, docs portal, and agent RAG guidance identify `/prd` as the active internal reader and GitBook as inactive/deprecated.
- Epic and user-story templates exist and their README files explain how to use them.
- Verification passes for docs links and the focused viewer test.

## Verification

- `npm run docs:check` passed on 2026-06-11.
- `npx playwright test tests/prd-viewer.spec.ts` passed on 2026-06-11.
- `npm run lint` passed with pre-existing warnings only.
- `npx tsc --noEmit` passed after regenerating current Next build types.
- `npm run build` passed.

## Handoff Notes

- Keep the viewer registry explicit. Do not auto-expose every Markdown file under `docs/`.
- Keep the implementation server-first: read Markdown from local files on the server and pass only registry metadata to client components.
- If viewer scope expands into security, DB/RLS, launch, operations, or completed reports, require a separate reader-boundary review.
- Closeout: `docs/completed/product/2026-06-11-prd-viewer-readonly-closeout.md`.
