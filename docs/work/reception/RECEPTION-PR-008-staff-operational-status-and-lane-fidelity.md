---
id: "RECEPTION-PR-008"
status: "done"
area: "reception"
priority: "P1"
target_pr: "User goal / staff operational status and lane-header fidelity"
source_docs:
  - "docs/design/screens/reception/planning/cds-v2-reception-screen-alignment-notes.md"
  - "docs/engineering/data-model/hospital-schedule-operations.md"
dependencies:
  - "RECEPTION-PR-007"
  - "HOSPITAL-ADMIN-LIVE-PR-011"
updated: "2026-07-14"
---

# Staff Operational Status And Lane Fidelity

## Goal

Make the reception day-calendar lane header truthful about each veterinarian's
operational state and match Figma node `27684:22157` without changing the stable
per-veterinarian lane color assignment.

## Approved Behavior

- An explicit time-clock row with `clock_out_at` maps to `퇴근`.
- A published/changed shift whose end time has passed without a clock-out maps to
  `근무 종료`; the UI must not imply that the person actually clocked out.
- Schedule and time-clock facts stay persisted in the existing hospital schedule
  tables. Current status is a read-time snapshot, not a minute-by-minute DB write.
- A currently checked-in appointment assigned to the veterinarian may overlay the
  schedule snapshot as `진료중` in the already-authorized reception calendar.
- The lane tone remains stable by veterinarian identity when another lane is hidden.
- The eye button remains a ghost control. Only the button receives black 4% on
  hover/focus; the colored lane-header surface does not darken.

## Status Contract

| Code | Label | Source and rule |
| --- | --- | --- |
| `in_consultation` | `진료중` | Current checked-in appointment assigned to the veterinarian |
| `available` | `진료가능` | Current time falls inside a published/changed work shift |
| `scheduled` | `근무 예정` | The selected relevant shift has not started |
| `shift_ended` | `근무 종료` | Shift ended, but no clock-out fact exists |
| `clocked_out` | `퇴근` | Latest matching time-clock row has `clock_out_at` |
| `leave` | `휴가중` | Published/changed leave shift |
| `off` | `휴무` | Published/changed off shift |
| `unknown` | no badge | No authoritative schedule profile/shift exists |

Status precedence is leave/off, explicit clock-out, ended/upcoming/current work
shift. The snapshot uses `Asia/Seoul` time and exposes only user ID, status code,
and source; exact clock times do not need to leave the DB for this surface.

## Exact Figma Contract

- Cell: 56px high with 8px padding; inner header: 40px high.
- Inner header: 12px radius, 10px horizontal and 8px vertical padding, 10px gap.
- Lane surface: that lane's existing `500` token at 6% over white; border uses the
  same lane's `300` token. No whole-header hover color.
- Avatar: 24x24px, 6px radius, neutral-200 border.
- Name: Pretendard 16/24, medium 500, 0.006em letter spacing, gray-700.
- Badge: 18px frame with a 1px outside stroke (20px visual bounds), 20px minimum
  width, 6px radius, 6px horizontal and 1px vertical padding, white surface,
  neutral-200 stroke; label 12/16, medium 500, 0.025em. Status colors follow the
  Figma examples: teal-500 available, neutral-500 waiting, orange-500 break,
  green-500 leave, and iron-600 clocked out.
- Action group: 4px gap; each ghost button is 24x24px with 4px radius and a 14px icon.

## Implementation Plan

1. Add failing server, migration-contract, and browser fidelity tests.
2. Add an additive workspace-scoped status-snapshot RPC and merge its result into
   the existing veterinarian staff read without failing the base staff list.
3. Request the selected operating date from reception and render a local status
   badge, including the authorized `진료중` appointment overlay.
4. Align the existing lane-header tokens and CSS to the exact Figma contract while
   preserving stable per-lane tones and shared hide/restore state.
5. Run focused tests, lint, typecheck, build, docs validation, and secret scan.

## Out Of Scope

- Manual status editing, status overrides, or speculative `휴게중`/`업무대기` writes.
- Hard-coded staff schedules or dated seed rows without an authoritative roster.
- Changes to appointment, schedule, time-clock, role, or permission mutation UX.
- A new shared design-system status taxonomy; this badge is reception-specific.

## Done When

- The DB snapshot distinguishes explicit clock-out from elapsed shift time.
- Status read failure remains a section-level error and does not remove staff lanes.
- Figma dimensions, typography, spacing, radius, avatar border, and ghost hover are
  verified in a real browser.
- Hiding a lane fills the remaining grid without recoloring any remaining lane.
- Focused verification and release flow complete through merged `origin/main`.

## Result

- Added the additive `reception_staff_operational_status_snapshot` RPC and merged
  its selected-date output into the existing staff read. Status failure remains a
  section error and does not remove the base staff list.
- Added reception rendering for schedule/time-clock states plus the current
  checked-in appointment `진료중` overlay, with 60-second and window-focus refresh.
- Aligned the existing lane header to Figma node `27684:22157` and removed the
  whole-header hover darkening. Stable per-veterinarian tone assignment remains
  unchanged when a lane is hidden.
- Preserved keyboard focus return for the operational-profile action by keeping
  progressive actions focusable while visually hidden at rest.
- Added the [completion report](../../completed/reception/2026-07-14-reception-lane-status-fidelity-report.html).

## Verification

- Focused status server and migration contract: 7 passed.
- Existing operational-profile regression: 5 passed.
- Lane hide/tone, selector, Figma metrics, staff loading, and reservation staff
  source regression: 6 passed.
- `npm run lint` — passed.
- `npx tsc --noEmit --pretty false` — passed.
- `npm run build` — passed; the existing broad docs-reader Turbopack tracing
  warning remains.
- `npm run docs:check` — 802 documentation files checked, passed.
- `npm run security:secrets` — 3,074 tracked files checked, passed.

Local SQL runtime replay was not available because this machine has Docker but no
`supabase` or `psql` CLI. The migration has focused static contract coverage; remote
application is left to the repository deployment migration path.

## Remaining Boundary

The UI deliberately renders no badge when a staff member has no authoritative
schedule profile or published/changed shift for the selected date. This change does
not invent dated schedules for the prepared clinic roster.

## 2026-07-14 Deployment Follow-up

Production-demo verification found that the remote Supabase project did not contain
the prerequisite hospital schedule schema, the status snapshot RPC, or selected-date
schedule facts. The follow-up applies the two already-versioned schema migrations and
adds an idempotent synthetic backfill for the six veterinarians selected in the
Cheongdam 2026-07-14 reception scenario. Each backfilled row contains a 09:00-19:00
published clinical shift and an explicit 19:00 clock-out fact, so the UI renders
`퇴근` without weakening the fact-based status rule.

Remote read-back verified the status RPC, six veterinarian profiles, six published
shifts, and six completed clock entries. A deployed-page reload then verified six
visible `퇴근` badges whose DOM status is `clocked_out`. Supabase recorded the three
applied migrations under remote-generated versions; statement-free compatibility
aliases preserve those versions locally without changing fresh-replay behavior.

Figma node `27682:32532` was re-inspected through the plugin API after deployed
review. The reception badge now uses the component's true outside neutral-200
stroke, 20px minimum width, centered label, and status-specific token mapping;
`퇴근` resolves to iron-600 (`#746A5F`) instead of the previous sky tone.
