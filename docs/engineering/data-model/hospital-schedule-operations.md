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

## RLS and RPC notes

All public tables have RLS enabled and explicit `authenticated` grants. RPCs use security-definer functions with a fixed search path and check `private.clair_is_active_workspace_member`, `private.clair_is_workspace_admin`, or the caller's own staff profile before mutation.

## Verification boundary

The isolated local Supabase run applied this migration and verified employee read/request denial and administrator approval/publish notifications. The repository-wide local reset currently stops earlier at an unrelated reception migration (`weight_kg` missing), so it is not a release-ready remote migration proof.
