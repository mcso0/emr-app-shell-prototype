# Design Docs

Design docs explain how CLAiR EMR should look, behave, and remain usable across dense veterinary workflows. Use this area for UX, visual system, screen behavior, reference assets, and design QA.

## Read First

- Design system: `docs/design/system/DESIGN.md`
- Reference screen index: `docs/design/reference-screen-index.md`
- Senior product design development points: `docs/design/flows/2026-05-12-senior-product-design-development-points.md`
- UI QA index: `docs/design/qa/README.md`
- Core workspace UI review checklist: `docs/design/qa/core-workspace-ui-review-checklist.md`
- Interaction accessibility audit: `docs/design/qa/interaction-accessibility-audit.md`
- Responsive dense layout audit: `docs/design/qa/responsive-dense-layout-audit.md`

## Subareas

- `flows/`: task sequence, navigation, cross-screen continuity, and interaction flow.
- `screens/`: concrete screen-level layout, density, state, and interaction rules.
- `system/`: reusable UI foundations, tokens, components, and conventions.
- `qa/`: visual, responsive, and interaction QA checklists.
- `assets/`: design assets and reference material.
- `assets/reference-screens/`: checked-in reference images.
- `decisions/`: durable UX, visual, or interaction decisions.
- `ux-flows/`: compatibility area for older user journeys. Prefer `flows/` for new docs.

## Boundaries

- Design docs define experience guidance and reusable visual/interaction rules. Implementation execution belongs in `docs/work/`.
- Do not turn one-off UI tweaks into reusable design rules unless the pattern applies across screens or components.
- Reference screenshots must be checked for actual file existence before claiming visual alignment.
- For frontend implementation work, read the relevant Next.js guide in `node_modules/next/dist/docs/` before coding.
- Keep historical design reports in `docs/completed/design/`; they are evidence, not the current design source of truth.

## Adding Design Docs

Use `docs/_meta/intake-rules.md` and `docs/_meta/documentation-depth-rules.md` before adding a new design doc. Prefer updating an existing canonical design system, flow, screen, or QA doc when the guidance already has a home.
