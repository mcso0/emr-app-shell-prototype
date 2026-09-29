---
id: "CUSTOMER-PR-002"
status: "in_progress"
area: "customer"
priority: "P0"
target_pr: "User request / patient and guardian profile side panel Figma implementation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/features/legacy-mvp-feature-spec.md"
dependencies:
  - "CUSTOMER-LIVE-PR-004"
  - "CUSTOMER-LIVE-PR-005"
updated: "2026-09-29"
---

# Patient and Guardian Profile Side Panel

## Goal

Preserve the CDS V2 patient and guardian profile content, read/edit, and navigation behavior. The approved 2026-09-29 follow-up moves patient, guardian, and staff operational profiles into a shared non-modal overlay drawer, independently of reception/reservation right panels. The earlier 380 x 1105 specimen measurements remain historical content-design evidence.

## Scope

- Replace the duplicated shell and feature headers with the Figma-owned 151 px identity header and four-tab navigation.
- Render patient and guardian information, linked identities, upcoming reservations, encounter history, and billing summaries from the existing mock/read-model graph.
- Preserve profile PATCH save, linked patient/guardian navigation, drawer close, URL selection, and workspace reuse.
- Route the treatment preconsultation `환자 정보` and `보호자 정보` actions to the shared profile overlay drawer.
- Add operating-date grouping for encounter history, including missing or invalid dates.
- Add invoice/payment hierarchy to billing cards while retaining the Figma card surface.
- Verify the source viewport against the provided Figma captures with pixel comparison and record explicit masks for the two approved content exceptions.
- Reuse the shared Sheet as a 380 px right-edge profile overlay, full viewport width at 1100 px and below, without reserving main-content width.
- Keep profile selection separate from reception detail, appointment detail, and reception/reservation creation; these remain workspace side panels.

## Out Of Scope

- New or changed API, database, Supabase migration, RLS, or permission policy.
- New avatar persistence or Patient/Guardian avatar fields.
- Production activity-tab read projections.
- Shared design-system token changes, staff-profile content changes, or unrelated drawer placement changes.

## Done Criteria

- Patient and guardian drawers use a 380 px feature-owned panel with the Figma header, tabs, spacing, typography, radii, and colors.
- Information, reservation, history, billing, filled, empty, long-content, edit, and keyboard-close paths are usable.
- Existing profile save and linked-identity navigation continue to work.
- Patient and guardian profiles render in `workspace-profile-drawer`; reception/reservation tasks retain `workspace-right-panel` and their mounted drafts.
- Treatment preconsultation profile actions open the selected encounter's patient or primary guardian in the shared panel instead of the retired chart-specific information sheet.
- Opening the profile preserves main workspace width and the same overlay position when navigating between patient and guardian profiles.
- Focused lint, typecheck, Playwright, Storybook build, and pixel-comparison evidence are recorded.
- Pixel differences are iterated to the approved threshold; any remaining mismatch is reported, not described as exact.

## Verification

The dated July checks below describe the previous side-panel placement. Current
overlay verification is recorded in the 2026-09-29 follow-up below.

- Passed: targeted ESLint for implementation and affected tests.
- Passed: `npx tsc --noEmit`.
- Passed: 3 focused reception profile tests and 4 shared customer profile tests.
- Passed: `npm run build-storybook` (existing font-path and bundle-size warnings remain).
- Passed: `npm run build` (existing Turbopack NFT trace warning remains).
- The broader customer/reception suite was sampled through 49/117 tests, then stopped with 32 passes, 15 unrelated baseline failures in operating-hours, date labels, calendar fixtures, and registration typography, plus one stale profile post-save assertion. The profile assertion was corrected and its focused suite passed on rerun.
- Captured eight 380 x 1105 DPR 1 Storybook specimens and compared raw DOM screenshots with Figma PNG references after compositing transparent source pixels over white.
- 2026-07-22 follow-up passed targeted ESLint, `npx tsc --noEmit`, and four focused Playwright scenarios covering content push, 380 px right-panel geometry, patient-to-guardian position retention, edit/navigation behavior, activity tabs, keyboard close, and the absence of the absolute workspace drawer.
- 2026-07-24 treatment follow-up passed targeted ESLint, `npx tsc --noEmit`, and the focused chart consultation Playwright scenario after a verified red-green regression cycle. It covers patient-to-guardian panel switching, URL-backed drawer identity, Escape close, and the absence of both the retired information dialog and absolute workspace drawer.

## Pixel Comparison Result

- Structural contract passed: panel 380 x 1105, feature header 151 px, content 378 x 952, fixed header plus independently scrolling content.
- Best strict empty-state result: billing empty MAE 1.3633, 1.8885% of pixels above max-channel delta 10.
- Filled information results: patient MAE 5.7537 / 6.9007% above delta 10; guardian MAE 7.7329 / 10.0945% above delta 10.
- The approved date-grouping and billing-hierarchy exceptions were compared without masks and therefore retain higher raw differences.
- The result must not be called `exact match`: non-zero raster differences remain, mainly around text/vector antialiasing and the two approved content exceptions.
- Work item remains `in_progress` until the product owner accepts a concrete pixel threshold or a same-renderer reference makes zero-diff verification possible.

## Handoff Notes

- Figma nodes: root `27779:70074`; patient/guardian info, reservation, history, and billing variants under the same frame.
- Visual authority: Figma. The implementation report supplies IA, data, edge-case, and verification guidance only.
- The activity data remains synthetic/mock in this item. A live tab projection needs separate workspace, RLS, and permission approval.
- The supplied guardian-info Figma fixture renders two primary-patient cards while its count badge says `1`; production uses the actual item count, while the pixel-reference story isolates the literal Figma badge value.
- PR #475 shipped the original CDS V2 profile surface. The 2026-07-22 follow-up changes only its shell placement and embedded border ownership; profile data, permissions, persistence, tabs, and actions remain unchanged.
- The 2026-07-24 treatment consumer hydrates the existing profile store from the selected chart queue record before opening the shared panel. It does not restore the retired chart-specific patient information panel.

## 2026-09-29 Profile Overlay Follow-up

- Authorization: 승욱 approved implementation with TDD, then commit, push, PR,
  merge to `origin/main`, and deployment after passing checks. Work is isolated
  from the dirty primary checkout; data/API/permission policy is unchanged.
- `activeProfileDrawer` owns patient/guardian/staff selection. `activeDrawer`
  retains business-task state, so inspecting a profile does not unmount or
  erase a reservation form draft.
- Patient/guardian links use `profile=patient:<id>` / `profile=guardian:<id>`.
  Existing `drawer=patient`, `drawer=guardian`, and reception-profile aliases
  remain accepted and normalize to `profile`. Staff selections remain transient.
- URL hydration waits for both selections before writing profile-only changes
  through Next.js-integrated `history.replaceState`; domain selection and
  unrelated query parameters remain intact when a profile closes.
- The profile host owns non-modal focus, close/Escape, and opener restoration.
  Background interaction remains available; nested menu Escape closes only the
  menu. Existing horizontal scroll locks are retained.
- Profile-origin reception/reservation forms still use the existing side-panel
  placement, preselection, dirty-discard guard, operating-date rules, success
  details, and return to the same profile tab.
- RED: the existing implementation unmounted a filled reservation form on staff
  profile open, ignored a simultaneous `profile` URL target, and lacked the new
  overlay host. An additional RED exposed outside-module detail close retaining
  the side panel.
- GREEN: 41 focused Playwright scenarios passed, including six new drawer
  regressions, profile-origin reception/reservation flows, staff work/permission
  behavior, customer selection, editing, nested Escape, 200% zoom, and avatar
  source contracts. Three shell navigation/reload checks also passed.
- Local lint (five pre-existing script warnings), TypeScript, production build
  (existing NFT trace warning), docs, Korean UX copy, secrets, and diff checks
  passed. Final candidate Release Check/Preview/Production evidence belongs to
  the attached PR and delivery record.
- Wider sampled failures also reproduce on untouched `origin/main`: customer
  column resize, chart vital editing permission, chart consultation table
  header count, dispensing title fixture, reception readback fixture, and
  workspace-tab history navigation. These remain outside this placement change;
  the complete repository browser suite is not claimed green.
