---
id: ENGINEERING-DATA-MODEL-README
type: Area Index
title: "Data Model"
description: "Indexes engineering data model, schema, persistence, handoff, and migration-boundary references."
status: active
area: engineering
doc_type: area-index
tags: [data-model, schema, persistence, migrations]
last_updated: 2026-07-16
---

# Data Model

Canonical engineering data model documents live here. Use this README as the GitBook entry point for schema, persistence, handoff, and migration-boundary references.

## Read First

| Need | Start With |
| --- | --- |
| Current broad DB structure and domain schema draft | `emr-saas-db-structure-spec.ko.md` |
| English reference for the same DB structure draft | `emr-saas-db-structure-spec.en.md` |
| Demo seed inventory/readback baseline for local/dev Supabase | `demo-seed-inventory-readback-contract.md` |
| CLAiR system presets to workspace order catalog initialization and auto-merge | `order-catalog-preset-initialization-contract.md` |
| Chart-confirmed order handoff into fulfillment queues and billing candidates | `order-fulfillment-handoff-contract.md` |
| Home 원내 현황 operations aggregate API/read model | `home-operations-work-status-read-model.md` |
| 직원의 workspace-scoped Presence와 최근 접속 기록 | `workspace-member-activity-presence.md` |
| 직원의 workspace-scoped 상태 메시지와 self-write 경계 | `workspace-member-status-messages.md` |
| Guardian-centered combined checkout, payment allocation, and adjustment proposal | `billing-checkout-session-allocation-adjustment-model.md` |

## Current Files

| Document | Role |
| --- | --- |
| `emr-saas-db-structure-spec.ko.md` | Primary Korean data model draft for organization, workspace, auth, patient/guardian, reception, chart, orders, fulfillment, billing, operations, and app-shell state. |
| `emr-saas-db-structure-spec.en.md` | English companion reference for the DB structure draft. Keep it aligned when material schema guidance changes. |
| `demo-seed-inventory-readback-contract.md` | Demo DB PR 1 contract for `clair-demo` seed inventory, local/dev readback checks, confirmed coverage, and known seed gaps. |
| `billing-checkout-session-allocation-adjustment-model.md` | Approval-gated proposal for guardian checkout sessions, invoice/payment allocations, adjustment audit, and RPC transaction boundaries. |
| `home-operations-work-status-read-model.md` | Implemented API/read-model contract for aggregating Home `원내 현황` operational work across reception, appointments, fulfillment, billing, and future inpatient sources. |
| `order-catalog-preset-initialization-contract.md` | Engineering contract for CLAiR system presets, workspace catalog source tracking, idempotent initialization, automatic preset merge, customization protection, and DEN-282 implementation boundaries. |
| `order-fulfillment-handoff-contract.md` | Engineering contract for order fulfillment route shape, source snapshot, status mapping, permission requirements, migration gate, and verification baseline. |
| `workspace-member-activity-presence.md` | Private workspace Presence, throttled last-seen persistence, RLS/RPC, stale semantics, and rollout boundary. |
| `workspace-member-status-messages.md` | Workspace-scoped staff status message, same-workspace read, self-only RLS/RPC mutation, CAS, and content-free audit contract. |

## Boundaries

- Product data requirements belong in `docs/product/domain/` or `docs/product/demo-data/` before they become schema work.
- Actual schema, ERD, migrations, RLS, indexes, and persistence contracts belong here or in the more specific auth/security work package that owns the implementation.
- Do not run remote Supabase, migration push, RLS replay, staging seed replay, or production data operations from a README update.
- Private GitBook can expose this folder for internal reading, but secrets, real data, remote project credentials, and unapproved production assumptions must not be added.

## Verification Notes

- Docs-only navigation edits: run `npm run docs:check`.
- Schema or migration edits need the active work item's verification plan and explicit approval for any remote/staging operation.
