---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-139"
linear_project: "00 UI 시스템 인벤토리 및 리팩토링 기준"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/qa/2026-05-10-ui-consistency-audit.md"
---

# UI Refactor Operating Model

This document defines the operating model for the `[UI/UX] 화면 컴포넌트 오딧 및 리팩토링` Linear initiative. It is intentionally agent-facing and concise. Representative-facing summaries, review requests, and decisions should be written in Korean in Linear comments and completion reports.

## Purpose

The UI/UX refactor initiative exists to improve the maintainability and visible quality of the existing CLAiR EMR frontend. It is not a new feature initiative and not a live persistence or backend transition initiative.

The program should make the current EMR workspaces easier to maintain by reducing UI duplication, clarifying component ownership, documenting intentional local exceptions, and verifying that dense operational screens remain readable, accessible, and stable across viewports.

## Scope

Included work:

- design system rules, component boundaries, styling consistency, layout density, interaction quality, accessibility, responsive behavior, and visual QA
- evidence-based audits of hardcoded layout values, repeated local UI patterns, oversized feature files, token drift, table/form/dialog/drawer duplication, status badge variation, and feedback UI variation
- scoped frontend refactors that preserve current session-only behavior and product workflow semantics
- Korean completion reports for meaningful Linear issue work

Explicitly excluded work:

- DB schema, migrations, Supabase, RLS, live persistence, and server-side permission enforcement
- payment, email, KakaoTalk, PACS, device integrations, production deploy, or external integration work
- verified auth/session architecture changes
- role or permission policy changes
- product workflow, clinical meaning, billing calculation policy, or data contract changes
- broad redesign without a screen reference, product decision, or scoped issue

## Execution Sequence

Run the initiative in this order:

1. Baseline inventory: define program rules and identify current UI debt categories before changing screen code.
2. Shared component rules: decide when UI belongs in `src/components/ui/*`, `src/components/emr/*`, feature-local components, or local constants.
3. Screen-level refactors: work through projects `01` to `08` in Linear title order, preserving behavior and documenting intentional local UI.
4. Visual QA gate: use project `09` to confirm responsive overflow, text clipping, keyboard/focus behavior, dense table readability, tooltip/aria quality, and cross-screen consistency.

## Project Order

Follow Linear project numbers in ascending order:

- `00` UI System Inventory & Refactor Rules
- `01` Chart
- `02` Dispensing/Treatment
- `03` Lab/Imaging
- `04` Home
- `05` Reception/Billing/Customer
- `06` Admin/Inpatient
- `07` Login/Profile/Workspace
- `08` App Shell and Global Systems
- `09` Visual QA & Interaction Quality Gate

Inside each project, follow milestone order first, then issue title prefix order.

## Issue Start Checklist

Before starting any issue:

- read the Linear issue Goal, Tasks, Out of Scope, Done Criteria, Verification, and Final Report requirements
- move the issue to `In Progress` only after scope is clear
- confirm the task does not introduce DB, Supabase, RLS, live persistence, server enforcement, payment, email, deploy, or role/permission policy changes
- read the smallest relevant repo docs and source files
- for Next.js application code changes, read the relevant `node_modules/next/dist/docs/` guide first
- preserve user-owned dirty worktree changes

## Refactor Rules

Prefer existing local patterns before adding abstraction.

Promote UI to `src/components/emr/*` only when the pattern is stable across multiple EMR screens, carries EMR-specific semantics, and reduces meaningful duplication.

Use `src/components/ui/*` directly or through a thin EMR wrapper when the behavior is generic shadcn/ui behavior and no EMR-specific semantics are needed.

Keep UI feature-local when it is tied to one workflow, one screen-specific data shape, or one product decision that would make a shared abstraction vague.

Avoid new shared abstractions when they only move markup without improving clarity, when they hide clinical or billing meaning, or when they would force unrelated screens into one API.

Document intentional local exceptions in the issue result when fixed widths, dense table constraints, local status maps, or workflow-specific dialogs remain.

## Verification Baseline

Use the narrowest useful command set for each issue, expanding when shared components or shell behavior are touched.

Minimum useful verification categories:

- lint and typecheck for code changes
- focused Playwright tests for touched screens or shared shell behavior
- visual/browser QA for substantial UI changes, including desktop and mobile-width overflow checks
- keyboard/focus checks for dialog, drawer, popover, command palette, tab, and icon-button changes
- documentation checks when doc paths or links change

For planning-only or docs-only issues, verify the relevant Linear initiative/project context and repo source-of-truth boundaries instead of running frontend tests unnecessarily.

## Reporting Rules

Agent-facing issue content, technical plans, handoff notes, and durable operating rules should be written in English.

Seungwook-facing summaries, review requests, decisions needed, and final result reviews should be written in Korean.

Meaningful Linear issue work should produce a concise Korean HTML report under `docs/completed/<area>/`.

Move completed issue work to `Human Review`, not `Done`, unless Seungwook explicitly accepts or requests `Done`.

## Known Cleanup Candidates

- Large UI files listed in the initiative brief remain primary audit targets: `src/features/reception/profile-drawer.tsx`, `src/features/chart/module.tsx`, and `src/features/reception/module.tsx`.
- App Shell project `08` currently has one active `08-01` issue (`DEN-136`) for GNB/Nav Rail optimization. The duplicate-looking App Shell `08-01` concern should be rechecked before project `08` starts; no active duplicate `08-01` issue was found during DEN-139 verification.
- Project `08` issue creation order does not match title order, so agents must sort by title prefix, not creation date.
