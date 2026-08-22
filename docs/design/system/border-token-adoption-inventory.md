---
status: "implemented"
area: "design-system"
doc_type: "audit"
title: "Border Token Adoption Inventory"
description: "Implemented inventory for the EMR neutral structural border hierarchy."
updated: "2026-08-22"
scan_commit: "6608d5ff"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/arbitrary-value-token-audit.md"
  - "docs/design/system/component-ownership-rules.md"
---

# Border Token Adoption Inventory

This inventory records the completed migration from legacy structural line
tokens to the EMR neutral border hierarchy. It is the current implementation
state, not a mechanical replacement backlog.

## Implemented structural scale

| Role | Token | Atomic value | Hex | Intended use |
| --- | --- | --- | --- | --- |
| Subtle | `--emr-border-subtle` | `neutral/100` | `#F5F5F5` | Small elements and low-emphasis internal separators |
| Default | `--emr-border-default` | `neutral/200` | `#E5E5E5` | Ordinary cards, rows, controls, tables, and panel-internal boundaries |
| Strong | `--emr-border-strong` | `neutral/300` | `#D4D4D4` | Layout-level boundaries, large panels, drawers, and workspace frames |

Default border thickness remains `1px`. The visual role determines the token;
the old token name or component name does not.

## Migration result

- The `6608d5ff` baseline contained 120 occurrences across 28 source files:
  116 consumer references and four legacy definitions.
- Runtime source now contains no `--emr-line-subtle`,
  `--emr-line-hairline`, `--emr-line-default`, or `--emr-line-strong` token.
- The four definitions and the unused `.emr-panel` / `.emr-hairline`
  compatibility utilities were removed.
- The hand-authored `src/styles/tokens/emr-foundation.css` layer maps global
  `--border` and `--input` to `--emr-border-default`. The dark override in
  `src/app/globals.css` uses the same semantic bridge.
- Generated `src/styles/tokens/clair.css` and
  `src/styles/tokens/shadcn.css` remain untouched.
- `InputOTP` and remaining structural direct neutral declarations were moved to
  the semantic hierarchy so they no longer bypass the product bridge.

## Role mapping

| Boundary role | Token | Examples |
| --- | --- | --- |
| Quiet micro boundary | `--emr-border-subtle` | metadata chip, timeline guide, small loading or empty-state outline |
| Ordinary component boundary | `--emr-border-default` | card, table row/header, input, dialog header/footer, panel-internal divider |
| Major structural boundary | `--emr-border-strong` | chart workspace panel, app frame, large drawer, command overlay |

## Semantic exceptions

The structural scale does not replace borders that communicate state or domain
meaning:

- selected and focus borders use `--emr-state-selected-border`,
  `--emr-line-selected`, `--emr-line-focus`, or `--ring`
- info, success, warning, danger, and neutral statuses use
  `--emr-status-*-border`
- drag, clinician, calendar, and brand accents keep their owning state or
  feature token

These exceptions may resolve to gray or chromatic values because they are not
generic structural borders.

## Enforcement

`tests/design-tokens.spec.ts` recursively scans runtime TypeScript and CSS and
fails when any removed structural `--emr-line-*` name returns. The same test
verifies the neutral `100/200/300` computed colors and the global
`--border`/`--input` mapping.

For follow-up work:

1. choose subtle, default, or strong by boundary role
2. use a state or status token when the line communicates meaning
3. do not edit generated Clair or shadcn token files
4. add focused rendered coverage when a shared component changes
