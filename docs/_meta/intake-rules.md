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
| "완료됐어", "결과 정리해줘" | `docs/completed/` closeout |
| "이전 문서는 더 이상 기준 아냐" | Mark `superseded` or `deprecated`; move to `docs/archive/` only when no longer active |

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
