---
id: "CHART-PR-026"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Production hotfix / SOAP RPC signature drift"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
dependencies:
  - "CLINICAL-BILLING-PR-004"
updated: "2026-08-30"
---

# SOAP RPC Signature Drift Hotfix

## Goal

Restore production SOAP persistence by converging the live Supabase writer with the six-argument application RPC contract, without changing SOAP content, UI behavior, or unrelated schema.

## Root Cause

The remote project applied migration `20260519180000` while the SOAP writer still had five arguments. The repository later changed that already-applied historical file to add `p_expected_updated_at`, so fresh databases and application code expect six arguments while the linked live database still exposes only the five-argument function. PostgREST therefore cannot resolve the application call and the chart keeps the note only in browser memory.

## Approved Scope

- Add one forward, function-only migration; do not edit or repair historical migration records.
- Remove the stale five-argument overload and recreate the exact six-argument writer.
- Enforce authenticated actor equality, active workspace membership, `chart:update`, encounter/workspace lifecycle, and optimistic `updated_at` conflicts inside the direct RPC boundary.
- Keep execute access limited to `authenticated` with a fixed empty `search_path`.
- Apply only this migration to the linked synthetic/demo Supabase project after local verification.
- Verify the exact function signature, grants, settings, migration record, advisor delta, production deployment, and a user-triggered SOAP retry/readback.

## Out Of Scope

- SOAP editor/UI changes, note templates, or autosave timing changes.
- Table, column, index, RLS policy, permission model, seed, or clinical row migration.
- Broad `supabase db push`, migration-history repair, unrelated pending migrations, or data backfill.
- Changing existing patient, guardian, encounter, diagnosis, order, billing, or audit records as part of deployment.

## Done Criteria

1. The linked database exposes only `clair_save_chart_soap_note(text,text,uuid,jsonb,timestamptz,text)`.
2. Direct unauthenticated, actor-mismatched, permission-missing, cross-workspace, stale-lifecycle, and stale-version calls are denied.
3. `PUBLIC` and `anon` cannot execute the writer; `authenticated` can.
4. Focused tests and production release preflight pass for the exact candidate.
5. The approved migration, PR, `origin/main` merge, Ready production deployment, and scoped smoke have traceable evidence.
6. After deployment, the user-triggered retry persists the current note and emits `chart.soap_saved`; reload happens only after readback proves persistence.

## Verification

- `npx playwright test tests/chart-soap-note-persistence-server.spec.ts --reporter=line`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Rollback

If the function-only migration or smoke fails, stop SOAP retries and apply a reviewed forward migration that restores the previous known function definition. Do not repair migration history or delete clinical rows. For application deployment failure, restore the previous Ready production deployment or revert the merge commit while preserving the database function contract.

## Remote Verification — 2026-08-30

- Applied only `chart_soap_note_rpc_signature_drift_hotfix` to the linked synthetic/demo Supabase project as remote migration `20260830113834`; no table, row backfill, migration-history repair, or unrelated pending migration was included.
- Catalog readback shows one writer only: `clair_save_chart_soap_note(text,text,uuid,jsonb,timestamptz,text)`, owned as `SECURITY DEFINER` with empty `search_path`, denied to `PUBLIC`/`anon`, and executable by `authenticated`.
- A successful synthetic save returned the target encounter and `draft` status inside an explicit transaction, followed by `ROLLBACK`; residue readback remained zero SOAP rows.
- Actor mismatch, permission removal, cross-encounter scope, waiting encounter lifecycle, and stale-version probes returned `actor_mismatch`, `permission_missing`, `encounter_unavailable`, `stale_status`, and `soap_note_conflict`. Permission assignments/policies modified for the denial probe were transaction-local and rolled back; post-probe counts and SOAP residue remained intact.
- The performance advisor returned no notice for the writer. The security advisor reports the intentional signed-in `SECURITY DEFINER` RPC; this is accepted because the function independently enforces authenticated actor equality, active membership, DB-backed `chart:update`, encounter scope/lifecycle, fixed `search_path`, and optimistic concurrency before writing.

## Verification Result — 2026-08-30

- SOAP persistence focused spec: 8 passed.
- `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`, `npm run docs:check`, `npm run security:secrets`, and `git diff --check`: passed.
- The production build retained one existing NFT trace warning from the docs reader; compilation, type validation, and all 18 static pages completed successfully.
- The unrelated broad audit regression file still has two `origin/main` baseline failures in reception fixture setup and workspace-role route source expectations. SOAP audit wiring itself remains present, and the final `chart.soap_saved` evidence is deferred to the user-triggered production retry.
