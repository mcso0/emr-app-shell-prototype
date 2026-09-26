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
updated: "2026-09-27"
---

# Patient History Aside Consistency

## Goal

Use the chart aside's 280px frame, 48px header, 16px inner padding, date groups, timeline cards, and scroll fade for lab, imaging, and one combined dispensing/treatment history panel.

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

- The three panels match the chart reference for header, padding, date group spacing, card structure, hover, and scroll fade.
- Patient history does not include another patient's or an unrelated fixture's records.
- Dates and statuses come from persisted read models; missing assignee identity is explicit.
- Focused server and UI checks, static checks, preview verification, and release gates pass.

## Local Verification

- Chart, lab, imaging, and dispensing/treatment asides render a 280px frame, 48px header, and 16px horizontal padding in the same browser test.
- The combined panel shows patient order titles and filters its cards through `전체/조제/처치`; the patient-scoped server read excludes another patient's work items.
- Follow-up: lab, imaging, and dispensing/treatment history titles now use the same nonempty snapshot-name priority as their live order views. The focused Cheongdam browser cases pass with `orderDisplayName` absent and a different persisted name field present; dispensing no longer shows `오더명 없음` for that case. Frozen snapshots and the permission-checked read boundary are unchanged.
- The lab/imaging and dispensing/treatment Playwright files passed 26 of 27 tests; a subsequent chart-frame comparison also passed. The remaining imaging `판독완료` transition assertion also fails at the same point on an untouched `origin/main` archive and is outside this history aside change.
- Local secret scan, docs check, lint, typecheck, and production build passed. Preview and exact release checks remain release gates.
