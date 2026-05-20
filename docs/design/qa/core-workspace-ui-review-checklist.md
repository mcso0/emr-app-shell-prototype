---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-144"
linear_project: "09 시각 QA 및 인터랙션 품질 게이트"
source_docs:
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/global-feedback-ui-audit.md"
  - "docs/engineering/current-status.md"
---

# Core Workspace UI Review Checklist

Use this checklist for PR-sized UI refactor issues in the UI/UX initiative.

## Representative Review Prompts

- 화면이 기존 업무 흐름을 더 쉽게 읽게 해 주는가?
- 중요한 action이 너무 숨어 있거나 과하게 강조되어 있지 않은가?
- 조밀한 table, side panel, drawer, dialog에서 텍스트가 겹치거나 잘리지 않는가?
- mock/session-only action copy가 실제 저장처럼 오해되지 않는가?
- 이 변경이 지금 accept 가능하고, 남은 것은 follow-up backlog로 보내도 되는가?

## Visual Review

- App Shell: nav rail, workspace tabs, top controls, command palette, profile menu rhythm is stable.
- Chart: SOAP, diagnosis, order table, footer, confirm dialogs keep dense clinical readability.
- Reception/Billing/Customer: queue/list/table/search/drawer actions remain scan-friendly.
- Lab/Imaging/Dispensing: side panel, content history, result/detail tables, right panels preserve scroll containment.
- Admin/Inpatient: dense table columns, status badges, drawer/form footers stay aligned.
- Home: dashboard, work board, filters, detail panel remain readable without card nesting drift.
- Login/Profile/Workspace: form labels, errors, pending states, auth/security copy remain honest.

## Interaction Review

- Keyboard focus is visible on icon buttons, tabs, filters, command rows, dialogs, and drawers.
- Hover-only actions also appear on focus or selected state when needed.
- Dialogs and drawer-like overlays have a title and clear cancel/confirm actions.
- Destructive actions use destructive visual treatment and clear copy.
- Command/search results remain clickable buttons or links unless a scoped issue updates tests and semantics.

## Responsive Review

- Primary desktop viewport has no incoherent overlap or text clipping.
- Narrow viewport keeps critical actions reachable or intentionally scrollable.
- Fixed-width tables use overflow wrappers instead of crushing columns.
- Side panels and right panels preserve collapse/open behavior.
- Sticky footers do not cover fields, rows, or action buttons.

## Feedback State Review

- Loading: use `Skeleton` for generic placeholders; use local copy when the domain object matters.
- Empty: identify the missing object and next useful action if available.
- Error: form validation uses `FieldError`; broader permission/server errors use `role="alert"` notice panels.
- Toast: session-only/mock/future-scope actions should say so.
- Confirmation: use `EmrConfirmDialogContent` for simple confirmations.

## Agent Verification Notes

- Use focused tests first: auth/profile/workspace `tests/auth.spec.ts`, shell/tabs/command `tests/app-shell.spec.ts`, and screen-specific tests from `docs/design/system/ui-refactor-dod.md`.
- Run `npm run docs:check` for docs-only review issues.
- For visual QA, capture at least one desktop route and one narrow viewport route when layout changed.
- Record intentional exceptions: fixed table width, asset-specific icon sizing, workflow-specific status maps, or local dialog copy.

## Follow-Up Backlog Criteria

Accept as follow-up instead of blocking when:

- the issue preserves behavior and improves the scoped screen
- the remaining problem affects a different screen family
- the fix requires a new shared component contract
- visual debt is real but not a regression from the current issue
- product/security policy decisions are needed before implementation
