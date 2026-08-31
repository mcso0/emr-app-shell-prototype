---
id: "CHART-PR-029"
status: "human_review"
area: "chart"
priority: "P0"
target_pr: "User-approved BlockNote SOAP editor prototype"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/chart/CHART-PR-006-soap-editor-ux-foundation.md"
dependencies:
  - "CHART-PR-026"
updated: "2026-08-31"
---

# BlockNote SOAP Editor Prototype

## Goal

Build a representative-reviewable SOAP authoring prototype with BlockNote's actual ShadCN Notion-like editor UI before replacing the production chart editor or changing the SOAP persistence contract.

## Approved Scope

- Add the MPL-2.0 BlockNote core, React, and ShadCN packages at an exact reviewed release line.
- Create a chart-owned Storybook prototype using BlockNote's default block side menu, drag handle, slash menu, and selection formatting toolbar.
- Add Korean SOAP template commands for the default S/O/A/P structure and a system-specific musculoskeletal template.
- Keep image, video, and optical-exam commands visibly unavailable until their clinical attachment or device contracts exist.
- Map BlockNote theme variables and editor geometry to existing CLAiR EMR semantic tokens and Pretendard typography.
- Expose the current BlockNote JSON document in a prototype-only inspector so the future persistence contract can be reviewed without saving clinical data.
- Add focused Storybook interaction coverage and produce a Korean representative report.

## UX Contract

- Preserve BlockNote's provided Notion-like interaction structure; do not recreate its menus or drag affordances with a separate custom editor shell.
- The left `+` and drag handle appear through BlockNote's block side menu.
- `/` and the left `+` open the same BlockNote suggestion menu.
- Text selection opens BlockNote's provided floating formatting toolbar.
- SOAP templates insert into one continuous document instead of rendering four independent cards.
- CLAiR customization is limited to semantic tokens, compact typography, spacing, borders, focus, Korean labels, and SOAP-specific commands.

## Out Of Scope

- Replacing the live chart SOAP editor in `src/features/chart/module.tsx`.
- Changing SOAP API, RPC, schema, RLS, audit, autosave, conflict, or migration behavior.
- Removing the current direct Tiptap dependencies before the product editor switch.
- File storage, clinical attachment persistence, image/video upload, PACS, or optical-device integration.
- BlockNote XL, AI, collaboration, comments, or paid services.
- Production deployment, remote Supabase mutation, or real clinical data.

## Done Criteria

1. Storybook renders the actual `@blocknote/shadcn` editor with Korean localization and CLAiR token styling.
2. Hovering blocks exposes the provided add and drag affordances, and `/` opens the provided suggestion menu.
3. `기본 SOAP 템플릿` and `근골격계 SOAP 템플릿` insert useful block groups into the continuous document.
4. Selecting text exposes the provided floating formatting toolbar.
5. Image, video, and optical-exam entries communicate their unavailable integration state without claiming upload or device behavior.
6. The prototype can reset its sample document and inspect the current BlockNote JSON without network or database writes.
7. Focused lint, TypeScript, Storybook build/browser interaction, docs, secret, and diff checks pass or any environment-only limitation is recorded.

## Verification

- PASS — focused ESLint and full `npm run lint`
- PASS — `npx tsc --noEmit --pretty false`
- PASS — `npm run build-storybook`
- PASS — `npm run build`
- PASS — focused Storybook browser interaction for SOAP template insertion, slash menu, provided left add/drag controls, selection toolbar, reset, and JSON inspector
- PASS — `npm run docs:check`
- PASS — `npm run security:secrets`
- PASS — `git diff --check`

Environment notes:

- The local Node 23 runtime is outside Vitest and `eslint-visitor-keys` declared engine ranges; the executed lint, TypeScript, Storybook, and Next.js builds still passed.
- The Next.js build retains the repository's existing broad NFT trace warning from `src/lib/prd-viewer/doc-reader.ts`.
- The Storybook browser console has only the development favicon 404; the prototype produced no runtime error.
- `npm audit --omit=dev` reports the same production-dependency count in the original checkout and this prototype worktree: 1 low, 5 moderate, 9 high, and 0 critical.

## Review Artifact

- Interactive story: `http://127.0.0.1:6011/?path=/story/features-chart-soap-blocknote-prototype--representative-review`
- Representative report: `docs/completed/chart/2026-08-31-chart-soap-blocknote-prototype-report.html`

## Handoff

After representative approval, create a separate full-stack work item for canonical BlockNote JSON persistence, legacy four-field projection, backward-compatible hydration, the live chart editor switch, and direct Tiptap dependency removal.
