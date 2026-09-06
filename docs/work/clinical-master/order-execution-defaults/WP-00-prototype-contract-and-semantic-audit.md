---
id: "CLINICAL-MASTER-OED-WP-00"
type: "Work Item"
title: "Prototype Order Contract, Status, and Semantic Audit"
description: "Freezes the ownership, status, completeness, and deterministic semantic-audit contract for all 522 prototype master orders before category remediation begins."
status: "done"
area: "clinical-master"
priority: "P0"
tags:
  [
    clinical-master,
    order-defaults,
    semantic-audit,
    prototype-data,
    workspace-catalog,
  ]
target_pr: "Planning and read-only audit"
source_docs:
  - "CLINICAL-MASTER-ORDER-EXECUTION-DEFAULTS-REMEDIATION"
  - "CLINICAL-MASTER-PR-020"
  - "CLINICAL-MASTER-PR-022"
  - "CLINICAL-MASTER-PR-023"
dependencies:
  - "CLINICAL-MASTER-PR-020"
  - "CLINICAL-MASTER-PR-022"
  - "CLINICAL-MASTER-PR-023"
baseline_commit: "f564a493b52be6f5592bda6484dd0bcf9a8a2c4b"
updated: "2026-09-04"
---

# WP-00: Prototype Order Contract, Status, and Semantic Audit

## Goal

Freeze one machine-checkable contract that classifies every required execution
field on every one of the 522 deterministic prototype master orders as a valid
reusable default, an implemented resolver, legitimate encounter input, an
actual/result value, or a blocking defect before any category data is changed.

This work item is the first child of the
[Order Execution Defaults Remediation umbrella plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
It defines the gate used by later implementation packages; it does not itself
repair values, publish master data, adopt workspaces, or change runtime
behavior.

## Why This Work Exists

The current repository can transport a non-empty execution preset without
proving that the preset contains the reusable information needed to perform the
order. Several required fields are allowed to remain `required_manual`, and
Hospital Admin may display invented fallback values that are absent from the
persisted workspace row. The chart reads the persisted values and can therefore
show blanks or block confirmation even though Hospital Admin appears complete.

Counting 522 non-empty JSON objects proves transport coverage only. It does not
prove semantic completeness, correct ownership, persistence, prototype-ready
status, or Hospital Admin/chart parity.

WP-00 prevents later category work from hiding the same defect behind a new
status label, placeholder, or fallback value.

## Inherited Product Contract

The following decisions are fixed by the parent plan and are not reopened in
this work item:

1. Every master order has category-specific, versioned work details and
   reusable defaults.
2. Master orders are copied into each workspace. Authorized workspace users may
   customize their copy without mutating the CLAiR master.
3. A chart order starts from effective persisted workspace values, allows
   patient-specific planned edits, and freezes an immutable snapshot at
   confirmation.
4. Actual preparation, administration, acquisition, measurement, interpretation,
   or completion data is stored separately from defaults and planned values.
5. The current product is a deployed prototype with no partner hospital source.
   Required prototype defaults must therefore be plausible, deterministic,
   research-informed synthetic data rather than hospital-authored clinical
   values.
6. In-scope orders require no prototype-review lifecycle. They must be active,
   searchable, selectable, and confirmable while remaining explicitly
   synthetic and not clinically validated.
7. Hospital Admin and chart use persisted current-workspace catalog rows only.
   They must not inject fallback orders or fallback field values under any
   runtime condition; a violation blocks release.
8. Hospital Admin table rows show category-specific core work details. Missing
   persisted values are shown as `미설정`, never as invented values.
9. An empty workspace catalog produces an explicit empty state and zero chart
   candidates.

## Scope

- Freeze ownership vocabulary for master, workspace, runtime, encounter plan,
  actual/result, schema default, and not-applicable values.
- Freeze a multi-dimensional prototype status contract that separates active
  availability, synthetic provenance, and clinical validation without adding a
  prototype-review state.
- Inventory all execution fields exposed by the current category schemas and
  classify their intended owner.
- Define category-specific semantic-completeness rules.
- Define deterministic finding codes and blocking rules for all 522 fixture
  orders.
- Specify a read-only audit command and versioned report shape for a later
  implementation slice.
- Produce an order-by-order and field-by-field baseline audit from the frozen
  fixture after the audit tool is implemented.
- Record the research question, acceptable source types, and downstream owner
  for every missing reusable value, formula, unit, range, rounding rule, or
  instruction.
- Define Hospital Admin/chart reconciliation checks without changing either
  surface.
- Define the Korean mid-review report and require
  `$im-not-ai-codex:humanize-korean` after the factual content and citations are
  frozen.
- Route every blocking finding to a named downstream work package.

## Out Of Scope

- Performing the full clinical-value research or generating replacement
  synthetic values; that belongs to WP-01A and the category packages. WP-00
  only defines the required research questions and acceptable source types.
- Removing Hospital Admin fallback code or changing Admin/chart reads; that
  belongs to WP-01B.
- Implementing field-level master-to-workspace merge or lineage; that belongs
  to WP-02.
- Changing the master generator, fixtures, application code, database schema,
  migrations, RPCs, UI, or tests in this planning draft.
- Publishing or adopting master data in Supabase, changing a workspace, or
  modifying browser state.
- Claiming that synthetic prototype defaults are clinically validated or safe
  for real clinical use.
- Reclassifying actual/result fields as master defaults merely to make a
  completeness counter pass.

## Current Repository Baseline

Baseline commit: `f564a493b52be6f5592bda6484dd0bcf9a8a2c4b`.

This is repository and deterministic-fixture evidence only. It is not a fresh
claim about remote Supabase contents or the authenticated production UI.

The current
[generator](../../../../scripts/generate-clinical-master-order-execution-presets-v1.mjs)
initializes schema fields as `required_manual` and replaces that policy only
when a profile or explicit resolver supplies another policy. The current final
[fixture](../../../../tests/fixtures/clinical-master-order-execution-presets-v1.json)
contains 522 non-empty execution-preset objects, but the required-field
comparison has the following result:

| Clinical order type |  Orders | All current required preset/schema values present | Current required-value gap                                                                                |
| ------------------- | ------: | ------------------------------------------------: | --------------------------------------------------------------------------------------------------------- |
| `consultation`      |      55 |                                                 0 | `responsibleClinicianId` on 55; declared runtime-resolved                                                 |
| `clinical_lab`      |      86 |                                                74 | `specimenType` on 12; `required_manual`                                                                   |
| `imaging`           |      30 |                                                26 | `bodyRegion` on 4; `required_manual`                                                                      |
| `dispensing`        |     159 |                                               108 | dose, dose unit, frequency, duration, and total quantity on 51; route also absent on 4; `required_manual` |
| `treatment`         |     111 |                                                 0 | `administeredAmount` on 111 and site on 89; `required_manual`                                             |
| `hospitalization`   |      30 |                                                 0 | ward/cage on 30; declared workspace-resolved                                                              |
| `system_exam`       |      12 |                                                 0 | finding summary on 12; encounter/result-owned, not a master default                                       |
| `other`             |      39 |                                                39 | None in the current chart-required field set                                                              |
| **Total**           | **522** |                                           **247** | **275 rows require ownership-aware evaluation**                                                           |

The last column is not itself the final defect count. A missing value can be
valid only when its declared owner is correct and its resolver or input path is
implemented and tested. WP-00 must distinguish valid absence from a blocking
missing reusable default.

The generator currently emits `presetStatus: "synthetic_unreviewed"` and
`clinicalUseAllowed: false`. Those values encode an earlier review workflow and
may conflate prototype availability with clinical validation. The product does
not require a prototype-review state. WP-00 defines the target semantics below;
a later implementation package must replace or map the legacy fields without
weakening the explicit not-clinically-validated label.

## Definitions

| Term                      | Definition                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Work specification        | The category-specific fields, rules, units, instructions, outputs, and provenance needed to understand and perform an order.                                                         |
| Reusable default          | A value or rule that is stable enough to originate in the master and be copied into a workspace.                                                                                     |
| Effective workspace value | The persisted workspace override when present, otherwise the copied master value already stored in the workspace row.                                                                |
| Resolver                  | Implemented, permission-checked logic that supplies a workspace, runtime, or encounter value from an authoritative source. A policy string alone is not a resolver.                  |
| Planned value             | The effective default plus patient/encounter inputs and authorized chart edits, frozen at confirmation.                                                                              |
| Actual/result value       | What was actually prepared, administered, collected, measured, acquired, observed, interpreted, or completed. It does not backfill a master default.                                 |
| Synthetic prototype value | A deterministic, research-informed, plausibly usable prototype value with recorded provenance and limitations; not partner-hospital data and not clinically validated.               |
| Research requirement      | A precise unanswered question needed to create or validate a reusable synthetic value, including acceptable source types and the downstream work package that owns the answer.       |
| Semantic completeness     | Every required work field has the correct owner and either a valid value, a verified resolver, a legitimate required encounter input, or an actual/result contract.                  |
| Runtime fallback          | An order or apparent field value invented during read/render time when it is absent from the persisted current-workspace row. It is prohibited without exception and blocks release. |

## Field Ownership Contract

### Canonical owner classes

| Owner code           | Layer                     | Acceptable use                                                                                            | Required proof                                                                                                               |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `master_default`     | CLAiR master              | Reusable order definition, default, formula, unit, range, rounding rule, instruction, or output contract  | Versioned value/rule, provenance, type and domain validation                                                                 |
| `workspace_override` | Workspace catalog         | Hospital-specific product, equipment, provider, protocol, price, name, availability, or reviewed override | Persisted current-workspace value plus master lineage and edit authorization                                                 |
| `workspace_resolver` | Workspace service         | Current local resource such as a configured ward, cage, device, or provider                               | Implemented fail-closed resolver, permission check, empty/error behavior, test                                               |
| `runtime_resolver`   | Chart/runtime service     | Current clinician, patient weight, species, encounter, or other authoritative context                     | Implemented resolver, source identity, stale/missing behavior, confirmation test                                             |
| `encounter_input`    | Encounter chart plan      | A genuinely patient-specific planned selection or value that cannot be safely predetermined               | Required control, validation, explicit user action, confirmed snapshot                                                       |
| `actual_result`      | Fulfillment/result        | Actual execution, collection, measurement, finding, interpretation, variance, or completion evidence      | Separate schema and immutable link to the confirmed plan                                                                     |
| `schema_default`     | Master/workspace creation | Universal, non-clinical initialization value whose meaning does not vary by order, workspace, or patient  | Explicit schema declaration, non-clinical proof, and materialization in the authoritative persisted row before runtime reads |
| `not_applicable`     | None                      | Field does not apply to this order subtype                                                                | Explicit subtype rule; absence is intentional and machine-checkable                                                          |

### Existing policy evaluation

The current policy values remain inputs to the audit, not automatic pass
results:

| Existing policy        | WP-00 treatment                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preset_fixed`         | Candidate `master_default`; pass only when a valid value, provenance, unit, and rule are present.                                                                         |
| `derived_from_profile` | Candidate `master_default`; pass only when the deterministic profile and derivation are traceable.                                                                        |
| `schema_default`       | Candidate `schema_default`; pass only when it is non-clinical and materialized in the authoritative row before runtime reads. Reject read/render-time substitution.       |
| `workspace_resolved`   | Candidate `workspace_resolver`; pass only when a real persisted configuration/resolver and fail-closed path exist.                                                        |
| `runtime_resolved`     | Candidate `runtime_resolver`; pass only when the runtime source and confirmation behavior exist.                                                                          |
| `required_manual`      | Unclassified. It must be reassigned to `master_default`, `encounter_input`, `actual_result`, an implemented resolver, or `not_applicable`; it never passes by name alone. |
| `not_applicable`       | Candidate `not_applicable`; pass only when an explicit order-subtype rule proves the field does not apply.                                                                |

No downstream task may turn a missing reusable default into a pass merely by
renaming its policy to `required_manual`, `runtime_resolved`, or
`not_applicable`.

## Prototype Status Contract

The product does not require a prototype-review lifecycle. Availability, data
origin, and clinical evidence are separate dimensions. The target semantic
state for every in-scope order is:

| Dimension           | Required target               | Meaning                                                                                                                           |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Availability        | `active`                      | The persisted workspace order is available to Hospital Admin and, after documented filters, chart search.                         |
| Provenance          | `synthetic_research_informed` | The order uses deterministic prototype data created without a partner hospital and retains source/rationale metadata.             |
| Clinical validation | `not_clinically_validated`    | No claim is made that a veterinarian, partner hospital, regulator, or clinical governance body approved the values for real care. |

Searchable, selectable, editable, and confirmable are required behavioral
outcomes of an active semantically complete order, not a separate review state.

Requirements:

- Do not introduce `검수 대기`, review-pending, review-complete, unreviewed, or
  an equivalent prototype-review state.
- Active prototype use must never erase or obscure synthetic provenance or the
  not-clinically-validated limitation.
- Technical publication/adoption state is separate from all three dimensions.
- The exact persisted field names and backward-compatibility mapping are not
  invented in WP-00. They must be frozen before the first status migration or
  write is implemented.
- A single ambiguous field or boolean must not conflate prototype availability,
  synthetic provenance, and clinical validation.

## Category Completeness Matrix

The matrix defines semantic ownership. Exact storage fields and validators are
frozen in the category package before implementation.

| Category          | Required reusable master work contract                                                                                                                                             | Workspace-owned examples                                                             | Encounter/runtime-owned examples                                                         | Actual/result-owned examples                                                         | Hospital Admin row core details                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `consultation`    | Visit/work scope, assessment template, standard instruction, timing, required output                                                                                               | Local workflow, default instruction                                                  | Responsible clinician, patient-specific plan                                             | Authored findings and plan, completion                                               | Scope/type, timing, primary instruction                 |
| `clinical_lab`    | Specimen/collection requirements, panel-test-analyte membership, result type, unit, conditional reference-range/flag rules                                                         | Analyzer/method, provider, collection instruction, reviewed local range              | Selected panel, collection timing, clinical context                                      | Collected specimen, measured values, resolved range, flags, interpretation, reviewer | Specimen, panel/test scope, method/provider or `미설정` |
| `imaging`         | Modality, body region, standard views/positions, protocol, contrast/sedation policy, preparation, output requirement                                                               | Device, local protocol, preparation instruction                                      | Patient-specific position/view count, contrast/sedation decision                         | Acquired views, actual protocol, quality/repeat state, findings                      | Modality, region, standard views/protocol               |
| `dispensing`      | Product/ingredient and strength context, dose basis, dose/unit or formula, route, frequency, duration, theoretical total rule, preparation increment/rounding, storage/instruction | Product/formulation, concentration, preparation increment, label, reviewed overrides | Weight/context, selected dose, calculated total, adjusted planned dispense amount/reason | Actual prepared quantity, lot/expiry where scoped, variance, preparer/checker        | Dose/unit, route, frequency, duration, planned quantity |
| `treatment`       | Method, site policy, amount/dose rule and unit, frequency/schedule, staged procedure, preparation, exception rules                                                                 | Supplies/device, site convention, local instruction                                  | Patient-specific planned site, amount, schedule, exceptions                              | Actual administered/performed amount, site, time, performer, variance, response      | Method, planned amount/unit, site policy, schedule      |
| `hospitalization` | Default duration/care level, monitoring cadence, nursing/diet/isolation templates                                                                                                  | Ward/cage inventory, local care protocol                                             | Assigned ward/cage, patient-specific care plan                                           | Observations, interventions, handoffs, variance                                      | Duration, care level, cadence, ward/cage or `미설정`    |
| `system_exam`     | Body system, scope, method, laterality policy, expected result structure                                                                                                           | Local examination template                                                           | Selected site/laterality and intended scope                                              | Finding summary, abnormal findings, attachments, examiner                            | System, scope/method, laterality policy                 |
| `other`           | Explicit subtype schema, instruction, required attachments, destination, completion/result contract                                                                                | Local form and routing                                                               | Patient-specific request and instruction                                                 | Produced document, observation, completion evidence                                  | Subtype, instruction, destination/output                |

The row-core column is the minimum table-summary contract, not permission to
flatten every field into a generic table. Secondary details belong in the
detail drawer. A missing persisted core value renders `미설정` and produces a
blocking audit finding when the value should have been reusable or resolved.

## Semantic Audit Contract

### Finding codes

Every audited order/field emits exactly one primary finding code and may emit
additional evidence notes.

| Finding code                            | Blocking | Meaning                                                                                                                          |
| --------------------------------------- | :------: | -------------------------------------------------------------------------------------------------------------------------------- |
| `PASS_MASTER_BACKED`                    |    No    | Valid versioned reusable value/rule is present with required provenance.                                                         |
| `PASS_SCHEMA_SAFE_DEFAULT`              |    No    | Explicit universal non-clinical schema default is valid and already persisted before runtime.                                    |
| `PASS_WORKSPACE_RESOLVER`               |    No    | Workspace resolver is implemented, permission-checked, and tested.                                                               |
| `PASS_RUNTIME_RESOLVER`                 |    No    | Runtime resolver is implemented and confirmation behavior is tested.                                                             |
| `PASS_ENCOUNTER_INPUT`                  |    No    | Required absence is a legitimate explicit encounter input with validation.                                                       |
| `PASS_ACTUAL_RESULT`                    |    No    | Field correctly belongs only to fulfillment/result recording.                                                                    |
| `PASS_NOT_APPLICABLE`                   |    No    | Explicit subtype rule proves the field does not apply.                                                                           |
| `BLOCK_MISSING_MASTER_DEFAULT`          |   Yes    | Reusable work detail or rule is absent.                                                                                          |
| `BLOCK_MISSING_RESOLVER`                |   Yes    | Resolver policy exists but no verified authoritative resolver path exists.                                                       |
| `BLOCK_MISOWNED_FIELD`                  |   Yes    | Field is assigned to the wrong lifecycle layer.                                                                                  |
| `BLOCK_INVALID_UNIT_OR_FORMULA`         |   Yes    | Value, unit, formula, range, precision, or rounding rule is invalid or contradictory.                                            |
| `BLOCK_FALLBACK_ONLY`                   |   Yes    | Visible/order value exists only through a runtime/UI fallback.                                                                   |
| `BLOCK_NOT_PERSISTED`                   |   Yes    | Required master/workspace value is not stored in the authoritative row.                                                          |
| `BLOCK_PROJECTION_MISMATCH`             |   Yes    | Hospital Admin, chart search, or chart draft interprets the same persisted row differently.                                      |
| `BLOCK_DUPLICATE_OR_FOREIGN_ROW`        |   Yes    | Duplicate, stale, or another workspace's row contaminates the visible set.                                                       |
| `BLOCK_UNAVAILABLE_OR_CONFLATED_STATUS` |   Yes    | In-scope order is inactive/unavailable or a review/clinical-validation field is incorrectly used to gate prototype availability. |
| `BLOCK_UNKNOWN_SCHEMA_FIELD`            |   Yes    | Fixture or persisted field cannot be reconciled with the versioned category schema.                                              |

### Per-field pass rule

A required field passes only when all of the following are true:

1. Its lifecycle owner is explicit.
2. Its current policy agrees with that owner.
3. A reusable value/rule, implemented resolver, required encounter control,
   actual/result contract, persisted safe schema default, or explicit
   not-applicable rule exists as appropriate.
4. Its type, unit, allowed value, formula, precision, range, and conditional
   requirements validate.
5. Its source revision or resolver identity is traceable.
6. It does not depend on a display-only fallback.

An order passes only when every required field passes, all required status
dimensions pass, its category/subcategory mapping is valid, its stable identity
is unique, and no prohibited fallback or foreign-workspace evidence exists.

### Proposed read-only audit interface

The implementation slice should add:

- command implementation:
  `scripts/audit-clinical-master-order-semantic-completeness.mjs`;
- deterministic input:
  `tests/fixtures/clinical-master-order-execution-presets-v1.json` plus the
  versioned execution schemas and ownership matrix;
- machine-readable output in this work item's future `artifacts` directory,
  named `wp-00-semantic-audit.v1.json`;
- optional concise Markdown summary generated from the same JSON report.

The command must be read-only. It must not call remote services, mutate fixture
data, publish a master revision, adopt a workspace, or rewrite source files.

Minimum report fields:

```text
auditVersion
baselineCommit
fixturePath
fixtureSha256
schemaVersion
ownershipContractVersion
generatedAt
totalOrderCount
categoryCounts
passCount
blockingOrderCount
findingCounts
orders[]:
  orderId
  orderCode
  displayName
  clinicalOrderType
  category/subcategory
  prototypeStatusDimensions
  fields[]:
    fieldKey
    required
    present
    currentPolicy
    targetOwner
    researchRequired
    researchQuestion
    acceptableSourceTypes
    findingCode
    blocking
    evidence
    targetWorkPackage
```

The semantic content must be deterministic for identical fixture, schema, and
ownership-contract inputs. `generatedAt` may vary, but it must be excluded from
the semantic fingerprint. The command exits non-zero when any blocking finding
exists, the order count differs from 522, an ID is duplicated, or an order/field
is unclassified.

## Hospital Admin And Chart Reconciliation Contract

The later implementation and browser verification must prove all of the
following against the same current workspace:

1. Hospital Admin total/category/subcategory counts equal the persisted catalog
   projection, with no missing, duplicate, stale, or foreign rows.
2. Each Admin row shows its category-specific core persisted/effective details,
   or `미설정`; the drawer shows the full stored details, status dimensions,
   master lineage, and provenance.
3. Edit-save-reload preserves an authorized workspace override without changing
   the master or another workspace.
4. Use-stop removes the order from chart candidates, and reactivation restores
   it after the same documented filters are applied.
5. Chart candidates equal the eligible subset of persisted Admin rows after
   workspace, availability, species, category-tab, and other documented filters.
6. An eligible order appears in chart `전체` and its mapped category tab.
   Dispensing maps to `조제`; treatment maps to `처치`.
7. Selecting a candidate pre-fills the chart draft from the same effective
   values visible in Admin, while patient-specific changes affect only the
   encounter draft.
8. Empty, loading, error, unauthorized, stale-revision, and conflict states are
   explicit. None may be replaced with fallback orders or values.

These checks have no fallback exception. A fallback order, read-time schema
default, invented visible value, or substituted fixture is a blocking failure,
even when it makes a prototype screen easier to demonstrate.

Search-tab visibility and semantic default completeness are separate checks. A
strict tab filter may correctly hide a dispensing order from `처치`, but it may
not explain or excuse blank dispensing defaults in `조제` or `전체`.

## Work Sequence

### WP-00.1 — Freeze vocabulary and status semantics

- Confirm the owner codes and three independent status dimensions without a
  prototype-review lifecycle.
- Record the exact persisted status-field mapping decision required before an
  implementation migration.

### WP-00.2 — Extract schemas and fields

- Enumerate all required and conditional fields from the current execution
  schemas.
- Identify fields present in fixtures but absent from schemas, and vice versa.

### WP-00.3 — Freeze the ownership matrix

- Classify every category field by target owner.
- Require an explicit subtype condition for `not_applicable`.
- Identify formulas, ranges, units, and reference data requiring category work.

### WP-00.4 — Record research requirements

- For every missing reusable value or rule, state the exact question WP-01A
  must answer.
- Record acceptable source types, affected order/category, validation need, and
  downstream owner without selecting the final clinical value in WP-00.
- Mark ownership questions that require limited source checking before they can
  be classified safely.
- Route the frozen inventory into `$deep-research-work:deep-research`; require
  claim-family planning, primary or first-party source priority,
  contradiction recording, explicit limitations, and independent spot checks
  for high-impact rules.

### WP-00.5 — Freeze semantic rules

- Convert the finding-code table into executable rules.
- Separate structural transport checks from semantic completion checks.
- Freeze what blocks prototype activation, chart selection, and confirmation.

### WP-00.6 — Implement the read-only audit tool

- Generate the machine-readable report and summary.
- Add deterministic tests for counts, fingerprints, and representative finding
  classifications.

### WP-00.7 — Run the 522-order baseline audit

- Audit every order and every required/conditional field.
- Route each blocking finding to exactly one remediation package.
- Confirm that no `required_manual` field remains unclassified.

### WP-00.8 — Product decision and contract freeze

- Resolve ambiguous ownership/status decisions with the product owner.
- Mark the contract frozen only after every exception has an explicit rationale.
- Use the frozen report as the input boundary for WP-01A through WP-09.

## Korean Mid-Review Report Contract

After WP-00 and WP-01A produce their frozen machine-readable and source-ledger
artifacts, create one Korean decision report for the product owner. It must
include:

- a short Korean executive summary;
- category-level complete, incomplete, and blocking counts;
- category-specific ownership and research-needs summaries;
- representative order examples and proposed default/rule rationale;
- source classes, direct source links, synthetic assumptions, and limitations;
- links to the complete 522-order audit and candidate artifacts;
- only the unresolved items that require a product decision.

The factual Korean draft must then be processed with
`$im-not-ai-codex:humanize-korean` using the skill's current mode policy. The
humanization pass may improve Korean rhythm and remove translation-like or
AI-like phrasing, but it must not change names, IDs, dates, counts, units,
formulas, ranges, clinical claims, citations, limitations, finding severity, or
decision status.

Keep the skill's input, metrics, rewrite, and audit artifacts under
`_workspace/{run_id}/` as temporary run evidence. The human-readable report in
the work package remains the review deliverable; `_workspace` artifacts do not
become canonical clinical evidence. If the skill is unavailable, stops because
the change rate is too high, or fails fidelity verification, do not present the
report as final. Preserve the factual draft and disclose the blocked report
gate.

## Downstream Handoff Map

| Finding or responsibility                                              | Owning package |
| ---------------------------------------------------------------------- | -------------- |
| Research sources, plausible synthetic values, deterministic generation | WP-01A         |
| Runtime fallback removal and persisted Admin/chart parity              | WP-01B         |
| Field-level master/workspace lineage and non-destructive merge         | WP-02          |
| Dispensing defaults and full vertical flow                             | WP-03          |
| Treatment defaults and full vertical flow                              | WP-04          |
| Laboratory requirements and broad external landscape research          | OED-LAB-00/01  |
| Laboratory CBC proof, data model, and complete vertical flow            | OED-LAB-02–04  |
| Imaging defaults and vertical flow                                     | WP-06          |
| Consultation, hospitalization, system exam, other categories           | WP-07          |
| Planned-versus-actual execution/result separation                      | WP-08          |
| Full 522 audit, adoption, workspace proof, rollout, rollback           | WP-09          |

WP-00 owns classification and the audit contract. It does not absorb the
remediation assigned to those packages.

## Delivered Review Package

- [Versioned category field/ownership matrix](./artifacts/wp-00-field-ownership.v1.json)
  with no unclassified schema field.
- [Frozen 522-order manifest](./artifacts/wp-00-frozen-manifest.v1.json) with
  exact identities, categories, species scope, and input fingerprints.
- [Machine-readable semantic audit](./artifacts/wp-00-semantic-audit.v1.json)
  with finding-to-work-package routing.
- [Read-only audit script](../../../../scripts/audit-clinical-master-order-semantic-completeness.mjs)
  and [focused Node test](../../../../tests/clinical-master-order-semantic-audit.test.mjs).
- Frozen prototype status, zero-fallback, Hospital Admin/chart reconciliation,
  and downstream handoff contracts in this work item.
- [Korean WP-00·WP-01A review report](WP-00-01A-mid-review-report.ko.md),
  finalized through `$im-not-ai-codex:humanize-korean` fast mode.

The product owner accepted this package and its six shared foundation decisions
on 2026-09-04. `done` is the repository work-item status only; it is not an
order lifecycle state and does not authorize fixture, runtime, database,
workspace, or remote application.

## Done When

- [x] All 522 fixture orders are present exactly once in the audit input and
      report.
- [x] Every required and conditional category field has one target owner.
- [x] Every current `required_manual`, `workspace_resolved`, and
      `runtime_resolved` field has a verified classification; none passes on its
      policy label alone.
- [x] Every missing field is either proven valid by owner/resolver/input/result
      contract or emitted as a blocking finding with one downstream owner.
- [x] Category completeness rules cover consultation, laboratory, imaging,
      dispensing, treatment, hospitalization, system examination, and other.
- [x] Active availability, synthetic provenance, and clinical validation are
      represented independently without a prototype-review state.
- [x] Every missing reusable value or rule has a precise research question,
      acceptable source types, and a downstream owner before WP-01A begins.
- [x] The audit is deterministic, read-only, and exits non-zero on blocking,
      duplicate, count, or unclassified-field failures.
- [x] Hospital Admin row-core/detail/status/edit/reload/availability checks and
      Admin/chart candidate reconciliation are specified.
- [x] Empty, incomplete, failed, stale, and unauthorized states are defined as
      downstream zero-fallback proof requirements. Runtime proof remains
      explicitly assigned to WP-01B.
- [x] The Korean mid-review report covers the required decision sections and
      passes the current `$im-not-ai-codex:humanize-korean` mode and fidelity
      checks without changing facts, numbers, units, formulas, citations, or
      limitations.
- [x] The parent plan links to this child work item.
- [x] No runtime, fixture, database, workspace, browser, or remote state was
      changed by this local audit package.

## Verification

Completed focused checks:

- `node scripts/audit-clinical-master-order-semantic-completeness.mjs --check --allow-blocking`
- `node --test tests/clinical-master-order-semantic-audit.test.mjs`
- exact 522 count, 510 persisted plus 12 proposal-only identities, category
  distribution, unique IDs, and species-scope assertions;
- deterministic semantic audit fingerprint
  `ed9d88c937cc8d88621eb430373b9c7277debc8ed61d3d547978bffd1141a18d`;
- deterministic manifest fingerprint
  `f2643f86a85d2c4981446de1b4d09a4e383853f32f4ab592552030bbc65f5685`;
- strict audit exit remains non-zero while any blocking order exists;
- source inspection and test prove the audit performs no network or database
  write.

Formatting, local-link, diff, and repository docs checks are rerun at the final
handoff. Runtime fallback and Hospital Admin/chart projection checks remain
unverified by design and are assigned to WP-01B.

## Risks And Decisions To Freeze

- The existing `presetStatus` and `clinicalUseAllowed` fields may impose an
  unnecessary review lifecycle or conflate prototype availability with clinical
  validation. The exact removal, schema migration, or compatibility mapping
  must be decided before any status write.
- Some currently required chart fields may actually be actual/result data. The
  audit must classify ownership before later work relaxes or adds a default.
- A resolver policy can conceal a missing implementation. Resolver existence,
  permission, and failure behavior must be proven, not inferred.
- A plausible number without source/rationale, unit compatibility, and
  deterministic generation is still arbitrary prototype data.
- Historical documents contain remote verification from earlier dates. WP-00
  must not reuse those claims as current workspace proof.

## Handoff Notes

- Product-owner review is now the active gate. Do not start WP-01B, WP-02, or
  any applied category work until that review is accepted.
- The audit used the frozen fixture and current schema without querying or
  mutating remote data.
- Preserve the primary worktree's unrelated changes and stage only this work
  item's files when delivery is later approved.
- Before implementing any persistent status or data change, create a PR-sized
  child work item and apply the repository's approval and rollback gates.
- If an ownership decision is ambiguous, leave a blocking finding and request a
  product decision. Do not invent a fallback value or silently classify it as
  manual.
- Finalize the Korean owner-facing report only after the technical audit and
  source ledger are frozen, then run `$im-not-ai-codex:humanize-korean`; never
  humanize the underlying machine-readable artifacts.
- WP-00 freezes research questions and acceptance rules. WP-01A performs the
  actual `$deep-research-work:deep-research` run and preserves its source
  ledger; WP-00 does not silently select clinical values.

## Related Sources

- [Parent remediation plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md)
- [CLINICAL-MASTER-PR-020 workspace dispensing presets](../CLINICAL-MASTER-PR-020-workspace-dispensing-preset-management.md)
- [CLINICAL-MASTER-PR-022 all-category presets](../CLINICAL-MASTER-PR-022-all-category-order-execution-presets.md)
- [CLINICAL-MASTER-PR-023 Plan/Order authority](../CLINICAL-MASTER-PR-023-plan-order-authority-enrichment.md)
- [Execution schema](../../../../src/features/chart/order-execution-domain.ts)
- [Execution-preset generator](../../../../scripts/generate-clinical-master-order-execution-presets-v1.mjs)
- [Frozen execution-preset fixture](../../../../tests/fixtures/clinical-master-order-execution-presets-v1.json)
