---
title: "Representative Pilot Rehearsal And Defect Triage"
status: "human_review"
updated: "2026-06-17"
source:
  - "DEN-91"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-010-representative-pilot-rehearsal-defect-triage.md"
---

# Representative Pilot Rehearsal And Defect Triage

Linear: DEN-91
Project: `05 Audit, Security & MVP Readiness`

## Summary

This report captures a representative 7-10 minute pilot rehearsal for the Product MVP using the synthetic Kong outpatient scenario.

Result: **Representative local-first pilot rehearsal can proceed, with follow-ups**.

No local-first walkthrough blocker was found. The flow can be explained from home entry through reception, chart, order fan-out, billing, payment state, audit/readiness caveats, and known Post-MVP limits without requiring real patient data, remote Supabase, production deploy, or provider integrations.

This is not a remote/live pilot approval. The remote/live decision still needs human review of the DEN-88 audit completeness gap, clinical/billing RLS validation gate, and representative follow-up acceptance.

2026-06-17 cleanup note: this DEN-91 report is historical evidence for the old Kong Sales Demo rehearsal. The current operating proof is the Cheongdam seed workspace; the old Home demo launcher has been removed, and legacy Kong coverage should be opened only through explicit fixture routes while it remains under cleanup.

## Scope And Assumptions

In scope:

- Representative 7-10 minute outpatient pilot walkthrough.
- Synthetic demo-data explanation for `scenario-kong-vomit`.
- Places where the explanation could get blocked, confusing, or overclaim product readiness.
- Classification into blocker, follow-up, and Post-MVP.
- Relevant smoke regression for demo continuity and reload-backed outpatient persistence.

Out of scope:

- Immediate implementation.
- Sales copy overhaul.
- Production deployment.
- Remote Supabase, staging/live mutation, provider rollout, or real patient/hospital data access.
- Any real medical advice or clinical decision support claim.

Assumptions:

- Historical assumption: the presenter used the old Home demo launcher. As of 2026-06-17, that launcher is removed and this report should not be used as the current Cheongdam seed verification script.
- The presenter names the scenario as synthetic workflow data, not clinical guidance.
- Human Review can accept or reprioritize follow-up items before a real stakeholder pilot.

## Rehearsal Script

Target runtime: 7-10 minutes.

| Time | Screen / Moment | Presenter Check | Risk Callout |
| --- | --- | --- | --- |
| 0:00-0:45 | Login and workspace home | Show the Clair demo workspace, visible role/workspace context, and demo launcher. | Say this is synthetic portfolio data. Do not imply production data access. |
| 0:45-1:45 | Demo launcher: `콩이 구토 내원` | Start the Kong outpatient story and keep scenario context through navigation. | Use the scenario as workflow continuity evidence, not medical correctness. |
| 1:45-2:45 | Reception | Show appointment/queue context, guardian 김하늘, patient 콩이, reason for visit, and encounter continuity. | Avoid claiming live hospital scheduling integration. |
| 2:45-4:15 | Chart and SOAP | Show SOAP persistence/reload behavior, diagnosis rows, chart completion handoff, and editable order draft. | Avoid medical recommendation wording. Diagnosis rows are workflow fixtures. |
| 4:15-5:30 | Orders fan out | Show confirmed orders feeding lab, imaging, treatment/dispensing, and billing candidates. | Explain that full live lab/imaging/dispensing persistence is Post-MVP. |
| 5:30-6:45 | Billing | Show invoice candidate, invoice line edit/confirmation, unpaid/completed payment state, and amount integrity check. | Do not imply real payment provider or accounting settlement. |
| 6:45-7:45 | Audit and permission story | Summarize audit append/review surface, role/workspace denial QA, and remaining audit completeness follow-up. | Keep DEN-88 audit gap explicit. |
| 7:45-9:00 | Closeout | State what is ready for representative review, what needs human acceptance, and what remains Post-MVP. | Do not call the MVP live-ready without approval. |

## Rehearsal Notes

What worked:

- The Kong scenario gives a simple single-patient story that connects reception, chart, order, downstream departments, billing, and payment status.
- The local-first persistence slices are now coherent enough to explain reload checkpoints for reception, SOAP, diagnosis, order, invoice candidate, invoice lines, and payment state.
- The permission story can be explained with canonical MVP roles: `hospital_admin`, `vet`, `technician`, and `front_desk`.
- The presenter can explain the current safety line: demo-data only, no real clinical advice, no real patient/hospital data, and no remote/live database access.

Where explanation may get blocked:

- Mock role labels and older compatibility roles can create confusion if a presenter sees nurse or billing admin labels while explaining canonical MVP roles.
- Audit coverage is good enough to show the direction, but DEN-88 identified remaining clinical/billing event emission gaps that should not be hidden.
- The demo spans lab, imaging, dispensing, and treatment screens, but Project 04 persistence focused on chart/order/billing. Full live persistence for downstream departments remains Post-MVP.
- Broad QA runs emit non-blocking Tiptap duplicate extension and Node listener warnings, which can distract technical reviewers.

## Defect Triage

### Blockers

No new local-first DEN-91 blocker was found.

Still blocking remote/live pilot approval until accepted or resolved:

- Clinical/billing RLS validation is not remotely or locally replayed for live pilot use.
- DEN-88 audit completeness gap remains for some chart/order/billing mutation events.

### Follow-Up

| Follow-up | Why it matters | Suggested disposition |
| --- | --- | --- |
| Align mock UI role labels with canonical MVP roles | Prevents pilot explanation confusion around `technician` / `front_desk` vs older compatibility labels. | Create follow-up issue candidate before stakeholder rehearsal. |
| Close or explicitly accept DEN-88 audit completeness gap | Audit claims must match actual emitted mutation events. | Audit/security follow-up. |
| Add friendlier Korean denial copy for user-facing surfaces | Denials are safe, but operators should understand them without reading internal codes. | UX copy follow-up. |
| Clean Tiptap duplicate extension warning | Keeps chart/editor QA logs quieter. | Chart/editor follow-up. |
| Clean Node listener warning in broad Playwright runs | Keeps long QA runs easier to triage. | Test infrastructure follow-up. |
| Create a repeatable pilot reset checklist | Helps the same synthetic story run consistently across demos. | Readiness/runbook follow-up. |

### Post-MVP

- Provider integrations: KakaoTalk, PACS/device, payment provider, accounting settlement, and email.
- Full live persistence for lab, imaging, dispensing, treatment, and inpatient workflows.
- Production monitoring, audit export, compliance dashboard, and retention policy UI.
- Performance/load benchmark and long-running operations rehearsal.
- Real clinic data migration/import tooling.

## Pilot Readiness Call

Representative local-first pilot rehearsal: **ready for Human Review**.

Controlled remote/live pilot: **not approved by this report**.

The MVP can be shown as a synthetic workflow rehearsal if the presenter keeps the safety framing clear and the follow-up list visible. A remote/live pilot should wait for human acceptance of the audit/RLS gaps and any role-label cleanup required for stakeholder clarity.

## Verification

- `npx playwright test tests/sales-demo-flow.spec.ts tests/outpatient-persistence-regression.spec.ts --reporter=line` (`4 passed`)
- `npm run docs:check`
- `npm run security:secrets`
