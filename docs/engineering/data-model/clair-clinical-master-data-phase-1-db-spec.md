---
id: ENGINEERING-DATA-MODEL-CLAIR-CLINICAL-MASTER-DATA-PHASE-1-DB-SPEC
type: Data Contract
title: "CLAiR Clinical Master Data Phase 1 DB Specification"
description: "Defines the implementable phase-1 PostgreSQL structure for the CLAiR clinical master, workspace order catalog, lab panels, Order Set revisions, and applied order snapshots."
status: completed
area: engineering
doc_type: data-contract
tags: [clinical-master-data, order-catalog, order-set, lab-panel, postgres, supabase]
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-08-21
---

# CLAiR Clinical Master Data Phase 1 DB Specification

This document is the implementable phase-1 database specification derived from [CLAiR Clinical Master Data Target Architecture](./clair-clinical-master-data-target-architecture.md).

Korean reader companion: [CLAiR 임상 마스터 데이터 1단계 DB 상세 명세](./clair-clinical-master-data-phase-1-db-spec.ko.html).

It defines target tables, columns, ownership, constraints, indexes, server
mutation boundaries, migration order, and verification. The scoped Phase 1
implementation and closeout evidence are summarized in §17.1. Completion here
does not claim clinical-content validation, full launch readiness, or Phase 2–5
delivery.

## 1. Phase-1 Outcome

Phase 1 proves that the new master and order architecture works as a system:

```text
Airtable authoring and review
  -> validated server publisher
  -> private PostgreSQL master release
  -> workspace-owned order_catalog_items copy
  -> chart individual order or Order Set application
  -> immutable public.orders snapshots
  -> fulfillment and billing
```

Phase 1 is complete only when:

1. a master release can be published and applied idempotently;
2. two workspaces can receive the same release without crossing boundaries;
3. unmodified copies auto-update while customized copies receive whole-row review;
4. hospital-local orders remain detached from master updates;
5. an individual order works through chart confirmation, fulfillment, and billing;
6. an Order Set works through chart selection, expansion, encounter-only editing, confirmation, fulfillment, and billing;
7. historical snapshots remain unchanged after master, workspace, price, or set revision changes.

Clinical completeness is not the phase-1 gate. Synthetic structural data may prove the system, but it must not be displayed as clinically verified guidance.

## 2. Scope And Non-Goals

### 2.1 Included

- private master identity, name, source, release, revision, and review records;
- X/T/A, CG, NT, classification paths, and canonical atomic orders;
- dog/cat, units, specimen types, and result-input types required by the validation fixture;
- canonical lab tests, panels, panel members, and one-test-or-panel order profiles;
- workspace master copies and whole-row update review;
- stable Order Set identity, immutable revisions, pinned child-set revisions, and range-price brackets;
- immutable chart order snapshots for individual orders and Order Sets;
- workspace RLS, publisher boundaries, idempotency, audit, and verification requirements.

### 2.2 Excluded

- bulk VetSCT, LOINC, ATCvet, UCUM, or DICOM import;
- canonical CLAiR prices;
- real dosing recommendations or clinically asserted reference ranges;
- medication, vaccine, imaging, other-exam, diagnosis, breed, and care-guide detail families beyond fields already required by the current order runtime;
- field-by-field automatic merge of a customized workspace row;
- more than one child-set layer;
- chart-side preset creation or mutation;
- a separate billing-package master;
- destructive removal of `service_*`, current Order Set tables, or compatibility fields;
- remote migration application, real hospital data, or production rollout.

## 3. Verified Current Starting Point

| Current artifact | Verified behavior | Phase-1 treatment |
| --- | --- | --- |
| `public.order_catalog_items` | Workspace order catalog with preset lineage, customization fields, price, routing, and metadata. `price_krw` is currently non-null with zero default. | Keep the table and make it the sole future workspace order authority. Add master lineage, classification path, catalog revision, pending activation, and nullable price semantics. |
| `public.order_sets` | Mutable set row with text `source_set_version`. | Keep the stable ID and compatibility projection, then point it to an immutable current revision. |
| `public.order_set_items` | Direct atomic `child_order_id` only. | Backfill into revision 1, stop new authoritative writes, and later retire after all consumers move. |
| `public.orders` | Supports `individual`, `set`, `set_child`, source IDs, hierarchy, JSON snapshots, pricing inputs/outputs, and billing state. | Reuse it for applied set parent and selected atomic child rows. Add direct lineage columns needed for indexed traceability. |
| `public.service_*` | Earlier service and billing catalog; `orders.service_item_id` and `invoice_lines.service_item_id` still exist. | Compatibility-only. Do not add new authoring or dual writes. New confirmed orders trace to `order_catalog_items`; legacy references remain nullable. |
| Chart catalog search | Returns active individual orders and active sets. | Keep one workspace-scoped read boundary but return only validated active set revisions. |
| Chart confirmation | Rejects every `rowType = set` as `unsupported_order_type`. | This is the phase-1B implementation gap. Replace rejection with trusted expansion and confirmation. |

## 4. Physical Design Rules

### 4.1 Schema And ID Rules

| Area | Rule |
| --- | --- |
| Canonical master | Private `master` schema, UUID primary keys. No browser Data API grants. |
| Workspace catalog | Current `public` tables and current text IDs remain in phase 1 to avoid a broad identity migration. |
| New workspace/revision records | UUID primary keys unless they extend a current text-ID table. |
| Human-debuggable master identity | Immutable `master_key`; never generated from a name and never reused. |
| A code | Immutable server-generated `A000001` format, separate from UUID. |
| Record revision | Positive integer assigned by the server publisher. |
| Release | UUID plus generated numeric `release_no`; no manually authored semantic version. |
| Status values | PostgreSQL `text` plus `check` constraints, matching the current repository style. Do not add custom enum types in phase 1. |
| Money | Integer KRW for current catalog compatibility. `NULL` means unset; `0` means intentionally free. |
| Time | `timestamptz`, server generated. |
| Names | Names are not global unique keys. Only technical IDs, keys, and codes are unique. |

### 4.2 Authority Rules

1. Airtable is an authoring and review surface, not a runtime database.
2. In phase 1, draft, in-review, and rejected working states remain in Airtable; PostgreSQL `master` stores validated published/deprecation states and immutable review evidence.
3. The latest successfully published PostgreSQL release is canonical runtime truth.
4. `master.*` owns CLAiR identity and clinical classification.
5. `public.order_catalog_items` owns hospital-operational names, price, availability, and local instructions.
6. `public.orders.applied_snapshot` and direct lineage columns own historical interpretation.
7. Compatibility fields may repeat canonical values only as server-generated projections.
8. No client payload is authoritative for master IDs, revisions, price snapshots, routing, or set expansion.

## 5. Phase-1 Table Inventory

| Layer | Table | Phase-1 status |
| --- | --- | --- |
| Master foundation | `master.master_releases` | Required in 1A |
| Master foundation | `master.master_records` | Required in 1A |
| Master foundation | `master.master_record_names` | Required in 1A |
| Master foundation | `master.master_sources` | Required in 1A |
| Master foundation | `master.master_record_sources` | Required in 1A |
| Master foundation | `master.master_record_versions` | Required in 1A |
| Master foundation | `master.master_review_events` | Required in 1A |
| Classification | `master.order_categories` | Required in 1A |
| Classification | `master.clinical_actions` | Required in 1A |
| Classification | `master.chart_groups` | Required in 1A |
| Classification | `master.task_routes` | Required in 1A |
| Classification | `master.classification_paths` | Required in 1A |
| Order | `master.orders` | Required in 1A |
| Vocabulary | `master.species`, `master.units`, `master.specimen_types`, `master.result_input_types` | Required values only |
| Order | `master.order_species_links` | Required in 1A |
| Lab | `master.lab_tests`, `master.lab_panels`, `master.lab_panel_items`, `master.lab_order_profiles` | Required in 1B |
| Workspace | extended `public.order_catalog_items` | Required in 1A |
| Workspace | `public.workspace_master_updates` | Required in 1A |
| Order Set | extended `public.order_sets` | Required in 1B |
| Order Set | `public.order_set_revisions` | Required in 1B |
| Order Set | `public.order_set_revision_items` | Required in 1B |
| Order Set | `public.order_set_revision_price_ranges` | Required in 1B |
| Order Set | `public.order_set_revision_update_reviews` | Required in 1B |
| Transaction | extended `public.orders` | Required in 1A/1B |
| Compatibility | `public.service_*`, current `public.order_set_items` | Read/backfill compatibility only |

## 6. Private Master Foundation

### 6.1 `master.master_releases`

One immutable publish attempt that becomes the idempotency and workspace-sync boundary.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | `gen_random_uuid()`; system release ID. |
| `release_no` | bigint identity | no | Unique generated sequence for human support/debugging. |
| `source_fingerprint` | text | no | Unique hash of the validated authoring payload. Replaying the same payload returns the existing release. |
| `status` | text | no | `publishing`, `published`, or `failed`. Only `published` can sync. |
| `release_notes` | text | yes | Short operator explanation. |
| `published_by_user_id` | uuid | yes | `public.users.id` when the operator has an app identity. |
| `published_by_label` | text | no | Non-empty operator/service label for solo operation and diagnostics. |
| `published_at` | timestamptz | yes | Required when status is `published`. |
| `created_at` | timestamptz | no | Default `now()`. |

Required constraints and indexes:

- unique `release_no`;
- unique `source_fingerprint`;
- check `status <> 'published' OR published_at IS NOT NULL`;
- index `(status, created_at desc)`.

### 6.2 `master.master_records`

Stable identity and current lifecycle pointer shared by every canonical phase-1 concept.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Stable internal identity. |
| `master_key` | text | no | Immutable global unique key such as `ORDER.CBC_BASIC`; never derived from a display name. |
| `record_type` | text | no | Phase-1 values listed below. |
| `lifecycle_status` | text | no | Phase 1 PostgreSQL values: `published`, `deprecation_pending`, or `deprecated`. Airtable owns draft/review states. |
| `safety_status` | text | no | `normal` or `blocked`. Emergency operation is not enabled until authority is defined. |
| `safety_reason` | text | yes | Required when blocked. |
| `current_revision` | integer | no | Positive; updated only by the publisher. |
| `current_release_id` | uuid FK | no | Published release that owns the current revision. |
| `replacement_record_id` | uuid self FK | yes | Optional single phase-1 replacement pointer. |
| `published_at` | timestamptz | yes | Required for published/deprecation states. |
| `deprecated_at` | timestamptz | yes | Required when deprecated. |
| `created_at` | timestamptz | no | Default `now()`. |
| `updated_at` | timestamptz | no | Server maintained. |

Phase-1 `record_type` values:

```text
order_category
clinical_action
chart_group
task_route
order
species
unit
specimen_type
result_input_type
lab_test
lab_panel
```

Required constraints and indexes:

- unique `master_key`;
- check `current_revision > 0`;
- check `safety_status <> 'blocked' OR length(trim(safety_reason)) > 0`;
- index `(record_type, lifecycle_status)`;
- index `(current_release_id)`.

### 6.3 `master.master_record_names`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `master_record_id` | uuid FK | no | `master.master_records`. Canonical records are not hard-deleted. |
| `language_code` | text | no | Phase 1: `ko` or `en`. |
| `name_kind` | text | no | `preferred`, `alias`, `abbreviation`, or `legacy`. |
| `name` | text | no | Non-empty display/search value. |
| `normalized_name` | text | no | Server-generated normalized search value. |
| `searchable` | boolean | no | Default true. |
| `sort_order` | integer | no | Default zero. |

Rules:

- exactly one preferred Korean name per record through a partial unique index;
- at most one preferred English name per record;
- unique `(master_record_id, language_code, name_kind, normalized_name)`;
- no global unique constraint on any name;
- phase 1 uses a normal btree index on `normalized_name`; trigram/search extensions wait for measured need.

### 6.4 `master.master_sources`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `source_type` | text | no | `synthetic`, `pdf_reference`, `official`, or `manual`. |
| `title` | text | no | Non-empty source label. |
| `reference_uri` | text | yes | URL or durable reference when applicable. |
| `source_version` | text | yes | Source version/date. |
| `accessed_at` | timestamptz | yes | Required for external online sources. |
| `license_notes` | text | yes | Required before any licensed redistribution. |
| `created_at` | timestamptz | no | Default `now()`. |

Synthetic fixture records must point to a `source_type = synthetic` source and cannot pass a clinical-publication gate.

### 6.5 `master.master_record_sources`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid FK | no | Canonical record. |
| `source_id` | uuid FK | no | Source record. |
| `assertion_scope` | text | no | Default `record`; may name a reviewed field group. |
| `notes` | text | yes | Short provenance note. |

Primary key: `(master_record_id, source_id, assertion_scope)`.

### 6.6 `master.master_record_versions`

Immutable audit/diff artifact. Structured current tables remain the query source.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `master_record_id` | uuid FK | no | Stable record. |
| `revision` | integer | no | Positive server-assigned revision. |
| `release_id` | uuid FK | no | Owning release. |
| `snapshot` | jsonb | no | Validated full record snapshot; JSON object. |
| `change_summary` | text | yes | Operator-readable explanation. |
| `authored_by_label` | text | no | Airtable/operator identity label. |
| `reviewed_by_label` | text | yes | May equal author for structural/synthetic solo validation. |
| `clinical_reviewer_label` | text | yes | Required only before a clinical assertion is labelled clinically reviewed. |
| `created_at` | timestamptz | no | Default `now()`. |

Required constraints:

- unique `(master_record_id, revision)`;
- check `revision > 0`;
- check `jsonb_typeof(snapshot) = 'object'`;
- versions are insert-only for normal application roles.

### 6.7 `master.master_review_events`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `master_record_id` | uuid FK | no | Reviewed record. |
| `revision` | integer | no | Revision under review. |
| `event_type` | text | no | `authored`, `validated`, `approved`, `rejected`, `published`, `deprecated`, or `safety_blocked`. |
| `actor_user_id` | uuid | yes | Optional `public.users.id`. |
| `actor_label` | text | no | Always required. |
| `source_surface` | text | no | `airtable`, `publisher`, or `server_admin`. |
| `reason` | text | yes | Required for rejection, deprecation, and safety block. |
| `created_at` | timestamptz | no | Default `now()`. |

This table is append-only. Phase 1 does not require separate author/reviewer/publisher role UI.

## 7. Canonical Classification And Orders

### 7.1 `master.order_categories`

Stores PDF X and T categories in one hierarchy.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `order_category`. |
| `category_code` | text | no | Immutable X or T code. |
| `category_level` | text | no | `X` or `T`. |
| `parent_category_id` | uuid self FK | yes | X must be null; T must reference one X. |
| `sort_order` | integer | no | Default zero. |

Unique `category_code`. Publisher verifies that a T parent is an X record.

### 7.2 `master.clinical_actions`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `clinical_action`. |
| `action_code` | text | no | Unique immutable `A000001` format. |
| `t_category_id` | uuid FK | no | Exactly one T category. |
| `item_type` | text | no | Current compatibility values: `consultation`, `medication`, `treatment`, `lab`, `imaging`, `hospitalization`, or `misc`. |
| `is_other_unclassified` | boolean | no | Default false; true only for the type-specific fallback A. |

Required constraints:

- unique `action_code`;
- check regex `^A[0-9]{6}$`;
- at most one published Other/Unclassified A per `item_type`, enforced by publisher and a partial unique index when lifecycle projection permits it.

### 7.3 `master.chart_groups`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `chart_group`. |
| `group_code` | text | no | Unique immutable CG code. |
| `sort_order` | integer | no | Display order. |

Initial values are the confirmed eight CG codes. `All` and `Billing` are views, not rows.

### 7.4 `master.task_routes`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `task_route`. |
| `route_code` | text | no | Unique immutable NT code. |
| `destination_module` | text | no | `lab`, `imaging`, `dispensing`, `treatment`, `inpatient`, `billing_only`, or `chart_only`. |
| `task_required` | boolean | no | Derived runtime behavior. |
| `runtime_status` | text | no | `active` or `held`. `NT_INPATIENT` starts held. |

The publisher rejects active paths that use a held route. Billing reflection is not stored here.

### 7.5 `master.classification_paths`

Validated A + CG + NT combination. T and X resolve through the action.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Stable path identity. |
| `path_key` | text | no | Immutable human-debuggable unique key. |
| `clinical_action_id` | uuid FK | no | A record. |
| `chart_group_id` | uuid FK | no | CG record. |
| `task_route_id` | uuid FK | no | NT record. |
| `active_from_release_id` | uuid FK | no | First release that permits the path. |
| `retired_in_release_id` | uuid FK | yes | Set when no longer valid for new copies. |
| `created_at` | timestamptz | no | Default `now()`. |

Required constraints:

- unique `path_key`;
- unique `(clinical_action_id, chart_group_id, task_route_id)`;
- phase 1 allows one non-retired path per clinical action, enforced with a partial unique index;
- the publisher rejects missing, deprecated, blocked, or held referenced records.

### 7.6 `master.orders`

Exact atomic standard order. It is not a price row and not an Order Set.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `order`. |
| `classification_path_id` | uuid FK | no | Exactly one phase-1 path. |
| `default_sales_unit_id` | uuid FK | yes | Optional unit default. |
| `default_billing_reflection_enabled` | boolean | no | Workspace may override. |
| `default_quantity` | numeric(12,3) | no | Default 1, positive. |

Canonical order price is intentionally absent.

### 7.7 Small Vocabulary Tables

Each table has `master_record_id uuid PK/FK` plus the fields below. Names live in `master_record_names`.

| Table | Additional columns | Phase-1 rule |
| --- | --- | --- |
| `master.species` | `species_code text unique` | Seed `dog`, `cat` only. |
| `master.units` | `unit_code text unique`, `symbol text`, `decimal_scale integer` | Only units used by fixtures. External UCUM mapping is absent. |
| `master.specimen_types` | `specimen_code text unique` | Only specimens used by two panels. |
| `master.result_input_types` | `input_code text unique`, `value_kind text`, `supports_unit boolean` | Only numeric/text/coded shapes used by fixtures. |

### 7.8 `master.order_species_links`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `order_record_id` | uuid FK | no | Canonical order. |
| `species_record_id` | uuid FK | no | Canonical species. |

Primary key: `(order_record_id, species_record_id)`.

## 8. Canonical Laboratory Slice

### 8.1 `master.lab_tests`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `lab_test`. |
| `test_code` | text | no | Unique internal test code. Not LOINC. |
| `result_input_type_id` | uuid FK | no | Structured result kind. |
| `canonical_unit_id` | uuid FK | yes | Required only for unit-bearing numeric tests. |
| `decimal_scale` | integer | yes | Non-negative display precision. |

### 8.2 `master.lab_panels`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `master_record_id` | uuid PK/FK | no | Record type `lab_panel`. |
| `panel_code` | text | no | Unique internal panel code. |

### 8.3 `master.lab_panel_items`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `lab_panel_id` | uuid FK | no | Panel record. |
| `lab_test_id` | uuid FK | no | Test record. |
| `sort_order` | integer | no | Result display order. |
| `required` | boolean | no | Default true. This does not make a separate chart order. |
| `display_group` | text | yes | Optional result-sheet grouping. |

Unique `(lab_panel_id, lab_test_id)` and `(lab_panel_id, sort_order)`.

### 8.4 `master.lab_order_profiles`

One atomic lab order links to exactly one test or one panel.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `order_record_id` | uuid PK/FK | no | Canonical order whose action item type is `lab`. |
| `lab_test_id` | uuid FK | yes | Single-result order target. |
| `lab_panel_id` | uuid FK | yes | Multi-result panel target. |
| `specimen_type_id` | uuid FK | yes | Optional fixture specimen. |

Check exactly one of `lab_test_id` and `lab_panel_id` is non-null.

Panel members are result definitions, not independent chart orders or billing lines.

### 8.5 Reference Ranges

Reference-range persistence is not required to prove the phase-1 order pipeline. Do not create user-visible canonical ranges in the validation release.

A later clinical-data migration may add `master.lab_reference_ranges` only after source, reviewer, context, and publication rules are approved. Hidden unit tests may use in-code synthetic values; they are not seed records and cannot be published.

## 9. Workspace Order Catalog

### 9.1 `public.order_catalog_items` Target Delta

The table remains the workspace order authority. Existing columns not listed as changed remain in place for compatibility.

#### New or changed authoritative fields

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `origin_type` | text | no | `clair_master` or `workspace_custom`; default existing rows to `workspace_custom` during safe backfill. |
| `source_master_record_id` | uuid FK | yes | Required only for `clair_master`. References `master.master_records`. |
| `source_master_revision` | integer | yes | Current source revision reflected in this row. |
| `initial_imported_revision` | integer | yes | First imported master revision. |
| `last_auto_merged_revision` | integer | yes | Last source revision auto-applied to an unmodified row. |
| `classification_path_id` | uuid FK | no after backfill | Canonical A/CG/NT path selected by master-derived and hospital-local orders. |
| `catalog_revision` | integer | no | Starts at 1 and increments on every accepted workspace mutation. |
| `availability_status` | text | no | Expand to `pending_activation`, `active`, `paused`, `inactive`. |
| `price_krw` | integer | yes | Drop default and NOT NULL. `NULL` is unset; zero is intentionally free. |
| `preset_merge_status` | text | no | Keep current name for compatibility; expand to `current`, `update_available`, `conflict`, `deprecated_source`, or `detached`. |

#### Existing compatibility projections

| Existing field | Authority rule |
| --- | --- |
| `standard_order_id` | Derived from canonical `master_key` for master copies; generated stable local key for hospital-local rows. Never derived from name. |
| `source_preset_version` | Derived string projection of `source_master_revision`; not a second version authority. Local rows use their stable local convention until consumers adopt `catalog_revision`. |
| `category_group` | Derived from `clinical_actions.item_type`; not PDF CG. |
| `category_label` | Derived compatibility display label; not an independent taxonomy. |
| `t_code`, `t_code_label` | Derived together through A -> T. |
| `default_destination_module`, `default_task_required` | Derived together from NT. |
| `standard_order_name` | Canonical reviewed preferred name projection for a master copy. |
| `in_hospital_order_name`, `billing_name` | Workspace editable. |
| `aliases` | Workspace search array. Whole-row merge avoids partial overwrite in phase 1. |
| `target_species` | Compatibility projection of canonical order-species links plus approved workspace filtering. |
| `medication_metadata`, `vaccine_metadata`, `pricing_rule` | Current runtime compatibility only; not canonical clinical authority. |

#### Existing customization fields retained

Keep `customization_state`, `customized_fields`, `last_customized_at`, `last_customized_by_user_id`, and `preset_merge_status`.

Phase-1 behavior:

- `unmodified`: a new release may replace the whole master-derived projection atomically;
- `customized`: preserve the entire row and create an update review;
- `detached`: never receive master merge;
- field diffs are explanatory only and do not authorize partial automatic merge.

#### Required constraints and indexes

1. Partial unique index `(workspace_id, source_master_record_id)` where source is non-null.
2. Check master-origin rows have source record/revision/imported revision and local-origin rows have no source master reference.
3. Check `catalog_revision > 0`.
4. Check `price_krw IS NULL OR price_krw >= 0`.
5. Check an active billable row has a non-null price.
6. Check all derived route/type fields agree with `classification_path_id` in the trusted writer before commit.
7. Existing index `(workspace_id, availability_status, category_group)` remains.
8. Add index `(workspace_id, preset_merge_status)` for admin review.

Names are deliberately not unique. The admin mutation boundary may return a similar-name warning but cannot auto-merge or reject solely by name.

### 9.2 `public.workspace_master_updates`

One durable review item is sufficient in phase 1. Do not create a separate diff-row table yet.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `workspace_id` | text FK | no | Tenant boundary. |
| `release_id` | uuid FK | no | Source release. |
| `source_master_record_id` | uuid FK | no | Changed master record. |
| `order_catalog_item_id` | text FK | yes | Null only before a new copy is created or for non-order future use. |
| `update_type` | text | no | `new`, `changed`, `deprecated`, `replacement`, or `emergency`. |
| `status` | text | no | `pending`, `auto_applied`, `accepted`, `dismissed`, or `conflict`. |
| `previous_source_revision` | integer | yes | Revision before release. |
| `source_revision` | integer | no | New revision. |
| `changed_fields` | text[] | no | Diff summary. |
| `source_snapshot` | jsonb | no | Validated new source snapshot. |
| `workspace_snapshot` | jsonb | yes | Current workspace row for review. |
| `resolved_by_user_id` | uuid | yes | Hospital administrator. |
| `resolved_at` | timestamptz | yes | Required for accepted/dismissed. |
| `created_at` | timestamptz | no | Default `now()`. |

Required constraints and indexes:

- unique `(workspace_id, release_id, source_master_record_id, update_type)` for idempotency;
- JSON object checks;
- index `(workspace_id, status, created_at desc)`;
- active members may read their workspace; only the trusted sync writer creates auto-applied records, and hospital admin resolves pending records.

## 10. Workspace Order Set Revisions

### 10.1 `public.order_sets`

Stable workspace-owned identity. It does not own mutable composition.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | text PK | no | Preserve current ID. |
| `workspace_id` | text FK | no | Tenant boundary. |
| `current_revision_id` | uuid FK | yes | Null only for a newly created metadata-only unavailable set before revision backfill completes. |
| `availability_status` | text | no | `active`, `paused`, or `inactive`. |
| `needs_composition_review` | boolean | no | Default false; true blocks chart application. |
| `created_by_user_id` | uuid | yes | Audit actor. |
| `updated_by_user_id` | uuid | yes | Audit actor for pointer/status changes. |
| `created_at` | timestamptz | no | Existing. |
| `updated_at` | timestamptz | no | Existing. |

Current `source_set_version`, names, pricing, species, guide, and instruction columns remain temporarily as server-generated compatibility projections of `current_revision_id`. Hospital admin must stop writing them independently after revision adoption.

An active set requires a non-null current revision that passed validation.

### 10.2 `public.order_set_revisions`

Immutable set definition created by each valid or intentionally unavailable admin save.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `workspace_id` | text FK | no | Duplicated for composite tenant FKs. |
| `order_set_id` | text FK | no | Stable set. |
| `revision_no` | integer | no | Starts at 1 and increments per set. |
| `validation_status` | text | no | `valid` or `invalid`. Invalid revisions cannot become current active revisions. |
| `validation_errors` | jsonb | no | Empty array for valid revision. |
| `set_category` | text | yes | Admin grouping. |
| `set_name` | text | no | Non-empty staff label. |
| `billing_name` | text | no | Non-empty owner-facing label. |
| `amount_basis` | text | no | `included_order_sum`, `set_fixed_price`, or `range_price`. |
| `set_price_krw` | integer | yes | Required for fixed price, null for sum/range. Zero is intentional free. |
| `range_basis` | text | yes | Required only for range price: phase 1 `patient_weight_kg` or `manual_value`. |
| `sales_unit` | text | no | Current allowed sales units. |
| `billing_reflection_enabled` | boolean | no | Set-level billing behavior. |
| `tax_type` | text | no | `taxable`, `non_taxable`, or `derived`. Sum mode must use derived. |
| `target_species` | text[] | no | Compatibility filter. |
| `care_guide` | text | yes | Snapshot content only; not a clinically reviewed claim unless reviewed. |
| `internal_instruction` | text | yes | Hospital staff note. |
| `created_by_user_id` | uuid | yes | Hospital admin. |
| `created_at` | timestamptz | no | Default `now()`. |

Required constraints and indexes:

- unique `(order_set_id, revision_no)`;
- unique `(workspace_id, id)` for composite tenant references;
- check pricing fields match `amount_basis`;
- check valid revisions have empty validation errors;
- index `(workspace_id, order_set_id, revision_no desc)`;
- no update or delete grant to normal application roles.

### 10.3 `public.order_set_revision_items`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Stable row within one revision. |
| `workspace_id` | text FK | no | Tenant boundary. |
| `order_set_revision_id` | uuid FK | no | Owning immutable revision. |
| `child_kind` | text | no | `order` or `set_revision`. |
| `child_order_catalog_item_id` | text FK | yes | Required for `order`. |
| `child_set_revision_id` | uuid FK | yes | Required for `set_revision`; this pins the exact child revision. |
| `sort_order` | integer | no | Unique inside the revision. |
| `default_selected` | boolean | no | Encounter starting selection. |
| `billing_reflection_default` | boolean | no | Mode-dependent default; server calculates it. |
| `default_quantity` | numeric(12,3) | no | Positive. Nested set quantity is exactly 1 in phase 1. |
| `quantity_source` | text | no | `fixed_one`, `preset_quantity`, or `manual_at_apply`. |
| `created_at` | timestamptz | no | Default `now()`. |

Required constraints:

- exactly one child reference matches `child_kind`;
- composite workspace FKs prevent cross-workspace members;
- unique `(order_set_revision_id, sort_order)`;
- direct duplicate child references are rejected by unique indexes;
- no preset-time child price snapshot is authoritative. Child price resolves from the active workspace order at chart application and is frozen in the encounter snapshot.

Cycle detection, maximum depth, and recursively duplicated atomic orders require the trusted revision validator; they are not implemented as complex database triggers.

### 10.4 `public.order_set_revision_price_ranges`

Only used by a `range_price` revision.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `workspace_id` | text FK | no | Tenant boundary. |
| `order_set_revision_id` | uuid FK | no | Owning revision. |
| `sort_order` | integer | no | Evaluation/display order. |
| `lower_bound` | numeric(12,3) | no | Inclusive. |
| `upper_bound` | numeric(12,3) | yes | Exclusive; null means no upper bound. |
| `price_krw` | integer | no | Non-negative; zero is intentional free. |

For both `patient_weight_kg` and `manual_value`, Phase 1 uses the approved
continuous Option A contract: ranges are lower-inclusive/upper-exclusive,
start at `0`, are contiguous with no gaps or overlaps, and contain exactly one
final open-ended row (`upper_bound IS NULL`). Every nonnegative input therefore
matches exactly one bracket; B3 has no range no-match runtime state. The
validator rejects reversed bounds, gaps, overlaps, and more than one
open-ended range.

### 10.5 Set Revision Save And Update Rules

1. Hospital admin submits the full intended definition plus expected current revision.
2. The server reads referenced orders and child revisions inside the same transaction.
3. The server validates workspace, availability, price mode, maximum depth, cycles, duplicate atomic results, and at least one selected atomic order for activation.
4. The server inserts a new immutable revision and child rows.
5. If valid and activation was requested, the server atomically updates `order_sets.current_revision_id` and compatibility projections.
6. If invalid or empty, the server saves the revision only as unavailable after explicit use-off confirmation; it cannot replace an active revision.
7. A child revision change creates an update review for parent sets that pin the older child revision. It never updates parent rows automatically.
8. Accepting the child update creates a new parent revision.

### 10.6 `public.order_set_revision_update_reviews`

Durable notification/review state for a parent that pins an older child revision.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid PK | no | Generated. |
| `workspace_id` | text FK | no | Tenant boundary. |
| `parent_order_set_id` | text FK | no | Stable parent set. |
| `parent_revision_id` | uuid FK | no | Parent revision that currently pins the old child. |
| `child_order_set_id` | text FK | no | Stable child set. |
| `pinned_child_revision_id` | uuid FK | no | Revision currently used by the parent. |
| `available_child_revision_id` | uuid FK | no | New child revision offered for review. |
| `status` | text | no | `pending`, `accepted`, `dismissed`, or `superseded`. |
| `result_parent_revision_id` | uuid FK | yes | New parent revision created after acceptance. |
| `resolved_by_user_id` | uuid | yes | Hospital administrator. |
| `resolved_at` | timestamptz | yes | Required after resolution. |
| `created_at` | timestamptz | no | Default `now()`. |

Unique `(parent_revision_id, pinned_child_revision_id, available_child_revision_id)` prevents duplicate notices. Accepting a review and creating the new parent revision occur in one server transaction.

## 11. Applied Chart And Billing Snapshot

### 11.1 `public.orders` Target Delta

Keep current transactional columns and JSON snapshots. Add direct lineage fields for indexed joins and audit:

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `workspace_catalog_item_id` | text FK | yes | Atomic workspace order source. |
| `source_master_record_id` | uuid FK | yes | Canonical source when present. |
| `source_master_revision` | integer | yes | Canonical revision applied. |
| `workspace_catalog_revision` | integer | yes | Workspace row revision applied. |
| `source_set_revision_id` | uuid FK | yes | Root Order Set revision for parent/children. |
| `source_set_revision_item_id` | uuid FK | yes | Direct member row where applicable. |
| `order_type` | text | no | Expand the current check to include `set` for the parent set row. Atomic children keep their existing operational order type. |

Existing compatibility columns remain:

- `source_order_id`, `source_order_version`;
- `source_set_id`, `source_set_version`, `set_item_id`;
- `parent_chart_order_line_id`, `row_depth`;
- `applied_snapshot`, `applied_price_snapshot`, `calculation_inputs`, `calculation_outputs`.

Required indexes:

- `(workspace_id, workspace_catalog_item_id)`;
- `(workspace_id, source_master_record_id, source_master_revision)`;
- `(workspace_id, source_set_revision_id)`;
- existing encounter/order status indexes remain.

### 11.2 Individual Order Application

The trusted server re-reads the active workspace catalog row and writes one `public.orders` row with:

- `row_type = individual`;
- effective names, quantity, price, tax, sales unit, A/X/T/CG/NT labels/codes, route, billing flag, and type-specific runtime context in the snapshot;
- direct master, workspace catalog, and revision lineage;
- no dependency on a later mutable catalog join for display or billing.

### 11.3 Order Set Application

The trusted server performs one read/validation transaction:

1. lock/read the stable set and exact active revision;
2. recursively expand at most one child-set layer;
3. reject unavailable members, cycles, duplicate atomic results, invalid price ranges, or an empty final selection;
4. create one parent `public.orders` row with `row_type = set`, `order_type = set`, and no fulfillment task;
5. store the full expanded hierarchy, defaults, staff edits, chosen bracket, and final calculation in the parent snapshot;
6. create child `public.orders` rows only for selected atomic orders, using `row_type = set_child` and the parent row ID;
7. store each child's set path in `applied_snapshot` so a nested child set remains explainable without a separate intermediate transactional set row;
8. create fulfillment work only from selected atomic child rows whose applied NT requires it;
9. create billing according to one calculation authority.

Billing behavior:

| Mode | Parent billable | Child billable |
| --- | --- | --- |
| `included_order_sum` | no | Selected children whose billing flag is true. |
| `set_fixed_price` | yes | Only explicitly enabled extra-charge children. |
| `range_price` | yes using selected bracket | Only explicitly enabled extra-charge children. |

Chart edits affect only the encounter-owned expansion request and resulting snapshots. They never update the set revision or workspace catalog.

## 12. Publish And Workspace Sync

### 12.1 Validated Publish Transaction

The recommended server-only publisher performs:

1. read the reviewed Airtable export;
2. normalize names and calculate `source_fingerprint`;
3. reject duplicate technical keys/codes, broken references, invalid A/T/X relationships, held NT use, mismatched derived fields, or unreviewed clinical claims;
4. start one DB transaction and reuse an existing release when the fingerprint already succeeded;
5. create the release in `publishing` state;
6. upsert current structured master rows by stable identity;
7. increment each changed record revision and insert an immutable version snapshot;
8. append review events;
9. mark the release published;
10. enqueue or call workspace sync by release ID.

The runtime never queries Airtable.

### 12.2 Workspace Sync Transaction

For each eligible workspace and changed order record:

| Case | Action |
| --- | --- |
| New master order | Create one `pending_activation` catalog row and one pending update record; notify hospital admin. |
| Existing `unmodified` row | Replace the full master-derived projection, advance revisions, increment `catalog_revision`, and record `auto_applied`. |
| Existing `customized` row | Preserve the whole row and create `pending` or `conflict` review with both snapshots. |
| Existing `detached`/local row | Ignore. |
| Deprecated master order | Preserve row, set `deprecated_source` review state, notify, and keep history. |
| Same release retry | Create no duplicate catalog or review row. |

Hospital acceptance of an update is an explicit server mutation that writes the reviewed result, increments `catalog_revision`, and records the resolving actor and time.

## 13. Security And RLS Contract

### 13.1 Private Master

- Do not expose `master` schema through the browser Data API.
- Grant no direct `authenticated` mutation privilege.
- Publisher and sync run through a reviewed server/private boundary with a fixed `search_path`.
- Do not use a broad generic `SECURITY DEFINER` function that accepts arbitrary table names or SQL.
- Every server function validates release, record type, workspace, and actor inputs.

### 13.2 Workspace Tables

| Operation | Minimum requirement |
| --- | --- |
| Catalog/set/admin read | Active same-workspace membership. |
| Catalog or set create/update/use-stop | `service_catalog:manage`; phase-1 role mapping is hospital admin. |
| Update-review resolution | Same management permission and expected current revision. |
| Chart catalog search | Active membership plus chart read/order permission used by the existing route. |
| Set expansion/confirmation | Trusted server boundary; client supplies intent only, never snapshots or prices. |
| Cross-workspace reference | Always rejected by composite FK, RLS, and server validation. |

Use both `USING` and `WITH CHECK` for updates. Normal application roles receive no delete grant on master-derived catalog rows, sets, revisions, versions, or applied orders.

## 14. Migration And Adoption Sequence

No migration is authorized merely because this document exists. Implementation should use separate forward migrations and focused tests.

### Phase 1A-1 - Private Master Foundation

- create private schema and foundation tables;
- add classification, vocabulary, and canonical order tables;
- add publisher validation and local fixture publish tests;
- no workspace behavior change yet.

### Phase 1A-2 - Workspace Catalog Adoption

- add `order_catalog_items` lineage/classification/catalog-revision columns;
- backfill existing rows as `workspace_custom` unless a deterministic preset mapping is proven;
- assign every backfilled local row a reviewed classification path or the matching type-specific Other/Unclassified path before making `classification_path_id` non-null;
- change price to nullable and add pending activation through a safe constraint replacement;
- add `workspace_master_updates`;
- implement release sync and whole-row review;
- update chart search/confirmation to use new lineage while preserving current behavior.

### Phase 1A-3 - Sole Order Authority

- stop all new `service_*` authoring for order flows;
- new confirmations write `workspace_catalog_item_id` and catalog snapshots;
- leave `service_item_id` nullable for legacy rows;
- use a temporary explicit mapping/backfill script only if existing data must be preserved;
- do not drop `service_*` in phase 1.

### Phase 1B-1 - Laboratory Slice

- create canonical test/panel/profile tables;
- publish two synthetic panels and required tests;
- copy/map them to current workspace lab result definitions;
- verify one atomic lab order produces panel result fields but one order/billing line.

### Phase 1B-2 - Order Set Revisions

- create revision, item, and range tables;
- create revision 1 from each current synthetic `order_sets` + `order_set_items` definition;
- set `current_revision_id` and refresh compatibility projections;
- move admin mutations to full immutable-revision save;
- stop authoritative writes to current `order_set_items`.

### Phase 1B-3 - Chart Set Runtime

- replace `unsupported_order_type` with trusted expansion;
- add encounter-only selection and quantity edits;
- write parent/selected-child snapshots and direct lineage;
- route selected atomic children and apply all three billing methods;
- verify child revision pin/update review and historical immutability.

### Later Cleanup

Only after local replay, adapter removal, cross-workspace tests, and explicit remote approval:

- remove compatibility projection writes;
- retire `public.order_set_items`;
- retire unused `service_*` order-authoring paths;
- consider UUID migration for existing text workspace IDs;
- add external terminology and clinical range data only under separate scope.

## 15. Phase-1 Validation Fixture

| Fixture | Amount | Purpose |
| --- | --- | --- |
| Atomic orders | 20–40 | Exercise category, route, billing, price, local/master, and copy behavior. |
| A actions | Only those required by fixture orders | Avoid speculative taxonomy. |
| Other/Unclassified A | One per used item type | Keep local order creation usable. |
| Lab panels | 2 | Prove result bundle versus Order Set distinction. |
| Order Sets | 3–5 | Include sum, fixed, range, and one nested set. |
| Workspaces | 2 | One unmodified, one customized. |
| Master releases | 2 | Prove idempotent add/update/review behavior. |
| Species | Dog and cat | No broad veterinary vocabulary import. |

All clinical-looking values are synthetic/non-authoritative unless a verified source and named veterinary reviewer are recorded.

## 16. Required Verification

### 16.1 Schema And Migration

1. Migration applies from the current local schema.
2. Reapplying static/idempotency checks does not duplicate rows.
3. Every new FK target has the required unique key.
4. Invalid status, price, revision, path, child-kind, and range combinations fail.
5. Existing synthetic current rows remain readable after additive migrations.

### 16.2 Master Publish And Sync

1. One source fingerprint creates one published release.
2. Changed master records receive the next integer revision and immutable version.
3. Duplicate code/key publish fails; duplicate name publish warns but may succeed.
4. Release 1 creates pending catalog rows once in both workspaces.
5. Release 2 auto-updates the unmodified workspace.
6. Release 2 preserves the customized workspace row and creates whole-row review.
7. Local rows never receive master updates.

### 16.3 Security

1. Browser/authenticated clients cannot read or mutate private master tables directly.
2. Unauthenticated, inactive, and cross-workspace catalog/set reads fail.
3. Ordinary staff cannot manage catalog or set presets.
4. Hospital admin can mutate only their workspace through the trusted boundary.
5. Client-supplied price, snapshot, revision, and child expansion are ignored or rejected.

### 16.4 Individual And Lab Orders

1. Active billable order with unset price is rejected; explicit zero is accepted as free.
2. Confirmation re-reads the active workspace row and freezes effective values.
3. A panel order creates one chart order and billing line with multiple result definitions.
4. Later catalog or panel changes do not alter past orders/results.

### 16.5 Order Sets

1. Valid root -> child set -> atomic order expansion succeeds.
2. A third set layer, cycle, cross-workspace member, unavailable member, or duplicate atomic result fails.
3. Staff can alter encounter selection and quantity without changing preset revision rows.
4. Sum, fixed, and range methods produce one explainable total without double billing.
5. Only selected atomic children create fulfillment work.
6. Child revision 2 does not change a parent pinned to child revision 1.
7. Parent refresh creates a new parent revision.
8. Past parent and child snapshots remain unchanged after future revisions.

## 17. Implementation Done Criteria

This specification is implementation-ready when an approved work item can divide it into forward migrations and runtime adoption without making new domain decisions.

The eventual phase-1 implementation is done only when:

- all 1A and 1B behaviors above are implemented;
- local schema/migration tests and focused server tests pass;
- two-workspace/two-release replay passes with zero cross-workspace leakage;
- chart Order Set confirmation no longer returns `unsupported_order_type` for a valid set;
- fulfillment and billing evidence exists for individual and set-applied orders;
- affected product, data-model, security, and current-status docs are synchronized;
- no claim is made that synthetic clinical content is medically validated.

## 17.1 Phase-1 Implementation And Closeout State

The six Phase 1 work items (A1–A3 and B1–B3) are implemented and completed
within the approved synthetic/runtime/permission boundary. PR #572 merged at
`00410c25098d53e20acaa94ad91835c17215339c`, PR #573 at
`5a077058fbd5aa1ee9a75d3df217cb6e39e9985d`, and the permission-source
precedence correction PR #574 candidate
`62ae082b5eb67edc8c46d3f457e3e9b3d8e3681b` merged at
`719f8e225357eedf552e4c304aaabd3347049302`. Release Check `32457431506`
passed the required secrets/docs/UX/lint/typecheck/build checks. Production deployment
`dpl_A3UCjuuAUiPp6J3r2HmewHdDC4zp` is recorded as READY on the production
alias.

The corrected original C evidence hash was
`bcb4617ba8094c7baa6b6a6011557a0f232bc8228013d67fc57644005441e553`; the
approved C2 hash was
`5181e7c6e2aa9a898dc5d7a0864d1d9eafc3608be7a5174959f619296d4ec0c7`. C2
`execute_sql` on linked project `qmerxgzrwaaahpkhjqlc` passed with an
unconditional `ROLLBACK`. Sol's pre-execution verdict was `APPROVE` with
`MUST-FIX 0`.

Fresh-connection E evidence hash
`6868babe3f5f9e0de22010d7a277604a0677818e0b3a0e7981608d514d3e11a5` passed.
The bounded remote readback recorded master releases/records/versions/names/
sources/links/reviews `2/29/29/58/29/29/58`, audit `457`, runtime rows
`false/0`, lab-result write requests `0`, catalog paused at revision `5`, lab
inactive, current Order Set inactive at revision `2` with
`needs_composition_review=true`,
durable Order Set revisions/items `2/4`, and creation/save request histories
`1/1`. Permission remote alias `20260821071846` maps to canonical local
migration `20260821063113`.

Authenticated synthetic browser evidence for `vet-cheongdam@clair.local` showed
the Order Set page without a read error and four rows, including synthetic
inactive revision 2 marked `구성 검토 필요`; the clinical lab catalog rendered
normally and the synthetic item was visible as `중지`. These checks establish
the scoped release/runtime/permission boundary only. They do not establish
clinical-content correctness, a full product smoke matrix, or Phase 2–5
completion. The optional broader 38-case B1 matrix remains unclaimed, and
legacy migration ledger drift (`39` local-only / `11` remote-only) remains a
separate reconciliation risk.

## 18. Deferred Decisions

| Decision | Trigger |
| --- | --- |
| Named veterinary reviewer workflow | Before real clinical assertions are labelled reviewed or distributed. |
| Reference-range physical schema and sources | Before user-facing canonical ranges. |
| Medication/vaccine normalized families | Before medication master implementation. |
| External terminology mappings and licenses | Before bulk import or redistribution. |
| Emergency authority and SLA | Before live hospital emergency blocking. |
| Organization/branch shared catalog | When a real multi-site requirement exists. |
| Search extensions | After measuring the small fixture and real catalog size. |
| Compatibility table deletion | After adapter removal, replay, and explicit remote approval. |

## 19. Source Documents

- [CLAiR Clinical Master Data Target Architecture](./clair-clinical-master-data-target-architecture.md)
- [Workspace Order Catalog Platform](../../product/domain/workspace-order-catalog-platform.md)
- [Order Catalog Preset Initialization Contract](./order-catalog-preset-initialization-contract.md)
- [Order Sets And Templates V1](../../product/demo-data/order-sets-and-templates-v1.md)
- [Order Fulfillment Handoff Contract](./order-fulfillment-handoff-contract.md)
- Current migration baseline: `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql`
- Current applied snapshot baseline: `supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql`
- Current chart confirmation boundary: `src/features/chart/server-order-action-persistence-core.ts`

## 20. Change History

| Date | Change |
| --- | --- |
| 2026-08-18 | First detailed phase-1 DB specification. Defines the minimum private master, workspace copy/update, lab panel, immutable Order Set revision, applied snapshot, RLS, migration, fixture, and verification contracts without implementing migrations or runtime changes. |
| 2026-08-20 | Domain owner approved Option A for both Order Set range bases: continuous `[0,+infinity)` lower-inclusive/upper-exclusive coverage with contiguous rows and exactly one final open-ended bracket; B3 has no no-match runtime state. |
| 2026-08-21 | Recorded scoped Phase 1 A1–B3 implementation completion, PR #572/#573/#574 merge lineage, C2/E hashes and bounded authenticated browser evidence. Clinical-content validation, Phase 2–5, the optional broader 38-case matrix, and migration-ledger reconciliation remain unclaimed or deferred. |
