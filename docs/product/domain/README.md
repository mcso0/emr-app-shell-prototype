---
id: PRODUCT-DOMAIN-README
type: Area Index
title: "Product Domain Docs"
description: "Indexes product-language domain concepts, data requirements, and workflow rules before engineering schema work."
status: active
area: product
doc_type: area-index
tags: [product-domain, data-requirements, workflow-rules]
last_updated: 2026-07-11
---

# Product Domain Docs

Domain docs describe business concepts and data requirements in product language.

Use this area for:

- patient, guardian, encounter, order, invoice, role, and permission concepts
- user-facing relationships between entities
- workflow rules that explain why data exists
- DB requirements before they become schema or migration work

Actual schema, ERD, RLS, indexes, migrations, and persistence details belong in `docs/engineering/data-model/`.

## Current Domain Sources

- `workspace-auth-permissions.md`: workspace creation, membership, permission roles, job positions, permission behavior, and personal profile authorization boundaries.
- `membership-role-job-lifecycle.md`: approved active/inactive/archive membership lifecycle, role replacement, job-position deactivation, restoration, and history-preservation rules.
- `workspace-hospital-profile.md`: workspace-owned hospital identity, contact, business, brand, operating-hour, and deferred referral settings requirements.
- `outpatient-workflow-state-model.md`: outpatient appointment, encounter, queue, chart, order, result, billing, and audit state transitions.
- `emr-domain-entity-map.md`: product-level relationships between workspace, patient, guardian, encounter, order, invoice, payment, and audit.
- `workspace-order-catalog-platform.md`: workspace-scoped order catalog platform policy for CLAiR presets, hospital customization, chart snapshots, routing, billing gates, and CSV template scope.
- `order-fulfillment-handoff.md`: chart-confirmed order handoff to lab, imaging, dispensing, treatment, and billing work.
- `plan-order-all-tab-legacy-column-contract.md`: approved and unresolved product semantics for restoring the legacy Plan/Order `전체` tab column order, labels, calculations, lifecycle, assignment, and billing behavior.
- `role-permission-source-map.md`: normalized permission role, job position, permission truth sources, and change gates.
