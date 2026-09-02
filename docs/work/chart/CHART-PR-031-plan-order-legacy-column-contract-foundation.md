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
- Keep both source documents in `draft` while their required current-system investigation and second review remain incomplete.

## Out Of Scope

- Plan/Order application code, UI, API, database, RPC, RLS, migration, or Airtable changes.
- Remote Supabase, fixed staging, `main`, production deployment, or alias changes.
- Treating this documentation PR as implementation approval or as proof that the documented behavior already exists.
- Reformatting or committing unrelated local work.

## Done Criteria

1. The domain contract and delivery plan are tracked on an isolated branch based on current `origin/main`.
2. Each document links back to this work item and is discoverable from the relevant product indexes.
3. The work index records this documentation slice without changing unrelated work status.
4. Documentation links, frontmatter, diff whitespace, and secret scanning pass.
5. The exact scoped commit is pushed and available in a PR for review.

## Verification Plan

- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`
- Review `git status --short` and `git diff --stat` for scope containment.

## Verification Evidence

- `npm run docs:check`: passed; 962 Markdown files were checked and internal references resolved.
- `npm run security:secrets`: passed after the seven scoped files were staged; 3,972 tracked files were checked.
- `git diff --cached --check`: passed after removing the trailing blank line reported by the first run.
- The staged diff contains only this work item, the two Plan/Order source documents, and their four minimal index updates.

## Handoff

Start the implementation goal from this branch or a later reviewed integration commit. The new task must begin with the contract-readiness and current-system investigation phases; it must not treat these draft documents as proof of current remote behavior.
