---
id: "PWA-PR-001"
status: "done"
area: "pwa"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md"
  - "node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md"
  - "node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md"
dependencies: []
updated: "2026-05-10"
---

# PWA Installable App Shell

## Goal

Make the CLAiR EMR prototype installable as a PWA shell without adding offline EMR data behavior.

## PR Gate

- Goal: browsers and tablets can recognize CLAiR EMR as an installable standalone app.
- PR-sized scope: App Router manifest, PWA metadata, app icons, focused manifest smoke coverage, and status docs.
- Out of scope: service worker registration, offline EMR data cache, push notifications, background sync, live persistence, DB/API/auth changes.
- Done criteria: manifest exposes install metadata and icons, `/login` remains the PWA start URL, and no offline support is implied.
- Source docs: current status and relevant Next.js PWA/manifest/viewport docs.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, focused Playwright manifest smoke test.
- Status/dependencies: done; no dependencies.
- Duplicate check: no existing PWA work item existed in `docs/work/index.md` or inbox.

## Scope

- Add `src/app/manifest.ts` with CLAiR EMR install metadata.
- Add fixed-color PWA icon source SVGs and generated PNG assets under `public/`.
- Add root metadata and viewport theme color for install and standalone browser chrome.
- Add focused Playwright coverage for the manifest route and login start page.
- Update current status to record install shell support and offline exclusion.

## Out Of Scope

- Service worker registration.
- Offline workspace or encounter access.
- Caching patient, guardian, order, invoice, auth, or audit data.
- Push notifications or background sync.
- Native app packaging or app store distribution.

## Done When

- `/manifest.webmanifest` returns CLAiR EMR metadata with `display: standalone`.
- Manifest start URL is `/login`.
- Manifest includes 192x192, 512x512, and maskable 512x512 PNG icons.
- `/login` still renders the role-based MVP login entry.
- Documentation states that offline EMR data support is not part of this PR.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/app-shell.spec.ts --grep "PWA manifest" --reporter=line`

## Completion Notes

Completed on 2026-05-10.

- Added the App Router manifest route for CLAiR EMR.
- Added generated install icons using the existing CLAiR logo mark and primary blue.
- Added root metadata, Apple web app metadata, and a `#E9ECF2` viewport theme color to match the top app bar.
- Kept service worker, offline data support, push notifications, and background sync out of scope.
