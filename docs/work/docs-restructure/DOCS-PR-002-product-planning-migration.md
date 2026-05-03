---
id: "DOCS-PR-002"
status: "done"
area: "docs-restructure"
priority: "P0"
target_pr: "PR 2"
source_docs:
  - "docs/product/README.md"
  - "docs/product/prd/clair-emr-saas-prd.md"
  - "docs/product/features/legacy-mvp-feature-spec.md"
  - "docs/engineering/data-model/"
dependencies:
  - "DOCS-PR-001"
updated: "2026-05-03"
---

# Product Planning Migration

## Goal

Move PRD, feature spec, user flow, and data model docs into canonical product and engineering locations.

## Scope

- Move PRD into `docs/product/prd/`.
- Move the legacy all-in-one feature spec into `docs/product/features/`.
- Move user flow markdown and copy the PNG export into `docs/product/user-flows/`.
- Move DB structure drafts into `docs/engineering/data-model/`.
- Leave compatibility stubs at old important paths.

## Out Of Scope

- Splitting the legacy feature spec into feature-level specs.
- Changing product requirements.
- Changing app code.

## Done When

- Canonical product and data model paths exist and are indexed.
- Old important paths have moved stubs.
- Internal docs references prefer canonical paths.

## Verification

- `npm run docs:check`
- `npm run lint`

## Handoff Notes

The legacy feature spec still needs a future split into feature-level specs.
