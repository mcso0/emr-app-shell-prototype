# DOCS-PR-006 Agent-first Docs Operations

## id

DOCS-PR-006

## status

done

## area

docs-restructure

## priority

P0

## target_pr

PR 6

## source_docs

- `docs/README.md`
- `docs/agent-start-here.md`
- `docs/work/index.md`
- `docs/work/README.md`
- `AGENTS.md`

## goal

Establish docs-wide intake, lifecycle, taxonomy, templates, and result-review rules so chat instructions can be archived and routed consistently.

## scope

- Add `docs/_meta/` operating rules and templates.
- Add documentation-depth rules so small GitHub-backed changes are not duplicated in docs.
- Clarify area hierarchy for business, product, design, engineering, work, completed, and archive docs.
- Add required concise result-review rule for completed work.
- Update agent bootstrap docs to point to the new rules.
- Extend docs check to verify required governance documents.

## out_of_scope

- Moving large existing product, design, or engineering source documents.
- Implementing application code.
- Creating external ClickUp, Notion, or GitHub issue tracking.

## done_when

- A new chat or sub-agent can use `docs/_meta/` to classify a user instruction.
- A new chat or sub-agent can choose the right documentation depth for small changes, PR-sized work, and durable decisions.
- DB planning has a clear product-vs-engineering boundary.
- Completed work requires a concise user result review.
- Work, completed, and archive relationships are documented.
- `npm run docs:check` and `npm run lint` pass.

## verification

- `npm run docs:check`
- `npm run lint`
- `find docs -name ".DS_Store"`
- `rg "docs/implementation/mvp-current-status.md|docs/assets/reference-screens|docs/features|docs/prd|docs/userflow" docs AGENTS.md README.md`

## dependencies

- None.

## handoff_notes

- This item extends the earlier docs restructure sequence without moving current canonical documents.
- Compatibility stubs should stay in place unless a later PR explicitly removes them.
- Verification passed on 2026-05-03.
- GitHub PR/Issue records should absorb Level 1 and Level 2 execution detail when they are sufficient; docs should keep durable guidance and handoff.
