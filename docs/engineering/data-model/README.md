# Data Model

Canonical engineering data model documents live here. Use this README as the GitBook entry point for schema, persistence, handoff, and migration-boundary references.

## Read First

| Need | Start With |
| --- | --- |
| Current broad DB structure and domain schema draft | `emr-saas-db-structure-spec.ko.md` |
| English reference for the same DB structure draft | `emr-saas-db-structure-spec.en.md` |
| Chart-confirmed order handoff into fulfillment queues and billing candidates | `order-fulfillment-handoff-contract.md` |

## Current Files

| Document | Role |
| --- | --- |
| `emr-saas-db-structure-spec.ko.md` | Primary Korean data model draft for organization, workspace, auth, patient/guardian, reception, chart, orders, fulfillment, billing, operations, and app-shell state. |
| `emr-saas-db-structure-spec.en.md` | English companion reference for the DB structure draft. Keep it aligned when material schema guidance changes. |
| `order-fulfillment-handoff-contract.md` | Engineering contract for order fulfillment route shape, source snapshot, status mapping, permission requirements, migration gate, and verification baseline. |

## Boundaries

- Product data requirements belong in `docs/product/domain/` or `docs/product/demo-data/` before they become schema work.
- Actual schema, ERD, migrations, RLS, indexes, and persistence contracts belong here or in the more specific auth/security work package that owns the implementation.
- Do not run remote Supabase, migration push, RLS replay, staging seed replay, or production data operations from a README update.
- Private GitBook can expose this folder for internal reading, but secrets, real data, remote project credentials, and unapproved production assumptions must not be added.

## Verification Notes

- Docs-only navigation edits: run `npm run docs:check`.
- Schema or migration edits need the active work item's verification plan and explicit approval for any remote/staging operation.
