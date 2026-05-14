---
tracker:
  kind: linear
  project_slug: "emr-agent-orchestration-pilot-e68d0b5a43ad"
  active_states:
    - Ready
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Canceled
    - Duplicate
    - Closed
polling:
  interval_ms: 30000
workspace:
  root: ~/code/emr-symphony-workspaces
hooks:
  after_create: |
    git clone /Users/iseung-ug/Projects/emr-app-shell-prototype .
    rsync -a --exclude .git --exclude node_modules --exclude .next /Users/iseung-ug/Projects/emr-app-shell-prototype/ .
    npm install
  before_run: |
    git status --short --branch
agent:
  max_concurrent_agents: 1
  max_turns: 12
codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
  turn_timeout_ms: 3600000
  stall_timeout_ms: 300000
---
# EMR App Shell Symphony Workflow

You are working on Linear issue `{{ issue.identifier }}` for `emr-app-shell-prototype`.

{% if attempt %}
Continuation context:

- This is retry or continuation attempt `{{ attempt }}`.
- Resume from the current workspace state.
- Do not repeat completed investigation unless needed to understand changed files.
{% endif %}

## Issue Context

Identifier: `{{ issue.identifier }}`

Title: `{{ issue.title }}`

Current status: `{{ issue.state }}`

Labels: `{{ issue.labels }}`

URL: `{{ issue.url }}`

Description:

{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

## Required Reading Order

1. `AGENTS.md`
2. `docs/agent-start-here.md`
3. `docs/engineering/current-status.md`
4. `docs/work/index.md`
5. The existing or issue-named work item under `docs/work/`, when present
6. The smallest relevant source docs for the issue area

For Next.js application code, read the relevant guide in `node_modules/next/dist/docs/` before coding.

## Operating Posture

- Treat Linear as the issue control plane.
- Treat repo docs as the source of truth.
- Use Korean for Linear-facing issue summaries, review notes, and status comments; keep file paths, commands, labels, statuses, code symbols, and URLs in their original form.
- Keep the change inside the issue scope and active work item scope.
- Prefer focused PR-sized work over broad refactors.
- Update affected source docs or work items when the issue changes durable guidance.
- Stop at `Human Review` with a concise implementation report unless the issue explicitly authorizes merge.

## Project Guardrails

- Do not treat client-only permission gating as complete security.
- Do not implement live Supabase validation, migrations, RLS, or server enforcement unless the issue explicitly scopes it.
- Do not add production persistence unless the issue explicitly scopes it.
- Do not auto-merge or deploy.
- If meaningful out-of-scope work is discovered, propose a follow-up Linear issue instead of expanding this issue.
- If the issue is security-audit-only or has labels `team:security`, `type:security-audit`, or `cso`, stop and instruct the operator to route it through `ops/symphony/WORKFLOW.security.md`.

## Expected Work Loop

1. Confirm the issue scope and find the matching work item or source docs.
2. If no work item exists and the issue is PR-sized, create or update one according to `docs/_meta/intake-rules.md`.
3. Implement only the scoped change.
4. Run the issue's verification commands. If none are listed, run the narrowest useful command first.
5. Update docs/work status and handoff notes when meaningful.
6. Prepare a final report with changed files, verification, risks, and review notes.
7. Move or recommend moving the Linear issue to `Human Review`.

## Final Report Requirements

Include:

- What changed
- Files changed
- Verification run and result
- Remaining risks or blockers
- Whether the issue is ready for Human Review

Write the final report in Korean for Linear-facing review. Keep commands, paths, labels, status names, and code identifiers unchanged.

Do not include vague next steps. If there is a real follow-up, describe the exact follow-up issue that should be created.
