# Empty State Side-panel MD Alignment

## Summary

All shared EMR side-panel empty states now use the CDS.V2 `md` visual contract, which is the implementation tier for the requested `mg` usage.

## Implemented

- Updated `EmrQueueEmptyState` to render the shared `EmrEmptyState` with `surface="queue"` and `size="md"`.
- Applied 32px icon areas, 16px icon slots, 10px radius, 8px spacing, 14px typography, reserved action space, and existing CLAiR alpha tokens.
- Added side-panel descriptions for reception, chart, lab, imaging, dispensing, billing, and Home empty states.
- Kept loading and search behavior owned by their existing wrappers; loading does not reserve an action row.
- Left content-area `lg` empty states and table-specific contracts unchanged.

## Verification

- TDD RED: the updated queue visual tests failed against the previous 40px queue slot.
- TDD GREEN: focused queue regression and seven-module side-panel contract tests passed (`11 passed`).
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false --incremental false`: passed.
- `npm run docs:check`: passed; 786 docs/agent markdown files checked.
- `git diff --check`: passed.
- Storybook interaction contract: 13 passed.
- `npm run build-storybook`: passed; existing font, docgen, lottie, and chunk-size warnings remain.
- `npm run storybook -- --ci --smoke-test`: passed.
- `npm run build`: passed; nested-worktree workspace-root and tracing warnings remain.
- Queue/content/side-panel Playwright regression suite: 13 passed.

## Scope Notes

The Figma icon artwork remains a slot reference. Existing motion-icon content is preserved inside the new `md` slot. No routing, queue selection, refresh, permission, persistence, or API behavior was changed.
