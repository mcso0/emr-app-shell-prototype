---
id: "RECEPTION-LIVE-PR-001"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-54"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/product/features/reception-appointment-spec.md"
dependencies:
  - "Project 02 Workspace & Membership Live Persistence"
updated: "2026-05-18"
---

# Reception Encounter Persistence Contract

## Goal

Confirm the reception/appointment live persistence scope and encounter data contract before implementing Project 03.

## Background

The first clinical live persistence boundary is the encounter created at walk-in check-in or appointment check-in. Chart, order, and billing persistence need a stable encounter contract before they can safely start.

## Scope

- Define when encounters are created.
- Define required encounter fields and schema-extension candidates.
- Map patient, guardian, appointment, membership, permission, and queue dependencies.
- Preserve local mock/session fallback and sales demo behavior.
- Define handoff fields for chart, order, and billing persistence.

## Out Of Scope

- Code implementation.
- Remote Supabase push/link or production deployment.
- Real patient, guardian, hospital, or staff data.
- Full customer management CRUD.
- Chart/SOAP, order, billing, audit, no-show automation, and external messaging provider persistence.

## Done When

- `docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md` is the Project 03 contract source.
- `docs/engineering/current-status.md` points the next work to DEN-55/DEN-56 order instead of Project 02 review.
- A Korean HTML report exists for DEN-54.
- Linear DEN-54 is commented and moved to Human Review.

## Verification

- `npm run docs:check`

## Result

Human Review handoff: `docs/completed/reception/2026-05-18-den-54-reception-encounter-contract-report.html`.
