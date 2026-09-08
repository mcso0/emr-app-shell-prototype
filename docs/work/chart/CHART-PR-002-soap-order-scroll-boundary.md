---
id: CHART-PR-002
status: done
area: chart
priority: P1
target_pr: PR 2
source_docs:
  - docs/engineering/current-status.md
  - docs/work/chart/CHART-PR-001-workspace-restructure.md
  - docs/engineering/architecture/app-shell-layout-contract.md
dependencies:
  - CHART-PR-001
updated: 2026-05-05
---

# SOAP Order Scroll Boundary

## Goal

SOAP section count or content growth should not push the chart order area out of view.

## Scope

- Split the chart body height between SOAP/diagnosis panels and the order area.
- Keep SOAP and diagnosis overflow inside their own panels.
- Keep the chart order table and order footer inside a visible lower workspace area.
- Add visual dividers between chart info, SOAP/diagnosis, and order areas.
- Make the SOAP/diagnosis-to-order divider a vertical resize grabber so users can adjust the upper chart record/diagnosis area and lower order area.
- Stop grab resizing when the pointer is released, cancelled, or browser focus is lost.
- Replace order group cards with a compact table so multiple orders can be scanned without excessive vertical scrolling.
- Add visible row selection checkboxes and a select-all checkbox to the compact order table.
- Keep order row checkboxes unselected by default.
- Keep chart, diagnosis, and order headers to a single line with smaller, muted subtitle text.
- Remove the blue footer fill and keep the order action footer separated by a low shadow plus a line.
- Use gray-400 header subtitles, lower the order footer shadow, align the diagnosis search field/action, and show SOAP autosave state as non-button text.
- Remove the divider between the order section title row and order filter tabs.
- Align chart record toolbar action button heights and use gray-50 behind the compact order table workspace.
- Remove the SOAP attachment footer fill and keep the compact order table header gray-50 while table body rows stay common white.
- Add a ghost `+ Order 추가하기` action as the compact order table's final row so users do not need to travel back to the section title.
- Reuse the shared EMR list item pattern for chart history aside items so selected history rows do not use ad hoc blue fills.
- Add a reusable `LineTabs` size option so the previous style is `lg` and the chart order tabs can use a smaller default size.
- Add a regression test that grows SOAP sections and confirms the order heading/action remain in the viewport.

## Out Of Scope

- SOAP accordion behavior.
- Actual chart save, order creation, order confirmation, or persistence.
- 조제/처치 screen changes.

## Done When

- SOAP additions no longer make the order area disappear below a page-level scroll.
- The divider between SOAP/diagnosis and order is draggable/keyboard-adjustable, with minimum heights on both sides.
- The divider does not remain in an active resizing state after pointer focus is lost.
- Existing chart workspace interactions still pass.
- Narrow panel combinations do not overlap SOAP/diagnosis/order controls.
- The order area shows grouped order context in table columns rather than tall per-group cards.
- Users can select individual orders or all visible orders and see the selected total update.
- The chart info divider has breathing room from the document info card.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts --reporter=line`

## Handoff Notes

The first implementation keeps the change layout-only. If long SOAP authoring still feels dense in manual QA, the next small follow-up is per-SOAP collapse/expand inside the SOAP panel.

## 2026-09-08 Plan/Order vertical boundary follow-up

Owner requested investigation, implementation, commit, push, PR, and main merge.
The isolated change uses existing Base UI vertical overflow attributes to show
32px maximum panel-surface gradients only where more rows remain. Top fade starts
below the density-specific sticky header; footer, scrollbars, pinned columns,
and quick-add controls retain their existing ownership. No data/API changes.

Focused verification: `tests/chart-order-scroll-fade.spec.ts` covers start, middle,
end, return-to-start, no overflow after resize, sticky header geometry, footer
geometry, and pointer pass-through. Release preflight results are recorded in the PR.
