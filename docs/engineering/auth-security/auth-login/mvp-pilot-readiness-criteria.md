---
title: "MVP Pilot Readiness Criteria"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-82"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-001-mvp-pilot-readiness-criteria.md"
---

# MVP Pilot Readiness Criteria

Linear: DEN-82
Project: `05 Audit, Security & MVP Readiness`

## Summary

This document defines how to decide whether the Product MVP live-transition work is ready for a controlled pilot.

It is a readiness rubric and blocker policy. It does not implement new code, deploy production, connect external providers, access remote Supabase, or use real patient/hospital data.

## Readiness Rubric

| Gate | Must-have for pilot | Should-have before broader rollout | Post-MVP |
| --- | --- | --- | --- |
| Auth and workspace | Verified server session path exists for protected routes; active workspace membership is not inferred from client profile data; cross-workspace denial regressions pass. | Production log redaction and shared rate-limit store are reviewed. | SSO, advanced account lifecycle, enterprise identity policy. |
| DB and RLS | Local-first migrations have actual local replay evidence for auth/workspace foundation; domain tables have clear RLS readiness plan before remote use. | Clinical/billing domain RLS policies are locally replayed and advisor-reviewed. | Multi-region, archival, advanced retention automation. |
| Persistence | Reception, chart, order, and billing core route-backed persistence paths have focused tests and reload checkpoints. | Full screen-level pilot walkthrough passes without confusing fallback behavior. | Lab/imaging/dispensing/treatment full live persistence. |
| Audit | Audit event matrix is defined for workspace, reception, chart, order, billing, and payment-state mutations. | Append-only audit persistence is implemented for critical mutations. | Compliance dashboard, export, retention policy UI, external log sink. |
| QA | Core outpatient workflow and role/workspace denial are covered by regression or structured manual QA. | Representative rehearsal confirms the flow can be explained in 7-10 minutes. | Performance/load benchmark, provider-specific QA, long-term operations test. |
| Demo and data | Synthetic demo-data is clearly separated from real medical advice and real patient/hospital data. | Scenario reset/checklist exists for repeatable demos. | Real clinic data migration/import tooling. |
| Operations | Known blockers, follow-ups, and Post-MVP items are classified in Linear/docs before pilot decision. | Pilot runbook and owner checklist are reviewed. | Production support playbooks and analytics roadmap. |

## Blocker Policy

### Pilot Blocker

Classify an issue as a blocker when it can expose another workspace's data, allow an unauthorized mutation, lose core outpatient state after reload, store secrets or real patient data unsafely, make billing totals untrustworthy, or prevent the representative from completing the core outpatient walkthrough.

Required handling:

- Keep the issue out of Done.
- Move related Linear work no farther than Human Review until a human accepts the risk or rework is complete.
- Record the blocker with affected gate, reproduction or evidence, owner, and required verification.
- Do not start remote Supabase, production deploy, or provider rollout to work around the blocker.

### Follow-Up

Classify an issue as follow-up when the MVP can still be piloted safely but the item improves reliability, clarity, security depth, or operator confidence.

Examples:

- Better denial copy without changing the denial boundary.
- Additional route-level regression for an already protected mutation.
- Local Supabase advisor review for a migration already covered by static and route tests.
- Report polish or runbook wording improvements.

### Post-MVP

Classify an item as Post-MVP when it is strategically useful but not required to judge a controlled pilot.

Examples:

- PACS/device live integration.
- KakaoTalk provider rollout.
- PG settlement and accounting export.
- AI safety automation or analytics.
- Full compliance dashboard and audit export.

## Representative Review Checklist

| Question | Pass signal | Blocker signal |
| --- | --- | --- |
| Can a staff member log in and enter the right workspace? | Workspace context and role are visible and route checks protect mutations. | Wrong workspace data appears or protected routes trust client-only role data. |
| Can reception create or restore the outpatient encounter path? | Queue/calendar/encounter state survives the scoped reload checkpoints. | Encounter disappears or appears in another workspace. |
| Can chart/order/billing complete the outpatient story? | SOAP, diagnosis, orders, invoice candidates, invoice lines, and payment state are coherent after reload. | State breaks between chart and billing or billing total cannot be trusted. |
| Can unauthorized users be denied safely? | Denial is clear and does not leak internals, secrets, SQL, or stack traces. | Unauthorized user can mutate data or sees sensitive failure detail. |
| Can we explain what is synthetic? | Demo-data and workflow simulation are labeled as portfolio/workflow fixtures. | Flow could be mistaken for real medical advice or real clinic data. |
| Can Project 05 continue safely? | Audit matrix, threat model inputs, QA gates, and Post-MVP gaps are documented. | Security/QA work must rediscover Project 04 context from scratch. |

## Current Readiness Decision

Project 05 should treat the MVP as **not pilot-ready yet** until DEN-83 through DEN-91 run the audit matrix, audit append implementation, security review, QA workflow, role/workspace denial QA, and representative rehearsal.

Project 04 handoff is strong enough to begin that readiness review because the chart/order/billing mutation matrix and closeout report now exist.

DEN-83 output is captured in `docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md`. DEN-84 should use that matrix as the schema/helper input.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
