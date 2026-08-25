---
id: "CLINICAL-MASTER-PR-015"
type: "Work Item"
title: "Diagnosis publisher, workspace catalog adoption, and chart classification search"
description: "Publishes the reviewed synthetic diagnosis hierarchy, adopts it into three demo workspaces, and connects the Assessment classification dialog to durable chart diagnosis snapshots."
status: "in_progress"
area: "clinical-master"
priority: "P0"
tags: ["diagnosis", "clinical-master", "chart", "supabase", "production-demo"]
target_pr: "Diagnosis runtime adoption and Assessment classification search"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-data-target-architecture.md"
  - "docs/engineering/data-model/clair-clinical-master-airtable-authoring-export-contract.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-007-diagnosis-foundation.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-013-airtable-operational-master-v3.md"
dependencies:
  - "CLINICAL-MASTER-PR-007"
  - "CLINICAL-MASTER-PR-013"
  - "CLINICAL-MASTER-PR-014"
updated: "2026-08-25"
---

# Clinical Master PR-015: Diagnosis runtime adoption

## Goal

Publish the existing synthetic diagnosis hierarchy, adopt twelve diagnoses into
the three approved demo workspaces, and replace the chart's mock classification
search with a permission-checked workspace catalog that stores immutable
diagnosis classification snapshots.

## Scope

- Extend the private clinical-master publisher for `diagnosis_category`,
  `diagnosis`, and `diagnosisCategoryLinks` in one idempotent release.
- Extend `public.diagnosis_catalog` as the workspace-owned diagnosis catalog and
  adopt the published twelve-diagnosis fixture into the pilot, Cheongdam, and
  `clair-demo` workspaces only.
- Add a workspace/permission-checked diagnosis catalog search RPC and route.
- Store catalog revision and the effective diagnosis/system/disease-group
  snapshot when a chart diagnosis is saved.
- Port the approved responsive `분류 검색` dialog and connect completion to the
  existing chart diagnosis persistence boundary.
- Keep the fourteen existing synthetic/free-text encounter diagnoses unchanged.
- Update affected source docs, work status, and a Korean completion report from
  verified results.

## Out Of Scope

- Clinical terminology import or a claim that synthetic diagnoses are reviewed
  clinical standards.
- Real hospital, patient, guardian, staff, billing, or identity data.
- Adoption into `clair-foreign-demo` or any workspace outside the exact three
  demo allowlist.
- Automatic diagnosis correctness, treatment/order recommendations, or billing
  behavior changes.
- Deleting or backfilling the existing fourteen encounter diagnosis rows.
- New shared dialog/design-system APIs.

## Done When

- The publisher accepts the exact six systems, six disease groups, twelve
  diagnoses, and twelve primary links and rejects invalid hierarchy/link states.
- Each allowlisted workspace has twelve active master-derived diagnosis catalog
  rows; `clair-foreign-demo` stays unchanged and empty.
- Catalog reads require active membership plus `chart:view`; direct browser
  access to the private master remains denied.
- Catalog-linked chart saves resolve the active workspace row server-side and
  persist its revision and immutable classification snapshot; free text remains
  supported.
- The approved dialog supports combined classification search, selection,
  reordering, type/primary adjustment, completion, responsive layouts, and
  loading/empty/error/permission states.
- Focused tests, security checks, typecheck, build, docs checks, rollback-only
  database replay, remote synthetic readback, and scoped authenticated smoke are
  recorded. Production merge/deploy still follows the exact-candidate release
  approval gate.

## Verification

- `npx playwright test tests/clinical-master-diagnosis-runtime.spec.ts --project=chromium --reporter=line`
- `npx playwright test tests/chart-diagnosis-catalog.spec.ts --project=chromium --reporter=line`
- `npx playwright test tests/chart.spec.ts --project=chromium --reporter=line`
- `npm run security:secrets`
- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

## Implementation And Verification Status

Local release-candidate implementation is complete. The candidate includes the
diagnosis-only publisher, workspace adoption/catalog projection, permission-
checked search RPC and route, chart catalog snapshot persistence, and the
approved responsive classification dialog. The existing free-text diagnosis
path remains supported.

Verified against a fresh local Supabase reset on 2026-08-25:

- exact publish: 6 systems, 6 disease groups, 12 diagnoses, and 12 primary links
- canonical payload fingerprint:
  `c6309d0ed739acc0ea4bd095b621c3c5db4cb6509542d78bd886d67c0ea304a0`
- identical release retry returned the existing release without changing the
  protected publication state
- invalid system parent, system-direct diagnosis link, missing primary, and
  duplicate primary inputs were rejected
- a changed candidate release was replayed inside a rollback-only transaction
  with no residual release, master, review, version, or catalog rows
- pilot, Cheongdam, and `clair-demo` each adopted exactly 12 active catalog rows
  and 12 primary classification rows; `clair-foreign-demo` remained at zero
- exact adoption retry preserved the catalog fingerprint
- a changed second release created release-owned revisions for all 24 records;
  all 12 diagnosis link revisions and all 6 disease-group parent revisions
  matched the dependency revisions captured by that release
- inactive unmodified catalog rows were reactivated by re-adoption, while a
  customized row preserved its local display value, recorded `merge_state =
  review_required`, and saved the actually reflected `last_applied_revision`
  rather than the newer observed source revision
- a concurrent adopter/chart-save probe completed after row-lock wait without
  timeout or deadlock; both paths lock catalog IDs in deterministic order
- allowed active `chart:view` members searched each target workspace; missing
  permission, cross-workspace, inactive membership, authenticated direct
  catalog/master reads, and anonymous direct catalog/master reads were denied
- a rollback-only chart save proved one catalog diagnosis plus one free-text
  diagnosis, server-side catalog resolution, immutable snapshot/revision
  preservation on retry, null catalog metadata for free text, and unique audit
  event IDs
- a free-text-only A→B edit produced distinct privacy-safe SHA-256 values in
  the before/after audit projection without storing unrestricted text in the
  audit event
- the focused dialog browser test covers filtering, check state, duplicate-safe
  completion, diagnosis type, preserved existing primary, drag/keyboard reorder,
  hover-only trash action, completion readback, and all four responsive widths
- independent security-boundary review finished with `MUST-FIX: 0`; remaining
  advice is limited to richer actor/reason metadata for future reusable
  privileged-adoption audit contracts and more specific route error rendering
  for a permission race

Remote state is still pending. No migration, diagnosis release, workspace
adoption, pull request merge, Vercel deployment, or authenticated production
smoke is claimed here. Before any shared-project write, refresh the exact remote
before-state and use the release order: additive migration, synthetic publish,
three-workspace adoption, application deployment.

## Handoff Notes

- Source data is the existing synthetic authoring fixture: six systems, six
  disease groups, twelve diagnoses, and twelve links.
- Default newly selected diagnosis type is `suspected`; the veterinarian may
  change it before completion.
- Existing encounter rows remain free-text history even when names match the new
  catalog.
- The primary UI classification uses the primary disease-group link. The master
  link model remains multi-classification capable.
