---
id: "RECEPTION-LIVE-PR-002"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-55"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
dependencies:
  - "RECEPTION-LIVE-PR-001"
updated: "2026-05-19"
---

# Reception Domain Schema Extension Plan

## Goal

Plan the minimal schema extension needed for reception persistence before implementing a migration.

## Background

Workspace auth schema alone cannot store reception domain data. Project 03 needs patient, guardian, appointment, encounter, and queue tables scoped to workspace and compatible with future RLS/server enforcement.

## Scope

- Propose minimum reception domain tables.
- Define workspace id, identifiers, consent fields, status enum values, indexes, and duplicate guards.
- Document mock domain to DB column mapping.
- Split RLS/server enforcement into follow-up issues.
- Record privacy and consent open questions.

## Out Of Scope

- Migration implementation.
- UI changes.
- Full customer management persistence.
- Remote Supabase push/link.
- Real patient, hospital, or clinic data.
- Chart, order, billing, audit, messaging provider, or payment persistence.

## Done When

- `docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md` is ready for DEN-56 implementation.
- Current status and work index point next work to DEN-56.
- Korean HTML report exists for DEN-55.
- Linear DEN-55 is commented and moved to Human Review.

## Verification

- `npm run docs:check`

## Result

Human Review handoff: `docs/completed/reception/2026-05-19-den-55-reception-schema-extension-plan-report.html`.
