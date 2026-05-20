---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-145"
linear_project: "09 시각 QA 및 인터랙션 품질 게이트"
source_docs:
  - "docs/design/qa/core-workspace-ui-review-checklist.md"
  - "docs/design/system/global-feedback-ui-audit.md"
  - "docs/design/system/ui-refactor-dod.md"
---

# Interaction Accessibility Audit

This audit records the current keyboard, focus, tooltip, and accessible-name baseline for the UI/UX refactor initiative.

## Covered Surfaces

- App Shell chrome: nav rail, workspace tabs, top icon controls, workspace switcher, profile menu.
- Global command palette: launcher, dialog title/description, search input, filter control, result rows.
- Shared EMR primitives: icon button, confirmation dialog, order queue side panel, side panel card, patient context bar.
- Auth/workspace surfaces touched by Project 07: login, profile settings, workspace onboarding, workspace membership management.
- Dense workflow modules sampled for existing interaction contracts: chart, reception, lab/imaging, dispensing, inpatient, customer, hospital admin.

## Current Baseline

- Icon-only buttons usually provide an `aria-label`; shared `EmrIconButton` also keeps visible focus treatment through `focus-visible:ring-3`.
- Nav rail items and workspace tabs pair tooltip text with explicit accessible labels. Tooltips are treated as visual help, not as the only accessible name.
- Workspace tabs expose a `role="tablist"` with tab buttons and separate close buttons, so tab selection and close actions remain distinct.
- Global command palette exposes a hidden dialog title/description, a labeled search input, a labeled filter segmented control, and a labeled result list container.
- Form validation on the auth/workspace screens now uses `FieldError`; broader permission/status messages remain alert-style notice panels.
- Simple confirmations use `EmrConfirmDialogContent`, which includes title, body, cancel, confirm, and close-label structure.
- Dense shared controls such as `SegmentedControl`, `LineTabs`, search inputs, selects, checkboxes, and table row actions generally carry explicit labels.
- The chart resize divider has keyboard handling in addition to pointer resizing.

## Intentional Contracts To Preserve

- Command palette result rows remain buttons in this pass. Changing them to strict listbox options would require a scoped interaction/test update.
- Tooltip content must not be the only source of meaning for icon buttons; the trigger still needs `aria-label` or visible text.
- Placeholder shell controls such as notification/help/settings are labeled but do not yet carry real product behavior. Treat them as visible placeholders, not completed workflows.
- Local workflow dialogs can remain feature-owned when they include domain-heavy state, tables, or multi-step copy.

## Gaps And Follow-Up Candidates

- `src/components/ui/sheet.tsx` and `src/components/ui/dialog.tsx` still use the English hidden close label `Close`. A follow-up should localize or parameterize this label before broader Korean accessibility acceptance.
- `src/features/auth/workspace-membership-management.tsx` has an existing React hook dependency warning. Keep this as a behavior-focused follow-up instead of mixing it into visual QA.
- Some feature-local popover/menu patterns still need screen-by-screen keyboard QA before release acceptance, especially in dense chart, reception, and hospital admin workflows.
- Global command palette should get a dedicated future issue if the product wants full combobox/listbox semantics, active descendant management, and keyboard result traversal beyond the current button-row contract.
- Placeholder top controls should eventually either receive real actions or a disabled/future-scope treatment with honest copy.

## Acceptance Guidance

- Accept this baseline when changed screens retain visible focus, explicit accessible names, dialog titles, and non-hover-only interaction paths.
- Block a UI issue when a new icon-only control has no label, a dialog/drawer has no title, form errors are visually present but not announced, or a hover-only action becomes unreachable by keyboard.
- Send broader semantic redesign, command-palette keyboard model changes, and shared primitive API changes to follow-up issues.
