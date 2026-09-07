---
type: Work Item
title: Imaging definitions and actual acquisition or review
status: in_progress
updated: 2026-09-06
---

# Scope and contract

This local slice retains all30 imaging identities and26 original authored scopes.
Four exact-ID functional synthetic corrections supply the missing heart,
uterus/fetus, thoracic/abdominal focused-ultrasound and supplied thoracic CT-review
regions. No runtime name inference, PACS integration or clinical authority claim
is introduced. Names and prices are unchanged.

The CT-review order describes supplied images, not a new scan. Its false
contrast/sedation plan values mean neither is newly performed by this review
order; they do not state whether the historical CT used contrast or sedation.
Its one-view fixture is a supplied-image review unit, not an acquisition count.

Actual imaging records require the performer to explicitly select new acquisition
or existing-image review, enter acquired/reviewed views, the actual protocol,
quality, findings and interpretation. Planned defaults never populate actual
findings or claim an examination occurred. Timestamp is also explicit. Corrections
append a new result version; confirmed plans and prior actual results remain
immutable. Veterinary review/billing rules remain the existing runtime contract.

## Local evidence

- [Non-applied definitions](artifacts/wp-06/imaging-definitions.non-applied.v1.json):
  all30 fully populated V1 planned contracts; synthetic, not clinically validated,
  prototype-only provenance. The artifact cannot be imported by runtime fallback.
- Four focused contract cases cover all30 identities/default validation,26
  retained scopes, reproducible generation, CT-review wording and explicit actual
  disposition/required fields. Focused ESLint passes for both new test files and
  the generator.
- [Rollback assertions](artifacts/wp-06/imaging-local-assert.sql) cover all30
  publish/adopt/retry/exact default projection and foreign workspace protection,
  followed by real CT-review confirm/start/actual/complete/retry/amend/readback.
  The parent-run shared local PostgreSQL harness passed these assertions on
  2026-09-06, including foreign-control preservation and immutable confirmed plan.
  The entire transaction finished with `ROLLBACK`; no data or migration persisted.
- The dedicated synthetic mocked-API browser case covers empty actual fields,
  explicit existing-image review, completion, reopen and reasoned amendment.
  All five focused cases (four contracts plus browser) passed on 2026-09-06 in
  5.7 seconds, using Chromium at `http://127.0.0.1:3000` with synthetic mocked APIs.
  URL/title, meaningful queue content, normal pointer interaction and no browser
  page errors were checked. Screenshot: `/tmp/wp06-imaging-review-amended.png`.
- Browser triage found a genuine render loop in `ImagingOrderDetailTable`:
  a new `[detail]` array on every TanStack render repeatedly reset table state.
  Parent integration memoized that single-row array; the same previously stalled
  execution-button interaction then passed without forced click or event bypass.
  Parent also removed fabricated live captured/read timestamps and assignee-name
  fallback, and made planned/history labels explicit about acquisition vs review.

## Verification

```sh
npx playwright test tests/imaging-defaults-actual.spec.ts tests/imaging-execution-browser.spec.ts --timeout=90000 --reporter=line
npx eslint tests/imaging-defaults-actual.spec.ts tests/imaging-execution-browser.spec.ts scripts/generate-wp06-imaging-definitions.mjs
node scripts/test-wp01b-taxonomy-local.mjs
```

## Remaining acceptance

Remote publish/adoption/activation, authenticated Admin/chart verification across
all30 and workspace device/protocol override acceptance remain separate WP09
gates. The local SQL explicitly activates only the synthetic CT fixture inside
rollback; it is not production activation evidence. No remote write, release,
commit, push or deployment is performed by this slice.
