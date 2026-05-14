---
id: "SYMPHONY-PR-001"
status: "done"
area: "agent-orchestration"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/agent-orchestration/symphony-operations.md"
  - "docs/engineering/agent-orchestration/linear-agent-workflow.md"
  - "docs/engineering/agent-orchestration/cso-security-agent.md"
dependencies:
  - "Real Linear project slug before live Symphony run"
  - "Symphony runner runtime setup before live daemon run"
updated: "2026-05-14"
---

# Symphony Orchestration Foundation

## Goal

Add the first repository-owned Symphony operating contract for Linear-driven Codex work, including a separate read-only CSO security audit workflow.

## Scope

- Add `ops/symphony/WORKFLOW.md` for general implementation, docs, QA, and low-risk maintenance issues.
- Add `ops/symphony/WORKFLOW.security.md` for CSO-only security review issues.
- Add engineering docs for Symphony operations, Linear workflow, and CSO security-agent routing.
- Register this work in `docs/work/index.md`.
- Keep Linear project slug as a placeholder until the real Linear project exists.

## Out Of Scope

- Installing `mise`, Elixir, Mix, or the OpenAI Symphony reference implementation.
- Running a live Symphony daemon.
- Creating or mutating the Linear project through API.
- Automatic merge or deployment.
- Live Supabase validation, migrations, RLS, or server permission enforcement.
- Label-aware custom Symphony runner implementation.

## Done When

- `ops/symphony/` contains general and security workflow contracts.
- Engineering docs explain the operating model and CSO boundaries.
- Work index links this item.
- Documentation verification passes.

## Verification

- `npm run docs:check`
- Workflow front matter sanity check:

```bash
node -e "const fs=require('fs'); for (const f of ['ops/symphony/WORKFLOW.md','ops/symphony/WORKFLOW.security.md']) { const s=fs.readFileSync(f,'utf8'); if (!s.startsWith('---\\n')) throw new Error(f+' missing front matter'); const end=s.indexOf('\\n---',4); if (end < 0) throw new Error(f+' missing closing front matter'); console.log(f+' ok'); }"
```

## Handoff Notes

Before first live run, confirm the Linear project/statuses/labels still match `ops/symphony/`, and install or select a Symphony runner. Start with one low-risk issue and `max_concurrent_agents: 1`.
