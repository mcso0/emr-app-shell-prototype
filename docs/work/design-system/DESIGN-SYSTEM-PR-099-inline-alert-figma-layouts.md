---
id: "DESIGN-SYSTEM-PR-099"
status: "implemented"
area: "design-system"
priority: "P1"
target_pr: "User request / CDS.V2 InfoBar layout and semantic-state alignment"
created: "2026-09-17"
source_docs:
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28414-91491"
dependencies:
  - "DESIGN-SYSTEM-PR-075"
---

# Inline Alert Figma Layouts

## Goal

Align the shared `EmrInlineAlert` presentation with the CDS.V2 InfoBar section
while preserving the existing feature-owned action, dismissal, ARIA, and data
contracts.

## In Scope

- Add `default`, `actions`, and `icon-box` layouts.
- Infer `actions` when an existing consumer provides recovery actions; otherwise
  infer `default`.
- Add the neutral state and align neutral/info/success/warning/error surfaces to
  the approved 50 background, 200 border/icon-box, and 700 semantic foreground
  scale, with Neutral 900 foreground for the neutral state.
- Add Storybook matrices for the Figma layouts and every semantic state.
- Update the owning component guidance.

## Out Of Scope

- Feature call-site migrations or copy changes.
- Callback, retry, dismissal, permission, persistence, or live-data behavior.
- New color tokens, component dependencies, or unrelated Alert/Button changes.

## Done Criteria

- Existing call sites compile without prop changes.
- The three layouts match the Figma geometry at the authored 697px width and
  wrap safely on narrow surfaces.
- Neutral, info, success, warning, and error states use the documented semantic
  token contract in both ordinary and icon-box layouts.
- Icon-only dismiss controls retain an accessible label and error/warning roles
  remain `alert` while other states remain `status`.
- Focused Storybook inspection, lint, TypeScript, production build, docs links,
  semantic-token regression, secret scan, and diff gates pass.

## Verification

- Storybook browser inspection at 697px confirmed 10px padding, 8px radius,
  20px content/end-slot gap, 20px default icon, and 40×40px icon box.
- Computed styles matched the documented neutral/info/success/warning/error
  RGB values, including 200-step icon-box surfaces and `status`/`alert` roles.
- A 360px viewport had no document or alert horizontal overflow; end controls
  wrapped below the message without overlap.
- Lint, TypeScript, production build, Storybook build, docs links, secret scan,
  and diff whitespace checks passed. Lint retained five unrelated warnings in
  existing WP10 scripts; the production build retained the existing docs-reader
  NFT trace warning.
- The existing shared-component semantic-token Playwright test remains red on
  pre-existing `src/components/emr/subpanel.tsx` atomic values already present
  on `origin/main`; the changed `inline-alert.tsx` source has no direct palette,
  hex, or RGB value.

## Release Evidence

The user authorized commit, push, pull request, `origin/main` merge, and
production deployment in the implementation request. Exact-candidate release
checks, merge identity, production Ready state, alias, scoped HTTP smoke, and
rollback SHA are recorded in the pull request and release workflow evidence.
