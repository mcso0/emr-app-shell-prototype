# EMR SaaS MVP PR 1-6 Realigned Plan

Updated: 2026-05-02

## Current Status

PR 1-6 are complete and merged into `main` as of 2026-05-02. This document remains as the implementation record for that wave. For the current MVP state, next recommended work, and worker checklist, start with `docs/implementation/mvp-current-status.md`.

Completion summary:

- PR 1 Domain Baseline: completed.
- PR 2 Reception Closeout: completed.
- PR 3 Patient/Guardian Drawer: completed.
- PR 4 Chart: completed.
- PR 5 Lab/Image: completed.
- PR 6 Billing: completed.

Final validation for the merged wave included `npm run lint`, `npx tsc --noEmit`, `npm run build`, and the focused Playwright suite covering domain baseline, reception, chart, lab/imaging, billing, and app shell regressions.

## Summary

PR 0 updates the product and implementation documents first. After that, PR 1-6 proceed in this order:

1. PR 1 Domain Baseline
2. PR 2 Reception Closeout
3. PR 3 Patient/Guardian Drawer
4. PR 4 Chart
5. PR 5 Lab/Image
6. PR 6 Billing

The MVP remains encounter-centered: reception creates or advances an encounter, charting consumes the encounter, downstream orders branch into dispensing, lab, and imaging, and billing closes the financial loop.

## Scope

In scope for this wave:

- 접수/예약
- 환자/보호자 드로어
- 진료(차트)
- 임상병리/계통 검사
- 영상검사
- 수납

Out of scope for this wave:

- 입원
- 병원관리 전체 화면
- 병원관리의 Order 관리 / Order 세트 구현
- Excel, KakaoTalk, PACS, and device integrations beyond mock or no-op behavior

## Operating Principles

- Use project foundation, tokens, and existing components first.
- If the existing project does not have an equivalent pattern, create a project-native component from foundation/tokens, or use shadcn combined with existing components.
- Reference screenshots define workflow, density, and layout intent. They are not pixel-perfect implementation specs.
- Preserve the current 조제/처치 screen design and behavior. It can be referenced, but it must not be redesigned as part of PR 1-6.
- Document reusable component candidates before extracting them. Extract only after a pattern is stable across at least two screens.
- Put approval or information gaps in `docs/implementation/open-questions.md` and continue with explicit assumptions.
- Before writing Next.js application code, read the relevant guide in `node_modules/next/dist/docs/`.

## PR Sequence

| PR | Name | Goal | UI Scope |
|---|---|---|---|
| PR 0 | Documentation | Align PRD, feature spec, user flow, DB notes, implementation backlog, reusable candidates, open questions, and reference index. | None |
| PR 1 | Domain Baseline | Verify and extend domain types, labels, and connected mock data for PR 2-6. | None |
| PR 2 | Reception Closeout | Finish 접수/예약 screen details and clean up feedback items. | Reception only |
| PR 3 | Patient/Guardian Drawer | Add patient and guardian profile drawers, edit modes, connection management, CS history, and latest shortcuts. | Drawers/modals |
| PR 4 | Chart | Build 진료(차트) workspace with queue, past history, SOAP, assessment, assessment history, and order area. | Chart only |
| PR 5 | Lab/Image | Build lab and imaging workspaces with queues, result entry, interpretation, attachments, and mock device/PACS flows. | Lab and imaging |
| PR 6 | Billing | Build billing workspace with queues, invoice lines, merge/split, payment methods, and mock payment actions. | Billing only |

## PR 2 Reception Closeout Details

- Side panel tabs are `전체 / 접수 / 예약`.
- Remove counts from the tab labels.
- The list title mirrors the selected tab: `전체`, `접수`, or `예약`.
- The number beside the list title is the filtered list item count.
- Calendar uses 24-hour labels.
- Calendar visible range is `08:00-20:00`.
- Operating hours are `09:00-19:00`.
- Non-operating hours are toned down visually.
- Calendar header remains sticky while scrolling.
- Current-time line crosses from the time-axis divider into the event area.
- Remove the patient info bar, right side panel, separate 진료 대기열, footer schedule button, and redundant form bar.
- Clicking a reception or appointment card opens a detail drawer.
- The veterinarian selector is a today-working-vet multi-select mock; selected veterinarians determine visible schedule lanes.
- The more menu exposes Excel download/upload no-op actions.

## PR 3 Patient/Guardian Drawer Details

- Patient drawer supports read and edit modes.
- Guardian drawer supports read and edit modes.
- Patient and guardian relationship management is session-only in the prototype.
- CS history includes call/response and KakaoTalk history tabs.
- Latest work shortcuts link to implemented modules when available and stay no-op otherwise.
- New patient registration is a modal/layer with session-only validation.

## PR 4 Chart Details

- The chart side panel is a treatment queue.
- The left list in the main workspace is the selected patient's past chart history, similar in structure to dispensing history.
- Core sections include SOAP, Assessment, Assessment History, and a bottom Order area.
- The current 조제/처치 module remains unchanged.

## PR 5 Lab/Image Details

- Lab supports inspection queue, completed queue, result entry, reference range, judgment status, and equipment receipt history mock.
- Imaging supports imaging queue, reading/interpretation, comprehensive comments, attachments, and PACS mock actions.
- Real equipment, PACS, and file integrations are excluded.

## PR 6 Billing Details

- Billing supports waiting, unpaid, and completed lists.
- Billing groups invoice work by guardian.
- Invoice lines support mock editing for amount, discount, tax, and deletion.
- Merge/split and payment actions are prototype session state only.
- Final totals use deterministic mock calculation until billing rules are confirmed.

## Validation

Common validation commands:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Screen PRs add focused Playwright coverage:

- PR 2: reception filters, card selection, check-in, walk-in, calendar time axis.
- PR 3: patient/guardian drawers, read/edit, new patient validation, relationship management.
- PR 4: chart queue selection, past history, SOAP/Assessment rendering.
- PR 5: lab/imaging queues, result entry, interpretation, attachments.
- PR 6: invoice selection, merge/split, total calculation, payment action.

`tests/app-shell.spec.ts` remains the shell/nav regression check. If 조제/처치 files are touched, run a focused regression for that screen as well.
