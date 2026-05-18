---
id: ENGINEERING-AUTH-RECEPTION-PATIENT-GUARDIAN-LOOKUP
status: implemented
area: engineering
doc_type: api_boundary
related_work:
  - "DEN-57"
  - "docs/work/reception/RECEPTION-LIVE-PR-004-patient-guardian-lookup.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Patient Guardian Lookup

Updated: 2026-05-19
Linear: DEN-57
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-57 adds the first DB-backed reception lookup boundary for patient and guardian selection.

The lookup is intentionally read-only. It supports the walk-in reception dialog before live encounter writes, keeps mock fallback behavior for local demo use, and keeps remote Supabase and real data approval-gated.

## Boundary

Route:

- `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup?query=<text>`

Server modules:

- `src/features/reception/server-patient-guardian-lookup.ts`
- `src/features/reception/server-patient-guardian-lookup-core.ts`
- `src/features/reception/patient-guardian-lookup.ts`

The route follows the Project 02 server route pattern:

1. Resolve actor identity with `readServerSession()`.
2. Allow demo actor headers only in mock fallback mode.
3. Check active workspace membership and `patient:view`.
4. In mock mode, return filtered mock patients/guardians.
5. In Supabase mode, call the local-first reader function.
6. Return typed `{ ok, patients, enforcedBy }` or stable denial/error values.

## DB Reader

Migration:

- `supabase/migrations/20260519100000_reception_patient_guardian_lookup_reader.sql`

Function:

- `public.clair_search_reception_patient_guardian_lookup(p_workspace_id, p_query, p_limit)`

The reader:

- filters by `patients.workspace_id = p_workspace_id`
- requires `private.clair_is_active_workspace_member(p_workspace_id)`
- returns active patients only
- includes the primary guardian when available
- searches patient name, patient number, breed, microchip, registration number, guardian name, and guardian phone fields
- returns camelCase JSON for the Next.js route adapter

## UI Connection

The walk-in reception dialog now has a separate search input above the patient select.

States:

- empty query: existing local/session patient list
- loading: `DB 환자 검색 중입니다.`
- success: `DB 검색 결과 N건`
- empty result: `검색 결과가 없습니다.`
- error: `환자 검색을 불러오지 못했습니다.`

Existing mock/session registration and Sales Demo behavior remain available.

## Out Of Scope

- New patient/guardian live write
- Encounter creation
- Customer management full CRUD
- Final domain RLS policy SQL
- Remote Supabase link/push
- Real patient, guardian, hospital, clinic, or staff data

## Verification

- `npx playwright test tests/reception-patient-guardian-lookup-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/reception.spec.ts -g "DB-backed patient lookup" --reporter=line`: 1 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 22 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 350 docs/agent markdown files

`npx supabase db reset --local` could not run because the Docker daemon was unavailable. Remote Supabase was not linked, pushed, queried, or modified.

Full final verification is recorded in the DEN-57 report:

- `docs/completed/reception/2026-05-19-den-57-reception-patient-guardian-lookup-report.html`
