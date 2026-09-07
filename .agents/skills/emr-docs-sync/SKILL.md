---
name: emr-docs-sync
description: Sync affected CLAiR source docs and work records after verified changes or an explicit docs-sync request.
---

# EMR Docs Sync

Use for requested documentation updates. Explaining or reviewing this skill does not invoke its write workflow.

## Select The Owning Record

Start from the request, active work item, and relevant diff. Update only claims affected by verified behavior, contracts, status, or durable decisions. If nothing needs updating, report that outcome.

- Product/design/engineering truth: the existing owning source doc under `docs/`.
- PR-sized execution and verification: the active `docs/work/` item.
- Product scope, module state, or mock/live changes: relevant sections of `docs/engineering/current-status.md`.
- Navigation or reader changes: `docs/README.md` and the actual internal `/docs` viewer registry/owning contract; use the RAG map if the owner is unclear.
- Placement or record-depth ambiguity: `docs/_meta/intake-rules.md` and its linked depth rules.
- Completion/report depth: `docs/_meta/result-review-rules.md`. Do not create a separate HTML report merely because the change belongs to Linear.

Do not reread startup docs already loaded for the task or load every source above.

## Current Reader Boundary

Repo `docs/` is canonical. The internal `/docs` app route is the active read-only viewer; `/prd` is a compatibility path. GitBook is inactive/deprecated. `docs/SUMMARY.md` is legacy GitBook navigation and is not an automatic update target for new docs.

Only if 승욱 explicitly revives GitBook, read the relevant `docs/_meta/gitbook-structure-rules.md`, `docs/_meta/gitbook-private-operations-checklist.md`, or `docs/_meta/gitbook-docs-site-creation-plan.md` for navigation, access, or setup respectively. Revival does not itself authorize public sharing or publishing.

## Edit And Verify

- Reuse existing owners, terminology, and links. Avoid duplicate summaries, broad archive rewrites, and new truth under `docs/implementation/` compatibility stubs.
- Preserve meaningful history. If moving a canonical doc, inspect its callers and preserve necessary compatibility links.
- Keep facts source-backed. Never infer remote DB/RLS, deployment, real-provider, or legal readiness from local code/tests. Use synthetic examples and exclude secrets/real personal data.
- Run `npm run docs:check` after path, link, navigation, or portal edits. For wording-only changes use a focused diff/link check. Reuse valid implementation evidence from the current task; rerun only if changed behavior or uncertainty warrants it.
- Follow `AGENTS.md` for authorization. External edits, publication, access changes, GitHub/Linear updates, and real-data operations require their specific scope; a docs-sync request is not blanket permission.
- Finish authorized edits and verification, then report changed docs, evidence, and material limitations in Korean.
