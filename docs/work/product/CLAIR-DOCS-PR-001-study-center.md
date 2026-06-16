---
id: "CLAIR-DOCS-PR-001"
type: "Work Item"
title: "CLAiR Docs Study Center"
description: "Add a local Study tab to CLAiR Docs and archive the first owner-learning lesson in repo Markdown."
status: "human_review"
area: "product"
priority: "P1"
tags: ["docs", "study", "owner-learning", "clair-docs"]
target_pr: "CLAiR Docs Study Center v1"
source_docs:
  - "docs/index.md"
  - "docs/README.md"
  - "docs/_meta/agent-rag-map.md"
  - "docs/_meta/intake-rules.md"
  - "docs/_meta/documentation-depth-rules.md"
  - "docs/work/product/PRD-VIEWER-PR-001-product-docs-readonly-viewer.md"
dependencies: []
updated: "2026-06-17"
---

# CLAiR Docs Study Center

## Goal

Add a local/internal Study section to CLAiR Docs so 승욱 can continue project learning through archived Markdown lessons, diagrams, glossary, and review questions.

## Scope

- Create `docs/study/` as the local study archive for curriculum, glossary, diagrams, templates, and lesson sessions.
- Archive the first study session covering `patient`, `appointment`, `encounter`, `queue entry`, and the next `order` relationship question.
- Expand the existing read-only docs viewer into CLAiR Docs with curated section tabs for 기획, 디자인, 개발, and 스터디.
- Add a preferred `/docs` route while keeping `/prd` as a compatibility path.
- Add lightweight Mermaid preview handling without adding a new runtime dependency.
- Update focused docs navigation references and viewer regression coverage.

## Out Of Scope

- Supabase, DB schema, RLS, migration, or persistence changes.
- Login, auth gating, role/permission policy changes, or workspace shell integration.
- External publication, GitBook revival, production deploy, or public access changes.
- Real hospital, staff, guardian, patient, billing, payment, identity, credential, or provider data.
- AI-in-the-site runtime question generation or stored quiz progress.

## Done When

- CLAiR Docs exposes a Study tab that can open study home, curriculum, first session, glossary, and diagrams.
- Study notes are stored as Markdown under `docs/study/`.
- `/docs` opens the curated docs viewer and `/prd` remains usable for existing product-doc links.
- Existing PRD viewer coverage is updated to cover the renamed CLAiR Docs experience and the Study tab.
- Docs link checks and focused viewer tests pass.

## Verification

- `npm run docs:check` passed on 2026-06-17.
- Focused `npx eslint src/app/prd/page.tsx src/app/prd/prd-navigation.tsx src/app/docs/page.tsx src/lib/prd-viewer/registry.ts src/lib/prd-viewer/doc-reader.ts src/lib/prd-viewer/markdown-renderer.tsx tests/prd-viewer.spec.ts` passed on 2026-06-17.
- `npx tsc --noEmit` passed on 2026-06-17 after restoring missing local npm dependencies with `npm install`.
- `npx playwright test tests/prd-viewer.spec.ts` passed on 2026-06-17.
- `npm run build` passed on 2026-06-17.
- Full `npm run lint` is blocked by unrelated in-progress reception changes in `src/features/reception/module.tsx`.

## Handoff Notes

- Study notes are local/internal learning aids and should not become product or engineering truth.
- Keep the viewer registry curated; do not auto-expose sensitive engineering, auth, DB/RLS, launch, or completed-report docs.
- Future enhancement candidates: richer Mermaid SVG rendering, study progress state, and a dedicated review-question mode.
- Closeout: `docs/completed/product/2026-06-17-clair-docs-study-center-report.html`.
