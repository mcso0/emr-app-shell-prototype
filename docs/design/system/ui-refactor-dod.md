---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-142"
linear_project: "00 UI 시스템 인벤토리 및 리팩토링 기준"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/ui-debt-inventory.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/engineering/current-status.md"
---

# UI Refactor Definition Of Done

This checklist defines when a UI/UX refactor issue is ready for Human Review. It should be used by screen-level projects in the `[UI/UX] 화면 컴포넌트 오딧 및 리팩토링` initiative.

The goal is practical quality control, not a heavy visual-regression program for every issue.

## Minimum Done Criteria

Every UI refactor issue must satisfy these before Human Review:

- Scope stayed frontend-only: no DB, Supabase, RLS, live persistence, server enforcement, payment, email, deploy, external integration, or role/permission policy changes.
- Current product workflow and session-only mock behavior are preserved.
- Component placement follows `docs/design/system/component-ownership-rules.md`.
- Existing shadcn/ui and EMR primitives were considered before new shared components.
- Test IDs used by existing Playwright coverage were preserved unless the issue explicitly updates tests.
- Dialog, drawer, popover, table, tab, filter, icon button, and command UI changes keep accessible labels and visible focus states.
- Dense layouts were checked for text clipping, overlapping content, horizontal overflow, and scroll containment.
- The Linear comment or completion report explains what became shared, what stayed feature-local, and what remains follow-up.

## Verification Levels

Choose the narrowest level that matches the risk. Expand when the change touches shared components, shell behavior, or multiple screens.

| Level | Use when | Required verification |
|---|---|---|
| V0 Docs only | planning, audit, rules, closeout, or report changes | `npm run docs:check` |
| V1 Local UI split | feature-local component extraction with no behavior change | `npm run lint`, `npx tsc --noEmit`, focused screen Playwright when one exists |
| V2 Screen behavior risk | dialogs, drawers, tables, filters, keyboard/focus behavior, route query, layout state, or visible workflow action changes | V1 plus focused Playwright for the affected screen, and browser/screenshot QA at desktop width |
| V3 Shared component risk | `src/components/ui/*`, `src/components/emr/*`, `src/shell/*`, workspace tabs, nav rail, command palette, global drawer, or primitives used by multiple screens | V2 plus impacted screen tests and mobile/narrow viewport visual QA |
| V4 Broad visual/system risk | multiple screen families, design tokens, global layout, shell frame, or cross-screen QA gate | V3 plus broader Playwright subset and explicit follow-up risk list |

Do not run backend/live-data verification for this initiative unless a separate approved non-UI issue scopes it.

## Suggested Test Mapping

Use existing tests where possible:

- App shell, nav rail, workspace tabs, command palette: `tests/app-shell.spec.ts`
- Chart/SOAP/diagnosis/order UI: `tests/chart.spec.ts`
- Reception and profile drawer UI: `tests/reception.spec.ts`
- Lab/imaging UI: `tests/lab-imaging.spec.ts`
- Billing UI: `tests/billing.spec.ts`
- Home dashboard/work board UI: `tests/home.spec.ts`
- Hospital admin UI: `tests/hospital-admin.spec.ts`
- Customer management UI: `tests/customer.spec.ts`
- Inpatient UI: `tests/inpatient.spec.ts`
- Token or source-audit changes: `tests/design-tokens.spec.ts`, `tests/button-gallery.spec.ts`
- Sales demo preservation when navigation/demo context is touched: `tests/sales-demo-flow.spec.ts`

For docs-only work, do not run screen tests unless the docs changed test expectations.

## Accessibility Checklist

Apply relevant checks to touched UI:

- Dialogs and drawer-like overlays have a title; use `sr-only` if hidden visually.
- Icon-only buttons have clear `aria-label` text and visible focus.
- Tooltips do not replace required accessible names.
- Tabs and segmented controls expose the current value and are keyboard reachable.
- Popover and command/search result rows preserve keyboard selection and close behavior.
- Tables preserve header semantics, row/cell alignment, checkbox labels, action labels, and horizontal scroll where needed.
- Form fields preserve labels, required markers, `aria-invalid`, and error/help text relationships when practical.
- Loading, empty, and error states are reachable and understandable without color alone.
- Focus rings use the neutral ring direction from `DESIGN.md`; do not introduce brand-blue focus as the default.

## Responsive And Dense Workspace Checklist

Check relevant viewport and layout states:

- no incoherent text overlap or clipping in primary desktop viewport
- narrow/mobile-width viewport does not hide critical actions without an alternative
- dense tables keep headers aligned with body cells
- fixed table widths use an overflow wrapper instead of compressing cells into unreadable content
- side panels, right panels, and content asides preserve collapse/open behavior
- sticky footers do not cover form fields, table rows, or confirmation actions
- scroll containment keeps long central content, side panels, and drawers independently usable
- hover-only secondary actions also appear on focus or selected states when keyboard users need them

## Browser And Screenshot QA

Use browser/screenshot QA when the issue changes:

- layout structure
- table widths or row heights
- dialog, drawer, popover, or command palette composition
- shared EMR components
- shell/navigation/tabs
- text hierarchy or status badge/chip visuals

Minimum practical review:

- one desktop screenshot of the touched route
- one narrow/mobile-width check when responsive behavior could change
- one interaction state check for dialog/drawer/popover/table/selected row/focus behavior when relevant

Screenshots are not required for docs-only, copy-only, or test-only changes.

## Final Report Requirements

Korean summary for Seungwook:

- what changed and why it matters
- which screen or component families were affected
- what stayed out of scope
- verification result
- review request or decision needed

English technical notes for future agents:

- files changed
- component ownership decisions
- behavior preserved
- intentional local exceptions
- commands run
- follow-up risks or recommended next issue

## Copy/Paste DoD For Linear Issues

```md
UI refactor DoD:

- Keep the issue frontend-only; do not add DB, Supabase, RLS, live persistence, server enforcement, payment, email, deploy, or role/permission policy work.
- Preserve current workflow semantics, route/drawer/tab state, keyboard/focus behavior, test IDs, and session-only mock behavior.
- Follow `docs/design/system/component-ownership-rules.md` for shadcn/ui, EMR shared, feature-local, and inline UI placement.
- Verify accessible labels/titles for touched dialogs, drawers, popovers, icon buttons, tabs, filters, tables, empty/loading/error states, and command/navigation controls.
- Check dense responsive behavior: text clipping, table min-width/overflow, side panel collapse, scroll boundaries, and sticky footers.
- Run the narrowest useful verification: docs-only `npm run docs:check`; code changes `npm run lint` and `npx tsc --noEmit`; focused Playwright/browser QA when screen or shared UI behavior changes.
- Report in Korean for Seungwook and include concise English technical notes for future agents.
```

## Follow-Up Gap

Project `09` should turn these rules into a final cross-screen QA checklist after projects `01` through `08` complete. A full automated visual regression system remains out of scope for project `00`.
