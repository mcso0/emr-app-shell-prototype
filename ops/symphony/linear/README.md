# Linear Pilot Kit

Use this kit to create the first Linear project for Symphony-controlled Codex work.

This kit is intentionally manual-first. It does not call the Linear API, create tokens, or mutate a workspace. The current pilot workflows target `emr-agent-orchestration-pilot-e68d0b5a43ad`.

## Project

Recommended project name:

```text
EMR Agent Orchestration Pilot
```

Recommended project slug:

```text
emr-agent-orchestration-pilot
```

If Linear generates a different slug, use Linear's generated slug in the Symphony workflow files.
For the current pilot, Linear generated `emr-agent-orchestration-pilot-e68d0b5a43ad`, and the workflow files already use that value.

## Statuses

Create or map these statuses in the Linear team workflow:

| Status | Category | Initial pilot active? | Notes |
|---|---|---:|---|
| `Backlog` | Backlog | No | Ideas and unshaped work |
| `Ready` | Unstarted | Yes | General workflow pickup |
| `In Progress` | Started | Yes | General workflow continuation |
| `Human Review` | Started or Review | No | Required handoff stop |
| `Rework` | Started | Yes | General workflow continuation |
| `Security Review` | Started | Security workflow only | CSO-only pickup |
| `Merging` | Started or Review | No | Human-controlled for pilot |
| `Blocked` | Backlog or Paused | No | External dependency |
| `Done` | Completed | Terminal | Finished |
| `Canceled` | Canceled | Terminal | Intentionally stopped |

The general workflow's active states are `Ready`, `In Progress`, and `Rework`.

The security workflow's active states are `Security Review` and `Rework`.

## Labels

Create these labels first:

```text
team:planning
team:frontend
team:qa
team:security
team:release
type:implementation
type:docs
type:review
type:research
type:security-audit
risk:auth
risk:supabase
risk:permissions
risk:data
risk:low
cso
pilot
```

## First Pilot Order

Run the first three issues in this order:

1. `pilot-docs-closeout.md`
2. `pilot-qa-report.md`
3. `pilot-cso-auth-review.md`

Do not start with live Supabase, RLS, migrations, server enforcement, auto-merge, or deployment automation.

## Before First Daemon Run

1. Create the Linear project and statuses.
2. Create the labels.
3. Create only one pilot issue and set it to `Ready`.
4. Confirm the workflow file being tested targets the generated Linear project slug, currently `emr-agent-orchestration-pilot-e68d0b5a43ad`.
5. Export `LINEAR_API_KEY` in the shell running Symphony.
6. Start with `agent.max_concurrent_agents: 1`.
7. Watch the workspace and logs until the issue reaches `Human Review`.

## Success Criteria

The first pilot is successful when:

- Symphony creates one isolated workspace.
- Codex reads the required repo docs.
- The issue stays inside scope.
- The final report names changed files or explains that no code changed.
- Verification results are included.
- The issue is ready for `Human Review`.
