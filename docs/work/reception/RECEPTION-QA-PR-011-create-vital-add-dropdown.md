---
id: "RECEPTION-QA-PR-011"
type: "Work Item"
title: "Walk-in reception vital history capture"
description: "Capture optional walk-in vitals as patient measurement history and remove vitals from reservation creation."
status: "in_progress"
area: "reception"
priority: "P1"
tags:
  - "reception"
  - "walk-in"
  - "vitals"
  - "supabase"
target_pr: "Approved walk-in vital history design"
source_docs:
  - "docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md"
  - "docs/superpowers/plans/2026-07-14-reception-vital-add-dropdown-implementation.md"
  - "docs/design/screens/reception/planning/reception-vital-add-dropdown-prototype.html"
dependencies:
  - "RECEPTION-QA-PR-003"
  - "RECEPTION-LIVE-PR-006"
updated: "2026-07-14"
---

# Walk-In Reception Vital History Capture

## User Request Understanding

The initial wireframe covered reception and reservation creation as a UI-only interaction. Supabase MCP verification and product review changed the requirement:

- Reservation creation should not capture future vitals.
- Walk-in reception should persist entered values as patient vital measurement history.
- Blood pressure requires systolic and diastolic values.

## Scope

- Remove the vital section from reservation creation.
- Implement the approved add, remove, restore, spacing, unit, and focus behavior in walk-in creation.
- Add `public.patient_vital_measurements` as the source of truth for patient vital history.
- Store weight, temperature, respiratory rate, and systolic/diastolic blood pressure.
- Link each measurement to workspace, patient, newly created encounter, recording actor, and server-owned measurement time.
- Extend the walk-in API and RPC in one transaction.
- Continue updating `patients.weight_kg` when submitted weight is present.
- Add RLS, workspace ownership checks, indexes, validation, and focused regression coverage.

## Out Of Scope

- Reservation-time vital capture.
- History browsing, edit, or delete UI.
- Clinical thresholds and alerts.
- Heart-rate capture.
- Device integrations.
- Remote migration application or deployment without separate approval.
- Real patient, guardian, hospital, payment, identity, or provider data.

## Done When

- Supabase migration creates the workspace-scoped measurement table with required checks, RLS, and indexes.
- Walk-in creation atomically creates encounter, queue entry, and an optional measurement row.
- Submitted weight also updates the compatibility snapshot on `patients.weight_kg`.
- Reservation creation renders no vital section and sends no vital payload.
- The approved dropdown and row rules pass focused browser tests, including dual blood-pressure inputs.
- Server and migration tests prove workspace scope, validation, no-empty-row behavior, and rollback-safe RPC wiring.
- Local verification passes without touching the unrelated dirty registration-dialog file.

## Verified Evidence

- Supabase MCP staging schema inspection on 2026-07-14 found only `patients.weight_kg` and no vital-history table.
- Supabase MCP function inspection found appointment weight handling but no walk-in weight handling in the deployed staging function, confirming repository-to-staging drift that requires a new additive migration.
- No patient data rows were queried.

## Verification

- Implementation pending.
