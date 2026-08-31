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
- Enable prototype-only image and video file insertion with BlockNote's built-in file panel, browser-local object URLs, inline image preview, and native video playback controls.
- Keep optical-exam commands visibly unavailable until their device contract exists.
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
- Durable file storage, clinical attachment persistence, production image/video upload, PACS, or optical-device integration.
- BlockNote XL, AI, collaboration, comments, or paid services.
- Production deployment, remote Supabase mutation, or real clinical data.

## Done Criteria

1. Storybook renders the actual `@blocknote/shadcn` editor with Korean localization and CLAiR token styling.
2. Hovering blocks exposes the provided add and drag affordances, and `/` opens the provided suggestion menu.
3. `기본 SOAP 템플릿` and `근골격계 SOAP 템플릿` insert useful block groups into the continuous document.
4. Selecting text exposes the provided floating formatting toolbar.
5. Image and video entries accept local files and render browser-session previews while clearly avoiding a persistence claim; the optical-exam entry remains unavailable.
6. The prototype can reset its sample document and inspect the current BlockNote JSON without network or database writes.
7. Focused lint, TypeScript, Storybook build/browser interaction, docs, secret, and diff checks pass or any environment-only limitation is recorded.

## Verification

- PASS — focused ESLint and full `npm run lint`
- PASS — `npx tsc --noEmit --pretty false`
- PASS — `npm run build-storybook`
- PASS — `npm run build`
- PASS — 35 focused Storybook browser interactions, including SOAP template insertion, filtered and 320px slash-menu sizing, provided left add/drag controls, slash/plus toggle-heading commands, selection-toolbar block conversion, toggle-heading collapse/empty/nested alignment behavior, title-block typography, all nine basic-block writing flows, local image/video upload and preview, and unsupported-media recovery
- PASS — `npm run docs:check`
- PASS — `npm run security:secrets`
- PASS — `git diff --check`

## Figma Review Remediation

- The representative Storybook template uses only BlockNote basic `paragraph` blocks; it does not rely on the persistence-only `soapSection` marker block.
- The Storybook editor opts into this basic-block template mode explicitly. The live persistence path keeps the existing sectioned document contract until a separate canonical-document migration is approved.
- The block side-menu geometry follows Figma nodes `28203:70265` and `28203:20344`: 24px add button, 16×24px grab button, native 14×14px six-dot grip glyph, 2px control gap, 4px outer inset, and 8px control-to-content gap.
- Focused browser verification covers the 320px, 420px, 566.5px, and 720px review widths without horizontal overflow.

## Edge-case Remediation

- Template insertion preserves an existing top-level paragraph and a populated nested paragraph; only an empty insertion target is replaced or removed.
- Basic-block duplicate detection recognizes SOAP section-header structure instead of treating an ordinary note containing `기본 SOAP` or a diagnosis-system label as an inserted template.
- The custom `+` filter ignores Enter and navigation keys while a Korean IME composition is active, and exposes the active option through combobox semantics.
- BlockNote's 42px/63px default H1 container no longer conflicts with the compact 14px inline override: heading levels now use CLAiR Heading 1 (20/28), Heading 2 (18/26), and Headline 1 (16/24) tokens for the block, entered text, caret, and placeholder together.
- The selection-toolbar block-type dropdown now matches the supported SOAP block contract: paragraph, heading 1/2/3, toggle heading 1/2/3, quote, bullet list, numbered list, and checklist. Unsupported heading 4/5/6 are not exposed instead of inheriting the heading-1 visual rule.
- Every remaining selection-toolbar block type is converted through the visible dropdown in Storybook while preserving its text; toggle headings additionally verify hidden, expanded, and re-collapsed child content. The dropdown stays inside the editor boundary at both 566.5px and 320px widths.
- The shared slash and `+` command menu now sizes to filtered content instead of retaining a fixed 520px body. The full command list still caps at 520px and scrolls, while a filtered video query renders a compact menu with the footer directly after the matching video and unavailable optical-exam rows.
- Focused Storybook interactions cover slash-placeholder cleanup, duplicate-template blocking, read-only input rejection, side-menu click stability, and the 320px menu boundary in addition to the representative Figma states.
- The basic-block writing matrix selects and types into text, heading 1/2/3, bullet, numbered, checklist, and quote blocks, then verifies Enter behavior, divider insertion with a trailing paragraph, command-state cleanup, and no horizontal overflow at both 566.5px and 320px widths.
- Toggle headings now keep a 14px triangle inside a 24px control, inherit the same 20/18/16px title hierarchy as ordinary headings through BlockNote's toggle wrapper, and align the empty-child prompt with the title text start.
- The custom side-menu middleware replaces BlockNote's fixed large-heading offsets with the rendered compact first-line height, so `+` and the 16×24px grab control stay centered on the hovered parent title even when an expanded empty-toggle prompt adds a second line. The controls move to a child row only when that child is actually hovered. Storybook covers heading levels 1/2/3, collapsed/expanded/re-collapsed, empty-child insertion, selection-toolbar conversion, parent-to-child-to-parent hover, and 566.5px/320px widths.
- BlockNote's existing toggle-heading 1/2/3 commands are now retained in the chart command allow-list, so the shared `/` and `+` menus both expose, filter, and insert all three levels instead of silently dropping them after the ordinary headings.
- BlockNote's existing image and video blocks are now included in the SOAP prototype schema. Their shared `/` and `+` commands open the provided upload/embed panel, local files receive session-only object URLs, images render inline, and videos expose native playback controls. New local previews start at 480px and clamp to the available editor width, including the 320px panel. Image preview on/off is verified through BlockNote's formatting toolbar, video playback is exercised with a valid WebM fixture, unsupported file types restore the add-file state, local URLs are revoked when the editor unmounts, and optical-exam integration remains disabled.

Environment notes:

- The local Node 23 runtime is outside Vitest and `eslint-visitor-keys` declared engine ranges; the executed lint, TypeScript, Storybook, and Next.js builds still passed.
- The Next.js build retains the repository's existing broad NFT trace warning from `src/lib/prd-viewer/doc-reader.ts`.
- Fresh direct Storybook iframe runs of the media story at the representative and 320px widths produced no browser warning or runtime error.
- `npm audit --omit=dev` reports the same production-dependency count in the original checkout and this prototype worktree: 1 low, 5 moderate, 9 high, and 0 critical.

## Review Artifact

- Interactive story: `http://127.0.0.1:6012/?path=/story/features-chart-soap-live-blocknote-figma-prototype--representative-review`
- Representative report: `docs/completed/chart/2026-08-31-chart-soap-blocknote-prototype-report.html`

## Handoff

After representative approval, create a separate full-stack work item for canonical BlockNote JSON persistence, legacy four-field projection, backward-compatible hydration, the live chart editor switch, and direct Tiptap dependency removal.
