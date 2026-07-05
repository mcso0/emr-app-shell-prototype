---
id: "HOME-PR-013"
status: "implemented"
area: "home"
priority: "P0"
target_pr: "User request / Browser Comment 1 command search"
source_docs:
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/engineering/architecture/mock-live-boundary-map.md"
  - "docs/product/demo-data/clinic-start-state-and-demo-operations-v1.md"
  - "docs/engineering/current-status.md"
dependencies:
  - "HOME-PR-011"
updated: "2026-07-05"
---

# Global Command DB-Backed Search v1

## Goal

Connect the global command palette search input to a workspace-scoped server/API read path so Cheongdam seeded patient and reception data can appear without reintroducing legacy Sales Demo fixtures.

## Scope

- Add `GET /api/workspaces/[workspaceId]/command/search?query=&filter=`.
- Reuse the existing reception patient/guardian lookup gateway for patient and guardian results.
- Reuse the reception queue reader for today's appointment and encounter results.
- Keep quick actions immediately visible in the palette.
- Add loading, empty, error, partial-source, and permission-source UI states.
- Keep `clair-demo` mock fallback limited to explicit demo/mock identity.
- Keep Cheongdam/prepared-clinic search mockless for legacy fixture data.

## Out Of Scope

- Chart, billing, lab, imaging, dispensing, and treatment global search.
- New destructive DB operations, remote Supabase mutation, production deploy, or real data import.
- Replacing reception lookup or queue source contracts.
- Persistent command history, personalization, or saved searches.

## Done Criteria

- Typing a valid search term in the global command palette calls the command search API.
- Cheongdam can render API-backed patient/guardian search results.
- Legacy `patient-kong` and old Sales Demo daily work do not appear in Cheongdam command search.
- Permission denial and source read errors do not render as a false empty state.
- Result clicks navigate to the existing reception drawer URL contracts.
- Focused server/API/UI coverage exists.

## Implementation Result

- Added command search response types and server core under `src/features/command/`.
- Added the command search route under `src/app/api/workspaces/[workspaceId]/command/search/route.ts`.
- Updated `src/shell/global-command-palette.tsx` to fetch API results with debounce, abort stale requests, preserve quick actions, and merge live lookup profiles before navigation.
- Updated Cheongdam shell regression expectations from "no search result ever" to "no legacy fixture result, API-backed seeded result allowed."

## Verification

- `npx playwright test tests/command-search-server.spec.ts --reporter=line`
- `npx playwright test tests/app-shell.spec.ts -g "global command palette" --reporter=line`
- `npx playwright test tests/demo-reality-start-state.spec.ts -g "Cheongdam shell search" --reporter=line`
- `npx tsc --noEmit --pretty false --incremental false`
- `npm run lint -- src/features/command/command-search.ts src/features/command/server-command-search-core.ts src/app/api/workspaces/[workspaceId]/command/search/route.ts src/shell/global-command-palette.tsx tests/command-search-server.spec.ts tests/app-shell.spec.ts tests/demo-reality-start-state.spec.ts`
- `npm run docs:check`

### 2026-07-05 Result

- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/command-search-server.spec.ts --reporter=line`.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global command palette" --reporter=line`.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/demo-reality-start-state.spec.ts -g "Cheongdam shell search" --reporter=line`.
- Passed: `npx tsc --noEmit --pretty false --incremental false`.
- Passed: target `npm run lint`.
- Passed: `npm run docs:check`.
- Passed: `git diff --check`.
