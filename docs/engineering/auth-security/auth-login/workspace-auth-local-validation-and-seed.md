# Workspace Auth Local Validation And Seed

Updated: 2026-10-17
Linear: DEN-35

This document defines how to validate the workspace auth migration locally and what seed data later tests may rely on.

## Prerequisites

- Supabase CLI: `npx supabase --version`
- Docker available on the machine. This environment did not have `docker`, so local database apply could not be completed here.
- No remote Supabase project should be linked, pushed, or mutated for this Project 01 local-first gate.

## Local Validation Commands

Use these commands from the repo root:

```bash
npx supabase start
npx supabase db reset --local
npx supabase migration list --local
npx supabase db lint --local --schema public,auth
npm run docs:check
```

If only the local Postgres service is needed, use:

```bash
npx supabase db start
npx supabase db reset --local
```

## Reset And Rollback

For a clean local replay of migrations and seed data:

```bash
npx supabase db reset --local
```

To stop local containers while keeping data volumes:

```bash
npx supabase stop
```

To discard local Supabase data volumes after stopping:

```bash
npx supabase stop --no-backup
```

Do not use `--linked`, `db push`, or remote project credentials unless 승욱 explicitly approves a remote gate.

## Seed Contract

The stable seed file is `supabase/seed.sql`. It creates one local workspace and four deterministic users/memberships:

Seed identities remain deterministic, but new authentication passwords are random and are not printed. Replaying seed/backfill SQL preserves existing passwords. After a local reset, set a private password explicitly for the existing 28 synthetic subjects:

```bash
# Enter privately in the terminal; do not paste the value into chat or commit it.
read -r -s CLAIR_SYNTHETIC_AUTH_PASSWORD
export CLAIR_SYNTHETIC_AUTH_PASSWORD
npm run demo:password:local
unset CLAIR_SYNTHETIC_AUTH_PASSWORD
```

This helper reads local CLI status, accepts only the loopback API on port54321, rejects redirects and hosted endpoints, and never prints or saves credentials. Use a private 16–72 character value. Existing real-auth QA scripts accept the same environment variable. Hosted account password changes are a separate administrator action; do not reuse this local helper remotely.

| Email | User ID suffix | Role |
| --- | --- | --- |
| `admin@clair.local` | `0001` | `hospital_admin` |
| `vet@clair.local` | `0002` | `vet` |
| `technician@clair.local` | `0003` | `technician` |
| `front-desk@clair.local` | `0004` | `front_desk` |

Seeded workspace:

- `workspace_id`: `clair-demo`
- `display_name`: `CLAiR Demo Hospital`
- creator membership: `hospital_admin`

Seeded permission policy rows:

- `hospital_admin`: full workspace/admin access represented by `["*"]`
- `vet`: clinical and read-heavy operational MVP access
- `technician`: support workflow access, including order/lab/imaging operational updates
- `front_desk`: reception/customer/billing issue access

## Legacy Role Compatibility

Canonical MVP roles remain `hospital_admin`, `vet`, `technician`, and `front_desk`.

Compatibility direction:

- `nurse -> technician`
- `billing_admin -> hospital_admin`

The seed contract does not create `nurse` or `billing_admin` memberships. Existing mock/UI compatibility may still display those legacy roles until later implementation reconciles all seed and UI references.

## Current Verification Result

Completed here:

- `npx supabase --version` returned `2.98.2` through `npx`.
- `npx supabase db reset --help`, `npx supabase db lint --help`, and `npx supabase stop --help` were checked.
- `npx playwright test tests/workspace-auth-seed-contract.spec.ts --reporter=line` passed after seed/doc creation.
- `npm run docs:check` passed.

Blocked here:

- `docker` command was not available.
- `npx supabase migration list --local` failed because local Postgres at `127.0.0.1:54322` was not running.

## Next Step

DEN-36 can use this seed as the local DB contract for DB-level last-admin protection foundation. A future environment with Docker should run the local Supabase reset/lint commands before treating the migration as fully applied.
