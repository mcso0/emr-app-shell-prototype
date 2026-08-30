---
title: "Clinic Start State and Demo Operations"
status: "draft"
updated: "2026-08-30"
owner: "product"
source_request: "2026-06-11 owner intake"
---

# Clinic Start State and Demo Operations

This document records the next demo-data direction after the first synthetic dataset foundation. It defines how the portfolio MVP should start, reset, and operate like a new hospital using synthetic master data without pre-filled daily work.

## Product Intent

The demo should feel like a newly opened clinic that is ready to operate, not a static sample file full of old work.

The default workspace should start with a prepared operational dataset already present:

- one synthetic hospital workspace, currently named `CLAiR EMR 청담점` for planning
- hospital administrators and users already registered
- role-specific users for owner/director, veterinarians, technicians, front desk, and lab/imaging or order-fulfillment staff
- patient and guardian master records for a realistic small clinic population
- order categories, order catalogs, order sets, lab result item definitions, pricing examples, and hospital-admin presets
- basic role/workspace membership records
- optional lightweight change-history records for setup and later user actions

This is not an empty database. It is an empty daily-work state on top of a ready clinic dataset.

The default workspace should not start with active daily work:

- no open reception queue
- no active appointments unless a selected scenario intentionally creates them
- no active encounters or SOAP notes
- no active lab, imaging, dispensing, treatment, or billing tasks
- no invoice candidates or unpaid invoices
- no stale May 2026 work items shown by default

## Data Modes

The app needs explicit data modes so staff and reviewers do not confuse old fixtures, synthetic seed data, and live-style state.

| Mode | Purpose | Default Posture |
| --- | --- | --- |
| Empty clinic seed | New clinic baseline with master data but no daily work | Preferred default demo state |
| Scenario replay | Creates a bounded set of appointments, encounters, orders, and billing events for QA or demo script | Deferred; do not build in the first implementation pass |
| Legacy/Sales demo fixture | Older scripted demo coverage that can be removed once Cheongdam seed coverage replaces it | Developer/test opt-in only while cleanup is in progress, never default |
| Local-first working state | Stores interactions created during local use | Resettable |
| Remote staging/live | Validates remote persistence or live infrastructure | Approval-gated |

Old fixture records, legacy log-style records, and past dummy daily work must not appear in the default clinic start state. Mock fallback must not silently override local-first or seed data. If the selected data source is loading, screens should show loading or empty states rather than flash old fallback records.

## Current Implementation Notes

As of 2026-06-12, the default prepared clinic workspace is `workspace-clair-cheongdam`. Its reception start state is scoped to the current operating date and must not merge `clair-demo` legacy appointment, encounter, queue, or fixed May 2026 fixture data.

The legacy Sales Demo workspace remains `clair-demo` only as a cleanup target. It is not the default demo path and is no longer a preservation requirement. Remaining `2026-05-01` fixture work such as Kong/Nabi/Coco should be removed or isolated once Cheongdam seed/API coverage replaces the specific regression value.

Cheongdam reception read states now keep loading, error, retry, and empty-copy hooks separate from legacy fixture fallback. If queue or calendar reads fail, the UI should keep the prepared empty-clinic state, expose retry actions, and avoid telling reviewers that `clair-demo` local demo data is being maintained. Session-created reception drafts must carry the active workspace/date rather than defaulting to `clair-demo`.

## Demo Date Model

The preferred product behavior is real operating time: work created on June 11 should remain visible as June 11 history when the real date becomes June 12 or June 13. Staff should be able to move the date picker or calendar back to previous days and see the work from those days.

This preference needs an implementation-risk check before build. If persistent multi-day accumulation creates too much demo-state complexity, the fallback is a fixed review day plus reset.

Recommended sequence:

1. Centralize the demo date source.
2. Default the clinic to the real current operating date, with a configured review date only for deterministic QA if needed.
3. Make daily work relative to that date.
4. Add a reset action that restores the empty clinic seed.
5. Check whether previous-day data can remain accessible through date picker/calendar views without making the demo brittle.
6. Defer scenario replay and rich multi-day automation until the baseline is stable.

For the 2026-06-11 intake, a screen should not show stale May 2026 daily work unless the user explicitly enters an old scenario or history view.

## Reset And Day Progression

The demo needs two separate concepts:

- Reset: restore the clinic to the empty baseline with staff, patients, guardians, catalog, roles, and no active daily work.
- Progression: keep user-created work by date so the next real day can start clean while previous-day work remains reviewable.

The first pass must support reset. Scenario replay is useful but should not be built before the basic clinic setup works. Real day progression is the preferred direction, but it should be accepted only after the audit confirms the state model can keep previous-day records without stale-default leakage.

As of 2026-06-16, the first Cheongdam reset implementation exists for `workspace-clair-cheongdam`. As of 2026-08-30, its server capability remains available but no workspace exposes a reset control in the global topbar:

- The global workspace topbar does not expose the reset control, including for Cheongdam hospital administrators.
- The server route is `POST /api/workspaces/[workspaceId]/demo/session-reset`.
- Remote Supabase reset is backed by `public.clair_reset_cheongdam_demo_session(text, text)`, limited to `workspace-clair-cheongdam`, `auth.uid()` actor match, and active workspace admin membership.
- Reset clears daily-work state across reception queue, appointments, encounters, SOAP/diagnoses, orders, fulfillment work items, invoices, invoice lines, and payments.
- Reset removes generated patient rows only when they match the current registration writer pattern `P-YYMMDD-XXXXXX`. Guardian removal is limited to guardians linked to those generated patients and never deletes `CD-G-*` seed guardians.
- Reset does not touch users, memberships, workspace config, permission policies, service/order catalog, hospital-admin setup, external providers/payments/messages, or `CD-*` Cheongdam seed master data.
- Mock/local mode is browser-state reset only and should not be treated as server security. Supabase sessions rely on the server route and RPC to decide whether the user is an active workspace admin.

## Role-Based Work Validation

Each role should be verified through realistic actions, not only by hiding or showing navigation.

| Role | Expected Work Focus |
| --- | --- |
| Hospital administrator / owner | Can review and manage almost everything: users, workspace setup, order catalog, change history, operational overview, sensitive hospital settings |
| Veterinarian | Can review most clinical and operational information, create/edit charts, diagnoses, SOAP, orders, and order billing requests; should not change sensitive hospital/security settings, passwords, restricted-drug administration settings, or other owner-only configuration |
| Technician | Can review assigned clinical work and handle treatment/dispensing support, task completion, and status updates; should not edit veterinarian chart authority, order catalog/admin setup, or sensitive hospital settings |
| Front desk | Can handle reception, patient/guardian registration, appointment handling, billing collection, and related lookup; should not edit clinical chart contents, order catalog/admin setup, or sensitive hospital settings |
| Lab/imaging or fulfillment staff | Can work lab/imaging/fulfillment queues, result/status updates, and order completion handoff; should not edit veterinarian chart content, billing authority beyond scoped handoff, order catalog/admin setup, or sensitive hospital settings |

Basic permission checks should be covered for portfolio confidence. Cross-workspace access checks are lower priority for this demo because the primary demo assumes one clinic workspace; deep production-grade workspace isolation, RLS, or live security replay remains separate and approval-gated.

## Change History Page

The existing audit-style surface should be productized as a staff-readable `변경 이력` view for the demo.

The page should prioritize:

- who changed something
- what changed
- when it changed
- which patient, guardian, encounter, order, invoice, or admin setting was affected
- a simple timeline/list presentation

It should feel closer to lightweight change feeds in operational tools such as task history, page activity, or issue activity. It should not read like a developer security log in the portfolio demo. Full audit/security compliance remains a deeper launch-readiness scope.

## Empty, Loading, Error, And Validation UX

The empty clinic default makes state UX more important. Screens need simple, consistent handling for:

- no data yet
- no active daily work yet while master data exists
- loading without stale record flash
- permission denied
- network or API failure
- save failure
- duplicate patient or guardian detection
- already-processed order or invoice state
- validation errors before submit

Detailed visual design can be refined later. The first pass should establish reliable states and copy hooks so screens do not look broken when no work exists.

## Cross-Workflow State Consistency

Status must stay aligned across chart, fulfillment, and billing surfaces.

Examples:

- Completing a lab or treatment task should update the relevant chart/order state.
- Billing candidates should reflect order billing actions without showing stale completed/uncompleted state.
- Canceled or already-processed work should not remain actionable in another module.
- The home or operational dashboard should summarize current-day state from the same source as module queues.

This is more important than adding many pre-filled daily records.

## Search, Filter, And Performance Planning

The synthetic master dataset should be large enough to reveal real UX problems:

- dozens of patients and guardians
- enough staff records to exercise role filters
- many order categories, order catalog rows, and order sets to require search
- enough change-history rows to test timeline scanning

Search and filter quality should be checked for patient name, guardian name, phone, status, 담당자, order name, category, and date. Performance checks should cover initial load, screen transition, table rendering, and search/filter response time with the synthetic dataset loaded.

## QA And Demo Script Needs

The PRD/docs viewer should eventually expose scenario-level planning for epics, features, and QA scripts. For this data direction, the immediate QA scripts should cover:

- opening the empty clinic baseline
- creating a new reception/encounter from registered patient and guardian data
- creating or applying orders from existing catalog data
- completing fulfillment work and reading the status back in chart
- moving billable work into billing and completing payment
- verifying role-specific navigation and basic blocked actions
- resetting the clinic back to the empty seed through the operator/backend flow
- following a short demo script that 승욱 can use to click through and judge the flow

## Out Of Scope

- real patient, guardian, hospital, billing, identity, or payment data
- remote Supabase mutation or staging replay without explicit approval
- production deploy
- payment, email, KakaoTalk, PACS, device, accounting, or provider integration
- full production-grade RLS/security certification
- scenario replay implementation in the first pass
- automatic long-running calendar simulation before resettable baseline and date-history behavior are validated

## Changelog

- 2026-08-30: Removed the Cheongdam demo reset control from the global workspace topbar for every workspace while preserving the Cheongdam-only admin API, permission, RPC, and migration boundaries as an operator/backend capability.
- 2026-06-17: Updated the data-mode policy after owner direction: `workspace-clair-cheongdam` is the default seed-backed operating proof, while legacy `clair-demo` Sales Demo fixtures are cleanup candidates rather than preserved fallback requirements.
- 2026-06-16: Added DEN-507 Cheongdam synthetic demo session reset contract and implementation boundary. Reset is admin-only, Cheongdam-only, server/API-backed for Supabase, local-only in mock mode, and preserves Cheongdam seed master/config data while deleting daily-work, billing checkout flow state, and safely identified generated registration records. Staging replay/readback confirmed the synthetic reception/chart/fulfillment/billing marker was removed and seed guardians/patients stayed at 25/25.
- 2026-06-12: Added DEN-483 rework boundary for seeded patient/guardian usage in Cheongdam walk-in reception creation. The reception drawer now preserves a selected live lookup patient through the display-label re-search, so the generated walk-in payload keeps seeded patient and guardian IDs. Staging write-through creation remains approval-gated because it would create active daily work in the empty-clinic baseline.
- 2026-06-12: Added DEN-468/DEN-491 implementation boundary for Cheongdam work modules and shell surfaces. Home, chart, lab, imaging, dispensing/treatment, inpatient, billing, global command search, and global notification badge/drawer now use prepared empty-clinic states for `workspace-clair-cheongdam`, while staging has synthetic master data for staff, guardians, patients, service/order catalog, pricing, and order sets with zero active daily work.
- 2026-06-12: Added DEN-472/DEN-473 implementation boundary for Cheongdam reception loading/error/retry/empty hooks and workspace-aware session draft creation.
- 2026-06-12: Recorded implementation boundary for `workspace-clair-cheongdam` as the prepared empty-clinic default and `clair-demo` as the explicit legacy Sales Demo fixture path.

## Open Decisions

- Final demo workspace name: `CLAiR EMR 청담점`, `클레어동물의료센터 청담점`, or another synthetic hospital name.
- Whether real-time day progression is safe enough for the first implementation, or whether a fixed QA date plus reset should be used first.
- Whether scenario replay should be exposed in the UI, developer-only controls, or test helpers only after the first baseline is complete.
- How much of the existing audit page should be renamed/reframed versus replaced by a new `변경 이력` page.
