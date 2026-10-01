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
updated: "2026-07-21"
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
- Current correction frame: `27763:75322` (`1024 × 1365`)
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

- The live data screen follows the Figma information order and the current 1024px source frame geometry.
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
- CHG-003 correction: the historical view now excludes the current encounter and uses the `27728:83189` date-above-card structure (8/24 list inset, 1px neutral divider, 56px row, 69×22 time badge, no status badge). The focused Playwright regression flow and its captured rendered section passed on the isolated local server.
- Release evidence will be appended after staging verification and the separately approved production promotion.

## 2026-07-21 Figma correction

- The latest source frame is `27763:75322`. Its 1024px root width replaces the earlier 1200px geometry for this surface.
- The route-local header now uses the inspected 72px animal avatar, 24px identity gap, 28/38 patient name, 16/24 metadata, 32px patient and guardian information actions, and a call split group. Existing call and information-sheet behavior remains owned by the chart feature.
- Section titles use 16/24 with an 18px icon and 6px gap. Visit purpose and memo body use 14/20. Vitals use a 960px table with a 148px date column and 52px data rows. History dates use 14/20 and card summaries use 15/24, matching the latest Figma values.
- The separate guardian information Sheet exposes only the name and memo already present in the preconsultation read model; no data, API, persistence, or permission boundary changed.
- Figma omits the current today-vital edit entry point. On 2026-07-21, the product owner confirmed this is a Figma omission; keep the existing edit entry point and treat the project implementation as correct rather than as a visual discrepancy.
- Focused TypeScript, ESLint, preconsultation call-flow, and queue-selection browser tests pass. The full chart suite run before the final selector update reported 24 passed / 7 failed; the added failure was resolved by the final queue-selection assertion. The six remaining failures are pre-existing unrelated chart assertions and were not re-run as a full suite after that narrow fix.
- A fresh PNG capture of Figma node `27763:75322` confirmed the header identity is fully opaque at the source viewport. The route-local `PatientIdentity` no longer applies inherited 80% opacity, preserving the Figma contrast for the patient and guardian name without changing data or interaction behavior.

## 2026-10-01 waiting surface release

- 승욱 authorized commit, push, PR, merge to `origin/main`, and production deployment for the waiting-chart surface correction.
- Ready/loading panels use the existing `ScrollArea`; scrollbar visibility is scoped to hover and the centered inner body retains its 1024px maximum. The viewport retains scroll fading and explicitly hides horizontal overflow.
- The waiting chart root uses `--emr-surface-panel` (common-100 / white), including error and loading states. In the current production document layout, only waiting charts remove the center gutter and outer document maximum so the scrollbar reaches the center-content right edge. Active charts and other document modules keep their width policy.
- Release preparation uses a clean current-main worktree; unrelated primary-checkout WIP is preserved. Previous production: `e4d382a76e52943193524c0e9a2d944c77b49838`, deployment `dpl_FCrzH56ci7Qz9TALfLkyMhtkDMaP`. Rollback is a revert of this release or restoration of that deployment.
- Preflight: local secret scan, docs, diff, lint, TypeScript, build, focused chart tests, exact-candidate manual Release Check, and Ready PR preview. Stop on a failed required gate or scoped smoke failure. Existing production environment settings are retained; no remote data or environment mutation is included.
- Production smoke targets login and the synthetic Cheongdam treatment route. Deployment readiness, HTTP route status, and authenticated geometry verification are separate evidence.
- Local candidate verification passed: secret scan, docs, diff check, lint (five existing unused-variable warnings in unrelated scripts), TypeScript, production build, and two focused Playwright tests. The CTA fixture explicitly omits blood pressure to retain its existing four-vital-column scenario. The separate waiting-vital test still targets the old `오늘 바이탈 입력` dialog and remains outside this release's required checks.
