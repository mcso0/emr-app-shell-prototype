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
updated: "2026-09-30"
---

# Patient and Guardian Profile Side Panel

## Goal

Implement the CDS V2 patient and guardian profile right-side panel from Figma with a measured 380 x 1105 visual contract while preserving the existing profile read/edit and navigation behavior. Route the profiles through the same shared workspace right-panel slot as the staff profile so the panel reserves layout space instead of covering workspace content.

## Original Figma Implementation Scope

- Replace the duplicated shell and feature headers with the Figma-owned 151 px identity header and four-tab navigation.
- Render patient and guardian information, linked identities, upcoming reservations, encounter history, and billing summaries from the existing mock/read-model graph.
- Preserve profile PATCH save, linked patient/guardian navigation, drawer close, URL selection, and workspace reuse.
- Route the treatment preconsultation `환자 정보` and `보호자 정보` actions to the same shared profile right-panel slot.
- Add operating-date grouping for encounter history, including missing or invalid dates.
- Add invoice/payment hierarchy to billing cards while retaining the Figma card surface.
- Verify the source viewport against the provided Figma captures with pixel comparison and record explicit masks for the two approved content exceptions.
- Reuse the shared `WorkspaceFrame` right-panel column with the staff-profile 380 px width, 10 px gap, detached surface, and mobile full-width behavior.

## Out Of Scope

- New or changed API, database, Supabase migration, RLS, or permission policy.
- New avatar persistence or Patient/Guardian avatar fields.
- Production activity-tab read projections.
- Shared design-system token changes, staff-profile content changes, or unrelated drawer placement changes.

## Original Figma Implementation Criteria

- Patient and guardian drawers use a 380 px feature-owned panel with the Figma header, tabs, spacing, typography, radii, and colors.
- Information, reservation, history, billing, filled, empty, long-content, edit, and keyboard-close paths are usable.
- Existing profile save and linked-identity navigation continue to work.
- Patient and guardian profiles render in `workspace-right-panel`; no absolute `workspace-drawer` overlays the customer/reception content.
- Treatment preconsultation profile actions open the selected encounter's patient or primary guardian in the shared panel instead of the retired chart-specific information sheet.
- Opening the panel reduces the main workspace width and preserves the same right-panel position when navigating between patient and guardian profiles.
- Focused lint, typecheck, Playwright, Storybook build, and pixel-comparison evidence are recorded.
- Pixel differences are iterated to the approved threshold; any remaining mismatch is reported, not described as exact.

## Verification

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


## 2026-09-30 Restore Original Right-Side Panel

- 승욱 clarified that the complete profile-drawer task must be undone:
  restore the original 우측 사이드 패널, before PR #867, not only its later
  viewport/body/frame placement changes.
- Selectively reverse PR #876 (`06adb765`), PR #872 (`34b541a7`), and
  PR #867 (`9aad7a92`) on `origin/main` (`ad7d12b6`). The original comparison
  target is `c050ef4b`; unrelated later changes remain in place.
- Patient, guardian, and staff profiles again use the shared workspace right
  column. Opening a profile reserves main-content width and only one right
  task/profile is active at a time. Remove the independent profile Sheet,
  `activeProfileDrawer`, profile-only URL state, and frame clipping viewport.
- Restore existing drawer URL selection, close/Escape/focus, profile content
  and edits, linked patient/guardian navigation, and profile-origin reception
  and reservation flows. The independent overlay coexistence/draft behavior
  added by PR #867 is intentionally removed with that task.
- Existing API, database, RLS, role policy, and synthetic data are unchanged.
  Reception detail status cleanup (#875), chart highlight icon (#877), and
  reception vital display permission/read behavior (#878) are preserved.
- Earlier overlay/body-alignment/frame-containment delivery evidence is kept
  in PR #867, #872, and #876; those placement decisions are superseded.
- Local verification: 32 distinct focused Chromium scenarios passed across
  final runs (24 staff/profile-origin flows and 8 profile layout/content checks).
  Two cancellation tests retain exact locators to avoid matching the newer
  SOAP toolbar's 실행 취소/취소선 buttons; assertions and product behavior are intact.
- The one wider chart-context test fails on denied 오늘 바이탈 수정 after both
  profile navigation checks. The identical failure reproduced on clean
  `ad7d12b6` main and is outside this restoration; no permission was weakened.
- All 3 existing shared Sheet stories passed. Local synthetic browser proof
  shows a 380 px right-panel column, 10 px gap, reduced main-content width,
  and zero independent profile overlay hosts.
- Local lint (same 5 existing script warnings), typecheck, production build
  (existing NFT trace warning), docs, copy, secrets, and diff checks passed.
  Remote main/Production restoration is pending release authorization;
  exact candidate Release Check, Ready Preview, and authenticated Production
  smoke will be completed as part of an approved delivery.


## 2026-09-30 Shared Profile Presentation

승욱 approved the investigation and common-component plan, then explicitly
requested implementation: “오케이 좋아. 수정에 들어가자.” This scope covers
local implementation and non-destructive validation. Production delivery is
not part of this approval.

- Base: production source `0bca112ab30a88ca46edcd8a0ef76c8280534ea8`, after
  the original right-side column was restored. Preserve the primary checkout
  WIP; implement in `codex/profile-ui-unification` in an isolated worktree.
- Patient/guardian `ProfileSidePanel` and `StaffOperationalProfileDrawer`
  compose one presentation module, `src/components/emr/profile-panel.tsx`.
  Share header geometry, close target, line tabs, loading skeletons,
  tab feedback, vertical scrolling, and close/Escape focus handling.
- Align the patient/guardian header from 151px to the shared 150px contract.
  Replace profile-local neutral colors with existing semantic aliases.
  Preserve patient/guardian type badges and staff Presence meaning.
- Normalize profile motion in the shell to enter 160ms and exit 120ms with
  existing panel easing; honor reduced motion and preserve the column during
  patient/guardian switches.
- Feature content, live/mock boundaries, API/RLS/role policy, lazy reads,
  cursor pagination, status/avatar saves, relationship navigation, and
  profile-origin reception/reservation draft/return contracts are unchanged.
- Shared and feature Storybook specimens now use the production presentation.
  The current shared presentation supersedes the earlier 151px header and
  fixed staff-tab widths while retaining the historical pixel evidence.

The historical pixel-comparison result above remains an older Figma-specific
measurement; it is not a claim about this intentionally unified UI. The current
shared contract is in [Staff Operational Profile Side Panel V2](../../design/system/staff-operational-profile-drawer.md#shared-patient-guardian-and-user-presentation).


### Local Verification And Acceptance

- 42 unique focused Playwright scenarios passed: the 34-scenario profile UI,
  staff operational profile, patient profile-origin reception/reservation,
  and avatar contract run, plus eight customer/reception/billing consumers.
  Coverage includes normal/reduced motion, 360px layouts, 200% zoom equivalent,
  permission-disabled tabs, overview/section lazy reads, error retry, missing
  versus denied data, one actual vertical scroll viewport, dialog/editor Escape,
  exact opener focus restoration, target switching, edits and dirty draft return.
- 33 tests passed across shared profile, patient/guardian profile, staff header,
  and staff full-panel/content Storybook files. Inspected the actual synthetic
  patient, guardian and staff specimens in the local browser.
- Targeted ESLint, TypeScript, Next production build, Storybook production build,
  docs links, Korean UX copy, secret scan, and whitespace checks passed.
- An additional chart consultation end-to-end scenario fails at the unchanged
  `tests/chart.spec.ts:5633` assertion: expected five vital column headers,
  received six. The exact same failure was reproduced on untouched base
  `0bca112` in a temporary checkout, before profile assertions. Do not claim this
  broad chart scenario passed, and do not change the unrelated vital table here.
- Read-only final implementation review found no additional confirmed regression.
  Local implementation and verification are complete. Human UI acceptance and
  any production delivery remain pending; no commit, push, merge or deployment
  was performed for this change.


### Delivery Authorization

After reviewing the completed local result, 승욱 explicitly authorized commit,
push, PR creation, `origin/main` merge, and deployment: “수정 다했으면 커밋,
푸시, 피알, 오리진-메인에 머지. 배포 승인”. Delivery covers the verified
shared profile UI above, with no external-data, role-policy or database changes.
Rebase onto current `origin/main` (`252bfb25`) while preserving PR #880's
reception calendar drawer placement, then verify the resulting exact candidate.

The release smoke covers `/login` and read-only synthetic/demo patient, guardian,
and user profiles: common header/tabs/loading/scroll, open/close, and profile
switching. Do not edit production patient/member data. The previous Ready
Production rollback candidate is `dpl_EJjPQWVeYbFFU2s9VSuk9HayCT7C` from
`252bfb25af3d6dd62dce3f62ef29400de6a1df46`. Merge only with exact-head
protection after the manual Release Check and automatic Preview are verified.
Stop on candidate drift, failed gates, unexpected Production source, or smoke
failure; rollback mutations require separate authorization.

## Guardian Address Icon Repair (2026-09-30)

- 승욱 approved the scoped fix, commit/push/PR, direct `origin/main` merge, and production deployment in this chat.
- The address map-pin SVG existed and had visible 14 px styling, but its clip rectangle had lost its dimensions during icon normalization and clipped out the entire path.
- Restore the source rectangle to 24 x 24 and regenerate the shared icon. Preserve inner SVG dimensions in the generator so subsequent Figma imports retain clipping and shape geometry. No profile data, API, permission, or layout changes.
- Focused verification: generator import-to-component geometry regression and guardian profile browser clip-region regression; release also requires secrets/docs/UX-copy, lint, typecheck, build, exact-candidate Release Check, Ready preview, and production address-icon smoke.
- Production rollback candidate: current Ready deployment `dpl_3z6bBiGMXveHQGkjjwLPHsVXNcrf`, source `bd321152d1ca4f095ab4c07840cd7cc81ebc9d73`. Stop before merge for failed verification or a changed candidate; verify the synthetic guardian profile after deployment.
