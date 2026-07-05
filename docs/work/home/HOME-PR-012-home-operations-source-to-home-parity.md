---
id: "HOME-PR-012"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "User request / Home operations source-to-Home parity"
source_docs:
  - "docs/product/features/home/home-operations-work-status-contract-v0.md"
  - "docs/engineering/data-model/home-operations-work-status-read-model.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/work/home/HOME-PR-011-home-operations-live-work-items.md"
dependencies:
  - "HOME-PR-011"
updated: "2026-07-05"
---

# Home Operations Source-to-Home Parity

## Goal

Verify that work created through the authoritative source workflows appears in Home `원내 현황` with the same queue-card information contract, without creating Home-only dummy data.

## Scope

- Add an API replay regression that creates source work through existing reservation, chart order, fulfillment, and billing flows before reading Home operations.
- Cover reservation, consultation/visit, lab, imaging, dispensing, treatment, and billing work items.
- Strengthen the Home server fallback used when the aggregate RPC is unavailable so billing source work is still read from live source tables where available.
- Keep the local `clair-demo` replay path scoped to deliberate demo/mock identity only.
- Keep Cheongdam/prepared-clinic Home operations mockless: API failures remain failures and are not hidden as empty work.
- Extend Home UI regression coverage so cards for all active work types render from the common source queue-card fields.

## Out Of Scope

- Creating fake Home-only work items.
- Adding a new reception queue writer before the product/source creation rule is decided.
- Inpatient operations source mapping.
- Production or real customer/patient/guardian/payment data changes.
- Destructive DB operations such as drop, truncate, rename, or source-table mutation.

## Done Criteria

- Source-created reservation work appears in the Home `예약` column.
- Source-created consultation/visit queue work appears in the Home `진료` column.
- Confirmed chart orders appear as lab, imaging, dispensing, and treatment Home work items via fulfillment work items.
- Billing invoice/candidate work appears in the Home `수납` column.
- Home cards preserve source queue-card fields such as primary text, secondary text, status badge text, time label, owner/queue label, drawer summary, and source navigation path.
- The replay test compares source API output to Home operations API output by `sourceType` and `sourceId`.
- The `접수` column gap is documented instead of papered over with a fake writer.

## Verification

- `npx playwright test tests/home-operations-source-parity.spec.ts --reporter=line`
- `npx playwright test tests/home-operations-work-items-server.spec.ts --reporter=line`
- `npx playwright test tests/home.spec.ts --grep "home live operations cards match source queue card fields" --reporter=line`
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run docs:check`
- `git diff --check`

## Completion Notes

Handed to human review on 2026-07-05.

- Added `tests/home-operations-source-parity.spec.ts` to create source work first, then verify Home readback.
- Added demo-only Home operations source replay support for `clair-demo` so tests can exercise existing source flows without enabling mock fallback for Cheongdam/prepared workspaces.
- Added billing coverage to the RPC-missing source fallback path.
- Expanded Home UI card coverage across reservation, consultation, lab, imaging, dispensing, treatment, and billing card contracts.
- Left the reception writer as a documented product/source gap.
