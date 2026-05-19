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

## Human Review Addendum

- Added hospital admin Order 관리 table field guidance after reviewing the provided preset reference screenshot.
- Clarified that order catalog rows need standard order name, in-hospital name, billing name, availability status, price, unit, target species, and individual/set row type.
- Added seed handoff fields so future fixtures can render realistic order-management rows without using real hospital or patient data.
- Added Order 세트 list and drawer field guidance after reviewing the set-management reference screenshot, including included order counts, amount basis, billing reflection, care guide, internal instruction, scheduler, and included order table rows.
- Added `lab-test-items-v1.md` after reviewing the 검사 항목 reference screen, separating billable lab orders from result-sheet item categories, input types, units, ordering, and deletion locks.
- Added order detail drawer and `medication-order-details-v1.md` guidance after reviewing the order detail reference screen, separating shared routing/billing/guide fields from medication-specific calculation metadata.
- Added `hospital-admin-preset-reference-archive-v1.md` to split incoming preset-screen observations into data candidates versus UX/operational rules.
- Added `order-pricing-rules-v1.md` for set fixed price, included-order sum, range price, child billing reflection, sales-unit migration, and chart-applied snapshot rules.
- Added `chart-order-application-v1.md` after reviewing the expanded 진료/차트 Order section, separating master presets from encounter-owned applied order rows, confirmation state, billing footer totals, and scheduler handoff.
- Added 진료 오더 table cell guidance to `chart-order-application-v1.md`, including T-code labels, NT task states, contextual state-button actions, order-name truncation/tooltips, controlled-drug compact badges, device resend errors, and urgent flags.
- Tightened the data-first contract across order catalog, order sets, lab items, medication details, pricing, chart-applied order rows, and seed handoff so future fixtures can store source IDs, applied snapshots, set child rows, calculation sources, delete-lock derivation, task links, invoice links, and separate confirmation/billing lifecycle state.
- Moved screen-only behavior such as sorting, dirty prompts, visual layout, dialog copy, tooltip wording, tab layout, and modal usability into deferred screen-implementation notes.
- Added the requested five-family order data structure map: master order data, order set data, lab test item data, chart-applied order data, and billing/calculation data.
- Added data-affecting rules for minimum lab item linkage, frequency aliases, total-count math, sales-unit quantity behavior, vaccine/dose-sequence metadata, and controlled storage/route/instruction values.
- Recorded 승욱's product decision that Order 세트 must be managed in a separate hospital-admin surface from individual Order 관리, while chart-side order search/application can still combine individual orders, sets, and templates.
- Added `patient-guardian-data-v1.md` from 동물 등록 and 동물 정보 drawer references, covering animal registration fields, breed/species fallback, guardian relationships, staff assignments, status labels, messaging consent, soft delete, deletion locks, restore audit fields, and chart/reception/message navigation state.
- Addendum report: `docs/completed/demo-data/2026-05-19-den-99-order-management-table-addendum-report.html`
