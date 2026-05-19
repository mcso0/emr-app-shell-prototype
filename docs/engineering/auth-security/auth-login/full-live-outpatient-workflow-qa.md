---
title: "Full Live Outpatient Workflow QA"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-89"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-008-full-live-outpatient-workflow-qa.md"
---

# Full Live Outpatient Workflow QA

Linear: DEN-89
Project: `05 Audit, Security & MVP Readiness`

## Summary

This QA pass checked the local-first Product MVP outpatient workflow from login/workspace entry through reception, chart, order, billing, and reload checkpoints.

Result: **Green for local-first pilot review, with follow-ups**.

Workflow health score: **92 / 100**

No blocker was found in the reviewed local-first workflow. The core app shell, auth entry, reception reload paths, chart reload paths, order/billing persistence checkpoints, and sales demo golden path passed their focused Playwright suites.

The score is not 100 because this is not remote/live Supabase validation, and the test run surfaced non-blocking console warnings that should be cleaned up before a broader demo or long-running QA session.

## Scope And Assumptions

In scope:

- Login and workspace route guard.
- Reception queue/calendar/check-in/walk-in reload checkpoints.
- Chart SOAP and completion reload checkpoints.
- Order confirmation and billing candidate reload checkpoints.
- Billing invoice/payment workflow and reload checkpoints.
- Sales demo golden path from home through reception, chart, lab, imaging, dispensing, and billing.
- Failure/empty/error-state coverage already present in relevant suites.

Out of scope:

- Code modification.
- Performance benchmark.
- External provider QA.
- Remote Supabase, production deploy, live/staging database mutation, or real patient/hospital data.

Assumptions:

- Current QA remains local-first with synthetic demo-data and mock auth mode.
- Browser manual smoke was not required because the relevant screen and API workflow suites passed.
- DEN-90 will separately inspect role/workspace denial UX in more detail.
- DEN-91 will separately run the representative pilot rehearsal.

## QA Result

| Area | Result | Evidence |
| --- | --- | --- |
| Login and workspace entry | Pass | `tests/auth.spec.ts` checks login redirect, next URL preservation, default workspace entry, session persistence, logout, role display, workspace creation, membership management, and profile boundary. |
| Reception reload path | Pass | `tests/reception.spec.ts` checks queue/calendar persisted reads, appointment check-in reload, walk-in reload, cross-workspace denial, empty slot walk-in, patient lookup states, and dialog state. |
| Chart reload path | Pass | `tests/chart.spec.ts` checks SOAP manual save reload, chart completion reload, Kong scenario continuity, queue selection, history selection, and chart UX stability. |
| Order and billing persistence path | Pass | `tests/outpatient-persistence-regression.spec.ts` checks SOAP save/readback, order confirmation/readback, invoice candidate sync/readback, and payment completion/readback. |
| Billing screen workflow | Pass | `tests/billing.spec.ts` checks waiting invoice rendering, queue switching, Kong invoice query, completion state, and payment actions. |
| Sales demo golden path | Pass | `tests/sales-demo-flow.spec.ts` checks home launcher through reception, chart, lab, imaging, dispensing, and billing while preserving scenario query context. |

## Blocker List

No DEN-89 blocker was found.

Specifically, this run did not find:

- core outpatient state lost after scoped reload checkpoints;
- chart/order/billing state break between modules;
- billing total mismatch in the covered workflow;
- login/workspace routing failure in the covered mock session mode;
- sales demo golden path break.

## Follow-Up List

| Follow-up | Why it matters | Suggested owner |
| --- | --- | --- |
| Tiptap duplicate extension warning: `Duplicate extension names found: ['link', 'underline']` | It did not fail tests, but noisy editor warnings can hide future editor issues and make QA logs harder to read. | Chart/editor follow-up |
| Node `MaxListenersExceededWarning` during broad Playwright run | It did not fail tests, but large parallel runs should stay quiet enough for regression triage. | Test infrastructure follow-up |
| DEN-88 audit completeness gap | Workflow QA passed, but full audit evidence still needs remaining clinical/billing event emission or explicit acceptance as follow-up. | Audit/security follow-up |
| Remote/live Supabase validation | Local-first QA passed; remote/live remains approval-gated and not validated here. | Future readiness gate |

## Post-MVP

- Performance/load benchmark.
- External provider QA for KakaoTalk, PACS/device, payment provider, accounting settlement, and email.
- Full lab/imaging/dispensing/treatment live persistence beyond the outpatient chart/order/billing handoff.

## Verification

- `npx playwright test tests/auth.spec.ts tests/reception.spec.ts tests/chart.spec.ts tests/billing.spec.ts tests/outpatient-persistence-regression.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`82 passed`)
- `npm run docs:check`
- `npm run security:secrets`
