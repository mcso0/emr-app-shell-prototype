---
title: "Reception Chart Order Billing Handoff Closeout"
status: "human_review"
updated: "2026-05-19"
source:
  - "DEN-66"
  - "docs/work/reception/RECEPTION-LIVE-PR-013-chart-order-billing-handoff-closeout.md"
---

# Reception Chart Order Billing Handoff Closeout

Linear: DEN-66

## Completed Reception Scope

Project 03 and the first Project 04 regression slice now cover:

- encounter persistence contract;
- local-first reception domain schema migration;
- patient/guardian lookup read boundary;
- patient/guardian registration write boundary;
- walk-in encounter create write boundary;
- appointment check-in transition write boundary;
- shared reception mutation permission matrix;
- reception queue read boundary;
- reception day calendar read boundary;
- sales demo/mock fallback preservation;
- E2E-style reception persistence regression coverage.

## Encounter Contract For Chart, Order, Billing

Chart/order/billing persistence should treat `encounter.id` as the durable join target.

Required context:

- `workspaceId`: mandatory scope for every read/write;
- `encounterId`: primary handoff id;
- `encounterNo`: human-facing display id;
- `patientId`: patient context;
- `guardianId`: guardian context when available;
- `appointmentId`: appointment-origin context when available;
- `primaryVeterinarianId`: initial responsible clinician hint;
- `status`: high-level flow state;
- `checkedInAt`: reception timestamp;
- `visitPurpose` and `chiefComplaint`: initial clinical reason;
- active queue row: operational queue placement with `queueType`, `status`, `enteredAt`, and `priority`.

Status interpretation:

- `waiting`: ready for clinical intake.
- `in_consultation`: charting has started.
- `ordered`: orders or procedures are active.
- `ready_for_billing`: clinical work is ready for invoice/billing.
- `completed`: encounter is closed.
- `cancelled`: encounter should not drive active queues or billing.

## Remaining Risks

- Docker daemon was unavailable earlier, so local Supabase SQL runtime replay still needs a future environment pass.
- Final domain RLS policy SQL and Supabase advisor review remain future work.
- Remote Supabase push/link/query, production deploy, and real clinic/patient data access remain approval-gated.
- Chart/order/billing persistence has not started.

## Next Recommended Issue

Start with DEN-67 `00-01 Confirm clinical billing persistence scope and encounter dependency`.

Reason:

- It confirms which chart/order/billing writes depend on `encounter.id`.
- It prevents the next project from mixing reception closeout with billing implementation too early.
- It keeps remote Supabase and real data guarded until the next scope is explicit.

## Verification

- `npm run docs:check`: passed
- `npm run security:secrets`: passed

Final closeout report:

- `docs/completed/reception/2026-05-19-den-66-chart-order-billing-handoff-closeout-report.html`
