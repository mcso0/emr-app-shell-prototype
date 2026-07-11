---
id: PRODUCT-FEATURE-HOSPITAL-ADMIN-SETTINGS-HUB
type: Product Requirement
title: "Hospital Admin Settings Hub"
description: "Defines the 병원관리 settings-hub IA, including session-only 병원기본설정 and persisted interactive 근무표 boundaries."
status: implemented
area: product
doc_type: feature-plan
tags: [hospital-admin, settings, workspace, roles, schedule, vitals]
related_work:
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-002-settings-hub-screen-concepts.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-003-flex-schedule-session-ui.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-005-hospital-basic-settings-ui.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-011-schedule-operations-persistence.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-006-role-permission-management-ui.md"
last_updated: 2026-07-11
---

# Hospital Admin Settings Hub

Updated: 2026-07-11

## Product Position

`병원관리` is the hospital-wide operating settings hub. It owns workspace-level configuration that affects multiple modules, staff responsibilities, clinical master data, and administrator review.

Top-bar settings must not duplicate hospital settings. Top-bar account/profile controls are for personal profile, session, notifications, help, and account actions only.

## IA Decision

| Area | Responsibility | Phase 1 decision |
| --- | --- | --- |
| `병원기본설정` | Workspace-owned hospital identity, editable contact, operating hours, and date exceptions | Dedicated session-local UI implemented; later connect to hospital profile API |
| `병원구성원 관리` | Staff invites, member status, and assigning one permission role and one job position to a person | Keep people assignment here; role/job catalog definitions live in `역할 및 권한` |
| `역할 및 권한` | Permission-role definitions, grouped effective permissions, job-position catalog, and local work defaults | System roles are inspectable/read-only; custom roles are allow-only within the approved catalog |
| `공간/시간 관리` | Rooms, appointment intervals, operating hours, blocked times, emergency slots | Static/mock screen first |
| `근무표` | Weekly shift editing, daily role coverage, personal schedule, and approval requests | Supabase mode persists through route/RPC/RLS; mock mode intentionally remains session-only |
| `바이탈 관리` | Workspace clinical vital thresholds and alert policy | Static/mock screen first |
| `감사 로그` | Minimal administrator review of high-value mutation events | Keep as a minimal independent screen; do not remove from MVP |

## Audit Log Decision

`감사 로그` is still needed for MVP credibility because CLAiR handles sensitive medical, billing, membership, and workspace settings changes. It does not need a heavy analytics surface in this phase. The MVP surface should stay narrow:

- admin-only access
- event type, actor, target, timestamp, and safe summary
- filters for member, chart, order, billing, and settings events
- no full clinical note or sensitive payload storage in the visible row

## Role And Permission Management Decision

`역할 및 권한` is not the same as `병원구성원 관리`.

| Concept | Managed in | Meaning |
| --- | --- | --- |
| Who is this person? | `병원구성원 관리` | Member, invite, status, job position, permission role |
| What can this role do? | `역할 및 권한 > 권한 역할` | System-role inspection, custom allow-only permissions, and assigned-member context |
| What hospital job does this person hold? | `역할 및 권한 > 직무` | Job-position catalog used for display and filtering, never authorization |
| What work should a position usually own? | `역할 및 권한 > 업무 기본값` | Local-first default operational ownership, never authorization |

The role screen is an explanation and local-first management surface, not the security boundary. Persisted authorization remains a server/API/DB responsibility.

## Screen Specs

### 병원기본설정

| Item | Spec |
| --- | --- |
| Purpose | Let hospital admins review registered hospital identity and maintain contact and operating settings. |
| Primary user | Hospital owner/admin. |
| Scenario | Admin reviews read-only registered identity, edits contact or operating hours, then saves the session-local draft. |
| Information structure | Header → read-only hospital identity → editable contact → day-by-day operating hours → holiday and exception schedule. |
| Fields/components | Read-only hospital name/director/address, address copy feedback, phone/fax/homepage/Instagram, day switches, 30-minute time selects, holiday policy, exception dialogs, fixed change bar. |
| Default state | Prefilled synthetic hospital profile and weekday operating hours. |
| Empty state | Exception schedule shows `등록된 예외 일정이 없습니다.`. |
| Permission state | This screen does not claim server-side permission enforcement; future non-admin behavior must be enforced by API/RLS. |
| Save/cancel flow | The change bar appears only after edits. Save updates the session snapshot; revert confirms before restoring it. Saving operating-hour changes gives a specific toast. |
| Data/API follow-up | `workspace_hospital_profile`, `workspace_operating_hours`, holiday/exception schedules, admin-only update route, RLS/admin check, audit events, and support-request delivery. |
| Screen direction | Quiet, minimal form with no workspace ID, phase, impact, or future-data metadata in the customer-facing surface. |

### 병원구성원 관리 개선

| Item | Spec |
| --- | --- |
| Purpose | Manage staff invitation, member state, job position, and permission role assignment. |
| Primary user | Hospital admin. |
| Scenario | Admin invites staff, assigns job position/permission role, edits active member role, deactivates a member without breaking last-admin protection. |
| Information structure | Existing member table, invite sheet, and role edit dialog. Role/job catalog creation moves to `역할 및 권한`. |
| Fields/components | Email, permission role, job position, status, invitation state, safe custom role permissions. |
| Default state | Current route-backed member/invitation management surface. |
| Empty state | No members should never happen for active workspace; no pending invites can show an empty invite row. |
| Permission state | Non-admin cannot invite or change memberships. |
| Save/cancel flow | Explicit create/update/deactivate confirmations; last-admin protection remains mandatory. |
| Data/API follow-up | Existing membership/invitation APIs plus links to the selected role/job definition. |
| Screen direction | Keep the people-first table and assignment flow; do not duplicate role-definition editing. |

### 역할 및 권한

| Item | Spec |
| --- | --- |
| Purpose | Explain and manage permission roles, job positions, and permission-independent work defaults without mixing their meanings. |
| Primary user | Hospital admin or owner. |
| Scenario | Admin selects a role, reads its effective permissions, creates an allow-only custom role, checks assigned members, manages job labels, and separately sets work defaults. |
| Information structure | `권한 역할`, `직무`, and `업무 기본값` tabs; role list/detail split view. |
| Fields/components | Role name, assigned-member count, grouped permission rows, locked owner-only rows, job catalog, local work-default fields, and contextual save/cancel. |
| Default state | `관리자` selected; system roles are read-only and custom roles expose approved permissions only. |
| Empty state | System roles remain visible; a custom-role action explains the available safe catalog. |
| Permission state | Client UI can restrict mutations, but server enforcement remains authoritative. |
| Save/cancel flow | Custom role and work-default edits save only to the local/session boundary in this PR. |
| Data/API follow-up | Live catalog API/RPC/RLS and an approved work-default contract remain follow-up work. |
| Screen direction | Quiet split view; no KPI strip, phase badges, future-data rail, or database table names in product UI. |

### 공간/시간 관리

| Item | Spec |
| --- | --- |
| Purpose | Manage rooms, appointment slot rules, blocked times, and operating-calendar assumptions. |
| Primary user | Hospital admin, reception lead. |
| Scenario | Admin adjusts appointment interval and sees which rooms are active for scheduling and work queues. |
| Information structure | Calendar-rule highlights, appointment settings, room status table, impact/data side rail. |
| Fields/components | Appointment interval, open range, lunch block, emergency slot, holiday policy, room list. |
| Default state | Cheongdam synthetic rooms and 15-minute base interval. |
| Empty state | Show room setup prompt before appointment routing can claim complete configuration. |
| Permission state | Admin-only edit; reception may later get read-only. |
| Save/cancel flow | Explicit save; future save should validate overlapping hours and blocked slots. |
| Data/API follow-up | `workspace_rooms`, `workspace_operating_hours`, `appointment_slot_rules`, calendar read model. |
| Screen direction | Admin table plus compact rule form; avoid calendar-heavy build until scheduling API is scoped. |

### 근무표

| Item | Spec |
| --- | --- |
| Purpose | Let the hospital operate one weekly schedule: edit staff shifts, inspect daily role coverage, and resolve staff requests before publication. |
| Primary user | Hospital admin/operations manager; staff self-service view is simulated as a second surface. |
| Scenario | Admin creates or adjusts shifts, identifies unassigned work and coverage gaps, then reviews requests and publishes a conflict-free week. |
| Information structure | Header with publication state, admin/personal surface switch, week/day view switch, weekly grid, daily timeline, staff detail sheet, and publish review dialog. |
| Fields/components | `SegmentedControl`, `Sheet`, `Dialog`, `EmrRowActionMenu`, confirmation dialog, role filter, staff/day matrix, unassigned row, availability/request panels. |
| Default state | Synthetic Cheongdam weekly schedule with an availability conflict, two coverage gaps, unassigned shifts, and pending requests. |
| Empty state | `ScheduleDataState` supports empty/loading/error/read-only messages; the live screen starts in ready state. |
| Permission state | Client-side session model presents admin editing and personal self-service only; it does not claim server authorization. |
| Save/cancel flow | In Supabase mode, shift CRUD is optimistically shown then refreshed from the route-backed snapshot; publish is blocked in the UI until conflicts and coverage gaps are resolved. Approved requests alone modify shifts. Mock mode stays browser-session-only. |
| Data/API boundary | `hospital_schedule_*` tables provide workspace-scoped profiles, weeks, shifts, requests, time-clock, payroll preview, and in-app schedule notifications. Remote migration, real employee/payroll data, and external delivery remain later scope. |
| Screen direction | Flex-inspired operational calendar: quiet, dense, time-aware, with text labels in addition to low-saturation green/yellow/blue/purple states. |

### 바이탈 관리

| Item | Spec |
| --- | --- |
| Purpose | Maintain workspace clinical vital thresholds used by chart and inpatient warning states. |
| Primary user | Hospital admin, medical director. |
| Scenario | Medical director verifies dog/cat vital ranges and alert thresholds used for chart warnings. |
| Information structure | Clinical-rule highlights, alert policy controls, vital range table, impact/data side rail. |
| Fields/components | Species, chart warning toggle, inpatient color highlight toggle, weight-change threshold, pain-score threshold, range table. |
| Default state | Dog/cat synthetic baseline ranges. |
| Empty state | Show system defaults and require admin confirmation before customization is claimed. |
| Permission state | Admin/medical director-only edit; clinical staff may read. |
| Save/cancel flow | Explicit save; future saves require audit and version history. |
| Data/API follow-up | `workspace_vital_rules`, `species_vital_ranges`, `vital_alert_policies`. |
| Screen direction | Range table and alert policy controls; no clinical automation claim. |

### 감사 로그

| Item | Spec |
| --- | --- |
| Purpose | Review safe summaries of high-value workspace and clinical mutation events. |
| Primary user | Hospital admin/owner. |
| Scenario | Admin filters membership, chart, order, billing, and settings events when investigating a change. |
| Information structure | Current audit table with search/filter/status states. |
| Fields/components | Event type, actor, target, timestamp, safe summary. |
| Default state | Existing admin-only audit review surface. |
| Empty state | No events row. |
| Permission state | Server-denied state remains visible. |
| Save/cancel flow | No save flow; read-only review. |
| Data/API follow-up | Extend events for settings changes when those mutations become live. |
| Screen direction | Keep minimal; do not expand into analytics yet. |
