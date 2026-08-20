---
id: "CLINICAL-MASTER-PR-001"
status: "human_review"
area: "clinical-master"
priority: "P0"
target_pr: "A1 local synthetic reset/replay/ACL/RLS/two-session gates PASS; Sol APPROVE/MUST-FIX 0; local-only human review"
updated: "2026-08-20"
---

# Clinical Master Phase 1A-1: Private Master Foundation

## Status and gate

The A1 local synthetic reset/replay, rollback, role/privilege, RLS/ACL, and
two-session concurrency gates PASS. Independent Sol review is `APPROVE` with
`MUST-FIX 0`. This work item remains `human_review` pending human acceptance;
the evidence is local synthetic only, with no remote Supabase, real data,
production, deployment, commit, push, PR, or external write.

## Intent

Create the first private PostgreSQL clinical-master foundation and prove that a
validated synthetic release publishes atomically, retries idempotently, and
rejects invalid data without changing workspace runtime behavior.

The PostgreSQL publisher is the only fingerprint authority. The TypeScript core
only validates and normalizes a payload before handing it to a server-owned
executor; it does not calculate or persist a release fingerprint.

## Scope

Included: private `master` schema, releases, records, names, sources, versions,
review events, X/T/A categories, CG/NT paths, the smallest dog/cat vocabulary,
canonical atomic orders, the server-only validation seam, and local synthetic
replay evidence.

Excluded: workspace catalog adoption, `public.order_catalog_items`, chart,
fulfillment, billing, `service_*`, Order Set runtime, lab 1B tables, remote
Supabase, real data, deployment, commit, push, and PR operations.

## Integrity contract

- Release fingerprints are server-generated SHA-256 values over PostgreSQL's
  canonical JSON serialization. A transaction advisory lock serializes
  fingerprint resolution and release publication.
- Release numbers, record revisions, and A-codes are server-managed.
- Published records, versions, review events, typed identity codes, and path
  identities are immutable. A new path for the same A retires the prior active
  path in the new release while preserving its history.
- PostgreSQL enforces the exact seven NT tuples. `NT_INPATIENT` is present but
  held and cannot be referenced by an active classification path.
- Synthetic fixture values are structural test data only and are not clinically
  validated guidance.

## Verification

- `git diff --check`
- focused Playwright test `clinical-master-phase1a1.spec.ts`
- `node_modules/.bin/tsc --noEmit --pretty false`
- `node_modules/.bin/eslint src/features/clinical-master/server-clinical-master-publisher-core.ts tests/clinical-master-phase1a1.spec.ts`
- `node scripts/check-doc-links.mjs`
- fresh local Supabase reset, then the replay snippet with
  `ON_ERROR_STOP=1` when Docker/psql are available

The replay covers initial publication, exact same-payload retry, metadata-only
release, changed-record-only revisioning, nested-price and unknown-field
rejection, route tuple rejection, immutable typed-code/lifecycle/name guards,
path retirement, privilege denial, advisory-lock instructions, and rollback
cleanup. A separate two-session replay is documented below and was executed
only against the local Docker service recorded in the evidence.

## Latest local gate evidence

As of 2026-08-19, the local synthetic gate ran successfully in worktree
`codex/clinical-master-phase1-active` with Docker Desktop 4.81.0 / Engine
29.6.1 and pinned `supabase@2.115.0` via `npx`. Local `start` and
`db reset --local --yes` completed, and the full replay ran through
`supabase_db_emr-app-shell-prototype` with `ON_ERROR_STOP=1`, ending with
`clinical_master_phase1a1_replay_cleanup_ok`.

The direct role/ACL/RLS inspection found all 18 `master` tables RLS-enabled,
zero master policies, and zero schema/table/function privileges for
`public`, `anon`, `authenticated`, and `service_role`; the replay also passed
the three-role read/write/execute denial checks. A real two-session publisher
barrier held Session A in one transaction for 20 seconds; Session B waited
(`real 19.11s`) and returned the same release with `idempotent=true`, followed
by the final published/record-count assertions. Focused Playwright (10/10),
TypeScript, ESLint, docs-link, and `git diff --check` verification passed.

The gate exposed and fixed only A1-owned defects: the canonical numeric
formatter used unsupported qualified `position` syntax, the shared typed-code
trigger referenced columns absent from sibling tables, and the replay's
generated `NT_CHART_ONLY` key did not match its path. The concurrent probe
intentionally committed one synthetic release; rerun the authorized local
reset if a clean database is needed. No remote Supabase, real data, deploy,
commit, push, or PR action was performed.

## Handoff

This work is intentionally bounded to Phase 1A-1. The local gate and
independent Sol review are complete; human review/acceptance remains before
calling the phase complete.
