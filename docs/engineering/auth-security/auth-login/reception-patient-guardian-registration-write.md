---
id: ENGINEERING-AUTH-RECEPTION-PATIENT-GUARDIAN-REGISTRATION-WRITE
status: implemented
area: engineering
doc_type: api_boundary
related_work:
  - "DEN-58"
  - "docs/work/reception/RECEPTION-LIVE-PR-005-patient-guardian-registration-write.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Patient Guardian Registration Write

Updated: 2026-05-19
Linear: DEN-58
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-58 adds the first route-owned write boundary for minimal reception patient and guardian registration.

The scope is intentionally narrow. It registers either a new guardian plus a new patient, or a new patient under an existing guardian. It does not create an encounter, check in an appointment, convert customer management to full CRUD, or touch remote Supabase.

## Boundary

Route:

- `POST /api/workspaces/[workspaceId]/reception/patient-guardian-registration`

Server modules:

- `src/features/reception/server-patient-guardian-registration.ts`
- `src/features/reception/server-patient-guardian-registration-core.ts`
- `src/features/reception/patient-guardian-registration.ts`

The route follows the Project 02 server mutation pattern:

1. Resolve actor identity with `readServerSession()`.
2. Allow demo actor headers only in mock fallback mode.
3. Apply `enforceWorkspaceMutationRateLimit(...)`.
4. Validate minimal guardian, patient, and consent input.
5. Check active workspace membership and `reception:create`.
6. In mock mode, use the local fallback writer.
7. In Supabase mode, call the local-first writer function.
8. Return typed `{ ok, status, registration, enforcedBy }` or stable denial/error values.

## DB Writer

Migration:

- `supabase/migrations/20260519110000_reception_patient_guardian_registration_writer.sql`

Function:

- `public.clair_register_reception_patient_guardian(p_workspace_id, p_actor_user_id, p_registration)`

The writer:

- requires `private.clair_is_active_workspace_member(p_workspace_id)`
- inserts `guardians` only for `new_guardian_patient`
- inserts `patients`
- inserts the primary `patient_guardians` link
- inserts guardian-level `privacy` consent and optional `marketing` consent for new guardians
- blocks duplicate guardian normalized mobile phone, microchip number, and patient registration number with stable error names
- returns camelCase JSON for the Next.js route adapter

## UI Connection

The reception `환자/보호자 등록` dialog now submits through the server route on final `등록`.

On success, the returned persisted-shaped rows are merged into the local profile store so existing demo UX remains immediate. This keeps mock fallback and Sales Demo behavior available while moving the write decision behind the server boundary.

## Out Of Scope

- Encounter creation
- Appointment check-in mutation
- Customer management full CRUD
- Advanced duplicate merge
- Marketing, Kakao, SMS, email, or storage provider integration
- Final domain RLS policy SQL
- Remote Supabase link/push
- Real patient, guardian, hospital, clinic, or staff data

## Verification

- `npx playwright test tests/reception-patient-guardian-registration-server.spec.ts --reporter=line`: 6 passed
- `npx playwright test tests/reception.spec.ts -g "patient guardian registration creates|server-backed patient guardian registration" --reporter=line`: 2 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 23 passed
- `npx playwright test tests/workspace-rate-limit-server.spec.ts -g "shared rate limit boundary" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 352 docs/agent markdown files

`npx supabase db reset --local` could not run because the Docker daemon was unavailable. Remote Supabase was not linked, pushed, queried, or modified.

Full final verification is recorded in the DEN-58 report:

- `docs/completed/reception/2026-05-19-den-58-reception-patient-guardian-registration-write-report.html`
