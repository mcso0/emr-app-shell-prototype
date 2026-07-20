---
id: "RECEPTION-PR-017"
status: "done"
area: "reception"
priority: "P0"
target_pr: "Calendar reservation visibility in the staff operational profile"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/work/reception/RECEPTION-PR-013-profile-side-panel-v2-read-model.md"
dependencies:
  - "RECEPTION-PR-013"
updated: "2026-07-20"
---

# Calendar Reservation Visibility In Staff Operational Profile

## Goal

Show every assigned staff member's selected-day reception reservations in both
`오늘 근무 정보` and `업무현황` without treating a reservation as a hospital
schedule shift or an absence event.

## Scope

- Reuse the authorized reception calendar state already rendered in the current
  day view.
- Keep the clinical `담당의` veterinarian-only, but let any active workspace
  member be assigned separately as an operational `업무 담당자`.
- Show non-cancelled, non-no-show reservations assigned to the opened staff
  member as a separate `예약 진료` summary in `오늘 근무 정보`.
- Add the same reservations to `업무현황` as `접수/예약` cards with a reception
  navigation target.
- Use only the safe patient/guardian display labels already loaded for the
  calendar card.
- Correct the operational-profile request to use the selected calendar date.

## Out Of Scope

- Creating or changing hospital schedule shifts, leave/off, availability, or
  the `일정` tab.
- Creating fulfillment work items from reservations.

## Done When

- A visible reservation assigned to a staff member of any supported role
  replaces the false `오늘 게시된 근무가 없어요`
  empty state with its time and display label when no published shift exists.
- The same reservation appears in `업무현황` as an actionable `접수/예약` card.
- Cancelled/no-show reservations and unrelated staff reservations remain absent.
- TypeScript and focused reception profile checks pass or record an inherited
  environment blocker.

## Implementation Notes

- The data remains presentation-scoped to the authorized reception calendar;
  the profile endpoint does not broaden its generic member-read payload with
  patient or guardian data.
- `appointment_staff_assignments` persists operational assignment separately
  from `appointments.assigned_veterinarian_id`; active same-workspace
  membership is validated in the appointment creation RPC.
- The remote staging migration was applied as
  `20260720121207_appointment_staff_assignments`; its filename matches the
  immutable remote migration record.
- Published schedule and appointment workload are intentionally rendered as
  separate cards so leave/off and schedule semantics remain truthful.
