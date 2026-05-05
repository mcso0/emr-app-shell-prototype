---
id: "RECEPTION-PR-003"
status: "done"
area: "reception"
priority: "P1"
target_pr: "PR 3"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/ux-flows/reception-appointment-flow.md"
dependencies: []
updated: "2026-05-05"
---

# Reception Registration Quality UX

## Goal

신규 동물/보호자 등록 시 품종 표기, 보호자 등록 동의, 보호자 중복 입력을 session-only MVP 수준에서 정돈한다.

## PR Creation Gate

- Goal: breed autocomplete, consent signing simulation, and duplicate guardian blocking.
- PR size: one PR before calendar drag-and-drop.
- Scope: reception patient/guardian registration dialogs, patient breed editing, session profile store, focused regression tests, docs.
- Out of scope: live DB/API persistence, external tablet/e-sign provider, full breed master catalog, fuzzy duplicate matching.
- Done criteria: guardian search popover, broader species/sex options, autocomplete breed entry, required privacy signing in guardian registration, optional marketing consent, duplicate mobile phone blocking, existing guardian linking for new patients.
- Source docs: reception UX flow, current status, existing registration implementation.
- Verification: lint, TypeScript, reception Playwright suite, docs link check.
- Status/dependencies: done; no external dependency.
- Duplicate check: prior reception work covered check-in flow and calendar visual hierarchy, not registration data quality.

## Verification

- `npm run lint -- src/features/reception/profile-drawer.tsx src/features/reception/patient-profile-store.ts tests/reception.spec.ts` (passed)
- `npx tsc --noEmit` (passed)
- `npx playwright test tests/reception.spec.ts --reporter=line` (`20 passed`)
- `npm run docs:check` (passed)
