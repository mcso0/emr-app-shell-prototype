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
updated: "2026-07-24"
---

# Patient and Guardian Profile Side Panel

## Goal

Implement the CDS V2 patient and guardian profile right-side panel from Figma with a measured 380 x 1105 visual contract while preserving the existing profile read/edit and navigation behavior. Route the profiles through the same shared workspace right-panel slot as the staff profile so the panel reserves layout space instead of covering workspace content.

## Scope

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

## Done Criteria

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
