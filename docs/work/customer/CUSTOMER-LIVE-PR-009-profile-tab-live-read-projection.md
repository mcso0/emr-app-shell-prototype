---
id: "CUSTOMER-LIVE-PR-009"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "User-approved customer profile live read projection"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/customer/CUSTOMER-PR-002-patient-guardian-profile-side-panel.md"
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
dependencies:
  - "CUSTOMER-LIVE-PR-004"
  - "CUSTOMER-LIVE-PR-005"
  - "CUSTOMER-LIVE-PR-008"
updated: "2026-08-08"
---

# Customer Profile Live Read Projection

## Goal

Connect the shared patient/guardian profile panel to existing workspace-scoped Cheongdam data for profile information, clinical history, reservations, and billing without creating or repairing source rows.

## Scope

- Add function-only, authenticated Supabase RPCs for overview and the three activity sections.
- Enforce workspace membership, subject status, subject relationship, and section permissions at the server/RPC boundary.
- Return minimized profile and activity projections with bounded keyset pagination.
- Use the prepared workspace overview as the source of truth and keep the legacy `clair-demo` local mock path separate.
- Add lazy section loading, explicit loading/error/denied/empty states, and the existing ScrollArea plus `scroll-fade-y scroll-fade-8` utility.
- Preserve profile editing, URL drawers, related-profile navigation, header actions, and current UI WIP.

## Data Integrity Rules

- No seed, DML, fixture, or remote row changes are part of this work.
- Guardian billing is restricted to invoices whose `guardian_id` is the selected guardian.
- Patient billing is restricted through the selected patient's encounter relationship.
- SOAP, diagnosis, prescription, private guardian identifiers, cash-receipt numbers, and vehicle numbers are not returned.

## Out Of Scope

- Chart detail, SOAP/diagnosis/prescription screens, relationship/archive mutations, permission-policy redesign, new tables/indexes, or provider integrations.
- Remote migration application, production deployment, and authenticated browser sign-off until the explicit approval gate is completed.

## Verification

- `npx tsc --noEmit`
- Focused customer API/core tests for same-workspace, cross-workspace, membership, permission, soft-delete, relationship, owner-filter, and cursor behavior.
- `npm run docs:check`
- `npm run security:secrets`
- Focused customer Playwright and Storybook profile-panel checks.

## Result

Local implementation is ready for human review and remains at the remote-application approval gate. No remote migration or data mutation has been executed.

## Pending Remote Approval Packet

- Target project: `clair-emr-staging` (`qmerxgzrwaaahpkhjqlc`), after exact local/remote migration-version comparison.
- Migration: `supabase/migrations/20260808055307_customer_profile_live_read_projection.sql` (function-only; no row/table/index/seed DML).
- Functions and grants: four `public` read RPCs, `authenticated` execute only, `PUBLIC`/`anon` revoked, fixed `search_path`.
- Readback: catalog function/grant checks plus authenticated same-workspace, cross-workspace, inactive-membership, four permission maps, soft-delete, relationship, billing-owner, cursor, and empty-result checks. Security advisor must be clean for the new functions.
- Rollback: do not apply until approved; if applied, drop the four new functions in a reviewed rollback transaction or reapply the prior catalog definition after capturing the pre-apply catalog state.

## Read-only Approval Gate Snapshot (2026-08-08)

- Project readback: `qmerxgzrwaaahpkhjqlc` is `clair-emr-staging`, region `ap-southeast-2`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.121`.
- Remote catalog readback: all four new function names are currently absent. The eight requested domain tables have RLS enabled, zero direct policies, and `anon`/`authenticated` direct `SELECT` denied; this matches the RPC-only boundary.
- Migration history is not version-identical despite the older reconciliation note: remote has 116 records, local has 144 files, with 108 exact version IDs in common, 8 remote version IDs absent locally, and 36 local version IDs absent remotely (the latter includes this new migration). Several are documented or recognizable timestamp aliases, but the current 8 remote-only records are not captured by the 2026-07-22 summary. Do not run a broad `db push` or repair history as part of this work; migration-history reconciliation is a separate gate.
- Security Advisor baseline is not globally clean: 189 findings (44 `INFO`, 145 `WARN`) and performance advisor has 210 findings (192 `INFO`, 18 `WARN`). No finding targets the new function names because they are not yet present. After application, the four-function scope must be rechecked and any new finding must block closeout.
- No remote migration, DDL, DML, row creation/update/deletion, deployment, or authenticated browser readback was executed in this approval-preparation step.

### Approval Decision

The packet is ready for review, but remote application remains blocked until the migration-history mismatch is explicitly reconciled or waived as a separate approved exception. A subsequent apply step must be separately authorized and limited to the single function-only migration; it must not repair unrelated history or apply pending local migrations.

Closeout report: `docs/completed/customer/2026-08-08-customer-live-pr-009-profile-tab-live-read-projection-report.html`
