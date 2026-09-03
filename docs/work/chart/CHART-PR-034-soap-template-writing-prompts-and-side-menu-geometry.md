---
id: "CHART-PR-034"
status: "in_progress"
area: "chart"
priority: "P1"
target_pr: "User-approved editable SOAP writing prompts and side-menu geometry fix"
source_docs:
  - "docs/work/chart/CHART-PR-030-blocknote-soap-live-persistence.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/qa/interaction-accessibility-audit.md"
dependencies:
  - "CHART-PR-030"
updated: "2026-09-03"
---

# Editable SOAP Writing Prompts And Side-Menu Geometry

## Goal

Make the existing BlockNote SOAP editor easier to start and safer to operate without adding a new template UI, block type, field, or persistence path.

## Approved Scope

- Put concise, directly editable veterinary writing prompts into the existing S/O/A/P paragraph blocks used by a new note, reset, and the default slash-menu template.
- Keep the existing four `soapSection` blocks and one paragraph per section.
- Hide only the indentation guide drawn for a SOAP section's direct child block.
- Expand the grab control from 16x24px to 24x24px while preserving the existing 8px gap to the writing block.
- Preserve deeper nested-block guides, add/drag/menu behavior, legacy-note hydration, and the canonical BlockNote document contract.

## Out Of Scope

- New template selectors, chips, structured clinical fields, autocomplete, AI, or placeholder APIs.
- Schema, API, RPC, database, permission, autosave, conflict, audit, or downstream projection changes.
- Prefilled claims such as `WNL`, `normal`, or `이상 없음` that could be mistaken for observed findings.
- Changes to system-specific templates such as the musculoskeletal template.

## Research Basis

- University of Wisconsin Veterinary Medical Teaching Hospital, *SOAP Writing Guide*: S/O/A/P content, problem list, differentials, diagnostic plan, and treatment plan.
- University of Minnesota, *Client Encounters*: history and client communication context.
- College of Veterinarians of Ontario, *Medical Records Guide to the Standard*: concise and complete problem, assessment, plan, and client-communication records.
- Australian Small Animal Veterinarians, *Manual of Hospital Standards and Accreditation*: problem-oriented records using SOAP or HEAP.

## Done Criteria

1. New/reset/default-template S/O/A/P paragraphs contain the approved editable prompts.
2. Existing note content remains unchanged when hydrated.
3. Direct SOAP child guides do not intersect the add/grab controls; deeper nested guides remain visible.
4. Add and grab controls are both 24x24px and keep 8px clearance from the writing block.
5. The sectioned template remains editable and does not overflow at 320, 420, 566.5, or 720px.
6. Focused tests, lint, typecheck, build, Storybook build, docs check, secret scan, and diff check pass before release.

## Verification Plan

- Focused SOAP document unit test for prompt hydration and no prefilled normal findings.
- Focused Storybook browser tests for direct-child guide suppression, deeper guide preservation, 24px controls, editable content, and responsive widths.
- Existing SOAP Storybook interaction suite and relevant chart regression tests.
- Standard production preflight and exact-candidate manual Release Check.

## Rollback

- Revert the application commit and redeploy the previous production deployment.
- No database or persisted schema rollback is required.
