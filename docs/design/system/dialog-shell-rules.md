---
status: "active"
updated: "2026-05-22"
linear_issue: "DEN-205"
linear_project: "CLAiR EMR UI/UX Consistency & Affordance Hardening"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/qa/product-mvp-uiux-a-grade-acceptance-matrix.md"
---

# Dialog Shell Rules

`EmrDialogShell` is the shared EMR shell for product dialogs that need a
consistent header, body, footer, close affordance, action order, and width. It
builds on `src/components/ui/dialog.tsx` and keeps workflow state, form fields,
mutation logic, and product-specific copy at the feature call site.

Component path:

- `src/components/emr/dialog-shell.tsx`

Import:

```tsx
import { EmrDialogShell } from "@/components/emr/dialog-shell";
```

## Variants

| Variant | Width | Use for | Body behavior | Footer behavior |
|---|---:|---|---|---|
| `confirm` | `420px` | short confirmation, state-changing CTA, destructive-feeling session action | compact body, no internal scroll by default | secondary action before primary action |
| `form` | `520px` | compact create/edit forms and membership-like forms | max viewport height with scrollable body | sticky shell footer inside dialog grid |
| `wide-form` | `680px` | registration, profile, and multi-section forms | max viewport height with scrollable body | sticky shell footer inside dialog grid |

Do not create local dialog widths unless the workflow needs a documented
exception. Prefer variant selection before adding `className` overrides.

## Structure

Every EMR dialog should expose:

- visible or screen-reader title through `DialogTitle`
- optional description when the decision or form consequence is not obvious
- close icon with a Korean `aria-label`
- body content owned by the feature
- footer actions in the order `secondaryAction`, then `primaryAction`
- optional `footerMeta` for low-priority state, count, or mock/live boundary copy

## Action Order

Use this default order:

1. Dismiss/cancel/secondary action on the left side of the action group.
2. Confirm/save/primary action on the right side of the action group.
3. Destructive primary actions still stay on the right, but use the destructive
   button variant and explicit copy.

Do not reverse the order per screen unless there is a documented accessibility
or workflow reason.

## Compatibility Plan

`EmrConfirmDialogContent` remains valid for existing simple confirmations. New
confirm dialogs should use `EmrDialogShell` when the issue also needs the
variant contract, footer metadata, or a migration path toward form/wide-form
shells.

Recommended migration order:

1. Keep existing `EmrConfirmDialogContent` call sites stable until the
   screen-level issue is ready for visual QA.
2. Use `EmrDialogShell variant="confirm"` for new confirmation work.
3. Migrate chart completion and billing financial CTA dialogs during their
   scoped issues, with before/after screenshots.
4. Migrate reception/profile wide forms only inside their screen-level issues,
   preserving route state, test IDs, scroll containment, and keyboard behavior.

## Out Of Scope

DEN-205 does not migrate every dialog call site, change Base UI/shadcn
internals, alter server validation, or change mutation policy. It also does not
enter live Supabase, payment, email, provider, or production deployment scope.

## Verification

For foundation changes:

- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts --grep "shared EMR component source uses semantic color tokens"`

For screen adoption:

- run the focused Playwright spec for the touched workflow
- capture a desktop screenshot of the opened dialog
- check keyboard focus, close behavior, scroll containment, and text clipping
