---
id: "CLINICAL-MASTER-PR-013"
status: "completed"
area: "clinical-master"
priority: "P0"
target_pr: "Deterministic Airtable operational master v3 authoring/package"
execution_boundary: "deterministic package completed; downstream Supabase release/adoption verified; Airtable delta remains write-disabled"
predecessor: "CLINICAL-MASTER-PR-011"
updated: "2026-08-24"
remote_writes: 0
---

# Clinical Master PR-013: Airtable operational master v3 package

## Status and boundary

This work item completed the deterministic Phase A atomic/laboratory package.
The package itself performed no Airtable or Supabase write: Airtable evidence
remains the read-only Base `applMtgWwOxwPigB8` readback and the current delta
manifest stays write-disabled. Its exact 230-row supported payload and 120-order
pricing sidecar were subsequently consumed by CLINICAL-MASTER-PR-014, whose
remote Supabase release, allowlisted adoption, pricing, and browser readback are
recorded there. Order Set authoring remains excluded.

The source remains the existing synthetic source identity
`source.synthetic.operational-pilot.v1` at Airtable record
`recMiLy9KGJECHbvL`. The v3 release is approved for structural testing and is
explicitly synthetic/non-authoritative; it is not clinical approval.

## Exact package counts

| Package | Count | Boundary |
| --- | ---: | --- |
| Authoring Master Records | 254 | 230 publisher-supported + 24 diagnosis authoring-only |
| Publisher-supported records | 230 | Diagnosis and diagnosis-category rows excluded |
| Names | 254 | Exactly one preferred Korean name per master row |
| Atomic orders | 120 | consultation 12, preventive 12, lab 30, imaging 12, treatment 18, dispensing 16, surgery/anesthesia 8, inpatient 6, emergency 3, dental 2, certificate/misc 1 |
| Lab tests / panels | 36 / 10 | Existing 13 / 4 preserved; only required additions |
| Lab panel items | 60 | Existing 13 preserved; 47 added |
| Lab order profiles | 30 | Existing 17 preserved; 13 added |
| Classification paths | 13 | Existing 5 preserved; 8 added |
| Diagnosis category links | 12 | Existing authoring-only links unchanged |

The separate workspace pricing fixture has 120 positive integer KRW amounts,
120 unique order keys, and 120 unique amounts. Prices use category price base
plus category serial and the exact synthetic total is `5,529,073` KRW. These
values are adoption fixtures only and are never included in the publisher
payload.

All current 30 order master keys and details are preserved. The legacy/test
key `cm.order.consult.initial` is intentionally excluded from the v3 payload,
pricing, collision map, and sets; its v3 operational replacement is the fresh
key `cm.order.consult.first-visit` with preferred name `초진`. Added order, lab
test, and lab-panel names are concrete hospital-style operational draft labels;
the static guard rejects generic counter labels such as `합성 검사 1`. The 106
unchanged live rows plus the audited fork retain their live
`changeSummary`/`sourceNotes`; each of the
147 added rows is marked `synthetic operational master v3 addition` with
explicit synthetic additive notes.

The active inpatient classification path uses the current `NT_BILLING_ONLY`
route. The sidecar preserves the source/held semantic as
`heldSourceRouteCode: NT_INPATIENT`, maps the master route to `billing_only`,
and does not publish the held route. No held route is referenced by a
published path.

The authoring snapshot contains exactly eight DB-valid chart groups: the five
live groups plus `CG_PREVENTION` and `CG_SURGERY`, while inpatient reuses the
existing central runtime key `phase1a2.fallback.chart.CG_INPATIENT`.
Preventive and surgery paths use the two new rows; emergency, dental,
certificate/misc, and dispensing/billing reuse existing
`CG_EXAM`/`CG_PROCEDURE`/`CG_CONSULTATION`/`CG_MEDICATION_SUPPLY` rows. The
inpatient, emergency, certificate, and dispensing-billing paths likewise
reuse `phase1a2.fallback.route.NT_BILLING_ONLY`; no `cm.route.billing-only`
row is authored. The additive laboratory support rows are units
`mmol_l`/`seconds`/`million_per_ul` and specimens
`cytology_slide`/`swab`/`joint_fluid`/`citrate_plasma`. Static natural-key
guards reject the removed `cm.chart.inpatient` and `cm.route.billing-only`
keys.

Lab semantics are explicit rather than index-rotated: the separate
[`clinical-master-operational-v3-lab-semantics.json`](../../../tests/fixtures/clinical-master-operational-v3-lab-semantics.json)
records exact input type, unit, and specimen for all 23 new tests, six named
panel memberships totaling 47 links, and the 13 profile targets. The exact
panel partition is electrolyte `7`, coagulation `2` (citrate plasma only),
pre-op `8`, liver `8`, kidney `8`, and metabolic `14`; no fecal, urinalysis,
smear, reticulocyte, or blood-type filler appears in a chemistry panel. The
glucose service label is `당대사 패널` and its membership is metabolic-only.

## Airtable baseline and write manifest

The read-only baseline is recorded in
[`clinical-master-airtable-operational-v3-current-readback.json`](../../../tests/fixtures/clinical-master-airtable-operational-v3-current-readback.json).
The live table totals were `1/1/107/107/5/13/17/12` in the physical table
order Release Drafts, Sources, Master Records, Names, Classification Paths,
Lab Panel Items, Lab Order Profiles, and Diagnosis Category Links. Its
canonical baseline hash is
`f3ba11edfc20ed0244ca4cb9c5bf0590313a173e2c07478edd35d05fcb059a4f`.

[`clinical-master-operational-v3-airtable-write-manifest.json`](../../../tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json)
is an executable-ready eventual additive plan only and has `writeAllowed:
false` / `mutationsPerformed: 0`. It includes exact create field payloads for
147 Masters, 147 Names, 8 paths, 47 panel-item links, and 13 profiles; source
and all existing stable-key rows except the audited identity fork are
verify-only. A CAS gate requires the
readback hash and all eight baseline table counts to match before any future
write. Every relation is a stable-key resolver token with no invented record
ID, and the rollback journal is created-ID-only with all pre-write IDs null.
Semantic comparison found zero actionable differences for 106 unchanged
Master Records; the one audited identity fork is recorded separately, and the
11 noted differences are Airtable's omission of
null-valued cells and therefore require no update. The planned mutation shape
is:

- reuse/update the single Release Draft row by its current record ID;
- keep the existing Sources row and ID unchanged;
- CAS-update Master Record `recZW92s9i06wpNp0` only after verifying its exact
  current key `cm.order.consult.initial`, changing it to
  `cm.order.consult.first-visit`, and preserving linked Name record
  `rec0Pw4CymPIed8ta`; restore the old key by the same record ID first on
  rollback;
- create 147 new Master Records and 147 new Names;
- create 8 paths, 47 panel-item links, and 13 lab-order profiles;
- update no other existing Master/Name/relation rows and create/update no
  diagnosis links. This is 106 unchanged live rows plus one audited identity
  fork; the central legacy row is not silently remapped.

Writable relation payloads intentionally omit the computed `rowLabel` formula
fields (`fld8GNoJTzlAYtGnF` for Lab Panel Items and `fld1KwiL9b4ipNtyX` for
Lab Order Profiles); expected labels remain metadata outside `fields` for
review. All null/undefined writable values are omitted, including
`safetyReason` on the 147 new Masters and the mutually exclusive lab-test or
lab-panel link field on each profile. The inverse release rollback restores
the exact pre-update writable Release Draft fields (with the prior select
normalized to `status: approved`) by its existing record ID before reverting
any created IDs. Its exact rollback order is Release Draft, Profiles, Panel
Items, Paths, Names, then Masters.

No custom workspace row is deleted. The sidecar records the supplied
Cheongdam row IDs and keeps semantic collision status pending until an exact
v3 name/semantic fingerprint comparison is performed. Adoption targets are
`workspace-clinical-master-pilot-v1`, `workspace-clair-cheongdam`, and
`clair-demo`; `clair-foreign-demo` is an excluded unchanged negative control.

The actual prior Airtable write/readback evidence remains historical and is
not being replayed: manifest CAS
`0c65e0a1f18a3769e11061c02a60beb7e8b08814ae9b2f2ffb68336dbdd832bd`, action
IDs are recorded in the evidence section below, and no rollback was executed.
The current fresh-key manifest is a new write-disabled candidate and requires
the single-row CAS above before any future write.

The separate final-state delta is tracked in
[`clinical-master-operational-v3-airtable-delta-manifest.json`](../../../tests/fixtures/clinical-master-operational-v3-airtable-delta-manifest.json)
(SHA-256 `b56bea202a0cc37d7a0a0b47a5b8042bac524b4ce24313b9d23c1f1d4a946433`).
It is based on the live final readback hash
`e2f931eef25871131de7b78a948b3dfe1892efa9bb2d89ae6a85b30e290cb44a` and
contains an eight-table before/post hash map. The expected post full-readback
hash is `34554f2c7f7d6cb2720e298a5baed778b493b988eba945855071bdf22f55eb12`;
only Master Records `recZW92s9i06wpNp0` changes its key and the linked Name
lookup `rec0Pw4CymPIed8ta` must recalculate from the legacy key to the fresh
key. Names is verify-only—there is no second Name write. Eligibility remains
deferred until all eight before hashes/counts, exact linked ID/name, all eight
post hashes, fresh-key uniqueness, and rollback restoration to the baseline
hash pass in a separately approved execution.

Historical Airtable action IDs (readback evidence only) are
`actCIjmSTu4iby6y9`, `actN7DGCYg8KahTeC`, `actX961Vwe4K6W28V`,
`actYjM9XQEErs165o`, `actaLJIycbhqttNEP`, `act6oxDQpRNPis8B7`,
`act9y7m1Uscqv5wmg`, `act6BxJPpGByBctwT`, and `actfnegG67ldq3t0N`.

## Files

- `scripts/generate-clinical-master-operational-v3.ts` — deterministic local
  generator and `--check` drift gate.
- `tests/fixtures/clinical-master-operational-v3-authoring.json` — full 254-row
  authoring snapshot.
- `tests/fixtures/clinical-master-operational-v3-adapter-output.json` — 230-row
  publisher payload plus 24-row diagnosis exclusion report.
- `tests/fixtures/clinical-master-operational-v3-pricing-adoption.json` —
  workspace-only positive integer KRW prices, route mapping, and collision
  policy; no canonical publisher pricing.
- `tests/fixtures/clinical-master-operational-v3-lab-semantics.json` — exact
  23-test input/unit/specimen table, named panel links, and profile mapping.
- `tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json`
  — no-write executable-ready additive manifest with exact creates, field IDs,
  stable-key link tokens, CAS gate, and created-ID-only rollback journal.
- `tests/clinical-master-operational-v3.spec.ts` — focused static count,
  preservation, lab reference, pricing, route, diagnosis, name, and no-write
  assertions.

## Verification record

Passed:

```text
node --experimental-strip-types scripts/generate-clinical-master-operational-v3.ts --check
PLAYWRIGHT_BASE_URL=https://emr-app-shell-prototype.vercel.app node_modules/.bin/playwright test tests/clinical-master-operational-v3.spec.ts --project=chromium --reporter=line
PLAYWRIGHT_BASE_URL=https://emr-app-shell-prototype.vercel.app node_modules/.bin/playwright test tests/clinical-master-operational-v3.spec.ts tests/clinical-master-airtable-publish-adapter.spec.ts tests/clinical-master-airtable-authoring-export.spec.ts --project=chromium --reporter=line
node_modules/.bin/tsc --noEmit --pretty false
node_modules/.bin/eslint --max-warnings=0 scripts/generate-clinical-master-operational-v3.ts tests/clinical-master-operational-v3.spec.ts
npm run docs:check
git diff --check
```

The generator reported authoring 254, supported 230, orders 120, lab tests
36, panels 10, paths 13, panel items 60, profiles 30, diagnosis links 12,
and Names 254. The current generated fixture hashes are recorded by the
generator output:

```text
authoring      eafac370977baa9850fc322bcbe27587b853ccec58fd0a86358e7769dbf04bc6
adapter        ee7c8d0f379c71ac675ad90d9e92abfd17da798785b4e0ebd566c6e8394e8697
pricing        7b0e273f9809e9febc2d74a9cc332f1a6fe4866bc112182da58cfba6a9e0ab2b
lab-semantics  d3ce711c9f0cc5741e5d6e291c8d29bbaa883b0563828b109e5c8464eb28aab8
write-manifest 19951ef0fcf0831c0aa542def2be7618b99d8a8991a7e72373426c630d553f94
```

The combined focused operational, Phase C, and release-scoped adoption specs
passed 18/18. The Playwright command sets
`PLAYWRIGHT_BASE_URL` only to reuse the existing deployed origin and avoid a
local webserver; these tests are static fixture/contract checks and do not
claim authenticated browser behavior. TypeScript, focused ESLint, docs:check,
and diff checks also passed. No dependency or lockfile change was made.

The final 230-row publisher payload was replayed twice inside one explicit
outer transaction against the running local Docker publisher and then
rolled back. Both calls accepted the fallback chart/route identities: the
first returned `idempotent:false`, `recordCount:230`, and the second returned
`idempotent:true` for the historical omitted-scope source fingerprint
`3213a3f84595ae11007970448b670063c49ea167f01e1825258a655b6843c137`. The exact pre/post
residual proof was identical: `records=23`, `releases=1`, type map
`unit 1`, `species 2`, `task_route 6`, `chart_group 5`, `order_category 2`,
`clinical_action 7`, and
`keysSha256=bece49fe9a523c5be69ec4cada1480445c923c1f5e567f7ae958589de2436666`;
the post-rollback v3 release count was `0`. No local DB state remains from
the replay. The repository helper's `--readback` mode remains environment-
blocked because the host `psql` CLI is not installed; no reset or schema
workaround was performed.

Historical Airtable write/readback evidence (not replayed in this handoff) used
manifest CAS `0c65e0a1f18a3769e11061c02a60beb7e8b08814ae9b2f2ffb68336dbdd832bd`,
created 362 records across nine actions, and read back final counts
`1/1/254/254/13/60/30/12`; Airtable rollback was not executed. The current
fresh-key candidate is write-disabled and separately requires the audited
single-row mutation `recZW92s9i06wpNp0: cm.order.consult.initial →
cm.order.consult.first-visit`, preserving Name `rec0Pw4CymPIed8ta`.

## Out of scope / review gates

This slice contains no clinical claims, dosing, reference ranges, real
hospital/patient data, canonical price or weight-tier authority, or Order Set
authoring. The package contract is complete and its downstream Supabase use is
verified; the separate Airtable delta remains write-disabled and is not claimed
as part of the remote Supabase completion.
