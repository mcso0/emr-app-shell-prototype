# Live Supabase Readiness and Execution Mode

Updated: 2026-06-17
Linear: DEN-29

This document fixes the execution mode for `01 Live Auth & Supabase DB/RLS Foundation` before any migration, RLS, live Supabase, or server-session implementation work begins.

## Executive Decision

Use **local-first Supabase validation** as the default execution mode for Project 01.

Project 01 may implement and verify migration/RLS/server-session work against a local Supabase stack first. Live Supabase project changes require a separate explicit representative approval gate before any remote link, push, SQL execution, dashboard change, or project secret use.

This means:

- DEN-29 and DEN-30 are planning/readiness gates.
- DEN-31 through DEN-39 may proceed only inside the scoped issue and verification mode stated by the relevant issue.
- Live remote changes are not implied by "Project 01 approval."
- Project 02 must not start until Project 01 is reviewed and handed off.

## Why Local-First

The current product is still a session-only frontend prototype with a Supabase provider adapter behind `useAuthClient()`. The missing product-grade pieces are live DB/API persistence, verified server session use, migrations, RLS, DB-backed permission resolution, and server enforcement.

Local-first execution reduces blast radius while those boundaries are designed and tested. At the time of DEN-29, that meant not broadening the Supabase foundation work into demo fallback cleanup. As of 2026-06-17, Cheongdam seed verification is the current operating proof, and DEMO-DATA-PR-002 owns legacy Sales Demo fallback migration or removal.

## Current Supabase Constraints Checked

Checked on 2026-05-18:

- Supabase local development requires the Supabase CLI and a Docker-compatible container runtime. The official quickstart initializes with `supabase init` and starts the local stack with `supabase start`.
- The Supabase CLI manages local development, migrations, and project deployment. CLI commands should be discovered with `supabase --help` and command-specific `--help` before use.
- Migration files should be created with `supabase migration new <name>` and applied locally with `supabase migration up` or local reset flows, depending on the issue.
- Supabase publishable keys are safe for public clients, but secret keys and legacy `service_role` keys are elevated and must never be exposed in browser code, public docs, chat, URLs, logs, or client bundles.
- Publishable-key access is not security by itself. Protected data still needs RLS and careful policy review for `anon` and `authenticated` roles.
- Service keys bypass RLS and are allowed only for secure server/admin tasks, never browser use.
- RLS is the database row boundary. Project 01 must not treat client-only role labels, local storage, request query params, or user-editable metadata as authorization sources.
- Starting May 30, 2026, new Supabase projects default to requiring explicit grants before new `public` schema tables are exposed to the Data API. Migration planning must treat grants/exposure and RLS as separate review layers.
- Supabase RLS Tester is available as a feature preview and should be considered during RLS verification, while noting current limitations such as SELECT-only testing.

References:

- https://supabase.com/docs/guides/local-development
- https://supabase.com/docs/reference/cli/introduction
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- https://supabase.com/changelog/45233-feature-preview-rls-tester

## Execution Modes

### Mode A: Docs and Readiness Only

Allowed:

- Read current repo docs and official Supabase/Next.js docs.
- Define environment variables, verification gates, rollback expectations, and approval gates.
- Update source docs, work items, closeout reports, and Linear comments/status.

Not allowed:

- Code changes.
- Package changes.
- Migration files.
- RLS SQL.
- Supabase CLI operations that mutate local or remote state.
- Remote Supabase project access.

Use for:

- DEN-29.
- DEN-30 unless the issue is explicitly narrowed to local env/config verification.

### Mode B: Local Supabase Implementation and Verification

Allowed only when the active Linear issue scopes it:

- Add migration SQL files.
- Add server-session contracts or DB-backed adapters.
- Start local Supabase with `supabase start`.
- Apply or reset local migrations.
- Run local SQL/RLS tests.
- Use local generated keys and local Supabase URLs for verification.

Not allowed:

- `supabase link` to a remote project.
- `supabase db push` to a remote project.
- Running SQL against live/staging/production Supabase projects.
- Saving real secrets into repo files.
- Treating local pass as production readiness.

Use for:

- DEN-31 through DEN-39 when each issue's scope allows the relevant implementation work.

### Mode C: Remote Supabase Staging Validation

Allowed only after explicit representative approval:

- Link to a non-production Supabase project.
- Apply migrations to staging.
- Validate grants, RLS, server session behavior, and API access in staging.
- Run Supabase advisors and RLS Tester against staging where available.

Required before entering:

- Representative approval naming the target project and allowed operations.
- Backup/restore expectation documented for the target project.
- Secret handling plan documented in DEN-30 or a follow-up.
- Clear rollback/forward-fix plan.

Not allowed:

- Production project changes.
- Broad data import.
- Real customer data.
- Payment/email/external provider rollout.

### Mode D: Production/Live Project Change

Not allowed in Project 01 by default.

Production or customer-facing Supabase changes require a separate launch/deployment issue, named target environment, explicit approval, backup confirmation, rollback plan, and post-change verification.

## Environment and Secret Boundary

Public browser-safe env:

| Env | Purpose | Rule |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public, browser-safe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Public, browser-safe |
| `NEXT_PUBLIC_AUTH_MODE` | `mock`, `supabase`, or `auto` | Public mode switch |

Secret/server-only values:

| Secret | Rule |
| --- | --- |
| Supabase secret key / legacy `service_role` key | Never expose to browser, chat, docs, logs, or repo |
| Database password / connection string | Server/admin only; never `NEXT_PUBLIC_` |
| JWT secret | Never used in app/client code |
| Personal access token / Supabase CLI token | Local secure credential store or CI secret only |

Project 01 must keep `NEXT_PUBLIC_AUTH_MODE=mock` or `auto` mock fallback working for local demo and Playwright regression unless a specific issue intentionally tests Supabase mode.

## Migration and RLS Application Policy

For local work:

1. Check CLI availability with `supabase --version`.
2. Discover commands with `supabase --help` and command-specific `--help`.
3. Create migrations with `supabase migration new <descriptive-name>`.
4. Apply only to local stack unless a remote gate is explicitly approved.
5. Keep migration SQL reviewable, deterministic, and scoped to the active issue.
6. Include explicit grants/exposure decisions where Data API access is intended.
7. Enable RLS on protected exposed-schema tables.
8. Add policies that match the workspace/membership access model.
9. Verify unauthenticated denial, missing membership denial, inactive membership denial, cross-workspace denial, and allowed active-member cases.

For remote work:

- Remote migration application is not covered by this readiness gate.
- Remote operations must be proposed as a separate representative-approved gate.

Rollback expectation:

- Local rollback can use reset/recreate workflows because local data is disposable.
- Remote rollback should prefer forward-fix migrations unless a documented backup/restore decision exists.
- Project 01 must not promise one-click production rollback.

## Approval Gates

Representative approval is required before:

- Linking the repo to any remote Supabase project.
- Running any SQL against remote Supabase.
- Applying migrations to staging or production.
- Using secret/service-role credentials.
- Changing role/permission policy beyond the approved canonical MVP roles.
- Removing mock/local fallback.
- Starting Project 02 work.

Project 01 can continue locally through its issues only while these gates are respected.

## Project 01 Issue Order

1. DEN-29: Confirm local-first execution mode and gates.
2. DEN-30: Define env, secret handling, and verification gates.
3. DEN-31: Add server-side Supabase session reader contract.
4. DEN-32: Replace role update demo identity header with verified session seam.
5. DEN-33: Harden auth guard and session regression for server session mode.
6. DEN-34: Draft workspace auth schema migration.
7. DEN-35: Add local migration validation and auth seed contract.
8. DEN-36: Implement DB-level last-admin protection foundation.
9. DEN-37: Implement workspace membership RLS policy baseline.
10. DEN-38: Connect permission resolver to DB-backed membership adapter.
11. DEN-39: Add server and RLS regression tests for cross-workspace denial.
12. DEN-40: Security review live auth DB and RLS foundation.
13. DEN-41: Produce Workspace Persistence handoff and project closeout.

## Explicit Non-Goals for DEN-29

- No code implementation.
- No package install.
- No migration creation or application.
- No RLS SQL.
- No live Supabase project change.
- No product UI change.
- No Project 02 work.

## Decision Summary for Representative

Recommended execution mode:

> Proceed with Project 01 using local-first Supabase validation. Treat remote Supabase staging/live changes as separate approval gates. Do not start Project 02 until Project 01 reaches handoff review.

This keeps Project 01 moving while preventing accidental live project mutation or scope expansion.
