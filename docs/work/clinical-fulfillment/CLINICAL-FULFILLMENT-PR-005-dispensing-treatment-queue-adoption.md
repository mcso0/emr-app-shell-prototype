---
id: "CLINICAL-FULFILLMENT-PR-005"
status: "human_review"
area: "clinical-fulfillment"
priority: "P0"
target_pr: "Project 08 / DEN-239"
source_docs:
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
  - "docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-003-chart-confirmation-sync.md"
dependencies:
  - "DEN-237"
  - "DEN-239"
updated: "2026-05-23"
---

# Add Dispensing Treatment Queue Server Read And Status Mutation

## Goal

Adopt the fulfillment work item route in the dispensing and treatment workspace while preserving the existing operator table, assignment, and grouped instruction UX.

## Scenario

1. A technician opens `/w/clair-demo/dispensing`.
2. The dispensing/treatment screen keeps rendering the existing demo queue immediately.
3. The screen reads server-backed fulfillment work items for `dispensing` and `treatment`.
4. Matching fulfillment status and assignee context are overlaid on the visible queue.
5. Existing actions such as assign/start/complete/return send status mutations through the fulfillment route.
6. If route read or mutation fails, the fixture-backed UI remains usable for the demo path.

## Scope

- Add a dispensing/treatment fulfillment queue read hook.
- Read both `dispensing` and `treatment` queue types from the shared fulfillment route.
- Map fulfillment statuses to existing queue status ids.
- Call the fulfillment status mutation route from existing start, complete, and return actions.
- Add focused Playwright coverage for route read and status mutation from the dispensing screen.
- Preserve the existing table, row, dropdown, history, and detail surfaces.

## Out Of Scope

- Inventory, lot/expiry, label printing, or pharmacy integration.
- Treatment device/provider integration.
- Billing candidate sync from fulfillment completion.
- Canonical order lifecycle sync from fulfillment completion.
- Remote Supabase migration push.
- Broad visual redesign.

## Done When

- Dispensing/treatment screens can read fulfillment work items and apply visible status context.
- Existing operator actions can call the fulfillment mutation route.
- Focused dispensing fulfillment coverage passes together with fulfillment server coverage.
- Docs/work, changelog, and closeout evidence are updated.
- Linear `DEN-239` is ready for Human Review.

## Verification

- `npx tsc --noEmit --pretty false`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3104 npx playwright test tests/dispensing-fulfillment.spec.ts tests/fulfillment-work-item-server.spec.ts`
- `npm run docs:check`
- `npm run security:secrets`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Handoff Notes

Start `DEN-240` next. It should connect fulfillment completion to order lifecycle and billing candidate sync now that lab, imaging, dispensing, and treatment screens can all speak to the shared fulfillment route.

## 2026-10-12 Local Operator Table Follow-up

User authorized the shared dispensing/treatment table UI update only:
remove the 상태 column, retain 취소/재요청 badges beside 오더명,
pin selection and order name, and reveal scrollbars on hover. Existing
assignment/completion restrictions are preserved. The original checkout
in-progress assignmentDisabled change is excluded from this release. No data, lifecycle, API, or deployment change.

- Reused shared column pinning and the chart scrollbar reveal style; keyboard
  focus and touch behavior follow the chart. The scrollbar begins after the
  fixed identity columns. Warning text stays visible during horizontal scroll.
- Explicit Korean column metadata preserves labels with the current shared renderer.
- Added four Storybook cases: dispensing, treatment, completion-restricted actions,
  and empty rows. All four passed, including exception badges, fixed geometry,
  warning continuity, selection/completion callback, and disabled completion actions.
- Typecheck, focused ESLint, and diff checks passed. Local browser checks proved
  both variants have idle opacity 0, hover opacity 1, and unchanged identity
  position after scrolling 250px. Screenshots are under output/playwright/.
- Initial app checks on the original checkout port 3000 stopped at real login.
  The release worktree uses an isolated mock server on port 3197. Updated both
  horizontal and outer vertical scroll-owner selectors for the nested viewport.
  Release-candidate checks and deployment evidence follow below. No remote data
  mutation is part of this release.

Release isolation on 2026-10-12: clean origin/main base
`e0c7e776186fb37323adc273f862431774fc53b4`, branch
`codex/dispensing-table-pinned-hover`. Only the table, its new stories,
layout regression coverage, and this evidence are included. Local release
checks passed: all 10 dispensing/treatment layout tests, all 4 Storybook
cases, secret/docs/UX copy/lint/type checks, production build, and diff check.
The existing documentation-viewer Turbopack tracing warning remains unrelated.
Exact remote Release Check and Ready Preview precede the Production gate.
Post-release smoke: authenticated synthetic Cheongdam dispensing and treatment
instruction tables on /dispensing, checking status removal, identity pinning,
hover/focus visibility, and read-only navigation without execution mutations.
Rollback baseline: Ready Production `dpl_Bxk9pQECrqfS26uotKSqLv9tXPsX`, source
`e0c7e776186fb37323adc273f862431774fc53b4`.
