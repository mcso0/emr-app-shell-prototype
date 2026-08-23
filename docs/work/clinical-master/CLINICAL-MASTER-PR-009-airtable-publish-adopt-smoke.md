---
id: "CLINICAL-MASTER-PR-009"
status: "completed"
area: "clinical-master"
priority: "P0"
target_pr: "Airtable authoring snapshot to current publisher adapter"
execution_boundary: "local-only"
updated: "2026-08-23"
---

# Clinical Master PR-009: Airtable Publish Adapter

## Status

Implemented and completed as a local-only adapter and CLI. The adapter did not
read Airtable or write Supabase itself, but its locked pilot result was consumed
by the approved publisher/adopter run recorded in PR-010. The existing SQL
publisher implementation remained unchanged by this slice.

## What changed

- Added a deterministic bridge from the reviewed
  `clinical-master-airtable-authoring/v1` normalized snapshot to the existing
  `ClinicalMasterPublishPayload` contract.
- Kept exactly the current publisher's 11 record types. The two authoring-only
  diagnosis types (`diagnosis_category`, `diagnosis`) are excluded from the
  payload and reported with exact stable keys and counts.
- Excluded `diagnosisCategoryLinks` from the publisher payload while reporting
  each `diagnosisMasterKey|categoryMasterKey` key and count.
- Inlined the normalized synthetic source into every supported record and
  stripped authoring-only metadata such as `changeSummary`,
  `sourceAssertionScope`, `sourceNotes`, and `sourceKey`.
- Re-ran the result through `validateClinicalMasterPublishPayload` and
  `normalizeClinicalMasterPublishPayload`; PostgreSQL remains the final release
  and fingerprint authority.
- Normalized optional unitless `lab_test.decimalScale: null` is omitted at the
  adapter boundary so text/coded lab tests remain valid without changing the
  existing publisher core.
- Added a Node 23 strip-types CLI that reads an existing authoring JSON file and
  prints or writes deterministic payload/exclusion JSON. It has no Airtable PAT
  or API integration.

## Pilot proof shape

The focused generated pilot snapshot proves 83 supported records, 30 orders,
24 excluded diagnosis records (12 categories plus 12 diagnoses), 12 excluded
diagnosis-category links, 5 classification paths, 13 lab panel items, and 17
lab order profiles. Row order is shuffled in the test and produces the same
serialized result.

## Verification

- `npx playwright test tests/clinical-master-airtable-publish-adapter.spec.ts --reporter=line` — 5 passed.
- Adapter plus PR-008/A1/B1/PR-007 regressions — 36 passed.
- `npx tsc --noEmit --pretty false` — passed.
- Targeted ESLint for the adapter, CLI, and focused spec — passed.
- `node --experimental-strip-types scripts/clinical-master-airtable-publish-adapter.ts tests/fixtures/clinical-master-airtable-authoring-export.fixture.json /tmp/clinical-master-adapter-output.json` — passed; fixture output was 13 supported records, 3 excluded diagnosis records, and 1 excluded link.
- Approved pilot handoff — the Airtable Base readback was
  `1/1/107/107/5/13/17/12`; the locked adapter/publisher payload contained 83
  supported records and 30 orders, excluding 24 diagnosis records and 12
  diagnosis-category links.
- PR-010 consumed the locked result for persistent publisher/adopter state and
  bounded synthetic operational smoke; browser read-only login/workspace/
  catalog visibility remains pending and is not claimed here.
- Existing PR-008 and Phase 1 tests remain the regression evidence for this
  completed adapter slice.

## Out of scope and caveats

- No Airtable connector/reader, credentials, remote export, migration, DB
  publish, workspace adoption, runtime UI, diagnosis publisher, Order Set
  publisher, or pricing/weight-tier authority was added to this adapter slice;
  the separate approved publish/adopt evidence is owned by PR-010.
- The CLI requires Node 23+ `--experimental-strip-types`; it is intentionally
  a local operator utility rather than a package runtime dependency.
- The adapter proves deterministic payload shape and exclusion reporting. The
  PR-010 closeout records the separate authenticated synthetic publisher,
  adopter, and rollback-only operational smoke evidence; it does not turn the
  adapter into an Airtable integration.

## Files

- `src/features/clinical-master/server-clinical-master-airtable-publish-adapter.ts`
- `scripts/clinical-master-airtable-publish-adapter.ts`
- `tests/clinical-master-airtable-publish-adapter.spec.ts`
