# Approval Packet: CLINICAL-MASTER-PR-017-AIRTABLE-01

Status: `approved, executed, and fully read back on 2026-08-26 KST`

## Approval Request

Approve only the exact persistent Airtable authoring action defined below. This
approval does not authorize private-master publication, Supabase migration/upsert,
workspace adoption, Git merge, deployment, feature activation, or clinical use.

## Target And Verified Preflight

- Base ID: `applMtgWwOxwPigB8`
- Base name: `CLAiR Clinical Master`
- Permission observed: create-capable
- Current schema: 8 tables and 65 fields
- Existing tables and rows:

| Existing table | Current rows | Permitted mutation |
| --- | ---: | --- |
| Release Drafts | 1 | none |
| Sources | 1 | none |
| Master Records | 578 | none |
| Names | 578 | none |
| Classification Paths | 13 | none |
| Lab Panel Items | 120 | none |
| Lab Order Profiles | 85 | none |
| Diagnosis Category Links | 12 | none |

The table/field count, table names, and all eight row counts were re-read
immediately before this packet. No existing table, field, record, view, interface,
or release draft may be changed.

## Frozen Inputs

| Artifact | SHA-256 |
| --- | --- |
| Final 108-row dataset | `cc3ef6c977122bef5a708d5c6a800a3120b257584bd78ee72c26a67d2b95260f` |
| Authoring schema | `ad693b212ff4507f944ddf54bf482cebe0d49f76d4994e7cf076836803e8a987` |
| Authoring records | `3fc910fb984fcfbb14341eb8e59d94dc86a737598e88d3419ac232c34fba6015` |
| Authoring summary | `000076416021493694107805c7b4b6277a5661b254f228f3fc003c4b1bb592da` |
| Generator | `603891690c7c1164678aa733ea346c69fbee0b7be8285f48b928da7124bbbb79` |

Dataset revision is `2026-08-26.1`. Every clinical-use flag is false. Dose,
frequency, duration, and BUD authoring cells are intentionally empty.

## Exact New Schema

Create nine new tables only:

| New table | Defined scalar fields | Defined link fields | Records |
| --- | ---: | ---: | ---: |
| Active Ingredients V1 | 5 | 0 | 79 |
| Medication Products V1 | 18 | 1 | 108 |
| Product Ingredients V1 | 4 | 2 | 132 |
| Species Applicability V1 | 4 | 2 | 150 |
| Evidence Documents V1 | 10 | 0 | 108 |
| Evidence Assertions V1 | 5 | 2 | 648 |
| Clinical Reviews V1 | 7 | 0 | 108 |
| Regulatory Profiles V1 | 7 | 1 | 108 |
| Dispensing Orders V1 | 16 | 3 | 108 |
| **Total** | **76** | **11** | **1,549** |

The exact names, types, choices, and symbolic link targets are frozen in the
schema artifact. Airtable assigns table, field, record, and reciprocal-link IDs at
creation time. Those server-generated IDs are the only non-deterministic values.
Each of the 11 link fields may cause one Airtable-managed reciprocal field in its
target table; no other auto-created field is allowed.

## Exact Write Sequence

1. Re-read the target. Stop unless the existing 8-table/65-field schema, all table
   names, and the eight baseline row counts still match and none of the nine new
   table names exists.
2. Create the nine tables with their primary and scalar fields. Do not create or
   change any existing table.
3. Resolve the new table IDs and create the 11 link fields by those IDs. Do not
   create the same relationship in both directions; Airtable owns reciprocal fields.
4. Create all 1,549 scalar records in deterministic external-key order, at no more
   than 50 records per request, with `typecast=false`. Expected create requests: 36.
5. Resolve every new record ID by exact `External Key`, then attach exactly 2,400
   link references across the six link-owning tables, at no more than 50 records per
   update request. Expected link-update requests: 28.
6. Read back every new table. Verify table/field shapes, exact counts, unique
   external keys, all link references, empty pending-review fields, and zero true
   `Clinical Use Allowed` values.
7. Re-read all eight pre-existing tables and row counts. They must be unchanged.

## Expected Postflight

- Base table count: 17.
- Existing defined field count: 65 unchanged.
- New explicitly defined fields: 87, including 11 link fields.
- Airtable-managed reciprocal fields: at most 11 and only for the frozen links.
- New records: exactly 1,549.
- Link references: exactly 2,400.
- Duplicate external keys: 0.
- Missing link targets: 0.
- Existing record creates/updates/deletes: 0/0/0.
- New record deletes: 0 during the successful path.
- Clinically active rows: 0.
- Release drafts or published releases created: 0.

## Stop Conditions

Stop immediately without continuing batches on any wrong base/name/permission,
baseline drift, pre-existing target table name, unexpected Airtable-created field,
schema/type/choice mismatch, partial batch, duplicate external key, missing link
target, row-count overrun, `typecast` requirement, clinical-use true value, write to
an old table, lost action ID, API rate/permission failure, or unverified readback.

Do not guess field IDs, retry a non-idempotent create blindly, or compensate by
editing an existing clinical-master table.

## Recovery Limitation

Record-create actions may return revert action IDs. They will be recorded and, if a
failure occurs before successful postflight, may be reverted in strict reverse order
when Airtable reports them eligible. Link updates do not return reversible action
IDs; they can only be cleared by an exact compensating update after readback.

The installed Airtable connector exposes no table-delete operation and table-create
results are not documented as revertible. Therefore a partial schema creation cannot
be automatically removed. On that failure the safe response is to stop, leave the
new isolated V1 tables inactive, report their exact IDs/shapes, and ask for a separate
manual cleanup decision. This hard-to-recover limitation is part of the approval.

## Approval Phrase

An explicit approval should identify the packet and hashes, for example:

`CLINICAL-MASTER-PR-017-AIRTABLE-01 승인. schema ad693b21..., records 3fc910fb... 그대로 실행해.`

## Executed Result

- The user explicitly approved Airtable persistence in the active Goal.
- Preflight matched the original 8-table baseline and none of the nine target
  table names existed.
- All nine V1 tables were created. One initial Evidence Documents create call
  failed connector-side schema validation before creating a table; the date
  option shape was corrected, artifacts were regenerated, and execution then
  completed against the still-clean target name.
- 1,549 scalar records were created in 36 eligible create batches and 2,400
  link references were attached in 28 update batches.
- Full remote readback matched every expected table count and all 2,400 links.
  Duplicate, missing, and unexpected external-key counts were zero and
  `Clinical Use Allowed=true` count was zero.
- Final base table count is 17. The original eight tables and their row counts
  were unchanged; no release draft or clinical activation was created.
- Recovery boundary remains as documented above: record-create action IDs were
  retained for eligible reversal, while table/link cleanup would require a
  separately reviewed manual compensating action.
