---
id: "INPATIENT-PR-001"
status: "done"
area: "inpatient"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - docs/agent-start-here.md
  - docs/engineering/current-status.md
  - docs/design/reference-screen-index.md
  - docs/reference/inpatient/inpatient-workspace-wireframe.html
dependencies: []
updated: "2026-05-06"
---

# Inpatient Ward Workspace

## Goal

Replace the 병동 placeholder with a first-pass inpatient workspace that keeps the existing app shell structure while reflecting the supplied admission reference screen.

## PR Gate

- Goal: 병동 메뉴에서 입원 환자/입원실/위험 태그/담당/퇴실 상태를 빠르게 스캔하고 관리할 수 있는 MVP 화면을 제공한다.
- PR-sized scope: one new feature module, mock inpatient data/store, registry wiring, focused Playwright coverage, wireframe/reference docs.
- Out of scope: live hospitalization persistence, bed master CRUD, consent document signing, medication/rounding execution, billing handoff integration, 병원관리 Order 관리 or Order 세트 implementation.
- Done criteria: 병동 메뉴가 placeholder 대신 실제 화면을 렌더링하고, 입원 추가/입원실 관리/상태 필터/검색/퇴실 준비 상태가 화면 구조에 반영된다.
- Source docs: current MVP status, reference screen index, supplied chat screenshot as non-persistent layout reference, generated HTML wireframe.
- Verification: `npm run lint`, `npx tsc --noEmit`, focused Playwright test for inpatient workspace.
- Status/dependencies: ready/in progress; no live DB/API dependency.
- Duplicate check: no existing inpatient work item in `docs/work/index.md` or `docs/work/inbox.md`.

## Reference Screen Analysis

The supplied admission reference is a dense table workspace with these functional signals:

- Date navigation with today shortcut.
- Primary action: `입실 추가`.
- Category grouping by species/treatment bucket such as 강아지, 고양이, 집중 치료실.
- Search condition dropdown and keyword search.
- `입원실 관리` entry.
- Table fields: 입원실, 동물명, 품종, 주보호자명, 차트확인, 유의사항, 진단명, 입실 메모, 입실시점, 기간, 진료과, 주치의, 담당의, 주 담당자, 부 담당자, 퇴실처리.
- Colored caution tags such as 산소, DNR, 금식, 면회금지, CPR.
- Disabled/available states for chart and discharge actions.
- Long text overflow tooltips for diagnosis, memo, owners, and cautions.

## Develop Points Reflected In Wireframe

- Keep the table density, but move coarse operational status to a left side queue so the central table is not the only navigation surface.
- Add a top KPI strip for occupied rooms, critical flags, discharge-ready cases, and today admissions.
- Preserve species/ward grouping, but use tabs and badges instead of repeating large table sections for every group.
- Promote risk/care tags into compact color-coded badges that match existing token usage.
- Add a right patient/bed detail panel for selected admission summary, care plan, and discharge checklist.
- Use existing shell slots: `sidePanel`, `content`, and `rightPanel`.
- Use shadcn UI primitives already in the repo: Button, Input, Badge, Table, ScrollArea, SegmentedControl, Select, Checkbox, Textarea where needed.

## Scope

- Add `src/features/inpatient/*` for mock data, store, and module components.
- Wire the `inpatient` registry entry to the new screen.
- Add `docs/reference/inpatient/inpatient-workspace-wireframe.html`.
- Add a focused Playwright spec that verifies the new 병동 workspace renders and core filters/actions are present.
- Update work index/current status/closeout after implementation.

## Out Of Scope

- Actual hospitalization schema changes or Supabase persistence.
- Bed master CRUD beyond a visible management entry point.
- Medication administration, vitals charting, nursing task completion, or billing transfer logic.
- Pixel-perfect match to the chat screenshot.

## Done When

- 병동 route renders an inpatient workspace instead of the placeholder.
- The screen includes admission functions listed above and the developed wireframe structure.
- Search/status filtering changes the visible admission rows.
- Right panel displays selected patient/room detail and discharge readiness.
- Verification commands pass or any failure is recorded.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/inpatient.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/inpatient?modulePanel=open&right=open`

## Handoff Notes

This is a session-only prototype. The current reference came from the chat image, not a stored binary asset under `docs/design/assets/reference-screens/`, so do not claim pixel-level alignment.

Completed on 2026-05-06. Closeout: `docs/completed/inpatient/2026-05-06-ward-workspace.md`.
