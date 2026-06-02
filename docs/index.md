# CLAiR EMR Docs Portal

This page is the human-facing entry point for the CLAiR EMR documentation portal. The repository `docs/` folder remains the source of truth. GitBook is used as a private/internal readable portal, and Linear is used for PR-sized work tracking.

## Start Here

Read these first for most work:

1. [Agent Start Here](agent-start-here.md)
2. [MVP Current Status](engineering/current-status.md)
3. [Work Index](work/index.md)
4. The active Linear issue or linked `docs/work/` item

Use detailed history, completed reports, and archived plans only when the active task needs them.

## Current Operating Model

| Surface | Role |
| --- | --- |
| Repo `docs/` | Source of truth for product, design, engineering, work, and completion records |
| GitBook | Private/internal readable portal over repo docs; do not treat it as the editing source |
| Linear | Work start point, status board, Human Review handoff, and PR-sized issue tracking |
| Codex | Reads only startup docs plus task-specific source docs to avoid token waste |

## Core Sources

| Area | Current entry |
| --- | --- |
| Product target and status | [MVP Current Status](engineering/current-status.md) |
| Product operating map | [SaaS Operating Map](product/service/clair-emr-saas-operating-map.md) |
| Product MVP scope | [Product MVP Scope](product/roadmap/product-mvp-scope.md) |
| Global notification center v0 | [Global Notification Center v0 Contract](product/features/notifications/global-notification-center-v0-contract.md) |
| Global notification event policy | [Global Notification Center v0 Event Policy](product/features/notifications/global-notification-center-v0-event-policy.md) |
| Outpatient workflow states | [Outpatient Workflow State Model](product/domain/outpatient-workflow-state-model.md) |
| Domain entity map | [EMR Domain Entity Map](product/domain/emr-domain-entity-map.md) |
| Role/permission source | [Role Permission Source Map](product/domain/role-permission-source-map.md) |
| Mock/live boundary | [Mock Live Boundary Map](engineering/architecture/mock-live-boundary-map.md) |
| Persistence/data security | [Persistence Data Security Checklist](engineering/auth-security/persistence-data-security-checklist.md) |
| Product MVP QA | [Product MVP QA Scenarios](engineering/testing/product-mvp-qa-scenario-pack.md) |
| Launch readiness | [Launch Readiness Checklist](engineering/operations/launch-readiness-checklist.md) |
| Decision log | [Decision Log Index](product/decisions/decision-log-index.md) |
| Detailed status history | [MVP Current Status History](engineering/current-status-history.md) |
| Docs operating rules | [Docs Home](README.md), [Docs Meta](_meta/README.md) |
| GitBook private operations | [GitBook Private Operations Checklist](_meta/gitbook-private-operations-checklist.md) |
| GitBook site setup | [GitBook Docs Site Creation Plan](_meta/gitbook-docs-site-creation-plan.md) |
| Codex reading rules | [Agent RAG Map](_meta/agent-rag-map.md) |
| Owner Safety OS | [Owner Safety OS](_meta/owner-safety-os.md), [Non-Developer Codex Workflow](_meta/non-developer-codex-workflow.md) |
| Product docs | [Product Docs](product/README.md) |
| Design docs | [Design Docs](design/README.md) |
| Engineering docs | [Engineering Docs](engineering/README.md) |
| Work tracking | [Work Index](work/index.md), [Work Inbox](work/inbox.md) |
| Completion records | [Completed Docs](completed/README.md) |
| Historical records | [Archive](archive/README.md) |

## GitBook Reading Rules

- Keep `docs/` as the canonical source. Edit repo files, not GitBook copies.
- Use [SUMMARY](SUMMARY.md) as the GitBook sidebar map.
- Keep current guidance visible in the sidebar.
- Keep `archive/`, `completed/`, and long history documents out of the main reading path unless they are needed for a specific task.
- Treat GitBook as private/internal by default.
- Use [GitBook Private Operations Checklist](_meta/gitbook-private-operations-checklist.md) before changing navigation, widening access, sharing private links beyond the current review audience, or considering external-public publication.
- Use [GitBook Docs Site Creation Plan](_meta/gitbook-docs-site-creation-plan.md) before manually creating or configuring the GitBook docs site.
- Do not publish sensitive auth, security, database, or launch-readiness details publicly without a separate review.

## Baseline Docs Status

The `CLAiR EMR 문서 운영 체계 구축` Linear project baseline docs are now present and ready for Human Review.
