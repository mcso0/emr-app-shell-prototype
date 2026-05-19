---
status: "active"
updated: "2026-05-20"
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
