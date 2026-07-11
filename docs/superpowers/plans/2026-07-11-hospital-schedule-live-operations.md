# Hospital Schedule Live Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hospital schedule durable and permission-checked for synthetic local Supabase data while adding reviewable assignment, time-clock, payroll-preview, and in-app notification operations.

**Architecture:** Keep the current client schedule screen as a consumer of a route-backed store. Place all authorization and transactional schedule changes in local-first Supabase RPCs, with server routes resolving an authenticated actor before calling them. Keep assignment deterministic and advisory; payroll is a synthetic preview ledger, never a payment system.

**Tech Stack:** Next.js Route Handlers, TypeScript, Zustand, Supabase Postgres/RLS/RPC, Playwright, local Docker Supabase.

## Global Constraints

- Only local/dev/test synthetic data may be mutated.
- Every new public table enables RLS and has explicit role grants.
- Do not authorize from browser role labels or mutable user metadata.
- Do not auto-apply assignment suggestions or issue payroll payments.

---

### Task 1: Persisted schedule domain and RLS contract

**Files:**
- Create: `supabase/migrations/<generated>_hospital_schedule_operations.sql`
- Create: `docs/engineering/data-model/hospital-schedule-operations.md`
- Test: `tests/hospital-schedule-operations-migration.spec.ts`

- [x] Write migration-shape regression and watch it fail.
- [x] Generate migration with `npx supabase migration new hospital_schedule_operations`.
- [x] Add workspace-scoped tables, indexes, RLS policies, and authenticated RPC grants.
- [x] Validate local-only SQL after review.

### Task 2: Server schedule commands and actual authorization

**Files:**
- Create: `src/features/hospital-admin/schedule/server-schedule-operations.ts`
- Create: `src/app/api/workspaces/[workspaceId]/hospital-admin/schedule/route.ts`
- Test: `tests/hospital-schedule-operations-server.spec.ts`

- [x] Write unauthorized/own-request failing tests.
- [x] Implement actor resolution and RPC gateway with explicit mock fallback.
- [x] Add read, shift mutation, request review, publication, and time-clock command handling.

### Task 3: Assisted assignment, notifications, and payroll preview

**Files:**
- Create: `src/features/hospital-admin/schedule/operations-model.ts`
- Modify: `src/features/hospital-admin/schedule/hospital-schedule-screen.tsx`
- Test: `tests/hospital-schedule-operations-model.spec.ts`

- [x] Write failing tests for ranked assignment candidates and time-clock payroll preview.
- [x] Implement deterministic recommendations and preview calculations.
- [x] Surface persisted status and in-app notification records without autonomous changes.

### Task 4: Route-backed screen and closeout

**Files:**
- Modify: `src/features/hospital-admin/schedule/store.ts`
- Modify: `src/features/hospital-admin/schedule/hospital-schedule-screen.tsx`
- Modify: `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-011-schedule-operations-persistence.md`
- Create: `docs/completed/hospital-admin/2026-07-11-hospital-schedule-live-operations-report.html`

- [ ] Add browser regression for remote Supabase load/clock entry (requires repair of the unrelated local migration chain).
- [x] Connect server states and retain explicit mock-mode messages.
- [ ] Run Storybook and full build after the focused checks.
