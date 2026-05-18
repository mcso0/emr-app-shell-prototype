---
id: "DEMO-DATA-PR-001"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Project 04 / DEN-99"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/research-notes.md"
dependencies:
  - "RECEPTION-LIVE-PR-013"
  - "CLINICAL-BILLING-PR-001"
updated: "2026-05-19"
---

# Portfolio Virtual Hospital Dataset Foundation

## Goal

Define the first-pass synthetic virtual hospital demo dataset for the portfolio MVP before deeper chart/order/billing persistence implementation continues.

## Background

승욱's current product goal is not production launch. The goal is a high-fidelity portfolio MVP that behaves like a real operational EMR: login, workspace, roles, reception, chart, orders, lab/imaging/dispensing/treatment handoff, results, and billing.

Project 04 depends on order, diagnosis, template, and scenario semantics. If those are left vague, chart/order/billing persistence can be implemented around the wrong shape.

## Scope

- Create `docs/product/demo-data/` source docs.
- Use public veterinary/EMR references only as synthesis input.
- Define VIP동물의료센터 청담점 as the virtual hospital.
- Define representative scenarios, order catalog, order sets/templates, diagnosis catalog, staff roles/workflow, and seed handoff.
- Create a Korean HTML report.
- Reflect the work in Linear as DEN-99 under Project 04 milestone `00 Clinical Persistence Scope & Data Contract`.

## Out Of Scope

- Real patient or hospital data.
- Real medical data import.
- Medical accuracy claims or clinical decision support.
- UI implementation.
- DB migration implementation.
- Remote Supabase, production deploy, or real data access.

## Done Criteria

- The 9 demo-data docs exist and link together.
- Work index and current status mention DEN-99.
- HTML report exists under `docs/completed/demo-data/`.
- `npm run docs:check` and `npm run security:secrets` pass.
- Linear DEN-99 includes summary/verification/out-of-scope and is moved to Human Review.

## Verification

- `npm run docs:check`
- `npm run security:secrets`

## Result

Created the first-pass synthetic virtual hospital dataset foundation for portfolio MVP planning. The dataset is designed to become app mock/seed data in follow-up implementation work.
