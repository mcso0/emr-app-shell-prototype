# Product Domain Docs

Domain docs describe business concepts and data requirements in product language.

Use this area for:

- patient, guardian, encounter, order, invoice, role, and permission concepts
- user-facing relationships between entities
- workflow rules that explain why data exists
- DB requirements before they become schema or migration work

Actual schema, ERD, RLS, indexes, migrations, and persistence details belong in `docs/engineering/data-model/`.

## Current Domain Sources

- `workspace-auth-permissions.md`: workspace creation, membership, canonical roles, multi-role permission behavior, and personal profile authorization boundaries.
- `outpatient-workflow-state-model.md`: outpatient appointment, encounter, queue, chart, order, result, billing, and audit state transitions.
- `emr-domain-entity-map.md`: product-level relationships between workspace, patient, guardian, encounter, order, invoice, payment, and audit.
- `workspace-order-catalog-platform.md`: workspace-scoped order catalog platform policy for CLAiR presets, hospital customization, chart snapshots, routing, billing gates, and CSV template scope.
- `order-fulfillment-handoff.md`: chart-confirmed order handoff to lab, imaging, dispensing, treatment, and billing work.
- `role-permission-source-map.md`: normalized role and permission truth sources and change gates.
