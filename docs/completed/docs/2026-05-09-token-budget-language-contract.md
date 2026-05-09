---
id: DOCS-CLOSEOUT-2026-05-09-TOKEN-BUDGET-LANGUAGE-CONTRACT
status: approved
area: docs
doc_type: closeout
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-05-09
---

# Closeout: Token Budget Language Contract

## Summary

Added a durable language contract for future Codex work: users may write Korean, agent-facing plans and handoffs should use concise English by default, and final user-facing reviews should stay Korean unless requested otherwise.

The current docs guidance also removes the dedicated 조제/처치 preservation rule. 조제/처치 is now treated like other implemented workflow modules: it can be changed when a scoped work item includes it, while unrelated work still stays within its own scope.

Follow-up: `AGENTS.md` was compressed into a short always-loaded repository contract. The longer coding discipline rules moved to `docs/_meta/coding-discipline.md` so Codex can read them only when non-trivial implementation work needs them.

## Changed Docs or Files

- `AGENTS.md`
- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/_meta/`
- `docs/_meta/coding-discipline.md`
- `docs/work/templates/work-item.md`
- Active product, design, and engineering source docs that carried the old 조제/처치 preservation guardrail

## Verification

- Passed: `npm run docs:check`
- Passed: targeted `rg` checks for language-contract text and removed preservation guardrails
- Passed: `wc -c -w -l AGENTS.md`
- Passed: targeted `rg` check for moved coding-discipline headings

## Remaining Risk

- Historical archive, completed, and already-done work item records still mention past 조제/처치 preservation because those records describe previous PR scope and were intentionally left intact.

## Next Steps

- Use the updated language contract for new work items, handoff notes, and result reviews.
