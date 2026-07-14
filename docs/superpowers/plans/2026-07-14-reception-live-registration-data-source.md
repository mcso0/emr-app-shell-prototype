# Reception Live Registration Data Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure both reception registration modes use the active workspace's API-backed guardian and patient records, persist through the live registration API, and never submit bundled demo identifiers to Supabase.

**Architecture:** Keep the existing registration route and Supabase RPC as the authoritative write boundary. Change the registration modal's existing-guardian source from the global demo-seeded client store to the workspace-scoped patient/guardian lookup API, with synthetic aliases disabled for this flow. Keep the client store only as an immediate post-success UI cache. Add a Supabase gateway guard so a non-UUID existing guardian ID is rejected before the RPC call.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase RPC, Playwright.

## Global Constraints

- Do not add a migration, dependency, or new registration endpoint.
- Do not change unrelated reception behavior or the shared demo-mode fallback.
- Keep server-side registration validation authoritative for duplicate phone and microchip checks.
- Preserve modal drafts on server validation errors and cover loading, empty, and error states.
- Use the clean worktree branch `codex/reception-live-registration-sources` only.
- Treat `main` merge as a production deployment: finish PR checks, prepare exact commit and rollback evidence, then stop for explicit approval.

---

## Task 1: Lock the server boundaries with failing tests

**Files:**
- Modify: `tests/reception-patient-guardian-registration-server.spec.ts`
- Modify: `tests/reception-patient-guardian-lookup-server.spec.ts`

- [x] Add a test proving the Supabase registration gateway rejects a non-UUID existing guardian ID without invoking the RPC.
- [x] Add a test proving lookup can disable staging synthetic aliases and performs only the exact workspace query.
- [x] Run both focused server suites and confirm the new tests fail for the intended missing behavior.

## Task 2: Implement exact lookup and registration gateway guards

**Files:**
- Modify: `src/features/reception/server-patient-guardian-registration-core.ts`
- Modify: `src/features/reception/server-patient-guardian-lookup-core.ts`
- Modify: `src/app/api/workspaces/[workspaceId]/reception/patient-guardian-lookup/route.ts`

- [x] Add the Supabase-only UUID guard for `existing_guardian_patient` registration.
- [x] Extend lookup gateway input with an optional synthetic-alias flag, defaulting to current behavior for existing consumers.
- [x] Read the route query flag and pass it through to the lookup core.
- [x] Run the focused server suites and confirm they pass.

## Task 3: Lock the modal's live data source with failing UI tests

**Files:**
- Modify: `tests/reception.spec.ts`

- [x] Add a production-like workspace test whose lookup response contains a real UUID guardian and verify that exact UUID is submitted.
- [x] Assert that bundled demo guardians are absent and the lookup request disables synthetic aliases.
- [x] Add coverage proving bundled demo phone and microchip values do not block new registration before the server responds.
- [x] Update duplicate behavior coverage so the server remains authoritative while the modal preserves the user's draft.
- [x] Run the focused UI tests and confirm the new assertions fail for the intended global-store dependency.

## Task 4: Replace modal demo reads with workspace lookup data

**Files:**
- Modify: `src/features/reception/profile-drawer.tsx`

- [x] Load workspace-scoped patient/guardian lookup records when the existing-guardian step is active.
- [x] Derive guardian search results, linked-patient summaries, and duplicate-name advisory data only from that response.
- [x] Add debounced search cancellation plus loading, empty, and retryable error states.
- [x] Remove client duplicate phone and microchip checks that read bundled store records; surface authoritative API conflicts without clearing the draft.
- [x] Keep successful registration application to the client store for immediate UI refresh.
- [x] Run the focused registration UI tests and confirm they pass.

## Task 5: Verify behavior and update durable records

**Files:**
- Modify: `docs/work/reception/RECEPTION-LIVE-PR-005-patient-guardian-registration-write.md`
- Add: `docs/completed/reception/2026-07-14-reception-live-registration-data-source-report.html`

- [x] Run focused server and UI suites for both registration modes.
- [x] Run lint and production build; classify any unrelated baseline failures with evidence.
- [x] Confirm no live QA rows remain and no secret or real patient data appears in changes.
- [x] Record root cause, architectural correction, checks, and remaining risks in the work item and Korean HTML report.
- [x] Review the final diff against `origin/main` for scope isolation.

## Task 6: Publish through the production gate

- [ ] Commit the verified change on `codex/reception-live-registration-sources`.
- [ ] Push the branch and create a ready pull request.
- [ ] Wait for required GitHub/Vercel checks and resolve only in-scope failures.
- [ ] Prepare the production approval packet with the exact commit SHA, check evidence, fixed staging URL, rollback candidate, and stop condition.
- [ ] Stop for explicit approval; after approval, merge the PR into `origin/main` and verify the production deployment.
