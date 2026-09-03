---
id: "CHART-PR-033"
status: "completed"
area: "chart"
priority: "P0"
target_pr: "Browser comment / diagnosis-system SOAP scope isolation"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/product/domain/outpatient-workflow-state-model.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
  - "docs/work/chart/CHART-PR-030-blocknote-soap-live-persistence.md"
dependencies:
  - "CHART-PR-030"
updated: "2026-09-03"
---

# Diagnosis-System SOAP Scope Isolation

## Goal

Give the default SOAP tab and every diagnosis-system tab an independent BlockNote input space without splitting one encounter into multiple SOAP note rows or weakening the existing authorization, optimistic-concurrency, audit, and compatibility-projection boundaries.

## Scope

- Key system tabs by the diagnosis catalog `systemId`; use a deterministic label key only for legacy/mock diagnoses that lack the ID.
- Introduce canonical SOAP document V2 as one envelope containing one required default scope and zero or more system scopes.
- Keep legacy unscoped V1 root blocks in the default scope during in-memory upgrade. Never copy or infer them into a diagnosis-system scope.
- Create a blank S/O/A/P template only when a diagnosis-system tab has no stored scope.
- Merge edits from the active tab into the aggregate document while preserving every other scope.
- Keep one encounter-scoped autosave coordinator and one optimistic `updatedAt` chain.
- Derive the compatibility `subjective`, `objective`, `assessment`, and `plan` fields only from the default scope.
- Keep meaningful saved system scopes visible if their source diagnosis is later removed, preventing recorded content from becoming unreachable.
- Remove nested SOAP-template commands from the live chart editor because diagnosis selection and tab creation now own system scope creation.
- Add a migration-first V3 writer and return stable `systemId` from the diagnosis reader.

## Out of Scope

- Multiple SOAP note rows per encounter or one request per tab.
- Destructive backfill of existing V1 rows.
- Automatic assignment of old free-form text to a diagnosis system.
- SOAP signing, amendments, collaboration, AI generation, attachment storage, or clinical-device ingestion.
- Changes to diagnosis creation, order workflows, or unrelated chart layout.

## Canonical Document V2

```json
{
  "schemaVersion": 2,
  "scopes": [
    {
      "scopeKey": "default",
      "scope": "default",
      "systemLabel": "기본 SOAP",
      "blocks": []
    },
    {
      "scopeKey": "system:<diagnosis-system-id>",
      "scope": "system",
      "systemId": "<diagnosis-system-id>",
      "systemLabel": "근골격계",
      "blocks": []
    }
  ]
}
```

The persisted `soap_notes.block_document` remains a JSON array: V1 stores the block array and V2 stores the scope array. `block_document_schema_version` selects the reader envelope. This preserves the existing row and column shape while making arbitrary root blocks scope-owned.

## Compatibility and Failure Contract

| Case | Required behavior |
| --- | --- |
| existing V1 note | open all unscoped/root content in default; preserve explicit V1 system section groups by label |
| first system-tab edit | add only that system scope to the aggregate V2 document |
| switch tabs during pending save | keep the same coordinator and send the newest aggregate document |
| system diagnosis removed | retain and show the tab when its saved scope has meaningful content |
| existing V2 note opened by a stale app | reader remains compatible; V1/V2 writer downgrade is rejected with `soap_client_upgrade_required` |
| projections/history consumers | read only default-scope S/O/A/P text |
| malformed scope or marker mismatch | reject at both application and database validators |

## Done Criteria

1. Default and diagnosis-system tab inputs remain distinct before and after autosave/reload.
2. Saving one tab preserves every other stored scope.
3. Legacy free-form content remains default-only and no destructive backfill runs.
4. Default-only projections, V1 compatibility, V2 downgrade protection, permission gates, conflict detection, and transactional audit are covered.
5. The additive database migration is applied before the application release.
6. The exact candidate passes release checks and an authenticated production smoke confirms the reported tab behavior.

## Verification

- TypeScript and focused document/persistence/diagnosis tests pass.
- Browser regression covers default/system separation, autosave, reload, and nested-template command removal.
- Local PostgreSQL transaction replay covers V3 persistence, default-only projection, V1 downgrade rejection, revision, grants, and full rollback.
- Full lint, build, docs, secret, and Release Check gates are required before merge.

## Remote Database Evidence

- Additive migration `20260903110347` (`chart_soap_system_scope_v2`) is applied to the shared synthetic/demo Supabase target.
- The validated `soap_notes_block_document_pair_check` accepts only null pairs or array payloads at schema version 1/2 within the existing byte boundary.
- V2 validation returned true for a synthetic default scope; V3 writer, SOAP reader, and diagnosis reader are authenticated-only, while private document helpers remain non-executable by `authenticated` and `anon`.
- The representative encounter's existing SOAP row retained the same schema version, document/projection hashes, and `updated_at` before and after migration. No content migration or row update ran.
- Supabase advisors reported existing project-wide informational/performance findings; this migration added no table, RLS policy, or index surface.

## Production Release Evidence

- PR #702 candidate `82fa904e45e3649871913e8469e91a7a8389e589` passed Release Check `33748012134` and merged to `origin/main` at `ad59cd7f6923be8fca544f698ee25221d977e8e7`.
- Vercel deployment `dpl_F3BESnEy2Vd6SLqYdHqtmfLP6E7W` is Ready on `https://emr-app-shell-prototype.vercel.app` and GitHub deployment `6242655604` reports success for the merge SHA.
- Root and the exact Cheongdam treatment route returned final HTTP 200 responses.
- Authenticated read-only smoke confirmed the existing default free-form text is present only under `기본 S/O`; `근골격계` renders its own blank S/O/A/P scope; switching back restores the default text; browser error logs are empty.
- A post-smoke read-only fingerprint query confirmed the representative SOAP row's schema version, document/projection hashes, and `updated_at` remain unchanged.
- The previous rollback baseline is `origin/main` `61655558` with production deployment `dpl_715C9ZyMsFyhdycwa4GJTvR4GwQX`.

## Rollback

Ordinary application rollback redeploys the previous application while leaving the additive V2 schema and V3 RPC in place. Existing V2 rows remain readable through default projections and are protected from stale V1 writes. Removing V2 scope data or downgrading stored documents is destructive and is not part of service rollback.
