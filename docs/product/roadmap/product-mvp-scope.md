---
id: PRODUCT-ROADMAP-PRODUCT-MVP-SCOPE
type: Product Scope
title: "Product MVP Scope And Non-Goals"
description: "Defines the current Product MVP boundaries, non-goals, deferred work, and approval gates."
status: approved
area: product
doc_type: roadmap-scope
tags: [mvp, scope, non-goals, approval-gates]
related_work:
  - DEN-175
supersedes: []
superseded_by: []
last_updated: 2026-05-20
---

# Product MVP Scope And Non-Goals

This document defines what CLAiR EMR Product MVP includes, excludes, defers, and approval-gates. Use it to decide whether a new request belongs in the current MVP, should become a later roadmap item, or requires explicit approval before execution.

This document does not change product policy. It consolidates the current PRD, operating map, current status, workspace permission source, and launch approval gates into one scope reference.

## Scope Rule

The Product MVP is about proving the connected outpatient operating system for one approved hospital workspace, using synthetic data and mock/local-first foundations.

The MVP is in scope when the work strengthens at least one of these:

- connected outpatient workflow from reception to billing
- workspace-scoped access and role-aware UX
- patient, guardian, encounter, chart, order, billing, or audit continuity
- local-first persistence, server/API boundary, or regression evidence for the workflow spine
- docs, QA, and launch-readiness criteria that prevent false live claims

The MVP is out of scope when it depends on unapproved live infrastructure, real customer data, external providers, or broad product expansion beyond the outpatient workflow spine.

## In Scope

| Area | MVP scope |
| --- | --- |
| Product operating model | Keep the invite-only B2B veterinary EMR SaaS direction clear and connect product work to the SaaS operating map. |
| Workspace entry | Login, workspace selection, active membership checks, and role-aware navigation behavior. |
| Roles and permissions | Use canonical MVP roles: `hospital_admin`, `vet`, `technician`, `front_desk`; keep permission source in workspace membership, not personal profile. |
| Reception and appointment | Appointment, walk-in reception, queue state, patient/guardian lookup or registration, and encounter creation path. |
| Customer records | Guardian profile, patient profile, guardian-patient relationship, consent/history foundations, and soft delete/restore boundaries. |
| Chart and encounter | SOAP, diagnosis, order draft/confirmation, chart context, reload checkpoints, and focused regression evidence. |
| Orders | Order request/update boundaries for outpatient work, including links to lab, imaging, dispensing, treatment, and billing candidates. |
| Billing | Invoice candidate, invoice line editing, billing confirmation, payment state, unpaid handling, amount recalculation, and tamper regression. |
| Hospital admin | Workspace member management, invitation lifecycle, role management, and order catalog foundation. |
| Audit | Audit event schema, append helper, mutation emission hooks, and hospital-admin audit review surface. |
| Design and UX | Operational SaaS UI quality for existing MVP workflows, including dense layout, interaction, and visual QA gates. |
| Docs and QA | Source-of-truth docs, Linear issue reports, focused regression, and launch-readiness checklists. |

## Out Of Scope For Product MVP

These should not be implemented or claimed as Product MVP completion unless a later approved scope changes this document:

- public self-service signup that creates usable workspaces
- production/live deployment
- real hospital, staff, guardian, patient, clinical, billing, or payment data import
- remote Supabase staging/live mutation or migration push
- payment provider, subscription enforcement, seat billing, receipt, refund, accounting, or settlement integration
- real email, KakaoTalk, PACS, device, Excel, or external provider integration
- DICOM, HL7, lab-device automatic interfaces, or hardware connectivity
- SSO, SCIM, domain auto-join, delegated enterprise admin hierarchy
- final legal/compliance certification
- AI training pipeline or clinical decision-support automation
- full inpatient lifecycle beyond the current session-only surface
- broad analytics, revenue intelligence, marketing automation, or CRM expansion
- full migration tooling from legacy EMR systems

## Deferred After MVP

Deferred means valuable later, but not required to prove the current Product MVP:

| Deferred area | Why deferred |
| --- | --- |
| Lab/imaging/dispensing full live persistence | Current screens exist, but the MVP first needs the outpatient spine and safety boundaries to stay reliable. |
| Inpatient live workflow | Inpatient is operationally important but expands the state model beyond the outpatient MVP spine. |
| Provider integrations | Email, messaging, payment, PACS, devices, and accounting require live credentials, security review, and provider-specific failure handling. |
| Advanced analytics | Better after reliable data capture, audit, and workflow state definitions are stable. |
| Real migration tooling | Requires real-data handling policy, mapping review, rollback, and customer-specific validation. |
| Mobile-optimized workflows | Web is the current MVP work surface; mobile can follow after primary workflow stability. |
| Granular billing/refund policy | Needs a separate product decision before live payment integration. |

## Approval-Gated Scope

The following are not merely deferred. They are blocked until 승욱 gives explicit approval for the named environment and operation:

| Gate | Requires explicit approval before |
| --- | --- |
| Remote Supabase staging | `supabase link`, remote migration push, remote SQL, dashboard mutation, staging secrets |
| Production/live Supabase | any live DB/RLS/project/auth setting mutation |
| Remote or production DB/RLS execution | remote apply, production apply, destructive schema/data operation |
| Real email delivery | provider setup, SMTP/API secret use, outbound invite/password/account email |
| Production deploy | customer-facing deploy, domain switch, live env var switch, monitoring/log pipeline enablement |
| Role/permission policy change | canonical role change, permission matrix change, admin authority expansion/reduction |
| Real data | import or manual entry of real clinic, staff, guardian, patient, medical, billing data |
| Payment/subscription | provider setup, subscription enforcement, seat billing, receipt/refund/settlement |

Approval must name the target environment, allowed operation, configuration source, verification plan, and rollback or stop condition. General approval to "continue launch work" is not enough.

## Mock, Local-First, Remote, And Live

Use the same claim levels as the operating map:

| Claim level | Product meaning | Default action |
| --- | --- | --- |
| Mock / session-only | UI and workflow behavior using browser/session state or fixture data | Allowed when issue-scoped |
| Local-first | Local app or local Supabase-backed behavior with synthetic data and focused tests | Allowed when issue-scoped |
| Remote staging | Hosted non-production Supabase or app environment | Approval-gated |
| Production/live | Customer-facing infrastructure or real operational data | Approval-gated |

Never describe mock or local-first work as production-ready without the launch-readiness evidence and approval gate.

## MVP Done Means

Product MVP can be called ready for representative pilot review only when:

- one approved hospital workspace path is clear
- active membership and role-aware access are enforced at the right server/API boundaries for scoped workflows
- outpatient reception to billing can survive the expected reload and regression checkpoints
- patient, guardian, chart, order, billing, and audit records have coherent ownership and state boundaries
- launch blockers, non-goals, and approval-gated items are explicit
- QA scenarios and readiness checklist are current

Product MVP ready does not mean production launch.

## Request Routing

Use this table for new requests:

| Request sounds like | Route |
| --- | --- |
| Strengthens outpatient workflow, role-aware access, local-first persistence, audit, or QA | Current MVP candidate |
| Adds provider integration, production deploy, remote Supabase, real data, payment, or role policy change | Approval-gated |
| Adds inpatient, analytics, migration, AI, mobile, or broad CRM/marketing | Deferred roadmap unless 승욱 re-scopes |
| Changes core product promise, buyer, launch model, or workspace model | Update service/product source docs before implementation |
| Adds isolated UI without data state, permission, exception, or verification definition | Shape into a scoped issue before implementation |

## Related Source Docs

- [SaaS Operating Map](../service/clair-emr-saas-operating-map.md)
- [MVP Current Status](../../engineering/current-status.md)
- [PRD](../prd/clair-emr-saas-prd.md)
- [Legacy MVP Feature Spec](../features/legacy-mvp-feature-spec.md)
- [Product User Flow](../user-flows/emr-saas-userflow.md)
- [Workspace Auth and Permission Domain](../domain/workspace-auth-permissions.md)
- [SaaS Launch Approval Gates](../../engineering/auth-security/auth-login/saas-launch-approval-gates.md)
- [Agent RAG Map](../../_meta/agent-rag-map.md)

## Next Baseline Docs

After this scope document, define:

- [outpatient workflow state model](../domain/outpatient-workflow-state-model.md)
- [EMR domain entity map](../domain/emr-domain-entity-map.md)
- [role/permission source normalization](../domain/role-permission-source-map.md)
- [mock/live boundary map](../../engineering/architecture/mock-live-boundary-map.md)
- [persistence and data security checklist](../../engineering/auth-security/persistence-data-security-checklist.md)
