---
id: PRODUCT-FEATURE-HOSPITAL-ADMIN-SETTINGS-HUB
type: Product Requirement
title: "Hospital Admin Settings Hub"
description: "Defines the 병원관리 settings-hub IA, including the session-only interactive 근무표 boundary."
status: draft
area: product
doc_type: feature-plan
tags: [hospital-admin, settings, workspace, roles, schedule, vitals]
related_work:
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-002-settings-hub-screen-concepts.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-003-flex-schedule-session-ui.md"
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
| `병원기본설정` | Workspace-owned hospital identity, contact, brand, and operating-hour summary | Implement first as static/mock screen, later connect to hospital profile API |
| `병원구성원 관리` | Staff invites, member status, job position, permission-role assignment | Existing screen remains; improve IA and connect its role language to 역할별 업무 관리 |
| `역할별 업무 관리` | Role work profiles: default work scopes, screen access expectations, default assignee behavior | Not a raw permission editor; it complements 구성원 관리 |
| `공간/시간 관리` | Rooms, appointment intervals, operating hours, blocked times, emergency slots | Static/mock screen first |
| `근무표` | Weekly shift editing, daily role coverage, personal schedule, and approval requests | Interactive session-only screen; persistence remains a later scope |
| `바이탈 관리` | Workspace clinical vital thresholds and alert policy | Static/mock screen first |
| `감사 로그` | Minimal administrator review of high-value mutation events | Keep as a minimal independent screen; do not remove from MVP |

## Audit Log Decision

`감사 로그` is still needed for MVP credibility because CLAiR handles sensitive medical, billing, membership, and workspace settings changes. It does not need a heavy analytics surface in this phase. The MVP surface should stay narrow:

- admin-only access
- event type, actor, target, timestamp, and safe summary
- filters for member, chart, order, billing, and settings events
- no full clinical note or sensitive payload storage in the visible row

## Role Work Management Decision

`역할별 업무 관리` is not the same as `병원구성원 관리`.

| Concept | Managed in | Meaning |
| --- | --- | --- |
| Who is this person? | `병원구성원 관리` | Member, invite, status, job position, permission role |
| What can this role generally do? | Permission policy layer | Server/API/DB enforcement and grant ceiling |
| What work should this role usually own? | `역할별 업무 관리` | Default work area, Home work generation, assignment defaults, operational coverage |

Phase 1 may display role work profiles and default operational routing without claiming final server-side permission enforcement from this screen.

## Screen Specs

### 병원기본설정

| Item | Spec |
| --- | --- |
| Purpose | Let hospital admins maintain workspace-owned hospital profile and basic operating settings. |
| Primary user | Hospital owner/admin. |
| Scenario | Admin reviews prefilled Cheongdam profile, fixes contact/address/operating-hour summary, saves for later API persistence. |
| Information structure | Header, profile highlights, editable profile fields, operating-hour summary table, impact/data side rail. |
| Fields/components | Hospital name, workspace ID read-only, address, phone, representative contact, fax, owner/director, business number, public links, operating hours. |
| Default state | Prefilled synthetic Cheongdam profile. |
| Empty state | Show required fields empty with clear required markers once persistence scope begins. |
| Permission state | Non-admin should see no edit controls or a permission-denied state. |
| Save/cancel flow | Explicit save; cancel reverts local draft; future save emits audit event. |
| Data/API follow-up | `workspace_hospital_profile`, `workspace_operating_hours`, brand asset storage, admin-only update route, RLS/admin check. |
| Screen direction | Quiet admin form with top summary cards, dense field grid, and operating-hours table. |

### 병원구성원 관리 개선

| Item | Spec |
| --- | --- |
| Purpose | Manage staff invitation, member state, job position, and permission role assignment. |
| Primary user | Hospital admin. |
| Scenario | Admin invites staff, assigns job position/permission role, edits active member role, deactivates a member without breaking last-admin protection. |
| Information structure | Existing member table, invite sheet, role edit dialog, custom permission-role/job-position controls. |
| Fields/components | Email, permission role, job position, status, invitation state, safe custom role permissions. |
| Default state | Current route-backed member/invitation management surface. |
| Empty state | No members should never happen for active workspace; no pending invites can show an empty invite row. |
| Permission state | Non-admin cannot invite or change memberships. |
| Save/cancel flow | Explicit create/update/deactivate confirmations; last-admin protection remains mandatory. |
| Data/API follow-up | Existing membership/invitation APIs plus role-work profile read hints from `역할별 업무 관리`. |
| Screen direction | Keep existing table/dialog surface, but clarify relationship to role work profiles. |

### 역할별 업무 관리

| Item | Spec |
| --- | --- |
| Purpose | Define role work profiles: default work areas, default assignment, Home work generation, and escalation expectations. |
| Primary user | Hospital admin or owner. |
| Scenario | Admin checks that technicians receive lab/treatment work, front desk receives reception/customer work, and vets own chart/order confirmation. |
| Information structure | Role highlights, default assignment controls, role-work matrix, impact/data side rail. |
| Fields/components | Default reception owner, chart author role, lab result input role, billing close approval, Home work generation toggle, escalation limit toggle. |
| Default state | Five synthetic operational roles. |
| Empty state | If no role profiles exist, show canonical role presets. |
| Permission state | Admin-only edit; non-admin no access. |
| Save/cancel flow | Explicit save; future persistence must audit changes. |
| Data/API follow-up | `workspace_role_work_profiles`, `permission_policies`, `workspace_memberships`, role-work read model for Home. |
| Screen direction | Matrix-first admin surface, not a free-form ACL editor. |

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
| Save/cancel flow | Shift CRUD immediately changes session state and marks a published schedule as `재게시 필요`; publish is blocked until conflicts and coverage gaps are resolved. Approved requests alone modify shifts. |
| Data/API follow-up | `staff_shift_templates`, `workspace_staff_schedules`, coverage rules, availability, request/audit records, admin/staff RLS, notification delivery. |
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
