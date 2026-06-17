---
status: "active"
updated: "2026-06-15"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "https://storybook.js.org/docs/writing-stories/args"
  - "https://storybook.js.org/docs/writing-docs/autodocs"
  - "https://storybook.js.org/docs/ai/best-practices"
  - "https://storybook.js.org/docs/ai/mcp/overview"
  - "https://storybook.js.org/docs/ai/mcp/api"
---

# Storybook Operating Rules

Storybook is the executable component catalog for CLAiR EMR. The canonical design-system policy remains in `docs/design/system/*`; Storybook shows how the current code implements that policy.

## Ownership

- Keep component stories next to the component they document.
- Use `src/components/ui/*` stories for generic shadcn/Base UI primitives.
- Use `src/components/emr/*` stories for established EMR shared patterns.
- Use `Design System/Recipes/*` only for small synthetic composition examples that dogfood documented primitives.
- Keep feature workflow stories out of Storybook until the feature has stable mock data, providers, and visual QA scope.
- Do not add or change runtime component APIs just to make a story easier.

## Story Structure

Every design-system story file should use:

- explicit hierarchy such as `Design System/UI/Button`
- CSF meta with `satisfies Meta<typeof Component>`
- `type Story = StoryObj<typeof meta>`
- `tags: ["autodocs"]` at the component meta level
- `args` for the default state
- `argTypes` for controlled props and AI-readable prop intent
- `parameters.docs.description.component`
- story-level `parameters.docs.description.story`

Do not enable global autodocs in `.storybook/preview.tsx` until experimental stories and stable stories have a clear separation.

## AI-Friendly Guidance

Write story descriptions so an agent can decide when to reuse the component without guessing:

- state what the component is for
- state what it must not be used for
- name accessibility requirements such as labels for icon-only buttons
- use synthetic product-like labels, never real customer, patient, guardian, hospital, payment, or identity data
- prefer stable component variants over custom class examples

Keep component source docs AI-readable as well:

- add a short JSDoc summary above exported shared components
- document exported prop types with concise "when to use / when not to use" guidance
- prefer explicit exported prop aliases when upstream primitive or polymorphic types hide local intent
- use `react-docgen-typescript` for Storybook prop extraction unless build time becomes a blocker
- verify the MCP components manifest after docgen-related changes

## Scope Guardrails

Storybook stories must not introduce:

- DB, Supabase, RLS, live persistence, server enforcement, deployment, payment, email, KakaoTalk, PACS, device, or provider work
- real customer, patient, guardian, hospital, payment, or identity data
- story-specific production providers or network side effects
- feature workflow claims that are not verified by the source app

## Verification

For story additions, run:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`

Use browser verification when a story should appear in the local Storybook sidebar or when visual token rendering matters.

## Interaction Tests

Default to rendering-only stories unless the story documents meaningful behavior such as text entry, filtering, disclosure, keyboard interaction, or disabled-state behavior.

When a `play` function is useful, use DOM APIs directly for now:

- query inside `canvasElement`
- use native setters such as `HTMLInputElement.prototype.value` when changing controlled inputs
- dispatch native `input`, `change`, `click`, or keyboard events with `bubbles: true`
- wait for the next microtask or frame with `window.setTimeout` or `requestAnimationFrame` only when the component needs it
- throw a plain `Error` with a clear message when the expected UI state is missing

Do not import `storybook/test` helpers in new `play` functions until a dedicated follow-up verifies that the current Storybook MCP runner and addon-vitest setup can initialize those helpers consistently. The local Storybook 10.4.4 / addon-vitest 10.4.4 runner previously hit a `storybook/test` helper initialization issue under MCP `run-story-tests`; DOM API play functions have passed focused MCP validation.

For MCP story-test calls, pass focused story IDs through the documented `stories` array shape:

```json
{
  "stories": [{ "storyId": "design-system-ui-textarea--default" }]
}
```

Do not pass a top-level `storyId`; the MCP tool schema ignores that shape and can run a broad pass instead.

If a broad MCP `run-story-tests` pass fails once because Vite optimized dependencies and reloaded the test environment, rerun before treating it as a story failure. Repeated failures require a scoped config/debug work item rather than story-local workarounds.

## MCP / AI Access

Storybook MCP is enabled as a local design-system context endpoint at:

- `http://localhost:6006/mcp`

Use it to let compatible AI agents read documented components, stories, and Storybook test tools from the current local Storybook. Keep the endpoint local by default.

Do not publish or share a Storybook MCP endpoint, configure a global agent connection, or add remote access without an explicit request. The MCP server exposes design-system and story metadata, so story content must stay synthetic and project-safe.

The repo-owned Codex project config registers this endpoint as the project-scoped `clair_storybook` MCP server. This server is optional (`required = false`) so Codex sessions can still start when Storybook is not running.

Agents should query Storybook documentation before using design-system component props and should not invent undocumented component APIs:

- use `list-all-documentation` to find documented components
- use `get-documentation` before composing a component
- use `get-documentation-for-story` when the component summary is not enough
- use `get-storybook-story-instructions` before adding or changing stories
- use `run-story-tests` for focused Storybook validation when a story changes

When dogfooding the MCP workflow, keep the output as a small recipe story that names which documented primitives were composed and explicitly states that it is not a production workflow surface.

If the MCP `run-story-tests` tool reports a missing Playwright browser, install the matching local Playwright browser cache before treating the test tool as verified.
