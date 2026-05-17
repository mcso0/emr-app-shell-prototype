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
