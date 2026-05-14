# Symphony Operations

Updated: 2026-05-14

## Purpose

Use Symphony to turn Linear issues into isolated Codex work sessions. The goal is to manage work at the issue level instead of manually supervising many long Codex chats.

For this repository, Symphony should start as a conservative operations layer:

- One issue maps to one isolated workspace.
- The agent follows `AGENTS.md`, `docs/agent-start-here.md`, and `docs/engineering/current-status.md`.
- Work stops at `Human Review`.
- Merge and deployment stay human-controlled until the workflow proves reliable.

## Repository Contracts

Workflow files live in `ops/symphony/`:

| File | Use |
|---|---|
| `ops/symphony/WORKFLOW.md` | General implementation, docs, QA, and low-risk maintenance work |
| `ops/symphony/WORKFLOW.security.md` | CSO security audit work only |

The workflow files target the Linear project slug `emr-agent-orchestration-pilot-e68d0b5a43ad`.
This is the current generated Linear slug for the pilot project. If the project is recreated and Linear generates a different slug, update the workflow front matter and `ops/symphony/linear/README.md` together before starting the daemon.

## Local Runtime Posture

Current local environment check shows:

- Codex CLI is installed.
- `codex app-server` is available.
- `mise` is installed.
- The OpenAI Elixir reference runner is cloned at `/Users/iseung-ug/Projects/openai-symphony`.
- `mise exec -- mix setup` and `mise exec -- mix build` have completed in `/Users/iseung-ug/Projects/openai-symphony/elixir`.
- `ops/symphony/run-local.sh` can load `LINEAR_API_KEY` from macOS Keychain service `emr-symphony-linear-api-key`.

Therefore the first live Symphony run needs:

- Create a Linear Personal API key.
- Save it once with `ops/symphony/run-local.sh --save-key`, or export it as `LINEAR_API_KEY` in the shell that starts Symphony.

Do not treat the workflow files as proof that a live daemon is already running.

The current pilot workflow bootstraps issue workspaces from the local checkout instead of GitHub:

```bash
git clone /Users/iseung-ug/Projects/emr-app-shell-prototype .
rsync -a --exclude .git --exclude node_modules --exclude .next /Users/iseung-ug/Projects/emr-app-shell-prototype/ .
npm install
```

This is intentional for the first run because the orchestration docs and workflow files may still be uncommitted while the pilot is being shaped.

The workflow explicitly sets `codex.approval_policy: never` for compatibility with Codex CLI `0.128.0`, which rejects the OpenAI reference runner's older object-form `reject` default.

## First Pilot

Start with:

- `agent.max_concurrent_agents: 1`
- Low-risk docs, QA report, or design-system cleanup issues
- No automatic merge
- No automatic deployment
- Human Review handoff for every issue

Good first issue types:

- Work item shaping
- Documentation closeout
- Design-system token cleanup
- QA-only regression report
- CSO auth-boundary report

Avoid as first pilots:

- Live Supabase migrations
- RLS policies
- Server permission enforcement
- Production persistence
- Secret rotation
- Deployment automation

## Safety Boundaries

The project is currently a session-only frontend prototype. Live DB/API persistence, live Supabase validation, migrations, RLS, and server-side permission enforcement are not complete.

Symphony agents must not cross those boundaries unless the Linear issue explicitly scopes the work and cites the relevant auth/security source docs.

Client-only permission gating is not complete security. Security-sensitive changes need Human Review and CSO review.

## Non-Goals

This foundation does not:

- Install or run Symphony.
- Create the Linear project.
- Create Linear API keys.
- Add label-based dispatch to the OpenAI reference runner.
- Grant agents production secrets.
- Enable auto-merge or auto-deploy.

## Runbook Sketch

After the Linear project exists:

1. Confirm the workflow project slug still matches the Linear project.
2. Ensure the Linear API key is available through `ops/symphony/run-local.sh --save-key` or `LINEAR_API_KEY`.
3. Confirm only one low-risk Linear issue is in `Ready`.
4. Start the Symphony runner with `ops/symphony/run-local.sh`.
5. Watch the agent workspace and logs.
6. Confirm the issue lands in `Human Review` with a useful report.
7. Only then add a second concurrent workflow or broader issue type.

## Local Runner Commands

Use these commands from the repository root:

```bash
# Store or rotate the Linear API key in macOS Keychain.
ops/symphony/run-local.sh --save-key

# Run the general workflow and dashboard on port 4040.
ops/symphony/run-local.sh

# Run the CSO-only security workflow.
ops/symphony/run-local.sh --security

# Remove the saved Linear API key.
ops/symphony/run-local.sh --forget-key
```

The runner never writes the API key into repo files. It checks an existing `LINEAR_API_KEY` first, then the Keychain service, then falls back to a hidden one-time prompt.

## Operator Loop

1. Shape one Linear issue in Korean.
2. Set labels and project.
3. Move exactly one issue to `Ready`.
4. Keep the Symphony terminal open.
5. Wait for the issue to reach `Human Review`.
6. Read the Linear comment or session report.
7. Move the issue to `Done` for approval, or `Rework` with a Korean review request.
8. Move the next issue to `Ready`.
