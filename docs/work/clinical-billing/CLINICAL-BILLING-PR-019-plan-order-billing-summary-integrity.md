---
id: "CLINICAL-BILLING-PR-019"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "GitHub PR #677"
source_docs:
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-017-plan-order-billing-summary-handoff.md"
  - "docs/work/clinical-billing/CLINICAL-BILLING-PR-018-plan-order-billing-summary-freshness.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
dependencies:
  - "CLINICAL-BILLING-PR-018"
updated: "2026-08-31"
---

# Plan/Order Billing Summary Integrity

## Goal

Close the server-side amount and billing-candidate gaps found while validating
the Plan/Order real-time footer fix, without changing the existing clinical
confirmation, invoice, or encounter lifecycle boundaries.

## Scope

- Create one Billing candidate for a confirmed fixed-price or range-price Order
  Set parent and bind it to that set's aggregate Task.
- Keep included-order-sum sets child-billed and prevent a parent candidate.
- Backfill already-confirmed eligible set parents from their immutable
  confirmation command and aggregate Task, including deterministic legacy
  production-backfill commands whose Order snapshot predates
  `confirmationCommandId`.
- Stop both forward confirmation and historical repair when a conflicting
  candidate disagrees with the canonical workspace, encounter, task, command,
  actor, billing snapshot, or invoice-line authority.
- Rebuild completed confirmation command candidate results after backfill so
  idempotent replay remains deterministic.
- Include fixed/range set-parent amounts in the encounter billing summary.
- Include aggregate Tasks in unfinished-work warnings.
- Keep the local/mock atomic confirmation candidate projection aligned with the
  same fixed/range parent-once and sum parent-excluded contract.
- Exclude payments and surcharge adjustments attached to voided invoices from
  all summary totals and the summary ETag.
- Add source and local SQL regression coverage for the new and repaired paths.

## Out Of Scope

- Any change to Order Set price authoring or range selection rules.
- Any change to included-order-sum child billing or explicit-extra semantics.
- Invoice void/refund workflow policy or payment-provider behavior.
- Encounter status transitions, client layout, or local estimate behavior.
- Applying the migration to a remote Supabase environment without a separate
  exact migration and target approval.

## Done When

- Fixed-price and range-price confirmations return exactly one parent Billing
  candidate with the aggregate Task and the authoritative parent amount.
- Their non-reflecting children and an included-order-sum parent return no
  duplicate candidate.
- Existing eligible confirmed set parents are repaired or migration execution
  stops rather than silently leaving a gap.
- Completed confirmation command replay includes repaired candidates.
- The summary includes set-parent totals and aggregate unfinished status.
- Voided invoice payments and surcharges cannot change amount fields or ETag.
- Focused source tests, local SQL contracts, TypeScript, lint, build, docs, and
  secret checks pass.

## Verification

- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/chart-order-billing-summary-server.spec.ts --reporter=line`
- `docker exec -i supabase_db_emr-app-shell-prototype psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/sql/chart_order_atomic_confirmation_contract.sql`
- `scripts/test-chart-order-billing-summary-integrity-migration.sh`

## Review Policy

- Implementation and integration stay in the isolated clean worktree.
- Run one independent security-boundary review after the exact migration diff
  and local SQL evidence exist because billing authority, backfill, RLS-owned
  tables, and idempotent command state are in scope.
- Do not apply this migration remotely or move a fixed deployment alias until
  the exact source SHA, migration target, and rollback packet are approved.

## Verification Evidence

- The focused adjacent Playwright suite passed `47/47`, covering billing
  summary, atomic confirmation, order actions, invoice-candidate sync, and the
  fulfillment replay boundary.
- The forward SQL contract passed with a `processing` confirmation command and
  rolled back without residue.
- The migration-before runner passed legacy deterministic-command repair,
  candidate and invoice-authority conflict rejection, audit provenance,
  completed result repair, voided-invoice ETag stability, and rollback.
- Lint, TypeScript, production build, documentation links, diff whitespace, and
  secret scanning passed. The production build retained the existing broad NFT
  trace warning from `src/lib/prd-viewer/doc-reader.ts`.
- An independent security and billing-boundary review returned `APPROVE` with
  zero must-fix findings after executing the migration-before runner.
- A clean full local database reset remains blocked before this migration by
  existing seed-order assumptions in unrelated dispensing migrations. Local DB
  lint also retains two unrelated baseline function errors. The PR019 migration
  itself reapplied successfully on the local chart schema and both SQL
  contracts passed.
