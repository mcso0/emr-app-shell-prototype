# Staging Pilot Readback and Reset Contract

Updated: 2026-05-21

## Purpose

This contract defines how agents verify the DEN-194 synthetic medium hospital dataset before staging pilot replay.

Use this only for the Supabase staging project `clair-emr-staging / qmerxgzrwaaahpkhjqlc` and workspace `clair-demo`.

## Readback Query

Run the read-only query in:

- `supabase/snippets/den-195_staging_synthetic_dataset_readback.sql`

The query returns one JSON payload with:

- workspace display name
- fixture count checks
- staff role checks
- scenario audit checks
- invoice total integrity checks
- duplicate key checks
- synthetic-only guard checks

Expected staff role counts:

| Role | Expected |
| --- | ---: |
| `hospital_admin` | 1 |
| `vet` | 3 |
| `technician` | 4 |
| `front_desk` | 3 |

Expected DEN-194 fixture counts:

| Fixture | Expected |
| --- | ---: |
| Guardians | 12 |
| Patients | 15 |
| Patient-guardian links | 15 |
| Consents | 5 |
| Appointments | 3 |
| Encounters | 5 |
| Waiting queue entries | 5 |
| Service categories | 2 |
| Service items | 9 |
| Service item prices | 9 |
| SOAP notes | 5 |
| Diagnoses | 5 |
| Order groups | 5 |
| Orders | 11 |
| Order events | 10 |
| Invoices | 5 |
| Invoice lines | 11 |
| Payments | 2 |
| Audit events | 5 |
| Patient staff assignments | 5 |

Expected scenario audit codes:

- `kong-vomit`
- `nabi-urinary`
- `bori-allergy`
- `mango-wellness`
- `choco-rehab`

## Pass Criteria

The dataset is replay-ready when all of the following are true:

- workspace display name is `CLAiR Medium Animal Hospital`
- every count check passes
- every staff role count passes
- every scenario audit code has exactly one audit event
- every `INV-DEN194-*` invoice total equals its invoice-line total
- duplicate checks for guardian code, patient number, and invoice number are zero
- synthetic guard checks for guardian names, guardian emails, and patient names are zero

## Reset and Repair Strategy

The DEN-194 seed is intended to be idempotent. It uses deterministic IDs and conflict handling so the normal replay reset path is:

1. Update `supabase/seed.sql` if the fixture contract changes.
2. Run `npx supabase db push --include-seed --dry-run`.
3. If the dry run is clean and the representative has approved remote staging seed work, run `npx supabase db push --include-seed` for initial staging apply.
4. Run `supabase/snippets/den-195_staging_synthetic_dataset_readback.sql`.
5. Treat any failed readback check as a seed repair issue, not as a direct production-style data mutation.

Supabase CLI behavior checked on 2026-05-21: when the remote schema is already up to date, `npx supabase db push --include-seed` can finish without re-running `supabase/seed.sql`. For an approved repeated rehearsal seed replay, use:

```sh
npx supabase db query --linked --file supabase/seed.sql --output json
npx supabase db query --linked --file supabase/snippets/den-195_staging_synthetic_dataset_readback.sql --output json
```

Avoid ad hoc direct SQL mutation for repair. Prefer a forward-fix to `supabase/seed.sql`, then re-run the approved seed replay path above. A destructive reset of the remote staging database needs separate explicit approval because it can interrupt shared rehearsal state.

## Boundaries

Allowed:

- read-only Supabase SQL inventory
- staging seed dry-run
- staging seed replay after approval
- synthetic fixture repair through `supabase/seed.sql`

Not allowed without separate approval:

- production database access
- real clinic, staff, guardian, patient, identity, or billing data
- direct SQL mutation outside the approved seed path
- project or branch creation that may create cost
- email, deploy, payment, provider, or external integration actions

## DEN-192 Replay Readiness

DEN-192 can start app-level pilot replay when this contract passes and the staging app/env readiness checks are also clear. This contract proves fixture availability; it does not prove that every application screen is live-wired to those fixtures.
