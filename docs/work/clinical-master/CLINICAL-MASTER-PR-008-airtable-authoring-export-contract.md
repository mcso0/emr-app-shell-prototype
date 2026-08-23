---
id: "CLINICAL-MASTER-PR-008"
status: "implemented"
area: "clinical-master"
priority: "P0"
target_pr: "Deterministic Airtable authoring/export contract"
execution_boundary: "local-only"
completion_report: "docs/completed/clinical-master/2026-08-23-clinical-master-pr-008-airtable-authoring-export-contract-report.html"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-airtable-authoring-export-contract.md"
  - "docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md"
updated: "2026-08-23"
---

# Clinical Master PR-008: Airtable Authoring Export Contract

## Status

Implemented and verified locally. This work item defines and tests the
`clinical-master-airtable-authoring/v1` validator/normalizer. It is an
authoring contract only; no actual Airtable Base or Airtable data was created,
no export was published, and no remote state was changed.

## Exact scope

- Define exactly eight physical authoring tables: `Release Drafts`, `Sources`,
  `Master Records`, `Names`, `Classification Paths`, `Lab Panel Items`,
  `Lab Order Profiles`, and `Diagnosis Category Links`.
- Record the seven view-only surfaces without treating them as authority:
  `Code Dictionary`, `Orders`, `Vocabularies`, `Diagnosis Systems`,
  `Disease Groups`, `Diagnoses`, and `Ready for Export`.
- Validate and normalize the deterministic envelope
  `clinical-master-airtable-authoring/v1`, including release metadata, the
  input-only source registry, records, and all relationship arrays. The
  normalized authoring envelope removes top-level `sources` and each input
  `sourceKey`/`authoringStatus` after inlining one source per record.
- Support exactly the 13 authoring record types: `order_category`,
  `clinical_action`, `chart_group`, `task_route`, `order`, `species`, `unit`,
  `specimen_type`, `result_input_type`, `lab_test`, `lab_panel`,
  `diagnosis_category`, and `diagnosis`.
- Enforce `status: approved` plus non-empty review reason, approved authoring
  records, published/normal records, synthetic sources, semantic stable keys,
  typed references, exact name rules, classification paths, laboratory
  panel/profile rules, and diagnosis system → disease-group links with exactly
  one primary link per diagnosis.
- Reject unknown fields and Airtable IDs/formulas/lookups/generated server
  authority. Reject canonical prices with `canonical_price_forbidden` and
  set/range/weight-tier pricing with
  `workspace_order_set_pricing_forbidden`; `public.order_set_revision_price_ranges`
  remains the price-range owner.
- Return sorted `{path, code, message}` issues and throw
  `ClinicalMasterAirtableExportValidationError` when normalization receives an
  invalid snapshot.
- Keep `task_route` input to `routeCode` only and derive the exact route tuple
  in normalized detail. Keep `diagnosis_category` detail to
  `categoryKind`/`parentMasterKey`/`sortOrder` and `diagnosis` detail to `{}`;
  diagnosis systems are derived through disease-group parents and links.

The source-of-truth field and relationship contract is the [Airtable authoring
export contract](../../engineering/data-model/clair-clinical-master-airtable-authoring-export-contract.md).

## Out of scope

- Creating or configuring an Airtable Base, tables, views, formulas, lookups,
  records, credentials, or real clinical source data.
- Publishing an export, inserting master rows, release/version/review rows,
  or changing any database schema, migration, RLS policy, seed, or remote DB.
- Replacing or extending the current SQL publisher. In particular,
  `diagnosis_category` and `diagnosis` are accepted for authoring review only
  and remain unsupported by the current publisher.
- Runtime routes, UI, chart behavior, workspace adoption, API changes, and
  downstream diagnosis search/content release.
- Canonical order-set price, range, set, or weight-tier authority; those remain
  workspace-owned by `public.order_set_revision_price_ranges`.

## Done when

- The eight-table list is exported as a constant and the seven view-only
  surfaces are documented as non-authoritative.
- The input is accepted only at
  `clinical-master-airtable-authoring/v1`, with approved release metadata,
  synthetic source provenance, published/normal records, stable keys, typed
  names/details, and complete same-snapshot references.
- Every array is normalized deterministically, optional text becomes `null`,
  contract defaults are applied, and validation issues are sorted by path,
  code, and message. Usable stable keys are used in issue paths so shuffled
  invalid input yields the same issue list.
- All 13 record types and their classification, laboratory, and diagnosis
  relationships are covered by the fixture and focused Playwright spec.
- Unknown/Airtable-derived identity fields, lifecycle/review/source failures,
  wrong references/types, invalid lab/diagnosis relations, canonical prices,
  and set/range/weight-tier fields have focused negative coverage.
- The normalized authoring envelope is explicitly rejected by the current
  publisher boundary, and diagnosis record types remain publisher-unsupported.
- The current publisher and all DB/runtime/remote boundaries remain unchanged.

## Verification

- `npx playwright test tests/clinical-master-airtable-authoring-export.spec.ts --reporter=line` — 11 passed.
- `npx playwright test tests/clinical-master-phase1a1.spec.ts tests/clinical-master-phase1b1.spec.ts tests/clinical-master-diagnosis-foundation.spec.ts --reporter=line` — 20 passed (combined A1/B1/PR-007 regression).
- `npx tsc --noEmit --pretty false` — passed.
- `npm run lint` — passed.
- `npm run security:secrets` — passed; 3,619 tracked files scanned.
- `npm run docs:check` — passed for this documentation slice.
- `git diff --check` — passed.

The focused fixture is synthetic and structural. These checks prove the local
validator/normalizer contract only; they do not prove Airtable connectivity,
an Airtable Base, a published release, database persistence, or runtime
adoption.

## Implementation result

The server-only core has no Airtable SDK, database, migration, route, UI, or
publisher dependency. Diagnosis authoring data remains intentionally separated
from the later diagnosis publisher gate. The current SQL publisher was not
edited.
