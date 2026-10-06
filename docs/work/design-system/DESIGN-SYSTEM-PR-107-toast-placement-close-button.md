---
id: DESIGN-SYSTEM-PR-107
status: human_review
area: design-system
priority: P1
target_pr: User-approved toast correction and main merge
created: 2026-10-05
source_docs:
  - docs/design/system/DESIGN.md
  - docs/product/features/notifications/global-notification-center-v0-contract.md
dependencies: []
---

# Operation Toast Placement and Close Button

## Plan and Scope

Start from current `origin/main`; the primary checkout was behind remote main.
User authorized implementation, visual verification, commit, push, PR, and merge
to main after the checks pass. Main is the production deployment branch.

1. Place operation-result Sonner toasts at the viewport top-right, with 16px
   desktop/mobile insets. Remove their shell-header/live-notification height
   dependency. Preserve the independent live notification stack.
2. Default the shared toaster to the application's light palette instead of
   following the operating system. Keep explicit caller theme overrides.
3. Scope close-button styles to the existing toaster CSS module. Ensure
   transparent rest, black 4% hover, black 6% pointer press, and visible keyboard
   focus override Sonner's equal-specificity runtime-injected styles.
4. Verify the actual root toaster through the existing mock new-work-tab action,
   covering desktop/mobile and system light/dark, inset geometry, hover, pointer
   press, keyboard dismissal, and overflow/stack behavior.
5. Update the design contract and closeout; run release gates; open and attach a
   PR, check the exact candidate, then merge to main and inspect deployment.

## Evidence and Decisions

- Before the original fix, root layout used top-right and the shell/header offset plus live
  notification height; observed desktop inset was 192px.
- System dark preference is enabled on the inspected deployed browser. Sonner
  dark close-button hover uses `--normal-bg-hover`, approximately #1F1F1F.
- The existing component CSS supplies 4% hover but has equal specificity to
  Sonner's later-injected hover rule, and has no pressed-state override.
- The dismiss button has no persistent selection. Its requested 6% press is a
  local exception; global hover/selected/active tokens stay 4%/6%/8%.
- The Order confirmation caller emits a plain `toast.success`; no feature-local
  layout or persistence changes are required.

## Out of Scope

Live-notification positioning/delivery/archive policy; clinical writes; DB/API,
permissions, real data, global button/token changes, dependency updates,
staging aliases, environment/secrets changes.

## Acceptance and Verification

- Inset remains 16px on both axes despite system theme, header height, or live
  notification stack changes; mobile content stays inside the viewport.
- Close button resolves to transparent/4%/6% for rest/hover/press and dismisses
  with keyboard focus visible. No dark opaque hover background.
- Existing maximum-three notification stack regression passes.
- Focused Playwright, lint, TypeScript, docs, UX copy, secret scan, production
  build, and `git diff --check` pass. Run the manual Release Check on the exact
  PR head and verify Vercel readiness before merge.
- Rollback is a revert of the scoped PR; failed preflight or visual checks stop
  the merge. No new dependencies or remote data operations.

## Result

- Operation toasts now use top-right 16px desktop/mobile insets and a light
  default theme. Explicit caller overrides remain supported.
- Toaster-scoped selector specificity protects rest/hover/press/focus from
  Sonner's runtime stylesheet; no global token or button changes.
- Before the fix, the real mock root toaster resolved to top-right/system dark.
- Final focused browser verification passed 10/10: four viewport/system-theme
  combinations plus six existing notification stack/policy tests. Each visual
  case verifies geometry, 4% hover, 6% press, pointer dismissal, Alt+T/Tab focus,
  visible focus ring, and Enter dismissal. Mobile resizes the actual root toast
  because the existing new-tab action is desktop-only.
- Lint: zero errors, five pre-existing script warnings; changed-file lint and
  TypeScript passed. Docs, UX copy, secret scan, diff check, and production build
  passed. The development Turbopack cache panicked; browser checks used the
  supported Webpack dev server. The default Turbopack production build passed.
- Release evidence belongs to the attached PR and exact-candidate Release Check.
  User authorized main merge once verification passes; no staging alias changes.
- Closeout: `docs/completed/design-system/2026-10-05-toast-position-close-button-report.html`.

## Placement Correction

After PR #937 shipped, the user corrected the requested horizontal edge from
left to right. This follow-up changes only the root position, geometry
assertions, and owning documentation. Keep top/right 16px desktop/mobile
insets, the light theme, and close-button 4% hover/6% press/focus unchanged.
The existing commit/push/PR/main-merge authorization applies to this correction;
verify the final candidate and production smoke before reporting completion.
Rollback candidate: production deployment `dpl_3u4qhH43RbC6JYpENFfhAFRwRD6n`
on merge SHA `c6816a5de37d198027f00de0d952c3ecae2fc73d`.
Correction verification: the same 10 browser checks passed with actual top/right
16px geometry; desktop/mobile and both system themes retain 4% hover, 6% press,
visible keyboard focus, and pointer/keyboard dismissal. Required release checks
and the production result are recorded on the follow-up PR.
