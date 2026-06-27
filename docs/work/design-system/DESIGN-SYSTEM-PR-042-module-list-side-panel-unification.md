---
id: DESIGN-SYSTEM-PR-042
status: human_review
area: design-system
priority: P0
target_pr: User request / module list side panel
created: 2026-06-02
---

# DESIGN-SYSTEM-PR-042: Module List Side Panel Unification

## Goal

Unify the customer-management and hospital-admin module side panels as shared child-list navigation panels, using the hospital-admin panel as the reference UI.

## Scope

- Add a shared EMR module-list side-panel component for non-queue module navigation.
- Move customer management and hospital admin side-panel rendering onto the shared component.
- Keep hospital-admin order category selection, counts, disabled items, and follow-up badges working.
- Update customer management so implemented leaf pages show counts and future areas render as top-level disabled follow-up items.
- Use existing Obra icon wrappers instead of adding a new icon dependency.

## Out Of Scope

- Live DB/API persistence, Supabase, RLS, server enforcement, or role/permission changes.
- New customer-management schedule, message, document, CS, or referral workflows.
- Route changes or changes to the existing session-only table/drawer behavior.
- Broad redesign of queue side panels such as treatment, lab, imaging, dispensing, or billing.

## Acceptance Criteria

- Customer management and hospital admin both render through the shared module-list side-panel component.
- Customer management no longer exposes disabled placeholder child accordions for future areas.
- Future customer-management areas render as disabled top-level items with a `후속` badge.
- The selected leaf remains clear, and hospital-admin keeps one selected order-management leaf.
- Side-panel icons are meaningful and not repeated as generic file icons within the same navigation set.

## Verification

- Passed: `npx tsc --noEmit`
- Passed with 4 pre-existing warnings: `npm run lint -- --ignore-pattern '.worktrees/**'`
- Passed: `npm run docs:check`
- Browser QA passed on local `http://127.0.0.1:3109/w/clair-demo/customer?modulePanel=open` and `/w/clair-demo/orders?modulePanel=open`: customer future items render as disabled `후속` top-level items, placeholder children are absent, and hospital-admin order groups/counts remain visible.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/customer.spec.ts tests/hospital-admin.spec.ts tests/app-shell.spec.ts --project=chromium`

## Result

- Added `EmrModuleListSidePanel` and shared module-list side-panel badge rendering.
- Migrated customer management and hospital admin side panels to the shared module-list component.
- Replaced repeated generic side-panel icons with existing Obra icon wrappers.
- Updated customer side-panel tests for count badges and top-level disabled follow-up items.

## 2026-06-27 Follow-Up

- Aligned the expanded child rail in `EmrModuleListSidePanel` to the parent section icon center using EMR token aliases.
- Kept leaf row height at 32px, preserved the panel-level 16px right inset, and kept non-action placeholder leaves absent.
- Added browser DOM measurement coverage to the hospital-admin side-panel regression for icon/rail alignment, child content offset, leaf height, and right inset.
