---
id: "HOME-PR-001"
status: "done"
area: "home"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/reference-screen-index.md"
dependencies: []
updated: "2026-05-09"
---

# Role-Based Command Home Foundation

## Goal

Replace the existing Sales Demo launcher default home with a role-based hospital command home on the existing `/w/[workspaceId]/home` route.

## PR Gate

- Goal: 홈에서 역할별 내 업무, 병원 흐름, 알림/예외, 주요 위젯을 한 번에 스캔할 수 있게 한다.
- PR-sized scope: home feature module, typed home data model, role preset config, isolated mock data, existing registry wiring, focused Playwright coverage, docs/status updates.
- Out of scope: live DB/API connection, real-time socket, drag/drop personalization, server-side permission enforcement, hospital threshold settings, hospital-admin Order 세트.
- Done criteria: `/w/clair-demo/home` renders the role command home, role presets change by mock auth role, and the former Sales Demo launcher remains available at `?view=demo`.
- Source docs: current MVP status, reference screen index, chat-approved role-based command home plan.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`, browser visual check.
- Status/dependencies: done; no live DB/API dependency.
- Duplicate check: no existing home work item in `docs/work/index.md` or `docs/work/home/`.

## Scope

- Add `src/features/home/` with home types, role presets, mock data, componentized panels, and the home module.
- Wire the existing home registry entry to `HomeContent` without creating a new route.
- Preserve the Sales Demo launcher under `/w/clair-demo/home?view=demo`.
- Add Playwright coverage for the default home, role mapping, mobile readability, and preserved demo launcher.

## Done When

- The existing 홈 route renders a command-center layout by default.
- Common sections are visible for every role: command header, My Work, Hospital Flow, Alerts & Exceptions.
- Role-specific widgets differ for `front_desk`, `vet`, `nurse`, `billing_admin`, and `hospital_admin`.
- Mock data is isolated from the component tree and can later be replaced by API data.
- Verification passes or any failure is recorded.

## Handoff Notes

This is a session-only foundation. The UI uses existing components and Clair/shadcn design tokens; no home reference image exists, so do not claim pixel-level alignment.

Completed on 2026-05-09. Closeout: `docs/completed/home/2026-05-09-role-command-home-foundation.md`.
