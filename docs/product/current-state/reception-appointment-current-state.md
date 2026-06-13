# Reception / Appointment Current State Inventory

Status: draft
Updated: 2026-06-13

This document records what the current implemented reception/appointment prototype shows or supports. It is an inventory layer, not the product source of truth.

Canonical product target:

- [Reception / Appointment Feature Spec](../features/reception-appointment-spec.md)
- [Reception / Appointment UX Flow](../../design/ux-flows/reception-appointment-flow.md)

Implementation reference:

- `src/features/reception/module.tsx`
- `src/features/reception/profile-drawer.tsx`
- `src/features/reception/store.ts`
- `src/features/reception/reception-list-search.tsx`
- `src/features/reception/reception-mutation-permissions.ts`
- `src/app/api/workspaces/[workspaceId]/reception/**`

## Current Screen Inventory

| Area | Current implementation | Notes |
| --- | --- | --- |
| Reception side panel | Shows `전체`, `대기`, `예약` tabs, queue count, sort/filter/search icon buttons, search input, patient cards, selected-card state, loading/error states, and retry action. | Search covers queue-facing patient/guardian/phone context. Sort/filter buttons exist visually but product behavior still needs definition. |
| Schedule toolbar | Shows date control, business hours, veterinarian multi-select, `일/주/월` view switch, unified `환자/보호자 등록`, primary `진료 접수`, and `더보기` actions. | Excel upload/download entries are present as menu items; final product scope needs confirmation. |
| Day calendar | Shows veterinarian lanes, business/off-hour backgrounds, current-time line, appointment cards, walk-in draft cards, unassigned walk-in row, and 15-minute selectable empty slots. | Empty slot click/drag creates a draft reception task when valid. |
| Week calendar | Shows weekly grid, active-day highlight, appointment/walk-in cards, current-time indicator, and empty-slot click affordance. | Week view is more overview-oriented than primary operation. |
| Month calendar | Shows monthly overview with simple counts for appointments, care, events, and closures. | Current month view is placeholder-like and should not be treated as final planning truth. |
| Walk-in reception dialog | Supports patient search, DB-backed lookup call, visit-purpose text and chips, custom purpose tag, department, veterinarian assignment or unassigned, date/time/duration, memo, and KakaoTalk send simulation checkbox. | Real KakaoTalk/provider delivery is out of scope; it only simulates user feedback. |
| Calendar draft task drawer | Opens from day-grid selection, preserves selected time/duration/veterinarian, and creates a walk-in encounter after selecting required details. | It depends on an already selected patient context. |
| Appointment / reception detail drawer | Shows appointment or reception detail, patient/guardian context, status badge, visit info, readonly fields, assessment history preview, `차트보기`, and `접수 처리` for confirmed appointments. | It can hand off to chart route with encounter context. |
| Patient/guardian profile drawers | Patient and guardian drawers exist with profile tabs and quick actions; registration flows live in `profile-drawer.tsx`. | Some quick `접수` / `예약` actions are still mock feedback, not product-complete actions. |
| Unified registration dialog | Supports 신규 보호자+환자 and 기존 보호자+신규 환자 branches, duplicate checks, consent simulation, patient details, and post-registration actions. | This is adjacent to reception planning because reception often starts from registration. |

## Current Data And Boundary Inventory

| Boundary | Current implementation | Notes |
| --- | --- | --- |
| Calendar read | `GET /api/workspaces/[workspaceId]/reception/calendar/day` loads date-scoped records into reception store. | Uses mock/local-first fallback patterns; remote Supabase validation is not claimed here. |
| Queue read | `GET /api/workspaces/[workspaceId]/reception/queue` loads queue rows into reception store. | Error state falls back to local demo/session data. |
| Walk-in create | `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters` creates encounter and queue record through the current server route contract. | Requires `reception:create` through the reception mutation permission contract. |
| Appointment check-in | `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in` turns a confirmed appointment into checked-in encounter/queue state. | Blocks unavailable, non-ready, or already checked-in appointments. |
| Patient/guardian lookup | `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup` supports reception patient search. | Used inside the walk-in reception dialog. |
| Patient/guardian registration | `POST /api/workspaces/[workspaceId]/reception/patient-guardian-registration` supports registration from the reception-adjacent registration dialog. | Registration is important to reception but should also be reconciled with customer/patient planning later. |
| Chart handoff | Reception saves chart live encounter handoff and can route to chart with patient and encounter context. | This is a cross-feature contract and should be revisited with chart planning. |

## Current Product-Relevant Behaviors

- The current default user-facing reception flow is desk-oriented: select or search patient context, create walk-in, check in appointment, or inspect schedule load.
- Reception treats appointment and encounter as different concepts: appointment is planned visit; encounter is operational visit/care context.
- The current UI permits `수의사 미지정` for walk-in and draft reception creation.
- Day calendar empty-slot creation validates business hours, blocked time, overlap, and 15-minute slot boundaries.
- Side-panel selection opens patient, appointment, or encounter context in the right drawer.
- Appointment check-in and walk-in creation have server-route contracts and permission checks, but this document does not claim full production security.
- Real external messaging is not implemented; KakaoTalk send is simulated UI feedback.

## Planning Gaps To Resolve With 승욱

These are product questions for the next reception planning pass:

1. Does reception v1 need one primary mode, or should `대기` and `예약` remain equal first-class modes?
2. Should appointment creation be a core MVP action now, or should MVP focus on walk-in and appointment check-in first?
3. What is the exact difference between `진료 접수`, `예약 생성`, and calendar draft task creation in product language?
4. Which fields are required at reception time: visit purpose, department, veterinarian, duration, weight, memo, guardian phone, consent?
5. How should duplicate same-day reception be handled: block, warn, or allow with reason?
6. What are the MVP states for appointment delay, no-show, cancellation, and rebooking?
7. Should front desk be able to assign and reassign veterinarian after check-in?
8. Should week/month views be operational MVP surfaces or read-only overview surfaces?
9. Which reception actions need audit reason entry: cancellation, no-show, veterinarian reassignment, duplicate override, or memo edits?
10. Which parts of patient/guardian registration belong in reception planning versus customer-management planning?

## Next Planning Step

Use this current-state inventory to revise the canonical [Reception / Appointment Feature Spec](../features/reception-appointment-spec.md) with 승욱's decisions. Do not run the broad implementation gap review until the other major feature plans are drafted.
