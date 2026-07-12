---
status: "active"
updated: "2026-05-22"
linear_issue: "DEN-204"
linear_project: "CLAiR EMR UI/UX Consistency & Affordance Hardening"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/global-feedback-ui-audit.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/qa/product-mvp-uiux-a-grade-acceptance-matrix.md"
---

# Inline Alert Feedback Rules

`EmrInlineAlert` is the shared EMR primitive for persistent workflow feedback:
read failures, degraded demo/live boundary messages, permission blockers,
financial preflight warnings, and local success confirmations that should remain
visible in context.

Use toasts for transient session-only feedback. Use `FieldError` for field-level
validation. Use dialogs for confirmations that interrupt the user's flow.

## Component Contract

Component path:

- `src/components/emr/inline-alert.tsx`

Import:

```tsx
import { EmrInlineAlert } from "@/components/emr/inline-alert";
```

Basic usage:

```tsx
<EmrInlineAlert
  severity="warning"
  title="서버 대기열을 불러오지 못했어"
  action={<Button size="sm">다시 시도</Button>}
  secondaryAction={<Button size="sm" variant="outline">로컬 데모로 보기</Button>}
>
  현재 화면은 마지막 로컬 데모 상태를 보여주고 있어.
</EmrInlineAlert>
```

The component exposes below-copy recovery action slots instead of owning click
behavior. Feature modules remain responsible for retry callbacks, route state,
permissions, logging, and local workflow copy.

## Severity Rules

| Severity | Default role | Use for | Required affordance |
|---|---|---|---|
| `error` | `alert` | Blocking failure, failed save, failed read with no trustworthy fallback | Explain impact and include a recovery action when recoverable. |
| `warning` | `alert` | Degraded state, live read failed but local demo is visible, risky preflight, permission uncertainty | Explain the boundary and offer the next safest action. |
| `info` | `status` | Mock/live boundary, future-scope feature, neutral contextual guidance | Keep copy factual and avoid implying persistence. |
| `success` | `status` | Persistent in-context confirmation after local state changes | State what changed and where the user can verify it. |

Do not rely on color alone. The title, body, icon, placement, and available
action must make the severity understandable.

## Recovery Action Patterns

Use these labels and behavior classes consistently when the action exists:

| Pattern | Expected action |
|---|---|
| Retry | Re-run the same read or save operation without changing user input. |
| Local demo | Keep the user in mock/local data and clearly state that it is not live. |
| Permission | Point to workspace membership, role, or owner/admin resolution. |
| View details | Reveal or link to diagnostic details useful for support/debugging. |
| Unavailable | Explain that a feature is intentionally disconnected in the MVP. |
| Dismiss | Hide only non-blocking info/success/warning messages. Do not dismiss blocking errors without another recovery path. |

## Dismiss Controls

- Use `dismissAction` only for a non-blocking `info`, `success`, or `warning`
  message that the user may hide after reading.
- Place a labelled icon-only dismiss button in `dismissAction`; the shadcn
  `AlertAction` slot keeps it at the alert's top end.
- Keep `action` and `secondaryAction` below the copy for meaningful recovery
  paths such as retry, local-demo fallback, or viewing details.
- Do not use a generic acknowledgement label such as `확인` when the only
  result is dismissing the alert.

## Placement

- Put persistent alerts near the affected workflow, not in global chrome.
- Put read failures above the stale/empty panel they explain.
- Put save failures next to the form or confirmation surface that triggered them.
- Put financial or destructive preflight messages inside the confirmation flow
  or immediately above the CTA group.
- Keep alert copy concise enough to scan in dense EMR layouts.

## Out Of Scope

DEN-204 does not apply the alert to all screens. Follow-up issues should wire
the primitive into reception, billing, chart, row menu, and mock/live boundary
flows with focused tests.

DEN-204 also does not implement live Supabase validation, server enforcement,
remote retry internals, payment providers, email providers, or production
observability.

## Verification

For changes to this primitive, run:

- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts --grep "shared EMR component source uses semantic color tokens"`

If an issue wires `EmrInlineAlert` into a user flow, add focused Playwright
coverage for visibility, role, action behavior, and keyboard reachability.
