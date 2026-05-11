---
id: "DESIGN-SYSTEM-PR-002"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 2"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
dependencies:
  - "DESIGN-SYSTEM-PR-001"
updated: "2026-05-11"
---

# UI Consistency Audit

## Goal

Audit representative CLAiR EMR screens deeply enough to identify the system-level reasons typography, spacing, button hierarchy, surface, elevation, and layout feel inconsistent.

## PR Gate

- Goal: produce an audit-only design-system document that guides the next foundation-first PRs.
- PR-sized scope: work item, QA audit document, work index registration, completion closeout.
- Out of scope: UI code, token files, component APIs, generated Clair tokens, canonical `DESIGN.md` changes, screenshots/assets.
- Done criteria: audit covers Home, Chart, Billing, Lab, Imaging, Dispensing, and Hospital Admin; findings include problem, affected screens, representative code references, design-system implication, and recommended next PR type.
- Source docs: current status, CLAiR EMR design guide, Light Operational Foundation.
- Verification: `npm run docs:check`.
- Status/dependencies: done; depends on DESIGN-SYSTEM-PR-001.
- Duplicate check: DESIGN-SYSTEM-PR-001 created the initial light operational foundation but did not audit typography, spacing, button hierarchy, elevation, layout, or cross-screen component adoption.

## Scope

- Audit representative screen files and shared EMR primitives for repeated visual inconsistencies.
- Prioritize issues by system impact:
  - S1: repeated across several representative screens or shared components
  - S2: repeated within a screen family or major shell pattern
  - S3: local cleanup candidate
- Use text plus code references instead of committed screenshots.
- Produce a foundation-first follow-up sequence.

## Out Of Scope

- Editing `src/styles/tokens/*`.
- Refactoring `Button`, `Table`, `Card`, `Badge`, or EMR primitives.
- Updating `docs/design/system/DESIGN.md`.
- Running visual regression suites.

## Verification

- `npm run docs:check`

## Completion Notes

Completed on 2026-05-11.

- Added the representative UI consistency audit.
- Registered DESIGN-SYSTEM-PR-002 in the work index.
- Added a closeout under `docs/completed/design/`.
- Kept all UI code, tokens, and canonical design guidance unchanged.
