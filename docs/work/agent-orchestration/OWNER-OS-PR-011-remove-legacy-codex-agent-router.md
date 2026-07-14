---
id: "OWNER-OS-PR-011"
status: "done"
area: "agent-orchestration"
priority: "P1"
target_pr: "User request / legacy router removal"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "docs/_meta/agent-rag-map.md"
  - ".agents/skills/clair-owner-os-router/SKILL.md"
  - ".agents/skills/subagent-decision/SKILL.md"
owner: "Codex"
---

# OWNER-OS-PR-011: Remove Legacy Codex Agent Router

## Goal

Remove the obsolete `codex-agent-router` skill and replace its live repository dependencies with guidance that matches the current native multi-agent runtime.

## Background

The current runtime can spawn task-scoped agents, but its dispatch interface does not select the fixed model IDs or `.codex/agents/*.toml` profiles assumed by the legacy router. During the normalization diagnosis, following the old route produced generic agents while presenting them as named custom agents. This is the RED baseline for the routing-guidance correction.

## Scope

- Delete `.agents/skills/codex-agent-router/`.
- Remove live dependencies on `$codex-agent-router` from routing skills and current source docs.
- Route approved delegation directly through the current runtime's native multi-agent capability.
- State that read-only behavior and model/profile selection must not be claimed unless the active dispatch interface enforces them.
- Preserve `.codex/agents/*.toml` profiles as separately scoped artifacts.

## Out Of Scope

- Reworking or deleting `.codex/agents/*.toml`.
- Rewriting historical work items, completed reports, generated review output, or old changelog entries.
- Changing the broader Owner OS model-tier policy.
- Resuming the DB normalization diagnosis.

## Done Criteria

- The legacy skill directory no longer exists.
- Active skills and current source docs contain no dependency on `$codex-agent-router`.
- `subagent-decision` dispatches directly through native multi-agent tools and avoids unsupported model/profile claims.
- Three focused routing scenarios confirm the corrected guidance.
- `npm run docs:check` and relevant skill validation pass.

## Verification

- `rg -n "codex-agent-router" .agents/skills docs/_meta docs/product/service --glob '!docs/completed/**' --glob '!docs/archive/**'`
- `python3 /Users/iseung-ug/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/subagent-decision`
- `python3 /Users/iseung-ug/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/clair-owner-os-router`
- Three read-only delegation pressure scenarios using native multi-agent dispatch
- `npm run docs:check`
- `git diff --check`

## Completion Notes

- Deleted `.agents/skills/codex-agent-router/`, including its OpenAI skill metadata.
- Updated `subagent-decision`, `clair-owner-os-router`, the Owner OS product plan, and the agent RAG map to use native task-scoped multi-agent dispatch.
- Preserved `.codex/agents/*.toml`, completed reports, generated output, the original OWNER-OS-PR-002 record, and the historical 2026-06-05 changelog entry.
- GREEN routing scenarios passed for a one-line edit (`DO_NOT_USE_SUBAGENTS`), broad read-only mapping (`USE_SUBAGENTS_FOR_EXPLORATION`), and auth/RLS independent review (`USE_SUBAGENTS_FOR_REVIEW_ONLY`).
- Confirmed the deleted directory is absent and active skills/current source docs contain no `codex-agent-router` reference.
- `npm run docs:check` passed: 801 docs/agent Markdown files checked.
- `git diff --check` passed.
- The official `quick_validate.py` was attempted with both system and bundled Python, but both lacked `PyYAML`. An equivalent Ruby YAML/frontmatter check passed for `subagent-decision` and `clair-owner-os-router` without installing dependencies.
