---
id: "RECEPTION-LIVE-PR-004"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-57"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/reception-patient-guardian-lookup.md"
dependencies:
  - "RECEPTION-LIVE-PR-003"
updated: "2026-05-19"
---

# Reception Patient Guardian Lookup

## Goal

Add the DB-backed patient and guardian lookup repository/API boundary needed before reception live writes.

## Background

The walk-in/check-in flow needs a persisted lookup source for patient and guardian selection. Existing UI data is mock/session-centered, so DEN-57 introduces the read boundary while preserving fallback behavior.

## Scope

- Add a server-owned lookup route under the workspace scope.
- Add repository/gateway boundaries for mock fallback and Supabase mode.
- Add local-first DB reader SQL for patient/guardian search.
- Connect the walk-in reception dialog search state to the lookup route.
- Cover workspace membership, route ownership, DB reader shape, loading/error/empty UI states, and fallback behavior.

## Out Of Scope

- New patient/guardian live write.
- Customer management full CRUD.
- Encounter creation or appointment check-in mutation.
- Chart, order, billing, audit, messaging, file storage, or payment persistence.
- Final domain RLS policy SQL.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup` exists and returns typed lookup rows.
- Mock fallback and Supabase gateway are separated.
- Workspace membership and `patient:view` are enforced before lookup.
- Walk-in dialog exposes loading, empty, error, and success lookup states.
- Korean HTML report exists for DEN-57.
- Linear DEN-57 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception-patient-guardian-lookup-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/reception.spec.ts -g "DB-backed patient lookup" --reporter=line`: 1 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 22 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 350 docs/agent markdown files
- `npx supabase db reset --local`: could not run because Docker daemon was unavailable.

## Result

Ready for Human Review.

Report:

- `docs/completed/reception/2026-05-19-den-57-reception-patient-guardian-lookup-report.html`
