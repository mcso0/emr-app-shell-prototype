# DESIGN-SYSTEM-PR-090 Workspace Entry Splash Motion

- Status: implemented
- Area: design-system / auth / app-shell
- Priority: P1
- Source: User-approved final loading prototype (2026-09-06)
- Updated: 2026-09-06
- Current closeout: `docs/completed/design-system/2026-09-06-workspace-entry-assembly-light-report.html`
- Previous closeout: `docs/completed/design-system/2026-08-08-workspace-entry-splash-motion-report.html`

## Goal

Implement the approved assembly and diagonal light sequence in the existing post-login workspace splash. Reuse the app's Pretendard and metadata typography tokens. Preserve the provider, login, usable-shell readiness, access-failure, and inert/aria-hidden boundaries.

## Approved Visual Contract

- White full-screen surface; centered shared logo in a 104px slot.
- Unlit logo: original `#C7CCD1`. Do not pre-light the base logo.
- Assemble both existing pieces simultaneously from ±10px to their final positions over 640ms, `cubic-bezier(0, 0, 0.3, 1)`.
- Fade pieces from opacity 0 to 1 over 320ms. No scale or bounce.
- After actual assembly completion, hold the unlit logo for 220ms.
- The broad, matte light band starts entirely outside and above the logo. Move down/right at 25 degrees from vertical; only the intersected logo area becomes lighter.
- First light pass also fades from opacity 0 to 1 over 900ms while travelling. Use the approved pale-gray tone, not a white/glossy stripe.
- Light travel repeats every 2600ms. Both endpoints are outside the entire icon slot, making the loop reset invisible.
- After 2000ms still loading, reveal `진료 공간을 준비하고 있어요` using `emr-text-metadata`, `font-medium`, and `--emr-text-tertiary`.
- Typography: app `font-sans` (self-hosted Pretendard Variable), Label 2 alias chain: 12px, approximately 16px line-height, 0.025em tracking, weight 500.
- Readiness interrupts any phase: freeze the current frame and fade the overlay out over 180ms. Do not delay readiness for an assembly or light cycle.
- Reduced motion: static unlit logo, no assembly or light, immediate exit on readiness.

The 2026-09-06 contract supersedes the August scale/pulse and return-to-full exit behavior. The earlier implementation and its verification remain recorded in the previous closeout.

## Scope Boundary

- Existing `WorkspaceEntryLoadingScreen` and motion module own the presentation.
- The existing shared icon remains the single source for both paths; derive the light mask from it.
- LoginForm starts the splash; AppShell and AuthGate failure paths complete it. No changes to these owners or to provider inputs/inert behavior.
- No session, permission, data fetching, API, DB, or dependency declaration changes. The user authorized scoped commit, push, PR, main merge, and production delivery on 2026-09-06.
- The approved logo geometry/colors are local motion-artwork values; typography uses existing shared tokens.

## Source References

- `src/components/emr/workspace-entry-loading-screen.tsx`
- `src/components/emr/workspace-entry-loading-screen-motion.ts`
- `src/features/auth/workspace-entry-splash-provider.tsx`
- `src/styles/tokens/clair.css`, `src/styles/tokens/emr-foundation.css`, `src/app/globals.css`
- `docs/design/system/DESIGN.md`
- [Carbon entrance easing](https://carbondesignsystem.com/elements/motion/overview/)
- [Fluent motion](https://fluent2.microsoft.design/motion)

## Verification Plan

- Storybook interaction tests: pending loading typography, readiness during light, replay, early readiness during assembly; render under React StrictMode.
- Browser: initial/settled logo color, no light before assembly, off-logo first/reset frames, light moving top-to-bottom, reduced motion, desktop and narrow layout.
- Existing auth scope/source checks and synthetic post-login splash browser flow.
- Focused motion geometry invariant, ESLint, TypeScript, docs links, whitespace checks.

## Current Verification

- Storybook/Vitest: 3/3 passed, including ready during assembly, ready during light, replay, and typography under React StrictMode.
- Focused Playwright motion/auth checks: 4/4 passed, including the synthetic post-login browser flow and unchanged scope guards.
- Browser checks passed: assembly is exactly 10px; light is absent during assembly and the settled hold; reduced motion uses a static unlit logo and exits; no page errors or 360px horizontal overflow.
- Screenshot pixels: unlit top/bottom both `rgb(199, 204, 209)`; a light-pass frame changes only the intersected areas (`rgb(221, 224, 227)` top, `rgb(210, 214, 217)` bottom).
- Actual text: loaded Pretendard Variable, 12px / approximately 16px / weight 500 / 0.3px tracking. The standalone final prototype uses the same values.
- Clean release worktree ESLint passed with no errors or warnings.
- `git diff --check` passed. Auth/provider/shell files, package manifests, and lockfile are unchanged by this slice.
- Clean release worktree TypeScript passed. The 16 unrelated order-catalog test errors observed in the dirty implementation checkout are absent from the release candidate.
- Clean release worktree secret scan, docs links, UX copy, ESLint, TypeScript, production build, and whitespace checks all passed. Focused Playwright 4/4 and Storybook 3/3 also passed on this release tree.
- Initially missing declared packages were restored with `npm ci --ignore-scripts --no-audit --no-fund`; verification used lockfile versions (Storybook 10.4.6, Playwright 1.60.0 / test runner 1.59.1, Framer Motion 12.38.0). No dependency declarations changed.

Commands:

```sh
STORYBOOK_DISABLE_TELEMETRY=1 npx vitest run --project storybook src/components/emr/workspace-entry-loading-screen.stories.tsx
npx playwright test tests/workspace-entry-splash.spec.ts tests/auth.spec.ts --grep 'light band starts|auth gate uses workspace shell skeleton|logo loading is scoped|post-login workspace entry shows' --reporter=line
npm run lint
npx tsc --noEmit
npm run docs:check
git diff --check
```

## Delivery State

The user approved delivery of this slice to main/production on 2026-09-06. A clean release worktree starts from `d8dc1920a8ef843f0c99e471ae7632c0e79b8abb` (PR #709); only the component, motion settings, stories, focused test, this work item, its index row, and HTML report are included. The dirty implementation checkout remains preserved.

Required preflight: secret scan, docs, UX copy, ESLint, TypeScript, production build, focused Playwright 4/4, Storybook 3/3, and manual GitHub Release Check on the exact candidate. Preview readiness and main freshness must be confirmed before merge. Production verification covers the official alias, deployment commit, login/workspace routes, and the login splash where a synthetic session is available.

Rollback: revert the scoped merge commit to restore the PR #709 baseline, or restore its verified Ready production deployment. Stop if required checks fail, the candidate scope changes, production routes fail, or deployment resources differ. Actual PR, check, merge, and deployment evidence is recorded in the delivery result after verification.
