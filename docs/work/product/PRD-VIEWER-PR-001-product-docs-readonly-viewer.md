---
id: "PRD-VIEWER-PR-001"
status: "human_review"
area: "product"
priority: "P0"
target_pr: "CLAiR Docs viewer PR 1"
source_docs:
  - "docs/product/README.md"
  - "docs/product/prd/clair-emr-saas-prd.md"
  - "docs/_meta/agent-rag-map.md"
  - "docs/_meta/intake-rules.md"
dependencies: []
updated: "2026-06-14"
---

# CLAiR Docs Read-Only Product Viewer

## Goal

Create an internal CLAiR Docs read-only viewer that renders canonical `docs/product` Markdown without creating duplicate product documentation.

## Scope

- Add `/docs` as the canonical standalone Next.js App Router page outside the workspace shell.
- Keep `/prd` as a compatibility route that redirects to `/docs`.
- Render only a curated registry of product Markdown files from `docs/product`.
- Keep Markdown source only under `docs/`; do not copy docs into `site/`, `public/`, CMS, or a generated duplicate store.
- Treat `/Users/iseung-ug/Documents/clair-prd` as UX reference only; do not import its document content.
- Mark GitBook as no longer the active reader path while preserving existing GitBook files as inactive/deprecated history.
- Add epic and user-story operating templates without bulk-writing epics or stories.
- Add focused Playwright coverage for the `/docs` viewer and `/prd` compatibility route.

## Out Of Scope

- Remote Supabase, migrations, RLS, production deploy, real data, provider integrations, and payment work.
- Workspace shell integration, auth/permission policy changes, or server-side security completion claims.
- Publishing or configuring GitBook.
- Exposing auth/security, DB/RLS, launch, operations, or completed-report documents in the viewer registry.
- Mermaid/Prism advanced rendering polish.
- Bulk product-planning rewrite or mass creation of epics and user stories.

## Done When

- `/docs` shows the default PRD from `docs/product/prd/clair-emr-saas-prd.md`.
- `/prd` redirects to `/docs` while preserving the `doc` query value.
- Users can switch among registered product docs without leaving CLAiR Docs.
- The page shows the source Markdown path and keeps invalid `doc` values inside a safe empty state.
- Product docs README, docs portal, and agent RAG guidance identify `/docs` as the active internal reader and GitBook as inactive/deprecated.
- Epic, feature spec, and user-story templates exist and their README files explain how to use them.
- Search results show document type plus concise source context without auto-exposing every Markdown file.
- Verification passes for docs links and the focused viewer test.

## Verification

- `npm run docs:check` passed on 2026-06-12.
- `npm run lint` passed on 2026-06-12 with pre-existing warnings only.
- `npx tsc --noEmit` passed on 2026-06-12.
- `npm run build` passed on 2026-06-12.
- `npx playwright test tests/prd-viewer.spec.ts` passed on 2026-06-12.

Additional IA refresh verification on 2026-06-14:

- `npm run docs:check` passed.
- `npm run lint` passed with pre-existing warnings only.
- `npx tsc --noEmit` passed.
- `npx next build --webpack` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/prd-viewer.spec.ts --config=playwright.config.ts` passed.
- `npm run build` in the temporary `/tmp/clair-docs-auth-planning` worktree failed because Turbopack rejects the temporary `node_modules` symlink that points outside the filesystem root. The same code path passed with webpack build; Vercel preview remains the deployment verification path.

## Handoff Notes

- Keep the viewer registry explicit. Do not auto-expose every Markdown file under `docs/`.
- Keep the implementation server-first: read Markdown from local files on the server and pass only registry metadata to client components.
- If viewer scope expands into security, DB/RLS, launch, operations, or completed reports, require a separate reader-boundary review.
- Closeout: `docs/completed/product/2026-06-11-prd-viewer-readonly-closeout.md`.

## Follow-Up Scope Added 2026-06-12

- Rename the reader surface to CLAiR Docs.
- Add `/docs` as the canonical route and retain `/prd` as redirect-only compatibility.
- Extend the explicit registry with document type, description, and tags for command search.
- Strengthen product planning document placement rules for PRD, epic, feature, user story, decision, and domain docs.
- Preserve Vercel Deployment Protection for previews; do not change public access or production deployment policy in this work.

## Follow-Up Scope Added 2026-06-14

- Rework CLAiR Docs information architecture from product-only navigation to `기획 / 디자인 / 개발` top-level reader tabs.
- Keep source Markdown in the existing `docs/product`, `docs/design`, and `docs/engineering` locations; do not move files for this IA pass.
- Preserve all existing viewer slugs and `/docs?doc=<slug>` / `/prd?doc=<slug>` compatibility.
- Add registry metadata for reader area, section, order, audience, exposure, sensitivity, and source-of-truth posture.
- Keep design and development tabs curated. Do not expose sensitive auth/security, DB/RLS, operations, launch, completed, or archive documents by default.
- Implementation basis: `docs/design/wireframes/clair-docs-ia-sitemap.md`.
