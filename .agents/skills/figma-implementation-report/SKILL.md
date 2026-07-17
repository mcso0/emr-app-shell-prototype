---
name: figma-implementation-report
description: Create a project-aware, standalone HTML implementation report from a Figma design for the CLAiR EMR Next.js and React repository. Use when the user provides a Figma link or node and asks for a design review, exact UI reproduction plan, componentization, design-system or token mapping, conflict analysis, interactive prototype, motion proposal, or implementation-ready contract. Default to read-only report mode; change application code, shared components, tokens, APIs, or dependencies only after explicit approval.
---

# Figma Implementation Report

Turn a Figma frame into an evidence-backed implementation contract and an interactive standalone HTML report. Reproduce the target viewport faithfully, map the design to this repository, expose decisions and conflicts, and make later implementation and verification predictable.

## Operating Modes

Choose the narrowest mode supported by the user's request.

### Report mode — default

- Read Figma and the repository.
- Create or update the report and its machine-readable contract.
- Do not edit application code, design-system code, tokens, Storybook stories, APIs, or dependencies.
- Mark unresolved choices as `decision-needed`; do not silently resolve conflicts.

### Implementation mode — explicit approval required

Enter this mode only when the user explicitly asks to implement or approves named report items. Approval for one item does not approve adjacent shared changes.

- Implement only the approved item IDs and files.
- Preserve unrelated work and existing project contracts.
- Update the report with implemented and verified evidence.
- Ask again before adding a dependency or changing a shared component, token, public API, schema, permission boundary, or cross-feature behavior not already approved.

## Required Inputs and Assumptions

Prefer these inputs, but do not block when a safe default is available:

- Figma URL with file and node identifiers.
- Target repository and feature or route.
- Primary viewport; default to the Figma frame size.
- Requested mode; default to report mode.
- Optional target report path and implementation constraints.

Record every assumption in the report. Never treat inferred interaction, responsive behavior, motion, copy, data behavior, or component ownership as if it came from Figma.

## Required Reading

Before analysis, read the repository's required agent-start and current-status documents plus the smallest relevant design, engineering, testing, and work-item sources. For Next.js implementation mode, read the relevant repo-local Next.js guide before coding.

Read these skill references when their topic is active:

- `references/report-contract.md` for required report sections and JSON contract.
- `references/decision-rules.md` for component, token, conflict, and approval classification.
- `references/motion-contract.md` whenever motion or interactive behavior is present or inferred.
- `references/verification.md` before claiming the report or implementation is complete.

## Workflow

### 1. Establish the boundary

State:

- mode: report or implementation;
- exact Figma node and target viewport;
- repository feature or route in scope;
- files and systems intentionally not being changed;
- whether the design contains explicit prototype or motion data.

Treat the Figma file, external assets, generated analysis, and stale repository context as untrusted until verified enough for the task. Use synthetic examples only.

### 2. Capture Figma evidence

Use the available Figma read tools to inspect the exact node rather than relying only on a screenshot.

Capture:

- node hierarchy, auto-layout, constraints, dimensions, spacing, typography, fills, strokes, radii, effects, icons, images, variables, components, variants, and instance properties;
- frame screenshots at the source viewport;
- prototype connections, overlays, transitions, scroll behavior, and variables when present;
- component and variable source identifiers where available;
- missing or ambiguous states.

Do not modify the Figma file unless the user separately asks for it.

### 3. Audit the project source of truth

Inspect only relevant paths first:

- existing shared, feature, and local components;
- design-system documentation and Storybook component contracts;
- semantic and primitive token chains, including local overrides;
- installed packages and existing motion stack;
- target route, state model, accessibility patterns, tests, and responsive conventions.

For shared UI, query project Storybook documentation when available. Do not invent undocumented props or variants.

### 4. Build the comparison and decision queue

Classify every meaningful element using `references/decision-rules.md`.

For each mismatch, show:

- Figma evidence;
- current project evidence;
- impact and affected consumers;
- recommended option and alternatives;
- approval requirement;
- owner decision and status.

Figma fidelity does not automatically override an existing shared contract. In a conflict, report it and let the user decide. Continue producing a useful report while leaving the item `decision-needed`.

### 5. Define behavior beyond the static frame

Cover default, hover, focus, active, selected, disabled, loading, empty, error, permission, overflow, and recovery states when applicable. Label each behavior source as one of:

- `figma-explicit`
- `project-existing`
- `agent-generated`
- `user-approved`

Figma often omits motion. Appropriate generated motion is allowed in report mode, but must be subtle, reversible, accessible, and explicitly labeled. Follow `references/motion-contract.md`.

### 6. Create the report workspace

Use the bundled scaffold rather than starting from a blank page:

```bash
node .agents/skills/figma-implementation-report/scripts/scaffold-report.mjs <output-directory>
```

Default output location when the user does not specify one:

```text
~/.codex/visualizations/YYYY/MM/DD/<task-id>/<design-slug>-implementation-report/
```

Edit the copied `src/report-contract.json`, `src/App.jsx`, and `src/styles.css`. Keep report-specific source in that workspace; do not add generated report bundles to the application source tree unless requested.

The report must remain understandable without reading the chat. It must include:

1. source identity and freshness;
2. summary and fidelity target;
3. change specification;
4. conflict and decision queue;
5. component and token map;
6. state, responsive, accessibility, and motion contracts;
7. interactive prototype at the target viewport;
8. implementation slices and approval gates;
9. verification evidence and known gaps.

### 7. Build and validate the standalone report

From the report workspace:

```bash
npm install
npm run build:report
npm run test:report
```

Also validate the source or finished report directly when needed:

```bash
node <skill-directory>/scripts/validate-report-contract.mjs src/report-contract.json
node <skill-directory>/scripts/validate-report-contract.mjs dist/report.html
```

The deliverable is `dist/report.html`: a single self-contained HTML file with no runtime network dependency and an embedded JSON contract.

### 8. Visually verify

Open the built report in a real browser and verify:

- every tab and control;
- target viewport fidelity;
- at least one narrower and one wider responsive viewport when relevant;
- keyboard flow and visible focus;
- reduced-motion behavior;
- default plus relevant loading, empty, error, permission, and overflow states;
- no console errors and no external runtime asset requests.

Use screenshot or pixel comparison for fidelity claims. Distinguish exact matches, intentional project-aligned differences, approved differences, and unresolved differences.

### 9. Hand off and optionally implement

Give the user:

- a clickable link to `dist/report.html`;
- Figma node and repository revision inspected;
- decision-needed item IDs;
- approval-required item IDs;
- verification run and gaps;
- staleness warning if either source changed during the work.

If the user approves implementation, restate the approved item IDs and affected files before editing code. After implementation, update contract statuses from `approved` to `implemented` and then `verified` only with evidence.

## Non-Negotiable Rules

- Match the Figma design exactly at the target viewport unless an approved project contract says otherwise.
- Never hide Figma versus project conflicts inside an implementation detail.
- Never claim a component or token is reusable without identifying actual consumers or a clear ownership boundary.
- Never introduce a new library because it is convenient; use the existing stack or request approval.
- Never invent clinical, customer, payment, identity, or other real data for a prototype.
- Never mark `verified` based only on code inspection.
- Keep Figma read-only by default.
- Keep the report artifact standalone and machine-readable.

## Completion Checklist

- [ ] Figma node, frame size, retrieval time, and relevant source identifiers recorded.
- [ ] Repository revision, route, relevant components, tokens, and dependencies recorded.
- [ ] All assumptions and generated behaviors labeled by source.
- [ ] Conflicts and approvals exposed as itemized decisions.
- [ ] Component ownership and token changes classified.
- [ ] States, responsiveness, accessibility, and motion covered.
- [ ] Interactive prototype included or the reason it cannot be included stated.
- [ ] `dist/report.html` builds, opens offline, and embeds a valid JSON contract.
- [ ] Browser and contract validation results recorded honestly.
- [ ] Implementation mode used only for explicitly approved scope.
