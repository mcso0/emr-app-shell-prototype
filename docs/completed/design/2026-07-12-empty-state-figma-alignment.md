# Empty State Figma Alignment

## Summary

The shared `EmrEmptyState` component now follows the CDS.V2 EmptyPlaceholder visual contract from Figma node `27540:70134`.

## Implemented

- Added `lg`, `md`, and `sm` visual size tiers. `md` is the implementation value for the product's `mg` usage label.
- Matched Figma icon slot sizes, radii, spacing, typography, and default action-space reservation.
- Replaced local Empty State rgba/hex colors with existing CLAiR alpha, neutral, common, and shadow tokens.
- Matched one-action outline treatment and two-action outline-then-primary ordering in Storybook examples.
- Kept the queue-specific `EmrQueueEmptyState` unchanged.

## Verification

- Focused Storybook browser interaction tests: 13 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false --incremental false`: passed.
- `npm run docs:check`: passed.
- `git diff --check`: passed.
- `npm run build-storybook`: passed; existing font, docgen, lottie, and chunk-size warnings remain.
- `npm run storybook -- --ci --smoke-test`: passed.
- `npm run build`: passed; nested-worktree workspace-root and tracing warnings remain.
- `npx playwright test tests/queue-empty-content-contract.spec.ts tests/queue-loading-state.spec.ts --reporter=line`: 12 passed.

## Scope Notes

Figma icon artwork was treated as a slot reference. The existing motion-icon content remains the runtime asset. Feature routing, permission, persistence, and queue behavior were not changed.
