# Hospital Schedule Operations Data Model

## Boundary

This model is limited to synthetic local/dev/test operations. It records planning, request review, in-app notices, attendance entries, and payroll previews. It never creates payment, tax, settlement, or external-message side effects.

## Workspace-scoped records

| Record | Purpose | Access |
| --- | --- | --- |
| `hospital_schedule_staff_profiles` | Membership-to-operational-role mapping, availability, synthetic hourly rate | Admin only; rate is never returned by the staff snapshot |
| `hospital_schedule_weeks` / `hospital_schedule_shifts` | Published-state weekly plan and individual shift | Active members read; admins change, delete, and publish |
| `hospital_schedule_requests` | Leave and shift-change requests | Staff create/read their own; admins review |
| `hospital_time_clock_entries` | Per-staff clock-in/out linked to a scheduled non-leave shift | Staff write their own; admins read |
| `hospital_schedule_payroll_previews` | Synthetic, non-payment total for a date range | Admin only |
| `hospital_schedule_notifications` | In-app request/publish events | Recipient only |

## Server contract

- The browser does not decide authorization. Route handlers resolve the Supabase session and load the active workspace membership first.
- Staff can submit their own request and operate their own time clock. `hospital_admin` is required for schedule save/delete, request review, publish, assisted-assignment suggestions, and payroll preview.
- Requests do not mutate a shift when submitted. `hospital_schedule_review_request(..., 'approved')` is the only approval path that applies the requested leave/change and marks the week `changed`.
- Assignment is deterministic and advisory. The admin explicitly saves the proposed staff assignment through `hospital_schedule_save_shift`.
- `hospital_schedule_read_snapshot` returns role-safe staff directory fields, shifts, the caller's permitted requests, and their in-app schedule notifications. It excludes hourly rates.
- `staff_current_work_status_snapshot(workspace, user, day)` applies to every
  active workspace member. It returns only date, state, published work time,
  optional active consultation room, and source after enforcing active
  same-workspace membership.
- `reception_staff_operational_status_snapshot(workspace, day)` returns only
  veterinarian user ID, derived status code, and source. It does not expose clock
  timestamps, rates, notes, or mutable schedule fields. The reception staff API
  performs its existing `reception:view` check before invoking this snapshot.
- The staff operational-profile read resolves the workspace timezone and reads
  every schedule week covering today through today + 13 days. Only `published`
  and `changed` weeks participate. It returns today's current-work projection, the
  nearest leave/off period, and the first following work shift as a minimal
  display projection; request reasons, private notes, hourly rates, and editable
  schedule fields remain excluded.

## Reception operational status derivation

- Only `published` or `changed` weeks participate; draft schedule data is not shown
  as an operational fact.
- Leave/off wins first. A matching time-clock row with `clock_out_at` then maps to
  `clocked_out` (`퇴근`). Without that fact, elapsed shift time maps to
  `shift_ended` (`근무 종료`). Upcoming and active work shifts map to `scheduled`
  and `available`.
- Missing profile or shift data maps to `unknown`; the client omits the badge rather
  than inventing availability from membership role or display name.
- The calculation uses `Asia/Seoul` time. It is evaluated on read and refreshed by
  the reception client, so the database does not receive minute-by-minute status
  writes.
- `진료중` is not a schedule-table value. The current-work snapshot derives it
  only from an `in_consultation` encounter whose primary veterinarian is the
  target user and whose latest consultation call has a room. Waiting reservations
  and walk-ins remain workload only.
- `hospital_schedule_staff_profiles` is provisioned for every active membership,
  including roles outside veterinarian, technician, and reception. Membership
  role never implies that a shift exists.

## RLS and RPC notes

All public tables have RLS enabled and explicit `authenticated` grants. RPCs use security-definer functions with a fixed search path and check `private.clair_is_active_workspace_member`, `private.clair_is_workspace_admin`, or the caller's own staff profile before mutation. The operational-status snapshot and minimal staff operational-profile read follow the existing active-member, same-workspace schedule-read boundary, while the reception status route separately enforces `reception:view`. Schedule and membership management destinations keep their own server permission boundaries; a profile-panel deep link is not authorization.

## Verification boundary

The isolated local Supabase run applied this migration and verified employee read/request denial and administrator approval/publish notifications. The repository-wide local reset currently stops earlier at an unrelated reception migration (`weight_kg` missing), so it is not a release-ready remote migration proof.
