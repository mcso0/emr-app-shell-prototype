---
id: "DEN-453"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-453"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/work/demo-data/DEN-452-lab-result-persistence-db-rls-api.md"
dependencies:
  - "DEN-452"
updated: "2026-06-09"
---

# Lab Result UX Loading Error Retry Permission States

## Goal

Make the lab result entry screen show clear API states after DEN-452 added durable local/dev result persistence.

## Scope

- Surface result-sheet catalog loading, empty, generic error, and permission-denied states.
- Add a retry action for retryable catalog fetch failures.
- Replace boolean save responses with an outcome that distinguishes success, invalid payload, permission denial, and retryable failure.
- Add a retry action for retryable result save failures.
- Cover the new catalog retry, save retry, and permission-denied states in focused Playwright assertions.

## Out Of Scope

- New DB schema, migration, or seed changes.
- Billing, dispensing, treatment, or audit UI changes.
- Provider/device integration or production Supabase work.
- Full lab result report redesign.

## Done Criteria

- Users can tell whether the result sheet is loading, empty, failed, or blocked by permission.
- Retryable catalog and save failures have visible retry controls.
- Permission denial is not presented as empty data.
- Existing successful lab result entry flow remains covered.

## Verification

- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-453 keeps the existing lab result form layout but makes the API boundary visible to the user. Catalog failures now show a retryable status row, catalog permission failures show a distinct permission-denied message, and save failures now differentiate retryable failures from permission/invalid-payload failures.
