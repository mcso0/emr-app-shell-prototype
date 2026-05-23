---
status: "active"
updated: "2026-05-23"
linear_issue: "DEN-143"
linear_project: "00 UI 시스템 인벤토리 및 리팩토링 기준"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/design/system/ui-debt-inventory.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
---

# Arbitrary Value And Token Promotion Audit

This audit identifies repeated arbitrary Tailwind values and direct styling values that should either stay local, move into EMR tokens, or be absorbed into shared EMR components.

It is audit-only. Do not mechanically replace arbitrary values across the app from this document.

## Scan Method

Commands used:

- `rg -o "\b(?:min-w|w|h|max-w|max-h|grid-cols|grid-rows|basis|flex|text|leading|tracking|rounded|px|py|p|gap|mt|mb|ml|mr|top|left|right|bottom)-\[[^\]]+\]" src/features src/components/emr src/components/ui src/shell src/app -g '*.tsx'`
- `rg -o "#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\)|\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|clair-color-[A-Za-z0-9_-]+" src/features src/components/emr src/components/ui src/shell src/app -g '*.tsx' -g '*.ts'`
- Manual review of `src/styles/tokens/emr-foundation.css`, `src/styles/tokens/shadcn.css`, `src/app/manifest.ts`, `src/app/layout.tsx`, `src/shell/global-command-palette.tsx`, `src/components/emr/side-panel-card.tsx`, and `src/features/billing/module.tsx`.

## DEN-214 Latest Rescan Baseline

Updated on 2026-05-23 for Linear `DEN-214`.

Scope:

- `src/**/*.{ts,tsx}`
- arbitrary bracket utilities in spacing, typography, width/height, radius, and grid categories
- scan output is a cleanup baseline, not permission to mechanically rewrite every value

Latest counts:

| Metric | Count | Notes |
|---|---:|---|
| Scanned source files | 281 | `src` TypeScript and TSX only |
| All bracket utilities found | 3,052 | Includes colors, borders, effects, and other categories outside DEN-214 scope |
| In-scope spacing/font/width/radius/grid utilities | 1,637 | DEN-214 baseline for A+ token cleanup |
| Unique in-scope utilities | 300 | Candidate vocabulary size before cleanup |
| Files with in-scope utilities | 83 | Cleanup is cross-module, so implementation must stay PR-sized |
| Raw measure utilities | 1,091 | Highest-priority cleanup pool |
| Tokenized CSS-var utilities | 472 | Already token-backed, but still bracket syntax |
| Structural grid/expression utilities | 49 | Often valid local layout constraints |
| Layout `calc()` utilities | 23 | Usually drawer, viewport, or switch geometry constraints |

Category counts:

| Category | Count | First handling rule |
|---|---:|---|
| Typography | 1,123 | Start with dense text roles and EMR component variants |
| Size / width / height | 278 | Classify table columns, shell widths, dialog widths, and icon geometry separately |
| Radius | 158 | Prefer `--emr-radius-control`, `--emr-radius-panel`, or component variants |
| Grid | 54 | Keep table/calendar/grid recipes local unless repeated across screen families |
| Spacing / position | 24 | Low count; fix only when tied to repeated component rhythm |

Top raw repeated utilities:

| Utility | Count | Recommended owner |
|---|---:|---|
| `text-[12px]` | 316 | Dense typography role / EMR table-list text variants |
| `text-[13px]` | 215 | Dense body role / EMR component variants |
| `text-[11px]` | 75 | Micro metadata role, mostly local until roles are named |
| `text-[14px]` | 69 | Standard body/label role, prefer existing text classes |
| `text-[15px]` | 22 | Section or compact title role after typography pass |
| `text-[16px]` | 16 | Compact heading role after typography pass |
| `leading-[18px]` | 15 | Side-panel/list rhythm candidate |
| `tracking-[0.3px]` | 14 | Side-panel badge/meta rhythm candidate |
| `h-[18px]` | 13 | Side-panel badge/meta rhythm candidate |
| `text-[18px]` | 12 | Dialog/section title role candidate |

Top module concentrations:

| Module | In-scope count | Raw measure count | Recommended follow-up |
|---|---:|---:|---|
| `src/features/reception` | 264 | 174 | Split across DEN-218 and table/responsive follow-ups |
| `src/features/home` | 227 | 151 | Keep lower priority unless Project 11 scope needs dashboard representative evidence |
| `src/components/emr` | 215 | 99 | Best shared-component cleanup target for DEN-215 to DEN-217 |
| `src/features/auth` | 192 | 123 | Mostly outside Project 11 module adoption; defer unless shared component touched |
| `src/features/lab-imaging` | 144 | 125 | Candidate for DEN-220 |
| `src/features/chart` | 99 | 71 | Candidate for DEN-219 |
| `src/shell` | 96 | 62 | Treat as shell-local unless responsive blocker evidence appears |
| `src/features/hospital-admin` | 73 | 67 | Candidate for DEN-220 |
| `src/features/billing` | 48 | 42 | Candidate for DEN-220 |
| `src/features/inpatient` | 45 | 36 | Candidate for DEN-220 if table/density rules apply |

Recommended priority:

1. Use `DEN-215` to normalize text roles before module-specific cleanup.
2. Use `DEN-216` and `DEN-217` to move repeated control, side-panel, queue-card, table, and list rhythm into existing UI/EMR primitives where stable.
3. Use `DEN-218` to `DEN-220` for module-level adoption, starting only with high-confidence repeated patterns from the current module.
4. Keep structural table widths, calendar grids, viewport `calc()` values, command palette dimensions, and icon micro-geometry as documented local exceptions until a specific issue proves they should move.

DEN-215 foundation adoption note:

- Added shared EMR typography role variables and utility classes in `src/styles/tokens/emr-foundation.css` and `src/app/globals.css`.
- Adopted those roles first in high-confidence `src/components/emr/*` surfaces.
- In-scope arbitrary utility count moved from 1,637 to 1,568.
- Typography arbitrary utility count moved from 1,123 to 1,054.
- Raw measure count moved from 1,091 to 1,022.
- Remaining table, patient-context, and module-specific values should be handled by DEN-216 to DEN-220 or Project 12 table-density work, not by a broad text replacement pass.

DEN-216 control/form adoption note:

- Added shared control typography/radius and field gap utility classes in `src/app/globals.css`.
- Adopted those utilities in high-confidence `src/components/ui/*` primitives: `Button`, `Input`, `Select`, `Textarea`, `Field`, and `SegmentedControl`.
- In-scope arbitrary utility count moved from 1,568 to 1,551.
- Typography arbitrary utility count moved from 1,054 to 1,036.
- Raw measure count moved from 1,022 to 1,004.
- Remaining token-backed control height and width values should stay with component variants until a later issue proves a safer cross-screen contract.

DEN-217 panel/list/table density adoption note:

- Added shared panel/list/card/table density utility classes in `src/app/globals.css`.
- Adopted those utilities in `EmrSubpanel`, `EmrSidePanelCard`, `EmrSidePanelCollapsibleGroup`, `EmrContentHistoryList`, `EmrListItem`, and `EmrDataTable`.
- In-scope arbitrary utility count moved from 1,551 to 1,527 in the legacy bracket scan.
- Spacing-position bracket utility count is now 13 in `src`, so remaining spacing exceptions are mostly local layout or viewport constraints.
- Fixed table column widths and scroll behavior remain intentionally local until Project 12 defines the table density/scroll contract.

DEN-218 reception/customer adoption note:

- Adopted existing EMR typography role classes in high-confidence `src/features/reception/*` and `src/features/customer/module.tsx` surfaces.
- Direct `text-[11px]`, `text-[12px]`, `text-[13px]`, and `text-[14px]` values were removed from the touched reception/customer files.
- Remaining reception/customer bracket utilities are mostly token-backed colors, viewport/drawer heights, table min-widths, and calendar grid dimensions.
- The current targeted reception/customer bracket utility count is 139, with 88 typography-related entries still present because semantic token color classes and larger local display sizes are intentionally out of this pass.

DEN-219 chart/order adoption note:

- Adopted existing EMR typography role classes in high-confidence chart, SOAP editor, chart tab/title, and order table surfaces.
- Direct `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[14px]`, and generated body typography bracket utilities were removed from the touched chart/order files.
- The current targeted chart/order bracket utility count is 74, with table min-widths, column widths, editor min-height, semantic color utilities, and token-backed radii left as local exceptions.
- Order table width, horizontal scroll, and header affordance cleanup remain intentionally deferred to Project 12.

DEN-220 billing/lab-imaging/dispensing/admin adoption note:

- Adopted existing EMR typography role classes in billing, lab/imaging, dispensing, and hospital-admin candidate surfaces.
- Direct `text-[11px]`, `text-[12px]`, `text-[13px]`, and `text-[14px]` values were removed from the touched module files.
- Repeated lab/imaging metadata leading/tracking patterns were collapsed into `emr-text-dense-label`, `emr-text-metadata`, and `emr-text-section` where the role was clear.
- The current targeted bracket utility count across these modules is 103. Remaining values are mostly table width/min-width recipes, dense placeholder heights, semantic colors, and local title/display sizes.

## Top Repeated Arbitrary Values

| Value | Count | Purpose | Recommendation |
|---|---:|---|---|
| `text-[12px]` | 285 | dense metadata, helper copy, badges, table body, compact labels | promote as typography role guidance or component classes, not a global token replacement pass |
| `text-[13px]` | 194 | dense body text, side panel rows, table content, form helper rows | promote through EMR component classes and typography role docs |
| `text-[11px]` | 72 | micro metadata, calendar labels, small badges | keep local unless repeated inside one component family; avoid a broad token until role names are clear |
| `text-[14px]` | 60 | section text, side nav, table rows, labels | prefer existing text semantics or component classes |
| `rounded-[var(--clair-radius-md)]` | 44 | controls and cards using generated Clair radius | absorb into `--emr-radius-control` or existing Button/Card/Badge classes when touched |
| `rounded-[var(--clair-radius-atomic-8)]` | 22 | compact cards and chips | keep local until component family owns it; avoid exposing atomic Clair token in feature code long term |
| `h-[18px]`, `leading-[18px]`, `tracking-[0.3px]`, `tracking-[0.247px]` | 13-15 each | side-panel badges, meta rows, dense queue text | absorb into `EmrSidePanel*` components where repeated |
| fixed table widths such as `w-[88px]`, `w-[96px]`, `w-[116px]`, `grid-cols-[...]` | 2-4 each per value, many unique values | dense table readability and calendar layouts | keep local with overflow QA unless the same table recipe repeats |

## Promotion Candidates

| Priority | Candidate | Evidence | Recommended destination |
|---|---|---|---|
| P1 | Dense typography roles | `text-[12px]`, `text-[13px]`, `text-[11px]`, `text-[14px]` dominate the scan | document role names first; then absorb into EMR components and selected feature-local components |
| P1 | Side-panel meta/badge rhythm | repeated `h-[18px]`, `leading-[18px]`, `tracking-[0.247px]`, `tracking-[0.3px]`, radius atoms in side panel/card/summary components | `src/components/emr/side-panel-card.tsx`, `subpanel.tsx`, `order-queue-summary.tsx`, `order-queue-side-panel.tsx` component classes |
| P1 | Selected side-panel surface using direct Clair sky | `src/components/emr/side-panel-card.tsx` and `src/features/billing/module.tsx` still use `--clair-color-atomic-sky-50/200` for selected state | replace with EMR selected aliases or a documented info-selected variant when scoped |
| P2 | Compact dialog shell dimensions | repeated `sm:max-w-[420px]`, `max-w-[460px]`, `sm:max-w-[640px]`, `grid-rows-[auto_minmax(0,1fr)_auto]` | keep workflow dialogs local for now; consider EMR dialog shell after reception/profile/hospital-admin comparison |
| P2 | Command palette shadow and dimensions | `src/shell/global-command-palette.tsx` uses custom rgba shadow and fixed min/max width/height | project `08`; introduce shell overlay elevation alias or local shell constant |
| P2 | Table column recipes | billing, reception, home, hospital admin, and customer use local fixed widths | keep local until each table is audited; later document table recipes instead of tokenizing each column |
| P3 | Nav rail icon micro-sizes | `src/shell/module-nav-icons.tsx` stores precise icon width/height values | keep local shell exception unless project `08` standardizes icon normalization |

## Values To Keep Local

Keep these local unless a future issue proves repetition across a stable component family:

- dense table column widths
- calendar grid dimensions and event positioning
- command palette max height/width until project `08`
- drawer max heights tied to viewport and shell chrome
- GNB icon micro-adjustments
- chart/result visual dimensions tied to clinical display readability

These values often preserve dense-workspace readability. Removing them mechanically can create more UI regressions than it solves.

## Raw Color Findings

| Location | Value | Recommendation |
|---|---|---|
| `src/app/manifest.ts`, `src/app/layout.tsx` | `#18181B`, `#E9ECF2` | intentional PWA/browser metadata exception; leave as asset/metadata values |
| `src/shell/global-command-palette.tsx` | `rgba(0,0,0,...)` shadow stack | candidate for shell overlay/elevation alias or local shell constant in project `08` |
| `src/shell/global-command-palette.tsx` | `--clair-color-atomic-black-alpha-4` | candidate to replace with `--emr-state-hover`, `--emr-surface-muted`, or a shell command result token |
| `src/components/emr/side-panel-card.tsx` | `--clair-color-atomic-sky-50/200` | replace with EMR selected/info aliases when side-panel selected variants are scoped |
| `src/features/billing/module.tsx` | `--clair-color-atomic-sky-50/200` | replace with existing EMR selected/info aliases during billing UI audit |

Generated and bridge files:

- `src/styles/tokens/clair.css` is generated and must not be edited by hand.
- `src/styles/tokens/shadcn.css` is an auto-generated semantic bridge and should not be edited directly unless a scoped token task explicitly owns it.
- `src/styles/tokens/emr-foundation.css` owns hand-authored EMR aliases and is the right place for new EMR token candidates after approval.

## Token Direction

Do not add tokens for every repeated value. Promote only role-level concepts:

- typography roles: dense body, metadata, micro metadata, section title, page title
- surface roles: selected row/card, hover row/card, muted table header, floating overlay
- line roles: hairline, default, selected, focus
- radius roles: control, panel, compact badge/chip
- status roles: info, success, warning, danger, neutral
- elevation roles: flat panel, sticky footer, popover/dialog/command overlay

Avoid tokenizing:

- one-off widths
- individual table columns
- individual icon corrections
- clinical chart dimensions
- calendar event placement values

## Candidate List For Future Implementation

1. Define typography role classes or documentation for dense body, metadata, micro metadata, section title, and page title.
2. Update side-panel/card/badge EMR components to own repeated 18px badge rhythm and letter-spacing values.
3. Replace direct Clair sky selected surfaces in side panel card and billing list with EMR selected/info aliases.
4. Define command palette overlay elevation as either a shell-local constant or EMR elevation alias.
5. During each table refactor, document which column widths are intentional and keep them behind overflow wrappers.
6. Keep generated Clair token output, shadcn bridge, PWA manifest/theme metadata, generated assets, and test expected values out of mechanical cleanup.

## Decision Points

No immediate Seungwook approval is required for this audit. A future implementation issue should ask for approval before introducing new token names beyond the current `--emr-*` alias layer.
