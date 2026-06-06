---
id: "OWNER-OS-PR-002"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-421"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "docs/_meta/agent-rag-map.md"
  - "docs/_meta/owner-safety-os.md"
  - ".agents/skills/emr-owner-safety-os/SKILL.md"
  - ".agents/skills/codex-agent-router/SKILL.md"
owner: "Codex"
---

# OWNER-OS-PR-002: Owner OS Router Skill

## Goal

Add a repo-local Owner OS router skill that classifies broad requests before implementation and outputs either an intake brief, work packet draft, safety handoff, Linear handoff, or scoped implementation path.

## Background

Owner OS must reduce token waste and avoid implicit work decisions. It needs a front-door skill that decides task type, depth level, autonomy level, approval gates, required source docs, and output shape before Codex starts editing or using external tools.

Linear issue:

- `DEN-421`: `01-01 Build Owner OS router skill`

## Scope

- Add `.agents/skills/clair-owner-os-router/SKILL.md`.
- Add `.agents/skills/clair-owner-os-router/agents/openai.yaml`.
- Keep the existing `.agents/skills/codex-agent-router/` skill as the custom subagent router and connect it to Owner OS only as a costed, read-only delegation layer.
- Document dry-run scenarios for router behavior.

## Out Of Scope

- CLI implementation.
- Dashboard implementation.
- OpenAI API integration.
- Automatic Linear mutation.
- Multi-agent dispatch by default.
- Remote Supabase, production deploy, real data, payment, email, provider integration.

## Done Criteria

- The skill validates with `quick_validate.py`.
- The skill explains when to route to `$emr-owner-safety-os`, `$manual-linear-ops`, or `$codex-agent-router`.
- The skill includes at least five scenario dry-run checks.
- Docs verification passes.

## Verification

- `python3 /Users/iseung-ug/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/clair-owner-os-router`
- `npm run docs:check`

## Completion Notes

- Added `.agents/skills/clair-owner-os-router/SKILL.md`.
- Added `.agents/skills/clair-owner-os-router/agents/openai.yaml`.
- Updated `docs/_meta/agent-rag-map.md` with Owner OS routing.
- Connected existing `.agents/skills/codex-agent-router/` as an optional read-only subagent routing layer for reducing parent-model cost while keeping 5.5 as the escalation model for ambiguity, risk, broad synthesis, and failed verification.
- Updated the Owner OS product plan and router skill with tiered parent-model/subagent cost policy and packet fields for parent model tier, 5.5 escalation decision, trigger, cost rationale, summaries, and parent decision.
- `npm run docs:check` passed.
- `quick_validate.py` could not run because `PyYAML` is unavailable in the local Python environments; equivalent frontmatter/name/description checks passed via Node.
- Closeout report: `docs/completed/agent-orchestration/2026-06-05-den-421-owner-os-router-skill-report.html`.
