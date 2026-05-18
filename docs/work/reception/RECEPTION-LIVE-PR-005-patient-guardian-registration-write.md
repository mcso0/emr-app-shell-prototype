---
id: "RECEPTION-LIVE-PR-005"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-58"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/reception-patient-guardian-lookup.md"
dependencies:
  - "RECEPTION-LIVE-PR-004"
updated: "2026-05-19"
---

# Reception Patient Guardian Registration Write

## Goal

Persist the minimum new patient and guardian registration path needed before reception encounter writes.

## Background

DEN-57 added the patient/guardian lookup read boundary. Reception also needs a route-owned write boundary for registering a new guardian plus patient, or adding a new patient under an existing guardian, before walk-in encounter creation can become live.

## Scope

- Add a server-owned registration route under the workspace reception scope.
- Add writer gateway boundaries for mock fallback and Supabase mode.
- Add local-first DB writer SQL for minimal registration.
- Connect the reception registration dialog submit path to the route while preserving immediate local demo UX.
- Validate required guardian, patient, consent, duplicate phone, microchip, and registration-number behavior.
- Enforce active workspace membership and `reception:create` before writes.

## Out Of Scope

- Encounter creation or appointment check-in mutation.
- Customer management full CRUD.
- Marketing, Kakao, SMS, email, or storage provider integration.
- Advanced duplicate merge.
- Final domain RLS policy SQL.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- `POST /api/workspaces/[workspaceId]/reception/patient-guardian-registration` exists and returns typed created rows.
- Mock fallback and Supabase writer are separated.
- Workspace membership and `reception:create` are enforced before registration.
- The registration dialog calls the server route and only commits local UI state from a successful route response.
- Korean HTML report exists for DEN-58.
- Linear DEN-58 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception-patient-guardian-registration-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/reception.spec.ts -g "patient guardian registration creates|server-backed patient guardian registration" --reporter=line`: 2 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 23 passed
- `npx playwright test tests/workspace-rate-limit-server.spec.ts -g "shared rate limit boundary" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 352 docs/agent markdown files
- `npx supabase db reset --local`: could not run because Docker daemon was unavailable.

## Result

Ready for Human Review.

Report:

- `docs/completed/reception/2026-05-19-den-58-reception-patient-guardian-registration-write-report.html`
