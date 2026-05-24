# Intake Rules

Use this file when the user gives a natural-language instruction in chat.

## Intake Flow

1. Classify the instruction into one or more areas: `business`, `product`, `design`, `engineering`, or `work`.
2. Search existing docs and work items before creating anything new.
3. Choose the documentation depth from `docs/_meta/documentation-depth-rules.md`.
4. Decide whether the instruction is an idea, source-of-truth change, durable decision, PR-sized execution item, closeout, or archive operation.
5. Update the canonical document first when the instruction changes product/design/engineering truth.
6. Create or update a work item only when the work is PR-sized and has goal, scope, done criteria, source docs, dependencies, and verification.
7. Preserve meaningful history with status changes instead of deleting it.
8. After completing work, provide the result review defined in `docs/_meta/result-review-rules.md`.

## Language Contract

Use concise English for durable agent-facing guidance, work plans, search notes, and handoff summaries. Keep final user-facing reviews in Korean unless the user asks otherwise. Preserve Korean product terms, screen labels, and domain wording when they carry product meaning.

Treat requests such as "앞으로 이렇게 하자", "규칙으로 만들자", or "항상 유지해줘" as durable guidance changes. Route them to the smallest canonical source doc or operating rule that future chats will read.

## Routing Table

| User instruction sounds like | Route to |
|---|---|
| "이 아이디어 어때?", "나중에 고려하자" | Relevant source doc as `draft` or `docs/work/inbox.md` if execution-shaped |
| "서비스 전체 방향", "타겟 고객", "가격", "세일즈" | `docs/business/` |
| "제품은 이렇게 동작해야 해" | `docs/product/service/`, `docs/product/features/`, or `docs/product/domain/` |
| "DB에는 이런 관계가 필요해" | Product data requirement in `docs/product/domain/`; implementation schema in `docs/engineering/data-model/` |
| "이 화면/흐름을 바꾸자" | `docs/design/flows/`, `docs/design/screens/`, or relevant product feature |
| "이걸 개발하자" | Existing or new PR-sized item in `docs/work/` |
| "이 방향으로 결정하자" | Relevant `decisions/` folder |
| "앞으로 이렇게 하자", "항상 유지해줘", "규칙으로 만들자" | Smallest relevant canonical doc or operating rule |
| "완료됐어", "결과 정리해줘" | `docs/completed/` closeout |
| "이전 문서는 더 이상 기준 아냐" | Mark `superseded` or `deprecated`; move to `docs/archive/` only when no longer active |

## UX/UI Research-First Routing

Reusable UX/UI pattern changes must start with a research/proposal issue unless an approved design contract already exists.

Route these requests to `docs/design/system/ux-ui-research-before-implementation.md` and a research/proposal Linear issue before implementation:

- new or changed table/data-grid behavior
- sort, filter, column menu, resize, density, row height, wrapping, truncation, or line-clamp rules
- toolbar/action placement patterns repeated across screens
- reusable dialog, drawer, popover, command, tab, segmented control, or filter behavior
- shell, navigation, workspace tab, side panel, or right panel interaction patterns
- new shared EMR component APIs

Do not require research-first for one-off copy, spacing, icon, visual regression hotfixes, or direct adoption of an already approved design-system contract.

## Add, Update, Delete, Defer

- Add: create or update the smallest canonical document that can hold the truth, then link any work item.
- Update: edit the current source-of-truth doc and record a changelog entry when the change matters.
- Delete: delete only accidental low-value files; otherwise mark `deprecated`, `cancelled`, or `superseded`.
- Defer: mark source docs or work items `deferred` and record what decision or trigger would reopen them.

## Documentation Depth

Do not record every small change in docs. Use `docs/_meta/documentation-depth-rules.md` to decide whether the change needs only a final result review, a PR description, an existing work item update, a new PR-sized work item, or a source-of-truth document update.

When GitHub PRs or issues already hold enough execution context, do not duplicate Level 1 or Level 2 details in docs. Promote the change to docs only when it affects current guidance, durable decisions, agent handoff, or archive-worthy context.

## PR Creation Gate

Before creating a PR-scoped work item or PR, confirm:

- goal
- PR-sized scope
- out-of-scope items
- done criteria
- source docs
- verification
- status and dependencies
- duplicate check

If the answer is clear from the conversation or docs, summarize it. If it is not clear, ask before creating execution work.
