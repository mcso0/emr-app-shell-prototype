# WP-01B Slice 03 — Fine classification design proposal

Date: 2026-09-06. Status: design draft and non-applied mapping complete; local implementation next.
This is a proposed target contract, not implemented schema or remote approval.
No new WP number. Continue within Slice 03, with a bounded WP-02 dependency below.

## Goal and acceptance

| Goal | Acceptance criterion |
| --- | --- |
| Persist an order's actual browsing classification | Master and workspace copies expose explicit codes; no name/path inference or runtime catalog injection |
| Preserve hospital edits | Master refresh changes untouched fields only; explicit local edits and clears survive |
| Preserve clinical behavior | Classification-only edit cannot change execution type, route, price, clinical defaults, availability, review or billing |
| Keep rows discoverable | Each classified row has one canonical Admin leaf; category-wide and search views cover every eligible row |
| Preserve history | New chart instances copy the current workspace classification; confirmed historical snapshots do not change |

## Evidence, not assumptions

- The prior [exact-path audit](./slice-03-taxonomy-read.md) verified broad persisted
  paths, not Admin fine subtypes; this turn did not re-query remote data.
- Admin code vocabulary exists in `src/features/hospital-admin/data.ts`, but it is
  not a stored master classification. Do not use its example rows as data authority.
- Admin menu in `src/features/hospital-admin/module.tsx` currently labels a
  radiography-only leaf as 영상검사. Adding stored ultrasound alone would not make
  that leaf include ultrasound; category-wide navigation must be tested explicitly.
- `blood-chemistry` is a subtype constant while `chemistry` is also a pathology
  family. Canonicalize to one stored representation, not duplicate classifications.
- Existing source projection and customizedFields contracts are reuse points, not
  proof that two-field merge already works. The inspected adoption implementation
  has a whole-row unmodified guard; WP-02 owns field-level merge work.

## Recommended storage — two explicit nullable fields

Add fields to the master order definition and the workspace order copy, not to
shared classification_paths. A shared broad path cannot express per-order differences.
The authoring/publisher representation must carry the same codes through a new
record revision; updating only a DB projection is insufficient.

| Proposed persisted field | API / customization key | Meaning |
| --- | --- | --- |
| admin_subcategory_code | adminSubcategoryCode | Canonical browsing leaf, e.g. clinical-pathology, ultrasound, anesthesia |
| lab_family_code | labFamilyCode | Primary lab browsing family, e.g. cbc, chemistry; null outside the applicable lab leaf |

Do not separately persist Admin parent category: derive it from the **explicitly
stored** subcategory using a versioned vocabulary. This is code-to-label/parent
translation, not fallback. Null or unknown codes cannot select a default leaf.
The vocabulary describes possible classifications; it contains no order IDs,
catalog rows, dose defaults, UUID-to-subtype map or name-matching rules.

Keep `clinical_order_type`, execution routing and `classification_path_id` as the
existing clinical/lineage contract. In particular, system_exam may have item_type
misc; Admin surgery/anesthesia may still execute as treatment. This proposal does
not add chart tabs or redefine task routing. Admin and chart share row ID and saved
classification values, but their existing navigation projections need not be identical.

Alternative rejected: changing every shared path or decoding its name/key. This
would entangle operational routes and display categories without resolving mixed
orders. A free-form JSON taxonomy/tree editor is also unnecessary for this slice.

## Vocabulary and compatibility rules

1. Reuse existing named leaves where they fit. Each leaf has one stable parent,
   a display label, allowed clinical types and optional lab-family requirement.
   Final allowed-type matrix is an output of the mapping pass, not assumed complete.
2. Propose one lab representation: clinical-pathology + chemistry, not a second
   stored blood-chemistry leaf. Existing blood-chemistry navigation may become an
   explicit filter alias for that pair; no duplicate order row or runtime fallback.
3. Lab families cover primary browsing, not membership in CBC/panels. A WBC order
   can be reused by several sets without changing this classification. Nested sets,
   analytes, device profiles and reference ranges remain OED-LAB-04.
4. Do not force topical/ear/eye products into oral/injection, CT/MRI into radiography,
   or mixed panels into CBC. Mapping must propose explicit additional codes when
   needed. The full vocabulary is not frozen until coverage of all target IDs is checked.
5. `other`/`etc` means an intentionally authored residual category, never "unknown".
   Unknown remains null with a recorded reason. Composite/panel membership is not
   reconstructed from classification. This design does not declare every order atomic.
6. Nullable migration columns have no default code. Invalid code/type/family pairs
   are rejected server-side and by DB validation. Omitted patch key means unchanged;
   explicit null means cleared, never inherit-on-read. Unknown non-null codes or
   invalid pairs read as an explicit contract error, not a fabricated category.

Illustrative design examples only, not generated/applied order data:

| Order | Clinical type (unchanged) | Subcategory | Lab family | Admin projection |
| --- | --- | --- | --- | --- |
| CBC | clinical_lab | clinical-pathology | cbc | 검사 / 임상병리 / CBC |
| Blood chemistry | clinical_lab | clinical-pathology | chemistry | 검사 / 임상병리 / 혈액화학 |
| Ultrasound | imaging | ultrasound | null | 영상 / 초음파 |
| Anesthesia procedure | treatment | anesthesia | null | 수술 / 마취 |

## Copy, edit and refresh

- Copy both fields at workspace adoption. Runtime reads only the workspace copy.
  Include both in publisher serialization, source projection/fingerprint, before-
  image, per-field source baseline and customization tracking. Read transport alone
  is not persistence. Repeated adoption must not add rows or repeat audit events.
- Hospital edits use the existing catalog/dispensing authoring authorization for
  that order, checked server-side and in DB; no new role, public master access or
  expanded approval permission. Enforce expected catalog revision and audit changed
  fields. Existing protected execution/path fields remain protected.
- Track adminSubcategoryCode and labFamilyCode independently. Update the pair in
  one transaction and validate its combined meaning. Editing classification must
  not reset unrelated customized fields.
- Master refresh: untouched field adopts newer source; customized field is retained.
  If the proposed pair becomes invalid, preserve the existing pair and record a
  merge conflict. Do not half-apply it, advance its applied-source baseline, silently
  clear the other field or overwrite a hospital edit. Unrelated safe fields may advance.
- An intentional clear is a local override. Returning to master values is an explicit
  reset action, not null interpretation. Reset one field only if the resulting pair
  is valid; otherwise require a pair-level choice.
- Merge conflict is an update status, not clinical review/pending activation. This
  proposal creates no prototype review lifecycle. Existing order eligibility stays
  unchanged; a missing classification stays visible without inventing completion.
- Chart draft copies the workspace values. Persist them in new applied snapshots;
  do not recompute historical classifications from latest master or workspace state.

## Mapping pass — completed bounded deliverable

Completed [mapping and handoff](./slice-03-taxonomy-mapping.md): exact 522 proposals,
10 new subcategory and 12 new lab-family codes, 33 mapping tests, 13 separate legacy
workspace rows. All artifacts remain non-applied; clinical defaults were not repaired.
The following describes the mapping contract; implementation/release remain below.

Create one non-applied manifest keyed by immutable master record ID, with master
revision, existing type/path, proposed codes, rationale, evidence/source, and origin
(documented or intentionally synthetic prototype authoring). Unique target ID set
must equal the frozen 522 master scope; no extra rows, omissions or duplicate IDs.

Use previous material and authoring records first. Order names can guide **offline
authoring**, but automatic substring guesses are neither final evidence nor runtime
classification. Resolve ambiguous cases explicitly using the approved prototype
authoring principle; write the decision and materialize it before use. Mapping
work status never becomes a clinical review state on the order.

Track the 13 previously observed Cheongdam legacy unclassified rows in a separate
workspace-only reconciliation list. Refresh identities/counts before any write;
do not invent a master source, attach by name or delete them by default. Their
presence is a persisted data-quality issue, not permission to inject UI substitutes.

Mapping exit: every target has a valid explicit proposal or a named unresolved
decision; unresolved rows prevent declaring mapping complete, not another research
restart. Final vocabulary and all required mappings must be resolved before backfill.

## Implementation and release order after mapping

1. Validate/freeze vocabulary and target IDs. Confirm this target design against
   actual publisher and adoption code; no schema field is presumed to exist today.
2. Implement additive schema, publisher/projection, API mapping and edit validation
   locally. Add only the two-field copy/merge prerequisite from WP-02. Keep the broad
   execution-default inheritance project separate; never run an adopter that omits
   the new fields or clobbers customized rows.
3. Rollback-test new/modified/cleared/detached/conflicting/stale/foreign-workspace
   cases and graph-independent classification. Verify row counts and field hashes.
4. Scope remote schema + approved data application + compatible app deployment,
   including the existing exact-path migration. Resolve build blockers and rehearse
   rollback before approval/application. No remote authorization is given by this doc.
5. Authenticated verification: table, drawer, rename/save/reopen, workspace switch,
   every category-wide view (including ultrasound) and chart candidate identity.
   Preserve price/default values, fulfillment, permissions and confirmed history.
   Then assess Slice 03 exit and start Slice 04 reconciliation; not all WP-01B done.

### Dependency correction

WP-02 broadly follows WP-01B, but this proposed new taxonomy requires its **two-field
copy/override/merge subset** before taxonomy deployment. This is an explicit bounded
prerequisite, not a claim that existing merge handles it. No need to renumber packages
or advance the entire WP-02 implementation. Confirm the split in implementation scope.

## This turn's verification / handoff

Documentation-only design; no application, migration or remote data changed.
Checked existing UI vocabulary/menu, protected read contract, source projection,
customizedFields contract and WP-02 sequencing. Prior 128 tests/SQL checks belong
to the preceding code slice, not tests of this unimplemented design.
`git diff --check` passed. `npm run docs:check` still reports the two pre-existing
persona-guide references in the prior workspace summary and Slice 01 record.
Report static section-anchor check passed (4 links); no visual/browser or app
verification was performed this turn. Korean report uses humanize-korean fast
run 2026-09-06-008; bundled metrics script unavailable, manual copy review only.
Historical next step was the mapping pass; it is now complete. Continue from the
[mapping implementation handoff](./slice-03-taxonomy-mapping.md), not a new WP.

[Korean design report](../../../../../completed/clinical-master/2026-09-06-wp-01b-taxonomy-design-report.html)
