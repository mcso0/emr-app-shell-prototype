---
id: "RECEPTION-LIVE-PR-003"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-56"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md"
dependencies:
  - "RECEPTION-LIVE-PR-001"
  - "RECEPTION-LIVE-PR-002"
updated: "2026-05-19"
---

# Reception Domain Schema Migration

## Goal

Implement the local-first reception domain schema migration and synthetic seed/test contract required before Project 03 live lookup and check-in writes.

## Background

Reception persistence needs workspace-scoped patient, guardian, appointment, encounter, and queue tables before UI routes can safely read or write live domain data.

## Scope

- Add local-first migration tables for guardians, patients, patient relationships, consents, appointments, appointment change logs, encounters, and waiting queue entries.
- Add workspace scope, status checks, indexes, duplicate guards, and same-workspace relationship constraints.
- Enable RLS while leaving policy implementation to a follow-up security slice.
- Add synthetic seed fixture rows for local verification.
- Add focused static migration contract coverage.

## Out Of Scope

- Remote Supabase link/push or production deployment.
- Real patient, guardian, hospital, clinic, or staff data.
- Full customer management CRUD.
- Reception UI changes.
- DB-backed lookup repository and server route wiring.
- Walk-in or appointment check-in writes.
- Chart, order, billing, audit, messaging provider, file storage, or payment persistence.
- Final domain RLS policy implementation.

## Done When

- `supabase/migrations/20260519090000_reception_domain_schema_foundation.sql` defines the Project 03 reception domain schema foundation.
- `supabase/seed.sql` contains only synthetic reception domain fixture rows.
- `tests/reception-domain-schema-migration.spec.ts` covers table, RLS-enable, workspace, duplicate guard, status, index, cross-workspace FK, and seed contracts.
- Current status and work index point next Project 03 work to DEN-57.
- Korean HTML report exists for DEN-56.
- Linear DEN-56 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception-domain-schema-migration.spec.ts --reporter=line` (`6 passed`)
- `npx tsc --noEmit`
- `npm run security:secrets` (`Secret scan passed. Checked 1160 tracked files.`)
- `npm run docs:check` (`Checked 348 docs/agent markdown files. Internal docs references look good.`)
- `npx supabase db reset --local` could not run because Docker daemon was unavailable.

## Result

Human Review handoff: `docs/completed/reception/2026-05-19-den-56-reception-domain-schema-migration-report.html`.
