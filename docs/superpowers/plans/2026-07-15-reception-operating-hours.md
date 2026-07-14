# Reception Operating Hours Integration Plan

> **Execution:** Implement task-by-task with test-driven development and fresh verification before completion.

**Goal:** Make hospital-admin operating hours the authoritative source for reception scheduling and calendar density.

**Architecture:** Store weekly hours and date exceptions per workspace, resolve one effective schedule for a local date and timezone, expose it through server-owned settings/calendar routes, and reuse the same contract in appointment/walk-in validation and the client time scale. Database RPCs remain the authoritative enforcement boundary; TypeScript mirrors the resolver for mock mode and UI rendering.

**Constraints:** No new dependency, no remote migration/deployment, no unrelated contact-profile persistence, and no automatic mutation of existing appointments.

## Tasks

- [x] Add RED migration/resolver tests, then implement tables, RLS/grants, audit, resolver, admin replace RPC, and writer enforcement.
- [x] Add RED settings API tests, then implement GET/PUT core, gateways, route, authorization, and future-conflict response.
- [x] Extend the calendar response and appointment/walk-in server contracts with effective operating schedules.
- [x] Wire the hospital settings UI and implement piecewise calendar scaling plus the 36px/8px compact-card contract.
- [x] Run focused integration tests, TypeScript, lint, docs checks, update source docs/status, and write closeout.
