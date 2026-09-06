# Result Review Rules

After completing work, the agent must give the user a concise result review.

Default language: Korean, unless the user asks otherwise. Keep any supporting agent-facing handoff notes in concise English.

## Default Review Shape

Include:

- a brief non-developer summary of what changed and why it matters
- what changed
- which files or docs changed
- current status
- verification result
- useful next step

Keep the first review short and understandable for a non-developer decision-maker. Expand only when the user asks for details or when there is a notable risk.

For Level 0 changes from `docs/_meta/documentation-depth-rules.md`, the result review is the only required record. Do not create a work item, changelog entry, or closeout just to document a tiny one-off change.

## Plain-Language First

Start with a concise explanation for a non-developer:

- what happened
- why it matters
- what state things are in now

Keep it short by default. Do not turn result reviews into long lessons.
If the user asks about a term or concept, explain it in a learning-friendly way with a small example.

## HTML Report Requirement

For meaningful project work, especially Linear issue work, create a Korean HTML report for the representative/CEO audience and place it under `docs/completed/<area>/YYYY-MM-DD-<issue-or-slug>-report.html`.

For read-only consultation, exploration, or review, report in chat unless the user asks for a durable artifact or the active work item requires one. Do not create files just to satisfy a reporting template during a read-only request.

The report should be concise and decision-oriented:

- what was requested
- what changed or was decided
- why it matters
- changed files or docs
- verification result
- risks, caveats, or out-of-scope items
- recommended next step

After creating the report, add its path to the relevant Linear issue only when the user has authorized that external update. Otherwise include the local link in the final review.

## Good Review

```text
완료했어요. 이번 변경으로 docs/_meta 운영 규칙, 영역별 changelog/decision 구조, work item 연결이 추가됐고 docs:check도 새 필수 문서를 확인합니다.

검증은 npm run docs:check와 npm run lint를 통과했습니다. 다음 작업은 기존 product/design/engineering 주요 문서에 frontmatter를 넓게 적용하는 쪽이 자연스럽습니다.
```

## Required Caveats

Mention clearly when:

- verification could not be run
- a command failed
- user-owned changes were left untouched
- a document was intentionally left as a compatibility stub
- implementation was not performed because the task was planning-only
