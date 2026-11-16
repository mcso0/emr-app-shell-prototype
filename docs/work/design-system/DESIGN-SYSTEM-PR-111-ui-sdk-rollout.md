---
id: DESIGN-SYSTEM-PR-111
status: in_progress
area: design-system
priority: P1
target_pr: User-approved broad local UI SDK adoption; no merge or deployment
created: 2026-11-16
source_docs:
  - docs/design/system/DESIGN.md
  - docs/engineering/current-status.md
dependencies: []
---

# UI SDK Behavior Adoption

## Goal And Boundaries

Adopt UI SDK where it removes repeated behavior or adds useful accessible
interaction in actual screens. Preserve CLAiR design, domain state, data reads,
validation, permissions, server enforcement, existing workflows and static UI.
This is not a wholesale library replacement or a claim that every control now
uses UI SDK.

Work starts in an isolated worktree at `c9754c4`. The primary checkout's WIP is
untouched. Local implementation, synthetic fixtures and verification are in
scope. Remote data/migrations, provider calls, merge, deploy and release
configuration changes are excluded. Reconcile the latest main before handing
off the candidate; upstream progressed to `ca3222a8` during implementation.

## Foundation And Sources

- Exact npm `latest` versions: `@ui-sdk/react` and `@ui-sdk/core`
  `0.1.0-beta.3`. The separate `beta` tag is not silently adopted.
- React 19 is already installed. No default UI SDK theme or global provider is
  added. Only the documented `ui-sdk` cascade layer precedes existing CSS.
- Read the version-matched `node_modules/@ui-sdk/react/docs/llms.txt`, relevant
  component docs, `core.md` headings and `rendering.md` before extending these
  adapters. The package remains beta, so future upgrades require focused checks.
- Official sources: [installation](https://ui-sdk.dev/docs/react/installation),
  [composition](https://ui-sdk.dev/docs/react/parts-and-composition),
  [popups](https://ui-sdk.dev/docs/react/popups),
  [combobox](https://ui-sdk.dev/docs/react/components/combobox),
  [autocomplete](https://ui-sdk.dev/docs/react/components/autocomplete),
  [toggle](https://ui-sdk.dev/docs/react/components/toggle),
  [tabs](https://ui-sdk.dev/docs/react/components/tabs),
  [calendar](https://ui-sdk.dev/docs/react/components/calendar), and
  [listbox](https://ui-sdk.dev/docs/react/components/listbox).

## Implemented Families

| Family | Actual adoption | Ownership preserved |
| --- | --- | --- |
| Combobox | Shared CLAiR input/content/item adapters; four walk-in/reservation drawer/side-panel variants; existing-guardian registration | SDK alone owns list focus, active descendant, selection interaction, placement and dismissal. Features retain lookup/debounce/stale-request handling, selected IDs, vitals, dirty state, validation and workspace permissions. |
| Autocomplete | Shared free-text adapter and the reused breed field in patient forms | Arbitrary typed breeds remain valid. Do not coerce free text into a selected catalog ID. |
| Toggle groups | Shared LineTabs and SegmentedControl, including instruction filters, table/display-mode controls and calendar view controls | Preserve `group`, button `aria-pressed`, single non-deselectable selection, native disabled buttons and existing tokens/geometry. SDK adds grouped keyboard navigation. |
| True tabs | Chart SOAP overflow tab group | SDK owns roving focus and activation. Existing overflow measurement, More menu and one shared SOAP editor panel remain. |
| Calendar | Reception side-panel mini calendar | ISO dates, caller-owned operating date, today/selected/range colors, return action and 42-cell/27px geometry remain. SDK owns month/date keyboard navigation and proper grid/gridcell semantics. |
| Listbox | Shared classification single-choice facets, diagnosis systems/disease groups and order catalog categories | SDK owns selection, typeahead and roving focus. Catalog reads/search, draft order/diagnosis selection, locking, reorder and TanStack result virtualization remain feature-owned. |
| Mixed overlay integration | SDK suggestions inside existing Base Dialog and retained module/page boundaries | No Base popup or input behavior wraps an SDK suggestion. SDK controllers close suggestions when their cached panel/page hides; content preserves owner metadata and page visibility. |

Same-value activation remains part of the adapters' callback contract. SDK value
change callbacks alone do not fire for reselecting an active facet/filter. The
wrappers preserve pointer and keyboard reactivation used to reset child filters,
clear catalog search or reopen collapsed history groups, with callback-count
regressions to prevent duplicate notifications.

Existing hooks are deliberately not replaced with SDK async loaders: their
workspace/authentication, cancellation, debounce, error and selected-record
contracts are already implemented and tested. SDK receives their results with
client filtering disabled.

## Family Evaluation And Retained Owners

| Families considered | Decision for this candidate |
| --- | --- |
| Dialog, alert dialog, popover, drawer/sheet, menu, tooltip | Retain working Base shared primitives. They implement page visibility, cached-panel actions, focus return and permission workflows. Verify mixed SDK nesting rather than create a competing global overlay system. |
| Select, checkbox, radio, switch, basic toggle and profile tabs | Retain working Base adapters. Their state/validation contracts are already centralized; replacement has no demonstrated efficiency gain. Profile tabs also intentionally skip disabled tabs, unlike SDK Tabs' discoverable-disabled policy. |
| Field, label, input, textarea, number/password/OTP/time/date input | Retain existing native/Base validation and form contracts. Add SDK behavior only to actual suggestion fields. Do not move domain validation or timezone/min-date rules into a new form layer. |
| Other date pickers and full scheduling views | Keep existing specialized date/range/business-hours behavior. Mini-calendar adoption is verified separately; it does not authorize replacing appointment/calendar interaction models wholesale. |
| Command and SOAP editor menus/toolbar | Retain cmdk and BlockNote-owned behavior. Editor selection/IME, command execution and layered focus are tightly coupled; do not attach a second navigation engine. |
| Table/data grid, pagination, sorting/filter engine and virtualization | Retain TanStack Table/Virtual and server query contracts. Shared segmented/line controls adopt SDK without replacing table state or static table markup. |
| Scroll area and resizable split panels | Retain tested Base ScrollArea and react-resizable-panels/custom chart persistence contracts. No evidence justifies swapping their functioning integrations. |
| Drag/reorder, attachments, image/PDF zoom, editor | Retain dnd-kit, existing attachment/provider boundaries, PDF/zoom and BlockNote implementations. SDK is not a reason to rewrite specialized behavior. |
| Toast, progress/loading, avatar, badge, separator, card, static typography/layout | Retain Sonner and existing primitives/tokens. No speculative SDK wrappers for static or already-efficient elements. |
| Tree, waterfall, carousel, color picker, rating, navigation menu and other catalog families | No corresponding repeated active requirement identified for this candidate. Do not introduce unused component families or new product behavior. |

## Verification And Remaining Work

Required: focused interaction stories, actual synthetic reception/chart flows,
changed-file lint, full typecheck, production build, visual geometry review,
doc links, clean diff and latest-main reconciliation. Do not mark full rollout
complete merely because the first adapters compile.

Observed so far:

- Focused shared/feature stories cover keyboard selection, disabled options,
  native disabled filters, query retention/clear, loading/error, page-hidden
  closure, mixed existing dialogs, SOAP overflow, calendar date/month/return
  and diagnosis filtering/reorder/read-only behavior.
- Synthetic actual-screen reception walk-in/reservation creation and all three
  lookup-state flows passed, as did existing-guardian registration and retry.
- Actual SOAP overflow keyboard test and catalog loading/skeleton test passed.
- An unchanged-baseline test expects redundant display-label lookup requests
  (`>=2`) but receives `1`; reproduced at the original module and left outside
  implementation scope.
- One older chart catalog add test depends on an unstubbed catalog and reaches
  permission denial in this isolated environment. Synthetic catalog-specific
  tests are used instead; do not weaken authorization or add live credentials.
- Mac local test startup requires polling to avoid watcher exhaustion and
  browser process permission outside the restricted shell sandbox. The
  original Storybook remains untouched; rollout preview runs locally on 6007.

- Baseline calendar and test files reproduce the existing reception header
  lookup failure for `26.05.08 (금) 표시 중`. The current header has a different
  accessible label. Its behavior is not changed to satisfy obsolete selectors.
  The new actual-calendar regression instead verifies ISO route changes,
  calendar/queue reads, return action, 42 cells, 27px cells and keyboard selection.
- The related 108-row catalog test now disambiguates header vs quick-add triggers
  and checks the unchanged, source-backed 8px result inset rather than expecting
  zero. No result CSS changed.

Current local evidence: 30 focused stories across eight files passed, plus the
actual chart catalog keyboard story; the final six relevant stories also pass
with Safari 229 guards. Full lint and full typecheck passed. The production
bundle compiled and built successfully (existing PRD filesystem-tracing warning
retained). Actual synthetic catalog loading and 108-row search/virtualization
checks passed, as did the new calendar route/keyboard/geometry check. Visual
inspection of synthetic calendar and lookup previews preserves CLAiR geometry.

Latest-main reconciliation and final post-rebase checks remain before handoff.
The exact local candidate SHA will be reported in the handoff.
No remote delivery or human acceptance is claimed.
