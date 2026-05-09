# Docs Meta

This folder defines how agents and humans operate `docs/` as the repo-native knowledge and work management system.

Read these files when routing new planning, design, engineering, or work-management instructions:

- `docs/_meta/taxonomy.md`: areas, doc types, and where information belongs
- `docs/_meta/lifecycle.md`: status values and transition rules for documents and work
- `docs/_meta/intake-rules.md`: how to classify chat instructions into source docs, work items, decisions, closeouts, or archive records
- `docs/_meta/documentation-depth-rules.md`: how much to record, and when GitHub PR/Issue records are enough
- `docs/_meta/coding-discipline.md`: concise implementation discipline for non-trivial coding work
- `docs/_meta/result-review-rules.md`: required concise user review after work is completed
- `docs/_meta/templates/`: reusable document templates

## Operating Principle

Keep current guidance easy to find, preserve meaningful history, and make every handoff understandable to a new chat or sub-agent without hidden conversation context.

## Language Contract

Use concise English for durable agent-facing guidance, work plans, search notes, and handoff summaries by default. Keep user-facing result reviews in Korean unless the user asks otherwise. Korean product terms and domain labels may stay in Korean when translation would make them less clear.
