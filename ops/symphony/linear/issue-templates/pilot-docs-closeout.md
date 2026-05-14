# Pilot Issue: Docs Closeout Dry Run

Labels:

```text
pilot
team:planning
type:docs
risk:low
```

Status:

```text
Ready
```

## Goal

Verify that the Symphony general workflow can complete a low-risk documentation-only issue and stop at Human Review.

## Context

- Read `AGENTS.md`.
- Read `docs/agent-start-here.md`.
- Read `docs/engineering/current-status.md`.
- Read `docs/engineering/agent-orchestration/symphony-operations.md`.
- Read `docs/work/agent-orchestration/SYMPHONY-PR-001-orchestration-foundation.md`.

## Scope

- Review the Symphony orchestration docs for unclear first-run instructions.
- If a real clarity issue is found, make a small documentation-only correction.
- Keep the change inside `ops/symphony/` or `docs/engineering/agent-orchestration/`.

## Out of Scope

- Running Symphony.
- Installing Elixir, mise, or Mix.
- Changing application source code.
- Creating Linear resources through API.
- Auto-merge or deployment.

## Done Criteria

- Report whether the current first-run docs are clear enough for a pilot.
- If docs changed, list exact files changed.
- Stop at Human Review.

## Verification

```bash
npm run docs:check
```

## Final Report Requirements

- What changed, or why no change was needed
- Files inspected
- Verification result
- Human Review readiness

