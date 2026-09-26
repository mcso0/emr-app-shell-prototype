---
id: "DESIGN-SYSTEM-PR-091"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "PR #554 / CDS.V2 patient information bar"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-038-cds-v2-app-shell-scope.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-048-patient-info-bar-memo-action-ux.md"
updated: "2026-08-15"
---

# CDS.V2 Patient Context Bar

## Goal

Align the existing shared patient context bar with Figma node `27383:24831` without introducing screen-local variants or a second patient-bar component.

## Scope

- Keep `EmrPatientContextBar` as the shared owner for chart, dispensing, lab, and imaging; the chart compatibility wrapper delegates to it.
- Separate patient and guardian identity into their own icon-led sections.
- Preserve vital values as display-only badges and keep their server-owned read contract unchanged.
- Show the Figma memo set as four compact inline actions while retaining the existing shared memo popover for summaries, locked states, and unavailable reasons.
- Map the 56px bar, 36px sections, asymmetric padding, 24px icon tiles, dividers, fade, and controls to existing CLAiR/EMR spacing, radius, color, typography, and shadow tokens.
- Preserve the existing fixed right controls and horizontally scroll only the information track.

## Out Of Scope

- New patient, guardian, or vital-write navigation.
- New permissions, APIs, persistence, Supabase, RLS, migrations, or production release.
- A second shared abstraction, a broad header refactor, or unrelated screen styling.
- Figma writes or Code Connect changes.

## Done Criteria

- Patient, guardian, vital, and memo sections render in the Figma order from the existing shared component.
- All four direct consumers provide guardian data through the shared `guardianItems` contract.
- Memo buttons use the Figma labels and icon hierarchy; disabled states and existing popover details remain accessible.
- Shared geometry uses tokens and exposes stable `data-slot` hooks for focused regression checks.
- Existing display-only vital contract, overflow controls, and right-panel actions remain intact.

## Verification

- `npm run security:secrets`: passed.
- `npm run docs:check`: passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with the existing Turbopack NFT trace warning.
- `git diff --check`: passed.
- `tests/patient-vital-server.spec.ts`: 10/10 passed.
- Focused chart hover browser regression: 1/1 passed.
- Focused dispensing patient-context browser regression: 1/1 passed.
- Local mock-auth browser QA: patient, guardian, vital, memo, overflow, disabled billing memo, and memo popover verified.
- Manual GitHub Release Check for the PR candidate: passed.
- Vercel Preview for the PR candidate: Ready.

## Result

The shared patient bar now follows the approved CDS.V2 composition while preserving current domain ownership and avoiding screen-specific forks. The hover variants from Figma node `27936:111406` are also represented: every section uses the specified hover surface and icon-tile treatment, while patient/guardian chevrons, the vital plus, and the memo ellipsis appear in a right-edge gradient overlay. The base contract remains display-only unless a feature explicitly supplies an interaction.

## CHART-PR-023 Follow-up

The shared component now exposes optional patient/guardian preview activation and vital-action contracts. It still owns no data fetching, profile state, permissions, or persistence. CHART-PR-023 originally enabled these contracts only in chart; that was the scope of that release.

## 2026-09-27 Local Follow-up

Lab, imaging, and dispensing now opt into the existing profile preview, profile drawer, and vital dialog contracts. Live profile actions appear only after the selected work item resolves to a real patient ID and the workspace-scoped profile read succeeds. Billing keeps its guardian-centered summary layout and adds the same preview and drawer behavior to each identified guardian/patient badge. Vital actions continue through the existing permissioned latest-vital read and guarded chart vital writer; completed work is disabled in the context bar. This follow-up is implemented locally and has not been delivered to the production deployment.
