---
id: "CHART-PR-013"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "User request / Figma-exact preconsultation implementation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/chart/CHART-PR-012-preconsultation-live-integration.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-080-emr-empty-state-read-error.md"
dependencies:
  - "CHART-PR-012"
  - "DESIGN-SYSTEM-PR-080"
updated: "2026-07-18"
---

# Figma-aligned Preconsultation Screen

## Goal

Apply the approved standalone implementation report to the live preconsultation screen while preserving the existing permission-gated data read and consultation-call flow.

## Design source

- Figma file: `CDS.V2 CLAiR EMR Design System Ver.2`
- Primary frame: `27728:82812`
- Intake section: `27728:83059`
- Vitals section: `27728:83101`
- History section: `27728:83189`
- Standalone implementation report: `chart-precall-design-review/dist/report.html`

## Scope

- Recompose the live screen as header, reception, visit purpose, patient/guardian memo, vitals, and history.
- Remove the duplicate right-side patient summary from this pre-call surface.
- Preserve the existing live context API, permission enforcement, patient-information Sheet, room selection, and call transition.
- Add the shared `AnimalPatientAvatar` visual component and Storybook states for image, fallback, loading, error, and size scale.
- Use shared `EmrEmptyState kind="read-error"` for whole-content read failure with retry and safe return-to-queue actions.
- Keep loading, empty-vitals, empty-history, mobile wrapping, keyboard semantics, and horizontal vital-table overflow explicit.

## Out of scope

- Patient photo upload, registration-modal changes, storage buckets, schema fields, migrations, or API response changes.
- Inventing expected-duration data. The existing read model has no duration field, so the Figma slot displays `미입력`.
- New vital thresholds, clinical interpretation, or changes to the consultation state machine.
- Changes to the shared color, typography, radius, spacing, or motion token contracts.

## Done criteria

- The live data screen follows the Figma information order and 1200px source frame geometry.
- Patient and guardian memos are visible in the main reading flow; the right duplicate summary is absent.
- The animal avatar has an accessible, shared fallback contract without introducing patient image persistence.
- Whole-content read failure uses the registered shared empty-state kind and both recovery actions.
- Focused type, lint, component contract, Storybook, chart browser, build, docs, and secret checks pass.
- A Korean HTML result report records scope, verification, release evidence, and remaining gaps.

## Verification

- `npx tsc --noEmit`: passed.
- Focused ESLint for the changed chart, shared-component, Storybook, and browser-test files: passed.
- `scripts/test-animal-patient-avatar-contract.mjs` and `scripts/test-emr-empty-state-read-error-contract.mjs`: passed.
- Focused Playwright for the normal preconsultation flow, whole-content read failure, and queue patient switch: 3 passed.
- Complete `tests/chart.spec.ts`: 24 passed / 6 failed. The same six failures reproduce on the untouched `origin/main` baseline and are not introduced by this change.
- `npm run build-storybook`: passed; the static bundle contains `AnimalPatientAvatar` and `EmrEmptyState` stories.
- `npm run build`: passed with the existing broad NFT trace warning from `src/lib/prd-viewer/doc-reader.ts`.
- Figma source and implementation were compared at the same 1200px content width. Header, section order, vital table, and history timeline were aligned after the comparison.
- Release evidence will be appended after staging verification and the separately approved production promotion.
