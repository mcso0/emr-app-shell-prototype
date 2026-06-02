---
id: "HOME-V1-UI-SPEC"
status: draft
area: product
doc_type: ui-spec
related_docs:
  - "docs/product/features/home/home-v1-reference-research.md"
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/product/features/home/home-v1-epic-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
related_work:
  - "docs/work/home/HOME-PR-001-role-command-home-foundation.md"
last_updated: "2026-05-09"
---

# Home v1 UI Spec

## Goal

홈 v1은 모든 직원이 오늘/지금 해야 할 업무를 찾고 원본 업무 화면으로 들어가는 시작점이다.

Primary question:

> 오늘/지금 내가 뭘 해야 하지?

This UI spec translates the Home v1 epic plan and work generation rules into a screen structure.

Reference research:

- `docs/product/features/home/home-v1-reference-research.md`

## Screen Principles

- Default body is `내 업무`.
- Home is an entry surface, not a workflow completion surface.
- Home actions are limited to `열기` and `확인하러 가기`.
- No claim, completion, cancellation, payment completion, message sending, result confirmation, or chart completion actions are shown on Home.
- Default Home excludes hospital management KPI/dashboard content.
- Empty state is useful but compact.
- Notification center is an app-level feature outside Home.

## Reference-Informed Decisions

The reference research leads to these UI decisions:

| Decision | Rationale |
|---|---|
| Make `내 업무` the default body | Asana/Todoist patterns show personal assigned work should be the fastest path to action. |
| Keep original module queues authoritative | Jira/Intercom/Zendesk patterns separate personal work from team or role queues. |
| Show unassigned role work, but do not claim on Home | Role queue work should be visible, but claim and status change belong in the source workflow. |
| Keep notification outside Home | Microsoft Teams patterns support a separate app-level activity/notification feed. |
| Exclude hospital management KPI cards | IDEXX Neo-style practice dashboard is useful, but would make this staff Home too broad. |
| Keep clinical judgment in source clinical screens | Vet workflow references support routing to patient/workflow context for completion. |

## Information Architecture

Recommended desktop structure:

```text
Header
  Home title
  Search
  Quick Status chips

Main
  My Work header
  Work lens/filter row
  My Work timeline or Empty launcher
  Compact Flow Summary
```

The current three-column command dashboard should be simplified. Home v1 should avoid showing `My Work`, `Hospital Flow`, role widgets, and alerts as equal large panels.

## Wireframe Direction

Desktop layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ 홈                                      [검색...................]  │
│ [내 업무 5] [긴급 1] [오늘 마감 2] [지연 1] [미배정 큐 3]        │
├────────────────────────────────────────────────────────────────────┤
│ 내 업무                                                           │
│ 전체 · 긴급 · 오늘 마감 · 지연 · 미배정 큐                        │
│ 진료 · 접수 · 검사 · 조제/처치 · 수납 · 입원                     │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ [검사 · high] 콩이 CBC 결과 확인                              │ │
│ │ 김하늘 보호자 · 결과 입력 완료 · 09:40                         │ │
│ │ 추천: 결과를 확인하고 차트 또는 보호자 설명에 반영하세요.     │ │
│ │                                                [검사 결과 열기] │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ [접수 · 지연] 토리 보호자 대기 안내 필요                      │ │
│ │ 이도윤 보호자 · 대기 31분                                     │ │
│ │ 추천: 예상 대기 시간을 안내하고 담당 수의사 상태를 확인하세요.│ │
│ │                                                [대기실 열기]    │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ 예약 24 · 접수 8 · 대기 5(지연 3) · 검사 3(확인 1) · 수납 4       │
└────────────────────────────────────────────────────────────────────┘
```

Empty layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ 현재 요청된 내 업무가 없습니다.                                   │
│ 바로 시작할 수 있는 업무를 선택하세요.                            │
│                                                                    │
│ [예약/접수 열기] [현장 접수] [수납 대기 보기]                     │
│                                                                    │
│ 예약 24 · 접수 8 · 대기 1 · 수납 0                                │
└────────────────────────────────────────────────────────────────────┘
```

The compact flow summary remains secondary in both states.

## Header And Quick Status

The top area should answer current workload at a glance.

Recommended chips:

| Chip | Meaning | Click behavior |
|---|---|---|
| 내 업무 | Count of visible actionable work | Shows all My Work |
| 긴급 | Explicit urgent requested work | Applies urgent filter |
| 오늘 마감 | Due-today work | Applies due-today filter |
| 지연 | Overdue work | Applies overdue filter |
| 미배정 큐 | Unassigned role work visible to the user | Applies role-queue filter |

Guidelines:

- Use compact chips, not long summary sentences.
- Chips should be counts and filters, not KPI cards.
- Do not include revenue, visitor count, inventory report, or staff operations summary.
- If a count is zero, the chip can be hidden or shown in a quiet disabled style.

Example:

```text
[내 업무 5] [긴급 1] [오늘 마감 2] [지연 1] [미배정 큐 3]
```

## Work Lens And Filters

The default lens is `내 업무`.

Recommended primary filters:

```text
전체 · 긴급 · 오늘 마감 · 지연 · 미배정 큐
```

Recommended domain filters:

```text
진료 · 접수 · 검사 · 조제/처치 · 수납 · 입원
```

Guidelines:

- Keep filters compact.
- Avoid a large role dashboard switcher.
- Multi-role users should not need to switch role dashboards to see requested work.
- Domain filters narrow the current My Work list; they do not change the whole screen into separate dashboards.

## My Work Timeline

The main body shows the prioritized list of requested/assigned work.

Default visible count:

- Show 5-7 items by default.
- Additional work can be exposed through filter, scroll, or `전체 보기`.

Sort order:

1. Explicit urgent request
2. Overdue
3. Due today or due soon
4. Assigned directly to the user
5. Requested to the user's active role

## Work Card Anatomy

Each work card should be compact, scannable, and action-oriented.

Required content:

| Element | Description |
|---|---|
| Priority marker | urgent/high/normal/overdue visual tone |
| Domain label | 진료, 접수, 검사, 조제/처치, 수납, 입원 |
| Title | Work action title |
| Patient context | Animal, guardian, encounter context when available |
| Source | Requester, source role, or reason |
| Time state | Requested time, due time, overdue state |
| Recommended next action | One short sentence telling what to do next |
| Entry action | `열기` or `확인하러 가기` |

Example:

```text
[검사 · high]
콩이 CBC 결과 확인
김하늘 보호자 · 결과 입력 완료 · 09:40
추천: 결과를 확인하고 차트 또는 보호자 설명에 반영하세요.
[검사 결과 열기]
```

Role queue example:

```text
[검사 · 미배정 큐]
콩이 CBC 검사 요청
진료 수의사 요청 · 12분 전
추천: 검사 화면에서 요청 내용을 확인하세요.
[검사 큐 열기]
```

Claimed work should not be shown in other same-role users' Home My Work list, but remains visible in the original group work list.

Card rules:

- One primary entry action per card.
- No inline completion controls.
- No claim button.
- No nested subcards.
- Recommended next action is one sentence.
- If the work is role-queue/unassigned, show that state in the label or source line.
- If the work is already claimed by someone else, it should not appear in this user's Home My Work.

## Empty State

Empty My Work is a normal state.

Empty copy:

```text
현재 요청된 내 업무가 없습니다.
바로 시작할 수 있는 업무를 선택하세요.
```

Empty launcher pattern:

- 2-4 compact entry actions.
- Role/responsibility based.
- No hospital-wide dashboard fill.
- No large KPI cards.

Launcher examples:

| User/responsibility | Launcher actions |
|---|---|
| 데스크 | 예약/접수 열기, 현장 접수, 수납 대기 보기 |
| 진료 수의사 | 진료 대기열, 내 차트, 검사 결과 확인 |
| 조제/처치 테크니션 | 조제/처치 큐, 검사 대기, 입원 케어 |
| 검사 담당 | 검사 대기열, 결과 입력, 재확인 요청 |
| 수납 담당 | 수납 대기, 미수 목록, 중간 정산 |
| 입원 담당 | 입원장, 입원 등록 대기, 퇴원 체크리스트 |

## Compact Flow Summary

Hospital flow is useful context but should not dominate the default Home.

Recommended pattern:

```text
예약 24 · 접수 8 · 대기 5(지연 3) · 검사 3(확인 1) · 수납 4
```

Guidelines:

- Place below My Work or as a compact secondary strip.
- Use it to expose bottlenecks that affect work start.
- Do not show all hospital operations detail by default.
- Detailed hospital flow can be a separate lens or source screen.
- Do not turn compact flow into a 10-card board in the default Home body.

## Notification Boundary

Global notification is outside Home v1 UI scope.

Current notification implementation contract: `docs/product/features/notifications/global-notification-center-v0-contract.md`.

Home may show work items that originate from actionable notifications, but:

- Notification cards live in the app-level top-right notification area.
- Awareness-only notifications do not become Home My Work tasks.
- System notices, background state changes, and hospital management notices do not fill the Home timeline.

## Responsive Behavior

Desktop:

- Header + quick chips remain visible at top.
- My Work list is the dominant content.
- Compact flow summary is secondary.

Tablet/mobile:

- Search can collapse or move below title.
- Quick status chips wrap horizontally.
- My Work cards become single-column.
- Compact flow summary may collapse to one horizontal scroll row.
- Empty launchers remain 2-column or single-column depending on width.

## Visual Tone

- Dense but calm.
- Avoid dashboard-heavy card grids.
- Avoid multiple large panels competing for attention.
- Use priority color sparingly.
- Do not use clinical abnormal values as automatic Home critical UI.
- Recommended next action should be short, concrete, and non-alarming.

## Implementation Component Guidance

- Reuse existing Home feature components where they still serve the v1 structure.
- Keep Home-only UI pieces under `src/features/home/components/`.
- Prefer existing EMR and shadcn wrappers from the repo before introducing new markup patterns.
- Useful primitives include `Badge`, `Button`/`buttonVariants`, `Input`, `ScrollArea`, `Skeleton`, and `SegmentedControl`.
- Use app icon components from `src/components/icons.ts` or `src/components/cds-icons/*`.
- Follow Clair/shadcn tokens and existing compact dashboard density.
- Do not introduce new component libraries, new icon systems, or broad shared abstractions in v1.

## Out Of Scope

- Final workflow actions on Home
- Claim action on Home
- Full notification center UI
- Hospital management dashboard UI
- Revenue/visitor/staff/inventory KPI widgets
- Drag/drop layout personalization
- Realtime transport design

## UI Acceptance Checks

- Default Home answers "오늘/지금 내가 뭘 해야 하지?"
- My Work is visually dominant.
- Empty state still gives useful entry points.
- Default Home has no hospital management KPI widgets.
- Home cards only link into source workflows.
- Role queue work is identified as role queue/unassigned when applicable.
- Notification center is not represented as a large Home panel.
- Compact flow does not compete with My Work.
