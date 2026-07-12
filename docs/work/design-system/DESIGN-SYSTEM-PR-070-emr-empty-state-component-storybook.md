---
id: "DESIGN-SYSTEM-PR-070"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / EmrEmptyState component contract and Storybook variants"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/completed/design/2026-07-01-empty-state-surface-placement-report.html"
updated: "2026-07-12"
---

# EmrEmptyState Component Contract And Storybook Variants

## Goal

Create the shared `EmrEmptyState` runtime component and Storybook variants for the approved empty-state state/surface/action ownership model.

## Scope

- Add `EmrEmptyState` with `kind`, `surface`, `priority`, `density`, and `align` props.
- Use existing Iconly motion JSON assets through `EmrMotionIcon`.
- Add Storybook examples for queue, content, drawer, table, widget, permission-info, two-action, and 6-kind review states.
- Align the shared visual contract to CDS.V2 Figma `lg`/`md`/`sm` tiers, including icon slots, typography, alpha tokens, action ordering, and size-specific reserved action space.
- Keep feature routing, permission checks, persistence, analytics, and logging outside the component.
- Update design-system Storybook documentation index.

## Out Of Scope

- Replacing existing feature-local empty states.
- Changing `EmrQueueEmptyState` or current queue spacing behavior.
- Creating live feature workflow stories.
- Adding new dependencies or external Iconly network calls.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Done Criteria

- `EmrEmptyState` exposes the empty-state contract without owning feature behavior.
- Stories document when to use and when not to use each surface/action pattern.
- Existing docs link checks pass.
- TypeScript and lint pass.
- Storybook builds and can render the new component stories.

## Verification

- Passed `npx tsc --noEmit`.
- Passed `npm run lint`.
  - Existing warnings remain in `scripts/owner-os.mjs`, `src/features/auth/workspace-membership-management.tsx`, `src/features/chart/module.tsx`, `src/features/hospital-admin/store.ts`, and `src/features/reception/module.tsx`.
- Passed `npm run docs:check`.
- Passed `npm run build-storybook`.
  - Existing Storybook warnings remain: no `src/**/*.mdx`, `.storybook/preview.tsx` docgen skip, unresolved Pretendard font at build time, lottie direct `eval`, and chunk-size warnings.
- Passed `npm run storybook -- --ci --smoke-test`.
- Passed static Storybook iframe render check for `design-system-emr-emremptystate--state-kind-set`.
  - Verified 6 rendered `data-kind` states and the `차트로 이동` / `조건 초기화` action labels.
- Passed the Figma size/action Storybook interaction contract: 13 tests.
- Passed queue/content Playwright regression coverage: 12 tests.
- Passed `npm run build`.

## Handoff Notes

This work starts the shared runtime component layer. Screen adoption should be a separate pilot, preferably chart queue + content simultaneous empty handling.

2026-07-01 adoption checkpoint:

- `docs/design/system/empty-info-state-contract.md` now records the pre-implementation surface adoption rules and current empty-state inventory.
- First implementation should not bulk-replace queue placeholders. Existing queue side panels should remain on `EmrQueueEmptyState` until a compact queue-specific `EmrEmptyState` variant is separately approved.
- Recommended first pilot: one content-body absence case plus one table-body no-result case.
- Candidate content pilot: `src/features/chart/module.tsx` `EmptyChartState`.
- Candidate table pilots: `src/features/chart/module.tsx` order table empty row or `src/features/customer/module.tsx` `CustomerDataTable` empty rows.
- Permission, failed read/write, degraded API, and retryable error states remain `EmrInlineAlert` or feature-local recovery UI, not passive empty state adoption.

2026-07-01 implementation checkpoint:

- Applied the first screen pilot in `src/features/chart/module.tsx`.
- `EmptyChartState` now uses the shared content-surface empty state for selected-patient absence.
- The chart order table no-result row now uses the shared table-surface empty state for category/filter-empty results.
- Updated the filter QA assertion to use the new empty-state description copy.
- Queue placeholders were not changed.
- Verification passed for focused eslint, TypeScript, docs link check, and the adopted table filter Playwright case.

2026-07-12 Figma alignment checkpoint:

- `EmrEmptyState` now exposes `size="lg" | "md" | "sm"`; legacy `density` resolves to the corresponding visual tier for compatibility.
- `lg` maps to content, `md` maps to side-panel/large-table usage, and `sm` maps to modal/small-table usage. The requested product label `mg` is represented by the Figma `md` implementation value.
- Existing CLAiR alpha tokens are used for the icon area (`black-alpha-4`), icon/title (`black-alpha-48`), and description (`black-alpha-36`); local rgba/hex values were removed from the shared Empty State stories.
- Storybook now contains Figma size and action contract stories with browser assertions. `EmrQueueEmptyState` remains unchanged.
