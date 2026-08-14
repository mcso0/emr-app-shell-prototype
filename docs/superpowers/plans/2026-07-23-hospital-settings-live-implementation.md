# Hospital Settings Live Implementation Plan

**Execution status (2026-07-23):** All three slices are implemented and
verified against the latest `origin/main`, local application, and local
Supabase boundaries. Remote Supabase/Storage mutation and production merge
remain release-gated.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved CDS V2 hospital settings experience as three independent screens and make hospital profile, contact, registered-information requests, operating hours, exceptions, and logo changes durable through workspace-scoped server/DB/Storage boundaries.

**Architecture:** Keep `section=settings` as the compatible hospital-basic screen, add `settings-contact` and `settings-hours`, and render each as a separate client screen inside the existing hospital-admin module. Reuse the existing operating-hours tables/RPC/API and reception consumers. Add one workspace hospital-profile row, an atomic registered-information request table/RPC, and a separate private logo bucket using the proven signed quarantine/finalize/CAS sequence. The browser owns form drafts and previews; Route Handlers own input/auth/rate-limit boundaries; Supabase RPC/RLS owns tenant and mutation enforcement.

**Tech Stack:** Next.js 16 App Router and Route Handlers, React 19, TypeScript, Zustand, Tailwind CSS v4, existing EMR/CDS V2 components, shadcn/Base UI (`Avatar`, `Button`, `Card`, `Dialog`, `Field`, `Input`, `Select`, `Skeleton`, `Sonner`, `Textarea`, and generated `ToggleGroup`), Supabase PostgreSQL/RLS/Storage/RPC, Sharp, Playwright Test, Storybook.

## Global Constraints

- The user-approved interactive prototype
  `docs/design/screens/hospital-admin/hospital-basic-settings-linear-interactive-prototype.html`
  and linked CDS.V2 Figma are the visual/interaction authority. Do not invent a
  new visual language.
- Implement three screens, not scroll anchors:
  `병원 기본 설정`, `연락처 및 채널`, and `운영시간 관리`.
- Keep `운영시간 관리` and `공휴일 및 예외일` together.
- Remove the breadcrumb/page toolbar.
- Side-panel groups are `병원 설정`, `조직 및 접근`, and
  `진료 카탈로그`.
- Use existing project components first. Add only the official shadcn
  `ToggleGroup` primitive; do not overwrite installed shadcn files or add a
  package dependency.
- Service UX copy uses formal Korean. Do not introduce 반말 in product UI.
- The top weekday ToggleGroup is the only open/closed control. Do not render
  per-row switches or an operating switch inside the time Dialog.
- A closed-day time row is disabled and displays `휴무`.
- The logo trigger is the image itself. Hover and keyboard focus add a dim
  overlay and edit icon; activation opens a Dialog and focus returns to the
  trigger on close.
- Explicit outcome-bearing actions use Sonner feedback: copy, file validation,
  logo stage/save/remove, registered-info request submit, save/revert, weekday
  status change, time apply, and exception add/edit/delete. Navigation, modal
  opening, typing, and ordinary field selection do not show success toasts.
- Validation is not toast-only. Keep field errors, focus the first invalid
  field, and add an error toast for failed submit/apply actions.
- Preserve `hospital_settings:view` and `hospital_settings:manage`; client
  visibility is not authorization.
- Preserve the current operating-hours URL, schema, conflict check, audit event,
  and reception read/write consumers.
- All new persisted objects are workspace-scoped. No real hospital, patient,
  guardian, staff, identity, payment, or secret data belongs in migrations,
  fixtures, screenshots, logs, audit payloads, or docs.
- Do not run remote Supabase, create a remote bucket, deploy, commit, push, or
  merge without separate explicit authorization.

---

## Delivery Slices

| Slice | Work item | Purpose | Merge gate |
| --- | --- | --- | --- |
| A | `HOSPITAL-ADMIN-PR-007` | Screen split, grouped side panel, CDS V2 rows, weekday/time UX, local drafts | Visual/interaction regression and Storybook pass |
| B | `HOSPITAL-ADMIN-LIVE-PR-021` | Profile/contact/change-request DB, RPC, API, operating-route hardening | Local DB/RLS/API reload/readback pass |
| C | `HOSPITAL-ADMIN-LIVE-PR-022` | Private logo Storage, image normalization, pointer CAS, live UI | Local Storage/RLS/upload/remove pass |

The original review plan separated the three slices. The user's explicit
end-to-end release request consolidates them into one atomic release candidate
so the UI, API, schema, and Storage contract cannot deploy in a partially
connected state. Work-item, test, and rollback boundaries remain separate.
Slice C must not change staff profile-avatar ownership or behavior.

---

## File Map

### Slice A — UI and navigation

- Modify `src/components/emr/module-list-side-panel.tsx`: allow top-level
  non-interactive group-label items.
- Modify `src/components/emr/module-list-side-panel.stories.tsx`: document and
  render grouped top-level navigation.
- Create `src/components/ui/toggle-group.tsx`: generated by shadcn CLI.
- Modify `src/features/hospital-admin/store.ts`: add `settings-contact` and
  `settings-hours`, and guard all three settings sections.
- Modify `src/features/hospital-admin/module.tsx`: grouped items, stable query
  sections, separate screen rendering, and dirty-navigation confirmation.
- Modify `src/features/hospital-admin/settings/hospital-basic-settings-screen.tsx`:
  keep hospital identity/region and add the logo editor shell.
- Create `src/features/hospital-admin/settings/hospital-contact-settings-screen.tsx`.
- Create `src/features/hospital-admin/settings/hospital-operating-hours-settings-screen.tsx`.
- Create `src/features/hospital-admin/settings/hospital-logo-editor.tsx`.
- Create `src/features/hospital-admin/settings/hospital-settings-page.tsx`:
  shared 920px page/header/loading/error/dirty-bar composition.
- Modify `src/features/hospital-admin/settings/hospital-operating-hours-editor.tsx`:
  one ToggleGroup source, row actions, time Dialog, and exceptions.
- Modify `src/features/hospital-admin/settings/hospital-basic-settings-model.ts`:
  customer memo plus slice-specific validation/dirty helpers.
- Modify `src/features/hospital-admin/settings/hospital-basic-settings-store.ts`:
  slice-specific hydrate/save/revert actions.
- Modify `tests/hospital-basic-settings-model.spec.ts`.
- Modify `tests/hospital-admin.spec.ts`.

### Slice B — profile/contact/API/DB

- Create `supabase/migrations/20260723110000_workspace_hospital_profiles.sql`.
- Create `supabase/snippets/workspace_hospital_profile_replay.sql`.
- Create `src/features/hospital-admin/settings/hospital-profile-model.ts`.
- Create `src/features/hospital-admin/settings/server-hospital-profile-core.ts`.
- Create `src/features/hospital-admin/settings/server-hospital-profile.ts`.
- Create
  `src/app/api/workspaces/[workspaceId]/hospital-admin/settings/profile/route.ts`.
- Create
  `src/app/api/workspaces/[workspaceId]/hospital-admin/settings/profile-change-requests/route.ts`.
- Modify
  `src/features/hospital-admin/settings/server-hospital-operating-hours-core.ts`.
- Modify
  `src/app/api/workspaces/[workspaceId]/hospital-admin/basic-settings/operating-hours/route.ts`.
- Modify the three settings screens/stores to hydrate/save through the new
  profile boundary.
- Create `tests/hospital-profile-model.spec.ts`.
- Create `tests/hospital-profile-server.spec.ts`.
- Create `tests/hospital-profile-migration.spec.ts`.
- Modify `tests/hospital-operating-hours-server.spec.ts`.
- Modify `tests/hospital-operating-hours-migration.spec.ts`.

### Slice C — private logo

- Create `supabase/migrations/20260723120000_private_hospital_logos.sql`.
- Create `supabase/snippets/private_hospital_logo_replay.sql`.
- Create `scripts/check-private-hospital-logo-storage.mjs`.
- Create
  `src/features/hospital-admin/settings/server-hospital-logo-image-core.ts`.
- Create `src/features/hospital-admin/settings/server-hospital-logo-core.ts`.
- Create `src/features/hospital-admin/settings/server-hospital-logo.ts`.
- Create
  `src/app/api/workspaces/[workspaceId]/hospital-admin/settings/logo/route.ts`.
- Modify `src/features/hospital-admin/settings/hospital-logo-editor.tsx`.
- Modify `src/features/hospital-admin/settings/hospital-basic-settings-screen.tsx`.
- Create `tests/hospital-logo-image.spec.ts`.
- Create `tests/hospital-logo-server.spec.ts`.
- Create `tests/hospital-logo-storage-migration.spec.ts`.
- Modify `tests/hospital-admin.spec.ts`.

### Documentation and closeout

- Modify `docs/engineering/data-model/workspace-hospital-settings.md`.
- Modify `docs/engineering/data-model/README.md`.
- Modify `docs/engineering/current-status.md` only after verified behavior exists.
- Update the active work item after each slice.
- Create one Korean HTML closeout per completed slice under
  `docs/completed/hospital-admin/`.

---

### Task 1: Add grouped side-panel and weekday control primitives

**Files:**
- Modify: `src/components/emr/module-list-side-panel.tsx`
- Modify: `src/components/emr/module-list-side-panel.stories.tsx`
- Create: `src/components/ui/toggle-group.tsx`
- Modify: `tests/hospital-admin.spec.ts`

**Interfaces:**

```ts
export type EmrModuleListSidePanelItem =
  | EmrModuleListSidePanelButtonItem
  | EmrModuleListSidePanelGroupLabelItem
  | EmrModuleListSidePanelSectionItem;
```

Top-level `groupLabel` is presentation-only: no button role, click handler,
active state, or section chevron.

- [ ] **Step 1: Write the failing side-panel/browser assertions**

Add a focused `hospital settings grouped navigation` test to
`tests/hospital-admin.spec.ts` that expects the three group titles in order and
expects `병원 기본 설정`, `연락처 및 채널`, and `운영시간 관리` to be
buttons below `병원 설정`.

- [ ] **Step 2: Run the focused test to verify red**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital settings grouped navigation" --reporter=line
```

Expected: FAIL because the group titles and new settings buttons do not exist.

- [ ] **Step 3: Generate only the missing shadcn primitive**

```bash
npx shadcn@latest add toggle-group
```

Expected: creates `src/components/ui/toggle-group.tsx`. If the CLI proposes
overwriting another installed component, stop and inspect instead of accepting
the overwrite.

- [ ] **Step 4: Extend the shared side-panel union additively**

Reuse `EmrModuleListSidePanelGroupTitle` for a top-level `groupLabel` render
branch. Preserve all existing button/section DOM, tokens, motion, and disabled
badges.

- [ ] **Step 5: Add a Storybook grouped-navigation example**

Add a story whose top-level items include `병원 설정`, two buttons,
`조직 및 접근`, and one button. Verify group labels are visually distinct and
not focusable.

- [ ] **Step 6: Run the shared-component gate**

```bash
npx eslint src/components/emr/module-list-side-panel.tsx src/components/emr/module-list-side-panel.stories.tsx src/components/ui/toggle-group.tsx
npm run build-storybook
```

Expected: both commands pass; no existing side-panel story changes behavior.

### Task 2: Split hospital settings into stable independent screens

**Files:**
- Modify: `src/features/hospital-admin/store.ts`
- Modify: `src/features/hospital-admin/module.tsx`
- Create: `src/features/hospital-admin/settings/hospital-settings-page.tsx`
- Modify: `src/features/hospital-admin/settings/hospital-basic-settings-screen.tsx`
- Create: `src/features/hospital-admin/settings/hospital-contact-settings-screen.tsx`
- Create: `src/features/hospital-admin/settings/hospital-operating-hours-settings-screen.tsx`
- Modify: `tests/hospital-admin.spec.ts`

**Section contract:**

```ts
type HospitalAdminSection =
  | "settings"          // compatible hospital-basic key
  | "settings-contact"
  | "settings-hours"
  // existing values unchanged
```

- [ ] **Step 1: Add failing direct-screen and no-scroll tests**

For each query below, assert exactly one page heading and ensure the other two
screen sections are absent from the DOM:

```text
?section=settings          -> 병원 기본 설정
?section=settings-contact  -> 연락처 및 채널
?section=settings-hours    -> 운영시간 관리
```

Also assert there is no breadcrumb/page-toolbar text.

- [ ] **Step 2: Run the test and confirm red**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital settings screen routes" --reporter=line
```

Expected: FAIL because only `settings` exists and all content is combined.

- [ ] **Step 3: Add section keys and dirty guards**

Update `hospitalAdminSections`, store types, and
`requestSectionChange` so all three settings keys participate in the existing
unsaved-change guard. Keep `roles` behavior unchanged.

- [ ] **Step 4: Build grouped module items**

Create explicit `EmrModuleListSidePanelItem[]` in approved order. Do not force
the grouped design through collapsible `section` items; group labels stay
static. Preserve `Order 관리` child navigation.

- [ ] **Step 5: Make settings clicks URL-backed**

Use `useRouter`, `usePathname`, and `useSearchParams` to push the selected
`section` while preserving unrelated query values. Only push after a dirty
navigation is accepted. Browser back/forward must continue to hydrate the store
through the existing requested-section effect.

- [ ] **Step 6: Extract the common page shell**

`HospitalSettingsPage` owns the 920px max width, responsive padding, header,
loading/error/read-only state slots, and optional dirty bar. It does not own
screen-specific form state.

- [ ] **Step 7: Render one component per section**

Trim `HospitalBasicSettingsScreen` to identity/region/logo shell. Move contact
and operating content to their new files. Do not keep hidden sections or anchor
navigation.

- [ ] **Step 8: Run the focused browser test**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital settings grouped navigation|hospital settings screen routes|hospital settings dirty navigation" --reporter=line
```

Expected: all targeted tests pass at desktop and narrow viewport fixtures.

### Task 3: Implement the approved operating-hours interaction

**Files:**
- Modify: `src/features/hospital-admin/settings/hospital-operating-hours-editor.tsx`
- Modify: `src/features/hospital-admin/settings/hospital-basic-settings-model.ts`
- Modify: `src/features/hospital-admin/settings/hospital-basic-settings-store.ts`
- Modify: `src/features/hospital-admin/settings/hospital-operating-hours-settings-screen.tsx`
- Modify: `tests/hospital-basic-settings-model.spec.ts`
- Modify: `tests/hospital-admin.spec.ts`

**Interaction contract:**

- `ToggleGroup type="multiple"` value is the list of open weekdays.
- Toggling a weekday updates `weeklyHours[day].isOpen` and produces a toast
  describing the staged result.
- Active row action opens the time Dialog.
- Closed row action is disabled and displays `휴무`.
- The time Dialog contains four selects only: treatment start/end and break
  start/end.
- There is no apply-to-all propagation Dialog.

- [ ] **Step 1: Replace propagation tests with single-source tests**

Add model tests for converting an open-day array into schedule `isOpen` flags,
preserving a closed day's retained time values, and validating only open days.
Remove assertions that require the old one-day/all-open-days propagation.

- [ ] **Step 2: Add failing browser assertions**

Assert:

- seven weekday toggle buttons;
- no per-row switches;
- Sunday row action disabled when Sunday is closed;
- opening Monday time Dialog shows four selects and no `운영` switch;
- applying Monday time changes Monday only;
- operating-hours and exceptions are visible on the same screen.

- [ ] **Step 3: Run red tests**

```bash
npx playwright test tests/hospital-basic-settings-model.spec.ts tests/hospital-admin.spec.ts --project=chromium --grep "operating day|operating time dialog|holiday exceptions" --reporter=line
```

Expected: FAIL against the current switches and propagation Dialog.

- [ ] **Step 4: Replace switches with ToggleGroup**

Use the generated shadcn component with visible one-character weekday labels,
full accessible names, pressed state, and approved compact dimensions. Do not
use a custom div pretending to be a radio group.

- [ ] **Step 5: Rebuild each day as label-left/action-right**

Left: weekday plus break/closed description. Right: outline time action with
summary and chevron. Use existing Card/row borders/tokens; do not add direct
colors.

- [ ] **Step 6: Simplify the time Dialog**

Delete `pendingTimePropagation`, its Dialog, and `Switch` imports. Validate the
four values on `운영시간 적용`; keep the Dialog open and focus the first error
on failure. On success, close, return focus, mark dirty, and toast.

- [ ] **Step 7: Align exceptions**

Keep holiday policy as a left-label/right-Select row. Keep exception rows as
left text/right actions. Add/edit/delete use Dialog/confirmation and emit
result toasts. Preserve date sorting, duplicate rejection, and current API
shape.

- [ ] **Step 8: Run focused and existing operating tests**

```bash
npx playwright test tests/hospital-basic-settings-model.spec.ts tests/hospital-operating-hours-server.spec.ts tests/hospital-admin.spec.ts --project=chromium --grep "operating|holiday|exception" --reporter=line
```

Expected: pass with the existing operating-hours API still serving the screen.

### Task 4: Define and migrate hospital profile/contact persistence

**Files:**
- Create: `supabase/migrations/20260723110000_workspace_hospital_profiles.sql`
- Create: `supabase/snippets/workspace_hospital_profile_replay.sql`
- Create: `tests/hospital-profile-migration.spec.ts`
- Modify: `docs/engineering/data-model/workspace-hospital-settings.md`

**DB interfaces:**

```sql
public.workspace_hospital_profiles
public.workspace_hospital_profile_change_requests
public.clair_get_workspace_hospital_profile(text)
public.clair_update_workspace_hospital_contact(text, text, bigint, jsonb, text)
public.clair_create_workspace_hospital_profile_change_request(
  text, text, text[], text, text
)
```

- [ ] **Step 1: Write the failing migration contract test**

Assert tables, workspace foreign keys, revision, length/URL constraints, row
backfill/insert trigger, RLS, explicit grants/revokes, fixed RPC search paths,
permission helpers, CAS error, and safe audit event types.

- [ ] **Step 2: Run the migration test to verify red**

```bash
npx playwright test tests/hospital-profile-migration.spec.ts --reporter=line
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create additive profile and request tables**

Use nullable registered/contact fields for existing-workspace rollout, enforce
trimmed length bounds, constrain `country_code`, and keep request field keys to
the approved subset. Add indexes for workspace request status/created time.

- [ ] **Step 4: Add backfill and future-workspace creation**

Insert one empty profile row for every current workspace. Add an idempotent
after-insert trigger for future workspaces. Do not place Cheongdam sample values
in this schema migration.

- [ ] **Step 5: Add read and atomic mutation RPCs**

Both mutation RPCs verify `auth.uid()` equals the actor argument, require
workspace admin, use a fixed search path, and append safe audit data. Contact
write locks the profile row and rejects stale revision with
`hospital_profile_stale`.

- [ ] **Step 6: Apply least-privilege RLS/grants**

Active members can select the profile. Only administrators can see change
request summaries. No direct authenticated profile/request insert/update/delete
grant is required; grant execute on the public RPCs.

- [ ] **Step 7: Build the transactional replay**

Cover unauthenticated, inactive, cross-workspace, active-reader,
non-admin-writer, admin writer, stale revision, invalid field set, safe audit
payload, and rollback.

- [ ] **Step 8: Run local DB verification**

```bash
npx supabase db reset --local
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/snippets/workspace_hospital_profile_replay.sql
npx playwright test tests/hospital-profile-migration.spec.ts --reporter=line
```

Expected: reset/replay/test pass. If Docker or the local DB is unavailable,
record that as an unverified gate; do not claim DB completion.

### Task 5: Implement profile/contact server and Route Handler boundaries

**Files:**
- Create: `src/features/hospital-admin/settings/hospital-profile-model.ts`
- Create: `src/features/hospital-admin/settings/server-hospital-profile-core.ts`
- Create: `src/features/hospital-admin/settings/server-hospital-profile.ts`
- Create:
  `src/app/api/workspaces/[workspaceId]/hospital-admin/settings/profile/route.ts`
- Create:
  `src/app/api/workspaces/[workspaceId]/hospital-admin/settings/profile-change-requests/route.ts`
- Create: `tests/hospital-profile-model.spec.ts`
- Create: `tests/hospital-profile-server.spec.ts`

**Read model:**

```ts
type HospitalProfile = {
  workspaceId: string;
  name: string;
  representativeName: string | null;
  address: string | null;
  countryCode: "KR";
  timezone: string;
  contact: {
    phone: string;
    fax: string;
    homepage: string;
    instagram: string;
    customerGuideMemo: string;
  };
  logo: { hasCustomLogo: boolean; url: string | null };
  revision: number;
  profileComplete: boolean;
  pendingChangeRequest: {
    id: string;
    fields: Array<"hospital_name" | "representative_name" | "address">;
    createdAt: string;
    status: "pending" | "reviewing";
  } | null;
};
```

- [ ] **Step 1: Write failing parser/core tests**

Cover strict keys, normalized empty optional values, required phone,
HTTP(S)-only homepage, 300-character memo, 2,000-character request detail,
approved request field subset, unauthenticated, read permission, write
permission, cross-workspace, stale revision, and gateway failure.

- [ ] **Step 2: Run red tests**

```bash
npx playwright test tests/hospital-profile-model.spec.ts tests/hospital-profile-server.spec.ts --reporter=line
```

Expected: FAIL because model/core modules do not exist.

- [ ] **Step 3: Implement pure input parsers**

Do not cast `request.json()` directly to the domain type. Return stable
field-error keys that map to the contact form. Reject unknown authority-shaped
fields such as roles, workspace id, actor id, revision overrides, storage path,
or status.

- [ ] **Step 4: Implement mock and Supabase gateways**

Mock data is synthetic and workspace-keyed. Supabase gateway calls only the
approved RPCs and maps raw errors to stable categories. Do not return raw SQL
messages.

- [ ] **Step 5: Implement server cores**

Use `resolveWorkspacePermission` for `hospital_settings:view/manage`. Return a
typed result with status, stable error/denial reason, and profile/request data.

- [ ] **Step 6: Implement bounded Route Handlers**

Use the existing server-session/demo identity seam, DB permission adapter,
`enforceWorkspaceMutationRateLimit`, `getAuditRequestId`, small body limits, and
`Response.json`. GET is request-time and not cached.

- [ ] **Step 7: Add route-level tests**

Verify 401, 403, 400 field error, 409 stale profile, 429 shape, 500 redaction,
successful GET/PATCH/POST, and mock/Supabase envelope compatibility.

- [ ] **Step 8: Run focused tests**

```bash
npx playwright test tests/hospital-profile-model.spec.ts tests/hospital-profile-server.spec.ts --project=chromium --reporter=line
```

Expected: all focused tests pass.

### Task 6: Connect identity, contact, request, and dirty-state UI

**Files:**
- Modify: `src/features/hospital-admin/settings/hospital-basic-settings-screen.tsx`
- Modify: `src/features/hospital-admin/settings/hospital-contact-settings-screen.tsx`
- Modify: `src/features/hospital-admin/settings/hospital-basic-settings-store.ts`
- Modify: `src/features/hospital-admin/settings/hospital-settings-page.tsx`
- Modify: `tests/hospital-admin.spec.ts`

- [ ] **Step 1: Add failing UI states**

Mock profile routes and cover loading Skeleton, ready, missing registered
values, permission denial, retryable read error, contact validation, contact
save/readback, stale revision refresh guidance, registered-info request success,
and request failure.

- [ ] **Step 2: Run UI tests to verify red**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital profile|contact settings|registered information request" --reporter=line
```

Expected: FAIL because screens still use hard-coded/session-only values.

- [ ] **Step 3: Hydrate one workspace profile record**

Store read status, server snapshot, contact draft, saved contact, revision, and
pending request summary by workspace. A failed read must not silently replace
the screen with synthetic defaults in Supabase mode.

- [ ] **Step 4: Render hospital identity and region**

Use label-left/control-right rows. Hospital name, representative, address,
country, and timezone are read-only. Address copy success/failure uses toast and
an accessible live announcement.

- [ ] **Step 5: Implement registered-information request**

Dialog uses existing Checkbox/Textarea/Dialog/Button primitives. Require at
least one field and detail. POST immediately; do not add it to the page dirty
draft. Success closes the Dialog, returns focus, displays pending state, and
toasts `변경 요청이 접수되었습니다.`

- [ ] **Step 6: Implement contact form**

Use Input for phone/fax/homepage/Instagram and a three-row minimum Textarea for
the 300-character memo. Save only this slice. On success replace both draft and
saved snapshot with server readback and toast.

- [ ] **Step 7: Implement discard and navigation behavior**

Revert restores the last server snapshot and toasts. Leaving a dirty contact
screen requires confirmation. A save failure retains draft values.

- [ ] **Step 8: Run UI/readback regression**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital profile|contact settings|registered information request|dirty navigation" --reporter=line
```

Expected: focused UI cases pass at desktop and 390px.

### Task 7: Harden the existing operating-hours route

**Files:**
- Modify:
  `src/features/hospital-admin/settings/server-hospital-operating-hours-core.ts`
- Modify:
  `src/app/api/workspaces/[workspaceId]/hospital-admin/basic-settings/operating-hours/route.ts`
- Modify: `tests/hospital-operating-hours-server.spec.ts`
- Modify: `tests/hospital-operating-hours-migration.spec.ts`

- [ ] **Step 1: Add failing tamper/limit tests**

Cover unknown fields, missing seven days, duplicate/missing weekday indexes,
invalid time format/order, break outside treatment, closed day with active
times, invalid holiday policy, duplicate exception date, oversized body, rate
limit, and raw error redaction.

- [ ] **Step 2: Run tests to verify red**

```bash
npx playwright test tests/hospital-operating-hours-server.spec.ts --reporter=line
```

Expected: at least malformed inputs fail because the route currently casts JSON
without strict parsing.

- [ ] **Step 3: Add a pure server parser**

Reuse the model's time/range rules but parse the unknown JSON shape before it
reaches `updateHospitalOperatingHours`. Preserve the existing public
`HospitalOperatingHoursSettings` shape.

- [ ] **Step 4: Add bounded body, rate limit, and stable errors**

Apply the same workspace mutation boundary as the new profile route. Keep
`future_appointment_conflict` mapped to 409. Add request ID without exposing DB
messages.

- [ ] **Step 5: Run existing and new regressions**

```bash
npx playwright test tests/hospital-operating-hours-server.spec.ts tests/hospital-operating-hours-migration.spec.ts tests/reception-operating-hours-ui.spec.ts --project=chromium --reporter=line
```

Expected: parser hardening passes and the existing reception calendar/write
contract remains unchanged.

### Task 8: Create the private hospital-logo DB/Storage contract

**Files:**
- Create: `supabase/migrations/20260723120000_private_hospital_logos.sql`
- Create: `supabase/snippets/private_hospital_logo_replay.sql`
- Create: `scripts/check-private-hospital-logo-storage.mjs`
- Create: `tests/hospital-logo-storage-migration.spec.ts`

**Storage paths:**

```text
{workspace_id}/incoming/{actor_user_id}/{upload_uuid}
{workspace_id}/logos/{logo_uuid}.webp
```

- [ ] **Step 1: Write the failing migration contract test**

Assert private bucket, 5MB limit, JPEG/PNG/WebP bucket allowlist, exact pointer
constraint, admin insert/delete policy, active-member current-pointer read,
fixed-path RPC, CAS, audit events, and least-privilege grants.

- [ ] **Step 2: Run red**

```bash
npx playwright test tests/hospital-logo-storage-migration.spec.ts --reporter=line
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add bucket and policies**

Derive workspace from the first path segment and actor from authenticated
identity. Incoming writes/removes require workspace admin. Current normalized
logo read requires active membership in that workspace and exact equality with
the profile pointer.

- [ ] **Step 4: Add guarded pointer RPC**

`clair_set_workspace_hospital_logo_state` locks the profile, checks expected
revision and pointer, validates the derived final path, updates pointer/revision,
and audits only before/after `hasLogo`.

- [ ] **Step 5: Add local SQL replay**

Cover admin upload path, non-admin denial, cross-workspace denial, current
pointer read, foreign/non-current path denial, stale pointer, removal, audit
redaction, and rollback.

- [ ] **Step 6: Add Storage API replay**

The script performs prepare/upload/finalize/read/remove against local Supabase
using generated bytes and confirms forbidden paths fail. It must never print
tokens or signed URLs.

- [ ] **Step 7: Run local Storage/DB gates**

```bash
npx supabase db reset --local
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/snippets/private_hospital_logo_replay.sql
node scripts/check-private-hospital-logo-storage.mjs
npx playwright test tests/hospital-logo-storage-migration.spec.ts --reporter=line
```

Expected: all pass or the slice remains unverified.

### Task 9: Implement secure logo normalization and server orchestration

**Files:**
- Create:
  `src/features/hospital-admin/settings/server-hospital-logo-image-core.ts`
- Create: `src/features/hospital-admin/settings/server-hospital-logo-core.ts`
- Create: `src/features/hospital-admin/settings/server-hospital-logo.ts`
- Create:
  `src/app/api/workspaces/[workspaceId]/hospital-admin/settings/logo/route.ts`
- Create: `tests/hospital-logo-image.spec.ts`
- Create: `tests/hospital-logo-server.spec.ts`
- Run existing: `tests/staff-profile-avatar-image.spec.ts`
- Run existing: `tests/staff-profile-avatar-persistence.spec.ts`
- Run existing: `tests/staff-profile-avatar-route.spec.ts`

- [ ] **Step 1: Write image-validation red tests**

Cover JPEG/PNG success; WebP/GIF/SVG rejection; declared/stored/magic mismatch;
over 5MB; under 256px; over 25MP; malformed input; multi-frame input;
orientation; 512×512 WebP output; contain fit; and metadata removal.

- [ ] **Step 2: Write server-flow red tests**

Cover prepare/finalize/discard/remove permissions, server-generated paths,
pointer CAS, signed-read-before-swap, candidate cleanup, old-object cleanup
pending, quarantine cleanup, removal restore, and stable errors.

- [ ] **Step 3: Run red tests**

```bash
npx playwright test tests/hospital-logo-image.spec.ts tests/hospital-logo-server.spec.ts --reporter=line
```

Expected: FAIL because logo server modules do not exist.

- [ ] **Step 4: Implement logo-specific image core**

Use Sharp server-side. The logo transform differs from the avatar crop:
orientation-normalize, fit `contain`, transparent padding, WebP output, and no
metadata. Reuse proven validation helpers only if their public contract can stay
unchanged; do not weaken staff-avatar validation.

- [ ] **Step 5: Implement gateway/core**

Follow the profile-avatar quarantine/finalize/CAS/cleanup sequence but use
workspace-admin authorization and the hospital-logo bucket/path contract. The
client never supplies a path, final logo ID, or target actor.

- [ ] **Step 6: Implement the Node.js Route Handler**

Use `export const runtime = "nodejs"`, small bounded JSON bodies, server session,
workspace permission adapter, rate limit, random UUIDs, and stable response
codes. Mock mode may keep a clearly identified session preview but must not
claim durable Storage.

- [ ] **Step 7: Run logo and avatar regressions**

```bash
npx playwright test tests/hospital-logo-image.spec.ts tests/hospital-logo-server.spec.ts tests/staff-profile-avatar-image.spec.ts tests/staff-profile-avatar-persistence.spec.ts tests/staff-profile-avatar-route.spec.ts --project=chromium --reporter=line
```

Expected: new logo tests and all existing avatar tests pass.

### Task 10: Connect the approved logo editor to live persistence

**Files:**
- Modify: `src/features/hospital-admin/settings/hospital-logo-editor.tsx`
- Modify: `src/features/hospital-admin/settings/hospital-basic-settings-screen.tsx`
- Modify: `src/features/hospital-admin/settings/hospital-settings-page.tsx`
- Modify: `tests/hospital-admin.spec.ts`

- [ ] **Step 1: Add failing interaction tests**

Cover hover/focus dim overlay and edit icon, Dialog open/close focus return,
file-type/size client preflight, object URL preview, default-image stage,
cancel-without-change, apply-to-draft, save upload, remove, failure draft
retention, toast copy, and reload readback.

- [ ] **Step 2: Run red**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital logo" --reporter=line
```

Expected: FAIL until the logo UI calls the server route.

- [ ] **Step 3: Build the trigger with existing primitives**

Use shadcn Avatar for the image/fallback and Button for the absolute overlay.
The overlay uses semantic tokens/opacity, the CDS edit icon, an explicit Korean
accessible name, and identical hover/focus-visible behavior.

- [ ] **Step 4: Build the Dialog**

Use Dialog, Button, Field, and native hidden file input. Show a large preview,
file name, PNG/JPG/5MB help, `파일 선택`, `기본 이미지 사용`, `취소`, and
`로고 적용`. Revoke every replaced/unmounted object URL.

- [ ] **Step 5: Stage, then persist**

`로고 적용` updates the page draft and toasts that it is staged. The page dirty
bar performs prepare → direct signed upload → finalize. Default-image save uses
DELETE. A failed server step keeps the staged draft and calls discard when an
upload ID exists.

- [ ] **Step 6: Refresh the authoritative snapshot**

After success, replace the preview with the server-returned signed URL and
revision, clear dirty state, and toast the final result. A signed URL/local
preview alone is not readback proof; reload must resolve the current pointer.

- [ ] **Step 7: Run desktop/narrow/keyboard tests**

```bash
npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital logo" --reporter=line
```

Expected: focused tests pass at desktop and 390px with keyboard-only operation.

### Task 11: Full verification, docs, and release handoff

**Files:**
- Modify the three active work items with actual results.
- Modify `docs/engineering/data-model/workspace-hospital-settings.md` if the
  implemented contract differs.
- Modify `docs/engineering/current-status.md` only for verified boundaries.
- Create one `docs/completed/hospital-admin/` HTML report per slice, using the
  actual completion date and the work-item slug. Do not create a completion
  report before that slice is verified.

- [ ] **Step 1: Run all focused tests**

```bash
npx playwright test tests/hospital-basic-settings-model.spec.ts tests/hospital-profile-model.spec.ts tests/hospital-profile-server.spec.ts tests/hospital-profile-migration.spec.ts tests/hospital-operating-hours-server.spec.ts tests/hospital-operating-hours-migration.spec.ts tests/reception-operating-hours-ui.spec.ts tests/hospital-logo-image.spec.ts tests/hospital-logo-server.spec.ts tests/hospital-logo-storage-migration.spec.ts tests/staff-profile-avatar-image.spec.ts tests/staff-profile-avatar-persistence.spec.ts tests/staff-profile-avatar-route.spec.ts --project=chromium --reporter=line
```

- [ ] **Step 2: Run browser integration**

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/hospital-admin.spec.ts --project=chromium --grep "hospital settings|hospital profile|contact settings|operating|holiday|exception|hospital logo" --reporter=line
```

- [ ] **Step 3: Run static/shared gates**

```bash
npx tsc --noEmit
npm run lint -- src/components/emr/module-list-side-panel.tsx src/components/emr/module-list-side-panel.stories.tsx src/components/ui/toggle-group.tsx src/features/hospital-admin/module.tsx src/features/hospital-admin/store.ts src/features/hospital-admin/settings 'src/app/api/workspaces/[workspaceId]/hospital-admin/settings' 'src/app/api/workspaces/[workspaceId]/hospital-admin/basic-settings/operating-hours' tests/hospital-*.spec.ts
npm run build-storybook
npm run docs:check
npm run ux-copy:check
npm run security:secrets
npm run build
git diff --check
```

- [ ] **Step 4: Run local persistence readback**

Repeat the profile and logo SQL/Storage replays after the final migration set.
Use synthetic workspace/users only. Confirm contact, pending request,
operating-hours, exception, logo pointer, signed read, remove, audit, and
cross-workspace denial.

- [ ] **Step 5: Capture visual/accessibility evidence**

Capture desktop and 390px screenshots for all three screens plus logo hover and
Dialog. Verify keyboard order, focus restoration, visible focus, ToggleGroup
pressed names, disabled closed-day row, Textarea label/help, Dialog names, and
toast/field-error announcements.

- [ ] **Step 6: Update status truthfully**

Mark a slice complete only if its behavior and verification pass. State
session-only, local DB, remote staging, and production evidence separately.

- [ ] **Step 7: Stop before remote operations**

Present exact migration files, branch/SHA, checks, rollback, and target
environment. Wait for explicit approval before remote Supabase, Storage,
deployment, commit/push/PR/merge, or production smoke.

---

## Final Self-Review Checklist

- [ ] Distinct screens replace scroll navigation.
- [ ] No breadcrumb/page toolbar remains.
- [ ] Side-panel groups/order/copy match the approved prototype.
- [ ] Existing EMR/shadcn/CDS components are used; only ToggleGroup is added.
- [ ] There is one weekday open/closed control source.
- [ ] Time Dialog has no operating switch and no apply-to-all prompt.
- [ ] Contact memo is a real multi-line Textarea with 300-character validation.
- [ ] Logo trigger hover and focus states match; Dialog and object URL cleanup
  are accessible.
- [ ] Every explicit action result has toast feedback without noisy navigation
  or typing toasts.
- [ ] Loading, missing, empty, error, permission, stale, conflict, and cleanup
  states are covered.
- [ ] Profile/contact/logo/request data is workspace-scoped with server and DB
  enforcement.
- [ ] Existing operating-hours persistence and reception consumers regressions
  pass.
- [ ] Audit/log payloads contain no raw contact/request/image/token values.
- [ ] Local DB and Storage replay exist before any remote claim.
- [ ] Each PR remains within its work-item boundary.

## Execution Record

- Focused model/server/migration suite: 40 passed.
- Dedicated settings browser integration: 4 passed.
- Existing hospital-admin browser regression: 29 passed.
- `npm run lint`, `npx tsc --noEmit`, `npm run docs:check`,
  `npm run ux-copy:check`, `npm run build`, and `npm run build-storybook`
  passed.
- Local Supabase reset applied the complete migration chain successfully.
- The final audit-event catalog migration preserves later space-management
  event types and adds profile/logo events; full reset and replay verified the
  final migration order.
- Profile SQL replay and private-logo SQL replay passed.
- Authenticated private-logo Storage API QA passed direct signed upload,
  quarantine isolation, unpointed admin access, current-member access, pointer
  restore, cross-owner admin cleanup, and zero probe-object cleanup.
- DB lint no longer reports an issue in the new hospital settings functions.
  It still reports pre-existing findings in chart/reception/lab functions that
  are outside these three work-item boundaries.
- Remote migrations, Storage setup, deployment, and production smoke remain
  unverified.
