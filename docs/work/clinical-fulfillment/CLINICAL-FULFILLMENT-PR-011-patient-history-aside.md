---
id: "CLINICAL-FULFILLMENT-PR-011"
type: "Work Item"
title: "Patient History Aside Consistency"
description: "Align lab, imaging, and combined dispensing/treatment history panels with the chart history layout."
status: "in_progress"
area: "clinical-fulfillment"
priority: "P1"
tags: [history, lab, imaging, dispensing, treatment, ui]
target_pr: "TBD"
source_docs:
  - "docs/work/chart/CHART-PR-028-history-information-hierarchy.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md"
dependencies: []
updated: "2026-10-12"
---

# Patient History Aside Consistency

## Goal

Use the chart aside's 280px frame, 48px header, 16px inner padding, date groups, timeline cards, and standard list scroll presentation for lab, imaging, and one combined dispensing/treatment history panel. The approved 2026-10-12 presentation follow-up also includes billing.

## Scope

- Read history for the selected patient across visits using the existing workspace and queue permission boundary.
- Keep lab and imaging without tabs. Give the combined dispensing/treatment aside `전체/조제/처치` tabs.
- Show an order or exam title, recorded time, current status, and a resolved assignee. Group multiple orders only when they share a verified task identity and attempt.
- Keep the existing selected-detail navigation and legacy synthetic demo boundaries.

## Out Of Scope

- New database tables, migrations, order mutations, or status transitions.
- Real patient data operations or fixture rows presented as persisted history.
- Additional sort, search, or filter behavior beyond the three category tabs.

## Done When

- The three clinical panels match the chart reference for header, padding, date group spacing, card structure, hover, and list scroll presentation. Billing shares the frame and group layout while retaining its ledger rows.
- Patient history does not include another patient's or an unrelated fixture's records.
- Dates and statuses come from persisted read models; missing assignee identity is explicit.
- Focused server and UI checks, static checks, preview verification, and release gates pass.

## Local Verification

- Chart, lab, imaging, and dispensing/treatment asides render a 280px frame, 48px header, and 16px horizontal padding in the same browser test.
- The combined panel shows patient order titles and filters its cards through `전체/조제/처치`; the patient-scoped server read excludes another patient's work items.
- Follow-up: lab, imaging, and dispensing/treatment history titles now use the same nonempty snapshot-name priority as their live order views. The focused Cheongdam browser cases pass with `orderDisplayName` absent and a different persisted name field present; dispensing no longer shows `오더명 없음` for that case. Frozen snapshots and the permission-checked read boundary are unchanged.
- The lab/imaging and dispensing/treatment Playwright files passed 26 of 27 tests; a subsequent chart-frame comparison also passed. The remaining imaging `판독완료` transition assertion also fails at the same point on an untouched `origin/main` archive and is outside this history aside change.
- Local secret scan, docs check, lint, typecheck, and production build passed. Preview and exact release checks remain release gates.

## 2026-10-12 Group Title Alignment

- Approved local scope: match lab, imaging, dispensing/treatment, and billing group-title calendar, spacing, and chevron direction to the chart. Preserve existing behavior.
- Use the same CDS calendar at 14px, 8px calendar-to-date spacing, 6px date-to-count spacing, and upward expanded chevron. Apply scoped title CSS only; the shared default and chart remain unchanged.
- Keep clinical collapse callbacks and selection/filter/sort state. Billing still passes no toggle callback and its title remains static.
- Source inspection confirms the group title renders provided labels/counts and handles local collapse only. No API request, persistence, server, permission, or database change is required or included. This does not establish remote API health.
- Local PASS: affected-file ESLint, TypeScript, and four browser-backed Storybook cases (lab, imaging, dispensing/treatment collapse and static billing title). The billing story covers title presentation only, not the full checkout flow.
- Rendered lab and static billing title checks confirm a 14px calendar, 8px/6px gaps, and a 180-degree base chevron rotation. Billing remains a `div`, not a toggle button. Internal docs links pass.
- Local implementation only; production deployment and human visual acceptance remain pending.

## 2026-10-12 Shared Panel Presentation

- User approved local implementation and verification of chart-based padding, header, scroll, and group layout across all history asides, preserving screen-specific queries, selection, filters, and footers.
- Extract chart presentation into `history-aside-layout.module.css`; chart, the shared clinical history aside, and billing consume the same scoped classes. Remove duplicate chart/clinical layout CSS and replace chart's inline scroll/list geometry with the shared classes.
- Billing filters retain their 8px spacing in a non-scrolling controls region. Keep billing checkbox selection, custom-date popover, co-guardian option, and selection footer. Clinical tabs, collapse callbacks, chart creation, and the chart's selected-group-open rule remain unchanged.
- Match the actual chart history aside's standard `ScrollArea`; remove the clinical-only viewport fade. Do not change the separate inline diagnosis History scrollbar.
- No API, server, database, permission, route, or data contract changes are part of this follow-up. Other in-progress edits in the checkout are preserved.
- Local PASS: affected-file ESLint, repository TypeScript, docs links, diff whitespace check, five browser-backed Storybook cases, and six focused app browser tests for billing/clinical search, filters, selection, category navigation, and all five history frames. Re-ran the five-screen frame/search case with 600px viewport-height checks; headers and footers stay outside the positive-height list viewport.
- App checks use local mock-auth synthetic fixtures, not authenticated production data. Storybook MCP at port 6006 was unavailable, so the documented local components and browser-backed story runner were used. Screenshots from the app comparison are in `output/playwright/history-search-live-results/`.
- Unrelated mock-session warning: workspace tabs could not be saved remotely and retained the browser session copy. The history tests passed; tab persistence is outside this UI change.
- Local implementation and verification are complete. Production delivery and human acceptance remain separate.


## 2026-10-12 Isolated Release Candidate

- Release branch: `codex/history-aside-alignment`, isolated from `origin/main` `5c55fbfb1785ba3fb09f77c26d5390341a6b4662`. Include only the history presentation, related stories/tests, and owning documentation across 10 files.
- Preserve newer main Storybook coverage; add the long-list and static billing title specimens. Exclude primary-checkout tab reorder, assignment, API/result persistence, migrations, and unrelated work.
- Candidate local PASS: secret scan, docs links, full ESLint, TypeScript, production build, 11 history Storybook cases, and six focused app browser cases including five-screen geometry and 600px-height footer containment. App interaction checks use local synthetic fixtures with mock authentication.
- Production smoke plan: verify deployment source and `/login`; inspect chart, lab, imaging, dispensing/treatment, and billing history layouts read-only using an existing authenticated synthetic workspace session when available. Do not create records, change status, or perform checkout. Report the authentication boundary if the session is unavailable.
- Exact remote Release Check, Ready Preview, and the production approval gate remain required before merge. Retain the previous Ready production deployment as the rollback reference.
