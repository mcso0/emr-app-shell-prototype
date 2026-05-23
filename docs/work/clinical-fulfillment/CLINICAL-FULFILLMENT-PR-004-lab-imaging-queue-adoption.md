---
id: "CLINICAL-FULFILLMENT-PR-004"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-238"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-003-chart-confirmation-sync.md"
dependencies:
  - "DEN-237"
  - "DEN-238"
updated: "2026-05-23"
---

# Add Lab Imaging Queue Server Read And Status Mutation

## Goal

Adopt the fulfillment work item route in lab and imaging screens while preserving the existing demo result/study detail experience.

## Scenario

1. Lab and imaging side panels load their existing demo queue.
2. The screen reads matching fulfillment work items from the server route.
3. Matching order ids apply server-backed status and assignee information to the visible queue.
4. Imaging completion sends a fulfillment status mutation through the server route.
5. Existing lab/imaging result, receipt, attachment, and demo query flows keep working.

## Scope

- Add a client-side fulfillment queue read path for lab and imaging modules.
- Map fulfillment statuses to existing lab result and imaging study status labels.
- Add fulfillment status mutation calls behind existing lab/imaging status actions.
- Extend focused Playwright coverage to confirm imaging completion sends the fulfillment PATCH.
- Preserve fixture fallback when the route cannot be read.

## Out Of Scope

- PACS/device ingestion.
- Lab result OCR/import/provider integration.
- Dispensing/treatment screen adoption.
- Billing candidate sync from fulfillment completion.
- Remote Supabase migration push.
- Broad visual redesign.

## Done When

- Lab/imaging screens can read fulfillment work items and apply status context by order id.
- Status action can call the fulfillment mutation route without breaking current UX.
- Existing lab/imaging Playwright coverage passes.
- Docs/work, changelog, and closeout evidence are updated.
- Linear `DEN-238` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/lab-imaging.spec.ts tests/fulfillment-work-item-server.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Handoff Notes

Start `DEN-239` next. It should adopt the same fulfillment route in dispensing and treatment views.
