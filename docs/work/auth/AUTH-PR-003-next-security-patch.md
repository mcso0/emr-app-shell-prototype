# AUTH-PR-003 Next.js Security Patch

Status: human_review
Linear: DEN-28
Priority: P0

## Goal

Patch the Next.js security release before workspace creation and server enforcement work depend on the proxy/middleware layer.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`
- `.gstack/security-reports/20260517-161848-cso-auth-scope.json`
- Linear `DEN-28`

## Scope

- Update `next` from `16.2.4` to `16.2.6`.
- Update `eslint-config-next` from `16.2.4` to `16.2.6`.
- Regenerate `package-lock.json` through npm.
- Verify audit, lint, typecheck, build, auth, and app-shell regressions.
- Keep this patch separate from workspace creation implementation.

## Out of Scope

- Workspace creation implementation.
- Permission resolver implementation.
- Migration SQL or RLS SQL.
- Supabase live validation.
- Broad dependency upgrades beyond the Next.js security patch.

## Done Criteria

- `package.json` and `package-lock.json` pin `next@16.2.6`.
- `package.json` and `package-lock.json` pin `eslint-config-next@16.2.6`.
- `npm audit --audit-level=high` reports no vulnerabilities.
- Auth and app-shell regression tests pass.
- Linear `DEN-28` can move to Human Review.

## Verification

```bash
npm audit --audit-level=high
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line
npm run docs:check
```

Results:

- `npm audit --audit-level=high`: passed, `found 0 vulnerabilities`.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with Next.js `16.2.6`.
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line`: passed, `41 passed`.
- `npm run docs:check`: passed.

## Notes

- `npm install --save-exact next@16.2.6 eslint-config-next@16.2.6` emitted an `EBADENGINE` warning because local Node `v23.11.0` is outside `eslint-visitor-keys@5.0.1` supported range (`^20.19.0 || ^22.13.0 || >=24`). Verification still passed. Use Node 22 LTS or Node 24+ for a clean install environment.
- Existing Playwright output still includes non-blocking `NO_COLOR`/`FORCE_COLOR` and Tiptap duplicate extension warnings. They predate this patch and did not fail the regression suite.

## Approved Follow-up — 2026-10-17

The historical results above apply to the earlier `16.2.6` patch. The user approved a new, scoped dependency update through existing PR #994.

### Current Scope

- Reuse PR #994 (`dependabot/npm_and_yarn/next-16.4.2`), based on `main` commit `7a1a29508e7d64387b97ae2befc9911b578734f8`.
- Pin `next@16.4.2` and `sharp@0.35.5`; regenerate the npm lockfile without unrelated dependency updates.
- Verify that the application image normalizers and Next.js optimizer resolve the patched sharp version, including Linux optional packages used by deployment.
- Keep login, cookie refresh, upload permissions, supported formats, size limits, and WebP output contracts unchanged.
- Add focused regression coverage for password login/session persistence, expired-session cookie refresh, and the Next.js image optimizer alongside existing OTP, recovery, avatar, and hospital-logo checks.
- Run scoped tests and the repository release checks, then verify an exact-head Ready PR Preview.

### Current Boundaries

- Use local synthetic authentication and storage fixtures; do not change real accounts, passwords, database records, or provider settings.
- Usage and cost investigation remains paused at the user's request.
- Production remains on the existing release until the exact PR candidate, checks, smoke path, and rollback candidate receive approval under the release gate.
- Keep historical `eslint-config-next@16.2.6` unless verification demonstrates a compatibility requirement to update it.

### Current Verification

- Baseline before the follow-up: 15 focused auth/image tests and 14 login-entry integration tests passed with Next.js `16.2.6` / sharp `0.34.5`.
- Node `24.19.0`; clean `npm ci --ignore-scripts --no-audit --no-fund` passed. Deployment CI additionally runs normal `npm ci` on Linux.
- `npm ls next sharp eslint-config-next`: Next `16.4.2` and application code share one sharp `0.35.5`; no older sharp copy remains. Linux GNU/musl optional packages are preserved at the patched versions.
- Focused image/auth contracts, native normalization, upload lifecycle, and Next image optimizer: **28 passed**. Valid JPEG/PNG/static WebP, 512px WebP output, malformed/animated/oversized input rejection, permissions, signed storage lifecycle, and old-pointer preservation are covered with local fixtures.
- Login-entry integration suite: **16 passed**, including password login, reload/session cookies, expired-session refresh through the Next proxy, OTP, recovery, safe redirects, and mobile entry layouts. Authentication is synthetic and loopback-only, not a real-provider login claim.
- Supplemental app-shell smoke: **2 passed, 1 pre-existing failure**. `tests/app-shell.spec.ts:175` expects a `조제 지시서` heading absent from the current screen. The same failure was reproduced with the exact `origin/main` manifest/lock (`next@16.2.6`, `sharp@0.34.5`); no application or existing app-shell test was changed.
- Full lint, focused test/fixture lint, typecheck, secrets, documentation links, Korean UX copy, and diff whitespace checks passed.
- Production build: passed with Next `16.4.2`. Turbopack reports one filesystem-tracing warning in the unchanged PRD document reader; Preview build/runtime verification remains required. No tracing policy or usage/cost setting is changed here.
- One independent read-only candidate review found no concrete surviving bypass or patch-caused regression. Its expired-session proof gap is covered by the added synthetic refresh test. Linux runtime smoke remains part of Preview verification.
- Production dependency audit exits nonzero for other dependencies, including a PostCSS override inherited by Next. No direct Next advisory or sharp advisory is reported for the new versions. This scoped patch does not claim that the entire dependency graph is free of findings.
- Exact-head remote Release Check, Ready Preview, and release approval packet will be recorded on PR #994 before any Production approval request.

## Production Completion and Approved PostCSS Follow-up — 2026-10-17

PR #994 candidate `ab6bf05cc8e2b8288abb8ebd1196d0871e5e069d` received explicit user approval and was squash-merged to `main` as `793c5fa1daef4e2918a2d54007dc78546eab13d6`. The approved candidate and merged main have identical Git trees. Production `dpl_5tjBPZSGE3LhwUVjRHjYTKbG87W5` is Ready on that merge SHA and holds the public app alias. Main Release Check `39030746699` and CodeQL `39030746666` passed. Production login/OTP navigation, local image 200, unconfigured remote image 400, and unsupported avatar/logo GET 405 smoke passed. No real credentials, OTP email, or hosted upload was used.

The user then authorized the root application's PostCSS override remediation.

### PostCSS Scope

- Change only the root `postcss` override from `8.5.12` to `8.5.23`, matching Next `16.4.2`'s original dependency and the patched floor for both source-map disclosure advisories.
- Regenerate the root npm lockfile, including the required compatible nanoid dependency; preserve unrelated versions and all application/configuration contracts.
- Reuse this work item for the narrowly related framework build dependency follow-up. Do not change Next, Tailwind, Vite, shadcn, source-map policy, or application logic.
- Verify path traversal and missing-`from` absolute map annotations using synthetic temporary fixtures, then preserve local/explicit/inline maps and AST CSS processing.
- Verify actual Next/Tailwind production build, generated CSS tokens, login/mobile layouts through the local synthetic provider, and Storybook/Vite build compatibility.
- Prepare a separate PR and exact-head Preview/Release Check. This new candidate requires its own Production approval after verification.
- Keep usage/cost investigation paused. No remote Auth/DB/provider changes are included. The independent `lottie-ai-chart-writing` subproject and its separate lockfiles are outside the root app's dependency graph and this approved override scope.

### PostCSS Evidence and Verification

- Installed root PostCSS `8.5.12` was forced below Next's exact `8.5.23` and Vite's `^8.5.15` requirements. Next, Tailwind, Vite, and shadcn all resolved the same root copy.
- Three local synthetic map probes reproduced content propagation before the update: absolute path without `from`, relative traversal without `from`, and relative traversal with `from`. All three are blocked after the update. Plain CSS, same-directory maps, and explicit previous maps remain intact.
- No source-backed remote request-to-PostCSS path was found in the application; this is remediation of a vulnerable build dependency, not evidence of a remotely exploitable endpoint or a data leak.
- Dependency install changed only PostCSS (`8.5.12` to `8.5.23`) and its required nanoid transitive dependency (`3.3.11` to `3.3.20`). Next, sharp, Tailwind, Vite, shadcn, and all application sources are unchanged.
- Extended synthetic checks preserve same-directory, explicit previous, and inline maps, plain CSS, and AST processing. Test scripts and before/after JSON evidence are retained separately through Codex Security's standalone artifact storage.
- Focused generated CSS/token browser tests: **2 passed**. Loopback synthetic login-entry suite: **16 passed**, including password login, cookie refresh, OTP/recovery, and mobile layouts.
- Full lint, typecheck, Next production build, Storybook/Vite production build, secrets (4,915 tracked files), docs links (1,073 documents), UX copy, and diff whitespace checks passed.
- One independent read-only candidate review found no concrete surviving bypass or patch-caused regression. Windows-native execution was not tested; deployment targets Linux. Explicit trusted previous-map access remains part of the supported API.
- `npm audit --omit=dev` reports no PostCSS, Next, or nanoid finding for this candidate. It still exits nonzero for 24 other dependency findings; those are outside this narrowly approved fix and have not been reclassified as runtime exposures.
- Existing PRD filesystem-tracing and Storybook docgen/chunk/direct-eval warnings remain non-blocking and outside this dependency patch.
- Exact-head remote Release Check, CodeQL, and Ready Preview evidence will be attached to the separate PostCSS PR before requesting its Production approval. PR #994 approval does not authorize this new candidate's main merge.

## Approved Local Dependency Security Follow-up — 2026-11-03

### Scope and Completion Criteria

- Preserve the user-approved local DOMPurify `3.4.17` and proxy-addr `2.0.8` lockfile updates.
- Stop this task checkout's Storybook development server and its Vitest child before updating. Other active checkouts are outside this package-update scope.
- Align Storybook core, docs/test addons, Next.js adapter and lint plugin at `10.6.2`; align Vitest, browser provider and coverage packages at `4.1.12`. Keep the existing MCP addon when its peer contract and local integration checks pass.
- Vitest `4.1.12` also fixes the manual-mock injection and Windows path-normalization advisories left in `4.1.11`. Use the patched 4.x line without moving to Vitest 5.
- Regenerate the npm lockfile with compatible transitive dependencies. Do not bypass peer checks with `--force` or `--legacy-peer-deps`.
- Completion requires no critical findings in the root npm audit, preserved prior package fixes, compatible dependency resolution, focused Storybook interactions/MCP, Vitest Node tests, lint/type checks, and Storybook/app builds.
- The initial approval was local-only: use synthetic fixtures, preserve application behavior, and keep development servers stopped after verification. The later delivery approval below supersedes the initial no-push/no-deployment boundary for this same dependency patch; remote data actions remain excluded.

### Verification

- Root npm audit: **0 critical**; the six previously flagged development-tool packages and the prior DOMPurify/proxy-addr targets have no remaining findings. Other findings remain: 2 low, 31 moderate, 12 high. Runtime-only audit remains 2 low, 9 moderate, 11 high, 0 critical. This is not an all-dependencies-clean claim.
- Patched floors are supported by the [Storybook advisory](https://github.com/advisories/GHSA-f2ph-cmg5-wxc8), [Vitest browser file-access advisory](https://github.com/advisories/GHSA-p63j-vcc4-9vmv), [manual-mock follow-up](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), and [Windows path-normalization follow-up](https://github.com/advisories/GHSA-xp26-3454-mjgp).
- Node `22.22.2`: isolated `npm ci --ignore-scripts --no-audit --no-fund` and full `npm ls` exited successfully. Lifecycle scripts were intentionally disabled for this install check; actual builds below used the task checkout. Both installations report the same four extra optional WASM package artifacts (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@tybys/wasm-util`); no missing or invalid peer dependencies were reported. The clean install reproduces these notices, so they are not stale files unique to the task checkout.
- Vitest Node regression suite: **72 passed** across 8 files. Focused browser stories: **29 passed** across Input, Textarea, Dialog, Popover, Dropdown Menu, Measured Loading, and Dispensing Prework Context.
- Project-local Storybook MCP documentation listing and Input documentation retrieval passed. Native MCP story tests passed for Input Default and Measured Loading Repeated Read. Existing MCP addon `0.6.0` remains compatible in these checks.
- Patched development preview returns a `frame-ancestors` policy restricted to self and loopback hosts. This is a focused response-header check, not a complete exploit or penetration test.
- Full lint, app build with TypeScript checking and local mock auth, Storybook static build, documentation links, secret scan, and diff whitespace checks passed. Existing Next document-reader tracing and Storybook docgen/chunk warnings remain non-blocking.
- Prior DOMPurify `3.4.17` and proxy-addr `2.0.8` are preserved. Application sources, story sources, and Storybook/Vitest configuration are unchanged.
- This checkout's original and verification Storybook/Vitest server processes are stopped. Two Storybook servers owned by other active checkouts were left untouched. No remote delivery or real-data action was performed.

### Approved Delivery — 2026-11-03

- The user's subsequent request, "이제 배포하자", authorizes this bounded dependency patch through PR, successful current-candidate checks/Preview, main merge, and Production verification. No additional runtime behavior, migration, real-data, provider, cost, or deployment-setting change is included.
- Source branch: `codex/security-dependency-patches`, based on main `11ed230d1029290ec0ae627ade20e0663c250fc5`. Preserve the already released confirmed-order and selected-billing work from PR #1049.
- Scope remains `package.json`, `package-lock.json`, and this work record. Untracked local screenshots/logs remain unpublished.
- Recheck the integrated candidate locally, require the protected automatic PR Release Check and current-head Ready Preview, and merge with expected-head protection. Record final candidate/run/merge/deployment identifiers in the PR.
- Preview and Production smoke: unauthenticated `/login`, registered `/docs?doc=study-emr-domain-basics`, and the published diagram asset. Do not log in, send email, inspect clinical records, or mutate the shared demo database.
- Previous Ready Production and rollback candidate: `dpl_H3t59E8FyYiJJvPbxSRUVAcfg9Va`, sourced from the main SHA above. Stop for failed/unknown checks, unexpected source changes, failed smoke, or a missing Ready Preview. No automatic rollback mutation is included.
- Integrated local candidate verification passed: 72 Node tests, 41 browser story tests (including the latest confirmed-order dialog), full lint, explicit `tsc --noEmit`, Next app build, Storybook static build, secrets, docs links, and diff checks. Root audit remains 0 critical with 45 other findings. Hosted Preview/Production verification is recorded on the PR after these local results.
