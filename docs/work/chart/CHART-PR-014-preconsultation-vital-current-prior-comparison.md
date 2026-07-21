---
id: "CHART-PR-014"
status: "implemented"
area: "chart"
priority: "P1"
target_pr: "Browser comment / current and immediate-prior vital comparison"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/chart/CHART-PR-012-preconsultation-live-integration.md"
  - "docs/work/chart/CHART-PR-013-preconsultation-figma-alignment.md"
dependencies:
  - "CHART-PR-012"
  - "CHART-PR-013"
updated: "2026-07-21"
---

# Current And Immediate-Prior Visit Vital Comparison

## Goal

Make the preconsultation vital table match Figma `27742:18386` for the current-visit date cell and compare only the selected encounter's latest measurement with the immediately preceding encounter's latest measurement.

## Scope

- Render the current row as `오늘 (YY.MM.DD)` with the approved 56px, Neutral 200 border, Common 100 surface, and 15px date typography.
- Remove the old current-time and `현재` treatment from the date cell.
- Read at most one latest vital from the selected encounter and one latest vital from the immediately preceding non-cancelled encounter.
- Keep an absent current vital as an explicit empty state; do not relabel a historical value as today's value.
- Keep an absent prior-visit vital as a one-row comparison with no calculated deltas.
- Preserve the existing RPC signature, membership and `chart:view` enforcement, fixed search path, and authenticated-only execute grant.

## Out Of Scope

- Applying the migration to a remote Supabase project or deploying the application.
- New vital thresholds, clinical interpretation, schema fields, RLS changes, or broader history-table changes.
- Replacing the shared table primitive or changing unrelated header cells.

## Data Contract

1. `currentVital` is the latest `patient_vital_measurements` record whose `encounter_id` equals the selected encounter.
2. `previousEncounter` is the latest non-cancelled encounter for the same patient with `checked_in_at` before the selected encounter.
3. `previousVital` is that encounter's latest measurement only. A visit without a vital does not fall through to an older visit.
4. The UI identifies the current row by `encounterId`, not the array position returned by the RPC.

## Done When

- The browser test proves a second same-encounter measurement is not presented as the comparison row.
- The Figma date-cell surface, border, height, and colors are covered by browser assertions.
- The forward migration keeps the RPC security and access contract intact while encoding current/immediate-prior selection.
- Type, focused browser/server, lint, and docs checks pass locally.

## Verification

- `npx tsc --noEmit`: passed.
- Focused ESLint for the changed chart and browser/server-test files: passed with no errors or warnings.
- `npx playwright test tests/chart-preconsultation-context-server.spec.ts --reporter=line`: 5 passed.
- `npx playwright test tests/chart.spec.ts -g "chart consultation CTA moves from call to start before chart completion" --reporter=line`: 1 passed, including the current/prior-vital and Figma date-cell assertions.
- `npm run docs:check`: passed.
- The migration is intentionally local-only; no remote Supabase apply or application deployment was requested.

## 2026-07-21 Compact Delta Follow-Up

Figma CDS V2 node `27751:83046` is the approved visual contract for compact current-versus-prior deltas.

- Weight, temperature, and respiratory-rate deltas render only parentheses, one CDS direction icon, and the display-precision magnitude. Units and visible direction copy are omitted from the delta group.
- Blood pressure preserves systolic/diastolic order and renders one independently directed part per component, for example `(▲10/▼11)`. If exactly one component is unchanged, its stable position renders as `0`; if both are unchanged, the entire delta group is omitted.
- A missing prior encounter, a missing prior metric, an absent current metric, an incomplete blood-pressure pair, a non-finite value, or a difference that rounds to zero at display precision produces no delta group. The immediate prior encounter remains authoritative and an empty metric never falls through to an older visit.
- Direction color communicates increase/decrease only. Clinical threshold interpretation remains out of scope.
- The example arithmetic is `8.4 -> 6.8 = ▼1.6`; `▼2.4` is incorrect.
- Assistive copy stays concise, for example `체중 변화: 1.6 감소` and `혈압 변화: 수축기 10 증가, 이완기 11 증가`, while those words remain visually hidden.

### Follow-Up Verification

- `npx playwright test tests/vital-comparison-delta.spec.ts --reporter=line`: 5 passed.
- `npx playwright test tests/chart.spec.ts -g "chart consultation CTA moves from call to start before chart completion" --reporter=line`: 1 passed.
- Focused ESLint for the formatter, chart panel, and focused tests: passed with no output.
- `npx tsc --noEmit`: passed with no output.
- `npm run docs:check`: passed.
