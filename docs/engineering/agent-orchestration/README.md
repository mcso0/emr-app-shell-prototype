# Agent Orchestration

This area explains how external agent orchestration should operate for the EMR app shell prototype.

Canonical guides:

- `symphony-operations.md`: Symphony architecture, local setup posture, first pilot limits, and non-goals.
- `linear-agent-workflow.md`: Linear statuses, labels, issue templates, and team-style routing.
- `manual-linear-operations.md`: default manual Linear operating model for representative-led work and multi-Codex coordination without a live Symphony daemon.
- `cso-security-agent.md`: CSO security agent scope, allowed outputs, and handoff rules.

Repo-local skill:

- `.agents/skills/manual-linear-ops`: compact trigger and workflow wrapper for manual Linear operations. Use it before reading the full manual when handling Linear project, milestone, issue, review, or handoff work.

The current implementation target remains Product MVP. Agent orchestration is an engineering operations layer for managing work, not an application feature.
