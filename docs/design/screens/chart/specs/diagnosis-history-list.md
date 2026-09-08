---
type: "screen-spec"
title: "History 진단 이력 목록 B안 구현 기준"
description: "Approved diagnosis-chip history layout, disclosure behavior, clinician summary, and design-system reuse contract"
tags: ["chart", "history", "diagnosis", "design-system"]
status: "approved"
last_updated: "2026-09-08"
---

# History 진단 이력 목록 B안 구현 기준

## Decision and Delivery State

The user selected option B (진단 칩 + 펼치기) after interactive HTML review and requested Neutral 100 badges. This document records the approved design direction. The user subsequently approved implementation and production delivery after verification. This release implements the B layout with the actual single primary veterinarian; multi-clinician rendering is deferred because the history projection exposes only one veterinarian. Production completion must be backed by the owning work item.

## Scope

- Change only the diagnosis history list inside the History panel.
- Preserve the existing title and toolbar: History, 진단이력 selector, search, and filter, including current enabled/disabled behavior.
- Do not add a panel footer or visit-count header replacement.
- Preserve encounter selection/navigation, query behavior, data ordering, permissions, and workspace boundaries. No schema/API/security changes are authorized by this visual specification.

## Visit Layout

1. Top row: existing History `ClockIcon` (decorative, `aria-hidden`, existing `size-3` utility) followed by date/time on the left, separated by `--clair-spacing-4`; 차트 보기 right. Vertically center both in the same row.
2. Diagnosis row: show up to three diagnosis chips in original data order; place `+N개 진단` immediately after the last visible chip in the same wrapping flow.
3. Clinician row for this release: left-aligned `담당 이름` from the authoritative primary veterinarian. The reviewed multi-clinician design below is deferred.

Align the date/time group (starting with the clock icon), first chip label, and clinician text to the same left start. Account for the chip's tokenized inline padding and border rather than applying unrelated offsets. Use `--clair-spacing-6` between rows and `--clair-spacing-4` between chips. Preserve compact density and existing panel width/scroll containment.

Use a straight 1px divider between records with `--emr-border-default`. The divider must have no rounded ends or shadow. Do not place a divider after the last record.

## Diagnosis Chips and Disclosure

- Use the existing `Badge` component with `variant="secondary"`; locally compose its background with `var(--clair-color-atomic-neutral-100)`. Keep the border transparent. Do not change the global secondary variant or generated tokens.
- Use existing History text/radius and EMR body typography tokens. Keep long diagnosis names readable with wrapping; do not truncate names inside chips.
- Use existing `Button` with `variant="ghost"` for `+N개 진단` and 접기. Expand within that visit; place 접기 after the final chip. Do not navigate when toggling.
- The expanded disclosure state alone must not create a filled background. Keep `aria-expanded`/`aria-controls`, keyboard operation, and focus indication; apply the existing hover token only on hover.
- The count represents hidden diagnoses, not the total. No disclosure control for three or fewer diagnoses.
- Search includes hidden diagnosis names and displays matching names in results. Do not silently mark the first diagnosis as primary without a verified primary-diagnosis field.
- Zero diagnoses: show 진단 기록 없음 with the same text alignment.

## Multiple Clinicians (Deferred)

- The approved prototype treats these as clinicians participating in the same visit, not authors of individual diagnoses.
- Show at most two names on one line. Use `+N명` (hidden count) with the existing ghost `Button` and `Popover` to show all participant names.
- Use `--clair-spacing-4` for the count button's horizontal padding. Size the popover to content within the viewport; avoid an unnecessarily wide fixed surface.
- Do not infer a lead clinician from array order. Use 주담당/참여 labels only if an authoritative role relationship exists.
- Before application implementation, inspect the actual encounter/clinician projection. The current prototype's synthetic participants must never be shipped as real data or fabricated from diagnosis authors. If only one authoritative veterinarian is available, preserve that result and explicitly report the missing multi-participant contract.

## Design-System Implementation Rules

- Reuse existing `Badge`, `Button`, `Popover`, `Input`, and `Select` components and verified supported props. The B layout is a screen-specific composition, not an existing shared History variant.
- Use existing semantic typography, spacing, radius, surface, border, hover, and focus tokens. Neutral 100 is the explicitly selected existing atomic color token; do not replace it with a literal hex/RGB value.
- Do not hardcode diagnoses, clinicians, dates, counts, widths, or selected states from prototype fixtures in application code. Derive them from authoritative data and existing layout contracts.
- Keep overrides scoped to this History list. Do not alter global ghost/secondary behavior or unrelated history lists. Do not add a dependency or shared abstraction for this composition alone.
- The HTML prototype contains comparison scaffolding and synthetic examples; it is not production code to copy verbatim.

## Acceptance Checks

- Verify 0/1/2/3/6 diagnoses, a long diagnosis name, expand/collapse, and search for a hidden diagnosis.
- Verify the actual single primary veterinarian and missing-name fallback. Multi-clinician count/popup checks remain deferred until a participant data contract is separately approved.
- Verify Neutral 100 background, transparent chip borders, transparent resting disclosure buttons, visible keyboard focus, and preserved hover behavior.
- Verify text alignment, vertical centering, token-based row/chip gaps, straight dividers, unchanged header/toolbar, and no panel footer.
- Verify existing 차트 보기 navigation and workspace/permission behavior against the actual application before reporting implementation complete.

## Source Ownership

- UI: `src/features/chart/components/chart-diagnosis-history-item.tsx` and `ChartInlineHistoryPanel` in `src/features/chart/module.tsx`.
- Data: `src/features/chart/chart-patient-history.ts`; existing history SQL joins `primary_veterinarian_id`, not a participant list.
- Navigation: `selectHistoryEncounter` preserves the active selected encounter and displays the old encounter read-only.
- Work and verification: [CHART-PR-028](../../../../work/chart/CHART-PR-028-history-information-hierarchy.md).
