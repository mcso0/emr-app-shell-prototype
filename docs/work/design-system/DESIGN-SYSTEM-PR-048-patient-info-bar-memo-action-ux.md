---
id: "DESIGN-SYSTEM-PR-048"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "Project 공통 UX/UI 기준 정리 및 화면 적용 / DEN-437"
linear: "DEN-437"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/design/system/tab-table-density-contract.md"
updated: "2026-06-07"
---

# Patient Info Bar Memo Action UX

## Goal

Clean up the patient info bar memo action so patient-context memo review is clear, compact, and aligned with the shared action, border, shadow, and empty/info contracts.

## Scope

- Replace multiple inline memo buttons with one secondary `메모` context action.
- Show visit purpose, guardian memo, patient memo, and billing memo states inside a compact popover.
- Preserve the existing patient, vital, trailing data, history, scroll, and right-panel controls.
- Keep memo source ownership clear when an item is locked, disabled, or managed by another screen.

## Out Of Scope

- Memo data model changes.
- Live DB persistence, Supabase validation, migrations, RLS, server enforcement, production deploy, or real data access.
- Patient info bar full redesign.
- SOAP section cleanup and project QA closeout.
- Lab/imaging equipment receipt button placement.

## Implementation Notes

- `EmrPatientContextBar` still accepts `memoActions`, but renders them behind one `메모` trigger and an `EmrPopoverShell`.
- The trigger keeps E1 action affordance because it opens a menu-like surface; the popover uses the existing E2 floating surface.
- Chart, lab, and imaging headers provide available visit, guardian, and patient memo summaries from existing mock/local-first data.
- Dispensing/treatment uses unavailable explanations where the current queue snapshot does not expose memo source text.
- Billing memo remains disabled and explicitly points users to the billing screen.

## Verification

- `npm ci`
- `npm run lint` passed with 5 pre-existing warnings.
- `npx tsc --noEmit`
- `npm run docs:check`
- Focused browser check of the patient context `메모` popover.
- Evidence screenshot: `docs/completed/design-system/2026-06-07-den-437-patient-info-bar-memo-action-ux.png`
- Fixed staging deploy: `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app`
- Vercel Preview assigned to fixed staging: `https://emr-app-shell-prototype-2mwdn0d6r-mcso0s-projects.vercel.app`
- Deployment ID: `dpl_5yfzRNHuu7Np4k73gG8hBWdGuf47`

## Handoff Notes

Ready for Human Review.

DEN-438 should handle SOAP structure separately. DEN-439 should do project-level QA after DEN-437 and DEN-438 review results are available.
