---
id: "DESIGN-SYSTEM-PR-086"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User approval / customer animal pinned table"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-024-customer-table-shared-primitives.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-029-customer-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-050-customer-hospital-table-content-layout.md"
updated: "2026-07-27"
---

# Customer Animal Pinned Table

## Goal

Improve scanability in the customer animal master list by keeping the animal identity column visible while the remaining one-line data columns scroll horizontally.

## Approved Scope

- Use the existing `@tanstack/react-table` dependency for column visibility, ordering, sizing, row identity, and column pinning.
- Make animal name the first data column and pin it on the left in the patient table.
- Keep patient code as the first scrollable data column.
- Keep all patient table values on one line and use a 1480px minimum table width.
- Add a compatible 28px `table` size to `AnimalPatientAvatar` and use its fallback in animal-name cells.
- Keep the guardian table on the same renderer with `pinningMode="none"`.
- Preserve the current guardian-list, content-top-slot, search, sort, filter, density, column visibility, selection, row actions, drawers, loading, empty, and error contracts already present on `origin/main`.
- Add focused browser regression coverage and update the implementation evidence.
- Publish the approved change through a focused PR and merge it to `main` under the production release gate.

## Out Of Scope

- Patient image persistence, signed URLs, uploads, API, schema, Supabase, RLS, or permission changes.
- New table/grid dependencies.
- A global shared data-grid abstraction or broad adoption outside customer management.
- Figma file changes or claims of pixel-exact Figma parity without a source node.
- Remote data changes, provider actions, or production environment-variable changes.

## Done Criteria

- The patient table DOM order starts with animal name, followed by patient code.
- Horizontal scrolling leaves the animal-name column visible and moves patient code and later columns.
- The guardian table remains unpinned and retains the latest `origin/main` visual contract.
- Patient scalar values and status badges do not wrap.
- Animal fallback avatars render at 28px without changing existing `sm`, `md`, or `lg` consumers.
- Focused lint, TypeScript, customer Playwright, build, docs, secret scan, Release Check, preview, and production smoke pass or failures are recorded.

## Verification

- `npm run security:secrets`
- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run build-storybook`
- `npx playwright test tests/customer.spec.ts --reporter=line`
- Browser QA at 1536px and a narrower desktop viewport.

## Result

- `CustomerDataTable` uses its existing TanStack table instance for the approved column-pinning contract; no new dependency or second overflow owner was added.
- The patient table uses `pinningMode="first-data-column"` with `name` first and `patientNo` second; the guardian table uses the default unpinned mode.
- Patient cells use one-line content, a 1480px minimum table width, a 184px pinned animal column, a readable patient-code treatment, non-wrapping status badges, and text-backed consent badges.
- `AnimalPatientAvatar` has a compatible 28px `table` size and the customer table uses its fallback without adding image persistence.
- The implementation was rebased onto the current `origin/main` split customer-table architecture instead of restoring the older monolithic customer module.

Verification completed on 2026-07-27:

- Targeted and full ESLint: passed.
- TypeScript: passed.
- `tests/customer.spec.ts`: 15/15 passed.
- `npm run security:secrets`: 3475 tracked files checked, passed.
- `npm run docs:check`: 884 docs checked, passed.
- `npm run build`: passed with the existing Next NFT tracing warning.
- `npm run build-storybook`: passed with existing missing-MDX, font-resolution, lottie eval, and chunk-size warnings.
- Browser QA: 1024px and 1536px passed; document overflow 0, table overflow 993px/481px, pinned-left delta 0px, avatar 28px, patient code overflow 0px, and no critical page/runtime error.
- The local mock-auth shell continues to log its existing unauthenticated workspace/tab API 401 responses; the focused customer workflow and all 15 regressions passed.

The candidate SHA, Release Check, Preview, merge SHA, production deployment, and rollback reference are recorded at the release gate.

Result report:

- `docs/completed/design/2026-07-27-design-system-pr-086-customer-animal-pinned-table-report.html`
