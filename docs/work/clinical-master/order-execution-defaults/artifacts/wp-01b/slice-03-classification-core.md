# WP-01B Slice 03 — Classification and core display checkpoint

Historical checkpoint. Follow-up: [exact-path transport and remaining fine-data gap](./slice-03-taxonomy-read.md).

Date: 2026-09-06. Local code/contracts implemented; **Slice 03 remains in progress**.
Do not advance to Slice 04 before authoritative fine-taxonomy read transport is
connected and verified. No remote DB, master, migration, commit, push or deployment.
Preserved previous Slice 01–02 changes and unrelated dirty checkout work.

## Findings and decisions

- Admin exposes `classificationPathId` as an opaque generated UUID, not semantic
  taxonomy. No runtime UUID-to-subcategory registry exists. Chart SQL snapshots
  expose a path key but Admin does not; do not import authoring fixtures to fill it.
- Name/category-label substring checks and `dispensingLineage => injection` were
  invalid classification rules. Removed these, including unknown pathology => etc.
- Explicit saved clinical type determines the broad category; `system_exam`
  intentionally wins even when its service group is misc. Saved known groups
  establish only a broad category when the type is absent.
- Admin gateway adds `clinicalOrderTypeSource` (persisted/derived). An explicitly
  invalid raw type fails the whole mapping rather than becoming inferred persisted
  truth. A derived execution contract is not surfaced as a saved Admin type.
- Exact unambiguous types can establish system-exam, external-lab, hospitalization
  or other subcategories. Other fine categories remain unresolved until a semantic
  taxonomy read contract is supplied. No clinical/type/name heuristic fills them.
- Distinguish `type_missing`, `subcategory_missing`, `taxonomy_unavailable` (UUID
  exists but semantic lookup unavailable), and `resolved`. Table and drawer show
  the same classification. No classification ID or protected type/category field
  is added to update patches.
- Category-wide sidebar leaves keep unresolved rows in their actual broad category;
  a confirmation-needed aggregate also exposes them. Store default selection is
  category-wide, not a now-empty guessed subtype. Fine category lists may be empty.
- Core columns are fixed by clinical type, not by which fields happen to be filled.
  Table and drawer share the same core reader. Zero/false remain present; empty keys
  stay visible. Presence is not clinical validation, approval or confirmability.

## Core field matrix

| Clinical type | Core fields |
| --- | --- |
| consultation | occurrenceCount, timing, instructionSummary |
| clinical_lab | specimenType, testPanel, collectionCondition |
| imaging | bodyRegion, position, viewCount, contrastRequired, sedationRequired |
| external_lab | providerId, specimenType, testItem, shippingCondition |
| dispensing | doseBasis, dose/doseUnit, route, frequency, durationDays, totalQuantity/totalQuantityUnit |
| treatment | method, site, administeredAmount, frequency, schedule |
| hospitalization | durationDays, careLevel, monitoringInterval |
| system_exam | bodySystem, examScope, examMethod |
| other | structuredValue |

Dispensing retains saved identity fields (ingredient/strength and dosage form) in
addition to the core execution fields. Instructions, storage and review columns
were removed from the table, not from data or the detailed editor. Notes, exceptions,
attachments and authority remain in details. The mixed confirmation-needed list
uses a bounded summary rather than every category's columns. Runtime clinician and
ward assignment are not fabricated as master defaults.

## Verification

| Check | Result / boundary |
| --- | --- |
| `npx playwright test --config playwright.catalog-contract.config.ts --reporter=dot` | 106 passed: previous 82 + 24 new contracts, synthetic fixtures, no browser/DB |
| Targeted ESLint | Passed: five touched Admin source files and new spec |
| `npx tsc --noEmit --incremental false` | Existing BlockNote dependency/related failures; final output contains no touched-file diagnostics |
| `git diff --check` | Passed |
| `npm run docs:check` | Existing missing persona-qa guide referenced by prior workspace summary and Slice 01 record; not fixed here |
| Independent read-only review | One must-fix corrected: invalid raw type truthiness laundering; tests now cover bogus, whitespace and number 17 through gateway |
| Static HTML report | Desktop 1440×1000 and mobile 390×844 inspected; mobile width 390 with no page overflow, zero broken section anchors. Not EMR browser acceptance |

New tests cover all nine clinical types, label/UUID rename independence,
provenance not implying injection, no pathology fallback, category-wide and
unresolved discoverability, stored versus derived/invalid type, protected-taxonomy
update omission, saved-default preservation, stable core columns, zero/false and
secondary column exclusion. Static UI-source assertions are not DOM acceptance.

## Changed source

- `src/features/hospital-admin/data.ts`: deterministic classification/presence,
  shared selection and classification label helpers.
- `src/features/hospital-admin/server-order-catalog-core.ts`: Admin type provenance
  and invalid raw type rejection. Prior Slice 01–02 edits in this file remain.
- `src/features/hospital-admin/order-core-details.ts`: shared core field matrix/read.
- `src/features/hospital-admin/module.tsx`: category-wide/missing views, core columns
  and drawer summary, remove secondary dispensing columns, missing-state labels.
- `src/features/hospital-admin/store.ts`: category-wide default selection.
- `tests/hospital-admin-classification-core.spec.ts`, contract Playwright config.

## Exact next step — finish Slice 03 taxonomy read gate

1. Inspect the persisted classification-path read surface and authorization. Choose
   the smallest authoritative read contract exposing path identity/key/semantics to
   Admin without fixture import, UUID guessing or name interpretation.
2. Explicitly scope any required SQL/RPC change before remote action; this checkpoint
   authorizes no remote mutation. Existing update protection and DB creation's
   unclassified-path behavior remain unchanged and must not be called fallback-free.
3. Map genuine returned semantics into fine categories and pathology filters, with
   missing/conflicting/foreign-path cases and real readback checks.
4. Only then start Slice 04 candidate ID/eligibility/default trace; Slice 05 owns
   authenticated screen/save-reopen/workspace-switch acceptance.

Known prior gates remain: UI seeds, unavailable lab deletion gateway, qod/sachet
authoring-schema mismatch, BlockNote install baseline, and all-category live parity.
CBC nested/atomic orders and ranges remain OED-LAB-04, not this slice. No candidate
clinical values were generated or applied here.

[Korean HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-slice-03-classification-core-report.html)
uses humanize-korean fast run 2026-09-06-006. Bundled metrics script is missing;
manual meaning-preserving copy review was performed without numeric risk scores.
