---
id: ENGINEERING-AUTH-RECEPTION-DOMAIN-SCHEMA-MIGRATION
status: implemented
area: engineering
doc_type: data_model
related_work:
  - "DEN-56"
  - "docs/work/reception/RECEPTION-LIVE-PR-003-schema-migration.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Domain Schema Migration

Updated: 2026-05-19
Linear: DEN-56
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-56 implements the local-first database schema foundation for Project 03 reception persistence.

The migration is intentionally limited to the domain rows needed before live reception lookup and check-in work can begin: guardians, animal patients, guardian-patient relationships, consent rows, appointments, appointment change logs, encounters, and waiting queue entries.

Remote Supabase link/push, production deploy, real clinic data, and real patient data were not used.

## Migration

Migration file:

- `supabase/migrations/20260519090000_reception_domain_schema_foundation.sql`

Tables:

| Table | Purpose |
| --- | --- |
| `public.guardians` | Workspace-scoped guardian/customer records for reception lookup and minimal registration. |
| `public.patients` | Workspace-scoped animal patient records. |
| `public.patient_guardians` | Workspace-scoped guardian-patient relationship rows. |
| `public.consents` | Initial privacy, treatment, messaging, marketing, and related consent state. |
| `public.appointments` | Workspace-scoped appointment rows used by calendar and check-in. |
| `public.appointment_change_logs` | Appointment state transition log rows for reception operations. |
| `public.encounters` | The visit/care-work unit created by walk-in or appointment check-in. |
| `public.waiting_queue_entries` | Operational queue rows derived from encounters. |

## Constraints And Indexes

- Each domain table stores `workspace_id` directly for route and RLS filtering.
- Guardian, patient, appointment, encounter, and queue relationships include same-workspace composite foreign keys.
- Duplicate guards cover guardian normalized mobile phone, patient number, microchip number, patient registration number, primary guardian per patient, one appointment-linked encounter, encounter number, and one queue entry per encounter/queue type.
- Status columns use check constraints rather than unconstrained text.
- Lookup indexes cover guardian name/phone, patient name/status, appointment schedule/status, encounter status/check-in time, and queue status.
- Mutable tables reuse `public.clair_set_updated_at()`.

## RLS Posture

The migration enables RLS on all eight tables, but intentionally does not create domain policies in DEN-56.

Follow-up Project 03 work should keep route/server-owned access for readers and writers, then add explicit active-workspace-member read and reception-permission mutation policies in DEN-61 or an equivalent security issue.

## Seed Contract

`supabase/seed.sql` now includes a DEN-56 synthetic reception fixture:

- one guardian
- one patient
- one patient-guardian relationship
- privacy and messaging consent rows
- one appointment
- one walk-in encounter
- one consultation waiting queue row

The fixture is local-only and synthetic. Do not replace it with production guardian, patient, or clinic data.

## Verification Notes

Focused static migration coverage lives in `tests/reception-domain-schema-migration.spec.ts`.

Fresh verification:

- `npx playwright test tests/reception-domain-schema-migration.spec.ts --reporter=line` (`6 passed`)
- `npx tsc --noEmit`
- `npm run security:secrets` (`Secret scan passed. Checked 1160 tracked files.`)
- `npm run docs:check` (`Checked 348 docs/agent markdown files. Internal docs references look good.`)

The intended local DB replay command is:

```bash
npx supabase db reset --local
```

In this environment, `npx supabase db reset --local` could not run because the Docker daemon was unavailable:

```text
failed to inspect service: Cannot connect to the Docker daemon at unix:///Users/iseung-ug/.docker/run/docker.sock. Is the docker daemon running?
```

This means the static migration contract is covered, but SQL runtime replay still needs a Docker-backed local Supabase pass before remote/staging work.

## Follow-Up

DEN-57 added the first read boundary on top of this schema in `docs/engineering/auth-security/auth-login/reception-patient-guardian-lookup.md`.

DEN-58 added the minimal patient and guardian registration write boundary in `docs/engineering/auth-security/auth-login/reception-patient-guardian-registration-write.md`.

DEN-60 added the walk-in encounter creation transaction boundary in `docs/engineering/auth-security/auth-login/reception-walk-in-encounter-create.md`.

Next Project 03 work should continue with DEN-59, the appointment check-in to encounter transition boundary, while keeping remote Supabase and real data approval-gated.
