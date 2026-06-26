---
id: "RECEPTION-QA-PR-004"
type: "Work Item"
title: "Reception reservation creation and appointment check-in flow"
description: "Implements DEN-516 reception QA work for reservation creation, server-owned appointment writer validation, reservation-to-reception check-in form payloads, audit emission, and UI regression coverage."
status: "human_review"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "qa"
  - "reservation"
  - "appointment"
  - "db-api"
target_pr: "Reception QA project / DEN-516"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/reception/RECEPTION-QA-PR-003-create-drawer-weight.md"
dependencies:
  - "RECEPTION-QA-PR-003"
updated: "2026-06-16"
---

# Reception Reservation Creation and Appointment Check-In Flow

## Goal

Turn the `+ 접수/예약 > 예약하기` entry point from a placeholder toast into a real reservation creation flow, then let staff convert a reservation into a reception encounter through a prefilled check-in form backed by the synthetic/demo DB/API contract.

## Scope

- Keep the unified `+ 접수/예약` toolbar button and wire `예약하기` to a right drawer reservation form.
- Let staff select an existing patient, see the last known patient weight as read-only context, pick date/time/duration/veterinarian, and enter reservation memo.
- Disable occupied time options in the drawer with `예약됨` text.
- Block Sunday closed days and out-of-business-hours reservation writes at the server core and DB writer boundary.
- Create appointments through `POST /api/workspaces/[workspaceId]/reception/appointments`.
- Add a server-owned `public.clair_create_reception_appointment(...)` writer with workspace, patient/guardian, veterinarian, business-hour, closed-day, and overlap validation.
- Add `reception.appointment_created` audit event support for the in-memory helper, audit review filtering, and DB event-type constraint.
- Apply the created appointment to reception state and open the reservation detail drawer after success.
- Change reservation detail CTA to `접수하기` and open a prefilled appointment check-in form.
- Send appointment check-in form payloads for weight, visit purpose, department, veterinarian, duration, reception memo, and checked-in time.
- Extend the appointment check-in RPC boundary with a JSON payload wrapper that updates the linked encounter and patient `weight_kg`.
- Keep the flow synthetic/demo-data-backed. Initial implementation did not execute remote Supabase operations; the 2026-06-25 follow-up below records the scoped staging RPC/readback repair.

## Out Of Scope

- Calendar drag creation UX parity and future-date drag reservation behavior. This remains DEN-517/downstream reception QA work.
- Full holiday calendar configuration beyond the current Sunday closed-day rule.
- Remote staging migration execution or production deployment.

## DB/API Boundary

- New route: `POST /api/workspaces/[workspaceId]/reception/appointments`.
- New core: `createReceptionAppointment(...)`.
- New RPC contract: `public.clair_create_reception_appointment(text, text, jsonb)`.
- Extended route: `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in` can receive optional form payload.
- Extended RPC contract: `public.clair_check_in_reception_appointment(text, text, text, jsonb)`.
- Permission contract: `appointment_create` requires `reception:create`.
- Audit event: `reception.appointment_created` with target type `appointment`.
- This is not mock-only: the route uses the Supabase client/RPC path when a Supabase session exists, and the mock fallback is covered separately for local/demo continuity.

## Done When

- `예약하기` opens the reservation drawer instead of a placeholder toast.
- Reservation creation sends the expected API payload and creates an appointment record.
- Created reservation appears in the calendar and opens a reservation detail drawer.
- Server validation rejects missing patient, closed day, out-of-hours time, and occupied slots.
- Route denies missing actor and keeps workspace permission enforcement.
- Audit append allows and emits reservation-created events.
- Reservation detail `접수하기` opens a prefilled check-in form.
- Appointment check-in form payload is sent through the check-in API and preserves reservation-based `appointment` reception type.
- Patient weight entered during reservation check-in can be written back through the DB boundary.

## Verification

- `npx playwright test tests/reception-appointment-create-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/live-audit-mutation-emission.spec.ts --reporter=line`: 36 passed
- `npx playwright test tests/reception.spec.ts --grep "reception creates a walk-in waiting row from the new check-in dialog|reception creates a reservation through the unified check-in menu|server-backed reception day calendar read hydrates appointments and walk-ins|reception cards open the reception detail drawer|reception check-in converts a confirmed appointment into a waiting encounter|server-backed appointment check-in sends the appointment transition request|appointment check-in persistence regression reloads from queue and calendar reads" --reporter=line`: 7 passed
- `npx tsc --noEmit --pretty false --incremental false`: passed
- `npm run lint`: passed with 5 pre-existing warnings outside the DEN-516 changes
- `npm run docs:check`: 714 docs/agent markdown files passed
- `git diff --check`: passed

## Handoff Notes

- DEN-517 and later drag/detail work should reuse the appointment writer and audit event instead of adding local-only reservation state.
- The reservation drawer now owns the explicit button-entry creation path; calendar drag can use the same domain payload with prefilled veterinarian/time.
- Reservation-to-reception conversion now reuses the existing appointment check-in route with an optional payload; future detail edit work should not bypass that API.
- Appointment creation is workspace-scoped and rejects overlapping appointment slots globally for the workspace under current rules.
- The audit event allowlist now includes `reception.appointment_created`; future audit UI changes should keep this label/filter available.

## 2026-06-25 Follow-up

- Reception drawer creation now blocks walk-in creation outside the 09:00-19:00 business window and explains the next action in-context.
- Same-day reservation time options now disable elapsed slots with `지난 시간` and keep future-date reservations available within business hours.
- Day calendar draft creation now treats today's elapsed slots as invalid, so past-time slots do not open a draft drawer or temporary card.
- The walk-in server core now rejects `plannedStartAt` values that start before opening or end after closing with `walk_in_outside_business_hours`.

## 2026-06-25 Reservation Create Readback Follow-up

- Staging Supabase was missing `public.clair_create_reception_appointment(text, text, jsonb)`, so valid reservation writes returned a generic create failure before an appointment row could be inserted.
- The appointment writer migrations now match the existing staging membership helper contract, `private.clair_is_active_workspace_member(p_workspace_id)`, and use the current `appointment_change_logs.change_type = 'create'` constraint value.
- Appointment create now treats the primary appointment write as authoritative: if the appointment is persisted but the follow-up audit append fails, the API returns the created appointment instead of telling the client the reservation failed.
- Creating a future reservation now moves the calendar operating date to the reservation date so the newly created card is visible immediately, and calendar readback remains available after navigating back to that date.
- Scoped staging readback created synthetic Cheongdam appointment `62702ce7-be92-4d40-97e9-8e3e3ef1cebe` for `구름` / `문지아` / `청담 원장`, 2026-06-26 09:00-09:30 KST, status `confirmed`, memo `12`, and weight `12.00`.

## 2026-06-26 Calendar Card Profile Follow-up

- Reservation creation was confirmed in staging, but the day calendar card rendered `환자 미지정 · 보호자 미지정` while the detail drawer displayed the selected patient and guardian.
- Root cause was display/readback coupling, not creation persistence: `appointments.patient_id` and `appointments.guardian_id` were saved correctly, but `clair_list_reception_day_calendar(...)` returned only appointment IDs without embedded `patient` / `primaryGuardian` records, and the calendar appointment card looked up names through mock-only appointment helpers.
- Calendar appointment cards now receive the live `ReceptionProfileDataset` and resolve appointment patient/guardian names from live profile state first, with mock fallback preserved for legacy demo data.
- The calendar reader function now embeds patient and primary guardian objects for appointment and walk-in records. Scoped staging readback for appointment `2c7bcd75-348b-48ff-9073-1240dda16e5d` returned `초코` / `최도현` from `public.clair_list_reception_day_calendar('workspace-clair-cheongdam', date '2026-06-27')`.

## Result

Ready for Human Review.

DEN-516 implements a real reservation creation path plus reservation-to-reception check-in form payloads with server/API/DB validation and focused UI regression coverage. The next issue should account for the shared appointment writer and check-in payload boundary before changing calendar drag or reception detail flows.
