---
id: "CHART-PR-031"
status: "human_review"
area: "chart"
priority: "P0"
target_pr: "User-approved Plan/Order legacy column contract foundation"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/product/roadmap/plan-order-all-tab-legacy-column-delivery-plan.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-validation.md"
dependencies: []
updated: "2026-09-02"
---

# Plan/Order Legacy Column Contract Foundation

## Goal

Version the agreed Plan/Order `전체` tab legacy column product contract and its end-to-end delivery procedure so a fresh Codex task can begin from a clean, reviewable source instead of depending on chat history or an unrelated dirty checkout.

## Approved Scope

- Add the Plan/Order legacy column domain contract without changing its agreed product meaning.
- Add the delivery plan that sequences requirements review, current-state investigation, implementation planning, verification, PR delivery, production approval, and authenticated remote smoke.
- Link both sources from the smallest relevant product and work indexes.
- Record the completed repository, authenticated production UI, remote Supabase,
  and Airtable read-only investigation before contract freeze.
- Promote the source contract only after the independent second review of the
  evidence-backed corrections passes.

## Out Of Scope

- Plan/Order application code, UI, API, database, RPC, RLS, migration, or Airtable changes.
- Remote Supabase/Airtable writes, fixed staging, `main`, production deployment,
  or alias changes.
- Treating this documentation PR as implementation approval or as proof that the documented behavior already exists.
- Reformatting or committing unrelated local work.

## Done Criteria

1. The domain contract and delivery plan are tracked on an isolated branch based on current `origin/main`.
2. Each document links back to this work item and is discoverable from the relevant product indexes.
3. The work index records this documentation slice without changing unrelated work status.
4. Documentation links, frontmatter, diff whitespace, and secret scanning pass.
5. The exact scoped commit is pushed and available in a PR for review.
6. Phase A evidence classifies every target column and lifecycle requirement,
   resolves source-backed implementation decisions, and routes the remaining
   work into PR-sized dependencies.
7. An independent second review reports the corrected contract freeze-ready
   with no remaining implementation-blocking product ambiguity.

## Verification Plan

- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`
- Review `git status --short` and `git diff --stat` for scope containment.

## Verification Evidence

- `npm run docs:check`: passed after Phase A reconciliation; 968 agent Markdown
  files were checked and internal references resolved.
- `git diff --check`: passed after the freeze-ready corrections.
- Independent second review: freeze-ready after resolving confirmation/billing
  snapshot ownership, post-invoice return holds, and all-cancelled set status.
- `npm run security:secrets`: passed on the exact staged documentation
  candidate; 3,977 tracked files were checked.
- `git diff --cached --check`: passed, and the staged candidate contains only
  the nine scoped contract, roadmap, validation, work-item, and index files.

## Handoff

The Phase A investigation is recorded in
`CHART-PR-031-plan-order-legacy-column-validation.md`. Continue in dependency
order through `CLINICAL-MASTER-PR-023`, `CLINICAL-FULFILLMENT-PR-010`,
`CLINICAL-BILLING-PR-023`, and `CHART-PR-032`. These documents are target and
gap evidence, not proof that the behavior is already implemented.
