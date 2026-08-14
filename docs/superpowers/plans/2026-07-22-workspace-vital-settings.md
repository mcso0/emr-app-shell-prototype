# Workspace Vital Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one workspace-wide vital configuration and apply its enabled order and supported units to hospital admin, reception walk-in, and chart waiting-vital flows.

**Architecture:** A forward-only Supabase migration owns a curated preset catalog, workspace rows, member-read/admin-replace RPCs, audit emission, heart-rate storage, and systolic-only blood pressure. A typed server core and Next.js route expose the contract; one client model/hook supplies defaults, conversion, and shared consumption. The hospital-admin screen owns editing while reception and chart remain canonical-value writers.

**Tech Stack:** Next.js 16 Route Handlers, React 19, TypeScript, Supabase/PostgreSQL, `@dnd-kit/core`, `@dnd-kit/sortable`, Playwright/Vitest runner.

## Global Constraints

- One configuration per workspace; `hospital_settings:view` reads and `hospital_settings:manage` writes.
- Default enabled order is weight, temperature, heart rate, respiratory rate; blood pressure starts available but not included.
- Canonical storage is kg, °C, bpm, rpm, and mmHg; only kg/g and °C/°F are selectable.
- Enabled fields are optional. Disabling never deletes historical measurements.
- Systolic blood pressure is valid alone; diastolic without systolic is invalid.
- Species ranges, alerts, custom vital definitions, and reservation entry are excluded.

---

### Task 1: Shared configuration model and conversion contract

**Files:**
- Create: `src/features/patient-vitals/workspace-vital-settings.ts`
- Test: `tests/workspace-vital-settings-model.spec.ts`

**Interfaces:**
- Produces: `WorkspaceVitalKey`, `WorkspaceVitalPreset`, `WorkspaceVitalSetting`, `WorkspaceVitalSettingsSnapshot`, `defaultWorkspaceVitalSettings`, `parseWorkspaceVitalSettingsSnapshot`, `toCanonicalVitalValue`, `fromCanonicalVitalValue`.

- [ ] Write failing tests for default order, catalog validation, kg/g conversion, °C/°F conversion, fixed-unit behavior, and enabled filtering.
- [ ] Run `npx playwright test tests/workspace-vital-settings-model.spec.ts` and verify failure from the missing module.
- [ ] Implement the typed model with exact keys `weight | temperature | heart_rate | respiratory_rate | blood_pressure` and round-trip-safe conversions.
- [ ] Re-run the focused test and verify zero failures.

### Task 2: Database, permission, and API boundary

**Files:**
- Create: `supabase/migrations/20260722143000_workspace_vital_settings.sql`
- Create: `src/features/hospital-admin/vital-settings/server-workspace-vital-settings-core.ts`
- Create: `src/app/api/workspaces/[workspaceId]/vital-settings/route.ts`
- Test: `tests/workspace-vital-settings-migration.spec.ts`
- Test: `tests/workspace-vital-settings-server.spec.ts`
- Modify: `src/features/patient-vitals/patient-vital-types.ts`
- Modify: `src/features/patient-vitals/server-patient-vital-core.ts`
- Modify: `src/features/patient-vitals/server-patient-vital.ts`
- Modify: `tests/patient-vital-server.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceVitalSettingsSnapshot` and catalog parser from Task 1.
- Produces: `readWorkspaceVitalSettings`, `replaceWorkspaceVitalSettings`, `createSupabaseWorkspaceVitalSettingsGateway`, GET/PUT `/api/workspaces/:workspaceId/vital-settings`.

- [ ] Write failing migration tests for tables, RLS/grants, catalog seeds, default merge, admin replacement, audit event, heart-rate column, and systolic-only constraint.
- [ ] Write failing server tests for member read, manage denial, payload validation, gateway RPC arguments, and mock persistence.
- [ ] Extend patient-vital tests so heart rate is normalized and systolic-only is accepted while diastolic-only is rejected.
- [ ] Run the three focused specs and verify the intended failures.
- [ ] Add the forward-only schema/RPC migration, including canonical catalog validation and wrappers that enrich existing reception/chart read/write RPCs without widening direct table grants.
- [ ] Implement the typed server core and route using server identity plus the DB-loaded workspace permission adapter.
- [ ] Extend patient-vital TypeScript parsing and validation for `heartRateBpm` and systolic-only blood pressure.
- [ ] Re-run the three focused specs and verify zero failures.

### Task 3: Approved hospital-admin V3 screen

**Files:**
- Create: `src/features/hospital-admin/vital-settings/workspace-vital-settings-screen.tsx`
- Modify: `src/features/hospital-admin/module.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/hospital-admin.spec.ts`

**Interfaces:**
- Consumes: GET/PUT route and shared snapshot from Tasks 1-2.
- Produces: `WorkspaceVitalSettingsScreen({ workspaceId })`.

- [ ] Replace the old static-screen expectation with failing assertions for the 920px page, single `추가` action, disabled header `초기화`/`변경사항 저장`, dirty activation, unit selection, switch, and confirmation dialog.
- [ ] Install pinned `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` packages.
- [ ] Implement the screen with pointer and keyboard sensors, a dedicated grip activator, preset-add dialog, last-saved reset, permission/read/error states, and save confirmation.
- [ ] Replace only the `vitals` branch in `HospitalAdminModuleContent`; retain the space-time concept screen.
- [ ] Run the focused hospital-admin test and verify zero failures.

### Task 4: Reception and chart consumers

**Files:**
- Modify: `src/features/reception/module.tsx`
- Modify: `src/features/reception/walk-in-encounter.ts`
- Modify: `src/features/reception/server-walk-in-encounter-core.ts`
- Modify: `src/features/chart/preconsultation-context.ts`
- Modify: `src/features/chart/server-preconsultation-context-core.ts`
- Modify: `src/features/chart/preconsultation-context-panel.tsx`
- Modify: `tests/reception-walk-in-encounter-server.spec.ts`
- Modify: `tests/reception.spec.ts`
- Modify: `tests/chart-preconsultation-context-server.spec.ts`
- Modify: `tests/chart.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceVitalSettingsSnapshot`, unit conversion helpers, and `heartRateBpm` canonical values.
- Produces: settings-driven optional input fields and settings-driven current/prior chart columns.

- [ ] Add failing server/UI tests for heart-rate payloads, systolic-only blood pressure, configured ordering, disabled-field hiding, and g/°F conversion.
- [ ] Run the focused reception/chart specs and verify intended failures.
- [ ] Load workspace settings with safe default fallback in both screens.
- [ ] Render enabled fields in saved order, use configured units, convert writes to canonical values, and filter the chart summary without deleting source measurements.
- [ ] Extend reception/chart parsers and display definitions for heart rate and systolic-only blood pressure.
- [ ] Re-run focused reception/chart specs and verify zero failures.

### Task 5: Documentation, closeout, and release verification

**Files:**
- Modify: `docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md`
- Modify: `docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md`
- Modify: `docs/engineering/data-model/patient-vital-measurements.md`
- Modify: `docs/engineering/current-status.md`
- Modify: `docs/work/index.md`
- Modify: `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-018-workspace-vital-settings.md`
- Create: `docs/completed/hospital-admin/2026-07-22-workspace-vital-settings-report.html`

**Interfaces:**
- Consumes: verified behavior and exact release evidence from Tasks 1-4.
- Produces: current product/design/data truth, work status, and CEO-readable closeout.

- [ ] Update canonical docs to replace the obsolete normal-range concept with the approved preset/configuration contract.
- [ ] Record focused verification and known exclusions in the work item and Korean HTML report.
- [ ] Run focused specs, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run docs:check`, `npm run security:secrets`, and `git diff --check`.
- [ ] Review the final diff against every global constraint and remove unrelated changes.
- [ ] Commit, push, create the PR, wait for Preview/Release Check evidence, then prepare the exact `main` merge approval packet with SHA, smoke path, rollback candidate, and stop condition.
