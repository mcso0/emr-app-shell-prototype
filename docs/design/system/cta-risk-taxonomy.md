---
status: "active"
updated: "2026-05-22"
linear_issue: "DEN-206"
linear_project: "CLAiR EMR UI/UX Consistency & Affordance Hardening"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/dialog-shell-rules.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/qa/product-mvp-uiux-a-grade-acceptance-matrix.md"
---

# CTA Risk Taxonomy

This document defines how Product MVP CTAs should signal risk, require
confirmation, and recover from failure. It is the source rule for follow-up
screen work in billing, chart completion, reception, customer management, and
hospital admin surfaces.

The taxonomy is UX-only. It does not change role policy, live persistence,
server enforcement, payment provider behavior, VAT, receipts, refunds, or
external integrations.

## Risk Levels

| Risk | Definition | Default button treatment | Confirmation requirement | Feedback requirement |
|---|---|---|---|---|
| `safe` | Navigates, filters, opens a panel, previews, or changes view state only. | Secondary, outline, ghost, or icon button based on density. | No confirmation. | Toast only when the action result is not otherwise visible. |
| `state-changing` | Changes clinical, operational, or workflow state in the current session/local-first boundary. | Primary for the page's main next action; secondary for local row/section actions. | Confirmation when the change marks a workflow stage complete, affects multiple records, or is hard to reverse. | Success toast or persistent inline success when the user needs durable context. |
| `financial` | Changes invoice, billing confirmation, payment status, amount, or guardian-facing money state. | Primary for the financial next action; avoid destructive styling unless cancelling/deleting. | Always requires preflight summary and confirmation before commit. | Persistent success/error feedback near the billing surface, with retry or recovery when possible. |
| `destructive` | Deletes, removes, cancels, resets, discards entered work, or hides/restores records. | Destructive button for the confirming action; secondary/outline for the trigger when risk is contextual. | Always requires confirmation unless the action is undoable in-place and scoped to one small local draft item. | Success/failure copy must identify the affected object and recovery path if one exists. |
| `unavailable` | Feature is intentionally disconnected, future scope, provider-dependent, or permission-blocked in the MVP. | Disabled only when the reason is visible; otherwise enabled action may open an info/warning notice. | No commit confirmation, because no state should change. | Inline info/warning or toast must explain the boundary and next useful action. |

## Confirmation Pattern

Use `EmrDialogShell variant="confirm"` for new or migrated confirmation work.
Existing `EmrConfirmDialogContent` call sites can stay in place until their
screen-level issue performs visual QA.

Confirmations must include:

- object identity: patient, guardian, encounter, invoice, order, or record name
- state change: what will become complete, confirmed, paid, deleted, reset, or unavailable
- consequence: whether the result is session-only, local-first, live-read backed, or external-provider unavailable
- action order: secondary/cancel before primary/confirm
- primary wording that repeats the action, not a vague "OK"

## Preflight Summary Rules

Financial CTAs require a preflight summary before commit:

- invoice identifier or current billing context
- guardian/patient context when available
- total amount and key line count or payment state
- explicit MVP boundary: no real PG, VAT, receipt, refund, accounting, or settlement integration unless separately scoped
- recovery behavior for save failure, such as retry or "not saved" copy

State-changing CTAs should include a smaller preflight when the user needs to
verify clinical or operational artifacts before completion:

- chart completion: patient/encounter context, diagnosis/order presence, session/local persistence boundary
- order confirmation: selected order count and effect on billing candidates
- registration completion: guardian/patient identity and visit context

## Feedback Surface Rules

Use these surfaces consistently:

| Result | Surface |
|---|---|
| transient safe action succeeds | Toast or visible state change only. |
| state-changing action succeeds | Toast when the changed state is visible; inline success when the result must remain inspectable. |
| financial action succeeds | Persistent inline success or billing-state panel update. |
| save/read failure | `EmrInlineAlert` with `error` or `warning`, impact copy, and retry/recovery action when available. |
| unavailable/future-scope action | `EmrInlineAlert severity="info"` for persistent context, or toast for minor one-off tool actions. |
| destructive action succeeds | Toast or inline success that identifies the affected object. |

Do not rely on disabled buttons alone. A disabled or unavailable action must
have nearby copy, tooltip/help, or an alternate enabled affordance that explains
why the action cannot proceed.

## Representative CTA Mapping

| Surface | CTA | Risk | Required pattern | Follow-up issue |
|---|---|---|---|---|
| Chart | `차트 작성완료` | `state-changing` | confirm dialog with patient/encounter context, clinical artifact summary, and failure feedback | DEN-209 |
| Chart order table | `Order 확정` | `state-changing` | selected-order summary before commit; toast or inline success after local/session save | DEN-209 |
| Chart/order tools | `Order 추가`, `출력`, external-provider tools | `unavailable` when disconnected | info/warning notice with MVP boundary and no silent failure | DEN-209 |
| Billing | `수납 진행` / `결제 진행` | `financial` | final amount preflight, payment method/adjustment summary, persistent save failure recovery | DEN-364 |
| Billing | `수납 완료` | `financial` | amount/payment-state preflight, local/session boundary copy, persistent success/error feedback | DEN-366 |
| Billing | `미납 처리` | `financial` | secondary/overflow action, required unpaid reason dialog, persistent follow-up state feedback | DEN-364 / DEN-366 |
| Customer management | delete/restore guardian or patient | `destructive` | destructive confirmation with affected object identity and restore/undo boundary | DEN-210 or future customer issue |
| Hospital admin | `삭제` for order catalog items | `destructive` | destructive confirmation with order name and session/local boundary | DEN-210 or future admin issue |
| Reception registration | final registration submit | `state-changing` | identity/visit preflight in the final step; persistent failure recovery if save fails | Future reception/profile issue |
| Reception calendar | empty-slot create affordance | `safe` until it opens creation flow; `state-changing` on submit | low-noise open affordance, form submit confirmation only if needed by data loss or duplicate risk | DEN-211 or future reception issue |

## Copy Rules

- Use verbs that match the consequence: `작성완료`, `수납 진행`, `수납 완료`, `미납 처리`, `삭제`, `초기화`, `복원`.
- Avoid generic labels such as `확인` when the user is committing money, completion, or deletion.
- Billing should not use user-facing `청구 확정` as a required primary CTA after chart `Order 청구`; use `수납 진행` / `결제 진행` for checkout and `수납 완료` for payment completion.
- Mention session-only, local-first, or disconnected external integration state when it affects trust.
- For unavailable actions, avoid implying that a provider action was queued or sent.
- For financial actions, avoid wording that claims real payment, receipt, VAT, refund, settlement, or accounting integration.

## Excluded Actions

These are explicitly not implemented by DEN-206:

- real payment/PG, VAT, receipt, refund, settlement, or accounting behavior
- real email, KakaoTalk, PACS, device, Excel, or external-provider behavior
- role/permission policy changes
- server validation, DB migrations, RLS, or production enforcement
- all CTA call-site migrations

## Verification

For DEN-206:

- `npm run docs:check`

For follow-up implementation issues:

- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- focused Playwright for the touched workflow
- desktop screenshot of the confirm/preflight or unavailable-action surface
