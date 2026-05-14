---
id: "DESIGN-SYSTEM-PR-018"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 18"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-017-shared-emr-components-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-017"
updated: "2026-05-14"
---

# Residual Color Audit

## Goal

Audit and clean the remaining eligible direct color usage outside the major feature screens, shell chrome, and shared EMR components.

## Scope

- Scan residual app source after DESIGN-SYSTEM-PR-017.
- Convert eligible residual source in button gallery, Excel icon, order queue status seeds, chart queue status seeds, and placeholder demo launcher to shadcn semantic tokens or EMR alias tokens.
- Add focused source audit coverage for the eligible residual files.
- Classify intentional exceptions so future broad scans do not treat generated tokens, PWA metadata, and asset files as screen color debt.
- Preserve feature behavior, session-only mock behavior, data shape, app shell routing, and PWA install metadata behavior.

## Out Of Scope

- Editing generated Clair token output.
- Rewriting token definition files such as `src/styles/tokens/clair.css`, `src/styles/tokens/emr-foundation.css`, or `src/styles/tokens/shadcn.css`.
- Changing PWA manifest/theme color semantics in `src/app/manifest.ts`, `src/app/layout.tsx`, or generated PWA icon assets.
- Editing Figma/exported SVG assets or public framework placeholder SVGs.
- Changing live Supabase validation, package/env setup, DB/API persistence, migrations, RLS policies, or server permission enforcement.

## Done When

- The residual eligible source audit in `tests/design-tokens.spec.ts` passes for scoped residual app source files.
- A broad scan leaves only intentional exceptions: token definition files, PWA metadata/icons, exported assets, and test expectations.
- Status semantics are preserved: warning/re-requested, info/in-progress, neutral/waiting, success/completed, and danger/canceled remain mapped to the same status meaning.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts tests/chart.spec.ts tests/button-gallery.spec.ts --reporter=line --workers=1`

## Handoff Notes

Started from branch `codex/design-system-pr-018-residual-color-audit`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-residual-color-audit.md`.
