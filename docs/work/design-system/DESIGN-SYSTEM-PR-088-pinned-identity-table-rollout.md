---
id: "DESIGN-SYSTEM-PR-088"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "User request / customer and hospital-admin pinned identity table rollout"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md"
updated: "2026-10-11"
---

# Pinned Identity Table Rollout

## Goal

Roll the shared pinned-column surface out to customer patient, guardian, and
archive tables plus every hospital-admin Order leaf table. For selectable
tables, keep the selection column and the domain identity column fixed
together while aligning the identity label and row value to the workspace
title axis. Keep one horizontal scroll owner and use the shared whole-table
feedback surface whenever normal rows cannot be rendered.

## Approved Decisions

- Hospital-admin pins `표준 Order명`.
- Selectable customer and Order tables pin `select` first and the domain
  identity second.
- The customer animal list removes the leading avatar; the selection control
  occupies the space before the unchanged animal-name text axis.
- No-data, filtered-empty, read-error, and permission-denied states use the
  shared whole-table Empty State surface.
- Customer archive uses the existing archive GET/PATCH routes and includes
  restore, permission denial, and failure states.
- All 15 Order leaf screens are required for completion.
- Review units are shared contract, customer rollout, and Order rollout.

## In Scope

- Shared pinned workspace and identity text-axis primitives.
- Shared selection-column width and contextual row-selection visibility.
- Shared whole-table feedback surface.
- Shared 0px pinned-table workspace header padding-top.
- Customer patient, guardian, and deleted guardian/patient tables.
- Customer archive read, filter, retry, restore, permission, and failure UI.
- Hospital-admin Order renderer used by all leaf screens.
- Single `Table` container horizontal overflow ownership.

## Out Of Scope

- Hospital-admin audit, membership, role, schedule, vital, space, concept, or
  drawer-summary tables.
- New archive schema, migrations, hard deletion, or real customer data.
- New grid dependencies.
- Remote Supabase mutation or schema deployment.

## Done Criteria

- Every selectable in-scope table has an opaque pinned selection column and
  opaque pinned identity column in default, hover, selected, and loading
  states. The non-selectable archive table keeps its identity-only pin.
- Title, applicable search edge, pinned header text, pinned row identity text,
  and footer total use one exact local identity axis.
- Customer archive loads the existing soft-deleted list and restores through
  the target-specific existing mutation route.
- Read and mutation permission denial and retryable failures are visible.
- Terminal no-data, no-filter-results, read-error, and no-permission states
  replace the table body with the shared Empty State surface.
- All 15 Order leaf screens use the same `표준 Order명` pinned renderer.
- The shared table container is the only horizontal overflow owner.
- Focused behavior, responsive geometry, lint, typecheck, docs, secret scan,
  Storybook build, and Next build verification are recorded.

## Result

- `EmrPinnedTableWorkspace`, `EmrTableHeaderCell identity`,
  `EmrTableIdentityCellContent`, and `EmrTableFeedbackSurface` now own the
  cross-family identity axis and whole-table feedback boundary.
- Animal and guardian tables pin the 44px selection column plus their domain
  name column. The animal list no longer renders an avatar before the name.
  Title, header, row text, and footer total retain the same 48px local axis.
- Header selection stays visible; desktop row selection appears on hover,
  focus-within, or selected rows, while touch devices keep it available.
- The deleted guardian/patient table remains non-selectable and therefore pins
  only its display-name identity.
- The deleted screen reads the existing soft-deleted archive route, restores
  through the existing target-specific PATCH route, updates the archive count,
  and exposes loading, empty, filtered-empty, denied, retry, and restore-failure
  states.
- Every Order leaf uses the same renderer with selection as the physical first
  pinned column and `표준 Order명` as the second pinned identity column. The
  title/header/row identity axis is 48px.
- The Order table no longer uses an outer `ScrollArea`; the shared Table
  container is the sole horizontal table-overflow owner.
- Customer and Order no-data, filtered-empty, read-error, and denied states
  render through the shared whole-table feedback surface without stale rows.
- No schema, migration, new dependency, hard-delete behavior, drawer workflow,
  or production state changed.

## Verification

- Customer and archive Playwright suite: 20/20 passed.
- Hospital-admin Playwright suite: 37/37 passed.
- Shared Table Storybook interaction tests: 5/5 passed.
- Full ESLint, TypeScript, docs check (888 files), secret scan (3,485 tracked
  files), diff check, Storybook build, and Next production build passed.

Result report:

- `docs/completed/design-system/2026-07-29-selectable-pinned-identity-empty-state-correction-report.html`

## 2026-10-10 Local Grow-Width Correction

- 승욱 approved a local shared grow-width fix and wide/narrow validation.
  The implementation starts from `c9f82f628f861a6526e5e8384dcad6636f5650ac`.
  Commit, push, merge, and deployment are outside this approval.
- The unmodified baseline guardian geometry test reproduced a 12.59375px
  title/header offset at 1900px. The new Storybook width assertion also failed:
  a nominal 44px selection column grew by 42.78125px in its wide frame.
- `colgroup` left the selected grow column automatic, but the common header
  assigned a fixed width to that same column. With every column constrained,
  the browser distributed spare width across selection and identity columns.
- The existing internal `growColumnId` now reaches the header renderer. Only
  that header omits its fixed width; minimum/maximum widths remain unchanged.
  Column selection, public props, padding, colors, and feature controllers did
  not change. The existing 48px customer title/identity axis remains intact.
- Existing viewport Storybook plays now check actual fixed-column widths and
  header/body edges at frame widths 1900, 1000, and 720px. Loading checks four
  skeleton rows. Resizing checks 180 → 188 → 180px. Plays restore the original
  frame width in `finally`.
- A focused customer regression checks animal and guardian tables at 1900 and
  1000px: selection 44px, identity 184px, and one title/header/body axis. Hiding
  `registeredAt` makes the last remaining data column absorb spare width.
  Identity keyboard resizing checks 184 → 192 → 184px, then restores visibility.
- The existing mouse-resize test also failed on unmodified baseline source.
  Its handle center was x599, outside the clipped header hit area, and hit
  `patientNo`; x597 was inside the actual handle. The test now derives the
  center of the visible handle/header rectangle intersection and drags 24px
  from that point. Its original width-increase assertion is unchanged. No
  production resize/CSS change or diagnostic instrumentation remains.

Verification:

- Focused Storybook width/state run: 14/14 passed.
- All existing `EmrDataTable` stories: 25/25 passed, including left/right
  pinning, row overlays, selection, sorting, and touch fallback.
- Four focused customer Playwright cases passed: three geometry/pinning cases,
  then the mouse-resize case rerun after the test-target correction.
- Independent local browser checks at 1900 and 1000px confirmed animal and
  guardian selection 44px, identity 184px, and title/header/body x121. The
  generic Storybook table retained selection 44px and identity 180px.
- Local browser evidence is in the user-owned visualization directory
  `table-width-fix/`; no production or external data writes were performed.
- Scoped ESLint, TypeScript, docs references (1,104 markdown files), diff check,
  and Storybook production build passed. Build warnings about the absent MDX
  pattern, docgen project scope, and large chunks are pre-existing.

## 2026-10-11 Local First-Scroll Body Inset Correction

승욱 approved the remaining UI Table pinned-padding correction, preserving the
existing geometry assertions and all earlier local grow-width/MCP work. This
slice changes one shared CSS selector, the existing `PinnedColumns` fixture and
play, the owning table contract, and the PR-088/PR-052 records. No commit, push,
merge, deployment, dependency, runtime API, or remote data operation is included.

The body hook's **computed** leading padding was 4px from
`.emr-table-cell-content`, despite its `px-2` class. The 10px boundary margin
therefore placed both body content surfaces 14px after the cell edge, while the
header surface started at 10px. The existing zero-leading-padding selector now
also covers the first non-pinned body cell's direct content hook. It excludes
`emr-data-table-cell-content--no-boundary-inset`. The nested header-child rule
remains header-only; nested body badge padding and trailing hook padding remain
intact. Later scroll columns, right-pinned cells, and unpinned tables do not
match the selector. Existing `EmrDataTable` body hooks already normalize this
padding, so the product adapter requires no additional change.

The unchanged play next exposed two fixture/setup errors. It reset to the
origin but expected the dimmer's scrolled opacity, and the raw `Table` created
a second overflow owner inside `EmrPinnedTableViewport`. The fixture now uses
the existing `containerStyle={{ overflow: "visible" }}` and
`overscrollAxes="none"` API, matching `EmrDataTable`. The play selects the shared
scroll owner, waits for its origin state, checks opacity 0, then actually
scrolls 120px and waits for the overflow-start state before the original
opacity 1, dimmer, and divider assertions. It restores the origin in `finally`.
All original spacing, pinning, hover, selected, clipping, and overflow assertions
retain their expected values. New guards preserve both badges' 8px inner
padding on each side.

Verification:

- Final UI Table plays: 6/6 passed. All 25 related `EmrDataTable` plays passed
  with the shared CSS change before the Table-only fixture/setup correction;
  they were not needlessly repeated.
- Existing customer animal identity-pinning/horizontal-scroll Playwright
  regression: 1/1 passed against the local mock server on 3107.
- Parent browser verification at 1440 and 768px: header/body/body surface
  insets `[10, 10, 10]`, outer leading padding `[0, 0, 0]`, and nested badge
  leading/trailing padding 8px. The prior body surface insets were `[14, 14]`.
  There is exactly one horizontal owner. ArrowRight moves it from 0 to 120px;
  the left pinned positions `[16, 60]` remain fixed. Dimmer opacity changes
  from 0 at the origin to 1 with overflow-start. These measurements describe
  the **content surface**, not the badge's inner text edge.
- Live and built MCP examples: all 13 typecheck and match the actual renders.
  Fresh Pinned Columns documentation includes the corrected overflow API.
  Only its snippet changes; the other five UI Table stories and other 74
  component entries are equivalent to the preceding verified manifest.
- Scoped UI Storybook ESLint, full TypeScript check, Storybook production
  build, docs references, and diff check passed. Existing build warnings remain.
- Local artifacts: `/tmp/pr088-inset-ui-final-story-results.json`,
  `/tmp/pr088-inset-story-results.json`, `/tmp/pr088-inset-customer.log`,
  `/tmp/pr088-inset-mcp-check.log`, `/tmp/pr088-inset-mcp-built-check.log`,
  `/tmp/pr088-inset-final-pinned-doc.json`,
  `/tmp/pr088-inset-manifest-diff-check.json`, and
  `/tmp/pr088-inset-storybook-build.log`.

Parent browser screenshots are in the user-owned visualization directory as
`ui-table-inset-fixed.png` and `ui-table-inset-fixed-detail.png`. Local Storybook
6007 remains available for review. The former PR-052 residual failure is resolved
by this separately approved contract/fixture slice.


## 2026-10-11 Plain Status Header and Rounded Fixture Split

- 승욱 approved replacing the default Pinned Columns status header with plain
  text and moving the rounded-header regression fixture into a separate story.
  Commit and deployment remain outside scope.
- `PinnedColumns` keeps its existing ID and now renders a plain `상태` span.
  `PinnedColumnsRoundedContent` contains the rounded header button used for
  boundary clipping checks. Both use the same story-only table and play helper.
- Both stories retain the 10px header/body boundary checks, nested body badge
  8px padding, left/right pinning, identity alignment, hover/selected surfaces,
  one scroll owner, and origin/scrolled dimmer/divider checks. Only the plain
  header is exempt from the rounded-corner assertion; its span, transparent
  background, zero radius, and absence of a button are checked explicitly.
- The existing MCP regression expects seven UI Table stories, including the
  new rounded fixture, and compiles both actual renders against real APIs.

Verification: all seven UI Table plays passed; live and built MCP examples
passed their 14-example API/render check. Scoped ESLint, TypeScript, Storybook
production build, docs references (1,104 files), and diff check passed. Browser
inspection confirmed a transparent, zero-radius span at a 10px inset in the
default story and an 8px-radius button at a 10px inset in the rounded story.
Runtime components and CSS were unchanged in this follow-up.
