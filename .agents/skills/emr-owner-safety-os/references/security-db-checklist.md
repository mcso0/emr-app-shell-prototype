# Security And DB Checklist

Use after approval for auth, permission, Supabase, DB, migration, RLS, API route, secret, or data-integrity review.

## Approval Gates

Stop before:

- remote Supabase staging/live validation
- migration push or remote RLS work
- production deploy
- real email, payment, provider, device, PACS, or KakaoTalk integration
- real hospital, patient, guardian, identity, billing, or payment data
- role/permission policy changes

## Security Checks

- Secrets: `.env`, API keys, service-role keys, database URLs, JWT secrets, passwords, tokens, private keys.
- Browser exposure: no sensitive values under `NEXT_PUBLIC_`.
- Auth: unauthenticated access is denied where required.
- Authorization: role/workspace checks are not client-only.
- Tenant/workspace isolation: one workspace cannot read or mutate another workspace's data.
- Server/API boundaries: sensitive reads/writes happen behind server enforcement.
- Logging: no PII, tokens, credentials, or internal stack details exposed to users or unsafe logs.
- Error handling: no raw provider/database error leaks to the client.
- Rate/abuse: auth, invitation, role mutation, and operator routes have abuse handling where scoped.

## DB Checks

- Schema need: does the request actually require DB change?
- Migration: additive where possible, named, reversible or resettable, and locally validated.
- Existing data: impact, backfill, default values, nullable changes, and destructive changes.
- Constraints: uniqueness, foreign keys, check constraints, not-null, soft delete boundaries.
- Indexes: needed for workspace-scoped lookups, filters, joins, or queue reads.
- Seed data: synthetic only.
- Rollback/reset: documented path for local validation.
- RLS: do not claim complete security without verified server/API/DB/RLS boundary.

## CLAiR EMR High-Risk Domains

- Patient, guardian, chart, diagnosis, prescription, order, fulfillment, billing, audit, workspace membership, invitation, role management.
- Last-admin protection and role changes.
- Billing amount integrity and invoice/payment status.
- Clinical order lifecycle and fulfillment handoff.

## Report Evidence

Separate:

- confirmed issue
- likely risk requiring source-doc verification
- approval-gated action
- safe local-only follow-up
