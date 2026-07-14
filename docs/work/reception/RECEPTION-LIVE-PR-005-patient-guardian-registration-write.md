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
updated: "2026-07-14"
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

## 2026-07-14 Follow-up: Live Registration Data Source Integrity

### Root Cause

- The unified registration modal read its existing guardians, patients, relationships, duplicate phone values, and duplicate microchips directly from the global client store.
- That store is initialized with bundled demo records for every workspace. In a Supabase session, the modal could therefore submit a demo ID such as `guardian-lee-jieun` to the UUID-backed registration RPC.
- Production logs confirmed the resulting PostgreSQL UUID cast failure. The API route and Supabase writer were connected; the fault was the modal's mixed live/demo read source.
- The shared lookup gateway also expanded Korean staging display aliases into synthetic seed queries. That behavior is useful for staging demos but is not acceptable as a registration identity source.

### Follow-up Scope and Result

- Existing-guardian registration now loads only the active workspace's patient/guardian lookup API records.
- Registration lookup requests set `syntheticAliases=false`; other lookup consumers preserve their existing default behavior.
- Guardian choices, linked-patient summaries, and same-name advisory warnings are derived only from the lookup response.
- Client-side phone and microchip duplicate checks no longer consult bundled demo data. The registration API and DB writer remain authoritative and the modal preserves the draft after a conflict.
- Loading, empty, read-error, and retry states are explicit in the existing-guardian picker.
- The Supabase registration gateway rejects non-UUID existing guardian IDs before invoking the RPC.
- Successful responses still update the client store so the newly registered profile is immediately available in the current UI session.

### Follow-up Verification

- Supabase registration/lookup server suites: 15 passed.
- Focused new/existing registration UI flows, live UUID payload, demo-data isolation, duplicate conflict draft preservation, and lookup retry coverage: passed.
- Focused ESLint, `npx tsc --noEmit`, and `npm run build`: passed.
- Remote staging aggregate check after rollback: 0 QA-pattern guardians, 0 QA-pattern patients, 0 guardians created today, and 0 patients created today.
- The pre-existing registration dialog title pixel assertion still fails on both this branch and the exact `origin/main` baseline because the shared dialog token currently renders 18px while the stale assertion expects 16px. This follow-up does not change shared dialog typography.

Plan and report:

- `docs/superpowers/plans/2026-07-14-reception-live-registration-data-source.md`
- `docs/completed/reception/2026-07-14-reception-live-registration-data-source-report.html`
