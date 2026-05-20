---
id: ENGINEERING-ARCHITECTURE-MOCK-LIVE-BOUNDARY-MAP
status: approved
area: engineering
doc_type: boundary-map
related_work:
  - DEN-179
supersedes: []
superseded_by: []
last_updated: 2026-05-20
---

# Mock And Live Boundary Map

This document defines how to describe and route CLAiR EMR work across mock, local-first, remote staging, and production/live boundaries.

## Boundary Levels

| Level | Meaning | Default permission |
| --- | --- | --- |
| Mock / session-only | Browser/session state, fixture data, visual workflow proof | Allowed when issue-scoped |
| Local-first | Local app or local Supabase-backed behavior with synthetic data and focused tests | Allowed when issue-scoped |
| Remote staging | Hosted remote Supabase/app environment, staging secrets, remote SQL or dashboard mutation | Blocked until explicit approval |
| Production/live | Customer-facing environment or real operational data | Blocked until explicit approval |

## Current Product Claim

CLAiR EMR can claim Product MVP workflow and local-first foundations in scoped areas. It must not claim production/live readiness until launch readiness gates pass and 승욱 explicitly approves target environment operations.

## Area Map

| Area | Current acceptable claim | Do not claim |
| --- | --- | --- |
| App shell and screens | Usable prototype and local workflow surface | Production deployment readiness |
| Auth/workspace | Mock fallback plus server-session/local-first foundations | Complete live identity/security rollout |
| Customer records | Local-first profile/relationship/archive boundaries in scoped paths | Real customer data handling readiness |
| Reception/encounter | Local-first outpatient path foundations | Full production clinic workflow |
| Chart/order/billing | Focused local-first persistence and regression in scoped paths | Full clinical/billing compliance readiness |
| Lab/imaging/dispensing | UI/workspace surfaces and selected local/mock behavior | Full live provider/device persistence |
| Audit | Schema/helper/emission/review foundations in scoped paths | Compliance-grade external audit system |
| Operations | Docs/checklists/readiness planning | Production operations or monitoring enabled |

## Approval-Gated Actions

Never perform these without explicit approval:

- remote Supabase link, migration push, remote SQL, or dashboard mutation
- staging/live secret use
- production deploy or customer-facing environment switch
- real email delivery
- payment/subscription provider setup
- real clinic, staff, guardian, patient, billing, or medical data import
- canonical role/permission policy change

## Implementation Rule

Every issue should state its boundary:

- `mock/session-only`
- `local-first`
- `remote staging`
- `production/live`

If the boundary is remote or live, approval must name the environment, operation, verification plan, and rollback/stop condition.

## Related Docs

- [Product MVP Scope](../../product/roadmap/product-mvp-scope.md)
- [SaaS Operating Map](../../product/service/clair-emr-saas-operating-map.md)
- [SaaS Launch Approval Gates](../auth-security/auth-login/saas-launch-approval-gates.md)
- [Auth DB Env Secret Verification Gates](../auth-security/auth-login/auth-db-env-secret-verification-gates.md)

