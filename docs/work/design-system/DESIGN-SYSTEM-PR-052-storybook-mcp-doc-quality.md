---
id: "DESIGN-SYSTEM-PR-052"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook MCP documentation quality"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-051-storybook-mcp-local-endpoint.md"
  - "https://storybook.js.org/docs/ai/best-practices"
  - "https://storybook.js.org/docs/ai/manifests"
  - "https://storybook.js.org/docs/api/main-config/main-config-typescript"
updated: "2026-10-11"
---

# Storybook MCP Documentation Quality

## Goal

Improve the MCP-readable Storybook documentation quality for the six existing design-system stories so agents can see component purpose and prop intent instead of relying only on rendered snippets.

## Scope

- Add JSDoc summaries to the existing shared component source files.
- Add or export explicit prop aliases where the current upstream primitive types hide local EMR intent.
- Document key props for `Button`, `Badge`, `Input`, `SegmentedControl`, `EmrStatusBadge`, and `EmrInlineAlert`.
- Switch Storybook React prop extraction to `react-docgen-typescript`.
- Update Storybook operating rules with MCP doc-quality expectations.
- Verify the local MCP components manifest includes the six documented components.

## Out Of Scope

- Adding new components or new story files.
- Changing runtime component behavior, variants, styling, or public UI behavior.
- Configuring external/global agent clients.
- Publishing or sharing the Storybook MCP endpoint.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Local MCP manifest check at `http://127.0.0.1:6006/manifests/components.json`.
- MCP `run-story-tests` focused check for `design-system-ui-button--default`.

## Handoff Notes

Ready for Human Review.

Recommended next step: connect a project-scoped MCP client only after reviewing the manifest output for whether the prop descriptions are clear enough for agent-assisted UI work.

## 2026-10-10: Local EmrDataTable MCP Example Correction

### Approval And Boundary

승욱 authorized a local correction of the `EmrDataTable` MCP-generated documentation after the deployed-product/Storybook audit. This slice changes only the table stories, one executable documentation example, a table-specific manifest preset registered in `.storybook/main.ts`, this record, and a focused check script. Commit, push, merge, deployment, endpoint publication, and fixes to other components remain out of scope.

The existing local grow-column width correction is preserved. `emr-data-table.tsx`, `tests/customer.spec.ts`, and the PR-088 record retain their pre-documentation-change hashes. The story geometry checks remain active and pass.

### Confirmed Cause

Installed Storybook `10.4.6` with `@storybook/addon-mcp` `0.6.0` generates component manifests from CSF source. Its React preset excludes locally defined demo components, then selects the imported `EmrDataTable`. Without an explicit render, it applies demo arguments such as `pinned` and `rowCount` to that actual component. Those arguments are not `EmrDataTableProps`.

The generator also does not evaluate the viewport-story factory. The twelve zero/one/many, fill/content, pinned/unpinned examples therefore inherited the same default arguments in MCP code. Its import generator rewrites project imports to the application package name. `parameters.docs.source` does not repair this MCP path. The human Docs “Show code” path was already correct and is not the reported defect.

### Narrow Correction

- `useEmrDataTableStoryProps` reuses the existing synthetic rows, TanStack controller, state, and slots. It is explicitly a **Storybook-only fixture hook**, not a product API. `excludeStories` prevents its export from adding a story.
- The twelve viewport stories now declare literal arguments and reuse the same play function. The explicit meta render keeps example arguments on `EmrDataTableStory`.
- `.storybook/emr-data-table-doc-example.tsx` is the executable source for the actual API example. It imports from resolvable `@/components/...` paths and passes `table`, `aria-label`, and `viewportMode` to `EmrDataTable`. Its bounded 420px frame matches the real story and supports fill mode.
- `.storybook/emr-data-table-manifest.preset.ts` uses the installed `experimental_manifests` hook to replace only `design-system-emr-emrdatatable` imports, description, and example code. It derives all 25 examples from that source and the generated story render; it does not maintain 25 copied snippets or alter docgen props.
- `scripts/check-emr-data-table-mcp-docs.mjs` reads a local live or built manifest, checks every example against the literal source arguments, and compiles emitted TSX against the real API and existing project ambient types. Generated check files remain virtual and do not enter the repository.

### Verification

- Live and built manifests: all 25 examples match their source arguments and typecheck. A negative probe replacing `table={props.table}` with `table={undefined}` is rejected by TypeScript (`TS2322`), confirming that the check validates the actual required API.
- All 25 existing `EmrDataTable` stories pass MCP `run-story-tests`, including viewport geometry, sorting, resizing, loading, pinning, overlays, and selection. All 25 story IDs are unchanged.
- Parent independent review: all 74 other component entries are byte-equivalent; only the table entry changes. The three existing non-story grow-fix files retain their hashes.
- Parent human Docs review: all 25 headings remain visible; Show code names the demo wrapper with `rowCount="zero"`; Controls change zero to one rendered row and return to zero. Fresh MCP documentation for Content Pinned One Row shows the bounded actual API example with `pinned=true`, `rowCount="one"`, and `viewportMode="content"` on the demo configuration.
- `npm run lint`: pass, zero errors and five existing unused-variable warnings in unrelated WP-10 scripts.
- `npx tsc --noEmit`, `npm run docs:check` (1,104 Markdown files), `npm run build-storybook`, local Storybook `--ci --smoke-test`, and `git diff --check`: pass. Build retains existing no-MDX/docgen/chunk-size warnings.
- Local verification artifacts: `/tmp/pr052-all-table-story.json`, `/tmp/pr052-mcp-after-components.json`, `/tmp/pr052-storybook-build.log`, `/tmp/pr052-storybook-smoke.log`, and `/tmp/pr052-invalid-table-check.log`.

Reproduce the focused documentation check with `node scripts/check-emr-data-table-mcp-docs.mjs` while local Storybook runs on 6007, or pass `storybook-static/manifests/components.json` after building. The endpoint remains loopback-only and running for review.

### Remaining Audit Candidates

The separate read-only catalog audit counted 75 manifest groups and 66 human Docs pages. The 35 component-name mismatches and 45 Docs examples containing undefined local helpers are candidates, not 80 confirmed API failures. Source sampling confirmed the same wrapper-prop error for `EmrRightPanel`; `EmrTableFilterBuilder` and UI Table have undefined wrapper examples. Button's sampled props match its API. Their package-name imports and all other component entries remain unchanged in this table-only slice.

Local implementation is ready for Human Review. No commit, push, deployment, runtime API change, or production data operation occurred.

## 2026-10-10: Subsequent Three-Component MCP Correction

### Approved Scope And Implementation

승욱 separately authorized local MCP documentation fixes for `EmrRightPanel`, `EmrTableFilterBuilder`, and UI `Table`. No commit, push, merge, deployment, runtime component change, or broader catalog rewrite is authorized by this slice.

`EmrRightPanel` had the same imported-component fallback: its demo `footerSize` and `longBody` arguments appeared on the actual panel, while the required `header` was absent. Its meta now explicitly renders `EmrRightPanelExample`. The filter builder and Table already used explicit renders, but their generated code omitted the local example definitions, state helpers, data, and resolvable imports.

The new `.storybook/story-example-manifests.preset.ts` targets exactly those three IDs. It reads each executed story's pre-meta imports, types, sample constants, helpers, and example function. It removes Storybook-only imports, maps only known relative imports to their actual `@/components/...` modules, and prepends those declarations to the generated code. Original descriptions and docgen props remain intact; a short note distinguishes demo settings from actual APIs. There are no copied example bodies, exported demo hooks, new dependencies, or changes to the existing EmrDataTable documentation preset.

The Table stories `BothAxisOverscroll`, `PinnedColumns`, and `EmptyRows` retain their individual generated renders. They are not converted to `TableExample`: the eight-row two-axis table, the pinned workspace with 224px pinned width/48px identity inset/44px selection/840px minimum, and the two-column empty table remain distinct.

`scripts/check-story-example-mcp-docs.mjs` verifies all 13 IDs and literal arguments, including numeric widths. For Table's three custom renders it compares their syntax trees against the executed source after substituting the real story arguments. It compiles all emitted TSX against actual source APIs, with virtual files and the existing project ambient declarations.

### Verification And Independent Review

- Live and built manifests: all 13 examples typecheck and match their source arguments or custom renders. Negative probes missing RightPanel `header`, missing FilterBuilder `model`, and using an invalid Table `density` produce the expected TypeScript errors (`TS2741` / `TS2322`).
- All 13 story IDs are unchanged. Parent manifest review confirms exactly three changed entries; the other 72, including `EmrDataTable`, are byte-equivalent. The seven previous WIP files outside the shared main configuration and this record retain their hashes.
- MCP story tests: **12/13 pass**. The unchanged Table `PinnedColumns` test fails its existing body-padding assertion. The same failure reproduces with only the new three-entry preset disabled; the raw baseline manifest restores `TableExample` and omits the new preface. `.storybook/main.ts` is restored byte-for-byte in `finally`, then 6007 restarts with both corrections enabled.
- Parent human Docs review confirms five RightPanel story headings, six rendered panel instances including the repeated primary example, and 24 LongBody rows. FilterBuilder's complete rule shows active values; EmptyDraft shows unset inputs and disabled clearing. All six Table headings and distinct tables remain visible, including eight two-axis rows, two pinned rows, and the empty state. Controls remain visible; this slice does not claim a new interactive Controls test or a pinned geometry pass. No RightPanel browser errors were observed.
- Full `npm run lint`: pass, zero errors and the same five unrelated WP-10 warnings. `npx tsc --noEmit`, `npm run docs:check` (1,104 Markdown files), `npm run build-storybook`, local `--ci --smoke-test`, and `git diff --check`: pass. Existing no-MDX/docgen/chunk-size warnings remain.
- Read-only source/checker review found no additional issue. No production module, CSS, Table story, or existing assertion was changed.

### Existing PinnedColumns Failure

`src/components/ui/table.stories.tsx:553` requires every first scrolling content hook, including both body rows, to have `marginInlineStart === "10px"` and `paddingInlineStart === "0px"`. The current body fixtures declare `px-2`. `src/app/globals.css:991` applies the zero-padding normalization only to `[data-slot="table-head"]`; the body hook has no equivalent rule. This source/expectation mismatch is unchanged by the documentation preset. The reproduced message is `Pinned first body content hook does not own the 10px inset normalization.` Fixing that runtime/test contract requires a separate scoped change; this documentation slice does not weaken the assertion or change spacing.

### Evidence And Handoff

Local artifacts: `/tmp/pr052-three-final-components.json`, `/tmp/pr052-three-story-results.json`, `/tmp/pr052-three-baseline-pinned-result.json`, `/tmp/pr052-three-preset-disabled-manifest.json`, `/tmp/pr052-three-final-check.log`, `/tmp/pr052-three-static-check.log`, `/tmp/pr052-three-invalid-api-check.log`, `/tmp/pr052-three-storybook-build.log`, and `/tmp/pr052-three-storybook-smoke.log`.

Run `node scripts/check-story-example-mcp-docs.mjs` against local 6007, or pass `storybook-static/manifests/components.json` after building. The loopback endpoint remains running for review. The MCP documentation correction is locally verified; the unrelated, reproduced PinnedColumns failure remains explicit. Other catalog audit candidates remain outside this approved slice.

## 2026-10-11: PinnedColumns Residual Resolved In PR-088

The failure above records the state at the end of the documentation-only slice.
승욱 subsequently approved its separate shared spacing correction and fixture
validation under `DESIGN-SYSTEM-PR-088-pinned-identity-table-rollout.md`.

The actual body hook padding was 4px, making the 10px boundary margin a 14px
content-surface inset. The narrow shared selector now normalizes that direct
body hook to zero leading padding while preserving nested badge padding at
8px. The example also uses the shared viewport as its sole overflow owner,
and its play checks the correct origin/scrolled dimmer states after bounded
state waits. Original assertions were retained.

Final UI Table plays pass 6/6, including the previously failing PinnedColumns.
All 25 related EmrDataTable plays and the focused customer pinning regression
passed. Final live and built MCP checks compile all 13 examples against the
actual APIs. The Pinned Columns snippet includes the executed
`containerStyle={{ overflow: "visible" }}` and `overscrollAxes="none"` props;
the other five Table snippets and other 74 component entries remain unchanged.
Scoped ESLint, TypeScript, docs references, and the final Storybook build pass.
Parent browser checks confirm the 10px surfaces, preserved 8px badge padding,
single owner, fixed pinned positions, and origin/scrolled dimmer states at
1440 and 768px. The PR-088 record holds detailed evidence. Other catalog audit
candidates remain outside scope; no delivery or remote write occurred.
