---
id: "RECEPTION-PR-015"
status: "done"
area: "reception"
priority: "P1"
target_pr: "Staff profile side-panel Figma alignment"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/work/reception/RECEPTION-PR-012-profile-side-panel-v2-ui-contract.md"
  - "docs/work/reception/RECEPTION-PR-013-profile-side-panel-v2-read-model.md"
dependencies:
  - "RECEPTION-PR-013"
updated: "2026-07-18"
---

# Staff Profile Side-Panel Figma Alignment

## Goal

Align the rendered staff operational-profile panel with the approved Figma
header, account-information, and today-shift anatomy without changing the
verified read, authorization, avatar, or workspace status-message boundaries.

## Scope

- Rebuild the 150px header composition around the existing 84px avatar, 16px
  inset, 10px avatar-to-content gap, 20/28 name, bordered Presence pill, and
  14/20 last-seen row.
- Change account information to the Figma unboxed definition list: 8px section
  inset, three equal columns, 24px rows, and 12px row gaps.
- Keep email and phone copy controls in their reserved 24px position while
  hiding them until value hover or keyboard focus.
- Recompose the published-shift card as the 330px-by-72px icon/content/action
  layout. Expose `일정 확인` only when the existing server-derived schedule
  destination is available.
- Replace the prior two-tab header with the approved three-tab Figma geometry:
  `프로필` (53px), `업무현황` (65px), and `일정` (41px), separated by 8px.
- Add the `일정` panel without a new read/API: it may only offer the existing
  server-derived `scheduleHref` destination when that capability is present.
- Align the availability section's 8px internal inset with the today-shift
  section.

## Out Of Scope

- Any change to `StatusMessageEditor`, its copy, save behavior, API, database,
  RLS, or self-only permission boundary.
- A new schedule read model, schedule data expansion, private schedule notes,
  or permission changes.
- Avatar persistence, panel-shell routing, focus-return behavior, and remote
  data changes.

## Done When

- The Figma-aligned header, account list, copy-control interaction, shift card,
  three-tab geometry, and aligned availability section render in the live panel.
- Copy actions remain keyboard reachable and their toast behavior is preserved.
- Focused lint, TypeScript, browser, Storybook, docs, and build checks pass.

## Implemented Result

- Header layout now uses the 84px profile row grid and Figma typography while
  preserving the existing permitted header actions. Presence reads `온라인` for
  the authoritative online state and retains explicit offline/unknown states.
- Account rows no longer use the extra card shell. Values remain truncated
  safely, and email/phone copy icons transition in only from the value area
  hover or focus path.
- The shift card uses a 48px calendar area, 16/24 time, 14/20 state line, and
  a 66px schedule action only for an existing authorized destination.
- `StatusMessageEditor` and its persistence path were deliberately not edited.
- The earlier two-tab limitation is superseded by the approved 3-tab Figma
  header. `일정` is a safe navigation panel only; it does not fetch or invent
  schedule data.

## Verification

- `npm run lint -- src/features/staff/staff-operational-profile-drawer.tsx src/features/staff/components/profile-side-panel-v2-header.tsx src/features/staff/profile-side-panel-v2-content.stories.tsx src/features/staff/profile-side-panel-v2-header.stories.tsx tests/reception-staff-operational-profile.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npx playwright test tests/reception-staff-operational-profile.spec.ts --workers=1 --reporter=line` (10 passed)
- Storybook visual review of `Full Panel Profile Specimen` at the 380px panel width.

## Durable Closeout

- [Staff profile side-panel Figma alignment report](../../completed/reception/2026-07-18-staff-profile-figma-alignment-report.html)
- [Staff profile tab and section alignment report](../../completed/reception/2026-07-18-staff-profile-tab-section-alignment-report.html)
