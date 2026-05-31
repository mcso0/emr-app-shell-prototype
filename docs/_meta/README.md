# Docs Meta

This folder defines how humans and agents operate `docs/` as the repo-native knowledge, routing, and work-management system.

## Read First

- Taxonomy: `docs/_meta/taxonomy.md`
- Lifecycle: `docs/_meta/lifecycle.md`
- Intake rules: `docs/_meta/intake-rules.md`
- Documentation depth rules: `docs/_meta/documentation-depth-rules.md`
- Agent RAG map: `docs/_meta/agent-rag-map.md`
- Owner Safety OS: `docs/_meta/owner-safety-os.md`
- Non-developer Codex workflow: `docs/_meta/non-developer-codex-workflow.md`
- GitBook structure rules: `docs/_meta/gitbook-structure-rules.md`
- GitBook private operations checklist: `docs/_meta/gitbook-private-operations-checklist.md`
- GitBook docs site creation plan: `docs/_meta/gitbook-docs-site-creation-plan.md`
- Result review rules: `docs/_meta/result-review-rules.md`

## Operating Rule Docs

- `docs/_meta/taxonomy.md`: areas, doc types, and where information belongs.
- `docs/_meta/lifecycle.md`: status values and transition rules for documents and work.
- `docs/_meta/intake-rules.md`: how to classify chat instructions into source docs, work items, decisions, closeouts, or archive records.
- `docs/_meta/documentation-depth-rules.md`: how much to record, and when GitHub PR/Issue records are enough.
- `docs/_meta/agent-rag-map.md`: minimal reading map for Codex task startup and token-efficient source-doc selection.
- `docs/_meta/owner-safety-os.md`: Safety OS intake gate, approval gates, review buckets, and official source standards.
- `docs/_meta/non-developer-codex-workflow.md`: short Korean usage guide so 승욱 can invoke Safety OS without remembering skill names.
- `docs/_meta/owner-safety-os-scenario-validation.md`: dry-run scenario expectations for validating Safety OS behavior.
- `docs/_meta/coding-discipline.md`: concise implementation discipline for non-trivial coding work.
- `docs/_meta/gitbook-structure-rules.md`: GitBook sidebar, area README, current-vs-history, and private-first reader-boundary rules.
- `docs/_meta/gitbook-private-operations-checklist.md`: private/internal GitBook access, sharing, sensitive-area, and external-public conversion checklist.
- `docs/_meta/gitbook-docs-site-creation-plan.md`: manual private-first GitBook docs site setup path, source-of-truth model, audience choices, and stop conditions.
- `docs/_meta/result-review-rules.md`: required concise user review after work is completed.
- `docs/_meta/templates/`: reusable document templates.

## Boundaries

- `_meta/` holds operating rules, not product requirements, design specs, engineering contracts, or PR execution details.
- Product, design, engineering, business, and work records should live in their own areas and link back here for routing rules.
- Keep `_meta/` docs concise. If a rule becomes area-specific, move the detailed guidance to that area and link it from the relevant README.
- Do not duplicate Linear or GitHub execution history here.

## Language Contract

Use concise English for durable agent-facing guidance, work plans, search notes, and handoff summaries by default. Keep user-facing result reviews in Korean unless the user asks otherwise. Korean product terms and domain labels may stay in Korean when translation would make them less clear.

## Adding Operating Rules

Before adding a new `_meta/` document, check whether the rule belongs in an existing operating doc. Add a new file only when the rule changes cross-area behavior or should be read by future agents across multiple task types.
