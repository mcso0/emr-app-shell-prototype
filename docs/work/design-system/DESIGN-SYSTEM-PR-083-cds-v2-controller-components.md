---
id: "DESIGN-SYSTEM-PR-083"
status: done
area: design-system
priority: P1
target_pr: "User request / CDS.V2 Toggle ToggleGroup Switch implementation"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27806-29479"
updated: 2026-07-26
---

# CDS.V2 Controller Components

## Goal

Align the shared `Toggle`, `ToggleGroup`, and `Switch` primitives with the
approved CDS.V2 controller contract while preserving existing Base UI
semantics and compatibility for current consumers.

## Approved Scope

- Extend `Toggle` with CDS.V2 `primary`, `ghost`, and `outline` visuals.
- Add the CDS.V2 `sm` and `md` geometry while retaining compatibility aliases
  for the existing `default` and `lg` sizes and preserving the legacy compact
  geometry as `xs`.
- Extend `ToggleGroup` with CDS.V2 primary container, ghost spacing, and
  connected outline treatment without changing Base UI single/multiple,
  orientation, or deselection semantics.
- Extend `Switch` with `xs`, `sm`, and `md`; keep `default` as the compatible
  32px alias and migrate the one explicitly compact current consumer to `xs`.
- Keep Switch labels external through `FieldLabel` or native label
  composition.
- Add Storybook documentation and interaction coverage for the three shared
  controls.
- Preserve the operating-day consumer's screen-specific styling because a
  newer CDS.V2 screen alignment already exists on `origin/main`.

## Out Of Scope

- Changing `SegmentedControl`, navigation, persistence, permissions, APIs,
  Supabase, RLS, or product workflow state.
- Adding a dependency or new global design token.
- Replacing Base UI semantics or forcing a required-selection policy into
  `ToggleGroup`.
- Broad migration of unrelated controls or Figma file edits.

## Done Criteria

- Existing controlled and uncontrolled APIs continue to pass through to Base
  UI.
- Toggle exposes pressed semantics; ToggleGroup preserves single/multiple and
  orientation; Switch exposes switch semantics and checked state.
- Figma `sm`/`md` geometry, variants, radii, colors, borders, and shadows are
  represented with existing CLAiR/EMR tokens.
- Icon-only Toggle examples require an accessible name.
- Storybook covers variants, sizes, disabled states, controlled interaction,
  single/multiple groups, and external Switch labels.
- Operating-day and Switch consumers retain their intended density and
  focused regressions pass.

## Verification

- `npm run lint` — pass
- `npx tsc --noEmit --pretty false --incremental false` — pass
- focused Storybook Vitest — 3 files, 16 tests pass
- `npm run build-storybook` — pass; existing Pretendard, Lottie eval, and chunk
  size warnings remain
- focused Playwright regressions — hospital settings, role/job catalog,
  role-permission, and reception registration all pass
- desktop Storybook browser QA — Figma geometry and checked/on state measured
  for Toggle, ToggleGroup, and Switch
- `npm run build` — pass; existing Next.js NFT tracing warning remains
- `npm run docs:check` — pass
- `git diff --check` — pass

## Implementation Result

- `Toggle` now exposes `primary`, `ghost`, and connected-compatible `outline`
  visuals plus `xs`, CDS.V2 `sm`, and CDS.V2 `md` sizes.
- Icon-only Toggle geometry is automatic when the only child is an SVG; the
  consumer remains responsible for `aria-label` or another accessible name.
- `ToggleGroup` owns container spacing and connected edge treatment while Base
  UI continues to own selection and keyboard behavior.
- `Switch` now maps `xs` to the prior compact geometry and implements exact
  CDS.V2 `sm` and `md` tracks, thumbs, colors, and thumb travel.
- The reception age-mode consumer opts into `xs` so its existing density does
  not change. The newer operating-day screen styling remains consumer-owned.
- No dependency, global token, persistence, API, permission, or Figma change
  was introduced.

## Production Release

- PR: `#501`
- Candidate commit: `0fc102040a68e86d19b57c08f0fe1d1a2f106328`
- `origin/main` merge commit: `5e89e0ddb54e15e790658331ca59529884270263`
- Release Check: GitHub Actions run `30189263382` passed for the exact
  candidate.
- Production deployment: `dpl_5Z9mquje5PnXAFKuuN5zo1oZgrYU` reached Ready
  and owns `https://emr-app-shell-prototype.vercel.app`.
- Production smoke: login entry and protected reception route redirect loaded
  without browser console errors.
- Rollback candidate: `dpl_ejnsFkXENXCqQFTLqxbbMBC3ZXmR`.
