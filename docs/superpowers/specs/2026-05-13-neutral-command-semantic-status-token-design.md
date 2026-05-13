---
status: "draft-approved"
area: "design-system"
updated: "2026-05-13"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/engineering/current-status.md"
  - "src/styles/tokens/shadcn.css"
  - "src/app/globals.css"
---

# Neutral Command + Semantic Status Token Direction

## Summary

CLAiR EMR should use ink and gray as the default operating language, while reserving stronger colors for clinical and workflow meaning.

The core token decision is:

```text
primary = command ink
brand = limited identity blue
blue = info/status/link, not the default action color
```

This keeps command actions visually decisive without making blue compete with the many workflow, medical, billing, and status colors in the product.

## Design Principle

```text
CLAiR uses ink for commands, gray for structure, and color for clinical/workflow meaning.
```

Primary actions such as chart completion, order confirmation, save, and finalize should read as high-confidence commands. They should not use the same blue family that may also represent progress, information, links, or status.

## Layer Model

CLAiR should keep three color-token layers:

| Layer | Purpose |
|---|---|
| shadcn base tokens | Generic component semantics for Button, Input, Dialog, Card, Popover, Select, Checkbox, Switch, and similar primitives. |
| EMR operational tokens | Dense workflow surfaces, table/list behavior, panel structure, selected work targets, text hierarchy, and interaction states. |
| EMR status tokens | Clinical, workflow, billing, warning, error, progress, completion, and neutral status signals. |

This preserves shadcn compatibility while giving the EMR product enough vocabulary for high-density screens.

## Shadcn Base Token Roles

| Token | Role | Direction |
|---|---|---|
| `--background` | Root/app fallback background. | White or near-white. App shell may prefer `--emr-surface-app`. |
| `--foreground` | Default foreground fallback. | Ink/near-black. |
| `--card` | Generic card and simple panel surface. | White. |
| `--card-foreground` | Text on cards. | Ink. |
| `--popover` | Floating menus, popovers, dropdowns, command surfaces. | White. |
| `--popover-foreground` | Text on floating surfaces. | Ink. |
| `--primary` | Strong command action. | Ink/near-black, not brand blue. |
| `--primary-foreground` | Text/icons on primary. | White. |
| `--secondary` | Lower-emphasis filled action. | Very light gray or cool gray. |
| `--secondary-foreground` | Text/icons on secondary. | Ink. |
| `--muted` | Low-emphasis generic surface. | Very light gray or cool gray. |
| `--muted-foreground` | Descriptions, meta text, helper text. | Mid gray. |
| `--accent` | Generic hover, active, and menu highlight surface. | Light neutral/cool gray. |
| `--accent-foreground` | Text/icons on accent. | Ink. |
| `--destructive` | Destructive/error action. | Red. |
| `--border` | Default border and separator. | Light gray. |
| `--input` | Form-control border/surface reference. | Light gray. |
| `--ring` | Focus ring. | Neutral gray, not brand blue. |
| `--brand` | Product identity blue. | Limited logo and rare identity moments. |
| `--selection` | Generic selection fallback. | Subtle neutral or cool tint. EMR work-target selection should use EMR state tokens. |

## EMR Operational Tokens

### Surface

| Token | Role | Examples |
|---|---|---|
| `--emr-surface-app` | Overall operational canvas. | App shell background. |
| `--emr-surface-panel` | Primary work panel. | Chart panel, queue panel, right panel, table body. |
| `--emr-surface-subpanel` | Nested surface inside a panel. | SOAP sections, summary blocks, grouped details. |
| `--emr-surface-muted` | Low-emphasis strip/header surface. | Table header, section header, footer, nested strip. |
| `--emr-surface-hover` | Hover surface. | Queue row hover, table row hover, card hover. |
| `--emr-surface-selected` | Current work target. | Selected encounter, order, patient, queue card. |
| `--emr-surface-disabled` | Disabled surface. | Disabled controls or inactive panels. |
| `--emr-surface-floating` | Floating work surface. | Inline toolbar, editor popover, compact command panel. |

Selected surfaces should stay quiet. Avoid strong blue fills for selected work targets; use subtle fill plus border or leading accent.

### Line

| Token | Role | Examples |
|---|---|---|
| `--emr-line-subtle` | Very quiet internal divider. | Micro dividers inside dense panels. |
| `--emr-line-hairline` | Default operational hairline. | Table rows, card borders, panel dividers. |
| `--emr-line-default` | Standard component border. | Input wrappers, repeated item borders. |
| `--emr-line-strong` | Strong structural separation. | Workspace split, side panel boundary, resize handle. |
| `--emr-line-selected` | Selected work-target border. | Selected card or row border. |
| `--emr-line-focus` | Focus border support. | Input focus border when ring alone is insufficient. |

### Text

| Token | Role | Examples |
|---|---|---|
| `--emr-text-primary` | Highest-emphasis content. | Patient name, order name, amount, key panel title. |
| `--emr-text-secondary` | Normal operational content. | SOAP text, table row content, form values. |
| `--emr-text-tertiary` | Meta and supporting information. | Time, assignee, secondary labels, captions. |
| `--emr-text-placeholder` | Placeholder and empty input prompt. | Search/input placeholders. |
| `--emr-text-disabled` | Disabled text. | Disabled button/input text. |
| `--emr-text-inverse` | Text on dark command surfaces. | Primary button text. |
| `--emr-text-link` | Navigational link text. | Chart number, detail links. |
| `--emr-text-danger` | Error or danger text. | Validation, delete warning, risk copy. |

### Interaction

| Token | Role | Examples |
|---|---|---|
| `--emr-state-hover` | Passing interest. | Row/card hover. |
| `--emr-state-active` | Pressed or active state. | Active controls and pressed buttons. |
| `--emr-state-selected` | Current work target. | Selected queue card, selected table row. |
| `--emr-state-selected-border` | Selected work-target border/accent. | Selected card border or leading rail. |
| `--emr-state-focus-ring` | Keyboard focus ring. | Focus-visible ring, aligned with neutral `--ring`. |
| `--emr-state-drag` | Drag/resize affordance. | Grab divider, column resize handle. |
| `--emr-state-dirty` | Unsaved modification state. | Edited order row, unsaved field. |

Interaction meanings must stay distinct:

```text
hover = interest
active = press
selected = current work target
focus = keyboard/accessibility location
dirty = unsaved change
status = workflow/clinical state
```

## EMR Status Tokens

Status colors should be semantically explicit and separate from command and brand color.

| Group | Meaning | Direction |
|---|---|---|
| `--emr-status-info-*` | Information, progress, guidance. | Blue. |
| `--emr-status-success-*` | Completed, normal, paid, successful. | Green. |
| `--emr-status-warning-*` | Caution, delay, retry, attention needed. | Amber/orange. |
| `--emr-status-danger-*` | Danger, error, destructive, clinical risk. | Red. |
| `--emr-status-neutral-*` | Waiting, inactive, generic status. | Gray. |
| `--emr-status-accent-*` | Rare product accent. | Limited cool tint; not a default status family. |

Each status group should expose at least:

```text
-bg
-border
-text
```

Example:

```text
--emr-status-info-bg
--emr-status-info-border
--emr-status-info-text
```

## Value Direction

Use the shadcn Nova/Zinc style values as a base reference for generic UI tokens.

```css
--background: oklch(1 0 0);
--foreground: oklch(0.141 0.005 285.823);

--card: oklch(1 0 0);
--card-foreground: oklch(0.141 0.005 285.823);

--popover: oklch(1 0 0);
--popover-foreground: oklch(0.141 0.005 285.823);

--primary: oklch(0.21 0.006 285.885);
--primary-foreground: oklch(0.985 0 0);

--secondary: oklch(0.967 0.001 286.375);
--secondary-foreground: oklch(0.21 0.006 285.885);

--muted: oklch(0.967 0.001 286.375);
--muted-foreground: oklch(0.552 0.016 285.938);

--accent: oklch(0.967 0.001 286.375);
--accent-foreground: oklch(0.21 0.006 285.885);

--border: oklch(0.92 0.004 286.32);
--input: oklch(0.92 0.004 286.32);
--ring: oklch(0.705 0.015 286.067);
```

Candidate EMR operational values:

```css
--emr-surface-app: #FBFCFD;
--emr-surface-panel: oklch(1 0 0);
--emr-surface-subpanel: oklch(0.985 0.001 286);
--emr-surface-muted: oklch(0.967 0.001 286.375);
--emr-surface-hover: oklch(0.977 0.001 286.3);
--emr-surface-selected: oklch(0.97 0.006 286);
--emr-surface-disabled: oklch(0.955 0.001 286);
--emr-surface-floating: oklch(1 0 0);

--emr-line-subtle: oklch(0.945 0.003 286);
--emr-line-hairline: oklch(0.92 0.004 286.32);
--emr-line-default: oklch(0.885 0.006 286);
--emr-line-strong: oklch(0.78 0.012 286);
--emr-line-selected: oklch(0.58 0.014 286);
--emr-line-focus: var(--ring);

--emr-text-primary: oklch(0.141 0.005 285.823);
--emr-text-secondary: oklch(0.32 0.01 286);
--emr-text-tertiary: oklch(0.552 0.016 285.938);
--emr-text-placeholder: oklch(0.64 0.014 286);
--emr-text-disabled: oklch(0.72 0.01 286);
--emr-text-inverse: oklch(0.985 0 0);
--emr-text-link: oklch(0.52 0.13 240);
--emr-text-danger: oklch(0.577 0.245 27.325);

--emr-state-hover: var(--emr-surface-hover);
--emr-state-active: oklch(0.94 0.004 286);
--emr-state-selected: var(--emr-surface-selected);
--emr-state-selected-border: var(--emr-line-selected);
--emr-state-focus-ring: var(--ring);
--emr-state-drag: oklch(0.78 0.012 286);
--emr-state-dirty: oklch(0.97 0.035 85);
```

Status groups can wrap existing Clair atomic/status colors:

```text
info: blue-50 / blue-200 / blue-700
success: green-50 / green-200 / green-700
warning: orange-50 / orange-200 / orange-700
danger: red-50 / red-200 / red-700
neutral: gray-50 / gray-200 / gray-700
```

## Usage Rules

| Situation | Preferred tokens |
|---|---|
| Primary command button | `--primary`, `--primary-foreground` |
| Secondary button | `--secondary`, `--secondary-foreground` |
| Generic hover | `--accent` or `--emr-state-hover` |
| Focus ring | `--ring` or `--emr-state-focus-ring` |
| Generic card/dialog/popover | shadcn `card`, `popover`, `border`, `ring` |
| EMR work panel | `--emr-surface-panel`, `--emr-line-hairline` |
| Table header | `--emr-surface-muted` |
| Table/card/list hover | `--emr-state-hover` |
| Selected row/card | `--emr-state-selected`, `--emr-state-selected-border` |
| Status badge | `--emr-status-*` |
| Brand identity | `--brand`, used sparingly |
| Link/info text | `--emr-text-link` or `--emr-status-info-text` depending on meaning |

## Implementation Guidance

This spec does not request implementation. When implementation is approved, the safest sequence is:

1. Clarify active token source ownership between `src/styles/tokens/shadcn.css`, `src/styles/tokens/emr-foundation.css`, and `src/app/globals.css`.
2. Keep generated `src/styles/tokens/clair.css` untouched.
3. Align shadcn base tokens first.
4. Expand EMR operational aliases.
5. Apply aliases to shared primitives before feature screens.
6. Validate on the treatment/chart screen and one table-heavy screen before broad rollout.

## Non-Goals

- Do not make `--primary` brand blue.
- Do not use blue as the default button color.
- Do not collapse all workflow and clinical states into one accent color.
- Do not introduce dark mode as part of this token direction.
- Do not redesign every feature screen in one pass.
- Do not edit generated Clair token output directly.
- Do not claim live persistence, permission enforcement, billing behavior, or server validation from visual token work.

