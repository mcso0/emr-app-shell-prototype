---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-135"
linear_project: "08 App Shell 및 전역 공통 시스템 오딧"
source_docs:
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/component-ownership-rules.md"
---

# Global Feedback UI Audit

This audit records the feedback UI baseline for the UI/UX refactor initiative.

## Current Shared Primitives

- `src/components/ui/skeleton.tsx` provides a generic pulsing skeleton. It is suitable for route or panel placeholder blocks when a screen has no domain-specific loading copy.
- `src/components/ui/sonner.tsx` configures global toast icons and base colors. It should remain the default for transient mock/session-only action feedback.
- `src/components/emr/confirm-dialog-content.tsx` provides the standard simple confirmation dialog for destructive or irreversible-feeling session actions.
- `src/components/ui/field.tsx` provides `FieldError`, which should be preferred for validation errors inside forms.

## Observed Patterns

- Loading states are mixed: Home uses `Skeleton`, while auth and workspace screens often use small centered text cards such as `로그인 확인 중` and `구성원 정보를 불러옵니다`.
- Empty states are mostly local and copy-specific. Reception, command palette, hospital admin, and workspace membership each render their own empty message.
- Form validation has moved toward `FieldError` in auth/profile/workspace screens, while older feature modules still have local error text.
- Confirmation dialogs are reasonably standardized through `EmrConfirmDialogContent` in chart, lab/imaging, hospital admin, auth, and reception/profile flows.
- Toast copy is intentionally explicit about mock/session-only behavior in several surfaces, especially reception/profile and chart placeholder actions.

## Rules For Remaining UI Refactors

- Use `Skeleton` for non-specific loading blocks. Use local loading copy when the user needs to know which domain state is loading.
- Use `FieldError` for form validation. Keep broader server or permission errors in a bordered status panel with `role="alert"`.
- Use `EmrConfirmDialogContent` for simple confirmations. Keep large workflow dialogs feature-local.
- Toasts should say when an action is mock, session-only, or future scope. Avoid implying live persistence unless that issue explicitly implemented it.
- Empty states should include the missing object and the next useful action when one exists.
- Destructive confirmations must include a clear title, body, cancel action, and destructive confirm variant when appropriate.

## Follow-Up Candidates

- A small `EmrEmptyState` may be useful after Project 09 confirms repeated empty-state structure across command palette, tables, side panels, and drawers.
- A shared `EmrStatusNotice` could reduce repeated bordered success/warning/error panels, but only after the remaining QA pass defines tone and density rules.
- Existing hook dependency warnings in workspace membership management should be handled in a behavior-focused follow-up, not inside this UI audit.
