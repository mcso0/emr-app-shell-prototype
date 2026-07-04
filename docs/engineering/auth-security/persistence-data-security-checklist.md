---
id: ENGINEERING-AUTH-SECURITY-PERSISTENCE-DATA-SECURITY-CHECKLIST
status: approved
area: engineering
doc_type: checklist
related_work:
  - DEN-180
supersedes: []
superseded_by: []
last_updated: 2026-05-20T00:00:00.000Z
---

# Persistence Data Security Checklist

Use this checklist before claiming any CLAiR EMR workflow is persistent, live-capable, or safe for pilot review.

## Data Boundary

* [ ] The object is workspace-scoped.
* [ ] Cross-workspace access is denied.
* [ ] Active membership is required for protected reads and mutations.
* [ ] Personal profile fields are not used as authorization truth.
* [ ] Synthetic/demo data is clearly separated from real data.

## Mutation Safety

* [ ] Server/API boundary validates actor, workspace, object ownership, and allowed action.
* [ ] Client-provided totals, role labels, workspace IDs, and status transitions are not blindly trusted.
* [ ] Cancel, void, restore, duplicate, and correction paths preserve history or reason.
* [ ] Last active `hospital_admin` protection remains intact for membership/admin changes.

## Persistence Evidence

* [ ] The work states whether it is mock/session-only, local-first, remote staging, or production/live.
* [ ] Reload/readback checkpoint exists for local-first claims.
* [ ] Focused tests cover success, unauthorized denial, cross-workspace denial, and tamper/error paths where relevant.
* [ ] No remote Supabase or production claim is made from local-only evidence.

## Sensitive Data

* [ ] No real patient, guardian, staff, hospital, billing, or clinical data is introduced.
* [ ] Secrets are not stored in repo, docs, Linear, screenshots, reports, URLs, or browser-bundled code.
* [ ] Audit/log payloads exclude raw clinical note bodies, tokens, secrets, provider payloads, and unnecessary sensitive personal data.
* [ ] HTML reports and GitBook-visible docs avoid secrets and real data.

## DB/RLS Readiness

* [ ] Migration/RLS work is explicitly scoped before implementation.
* [ ] Local DB/RLS execution evidence exists before remote approval is requested.
* [ ] RLS matrix covers unauthenticated, missing membership, inactive membership, cross-workspace, active member, and admin paths where relevant.
* [ ] Remote staging/live execution has explicit approval if needed.

## Related Docs

* [Mock And Live Boundary Map](../architecture/mock-live-boundary-map.md)
* [SaaS Launch Approval Gates](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md)
* [Auth DB Env Secret Verification Gates](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md)
* [Workspace Auth and Permission Domain](../../product/domain/workspace-auth-permissions.md)
