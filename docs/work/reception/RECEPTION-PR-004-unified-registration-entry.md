---
id: "RECEPTION-PR-004"
status: "done"
area: "reception"
priority: "P1"
target_pr: "PR 4"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
  - "docs/design/screens/reception/planning/unified-registration-entry.md"
dependencies:
  - "RECEPTION-PR-003"
updated: "2026-07-08"
---

# Reception Unified Registration Entry

## Goal

접수/예약 toolbar의 환자/보호자 등록 진입점을 `환자/보호자 등록` 하나로 통합하고, 등록 케이스 선택 후 신규 보호자+환자 또는 기존 보호자+신규 환자를 최종 확인에서 commit하는 session-only MVP flow를 제공한다.

## PR Creation Gate

- Goal: branch-first patient/guardian registration with final confirmation before commit.
- PR size: one reception UX PR including the selected Epic 1-3 MVP simulation scope.
- Scope: unified registration entry, branch-first guardian/patient registration, local draft confirmation, patient age/birthdate and mix breed UX, smart walk-in check-in purpose chips, revisit auto-check, KakaoTalk send simulation, focused tests, docs.
- Out of scope: live DB/API persistence, tablet/e-sign provider, KakaoTalk provider, full breed catalog, calendar drag-and-drop, appointment mutation persistence.
- Done criteria: toolbar removes `환자 등록`/`보호자 등록`, `환자/보호자 등록` opens case selection, global command registration opens the same dialog from any module, final confirmation commits only after review, duplicate microchip is blocked, duplicate patient name warning appears, permission/server failures preserve the draft, success toast provides patient detail and check-in actions, check-in message simulation is test-visible.
- Source docs: unified registration planning doc, reception UX flow, current status.
- Verification: focused lint, TypeScript, reception Playwright suite, docs check.
- Status/dependencies: done; builds on registration quality UX.
- Duplicate check: prior reception work covered standalone registration quality and walk-in check-in, not unified branch-first registration.

## Verification

- `npm run lint -- src/features/reception/module.tsx src/features/reception/profile-drawer.tsx src/features/reception/patient-profile-store.ts src/features/reception/store.ts tests/reception.spec.ts`
- `npx tsc --noEmit`
- `npx playwright test tests/reception.spec.ts --reporter=line`
- `npm run docs:check`

## Follow-up Notes

- 2026-07-05: Browser review follow-up connected the global command palette `환자/보호자 등록` action to the same branch-first registration dialog used by the reception/customer toolbar entry. The action now opens registration from any workspace module instead of only navigating to reception. Focused verification: `npm run lint -- src/shell/global-command-palette.tsx src/features/reception/profile-drawer.tsx src/shell/app-shell.tsx tests/app-shell.spec.ts`, `npx tsc --noEmit`, and `npx playwright test tests/app-shell.spec.ts -g "global command palette" --reporter=line`.
- 2026-07-05: Browser review follow-up also clarified exception cases for the global command registration entry. The plan now covers non-reception module launch, command palette handoff, dirty draft preservation, required-field/date/age validation, duplicate guardian phone, missing existing guardian selection, duplicate patient signals, permission/server failures, and success-toast follow-up behavior.
- 2026-07-08: CDS V2 registration dialog follow-up aligned the guardian memo/signature rows to the same 128px label and 268px control column as the other fields, switched placeholder label markers to semantic CDS icons, and locked the registration form/confirm shell to the Figma frame heights with viewport fallback. Focused verification: `npm run lint -- src/components/emr/dialog-shell.tsx src/components/emr/registration-dialog.tsx src/features/reception/profile-drawer.tsx tests/reception.spec.ts`, `npx tsc --noEmit`, and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/reception.spec.ts -g "guardian registration dialog aligns|patient guardian registration creates|server-backed patient guardian registration|links an existing guardian|registration uses CDS V2" --reporter=line`.
- 2026-07-08: Browser review follow-up matched the shared registration dialog title to the Figma typography value `Pretendard / 16px / 24px / 600 / 0 tracking` and moved the shared dialog close affordance to an absolute `10px` top/right position. Focused verification: `npm run lint -- src/components/emr/dialog-shell.tsx src/components/emr/confirm-dialog-content.tsx tests/reception.spec.ts`, `npx tsc --noEmit`, and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/reception.spec.ts -g "guardian registration dialog aligns" --reporter=line`.
- 2026-07-08: Hotfix removed the `relative` position override from shared EMR dialog wrappers after it displaced Base UI's fixed centered dialog positioning, while keeping the absolute `10px` close affordance. The registration alignment regression now also asserts viewport-centered dialog placement. Focused verification: `npm run lint -- src/components/emr/dialog-shell.tsx src/components/emr/confirm-dialog-content.tsx tests/reception.spec.ts`, `npx tsc --noEmit`, and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3011 npx playwright test tests/reception.spec.ts -g "guardian registration dialog aligns" --reporter=line`.
- 2026-07-08: Browser review follow-up connected guardian address search to Kakao Postcode so the search button fills the postal code and base road address while keeping detail address manual. Focused verification: `npm run lint -- src/lib/kakao-postcode.ts src/features/reception/use-kakao-address-search.ts src/components/emr/registration-dialog.tsx src/features/reception/profile-drawer.tsx tests/reception.spec.ts`, `npx tsc --noEmit`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/reception.spec.ts -g "server-backed patient guardian registration sends minimal reception payload" --reporter=line`, `npm run docs:check`, and `npm run build`.
