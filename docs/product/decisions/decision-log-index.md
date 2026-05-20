---
id: PRODUCT-DECISION-LOG-INDEX
status: approved
area: product
doc_type: decision-index
related_work:
  - DEN-183
supersedes: []
superseded_by: []
last_updated: 2026-05-20
---

# Decision Log Index

This index collects durable product and operating decisions that future Codex sessions should not rediscover.

## Current Decisions

| Decision | Source |
| --- | --- |
| CLAiR EMR is an invite-only B2B veterinary EMR SaaS for approved hospitals. | [SaaS Operating Map](../service/clair-emr-saas-operating-map.md) |
| Current Product MVP proves the connected outpatient workflow and local-first foundations; it is not production launch. | [Product MVP Scope](../roadmap/product-mvp-scope.md) |
| Remote Supabase, production deploy, real email, payment, real data, and role policy changes require explicit approval. | [Launch Approval Gates](../../engineering/auth-security/auth-login/saas-launch-approval-gates.md) |
| Workspace membership, not personal profile, is the authorization source. | [Role And Permission Source Map](../domain/role-permission-source-map.md) |
| Outpatient work should be judged by state transitions, not isolated screens. | [Outpatient Workflow State Model](../domain/outpatient-workflow-state-model.md) |
| Domain entities are product concepts first; DB implementation belongs in engineering data-model docs. | [EMR Domain Entity Map](../domain/emr-domain-entity-map.md) |
| GitBook is a readable portal; repo `docs/` remains the editing source of truth. | [Docs Portal](../../index.md) |
| Codex should read the smallest task-specific source-doc set, not the whole docs tree. | [Agent RAG Map](../../_meta/agent-rag-map.md) |

## Open Decisions

| Question | Current handling |
| --- | --- |
| Can billing issue before lab/imaging vet review? | Open product decision before live pilot. |
| Can front desk close unpaid invoices without hospital admin approval? | Open product decision before live billing. |
| What is the live refund approval workflow? | Approval-gated; not MVP default. |
| Can technicians cancel orders or only complete assigned work? | Open product decision before live operational policy. |
| How long can signed SOAP be directly edited before amendment-only? | Open product decision before live chart policy. |

## Maintenance Rule

Add a row here when a decision changes how future work should be planned, approved, or implemented. Do not add every small implementation choice.

