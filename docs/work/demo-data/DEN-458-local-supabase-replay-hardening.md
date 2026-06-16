---
id: "DEN-458"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-458"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
  - "supabase/config.toml"
  - "supabase/snippets/demo_seed_inventory_readback.sql"
dependencies:
  - "DEMO-DB-PR-005"
  - "DEN-457"
updated: "2026-06-11"
---

# Local Supabase Replay Hardening

## Goal

Make local Supabase reset/seed/readback replay easier to run and easier to diagnose without touching remote or production Supabase.

## Scope

- Add a local-only replay helper for the `clair-demo` seed readback path.
- Document the reset, seed, and readback commands.
- Separate environment gaps from seed/readback gaps.
- Add static contract coverage that prevents the helper from drifting into remote/prod commands.
- Record the current local machine diagnostic result.

## Out Of Scope

- Production Supabase work.
- Remote Supabase replay.
- New seed data or large seed expansion.
- UI functionality changes.
- DB schema, migration, or RLS changes.

## Done Criteria

- A new session can run a safe local diagnostic command before attempting reset/readback.
- The helper refuses non-local DB URLs.
- `psql`, Docker, Supabase CLI, and local DB reachability problems are reported as environment gaps.
- Seed contract failures remain distinguishable from environment/toolchain failures.
- Docs stay aligned with `docs/engineering/current-status.md` and the demo seed readback contract.

## Commands

```bash
npm run demo:seed:check
npx supabase start
npx supabase db reset --local
npm run demo:seed:check -- --readback
npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line
```

`npm run demo:seed:check` is diagnostics-only. `--readback` runs `supabase/snippets/demo_seed_inventory_readback.sql` through `psql` only when `SUPABASE_LOCAL_DB_URL` points to `localhost`, `127.0.0.1`, or `::1`.

## Current Diagnostic Result

On 2026-06-11, this workspace reported:

- Docker CLI installed.
- Docker daemon reachable.
- `supabase/config.toml` has `[db.seed] enabled = true` and `sql_paths = ["./seed.sql"]`.
- `SUPABASE_LOCAL_DB_URL` default is local-only.
- Global `supabase` CLI was not found in `PATH`.
- `psql` CLI was not found in `PATH`.
- `--readback` correctly stopped with `environment_gap: psql CLI is required for --readback`.

This means the immediate blocker is local toolchain setup, not a confirmed seed gap.

## Verification

- `npm run demo:seed:check`
- `npm run demo:seed:check -- --readback` expected blocked result in this environment because `psql` is missing
- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-458 adds `scripts/check-local-supabase-replay.mjs`, exposes it as `npm run demo:seed:check`, updates the seed readback contract, and adds static test coverage for local-only guardrails.
