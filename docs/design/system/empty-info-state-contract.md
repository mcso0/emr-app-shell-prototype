---
status: "approved"
area: "design-system"
updated: "2026-06-06"
linear_issue: "DEN-434"
linear_project: "공통 UX/UI 기준 정리 및 화면 적용"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/global-feedback-ui-audit.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/component-ownership-rules.md"
---

# Empty State And Info Box Contract

This contract defines how CLAiR EMR distinguishes empty states from info boxes, alerts, loading states, and permission or scope boundaries. It is the source of truth for follow-up UI work after DEN-434.

## Intent

CLAiR EMR screens are dense and clinical. A blank area must not force staff to guess whether data is still loading, unavailable, hidden by filters, outside the current workspace scope, or simply not created yet.

Empty states explain the missing object and the next useful action. Info boxes explain context, prerequisites, boundaries, or caution while the workflow remains available.

## Do Not Confuse These States

| State | Meaning | Use | Do not use |
| --- | --- | --- | --- |
| Loading | data is being fetched or prepared | `Skeleton` or local loading copy when the domain object matters | Empty state copy such as "no data" |
| Empty state | the expected object list or section has no visible items | Empty state pattern from this contract | Error, degraded, or permission warning copy |
| Info box | the workflow needs context, guidance, precondition, or boundary explanation | Info box pattern from this contract | Blocking error or destructive confirmation |
| Inline alert | read/save failure, degraded live/demo state, permission blocker, risky preflight | `EmrInlineAlert` when persistent feedback or recovery action is needed | Passive guidance that does not require attention |
| Field error | one input is invalid | `FieldError` | Panel-level empty or info state |
| Toast | transient confirmation or mock/session-only feedback | Sonner toast | Persistent empty, warning, or recovery state |

## Empty State Types

| Type | Use when | Required copy | Default action | Visual strength |
| --- | --- | --- | --- | --- |
| Not created yet | the workspace or section is valid but no item exists yet | object + creation context | create/add action when allowed | E0 panel, E1 action |
| No search results | query returns no matches | query or searched object + reset option | clear search, broaden search, or create new record | E0 panel, E1 action |
| No filtered results | filters hide all visible rows | active filter context | clear filters or adjust filter | E0 panel, E1 action |
| No scope result | current date, workspace, patient, encounter, or module scope has no visible data | scope name + how to change scope | change date/scope or go to source workflow | E0 panel, E1 action |
| No permission or range access | user cannot see items in the current role/scope | neutral explanation without claiming security completion | request/admin/workspace resolution if available | E0 panel or warning/info box depending severity |
| Pending upstream state | upstream workflow has not produced the object yet | upstream dependency + source screen | go to source workflow or wait | E0 panel, optional info tone |

Empty states should not imply live persistence, server enforcement, or permission guarantees when the app is still mock/local-first for that boundary.

## Info Box Types

| Type | Use when | Tone | Action rule |
| --- | --- | --- | --- |
| General guidance | short explanation helps the user interpret the section | neutral/info | optional secondary action |
| Work prerequisite | the user needs a prior step before this section becomes useful | info/warning depending risk | one clear next action when available |
| Caution | action is available but needs care, review, or clinical/business attention | warning | action only when it reduces risk |
| System boundary | mock/local-first/live boundary, future-scope feature, or disconnected provider | info/warning | action may open details or source workflow; do not imply live completion |
| Persistent success | in-context confirmation after a local action where toast is not enough | success | optional verify/view action |
| Unavailable action explanation | a visible action is intentionally disabled or future-scoped | neutral/info | explain why and what to do instead |

Use `EmrInlineAlert` instead of a passive info box when the state is a failure, degraded read/write, permission blocker, or recovery path.

## Layout And Visual Rules

- Empty states and info boxes are in-flow surfaces, so they default to E0 flat from `border-shadow-depth-contract.md`.
- Primary action controls inside those surfaces use E1 shadow when enabled.
- Use a small icon only when it improves scanning; do not rely on icon alone.
- Keep the title short: one line when possible.
- Keep body copy to one or two short sentences in dense screen contexts.
- Use status tones only when the state has semantic meaning. Neutral empty states should not look like warnings.
- Put the state where the missing content would have appeared, not in global chrome.
- If an upstream failure caused the empty area, place the alert above the stale or empty panel.

## Copy Shape

Empty state copy should answer:

1. What object is missing?
2. Why is it missing, if known?
3. What is the next useful action?

Info box copy should answer:

1. What should the user know before continuing?
2. Is this guidance, caution, system boundary, or success?
3. Is there one useful action, or should the box remain passive?

Avoid vague copy such as "No data", "Empty", "준비 중", or "표시할 항목이 없습니다" when the user needs to know whether to create, search again, change filters, wait, or go to another workflow.

## Component Ownership

Do not create a shared component merely because the copy repeats.

Use this order:

1. Keep feature-local markup for one-off empty or info states tied to one workflow.
2. Use `EmrInlineAlert` for persistent alert, degraded, permission, and recovery states.
3. Consider a small `EmrEmptyState` only after at least two screen families share the same layout contract.
4. Consider an `EmrInfoBox` only after info, prerequisite, caution, and unavailable patterns repeat across screen families without feature-specific behavior.

Shared components must expose slots for title, body, icon, action, secondary action, tone, and test IDs without owning route, permission, persistence, or logging behavior.

## Implementation Acceptance Criteria

Follow-up implementation issues should satisfy these checks:

- Loading, empty, error, permission/scope, and info states are visually and textually distinct.
- Empty states name the missing object and include the next useful action when one exists.
- Info boxes do not hide errors, degraded reads, failed saves, or permission blockers.
- Enabled empty/info actions use E1 click affordance; passive surfaces remain E0 flat.
- Copy does not imply live persistence, RLS, server enforcement, provider integration, or real data when not implemented.
- Any shared extraction follows `component-ownership-rules.md` and keeps feature behavior local.
- Dense screens are checked for state panels taking over too much vertical space.

## Follow-Up Candidates

- Apply this contract to queue empty states in DEN-436 if filter/sort leaves no visible work.
- Apply this contract to patient context memo or no-note states in DEN-437.
- Apply this contract to SOAP section empty/editing guidance in DEN-438.
- Revisit shared `EmrEmptyState` only after those implementation issues prove repeated structure.
