---
id: "DESIGN-SYSTEM-PR-048"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook foundation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "https://storybook.js.org/docs/get-started/frameworks/nextjs-vite"
  - "https://storybook.js.org/docs/ai"
updated: "2026-06-14"
---

# Storybook Foundation

## Goal

Add the first Storybook foundation for CLAiR EMR so future design-system stories can render with the same Next.js, Tailwind, Pretendard, and EMR token baseline as the app.

## Scope

- Install Storybook 10 with the Next.js Vite framework.
- Add Storybook dev/build scripts with telemetry disabled.
- Load `src/app/globals.css` in Storybook preview so shadcn, Tailwind, Pretendard, and EMR token aliases are available.
- Add Storybook docs and Vitest addon foundation.
- Keep generated example stories out of the repo.

## Out Of Scope

- Storybook MCP / AI addon setup.
- Chromatic publishing or hosted Storybook access.
- Component stories for EMR primitives.
- Feature workflow stories for chart, reception, billing, or other app screens.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, or real data work.

## Verification

- `npx eslint .storybook/main.ts .storybook/preview.tsx vitest.config.ts vitest.shims.d.ts eslint.config.mjs`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- `npm run lint` (passes with 6 pre-existing warnings)
- `npx tsc --noEmit`

Known caveats:

- `npm run build-storybook` warns that no story files exist yet. This is expected until the next story-adoption step.
- `npm run build-storybook` warns that the Pretendard `woff2` reference remains runtime-resolved; the CSS bundle still builds.
- `lottie-ai-chart-writing/` is excluded from the root Next.js lint/typecheck because it is an independent Vite app with its own `tsconfig.json` and `@/*` alias.

## Handoff Notes

Ready for Human Review.

Recommended next step: add the first stable design-system stories for `Button`, `Badge`, `Input`, `SegmentedControl`, `EmrStatusBadge`, and `EmrInlineAlert`, with usage guidance that future agents can consume through Storybook manifests.
