---
id: "RECEPTION-PR-020"
type: "Work Item"
title: "Patient-profile reception and reservation entry"
description: "Start an existing reception or reservation flow from a patient profile without leaving the current workspace module."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "patient-profile"
  - "right-panel"
source_docs:
  - "docs/product/features/reception-appointment-spec.md"
dependencies:
  - "RECEPTION-LIVE-PR-004"
  - "RECEPTION-LIVE-PR-006"
updated: "2026-09-29"
---

# Patient-Profile Reception And Reservation Entry

## Goal

Let staff begin a walk-in reception or reservation from the patient profile
while preserving the current module, patient context, and right-panel task
position.

## Scope

- Replace the patient-profile `접수/예약` action with a patient-only menu for
  `접수하기` and `예약하기`.
- Reuse the existing live reception and reservation forms in the workspace
  right-panel slot, preselected with the patient and primary guardian.
- Return a clean cancellation to the same patient profile tab.
- Confirm before discarding edited form content and retain the draft when the
  employee chooses to continue.
- Show the created reception or reservation detail in the same panel after a
  successful write; preserve the form and draft after a failed write.
- Keep profile-origin panel state transient so it does not replace the
  URL-owned `profile=patient:<id>` selection or force module navigation.
- Capture the workspace operating date when the profile action starts so a
  stale Reception selection cannot backdate a walk-in or reservation default.
- After a successful write, align Reception state and the current URL to the
  persisted record date and refresh the mounted Chart queue when its scope is
  already that date.
- Use the compact Figma return header only while a profile return target exists:
  65px header, 8px horizontal padding, 24x32 return button, and 16px chevron.

## Out Of Scope

- A new API, database, RLS, permission, or patient/guardian data contract.
- Calendar-slot round trips or a new scheduling surface.
- Duplicate-reception warnings and persistent notification follow-ups.
- Changing the global command palette or reception-module entry semantics.

## Done When

- Both menu choices open the expected preselected existing form in the same
  right-panel slot without changing the module route.
- Profile walk-ins use the captured today date, reservations start from today,
  and explicit calendar-slot dates retain priority.
- The persisted record date owns post-create URL/store scope, and a mounted
  Chart queue refresh shows the new walk-in without relying only on realtime.
- Clean and dirty cancellation return behavior matches the profile-origin
  contract.
- Success and failure preserve the expected detail or draft state.
- Guardian profiles do not expose the patient-only reception menu.
- Focused Playwright coverage, relevant regressions, lint, typecheck, build,
  docs, and secret gates pass for the exact release candidate.

## Verification

- `npx playwright test tests/patient-profile-reception-entry.spec.ts --project=chromium` — 8 passed.
- Focused app-shell, customer-profile, and existing reservation-creation
  regression checks — 3 passed.
- Local browser review — dropdown choices, same-slot form replacement,
  patient/guardian preselection, current-module URL retention, and the dirty
  header-close guard were verified; no browser warning or error was recorded.
- `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`,
  `npm run docs:check`, `npm run security:secrets`, and `git diff --check` —
  passed. Lint retains five unrelated existing warnings, and the build retains
  the existing project-wide NFT trace warning.
- Release Check, preview, staging, and production evidence are recorded against
  the exact committed candidate.

## 2026-09-20 Date And Return-Header Follow-up

- Added RED/GREEN browser coverage for a past Reception date followed by a
  profile walk-in or reservation, persisted-date URL alignment, immediate Chart
  queue refresh, the compact return header, and return behavior after detail.
- Preserved direct Reception entry at the shared 56px header and kept the
  profile-origin date transient until a successful write.
- RED evidence: the source-boundary check selected the stale stored Chart date,
  while browser checks could not find the return action, measured the old 56px
  header, and retained the stale URL date after a persisted-date response.
- GREEN evidence: the combined profile-entry, Chart boundary, and shared-header
  run passed 26/26; the isolated Chart URL/date transition run passed 5/5.
- TypeScript, changed-file ESLint, production build, docs links, Korean UX copy,
  secret scan, and `git diff --check` passed. The build retained the existing
  project-wide NFT trace warning.
- The broad 94-case Chart file was also sampled once: 73 passed and 21 unrelated
  SOAP/Order/history/UI cases failed after the long-running development server
  repeatedly emitted `MaxListenersExceededWarning`. The affected date/queue
  cases passed again on a fresh server; this broad-run caveat remains open for
  release-candidate verification.

## 2026-09-29 Profile Overlay Compatibility

- Patient/guardian/staff profiles now use a separate non-modal overlay host.
  Reception details and reception/reservation creation remain side panels.
- Starting a patient-profile task closes the overlay and retains its return
  target/tab. Clean or confirmed cancellation reopens that profile tab; success
  continues to show the business detail in the side panel.
- Opening a staff profile while a reservation draft is already mounted does
  not replace the business selection or reset input state.
- API, permissions, persistence, operating-date, dirty-discard, and profile
  preselection contracts are unchanged.
