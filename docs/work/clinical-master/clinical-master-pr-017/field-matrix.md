# Dispensing Order Master V1 Field Matrix And Contracts

Status: `implemented; Airtable and inactive Supabase publish/adoption verified`

This contract defines how the technical dataset may move from authoring into the
private clinical master, a workspace-owned catalog, an immutable chart order,
fulfillment, and billing. It does not authorize any write or clinical activation.

## Authority Model

| Meaning | Authoring input | Canonical authority | Workspace projection or override | Confirmation snapshot | Validation rule |
| --- | --- | --- | --- | --- | --- |
| Stable dispensing order identity | `masterOrderId` | `master.master_records` plus `master.orders` | Copy `source_master_record_id` and revision; never rename the identity | Master ID/key/revision and workspace row ID/revision | Unique, immutable, never derived from a display name |
| Product identity | VMD product ID and authorization number | `master.medication_products` | Read-only lineage | Product ID, authorization number, source jurisdiction | A product source ID is unique within authority and jurisdiction |
| Active ingredient composition | Normalized ingredient list and strength expressions | `master.medication_ingredients` plus `master.medication_product_ingredients` | Not hospital editable | Ingredient IDs/names, presentation and concentration values actually selected | Units required; ingredient and strength remain separate relational values |
| Dosage form and route | Official product database/SPC | `master.medication_products` and `master.dispensing_order_profiles` | A hospital may select a reviewed local dispensing preset, not alter canonical product facts | Form and applied route | Route must be compatible with the reviewed profile and product form |
| Species applicability | Official SPC target species | `master.medication_species_applicability` | Hospital admins may freely narrow or broaden the workspace catalog species set; the canonical master fact is unchanged | Canonical species, workspace scope, patient species, and any extra-label attestation | A patient species outside the master-approved set requires an active veterinarian actor, explicit confirmation, a reason of at most 500 characters, and immutable lineage; workspace before/after species changes are audited |
| English and Korean display | Official English name plus draft Korean form label | Versioned `master.master_record_names` | Hospital display/billing names may differ; canonical names stay immutable | Standard, hospital, and billing names used | Korean clinical translation must be named-review approved before activation |
| Product storage and packaged shelf life | Official SPC extraction | `master.medication_product_handling` with evidence assertion | Not an untracked free-text override | Relevant handling text/version | Product shelf life is not lot expiry or compounded BUD |
| Dose, frequency, duration, quantity, repeats | Intentionally absent in V1 | Future named-veterinarian-reviewed species/profile defaults | Hospital may create a separately reviewed local preset | Exact values and units confirmed for the encounter | Null is valid; no guessed or label-copied default may publish |
| Evidence document | SPC URL, SHA-256, page count, revision | `master.evidence_documents` | Read-only | Evidence document ID/version used | Official source, immutable content hash, retrieval date required |
| Field-level evidence | Direct/inferred/not-found locator and extraction status | `master.evidence_assertions` | Read-only | Assertion IDs for clinically material fields | Direct, inferred, and not-found must never collapse into one confidence state |
| Clinical review | Pending in this dataset | `master.clinical_reviews` with named reviewer identity and immutable decision | Workspace acceptance is separate and cannot satisfy it | Review ID, decision, reviewed revision, timestamp | Reviewer must be an eligible veterinarian; self-declared labels are insufficient |
| Korean regulatory profile | Not verified/not screened | `master.medication_regulatory_profiles` | Read-only jurisdictional projection | Jurisdiction and reviewed status | UK authorization cannot be treated as Korean authorization |
| Controlled-substance status | Not screened | Regulatory profile plus separately approved permission/audit policy | No workspace override | Reviewed status and policy version | Unscreened or controlled rows cannot activate in this phase |
| Clinical-use gate | `false` | Database-computed publication/adoption predicate | Cannot be edited directly | Gate result and blocking reasons | All required evidence, reviews, regulatory checks, and lifecycle states must pass |
| Destination and task requirement | `dispensing`, `true` only after approved profile publication | Classification path/NT route | Deterministic workspace projection | Applied destination and task-required flag | Client input cannot change the server-owned route |
| Billing policy and price | No master price authority | Workspace catalog | Hospital owns explicit price, unit, tax, billing reflection | Effective price/unit/tax/amount basis | Unset differs from zero; billing does not infer price from medication evidence |

## Proposed Additive Canonical Tables

| Table | Key fields | Purpose and invariant |
| --- | --- | --- |
| `master.medication_ingredients` | `id`, `ingredient_key`, reviewed names | Stable ingredient vocabulary; names are not identity |
| `master.medication_products` | `id`, `authority`, `jurisdiction`, `source_product_id`, `dosage_form_code`, lifecycle | One manufactured product per official identity; unique authority/jurisdiction/source key |
| `master.medication_product_ingredients` | product, ingredient, strength values/units, strength kind, sort order | Normalized composition; presentation and concentration are distinct |
| `master.medication_species_applicability` | product, species code, evidence assertion | Canonical species limit; unique product/species pair |
| `master.medication_product_handling` | product revision, packaged/open shelf life, storage codes | Label handling facts, explicitly separate from dispense-event lot/expiry/BUD |
| `master.dispensing_order_profiles` | master order, product, reviewed route, default-state lifecycle | Atomic searchable dispensing order; V1 has no dose/frequency/duration defaults |
| `master.evidence_documents` | authority, URL, content SHA-256, retrieved date, revision | Immutable official evidence identity |
| `master.evidence_assertions` | subject, field path, document, locator, evidence mode, extraction status | Field-level provenance; not-found is first-class |
| `master.clinical_reviews` | subject revision, reviewer user ID, reviewer role proof, decision, timestamp, supersedes | Named immutable review decision; admin adoption is not clinical review |
| `master.medication_regulatory_profiles` | product, jurisdiction, authorization, controlled status, review version | Jurisdiction-specific gate; Korean status is required for Korean activation |
| `private.clinical_master_dispensing_release_payloads` | release ID, canonical payload, content SHA-256 | Immutable reviewed release input and retry identity |

These tables are additive. The existing generic order payload is not promoted to
the authority for composition, evidence, regulatory review, or clinical review.
No migration is authorized by this design document.

## Authoring And Publication States

```text
draft
  -> technical_validated
  -> clinical_review_pending
  -> clinical_review_approved
  -> regulatory_review_approved
  -> published_inactive
  -> workspace_adopted_pending_activation
  -> workspace_active
```

Rejection, supersession, emergency block, and deprecation are explicit terminal
or review states. A workspace administrator may accept a catalog update, but that
administrative event never advances `clinical_review_pending`.

The database-computed clinical-use gate is true only when all of the following
are true for the exact immutable revision:

1. technical validation passes and field-level evidence exists;
2. a named eligible veterinarian approves the clinical content;
3. Korean authorization and controlled-substance screening are approved;
4. the Korean display translation is approved;
5. the master and product lifecycle are publishable and not emergency blocked;
6. the target workspace intentionally activates the adopted row; and
7. the requested patient species and route are compatible at confirmation.

## Airtable Authoring Shape

The authoring base needs separate linked tables for `Dispensing Orders`,
`Medication Products`, `Active Ingredients`, `Product Ingredients`, `Species
Applicability`, `Evidence Documents`, `Evidence Assertions`, `Clinical Reviews`,
and `Regulatory Profiles`. Friendly formulas and lookups may aid review, but the
publisher owns canonical IDs, derived keys, lifecycle transitions, fingerprints,
and cross-table validation.

The 108-row dataset is not compatible with the current eight-table/65-field base
without this additive schema. Creating these tables or 100+ linked records is a
separate approval-gated persistent action.

## Workspace Projection

Only a clinically and regulatorily publishable master revision may become a
selectable workspace order. Adoption creates or updates exactly one
`order_catalog_items` row per `(workspace_id, source_master_record_id)` and keeps:

- source master ID/revision and source projection fingerprint;
- immutable canonical standard name plus separately editable hospital/billing names;
- canonical species, form, route, product, evidence-version, and clinical-review lineage;
- `clinicalOrderType = dispensing`, `destinationModule = dispensing`, and
  `taskRequired = true` as server-owned projections;
- workspace-owned price, tax, sales unit, availability, and billing-reflection policy.

The current `MedicationOrderMetadata` requires non-null dose defaults and supports
only `PO`, `IV`, `CRI`, and `SC`. It cannot represent this dataset's oral,
cutaneous, ophthalmic, otic, or transdermal profile safely. Implementation must
replace required defaults with a versioned nullable prescription-input contract
and expand route vocabulary before any adoption. It must not coerce routes or
invent values to satisfy the current type.

## Chart Draft And Immutable Confirmation Snapshot

Selecting a candidate creates a draft only. It produces zero fulfillment work
items, queue rows, billing candidates, or dispense events. The chart requires the
clinician to enter and confirm the encounter-specific prescription fields allowed
by the reviewed profile.

The immutable confirmation snapshot must include:

- master order/product IDs and revisions, workspace catalog ID/revision, evidence
  version, clinical-review ID, and gate result;
- canonical and applied names, ingredients, structured strength, dosage form,
  route, species, and regulatory jurisdiction;
- clinician-entered dose basis/value/unit, frequency, duration, total quantity,
  repeat/instruction fields, and any approved taper/compound note;
- destination/task-required/billing flags and server-owned price snapshot;
- confirmation actor/time and a deterministic snapshot fingerprint.

Lot number, manufacturer expiry, opening/reconstitution time, calculated BUD, actual
dispensed quantity, substitutions, waste, checker, and completion time belong to a
later dispense event. They are not copied from the master or guessed at chart entry.

## Task, Queue, Billing, And Dispense Cardinality

| Event | Order | Fulfillment task | Queue projection | Billing candidate | Dispense event |
| --- | ---: | ---: | ---: | ---: | ---: |
| Search/select draft | 0 durable or 1 draft, per current chart contract | 0 | 0 | 0 | 0 |
| Cancel before confirmation | no confirmed order | 0 | 0 | 0 | 0 |
| Confirm one valid atomic dispensing order | 1 | 1 | 1 view of the same task | 0 until billing action | 0 |
| Retry the same confirmation/idempotency key | unchanged | unchanged | unchanged | unchanged | unchanged |
| Chart `Order 청구`, billable row | unchanged | unchanged | unchanged | exactly 1 active candidate | unchanged |
| Billing retry | unchanged | unchanged | unchanged | unchanged | unchanged |
| Dispensing completion | status transition only | same task becomes completed | same queue row reflects completion | no implicit duplicate | exactly 1 immutable completion event |
| Return/re-request | order/work state transition | same lineage, audited event | same queue lineage | no automatic advancement | no replacement event until completion |

The existing fulfillment work item is the durable task; the dispensing screen is
a queue projection, not a second task authority. Unique order and idempotency keys
must prevent duplicate Task/Queue/Billing/dispense artifacts.

## Validation And Negative Rules

- Reject duplicate stable ID, canonical semantic key, source product ID, evidence
  document hash conflict, and workspace source-master pair.
- Reject missing ingredient, structured strength, dosage form, route, species,
  official evidence hash, or clinical-review lineage for activation.
- Preserve unknown dose, BUD, regulatory, and translation values as null/pending
  with a reason; never coerce or infer them.
- Reject unsupported species/route, paused or emergency-blocked product, stale
  revision, client-supplied price/name authority, and cross-workspace references.
- Enforce RLS and server/RPC writes for master, workspace catalog, orders,
  fulfillment, billing, dispense events, and audit records.
- Publish/adopt/confirm retries must be idempotent and produce the same fingerprint.
- The outbox may be persisted and measured, but no external delivery is claimed
  until a worker with claim/retry/dead-letter behavior exists and is verified.
