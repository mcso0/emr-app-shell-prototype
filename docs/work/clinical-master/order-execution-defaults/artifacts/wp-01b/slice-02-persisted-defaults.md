# WP-01B Slice 02 — Persisted-only effective defaults

Date: 2026-09-06. Local implementation and focused verification complete.
WP-01B remains in progress. No authenticated UI acceptance or deployment claim.

## Objective and boundary

Make Admin and new chart orders resolve the same stored defaults without
literal/schema substitutes. Missing values stay missing; required missing values
fail complete validation. Preserve zero, false, explicit saved policies and
source lineage. Scope covers local read/edit/save projection and regression tests.

No remote DB, candidate publication, migration, master/workspace adoption,
confirmed historical data, dependency install, commit, push or deployment change.
Preserved the dirty checkout and all preceding Slice 01/unrelated changes.
Baseline HEAD: `f564a493b52be6f5592bda6484dd0bcf9a8a2c4b`.

## Implemented contract

1. `persisted-order-defaults.ts` selects non-empty generic defaults, otherwise
   same-row stored legacy nested defaults during the bounded compatibility period,
   otherwise missing. No per-field merge. Exposes source and independent clones:
   raw `storedValues` and clinical `values`.
2. Clinical projection strips only reserved `planOrderAuthority`,
   `manualQuantityReason`, `autoDispenseQuantityEnabled`. Raw Admin writes retain
   authority/manual reason. Select the source before stripping; transport its
   marker even when the projection is empty. RPC mapping must retain that marker
   through another chart read, never revive older nested fields.
3. Admin mapper no longer substitutes top-level medication scalar fields or
   literal dose/unit/route/frequency/duration/quantity/instruction/storage values.
   New dispensing drafts are blank. Auto policy is an explicit saved metadata
   boolean, with undefined distinct from false.
4. Admin create/update mirrors generic/nested raw defaults. Overlay edited keys
   on the selected raw object; remove cleared keys instead of restoring old nested
   values. Preserve generic-only fields. Remove cleared legacy scalar mirrors via
   undefined serialization. Do not force old metadata basis, rounding or synthetic
   review status. Existing saved legacy basis/rounding metadata is preserved;
   clinical execution reads the generic basis rather than translating legacy enums.
5. Chart display/editor reads only row input. Complete validation rejects missing
   required inputs; partial validation does not materialize schema defaults.
   Missing booleans show an unset selector rather than an apparent false switch.
   Missing unit-price quantity stays empty; saved zero is retained. Quantity one
   for fixed-price billing/set instances remains an explicit instance rule.
6. Admin quantity calculation requires per-patient basis, identical non-empty
   dose/total units, known frequency and finite inputs/result. Weight/BSA/strength
   and cross-unit calculations are not guessed. Missing dependencies clear the
   computed total. Optional scalar types expose missingness without inventing data.

### Existing SQL compatibility checked read-only

`20260829143000_workspace_dispensing_preset_management.sql` requires
`medication_metadata.defaultDetailInputs.manualQuantityReason` when auto=false.
The later preset transport contract requires generic and nested defaults to
match. Keep the raw reason in both write objects; omit it only from the chart
clinical projection. No SQL change was made. Existing SQL defaults are not
claimed removed by this local read-path slice.

## Changed files

- `src/features/hospital-admin/persisted-order-defaults.ts` — new shared parser.
- `src/features/hospital-admin/data.ts` — Admin read/write projection and quantity.
- `src/features/hospital-admin/module.tsx` — unset presentation and explicit inputs.
- `src/features/hospital-admin/server-order-catalog-core.ts` — optional metadata,
  clinical pricing snapshot/default projection and source-aware RPC mapping.
- `src/features/chart/module.tsx` — direct display/editor/default reads.
- `src/features/chart/order-execution-domain.ts` — no schema-default validation fill.
- `src/features/chart/server-order-draft-persistence-core.ts` — align explicit
  fixture draft initialization with the same parser, without expanding fixture use.
- `tests/hospital-admin-persisted-defaults.spec.ts` — regression matrix.
- `playwright.catalog-contract.config.ts` — include new and existing execution tests.

The catalog core/config already contained Slice 01 changes. Do not treat their
entire working-tree diff as Slice 02 or discard earlier edits.

## Verification and limitations

| Check | Result | Scope |
| --- | --- | --- |
| `npx playwright test --config playwright.catalog-contract.config.ts --reporter=dot` | 82 passed | Pure contract tests, injected synthetic fixtures, no server/browser/DB |
| Targeted ESLint on the changed sources, new spec and config | Passed | Not whole-repository lint |
| `npx tsc --noEmit --incremental false` | Failed | Existing missing `@blocknote/*` and related errors; no changed-file diagnostics in the output |
| `npm run docs:check` | Existing failure | Prior workspace summary and Slice 01 record reference one missing persona-qa HTML guide; no new Slice 02 broken links |
| Independent read-only code review | One must-fix corrected | Source marker loss on empty RPC projection; regression checks a second read, not only immediate output |
| Static HTML report browser check | Passed | 1440×1000 and 390×844 screenshots; mobile content width 390, no broken section anchors; not app UI acceptance |

Tests remove each of 10 dispensing clinical fields and compare Admin/new snapshot
absence, preserve zero/false/arrays and clone independence, cover all nine clinical
types without schema filling, raw-policy create/update parity, field clearing,
unsupported/non-finite calculations, and empty projection lineage. Static renderer
assertions supplement these tests; they are not DOM/browser acceptance.

## Remaining work and exact next step

Start **Slice 03 — stable classification and Admin core summaries** in the
[WP-01B plan](../../WP-01B-persisted-admin-chart-read-parity.md): inspect persisted
clinical type/classification identities, remove label substring placement, and
define the smallest core table field set per category using this parser. Show
incomplete classification/defaults explicitly. Do not add invented missing values.

Then Slice 04 must prove Admin candidate ID/eligibility/default trace into new
chart drafts. Slice 05 owns authenticated UI, empty/error/loading state, save/reopen,
workspace-switch and foreign-control acceptance. UI seeds and unrelated mock
fixtures still exist; this slice does not certify the entire runtime fallback-free.

Existing Admin `qod` frequency and `sachet` unit options do not match chart schema
options; resolve deliberately before complete end-to-end acceptance, not via silent
translation. The absent persisted lab delete-lock gateway from Slice 01 remains
unavailable. Resolve installed BlockNote dependencies separately before app smoke.

CBC atomic orders, nested sets and device/species reference ranges remain the
separate OED-LAB-04 track with WP-02 inheritance. No 522 candidate defaults were
applied. Do not restart external research to finish this read-parity package.

## Human report and continuity

- [Korean HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-slice-02-persisted-defaults-report.html)
- Updated WP-01B, umbrella progress, work index, current status and initialization
  data contract. Earlier reports remain historical evidence.
- Korean copy reviewed with humanize-korean fast run `2026-09-06-005`; missing
  bundled metrics script recorded, meaning-preserving manual pass used.
