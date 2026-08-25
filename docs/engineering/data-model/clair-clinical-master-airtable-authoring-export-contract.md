---
id: "ENGINEERING-DATA-MODEL-CLAIR-CLINICAL-MASTER-AIRTABLE-AUTHORING-EXPORT-CONTRACT"
type: "Data Contract"
title: "CLAiR Clinical Master Airtable Authoring Export Contract"
description: "Defines the local-only clinical-master-airtable-authoring/v1 authoring snapshot and validation boundary."
status: "implemented"
area: "engineering"
doc_type: "data-contract"
related_work:
  - "CLINICAL-MASTER-PR-008"
last_updated: "2026-08-23"
---

# CLAiR Clinical Master Airtable Authoring Export Contract

## Status and boundary

`clinical-master-airtable-authoring/v1` is the implemented, local-only
authoring/export contract for a reviewed synthetic snapshot. It defines the
shape that an authoring tool may validate and normalize; it does not create an
Airtable Base, read an Airtable Base, publish an export, or write a database.

This document is the source of truth for the focused server-side validator,
normalizer, and PR-009 local publish adapter. The 13 record types below are
accepted by this authoring contract. CLINICAL-MASTER-PR-015 adds a separate,
diagnosis-only adapter and SQL publisher path for `diagnosis_category`,
`diagnosis`, and `diagnosisCategoryLinks`; mixed diagnosis/order payloads remain
invalid and the established order/laboratory canonicalization stays unchanged.

## Physical tables

The contract has exactly eight physical Airtable tables. A physical table is a
reviewed authoring surface; it is not a database table and does not become
server authority merely because a row exists there.

| Physical table | Contract responsibility |
| --- | --- |
| `Release Drafts` | Release key, approval/review status, notes, and human-readable author/reviewer/publisher labels. |
| `Sources` | Synthetic source snapshot and optional reference/version/access/license notes. |
| `Master Records` | Stable master identity, one supported record type, lifecycle/safety gates, source reference, names, and typed detail. |
| `Names` | Localized preferred, alias, abbreviation, and legacy names belonging to a master record. |
| `Classification Paths` | Typed `clinical_action` → `chart_group` → `task_route` path rows used by orders. |
| `Lab Panel Items` | Ordered, unique `lab_panel` → `lab_test` membership. |
| `Lab Order Profiles` | One laboratory order’s test-or-panel target and optional specimen reference. |
| `Diagnosis Category Links` | Diagnosis-to-disease-group links, including exactly one primary link per diagnosis. |

The normalized export envelope always materializes all four relationship
arrays, even when the input omitted an optional array:
`classificationPaths`, `labPanelItems`, `labOrderProfiles`, and
`diagnosisCategoryLinks`.

The input-only `Sources` registry is not copied to the normalized envelope.
Validation resolves each `Master Records.sourceKey` to exactly one synthetic
source, then inlines that source as `records[].source`. The normalized record
also carries `changeSummary`, `sourceAssertionScope`, and `sourceNotes`; it has
no `authoringStatus` or `sourceKey`.

## Airtable field contract

The following is the physical-table contract. Airtable field names shown in
backticks are the exact flattening names accepted by the validator. A linked
record is resolved to a semantic `masterKey`; IDs, formulas, lookups, and
generated fields are never export mappings.

| Physical table | Field (Airtable type) | Required/cardinality | Linked target | Export mapping |
| --- | --- | --- | --- | --- |
| `Release Drafts` | `releaseKey` (single line text) | required, one | — | `release.releaseKey` |
| `Release Drafts` | `status` (single select) | required, one; `approved` only | — | `release.status` input gate; omitted from normalized `release` |
| `Release Drafts` | `releaseNotes` (long text) | optional, one | — | `release.releaseNotes` |
| `Release Drafts` | `publishedByLabel`, `authoredByLabel`, `reviewedByLabel` (single line text) | required, one each | — | same-named `release` fields |
| `Release Drafts` | `clinicalReviewerLabel` (single line text) | optional, one | — | `release.clinicalReviewerLabel` |
| `Release Drafts` | `reviewReason` (long text) | required, one, non-empty | — | `release.reviewReason` |
| `Sources` | `sourceKey` (single line text) | required, unique, one | — | input registry only; used to resolve `Master Records.sourceKey` |
| `Sources` | `sourceType` (single select) | required, one; `synthetic` only | — | inlined as `records[].source.sourceType` |
| `Sources` | `title` (single line text) | required, one | — | `records[].source.title` |
| `Sources` | `referenceUri` (URL/text) | optional, one | — | `records[].source.referenceUri` |
| `Sources` | `sourceVersion` (single line text), `accessedAt` (date/time text), `licenseNotes` (long text) | optional, one each | — | corresponding inlined `records[].source` fields |
| `Master Records` | `masterKey` (single line text) | required, unique, one | — | `records[].masterKey` |
| `Master Records` | `recordType` (single select) | required, one; exactly 13 allowed values | — | `records[].recordType` |
| `Master Records` | `authoringStatus` (single select) | required, one; `approved` only | — | input gate; omitted from normalized record |
| `Master Records` | `lifecycleStatus` (single select) | required, one; `published` only | — | normalized as `records[].lifecycleStatus` |
| `Master Records` | `safetyStatus` (single select) | required, one; `normal` only | — | normalized as `records[].safetyStatus` |
| `Master Records` | `safetyReason` (long text) | optional, one | — | `records[].safetyReason` |
| `Master Records` | `changeSummary` (long text) | required, one, non-empty | — | `records[].changeSummary` |
| `Master Records` | `sourceKey` (linked record) | required, exactly one | `Sources` | input lookup; removed after source inlining |
| `Master Records` | `sourceAssertionScope` (long text) | required, one, non-empty | — | `records[].sourceAssertionScope` |
| `Master Records` | `sourceNotes` (long text) | optional, one | — | `records[].sourceNotes` |
| `Master Records` | `names` (linked records) | required, one or more | `Names` | `records[].names[]` |
| `Master Records` | `detail` (long text containing typed JSON) | required, one | — | `records[].detail` |
| `Names` | `masterKey` (linked record) | required, exactly one per name row | `Master Records` | assembled into owning `records[].names[]`; not a free identity field |
| `Names` | `languageCode` (single select) | required, one; `ko` or `en` | — | `records[].names[].languageCode` |
| `Names` | `nameKind` (single select) | required, one; preferred/alias/abbreviation/legacy | — | `records[].names[].nameKind` |
| `Names` | `name` (single line text) | required, one | — | `records[].names[].name` |
| `Names` | `searchable` (checkbox) | optional, one; defaults `true` | — | `records[].names[].searchable` |
| `Names` | `sortOrder` (number) | optional, one; defaults `0` | — | `records[].names[].sortOrder` |
| `Classification Paths` | `pathKey` (single line text) | required, unique, one | — | `classificationPaths[].pathKey` |
| `Classification Paths` | `clinicalActionKey` (linked record) | required, exactly one | `Master Records: clinical_action` | `classificationPaths[].clinicalActionKey` |
| `Classification Paths` | `chartGroupKey` (linked record) | required, exactly one | `Master Records: chart_group` | `classificationPaths[].chartGroupKey` |
| `Classification Paths` | `taskRouteKey` (linked record) | required, exactly one | `Master Records: task_route` | `classificationPaths[].taskRouteKey` |
| `Lab Panel Items` | `panelMasterKey` (linked record) | required, exactly one | `Master Records: lab_panel` | `labPanelItems[].panelMasterKey` |
| `Lab Panel Items` | `testMasterKey` (linked record) | required, exactly one | `Master Records: lab_test` | `labPanelItems[].testMasterKey` |
| `Lab Panel Items` | `sortOrder` (number) | optional, one; defaults `0` | — | `labPanelItems[].sortOrder` |
| `Lab Panel Items` | `required` (checkbox) | optional, one; defaults `true` | — | `labPanelItems[].required` |
| `Lab Panel Items` | `displayGroup` (single line text) | optional, one | — | `labPanelItems[].displayGroup` |
| `Lab Order Profiles` | `orderMasterKey` (linked record) | required, exactly one | `Master Records: order` | `labOrderProfiles[].orderMasterKey` |
| `Lab Order Profiles` | `labTestMasterKey` (linked record) | optional, at most one | `Master Records: lab_test` | exactly one test-or-panel target |
| `Lab Order Profiles` | `labPanelMasterKey` (linked record) | optional, at most one | `Master Records: lab_panel` | exactly one test-or-panel target |
| `Lab Order Profiles` | `specimenMasterKey` (linked record) | optional, at most one | `Master Records: specimen_type` | `labOrderProfiles[].specimenMasterKey` |
| `Diagnosis Category Links` | `diagnosisMasterKey` (linked record) | required, exactly one | `Master Records: diagnosis` | `diagnosisCategoryLinks[].diagnosisMasterKey` |
| `Diagnosis Category Links` | `categoryMasterKey` (linked record) | required, exactly one | `Master Records: diagnosis_category` (`disease_group` only) | `diagnosisCategoryLinks[].categoryMasterKey` |
| `Diagnosis Category Links` | `isPrimary` (checkbox) | optional, one; defaults `false` | — | `diagnosisCategoryLinks[].isPrimary` |
| `Diagnosis Category Links` | `sortOrder` (number) | optional, one; defaults `0` | — | `diagnosisCategoryLinks[].sortOrder` |

## View-only surfaces

These surfaces may be derived for authoring convenience or review, but they are
not additional physical tables and are never accepted as export authority:

- `Code Dictionary`
- `Orders`
- `Vocabularies`
- `Diagnosis Systems`
- `Disease Groups`
- `Diagnoses`
- `Ready for Export`

Their formulas, lookups, labels, and display identities must be flattened into
the contract fields above before validation. View-only values cannot supply a
missing stable key, release status, relationship, or server-generated field.

## Envelope

The input envelope has exactly these top-level fields. `schemaVersion` must be
`clinical-master-airtable-authoring/v1`.

```json
{
  "schemaVersion": "clinical-master-airtable-authoring/v1",
  "release": {},
  "sources": [],
  "records": [],
  "classificationPaths": [],
  "labPanelItems": [],
  "labOrderProfiles": [],
  "diagnosisCategoryLinks": []
}
```

The normalized authoring envelope has `schemaVersion`, `release`, `records`,
and the four relationship arrays only. It has no top-level `sources`; each
normalized record has one inlined `source` object instead.

Unknown envelope, table, relation, and typed-detail fields are rejected. The
normalizer trims text, converts optional blank strings to `null`, applies the
documented defaults, and sorts every array by stable contract values. The
result is therefore independent of Airtable row order.

## Release, review, and source gates

### Release

`release.releaseKey` is a semantic stable key. The canonical status field is
`status`, and it must be present and exactly `approved`. There are no
`approvalStatus` or `releaseStatus` aliases. The normalized output strips the
approval status after this gate.

The release also requires non-empty `publishedByLabel`, `authoredByLabel`, and
`reviewedByLabel`, plus a non-empty `reviewReason`. `releaseNotes` and
`clinicalReviewerLabel` are optional and normalize blank values to `null`.

### Records

Every record must have a semantic `masterKey`, one allowed `recordType`,
`authoringStatus: "approved"`, `lifecycleStatus: "published"`,
`safetyStatus: "normal"`, a source key, non-empty `changeSummary`, non-empty
`sourceAssertionScope`, optional `sourceNotes`, at least one name, and typed
`detail`. The normalized output strips `authoringStatus` and `sourceKey` after
inlining the exactly-one source. A non-normal safety reason is not a way to
export an exception; the safety gate rejects the record.

### Sources

At least one source is required. Every source key is semantic and unique, and
every source must have `sourceType: "synthetic"`. Source fields are:

| Field | Rule |
| --- | --- |
| `sourceKey` | Required semantic stable key; unique in the snapshot. |
| `sourceType` | Required literal `synthetic`. |
| `title` | Required non-empty text. |
| `referenceUri`, `sourceVersion`, `accessedAt`, `licenseNotes` | Optional text; blank values normalize to `null`. |

Every `Master Records.sourceKey` must resolve to a source in the same complete
snapshot. Real external source data, credentials, or unreviewed clinical
content are outside this contract.

## Names

Each record has at least one name, exactly one preferred Korean (`ko`) name,
and at most one preferred English (`en`) name. `languageCode` is `ko` or `en`;
`nameKind` is one of `preferred`, `alias`, `abbreviation`, or `legacy`.
`name` is required. `searchable` defaults to `true` and `sortOrder` defaults to
`0`; both are normalized to their typed values. Duplicate names after trimming,
collapsing internal whitespace, and lowercasing are rejected for the same
language and kind.

## Authoring record types and typed detail

The contract supports exactly these 13 record types. No other type is accepted.
The `detail` object may contain only the fields shown for its type.

| `recordType` | Typed detail fields and rules |
| --- | --- |
| `order_category` | `categoryCode`, `categoryLevel` (`X` or `T`), optional `parentMasterKey`, optional non-negative `sortOrder`. `X` has no parent; `T` requires an `X` parent. |
| `clinical_action` | `tCategoryKey`, `itemType` (`consultation`, `medication`, `treatment`, `lab`, `imaging`, `hospitalization`, or `misc`), optional `isOtherUnclassified` (defaults `false`). The category reference must be a `T` category. |
| `chart_group` | `groupCode`, optional non-negative `sortOrder`. |
| `task_route` | `routeCode` only. `destinationModule`, `taskRequired`, and `runtimeStatus` are derived in normalized output from the exact route tuple. A held route cannot appear in an active classification path. |
| `order` | `classificationPathKey`, optional `defaultSalesUnitCode`, optional `defaultBillingReflectionEnabled` (defaults `true`), optional positive `defaultQuantity` (defaults `1`), and required `species` array containing unique `dog`/`cat` values. All references must resolve. |
| `species` | `speciesCode`, limited to `dog` or `cat`. |
| `unit` | `unitCode`, `symbol`, optional non-negative `decimalScale` (defaults `0`). |
| `specimen_type` | `specimenCode`. |
| `result_input_type` | `inputCode`, `valueKind` (`numeric`, `text`, or `coded`), optional `supportsUnit` (defaults `false`). |
| `lab_test` | `testCode`, `resultInputTypeKey`, optional `canonicalUnitKey`, optional non-negative `decimalScale`. The input type and unit references must resolve; a non-unit input cannot have a canonical unit. |
| `lab_panel` | `panelCode`. The panel must have at least one complete panel-item row. |
| `diagnosis_category` | `categoryKind` (`system` or `disease_group`), optional `parentMasterKey`, optional non-negative `sortOrder`; no `categoryCode`. A system has no parent; a disease group requires a system parent. |
| `diagnosis` | Empty detail object `{}` only. The diagnosis system is derived through each linked disease group’s system parent; no diagnosis code or direct system key is accepted. |

All master keys, relation keys, and path keys are semantic stable keys. The
normalizer keeps the exact typed values and does not create an ID, revision,
fingerprint, or publish authority.

## Relationship rules

### Classification and orders

`Classification Paths` rows require a `pathKey`, one `clinicalActionKey`, one
`chartGroupKey`, and one `taskRouteKey`. Each reference must resolve to the
corresponding record type, and one clinical action may have only one path in a
snapshot. The route must be one of the supported route tuples; a route with
`runtimeStatus: "held"` is rejected from a published path. An order must
reference a path, its optional sales-unit code must resolve to a `unit`, and
each species code must resolve to a `species` record.

### Laboratory

`Lab Panel Items` require a panel and a test reference. A panel cannot repeat a
test or a sort order and cannot be exported without at least one item.
`Lab Order Profiles` require an order and exactly one of
`labTestMasterKey` or `labPanelMasterKey`; the optional specimen key must
resolve to `specimen_type`. An order may have only one profile. An order whose
classification path is `NT_LAB` must have exactly one profile.

### Diagnosis

Diagnosis hierarchy is `system` → `disease_group`; a disease group can only
reference a system parent. `Diagnosis Category Links` must target a
`disease_group`, never a system root. The system for a diagnosis is derived
from the disease-group parent reached through its links. Each link references
an existing `diagnosis` and category, cannot duplicate a diagnosis/category
pair or sort order, and each diagnosis must have at least one link with exactly
one `isPrimary: true` link.

Diagnosis records and links remain authoring values rather than database
authority. CLINICAL-MASTER-PR-015 may publish them only after the diagnosis-only
adapter repeats this hierarchy/link validation and the private SQL publisher
assigns database identities, revisions, and one atomic release.

## Stable keys and authority boundary

Stable keys are required for release, source, record, path, and relationship
references. UUID-shaped keys and Airtable record identities such as `rec...`
are rejected. The validator rejects unknown contract fields and recursively
rejects Airtable-derived or generated authority fields, including Airtable
record IDs/URLs/names, `id`-style identity fields, formulas, lookups, generated
revision/release/timestamp fields, fingerprints, hashes, and similar server
authority projections.

No Airtable ID, formula, lookup, generated revision, generated release number,
generated timestamp, fingerprint, or hash can be used as a stable key or
export authority. The later publisher must derive its own server identity and
review/version authority.

## Price and weight-tier boundary

Canonical price fields are not part of this authoring contract. Any canonical
price field is rejected with `canonical_price_forbidden`. Set pricing, price
ranges, brackets, and weight-tier fields are rejected with
`workspace_order_set_pricing_forbidden`.

The workspace-owned `public.order_set_revision_price_ranges` table is the
owner for this data. It remains separate from clinical master authoring and
carries the workspace revision/range price authority.
The Airtable authoring export cannot provide, copy, or override those values.

## Determinism and error shape

The validator collects all issues before returning them. The normalizer throws
`ClinicalMasterAirtableExportValidationError` whenever any issue exists. Its
`issues` value is always sorted lexicographically by `path`, then `code`, then
`message`:

```json
[
  {
    "path": "records[cm.test.glucose].detail.resultInputTypeKey",
    "code": "detail_required",
    "message": "A non-empty value is required."
  }
]
```

The input registry sorts sources by `sourceKey` while resolving records; the
normalized envelope sorts records by `masterKey`, names by
language/kind/normalized name/sort order, paths by `pathKey`, panel items by
panel/sort/test, profiles by order, and diagnosis links by
diagnosis/sort/category. Optional strings become `null`; typed defaults are
applied consistently. Validation uses a usable stable key in an issue path
(`records[cm.test.glucose]`, for example), so reordering invalid rows does not
change the sorted issue list or normalized serialization.

## Local publish adapter boundary

PR-009 adds a local-only adapter after authoring normalization. It accepts the
normalized envelope, explicitly maps only the current publisher's 11 supported
record types, embeds each record's already-validated synthetic source, and
strips authoring-only fields (`changeSummary`, `sourceAssertionScope`,
`sourceNotes`, and `sourceKey`). It then calls the existing publisher
validator/normalizer; no adapter-side result is a release authority.

`diagnosis_category` and `diagnosis` records, plus all
`diagnosisCategoryLinks`, remain authoring-only. The adapter returns their exact
stable keys and counts in an `excluded` report instead of leaking them into the
publisher payload. Any other record type, unsupported relation, failed gate,
forbidden price/weight/Order Set field, or non-synthetic source fails closed.

CLINICAL-MASTER-PR-015 adds the separate
`server-clinical-master-diagnosis-publish-adapter.ts` path. It selects only the
reviewed diagnosis records and links from the same normalized synthetic
snapshot, produces a deterministic diagnosis-only payload, and never changes
the PR-009 adapter's exclusion behavior.

The local CLI is
`scripts/clinical-master-airtable-publish-adapter.ts`. With Node 23+, run:

```sh
node --experimental-strip-types \
  scripts/clinical-master-airtable-publish-adapter.ts \
  authoring-export.json [publisher-adapter-output.json]
```

It reads an existing JSON export and prints or writes deterministic payload and
exclusion JSON. It has no Airtable credentials or API integration.

## Publisher boundary and verification

The established order/laboratory publisher still rejects diagnosis records in
its legacy payload. The shared private entry point dispatches a diagnosis-only
payload to the isolated PR-015 publisher and rejects mixed payloads. Neither
adapter has an Airtable SDK or runtime credential dependency; only the private
SQL publisher can create release, version, review, typed projection, and
relationship rows.

The focused implementation verification covers the happy path, shuffled-input
determinism, normalization, table/type coverage, unknown/Airtable/generated
authority rejection, lifecycle/review/source gates, typed references,
laboratory and diagnosis failures, and price/weight-tier rejection. The PR-008
laboratory and diagnosis failures, price/weight-tier rejection, and the PR-009
adapter's 83-supported/24-excluded pilot shape with 5 paths, 13 panel items,
and 17 profiles. The PR-008 and PR-009 work items record the exact local
commands and the no-remote boundary.

[PR-008 work item](../../work/clinical-master/CLINICAL-MASTER-PR-008-airtable-authoring-export-contract.md)

[PR-009 work item](../../work/clinical-master/CLINICAL-MASTER-PR-009-airtable-publish-adopt-smoke.md)
