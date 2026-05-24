# Completed Work Documents

This folder stores durable closeouts and reports for finished work. Completed records are evidence and handoff material; they are not the active source of truth.

## Read First

- Closeout template: `docs/_meta/templates/closeout.md`
- Result review rules: `docs/_meta/result-review-rules.md`
- Current status: `docs/engineering/current-status.md`
- Work index: `docs/work/index.md`

## What Belongs Here

- Finished-work closeouts.
- Korean HTML reports for meaningful Linear issue work.
- Verification summaries, remaining risks, and next-step recommendations.
- Project or initiative closeouts that should be preserved after execution ends.

## Common Subareas

- `auth/`: completed auth and workspace boundary work.
- `billing/`: completed billing workspace work.
- `chart/`: completed chart workspace work.
- `clinical-billing/`: completed clinical billing and persistence work.
- `clinical-fulfillment/`: completed order fulfillment handoff work.
- `design/`: completed design system, visual QA, and UI reports.
- `docs/`: completed docs-operations work.
- `reception/`: completed reception workflow work.
- Other area folders mirror the product or engineering area that produced the closeout.

## Rules

- Use `YYYY-MM-DD-<work-slug>.md` or `YYYY-MM-DD-<work-slug>-report.html` naming.
- Include the requested goal, actual result, changed files, verification, risks, and next step.
- Link the completed record from the Linear issue or final user review when a Linear issue exists.
- If completed work changes current guidance, update the relevant `business/`, `product/`, `design/`, `engineering/`, `work/`, or `_meta/` source document. Do not rely on the closeout alone.
- Keep completed reports out of the default reading path unless a current source doc, work item, or Linear issue points there.

## Boundaries

- Do not start new work from completed reports by default.
- Do not use completed reports to override `docs/engineering/current-status.md` or the most specific approved source doc.
- Do not place in-progress plans here. Use `docs/work/` for PR-sized execution and the relevant source-doc area for durable guidance.
