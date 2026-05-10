---
id: "HOME-V1-EPIC-PLAN"
status: draft
area: product
doc_type: epic-plan
related_docs:
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
related_work:
  - "docs/work/home/HOME-PR-001-role-command-home-foundation.md"
  - "docs/work/home/HOME-PR-002-home-work-entry-v1.md"
  - "docs/work/home/HOME-PR-003-home-kanban-workspace.md"
last_updated: "2026-05-09"
---

# Home v1 Epic Plan

## Goal

홈을 역할별 대시보드에서 모든 직원이 사용하는 업무 시작점으로 개편한다.

홈은 사용자가 가장 먼저 묻는 질문에 답해야 한다.

> 오늘/지금 내가 뭘 해야 하지?

## Product Principles

- 홈의 기본값은 `내 업무`다.
- `내 업무`는 사용자에게 요청되었거나 사용자가 담당자로 지정된 action이다.
- 홈은 업무 상태를 변경하지 않고, 원본 업무 화면으로 진입시킨다.
- 홈 action은 `열기`, `확인하러 가기` 수준으로 제한한다.
- 병원관리 KPI와 운영관리 상세는 홈 기본 화면에서 제외한다.
- 전역 notification은 별도 기능이며, 모든 notification이 홈 업무가 되지는 않는다.
- 내 업무가 없을 때도 홈은 역할/책임별 업무 시작 런처를 제공한다.

## Epic 1: My Work Timeline

### Outcome

사용자는 홈에서 오늘/지금 자신에게 요청된 업무를 우선순위 순서로 확인하고 원본 업무 화면으로 이동할 수 있다.

### User Stories

- As a staff member, I can see tasks requested to me or assigned to me in one prioritized list.
- As a multi-role staff member, I can see work across my active responsibilities without switching role dashboards.
- As a staff member, I can open the relevant workflow screen from a home task.
- As a staff member, I do not complete, cancel, claim, or finalize work directly from Home.

### Acceptance Criteria

- Home default body is `내 업무`.
- My Work shows only tasks requested to the user, assigned to the user, or assigned to one of the user's active roles.
- My Work does not show generic hospital KPI cards such as revenue, visitor counts, or full inventory dashboards.
- Default My Work list shows no more than 5-7 visible tasks before requiring filtering or expansion.
- Each task card includes:
  - task title
  - patient/guardian/encounter context when available
  - source/requester or reason
  - urgency/due state
  - recommended next action
  - entry link to the original workflow screen
- Home task actions are limited to `열기` or `확인하러 가기`.
- Home does not expose `담당하기`, completion, cancellation, payment completion, message send, result confirmation, or chart completion actions.

## Epic 2: Work Generation Rules

### Outcome

홈의 `내 업무`는 환자 접수 이후의 실제 workflow request, assignment, order, or status transition에서 생성된다.

### User Stories

- As a veterinarian, I can see patients assigned to me for consultation.
- As a technician, I can see dispensing, treatment, or care work requested or re-requested by a veterinarian.
- As a lab or imaging staff member, I can see test or imaging work requested or re-requested by a veterinarian.
- As a billing staff member, I can see payment, interim settlement, or unpaid follow-up work created from care flow.
- As an inpatient staff member, I can see admission registration, inpatient care, and discharge management work requested from care flow.
- As a desk staff member, I can see reception, waiting-room, guardian communication, and document tasks that require desk action.

### Acceptance Criteria

- Work items are generated from workflow events described in `home-work-generation-rules-v0.md`.
- Patient is treated as the work context; the actionable work comes from encounter, order, request, assignment, or status transition.
- Clinical values do not automatically create Home critical tasks by interpretation alone.
- Lab/imaging result completion creates a review task for the responsible veterinarian.
- Recheck/retest requests from a veterinarian create high-priority tasks for the lab/imaging staff.
- Dispensing/treatment tasks are generated from requests, re-requests, overdue state, or change requests.
- Billing tasks are generated from payment request, interim settlement, payment delay, billing confirmation, or unpaid state.
- Inpatient tasks are generated from admission request, care schedule, overdue care, recheck request, or discharge management.

## Epic 3: Role Queue And Assignment

### Outcome

미배정 role 업무는 해당 role 사용자들에게 보이고, 원본 업무 화면에서 누군가 담당자가 되면 다른 사용자들의 홈 `내 업무`에서는 사라진다.

### User Stories

- As a role-based staff member, I can see unassigned work for my role in My Work.
- As a staff member, when another colleague claims a role task, it no longer appears in my Home My Work list.
- As a staff member, I can still see claimed work in the original group work list with its current assignee/status.

### Acceptance Criteria

- If a work item has `assigneeRole` and no `assigneeUser`, users with that role see it in Home My Work.
- If a work item is claimed in the original workflow screen, it becomes personal work for the claim user.
- Once claimed, the task is removed from other same-role users' Home My Work list.
- Claimed work remains visible in the original group work list.
- Original group work list displays assignee/status such as `미배정`, `처리중`, or `완료`.
- Home does not provide claim action.

## Epic 4: Empty State And Work Launcher

### Outcome

내 업무가 없는 사용자는 빈 화면이 아니라 자신의 업무를 시작할 수 있는 compact launcher를 본다.

### User Stories

- As a desk staff member with no requested work, I can quickly open reception, walk-in check-in, or payment waiting.
- As a veterinarian with no requested work, I can quickly open consultation queue, charts, or lab results.
- As a technician with no requested work, I can quickly open dispensing/treatment queue, lab queue, or inpatient care.
- As a billing staff member with no requested work, I can quickly open payment waiting, unpaid list, or interim settlement.
- As an inpatient staff member with no requested work, I can quickly open ward board, pending admission, or discharge checklist.

### Acceptance Criteria

- Empty My Work state is treated as normal.
- Empty state does not fill the space with unrelated hospital-wide dashboard data.
- Empty state displays calm copy and compact entry actions.
- Empty state launchers are determined by user role/responsibility.
- Empty state does not include hospital management KPI cards.

## Epic 5: Quick Status And Flow Summary

### Outcome

홈은 사용자가 업무 시작 전에 알아야 할 핵심 상태만 압축해서 보여준다.

### User Stories

- As a staff member, I can quickly see how many tasks require my attention.
- As a staff member, I can see urgent, overdue, or unassigned counts without reading a full dashboard.
- As a staff member, I can see a compact hospital flow summary when it affects my work.

### Acceptance Criteria

- Top quick status uses compact chips rather than long summary paragraphs.
- Quick status prioritizes work-start signals such as `내 업무`, `긴급`, `지연`, or role queue count.
- Hospital flow is compressed into a compact summary or separate lens.
- Flow summary does not expand into full hospital operations dashboard by default.
- Hospital management metrics such as revenue, visitor count, staff operations, and inventory report are excluded from the default Home.

## Epic 6: Notification Boundary

### Outcome

전역 notification과 홈 내 업무의 책임을 분리한다.

### User Stories

- As a staff member, I can receive user/role-specific notifications from the global notification area.
- As a staff member, I only see notifications in Home My Work when they require my action.
- As a staff member, I can distinguish actionable work from awareness-only notifications.

### Acceptance Criteria

- Global notification is treated as a separate app-level feature, not as part of Home implementation.
- Home My Work includes only actionable work that belongs to the user or user's active role.
- Awareness-only notices, system messages, background state changes, and hospital management notices are not inserted into Home My Work by default.
- A notification can link to Home-related work, but notification presence alone does not make it a Home task.

## Out Of Scope For Home v1

- Live DB/API persistence
- Server-side permission enforcement
- Realtime socket implementation
- Full global notification center implementation
- Hospital management dashboard
- Revenue, visitor, staffing, and inventory KPI dashboards
- Finalizing workflow actions from Home
- Drag/drop personalization

## Implementation Notes

- 2026-05-09 HOME-PR-003 changed the default Home presentation to a kanban-style work board with `병원 현황` and `내 업무` tabs.
- The kanban presentation preserves the Home v1 principle that Home routes users into source workflows and does not claim, complete, cancel, finalize, or settle work directly.
- The right-side Home support panel is now `지금 볼 업무`, which avoids repeating filter counts and instead recommends urgent, delayed, and unassigned work groups to check next. Recommended groups use white accordion rows with `긴급 업무 2` style titles and are expanded by default. Focus task hover/focus reveals `보러가기` for source workflow entry. The top workstream filter supports checkbox-based multi-select; full global Notification Center remains out of scope.

## Verification Direction

Implementation should be checked against this epic plan and the supporting rules document.

Minimum verification themes:

- Role/user-specific My Work rendering
- Empty My Work state for at least one role
- Unassigned role work visible to same-role users
- Claimed work removed from other same-role Home lists while remaining in original group list
- Home action surface limited to entry actions
- No hospital management KPI cards in default Home
- Clinical abnormal values not auto-converted into Home critical tasks
