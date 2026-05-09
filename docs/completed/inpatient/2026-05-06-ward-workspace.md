---
id: "COMPLETED-INPATIENT-2026-05-06-WARD-WORKSPACE"
status: "done"
area: "inpatient"
doc_type: "closeout"
related_work:
  - docs/work/inpatient/INPATIENT-PR-001-ward-workspace.md
completed_at: "2026-05-06"
---

# Inpatient Ward Workspace Closeout

## Summary

The 병동 placeholder was replaced with a session-only 입원 workspace based on the supplied admission reference image and existing app shell patterns.

## What Changed

- Added inpatient mock admissions, filter/search state, and screen components under `src/features/inpatient/`.
- Wired the `inpatient` registry entry to `InpatientContent` and `InpatientDrawer` without a separate side panel or always-visible right panel.
- Added a generated HTML wireframe at `docs/reference/inpatient/inpatient-workspace-wireframe.html`.
- Added focused Playwright coverage in `tests/inpatient.spec.ts`.

## Product/UI Result

- Main workspace: 입실 추가, 입원실 관리, inpatient basis date picker, dashboard-style KPI cards, ward group filters, search condition, and grouped ward tables.
- Admission detail drawer: opens from a selected ward table row and shows the admission summary, caution tags, care point, and discharge checklist.

## Verification

- `npx tsc --noEmit`
- `npx eslint src/features/inpatient/module.tsx src/features/inpatient/data.ts src/modules/registry.ts src/shell/workspace-frame.tsx src/shell/app-shell.tsx tests/inpatient.spec.ts`
- `npx playwright test tests/inpatient.spec.ts --reporter=line`
- Browser check on `http://localhost:3000/w/clair-demo/inpatient?modulePanel=open&right=open`

## Notes

The reference was supplied in chat and is not persisted under `docs/design/assets/reference-screens/`. Treat the wireframe and implementation as structure/information-priority alignment, not pixel-level alignment.
