---
id: "DESIGN-SYSTEM-PR-076"
status: implemented
area: design-system
priority: P1
target_pr: "Browser comment / CDS.V2 medium tab group alignment"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27630-20825"
---

# DESIGN-SYSTEM-PR-076: CDS.V2 Medium Tab Group Alignment

## Goal

Align the shared `SegmentedControl` medium tabs contract and the reception calendar day/week/month control with CDS.V2 node `27630:20825`.

## Scope

- Correct the shared `variant="tabs"`, `size="md"` geometry, typography, radii, colors, and selected elevation.
- Preserve the existing reception calendar value and `aria-label` behavior.
- Add a controlled Storybook example for the CDS.V2 day/week/month state.
- Provide a Korean HTML implementation mock/report.

## Out Of Scope

- Calendar date navigation, veterinarian filtering, appointment data, or toolbar action order.
- Changes to compact `xs` and `sm` segmented-control contracts.
- Figma file edits, token generation, backend, database, deployment, or release work.

## Confirmed Design Contract

- Group: 91x32px for three one-character items, 2px inset, 12px radius, `blackAlpha/4` background.
- Item: 29x28px minimum geometry, 8px horizontal padding, 10px radius.
- Type: Pretendard Medium 14/20 with 0.014em tracking (`body/2/normal`).
- State: selected white with neutral/800 and `shadow-sm`; unselected transparent with neutral/600.

## Done Criteria

- Reception continues using the shared medium tabs variant without feature-local style overrides.
- Shared component and Storybook story match the confirmed Figma contract.
- Selected state remains keyboard reachable and exposes `aria-pressed`.
- Focused lint, TypeScript, Storybook build/interaction, reception browser QA, and docs checks are recorded.

## Verification

- Passed `npx eslint src/components/ui/segmented-control.tsx src/components/ui/segmented-control.stories.tsx`.
- Passed `npx tsc --noEmit --pretty false --incremental false`.
- Passed `npx vitest --project storybook run src/components/ui/segmented-control.stories.tsx` (6 stories).
- Passed `npm run build-storybook`; existing font-path and third-party bundle warnings remain non-blocking.
- Browser measurement matched the Figma contract: group 91x32, item 29x28, inset 2, radii 12/10, font 14/20 Medium, selected white/neutral-800/shadow-sm.
- Browser interaction confirmed day/week selection and `aria-pressed` updates.
- Browser checks at 1024px and 768px kept the group visible and unclipped.
- The existing reception first-path Playwright test was attempted against a manually started dev server but failed before reaching the tab assertions because its fixed `2026-05-01` date expectation did not match that server context. No tab-group failure was observed.
- Passed full `npm run lint`, `npm run docs:check`, and `git diff --check` after the report update.

## Result Report

- `docs/completed/design-system/2026-07-14-cds-v2-medium-tab-group-alignment-report.html`
