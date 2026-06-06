---
id: "HOSPITAL-ADMIN-LIVE-PR-010"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "DEN-440"
source_docs:
  - "docs/product/domain/workspace-order-catalog-platform.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
  - "docs/engineering/auth-security/auth-login/hospital-admin-order-catalog-regression-handoff.md"
dependencies:
  - "DEN-440"
  - "HOSPITAL-ADMIN-LIVE-PR-009"
updated: "2026-06-06"
---

# Verify Lab And Order Search DB Contract Boundaries

## Owner OS Packet

title: "Verify lab and order search DB contract boundaries"
intent: "Determine whether lab/order search currently reads from DB-backed contracts and define gated follow-up work without masking gaps with mock changes."
task_type: "safety"
depth_level: "L4"
autonomy_level: "local_edit"
ambiguity_policy: "block gated remote/live work; document local findings and follow-up approval points"

## Scope

- Inspect chart order catalog search, order catalog API/core, lab item linkage/delete-lock, order set expansion, and lab/imaging queue data boundaries.
- Distinguish mock, local-first DB contract, and Supabase-session live gateway behavior.
- Do not run remote Supabase validation, create/apply migrations, change RLS, change server enforcement, or use real data.
- Produce a Korean HTML report and Linear-ready handoff.

## Findings

- Chart `+ Order` search calls `GET /api/workspaces/{workspaceId}/hospital-admin/order-catalog?mode=chart-search`.
- The order catalog route uses a demo mock gateway for demo-header sessions and `createSupabaseOrderCatalogGateway` for Supabase-session reads.
- Supabase chart search is DB-contract-backed through `clair_list_order_catalog_chart_search(p_workspace_id)`, which returns active individual catalog rows and active order sets.
- Chart confirmation re-resolves individual catalog selections through the catalog gateway before creating applied snapshots. Set selections are still rejected as `unsupported_order_type` during confirmation.
- Hospital admin catalog read/mutation is backed by `order_catalog_items` for Supabase sessions, with admin mutation audit and permission adapter wiring.
- The Supabase order catalog gateway does not yet implement DB-backed `expandOrderSet` or `getLabTestItemDeleteLock`; both return not-found in the Supabase gateway.
- Lab/imaging workspace data still comes from mock domain data in `src/features/lab-imaging/data.ts`; fulfillment queue routes can read server-backed work items, but lab result/device ingestion remains out of scope.

## Gated Follow-Up

- Remote Supabase staging replay of `clair_list_order_catalog_chart_search`.
- DB-backed order set expansion gateway/route if set confirmation is required.
- DB-backed lab test item delete-lock gateway/route if live lab admin behavior is required.
- Migration/RLS changes for any missing order set, lab item, linkage, or result-read policies.
- Any provider/device/PACS/lab-result ingestion integration.

## Verification

- Source docs and active Linear issue reviewed.
- Relevant route/core/test/migration paths inspected.
- `npm run docs:check` required after this work item and closeout report are written.

## Result

Closeout report:

- `docs/completed/hospital-admin/2026-06-06-den-440-lab-order-search-db-contract-boundary-report.html`

Linear:

- `DEN-440` should move to Human Review after the closeout is attached.

## Handoff Summary

DEN-440 was resolved as a local Owner OS safety review. Chart order catalog search is DB-contract-backed for Supabase sessions through the live RPC path, but remote Supabase replay remains gated. Set confirmation, live order-set expansion, live lab delete-lock reads, and lab result/device ingestion remain follow-up scopes requiring explicit approval before live DB/migration/RLS work.
