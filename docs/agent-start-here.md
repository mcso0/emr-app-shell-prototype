# Agent Start Here

Use this map when the task's reading path is unclear. Already-loaded instructions do not need to be reread unless they changed or a relevant detail is missing.

## Choose The Reading Path

| Task | Read only what affects the result |
| --- | --- |
| Question, explanation, typo, isolated fix | Requested file and direct evidence. No work item or startup bundle required. |
| Feature implementation or regression | Owning code/contract, focused tests, and existing work item for PR-sized work. Use `docs/_meta/coding-discipline.md` for non-trivial changes. |
| Product scope, module state, mock/live, readiness | Relevant sections of `docs/engineering/current-status.md`, then the linked module/work evidence. |
| Auth, workspace, permissions, DB, migration, RLS | Current scope, active approved work item, and affected data/security contract. Use `docs/_meta/agent-rag-map.md` if the owner is unclear. |
| Next.js API/configuration/framework behavior | Relevant installed guide in `node_modules/next/dist/docs/`; skip for unrelated copy/styling. |
| Documentation structure or durable guidance | `docs/_meta/intake-rules.md`; use its depth rules. Read `docs/README.md` for viewer/navigation changes. |
| Linear operation | `.agents/skills/manual-linear-ops/SKILL.md` and the relevant issue. Read the full manual only for the branch that applies. |
| CI/CD, Preview, production, alias, merge | `.agents/skills/release-deployment-ops/SKILL.md` and the relevant release runbook. |
| Explicit Safety OS gate | `.agents/skills/emr-owner-safety-os/SKILL.md`; ordinary review proceeds directly with relevant checks. |

The current product target is Product MVP. `docs/engineering/current-status.md` owns product state and mock/live evidence; `AGENTS.md` owns project operating and approval boundaries. An issue can record an approved scope but cannot grant itself permission for remote writes or a release.

## Work And Completion

- For PR-sized work, search `docs/work/index.md` by ID/area and reuse an existing item before creating one.
- Work through implementation, focused verification, and related failure fixes within the authorized objective. Apply remaining gates immediately before the affected action.
- Record changed behavior/contracts in their owning docs and verification in the work item when applicable. Use `docs/_meta/result-review-rules.md` for completion and report depth.
- Select additional docs from `docs/_meta/agent-rag-map.md` only when needed. Its rows are candidate sources, not mandatory reading bundles.
- Search long documents by heading or keyword. Skip archives, completed reports, status histories, generated output, and unrelated work by default.
