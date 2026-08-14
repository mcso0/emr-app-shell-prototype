---
id: "RECEPTION-PR-016"
status: "implemented"
area: "reception"
priority: "P1"
target_pr: "Staff profile side-panel Figma fidelity pass"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/work/reception/RECEPTION-PR-015-staff-profile-figma-alignment.md"
  - "Figma UkfxgituFcU2rhYFriAErJ / 27751:80144"
dependencies:
  - "RECEPTION-PR-015"
updated: "2026-07-19"
---

# Staff Profile Side-Panel Figma Fidelity Pass

## Goal

Bring the profile tab's default 380×1105 panel anatomy in line with Figma node
`27751:80144` without changing the verified profile, availability, schedule,
permission, or RLS data boundaries.

## Scope

- Render the Figma default header geometry while retaining self-only status and
  avatar behavior.
- Reorder the profile tab to today's shift, account information, then upcoming
  schedule.
- Use 32px section headers, 70px outlined cards, 42px date tiles, and the
  Figma empty-schedule copy for the existing truthful one-event availability
  contract.
- Keep email and phone copy controls visible when the value exists.
- Update the 380×1105 Storybook specimen to mirror the same geometry.

## Out Of Scope

- A multiple-event availability API or absence-reason data.
- Cross-module work category aggregation, counts, or accordion semantics.
- Panel-local schedule reads, date navigation, schema, RLS, or permission
  changes.
- Any global token, shared Tabs API, dependency, or avatar persistence change.

## Done When

- The default profile tab matches the inspected Figma node's section order and
  measured 380px panel/header/card geometry.
- Existing live-data and authorization contracts remain unchanged.
- Focused lint and TypeScript pass, and the Storybook Figma specimen renders at
  380×1105 for visual inspection.

## Implemented Result

- `StaffOperationalProfilePanel` now renders today's shift first, preserves the
  16px/8px insets and dividers, and keeps schedule navigation in the separate
  permitted tab/menu path.
- The default status control is 173px as in the inspected panel; edit input
  behavior remains bounded by the existing 217px feature token.
- A 70px availability card shows the safe single event from the existing API;
  an empty response renders `예정된 일정이 없습니다` rather than a fabricated
  event list.

## Verification

- `npm run lint -- src/features/staff/staff-operational-profile-drawer.tsx src/features/staff/components/profile-side-panel-v2-header.tsx src/features/staff/components/profile-side-panel-v2-profile.tsx src/features/staff/profile-side-panel-v2-content.stories.tsx`
- `npx tsc --noEmit --pretty false`
- Local Storybook browser review: `FullPanelProfileSpecimen` measured panel
  380×1105, header 378×150 inside the border, and profile content positions
  matching node `27751:80144` (section starts 167/314/523px; shift card starts
  211px and is 330×70px).
- `npx playwright test tests/reception-staff-operational-profile.spec.ts --workers=1 --reporter=line` is blocked locally before the profile test because the
  demo reception queue toolbar is disabled after a session/queue read failure.

## Closeout

- [Figma fidelity pass report](../../completed/reception/2026-07-19-reception-pr-016-staff-profile-figma-fidelity-pass-report.html)
