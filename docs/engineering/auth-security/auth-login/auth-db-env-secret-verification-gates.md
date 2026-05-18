# Auth DB Environment, Secret Handling, and Verification Gates

Updated: 2026-05-18
Linear: DEN-30

This document defines the environment variable matrix, secret-handling rules, and verification gates for Project 01 after the DEN-29 local-first execution decision.

## Executive Decision

Keep the application default safe for local/demo work:

- `NEXT_PUBLIC_AUTH_MODE` defaults to `auto`.
- If Supabase public env is missing in `auto`, the app falls back to mock/local demo auth.
- Playwright workspace regression stays pinned to `NEXT_PUBLIC_AUTH_MODE=mock`.
- Secret or elevated Supabase keys are never required for browser auth, regular app UI, or mock fallback tests.

Project 01 may use local Supabase generated values for local validation, but must not store real remote secrets in repo files or expose elevated credentials to client-bundled code.

## Current Repo Env Usage

Checked on 2026-05-18:

- `src/lib/supabase/config.ts` reads:
  - `NEXT_PUBLIC_AUTH_MODE`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `playwright.config.ts` sets:
  - `NEXT_PUBLIC_AUTH_MODE=mock`
- No `.env*` file is currently present in the repo root.
- Tests guard against `service_role`, `SECRET`, or `SUPABASE_SECRET` appearing in the Supabase public config source.

## Environment Matrix

### Public, Browser-Safe

These can be used in `NEXT_PUBLIC_` env because they may be bundled into browser JavaScript.

| Env | Required for mock | Required for Supabase mode | Exposure | Rule |
| --- | ---: | ---: | --- | --- |
| `NEXT_PUBLIC_AUTH_MODE` | No | Recommended | Browser | Allowed values: `mock`, `supabase`, `auto`. Missing means `auto`. |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Yes | Browser | Public project URL only. No passwords or tokens. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Yes | Browser | Prefer modern `sb_publishable_...` key. Legacy `anon` is compatibility only. |

Mode behavior:

| Mode | Behavior |
| --- | --- |
| `mock` | Always use mock/local demo auth. |
| `auto` with missing Supabase public env | Use mock/local demo auth. |
| `auto` with Supabase public env present | Use Supabase provider adapter. |
| `supabase` with missing Supabase public env | Show provider configuration error rather than silently authenticating live. |
| `supabase` with Supabase public env present | Use Supabase provider adapter. |

### Server-Only / Secret

These must not be prefixed with `NEXT_PUBLIC_`, imported into Client Components, logged, pasted into Linear, committed to repo, or passed through URLs/query params.

| Secret | Use | Allowed in Project 01 by default |
| --- | --- | ---: |
| Supabase secret key `sb_secret_...` | Elevated backend/admin access, bypasses RLS | No, representative gate required |
| Legacy `service_role` key | Elevated backend/admin access, bypasses RLS | No, representative gate required |
| Database password | Direct DB/admin access | No, representative gate required |
| Postgres connection string | Server/admin migration or verification path | Local only unless representative gate approved |
| JWT secret | Platform/auth internals | No |
| Supabase CLI personal access token | CLI access to Management API | Local credential store or CI secret only |
| OAuth client secret | Future provider setup | No, out of scope |

### Local-Only Values

Local Supabase may generate local API URLs and keys during `supabase start`. These are allowed only for local validation and must not be copied into source docs as real project credentials.

Allowed local handling:

- Use local generated values in a developer-owned `.env.local`.
- Use ephemeral terminal env when running a local verification command.
- Use local test seed values that are clearly fake.

Not allowed:

- Commit `.env.local`.
- Paste real remote keys into docs, Linear, chat, logs, screenshots, or test snapshots.
- Use local generated values as if they prove staging/production readiness.

## Next.js Environment Rules

Next.js loads `.env*` files from the project root, not from `src/`.

Important rules for this repo:

- `.env*` files should remain uncommitted unless a future `.env.example` is intentionally added with placeholder-only values.
- Any `NEXT_PUBLIC_` value can be inlined into browser JavaScript at build time.
- Non-`NEXT_PUBLIC_` env values are server-only by default, but only if they are not imported into client-bundled modules.
- Public env values can be frozen at build time, so Supabase public env must be correct at build/deploy time for that environment.
- Tests should keep deterministic mock auth defaults. Do not rely on `.env.local` for CI Playwright behavior.

## Secret Handling Rules

1. Prefer publishable keys for browser/client Supabase Auth.
2. Never use secret or `service_role` keys in browser, Client Components, client-bundled shared modules, public docs, URLs, or query params.
3. Do not log real keys. If a key must be identified in a server-only security review, store a hash or at most a short non-sensitive label, not the key.
4. Do not test suspected secrets against live services.
5. Do not add remote credentials to `.env`, `.env.local`, `.env.test`, screenshots, Linear comments, or HTML reports.
6. Store remote secrets only in the user's secret manager, deployment provider secrets, CI secrets, or Supabase dashboard/CLI secure credential store.
7. Any use of `sb_secret_...`, legacy `service_role`, database password, or remote connection string requires explicit representative approval naming the target environment and operation.

## Verification Gates

### Gate 0: Docs/Readiness Gate

Use for DEN-29 and DEN-30.

Required:

- `npm run docs:check`
- Confirm no real `.env*` files are introduced.
- Confirm docs separate public env from secret/server-only env.
- Confirm Project 02 remains untouched.

### Gate 1: Mock Regression Gate

Use whenever auth code changes but the work must preserve local demo behavior.

Required:

- `NEXT_PUBLIC_AUTH_MODE=mock` behavior remains explicit in Playwright config or command env.
- `npx playwright test tests/auth.spec.ts --reporter=line`
- If shell/workspace behavior changes, add `tests/app-shell.spec.ts`.

### Gate 2: Server Session Contract Gate

Use for DEN-31 through DEN-33.

Required:

- Unit/contract tests for session reader states:
  - verified session user
  - no session
  - misconfigured Supabase mode
  - mock fallback mode
- Confirm server code does not trust `getSession()` alone for sensitive authorization.
- Confirm demo identity headers remain test/demo-only or are removed from live paths.
- Run:
  - `npm run lint -- --ignore-pattern '.worktrees/**'`
  - `npx tsc --noEmit`
  - targeted auth/server tests

### Gate 3: Local Migration/RLS Gate

Use for DEN-34 through DEN-39 when migrations/RLS are added.

Required:

- `supabase --version`
- `supabase --help` and relevant command-specific `--help` checked before command use.
- Migration file created with `supabase migration new <descriptive-name>`.
- Local stack started only against local project directory.
- Local migration apply/reset path documented in the issue report.
- RLS enabled for protected exposed-schema tables.
- Explicit grants/exposure decisions documented separately from RLS policies.
- Tests cover:
  - unauthenticated denial
  - missing membership denial
  - inactive/pending membership denial
  - cross-workspace denial
  - active member allowed path
  - `hospital_admin` admin path
  - last active `hospital_admin` protection where relevant

### Gate 4: Remote Staging Gate

Not active by default.

Requires explicit representative approval before use.

Required before execution:

- Target Supabase project named.
- Allowed operations listed.
- Backup/restore or forward-fix expectation documented.
- Secret handling path documented.
- RLS/grant verification plan documented.
- Post-change verification and rollback/stop conditions documented.

### Gate 5: Production/Live Gate

Out of scope for Project 01 by default.

Production/live project mutation requires a separate launch/deployment issue and explicit representative approval.

## Playwright Mock Regression Policy

The current Playwright config pins `NEXT_PUBLIC_AUTH_MODE=mock` in the dev server env. Keep this behavior unless an issue explicitly tests Supabase mode.

For Project 01:

- Existing sales demo and mock workspace regression must remain deterministic.
- Supabase mode tests should be targeted and opt-in.
- Do not make the default Playwright suite depend on real Supabase env.
- Do not put remote Supabase env in CI unless the issue and representative gate explicitly approve it.

## Issue Handoff Rules

Every Project 01 issue after DEN-30 should state:

- Which gate applies.
- Whether it needs local Supabase.
- Whether it needs remote Supabase approval.
- Which env values are public vs server-only.
- Which commands were run.
- Which out-of-scope items were preserved.

## Explicit Non-Goals for DEN-30

- No secret creation or storage.
- No `.env*` file creation with real values.
- No Supabase dashboard or project setting change.
- No migration/RLS implementation.
- No product code change.
- No Project 02 work.
