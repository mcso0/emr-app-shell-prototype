---
type: "screen-plan"
title: "Plan/Order Quick Add — Interaction Proposal"
description: "A reviewable append-only order search flow below existing chart orders, with a local interactive prototype."
status: "implemented"
area: "chart"
tags: [chart, plan-order, quick-add, prototype]
related_work: [CHART-PR-035]
last_updated: "2026-09-07"
---

# Plan/Order Quick Add

## Decision and authorization

승욱 approved the design direction and requested a clickable browser prototype
on 2026-09-06. The confirmed review amendments below define the implementation.
On 2026-09-07, the predecessor task delivered the user-authorized resume handoff
after PR #711 merged and deployed. Local implementation resumed from merge
`2e40894066d4b2e4a67a83d0ccd24539baa78aa5` in an isolated clean worktree.

This authorization covers minimal local implementation and focused regression.
Reuse existing UI components; any new common/UI component requires separate
user approval before creation. No new React component was created. Application
release was separately authorized on 2026-09-07 after local result review; exact
candidate, check, Preview and smoke evidence still gate delivery.
The previously authorized temporary share applies only to the isolated synthetic
prototype directory, not repository or app publication.

## Goal and evidence

Allow a clinician who already knows an order name to append several existing
catalog items without reopening the full catalog dialog for every item.

- User annotation: last-order / blank-table region, with the existing upper-right
  `+ Order` as the current entry point.
- Read-only production screen inspection: compact table, pinned leading columns,
  horizontal and vertical scrolling, category tabs and billing footer.
- Current source: `ChartOrderCatalogDialog`, `appendCatalogRowsToDraft`,
  `processCatalogSelection`, `applyCatalogSelection` in
  `src/features/chart/module.tsx`.
- The full dialog supports selection reconciliation, not merely appending.
  Never call its replacement/reconciliation path with only the new quick-add item.
- References checked on 2026-09-06: [Airtable record addition](https://support.airtable.com/articles/4087973664-adding-duplicating-and-deleting-airtable-records),
  [Airtable linked-record picker](https://support.airtable.com/articles/3370222027-linking-records-in-airtable),
  [Linear continuous creation](https://linear.app/docs/assigning-issues).
  These are pattern precedents, not usability evidence for this EMR.

## Scope

Feature-local Plan/Order interaction. No shared-table API change is proposed.
Preserve the existing 25 business columns, density, sorting, pinned columns,
selection, row editing, lifecycle, permissions and billing authority.

Initial delivery: one quick-add composer, all-catalog keyword search, keyboard
selection, continuous append, duplicate feedback, set configuration handoff,
loading/empty/error/denied states and append persistence feedback.

Excluded: favorites, recents, AI recommendations, clinical default inference,
new catalog creation, new global shortcuts, pricing rules, catalog taxonomy
changes, backend implementation and application deployment. Temporary prototype
sharing is separately authorized as recorded above.

## Layout contract

- With zero orders, hide the entire quick-add composer. Keep the existing empty-state
  `+ Order` button and open the same catalog dialog as the toolbar `+ Order`.
  Show quick-add only after the first order is added; hide it again if the last
  order is removed. Use total order count, not the count in the selected category.
- Idle: a 40px composer row immediately after the last visible order, aligned
  with the `분류` column. Visible label: `+ Order 추가`, without helper text.
  Left-align the category header and category values. This placement and copy
  supersede the initial proposal per 승욱’s review.
- Open: a 36px search input in the same composer, width measured from the `분류` column start to the right edge of the
  pinned `Order 명` column (332px in the reviewed prototype), capped by the available panel width.
  The idle button and result surface share this width. Recompute from actual
  header geometry on layout/scroll changes, rather than using a 460px cap. The composer is outside the horizontally scrolling
  column canvas; it never creates a new billable row.
- Long list: clamp the same composer below the scrollable order viewport and
  above the billing footer. Exactly one composer is visible. Reserve a band measured from the actual control
  and shared spacing tokens (the prototype used 54px); keep its height stable when opening
  so the input never covers visible data; the horizontal scrollbar remains in
  the data viewport above this band. Rejoin the final row when it is visible.
- During continuous entry, keep the composer anchor stable where practical.
  Scroll only the order viewport to reveal the newest appended row in default
  order. Never scroll the entire chart unexpectedly.
- Result heading: `검색 결과` with the count immediately beside it (6px gap),
  e.g. `검색 결과 3건`. Do not separate the count at the far right. Hide the count
  before a query and on lookup error; use `0건` for a successful empty result.
  Hide the entire heading on lookup error too. Before typing, show only
  `오더명 또는 청구명을 입력해 주세요.` above the detailed-search action.
  Omit example terms and a repeated instructional title.
  Fit feedback states to their natural content height without a result scrollbar;
  constrain and scroll only actual result options when they overflow.
- Results: floating surface aligned to the input, 6 visible candidates maximum
  (48px each); scroll for more. Prefer below, flip above if it provides more
  room. Clamp within the viewport. Do not push the billing footer or SOAP panels.
- Narrow workspace: retain the same category-column alignment; results fit the
  available width. Horizontal column scrolling stays independent.
- Visual sources: Pretendard Variable; current `emr-foundation.css` and
  `clair.css` surface/text/border aliases; 6–8px input radius; restrained selected
  state. Prototype snapshots these tokens; production must reference the tokens.

## Search and selection

1. With at least one order, click the quick-add row and focus the input immediately.
   The input placeholder is `오더명·청구명 검색`. Before a query, show
   `오더명 또는 청구명을 입력해 주세요.` without examples or a repeated heading.
   With zero orders, use the existing empty-state catalog button first.
2. Search all eligible workspace catalog categories regardless of the table tab.
   V1 matches order display name and billing name, case-insensitively. An alias
   matches only if present in the existing source; do not infer synonyms.
3. Rank exact display-name matches, then prefix, then substring; stable source
   order for ties. Show category, order name and price in a single line. Do not render any
   secondary description beneath names for any result. Missing price is `가격 확인 필요`, not zero. Set results say `구성 확인`.
4. Clicking a result or Enter on an active candidate appends an unconfirmed
   candidate through the existing draft path. No separate selection-complete
   step for an individual item.
5. Clear the query after acceptance; keep input focused. Announce saving, then
   saved only after server acknowledgment. Highlight the new row briefly.
6. Duplicate identity uses the existing catalog source key, including pending
   additions. Show `이미 추가됨` or `이미 확정됨`; do not silently add, increment,
   replace, remove or reorder existing candidates. Allow intentional changes
   through existing row actions.
7. Sets open existing configuration/preview before appending. Preserve entered
   search when cancelled; restore the composer focus. Do not invent set expansion
   or skip range/required-field choices.
8. The `상세 오더 검색` entry uses a trailing right chevron (not an arrow)
   and carries the query into the same existing `ChartOrderCatalogDialog` opened
   by the upper-right `+ Order` button. 승욱 explicitly confirmed this destination
   during prototype review; do not build a separate detailed-search dialog. Keep
   its existing multi-select/reconciliation semantics separate from quick append.
9. If the selected item is hidden by the active table category, preserve the
   user's category and show `다른 분류에 추가했어요 · 전체에서 보기`. Do not clear
   filters silently. Under sorting, use the existing sort; announce additions
   without claiming the new row is necessarily last.

## State matrix

| State | Visible feedback | Behavior |
| --- | --- | --- |
| Zero orders / first add | Existing empty-state and toolbar `+ Order` | Same catalog dialog; no quick-add composer |
| Last order removed | Existing empty state restored | Close search/popover and hide composer |
| Empty category, other orders exist | Category-empty guidance + quick-add | Visibility uses total order count |
| Idle, at least one order | Quiet add row | No blank persisted item |
| Open, empty query | Name/billing-name guidance | Input focused; no ranking claims |
| Loading catalog | `오더를 불러오는 중입니다` | No selectable stale results |
| Results | Category, name, price; no secondary description | Click / arrows / Enter |
| No match | `검색 결과가 없습니다` + full catalog | Preserve query; no create-new action |
| Lookup error | Error + retry | Retry query; do not label empty |
| Duplicate | `이미 추가됨` / `이미 확정됨` | Disabled for append |
| Appending | Candidate row + `저장 중` | Continuous input; deduplicate pending identities |
| Save failed | Candidate retained + `저장 실패` / `다시 저장` | No success message; retry same identity |
| Conflict | Existing conflict/reload flow | Never blindly overwrite or append again |
| Read-only / denied | Visible explanation, disabled add | Server checks remain authoritative |
| Hidden by category | Count + `전체에서 보기` | Explicit user navigation only |
| Set configuration | Existing preview dialog | Append only after apply |

## Keyboard and focus

- Named combobox, `aria-expanded`, `aria-controls`, `aria-activedescendant` and
  listbox options with disabled/selected state. Focus stays in the input.
- Arrow keys move through eligible results; Enter acts only on an active item.
  Never submit while Korean IME composition is active.
- The close control is an X icon button (28px target, 16px CDS icon), with
  the accessible name `빠른 검색 닫기`. Reuse CDS X and right-chevron assets.
- Escape closes the composer and returns to its trigger. Outside click or Tab
  departure closes the result surface without inserting an item. Completed
  additions remain. Search text may be retained for reopening within this chart.
- Do not steal focus back after a delayed save if the user has moved elsewhere.
  A chart/workspace change clears transient query/results and invalidates stale
  responses using the existing scope identity.
- Popover movement and row feedback respect reduced motion. Visible focus must
  remain usable without hover. Native dialog focus containment for configuration.

## Prototype boundary

[Open prototype](index.html). All rows, amounts, saves, failures and set choices
are synthetic in-memory fixtures. Refresh resets the session. No API, storage,
analytics, auth or remote write is connected.

Implemented demonstrations: empty/base/long lists; all/category tabs; keyboard
search; duplicate blocking; continuous append; simulated save failure and retry;
lookup failure and retry; read-only state; set configuration; full-catalog
handoff; confirmation before removing a synthetic draft; narrow panel toggle.

The 25-column visual projection is a shell, not a reimplementation of production
clinical editing/calculation. Sorting, actual server loading/conflict resolution,
cross-encounter responses, pricing authority and actual persistence remain
implementation acceptance tests. The catalog dialog in the prototype illustrates
query handoff and append selection, not the full existing reconciliation UI.

## Application validation

Test known individual orders A/B/C in sequence: one open, three explicit
selections, no repeated dialog confirmation; each addition retained exactly once.
Compare task time, extra pointer travel and correction count with the current
dialog using representative users; prototype timings are not proven UX gains.

Implementation preparation completed on 2026-09-07: reviewed geometry/flow,
reconciled the predecessor release and chose a clean scoped checkout. Reuse current
workspace catalog loader, draft queue, source identities, set configuration and
save authority. An optional query prop for the existing full dialog is a bounded
extension. Do not introduce a new shared abstraction without a second caller.

Required application acceptance: default and sorted/filtered views, empty/long
lists, horizontal scroll, Korean IME, keyboard/focus, duplicate/pending identity,
save retry/conflict, missing configuration, permission changes, chart switching,
set cancellation, and existing order/lifecycle/billing regressions.

## Prototype verification — 2026-09-06

- JavaScript syntax check passed.
- Twelve local artifact links and scoped diff whitespace checks passed. Full
  repository docs check reported two pre-existing links to a missing persona
  guide outside this change; see the work item for the exact source files.
- In-app browser at 1280×720: base and searching states visually reviewed;
  billing footer remains visible. 780px panel mode visually reviewed.
- Keyboard: CBC Enter, next keyword, ArrowDown and Enter appended two distinct
  rows (3 → 4 → 5), preserved all original rows, cleared the query and retained
  input focus. Duplicate and no-match states observed separately.
- Save failure: retained four rows, retry showed saving then saved, no duplicate.
  Lookup failure: retry retained CBC and restored three matching results.
- Long list: 18 rows; composer top and scroller bottom both measured 560px.
  Horizontal scroll reached 1072px and vertical scroll 583px; the pinned name
  columns and quick-add row stayed visible. Narrow panel reviewed visually.
- Initial set-flow check: configuration preview → apply produced one synthetic
  root with the chosen component count and returned focus to search. The revised
  zero-order entry point is the existing catalog button, not the quick composer.
- Full catalog: carried the keyword, selected two results and added both.
- Category: adding CBC under 진료 preserved three visible rows and four total,
  then explicit `전체에서 보기` revealed all four.
- Read-only: both entry points disabled with a visible explanation.
- No browser warning/error logs were observed during the tested flows.
- These checks cover the isolated prototype only. No production write or
  real-user usability test was performed; IME logic is code-reviewed, not a
  hardware Korean-input integration test.

## Review amendment acceptance — 2026-09-06

These criteria consolidate the browser review and supersede earlier prototype copy.

| Check | Expected result | Prototype evidence |
| --- | --- | --- |
| First add / last removal | Zero orders hides quick-add; existing empty-state `+ Order` opens the catalog; one order shows quick-add; removing the last hides it | Browser 0 → 1 → 0 passed |
| Category-empty table | Other categories still contain orders, so quick-add stays visible | Browser passed with three total orders |
| Alignment and width | Left-aligned `분류`; `+ Order 추가` without helper text; button/input/results span category start to pinned Order-name end | Prior geometry check: 332px, same right edge |
| Result heading | `검색 결과 3건`, 6px gap; no heading before typing or on lookup error | Prior browser review |
| Result content | Category, name and price only; no secondary description | Prior browser review |
| Empty query / overflow | `오더명 또는 청구명을 입력해 주세요.`; no examples; scroll only overflowing actual results | Prior browser check: empty content 68px, 14-result list capped at 288px |
| Controls | X with accessible name `빠른 검색 닫기`; `상세 오더 검색` with CDS right chevron | Prior browser review |
| Detailed search destination | Same `ChartOrderCatalogDialog` as toolbar and empty-state `+ Order`; preserve query | Prototype handoff checked; actual app reuse remains implementation acceptance |

Planning sync covers this spec, the prototype's `기획 보기`, the Korean review
report and CHART-PR-035. At that design checkpoint, application implementation
remained a separate phase; the 2026-09-07 authorization above supersedes that boundary.


## Application implementation — 2026-09-07

Implemented in the existing `OrderArea`, `ChartOrderTable`,
`ChartOrderCatalogDialog` and `ChartOrderSetConfigurationDialog` in
`src/features/chart/module.tsx`. Shared `Input`, `Button`, `Popover`,
`EmrPopoverShell`, `ClassificationExplorerOption`, feedback components and CDS
icons are composed without new component files, dependencies or shared APIs.

- Quick selection appends through `processCatalogSelection([candidate])`, with
  current/pending source-key guards; full-dialog selection reconciliation remains separate.
- Actual header geometry controls width. The composer stays outside the horizontal
  table canvas; its measured reserved band stays stable while open.
- Existing source defaults, invalid-input feedback, save queue, ETag and server
  acknowledgment remain authoritative. No missing quantity or clinical value is inferred.
- Detailed search transfers the query. Set cancellation/application returns to
  continuous entry; reset and scope changes invalidate late preview/apply responses.
- New-row feedback uses existing semantic surface tokens. Keyboard navigation
  scrolls the result list only; default-order reveal scrolls the table viewport only.

Synthetic browser verification and implementation limitations are recorded in
[CHART-PR-035](../../../../../work/chart/CHART-PR-035-plan-order-quick-add-design.md).
Production acceptance and representative-user UX validation remain pending.
