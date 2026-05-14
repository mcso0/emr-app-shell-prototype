# Symphony Operations

This directory contains repository-owned workflow contracts for running OpenAI Symphony against this project.

Symphony is treated as an orchestration layer, not as product code. It watches Linear issues, creates isolated workspaces, starts `codex app-server`, and lets Codex work inside the issue workspace. This repo controls the agent behavior through workflow files and the existing `AGENTS.md` / `docs/` operating model.

## Workflows

| File | Purpose | Merge posture |
|---|---|---|
| `WORKFLOW.md` | General implementation, docs, QA, and low-risk maintenance work | Stop at `Human Review` |
| `WORKFLOW.security.md` | CSO security audit work only | Report only; no code changes |

## Required Setup

The workflow front matter now targets the Linear project slug `emr-agent-orchestration-pilot-e68d0b5a43ad`.

Use `ops/symphony/linear/README.md` to review the first Linear project, statuses, labels, and pilot issues.

Use `ops/symphony/USAGE.ko.md` for the Korean operator guide.

The local host also needs:

- Codex CLI with `codex app-server`
- Linear personal API key available through `LINEAR_API_KEY` or the macOS Keychain service used by `ops/symphony/run-local.sh`
- A Symphony runner, such as the experimental OpenAI Elixir reference implementation

The current pilot uses a local workspace bootstrap instead of cloning GitHub. This lets Symphony see the uncommitted orchestration docs/config during the first dry run:

```bash
git clone /Users/iseung-ug/Projects/emr-app-shell-prototype .
rsync -a --exclude .git --exclude node_modules --exclude .next /Users/iseung-ug/Projects/emr-app-shell-prototype/ .
npm install
```

Codex CLI and the OpenAI Elixir reference runner are installed in the primary development environment. Store the Linear API key in macOS Keychain before routine runs; do not commit it to the repo.

The workflow explicitly sets `codex.approval_policy: never` because Codex CLI `0.128.0` rejects the reference runner's older object-form `reject` default.

## First Pilot Limits

Start with these limits until the workflow has produced a few clean Human Review handoffs:

- `agent.max_concurrent_agents: 1`
- Low-risk docs, QA report, or design-system cleanup issues first
- No automatic merge
- No production deploy
- No live Supabase migration, RLS, or server enforcement work unless a Linear issue explicitly scopes it
- Security issues use `WORKFLOW.security.md`, not the general workflow

Recommended first issue order:

1. `ops/symphony/linear/issue-templates/pilot-docs-closeout.md`
2. `ops/symphony/linear/issue-templates/pilot-qa-report.md`
3. `ops/symphony/linear/issue-templates/pilot-cso-auth-review.md`

## Run Shape

Use the local runner wrapper for day-to-day operation:

```bash
ops/symphony/run-local.sh --save-key
ops/symphony/run-local.sh
```

The first command prompts for a Linear Personal API key and stores it in macOS Keychain service `emr-symphony-linear-api-key`. The second command starts the general workflow with the dashboard at `http://127.0.0.1:4040/`.

Use this command for security audit issues:

```bash
ops/symphony/run-local.sh --security
```

Use this command to remove the saved key:

```bash
ops/symphony/run-local.sh --forget-key
```

Using the OpenAI reference implementation directly, the command shape is:

```bash
export LINEAR_API_KEY=...
cd /path/to/openai-symphony/elixir
mise exec -- ./bin/symphony /Users/iseung-ug/Projects/emr-app-shell-prototype/ops/symphony/WORKFLOW.md
```

For security audit issues:

```bash
export LINEAR_API_KEY=...
cd /path/to/openai-symphony/elixir
mise exec -- ./bin/symphony /Users/iseung-ug/Projects/emr-app-shell-prototype/ops/symphony/WORKFLOW.security.md
```

Do not run both workflows against the same Linear project/status set until the project labels and dispatch rules are confirmed. The reference workflow uses project and state selection; label-specific routing may require either separate Linear projects, separate active states, or a custom Symphony runner.
