---
id: ENGINEERING-DATA-MODEL-WORKSPACE-HOSPITAL-SETTINGS
type: Data Contract
title: "Workspace Hospital Settings"
description: "Defines workspace-scoped hospital profile, contact, registered-information request, operating-hours reuse, and private logo persistence boundaries."
status: implemented
area: engineering
doc_type: data-contract
tags: [hospital-admin, hospital-profile, settings, storage, rls, api]
related_work:
  - HOSPITAL-ADMIN-PR-007
  - HOSPITAL-ADMIN-LIVE-PR-021
  - HOSPITAL-ADMIN-LIVE-PR-022
last_updated: 2026-07-23
---

# Workspace Hospital Settings

## Decision

The approved hospital settings experience is three independent module sections:

1. `병원 기본 설정`
2. `연락처 및 채널`
3. `운영시간 관리`

They are distinct screens, not anchors in one long page. `병원 기본 설정`
owns registered identity, region/timezone display, and the hospital logo.
`연락처 및 채널` owns editable customer-facing contact data.
`운영시간 관리` reuses the existing authoritative operating-hours tables,
RPCs, API route, conflict protection, and reception consumers.

## Data Ownership

### Existing sources kept as authority

| Data | Authority | Notes |
| --- | --- | --- |
| Hospital name | `public.workspaces.display_name` | Read-only in the hospital screen; changes use a request record. |
| Workspace timezone | `public.workspaces.timezone` | Existing operating-hours migration remains authoritative. |
| Holiday policy | `public.workspaces.holiday_policy` | Existing operating-hours mutation remains authoritative. |
| Weekly hours | `public.workspace_operating_hours` | Reuse without a second schedule table. |
| Date exceptions | `public.workspace_operating_hour_exceptions` | Reuse without a second exception table. |

### New `workspace_hospital_profiles`

One row belongs to one workspace.

| Column | Type | Contract |
| --- | --- | --- |
| `workspace_id` | `text primary key` | References `public.workspaces(id)` with cascade delete. |
| `representative_name` | `text null` | Registered representative/director display value. Required before a profile is considered complete. |
| `address` | `text null` | Registered address display value. Required before a profile is considered complete. |
| `country_code` | `text not null default 'KR'` | ISO 3166-1 alpha-2 value; read-only in this screen. |
| `representative_phone` | `text null` | Editable contact value; required before a profile is considered complete. |
| `fax` | `text null` | Optional. |
| `homepage_url` | `text null` | Optional HTTP(S) URL. |
| `instagram_handle` | `text null` | Optional handle or profile URL. |
| `customer_guide_memo` | `text null` | Optional customer-facing message, maximum 300 characters. |
| `logo_storage_path` | `text null` | Exact current private normalized logo object path. |
| `revision` | `bigint not null default 1` | Compare-and-set version for contact and logo pointer writes. |
| `updated_by_user_id` | `uuid null` | References `public.users(id)` with `on delete set null`. |
| `created_at`, `updated_at` | `timestamptz` | Server-owned timestamps. |

The additive migration backfills one empty profile row for every existing
workspace and creates an `after insert` trigger for future workspaces. Required
business fields remain nullable during rollout so an existing workspace is not
made invalid by the migration. The API exposes `profileComplete` and applies
required-field validation on an admin save.

Synthetic Cheongdam values belong in the existing synthetic seed/backfill
family, not in the schema migration.

### New `workspace_hospital_profile_change_requests`

| Column | Type | Contract |
| --- | --- | --- |
| `id` | `uuid primary key` | Server-generated. |
| `workspace_id` | `text` | Workspace scope with cascade delete. |
| `requested_by_user_id` | `uuid` | Authenticated actor. |
| `requested_fields` | `text[]` | Non-empty subset of `hospital_name`, `representative_name`, and `address`. |
| `detail` | `text` | Trimmed request detail, 1–2,000 characters. |
| `status` | `text` | `pending`, `reviewing`, `approved`, `rejected`, or `cancelled`. |
| `created_at`, `resolved_at` | `timestamptz` | `resolved_at` is nullable. |
| `resolved_by_user_id` | `uuid null` | Reserved for an approved operator-review surface. |

This slice records and reads a pending request. It does not send email, Slack,
or another external message and does not implement the operator approval UI.
The customer-facing success toast therefore says the request was `접수됨`, not
that registered information was changed.

## API Contract

### Profile and contact

`GET /api/workspaces/[workspaceId]/hospital-admin/settings/profile`

- Requires an authenticated active workspace member and
  `hospital_settings:view`.
- Returns registered identity, country/timezone, editable contact, current logo
  signed-read URL, revision, profile completeness, and the latest pending
  change-request summary.
- Never returns a Storage object path, signed upload token, raw database error,
  or request detail to a user who cannot manage hospital settings.

`PATCH /api/workspaces/[workspaceId]/hospital-admin/settings/profile`

- Requires `hospital_settings:manage` in the server permission adapter and
  workspace-admin enforcement in the RPC.
- Accepts only `revision` and the five contact fields.
- Uses a bounded JSON body, strict key validation, normalized strings,
  HTTP(S)-only homepage validation, a 300-character memo limit, rate limiting,
  and a compare-and-set revision.
- Returns `409 stale_profile` when another mutation changed the same row.

`POST /api/workspaces/[workspaceId]/hospital-admin/settings/profile-change-requests`

- Requires `hospital_settings:manage`.
- Accepts only the approved registered field keys and trimmed detail.
- Persists one request and returns its safe summary.
- External delivery and operator resolution remain separate approved work.

### Operating hours

Keep
`GET|PUT /api/workspaces/[workspaceId]/hospital-admin/basic-settings/operating-hours`
for compatibility. Add strict server input parsing, bounded body handling,
mutation rate limiting, request IDs, and stable validation errors; do not rename
the route or replace the existing RPC/tables.

### Hospital logo

`POST /api/workspaces/[workspaceId]/hospital-admin/settings/logo`

- `prepare`: returns a server-generated upload ID and signed upload token.
- `finalize`: validates and normalizes the quarantine object, creates a signed
  read for the candidate, compare-and-set swaps the profile pointer, and cleans
  old objects.
- `discard`: best-effort quarantine cleanup after a handled browser failure.

`DELETE /api/workspaces/[workspaceId]/hospital-admin/settings/logo`

- Compare-and-set clears the profile pointer before deleting the prior object.
- A deletion failure attempts pointer restore and returns a recoverable error.

The browser uploads directly to Storage; raw image bytes do not pass through the
Next.js route.

## Private Logo Storage

| Surface | Contract |
| --- | --- |
| Bucket | Private `hospital-logos` |
| Accepted source | PNG or JPEG, maximum 5MB |
| Quarantine path | `{workspace_id}/incoming/{actor_user_id}/{server_uuid}` |
| Normalized path | `{workspace_id}/logos/{server_uuid}.webp` |
| Signed read | Five-minute expiry |
| Dimensions | Minimum 256×256, maximum 25 megapixels |
| Output | Single-frame 512×512 WebP, orientation-normalized, `contain` fit, transparent padding, metadata stripped |

File extension, declared MIME, stored MIME, magic bytes, decoded format, frame
count, dimensions, and pixel count must agree before the pointer changes.
Animated or malformed images are rejected. The bucket must allow WebP for the
server-generated final object even though the customer file picker accepts only
PNG/JPEG.

Storage policies and the server boundary derive the workspace and actor from the
authenticated request. Client-submitted object paths, target workspace IDs
outside the route, and final logo IDs are not trusted.

## Authorization And RLS

- Active workspace members with `hospital_settings:view` may read the hospital
  profile and current signed logo.
- `hospital_settings:manage` plus workspace-admin DB enforcement is required for
  contact, registered-information request, operating-hours, and logo mutations.
- Client visibility or disabled controls are not an authorization boundary.
- Direct authenticated writes to profile, change-request, and logo pointer
  columns are not granted. Security-definer RPCs with fixed search paths own
  mutations.
- RLS/regression coverage includes unauthenticated, inactive member,
  cross-workspace member, active reader, non-admin writer, and admin writer.

## Mutation And Audit Contract

| Action | Event type | Safe payload |
| --- | --- | --- |
| Contact save | `hospital.profile_contact_updated` | Profile id, revision, changed field names |
| Registered-info request | `hospital.profile_change_requested` | Request id, selected field keys, status |
| Logo upload | `hospital.logo_updated` | Profile id, before/after `hasLogo`, revision |
| Logo removal | `hospital.logo_removed` | Profile id, before/after `hasLogo`, revision |
| Operating-hours save | Existing `hospital.operating_hours_updated` | Existing contract |

Audit and server logs must exclude phone/fax values, address, customer memo,
request detail, image bytes, upload tokens, signed URLs, Storage signatures,
cookies, and raw database errors.

## UI State And Feedback Contract

- Navigation, focus, modal opening, typing, and ordinary selection do not create
  success toasts.
- Outcome-bearing actions do: copy, logo file validation, logo apply/remove,
  registered-info request submit, contact save/revert, weekday open/closed
  change, time apply, exception add/edit/delete, and final settings save.
- Validation remains visible beside the relevant field and is also summarized
  by an error toast when an explicit submit/apply action fails.
- Loading uses existing Skeleton primitives. Whole-surface read error or
  permission denial uses the existing EMR state pattern with retry only when
  retry is meaningful.
- Each of the three screens owns an independent dirty draft. Leaving a dirty
  screen requires discard confirmation; browser refresh/close keeps the native
  warning.

## Verification Gate

Before a live claim:

- focused model, image-validation, server-core, route, and migration contract
  tests pass;
- local PostgreSQL migration/RLS/RPC replay passes;
- local Storage prepare/upload/finalize/read/remove and cross-workspace denial
  replay passes;
- UI covers desktop and narrow viewports, keyboard/focus restore, loading,
  empty, error, denial, validation, stale revision, and operating-hours conflict;
- reload/readback confirms contact, request, hours, and logo persistence;
- TypeScript, focused ESLint, Storybook build for a shared side-panel change,
  docs, secret scan, UX-copy check, production build, and diff checks pass.

Remote migration, production Storage setup, and deployment require their own
explicit approval and evidence. No real hospital or personal data may be used.

## Implementation Status

The contract was implemented and locally verified on 2026-07-23. Local
Supabase migration replay, profile/RLS/audit replay, private logo SQL replay,
and authenticated Storage API upload/read/restore/delete cleanup all passed.
Application lint, typecheck, production build, focused server/model/migration
tests, and the hospital-admin browser suite also passed.

This is not a remote-live claim. The two new migrations, private bucket, and
application routes have not been applied or deployed to a remote environment.
