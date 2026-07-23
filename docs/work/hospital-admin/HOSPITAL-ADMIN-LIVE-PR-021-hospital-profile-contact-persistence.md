---
id: "HOSPITAL-ADMIN-LIVE-PR-021"
status: "implemented"
area: "hospital-admin"
priority: "P0"
target_pr: "User request / workspace hospital profile, contact, and change-request persistence"
completion_report: "docs/completed/hospital-admin/2026-07-23-hospital-profile-contact-persistence-report.html"
source_docs:
  - "docs/product/domain/workspace-hospital-profile.md"
  - "docs/engineering/data-model/workspace-hospital-settings.md"
  - "docs/superpowers/plans/2026-07-23-hospital-settings-live-implementation.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-007"
  - "HOSPITAL-ADMIN-LIVE-PR-012"
updated: "2026-07-23"
---

# Hospital Profile And Contact Persistence

## Goal

Replace hard-coded hospital identity and session-only contact values with a
workspace-scoped, permission-enforced, auditable profile API while retaining the
existing operating-hours boundary.

## Scope

- Add `workspace_hospital_profiles` and
  `workspace_hospital_profile_change_requests`.
- Backfill an empty profile row for existing workspaces and auto-create one for
  future workspaces.
- Add active-member reads and admin-only atomic contact/change-request RPCs.
- Use compare-and-set revision checks for contact writes.
- Add profile GET/PATCH and registered-information request POST route handlers
  with strict bounded input validation, rate limiting, stable errors, and safe
  request IDs.
- Hydrate hospital identity/contact screens from the route and preserve an
  explicit session-only mock gateway for unconfigured demo mode.
- Add audit events that record identifiers and changed field names, not field
  contents.
- Harden the existing operating-hours PUT route with strict input parsing and
  mutation rate limiting without changing its storage or URL.

## Out Of Scope

- Logo object storage or image processing.
- Direct editing of hospital name, representative, or address.
- External delivery or operator approval of registered-information requests.
- Trusted public-holiday provider ingestion.
- Real hospital data or remote migration application without approval.

## Done When

- Same-workspace reads and admin contact saves persist across reload.
- Unauthenticated, inactive, non-member, cross-workspace, and non-admin writes
  are denied at both application and DB boundaries.
- A stale revision returns `409` and does not overwrite a newer change.
- A registered-information request is durably recorded and returns a safe
  pending summary without claiming the values changed.
- Operating-hours input tampering is rejected before the RPC.
- Focused server/route/migration/UI tests plus local DB/RLS replay pass.

## Verification

- `npx playwright test tests/hospital-profile-model.spec.ts tests/hospital-profile-server.spec.ts tests/hospital-profile-migration.spec.ts tests/hospital-operating-hours-server.spec.ts tests/hospital-operating-hours-migration.spec.ts --project=chromium --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital profile|contact settings|registered information request" --reporter=line`
- `npx supabase db reset --local`
- `psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/snippets/workspace_hospital_profile_replay.sql`
- `npx tsc --noEmit`
- `npm run lint -- src/features/hospital-admin/settings 'src/app/api/workspaces/[workspaceId]/hospital-admin/settings' 'src/app/api/workspaces/[workspaceId]/hospital-admin/basic-settings/operating-hours' tests/hospital-profile-*.spec.ts tests/hospital-operating-hours-*.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Handoff Notes

- Synthetic Cheongdam profile values belong in a synthetic seed/backfill, not
  the schema migration.
- Operator review and external notification need a separate approved product
  and authorization contract before this request can move beyond `pending`.

## Implementation Result

Implemented and locally verified on 2026-07-23.

- The profile/contact migration, workspace backfill/creation trigger,
  admin-only mutation RPCs, strict Route Handlers, optimistic revision checks,
  and safe audit metadata are present.
- Hospital identity and contact screens hydrate from one authoritative profile
  read and independently save/revert their drafts.
- Registered-information changes create a durable pending request; no external
  delivery or operator-resolution claim is made.
- Local migration reset and transactional profile/RLS/audit replay passed.
  Focused profile, operating-hours, route, UI, lint, type, and build checks
  passed.
- The migration has not been applied to a remote Supabase project.
