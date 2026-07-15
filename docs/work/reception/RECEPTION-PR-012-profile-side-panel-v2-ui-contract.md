---
id: "RECEPTION-PR-012"
status: "done"
area: "reception"
priority: "P0"
target_pr: "Staff profile side panel V2 canonical and UI contracts"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/work/reception/RECEPTION-PR-010-profile-side-panel-v2-research.md"
dependencies:
  - "RECEPTION-PR-009"
updated: "2026-07-16"
---

# Staff Profile Side Panel V2 Canonical And UI Contracts

## Goal

Lock the approved V2 product/design contract and add independently testable UI
components before changing the live panel or persistence boundaries.

## Scope

- Preserve the approved analysis, research, and referenced visual assets.
- Update the canonical contract for 380px non-modal layout, exactly two tabs,
  status/avatar self-service states, availability, and assigned work.
- Add semantic profile aliases only where existing tokens cannot express the
  approved Figma contract.
- Add feature-local header, status, avatar, availability, and work-tab UI plus
  stable shared EMR work-timeline/card/badge roles only when ownership criteria
  are met.
- Add Storybook stories and interaction tests for all new components.

## Out Of Scope

- Reception panel integration, live API reads, DB schema, RLS, Storage,
  migrations, remote changes, or deployment.
- Runtime fixtures or fallbacks outside stories and tests.

## Done When

- Components cover loading, empty, error, disabled, optimistic, rollback,
  keyboard, and narrow-width states required by the canonical contract.
- Shared ownership is limited to roles proven useful beyond one profile screen;
  profile workflows stay feature-local.
- Storybook tests, focused source tests, lint, typecheck, build, and docs checks
  pass; desktop and narrow previews match approved Figma measurements.

## Verification

- Released in PR [#418](https://github.com/mcso0/emr-app-shell-prototype/pull/418)
  with merge commit `3e61f90e832f01b5ac7ccb21f3c473f0a6f1f8a2`.
- Figma source was rechecked for the panel, header/status/avatar variants, saved
  hover state, and upload dialog nodes listed in the canonical contract.
- Storybook Vitest: 15 passed across the header and content specimen files.
- Browser QA: desktop `380px` panel, `150px` header, `84px` avatar, exactly two
  tabs, `390px` full-width mobile, upload-dialog reset, work-card overflow-only
  navigation, and desktop 200% zoom passed.
- Local Storybook previews:
  - `?path=/story/features-staff-profile-side-panel-v2-content--full-panel-profile-specimen`
  - `?path=/story/features-staff-profile-side-panel-v2-header--avatar-upload-menu-and-reset`
  - `?path=/story/features-staff-profile-side-panel-v2-content--work-status-ready-and-navigation`
- Evidence:
  - `output/playwright/profile-side-panel-v2-full-desktop-story.png`
  - `output/playwright/profile-side-panel-v2-full-mobile-story.png`
  - `output/playwright/profile-side-panel-v2-full-desktop-200pct-story.png`
  - `output/playwright/profile-side-panel-v2-avatar-upload-story.png`
- `npm run lint`: pass.
- `npx tsc --noEmit --pretty false`: pass.
- `npm run build-storybook`: pass with existing font, Lottie eval, and chunk-size
  warnings.
- `npm run build`: pass with the existing docs-reader NFT trace warning.
- `npm run docs:check`: pass, 819 Markdown files checked.
- `npm run security:secrets`: pass, 3,159 tracked files checked.

## Component Ownership

- `PresenceBadge`, status/avatar controls, availability, assigned-work timeline,
  work card, badges, and navigation dialog remain feature-local because this PR
  proves only the staff-profile workflow.
- Existing Base UI/shadcn primitives own tabs, menus, dialogs, inputs, buttons,
  badges, and avatar structure.
- Existing `EmrQueueLoadingState`, `EmrEmptyState`, `EmrInlineAlert`, and
  `EmrRowActionMenu` own established loading, empty, error, and overflow patterns.
- The global Avatar primitive remains unchanged; the 84px contract is composed
  through a profile token and local wrapper.
