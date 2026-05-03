# API Boundary Integration Guide

Updated: 2026-05-02

## Current State

The boundary exists as independent helper code and documentation. No feature module consumes it yet, and no UI screen changed.

The requested `docs/archive/implementation-waves/mvp-parallel-workstreams.md` file was not present on `origin/main` when this worktree was created. This guide uses `docs/engineering/current-status.md` as the source of truth.

## Integration Order

Adopt the boundary one feature at a time.

1. Pick one read-only feature surface.

Start with a screen that already has a Playwright regression test and does not require session-only writes. Good candidates are read-heavy panels such as patient summary data or billing group lists.

2. Create a local adapter inside the feature.

Use `createMockEmrReadRepository()` at the feature boundary, then map the returned read model into the feature's existing view model. Keep existing component structure intact.

3. Preserve current behavior.

Before changing imports, capture the current expectations in the relevant Playwright spec. After the adapter change, the screen should render the same text, ordering, statuses, and enabled/disabled actions.

4. Move writes separately.

Check-in, form edits, result entry, payment actions, and session-only relationship edits should not be pushed through this read repository. They need a separate command boundary after the read side is stable.

5. Replace the snapshot provider.

When API/DB work begins, implement `EmrReadRepository` with a real data source or provide an API-backed `EmrReadSnapshot`. Keep selector tests as the contract for joined records.

## Guardrails

- Do not refactor multiple feature modules in one PR.
- Do not change 조제/처치 design or behavior while adopting this boundary.
- Do not wire auth, audit logging, or service catalog lookup into this helper layer.
- Do not create Next.js API routes as part of read selector adoption.
- Do not add DB clients or migrations until the backend plan is explicit.

## Suggested Follow-Up PRs

| PR | Scope | Verification |
|---|---|---|
| API Boundary 2 | Use repository in one small read-only feature adapter | Existing feature Playwright spec plus `tests/api-boundary.spec.ts` |
| API Boundary 3 | Add command boundary draft for session-only writes | Unit/Playwright tests around one write workflow |
| API Boundary 4 | Prototype API-backed snapshot behind the same repository interface | Contract tests comparing mock-backed and API-backed read models |

## Review Checklist

- Feature module diff is narrow and localized.
- No forbidden UI or token files changed.
- Selector tests still pass.
- The feature's existing regression test still passes.
- Any intentional data shape change is documented in `api-boundary-selectors.md`.
