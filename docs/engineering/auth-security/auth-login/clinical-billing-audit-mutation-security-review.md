---
title: "Clinical Billing Audit Mutation Security Review"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-88"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-007-clinical-billing-audit-mutation-security-review.md"
---

# Clinical Billing Audit Mutation Security Review

Linear: DEN-88
Project: `05 Audit, Security & MVP Readiness`

## Summary

This review checked the clinical chart, order, billing, and audit mutation boundaries against the DEN-83 audit matrix and DEN-87 threat model.

No new High severity implementation bug was found in the reviewed local-first scope. The strongest existing controls are route-level server identity resolution, active workspace membership checks, domain permissions, encounter/invoice workspace ownership checks, server-side billing amount recalculation, safe audit payload filtering, and focused security regressions.

The main residual risk is audit coverage completeness: several Project 04 mutations are protected and tested, but they are not yet connected to DEN-84 audit emission. This is not an immediate local-demo data exposure bug, but it is a pilot-readiness follow-up before claiming full audit evidence.

## Scope And Assumptions

In scope:

- Chart/SOAP/diagnosis/order route permission and ownership checks.
- Billing invoice candidate, invoice line, and payment-state permission and ownership checks.
- Amount tampering and server-side recalculation controls.
- Audit omission risk against the DEN-83 event matrix.
- Focused source review and focused security regression results.

Out of scope:

- Code modification.
- External provider review.
- Legal compliance certification.
- Remote Supabase, production deploy, live/staging database mutation, or real patient/hospital data.

Assumptions:

- Current work remains local-first and synthetic.
- Demo actor header behavior remains limited to mock/local mode as documented in DEN-87.
- Full remote pilot readiness still requires separate local Supabase replay/advisor evidence for domain RLS policies.

## Findings By Severity

| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| High | No new High severity clinical/billing route bug was found in this review. | Focused tests passed for unauthorized chart/billing mutation denial, cross-workspace scope checks, server amount recalculation, and audit review access. | Keep as no-finding rationale; continue DEN-89/DEN-90 QA. |
| Medium | Audit emission is incomplete across the full DEN-83 matrix. Diagnosis save, order draft save, order lifecycle status, billing invoice candidate generation, and invoice line issue/edit paths are protected, but not yet wired to `emitLiveMutationAuditEvent`. | `live-mvp-audit-event-matrix.md` defines `diagnosis.changed`, `order.draft_changed`, `order.status_changed`, `billing.invoice_candidate_generated`, `billing.invoice_line_changed`, and `billing.invoice_issued`; current emission coverage is documented in `live-mvp-mutation-audit-emission.md` and source grep. | Follow-up candidate before claiming complete audit evidence. Not a data exposure bug in local synthetic mode. |
| Medium | Clinical/billing table RLS still needs local replay/advisor evidence before remote pilot use. | DEN-87 already classifies domain RLS review as a pilot-readiness blocker before remote/live database use. | Keep remote Supabase blocked until local replay evidence exists. |
| Low | Denial and route failure responses are intentionally compact, but broader denial UX clarity still needs QA. | Routes return typed denial reasons and focused tests cover denial outcomes. | Continue in DEN-90 role/workspace denial UX QA. |

## No-Finding Rationale

Unauthorized chart mutation:

- Chart read/write cores require active workspace membership and `chart:view` or `chart:update`.
- Diagnosis, SOAP, completion, order draft, order action, and order lifecycle gateways check encounter/workspace ownership before returning or mutating state.
- Focused server tests cover unauthorized actors and cross-workspace mismatch denial paths.

Amount tampering:

- Invoice line edits accept `invoiceLineId` and quantity, then recalculate `lineTotal`, `subtotalAmount`, and `totalAmount` from stored unit prices.
- Invoice candidate sync derives quantity/unit price/line total from server-owned order/invoice snapshots.
- The billing security regression intentionally sends tampered `lineTotal`, `unitPrice`, and `totalAmount`; the server ignores those fields and recalculates.

Audit payload leakage:

- DEN-84 append helper rejects sensitive keys and unsupported event types.
- DEN-85 mutation summaries avoid full SOAP/chart bodies, raw provider payloads, secrets, stack traces, SQL errors, and real data.
- DEN-86 review surface is admin-only and workspace-scoped.

## Blockers And Follow-Ups

Pilot blockers before remote/live data:

- Do not use remote Supabase, production deploy, or real patient/hospital data until clinical/billing domain RLS is locally replayed and advisor-reviewed.
- Do not claim full audit evidence until the remaining DEN-83 clinical/billing event types are either implemented or explicitly accepted as follow-up for the pilot.

Follow-up issue candidates:

- Add audit emission for `diagnosis.changed`, `order.draft_changed`, `order.status_changed`, `billing.invoice_candidate_generated`, `billing.invoice_line_changed`, and `billing.invoice_issued`.
- Add regression that asserts invoice line edits and billing confirmation emit safe audit summaries and fail closed when a configured critical audit append fails.
- Add a short QA checklist that verifies denial copy does not expose SQL, stack traces, secrets, or raw provider payloads.

Post-MVP:

- External compliance export.
- Audit retention UI.
- Payment provider, device/PACS, messaging provider, and accounting settlement audit correlation.

## Reviewed Evidence

- `docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md`
- `docs/engineering/auth-security/auth-login/live-mvp-mutation-audit-emission.md`
- `docs/engineering/auth-security/auth-login/live-auth-db-rls-workspace-threat-model.md`
- `docs/engineering/auth-security/auth-login/clinical-billing-audit-security-handoff.md`
- `docs/product/demo-data/README.md`
- `src/features/chart/server-soap-note-persistence-core.ts`
- `src/features/chart/server-diagnosis-persistence-core.ts`
- `src/features/chart/server-order-draft-persistence-core.ts`
- `src/features/chart/server-order-action-persistence-core.ts`
- `src/features/chart/server-order-lifecycle-persistence-core.ts`
- `src/features/billing/server-invoice-candidate-sync-core.ts`
- `src/features/billing/server-invoice-line-persistence-core.ts`
- `src/features/billing/server-payment-status-persistence-core.ts`
- `src/features/audit/server-mutation-audit-core.ts`
- `tests/billing-security-regression.spec.ts`
- `tests/live-audit-mutation-emission.spec.ts`
- `tests/audit-review-surface.spec.ts`

## Verification

- `npx playwright test tests/billing-security-regression.spec.ts tests/live-audit-mutation-emission.spec.ts tests/audit-review-surface.spec.ts tests/chart-diagnosis-persistence-server.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts tests/chart-order-lifecycle-persistence-server.spec.ts tests/billing-invoice-candidate-sync-server.spec.ts tests/billing-invoice-line-persistence-server.spec.ts tests/billing-payment-status-persistence-server.spec.ts --reporter=line` (`43 passed`)
- `npm run docs:check`
- `npm run security:secrets`
