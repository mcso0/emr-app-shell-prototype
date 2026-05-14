# Pilot Issue: QA Report Dry Run

Labels:

```text
pilot
team:qa
type:review
risk:low
```

Status:

```text
Ready
```

## Goal

Verify that the Symphony general workflow can run a low-risk QA/reporting task without changing product behavior.

## Context

- Read `AGENTS.md`.
- Read `docs/agent-start-here.md`.
- Read `docs/engineering/current-status.md`.
- Read `docs/engineering/testing/mvp-gap-analysis.md` if present.
- The app is a session-only frontend prototype.

## Scope

- Inspect existing Playwright coverage and current recommended verification commands.
- Produce a concise QA readiness report for one low-risk area: app shell or home.
- File no code changes unless a broken doc reference prevents the report.

## Out of Scope

- Broad test suite rewrite.
- New app behavior.
- Visual redesign.
- Live Supabase/API validation.
- Browser testing against production.

## Done Criteria

- QA report names what was checked.
- QA report names the command results.
- Any follow-up is proposed as a separate issue.
- Stop at Human Review.

## Verification

```bash
npm run docs:check
npm run lint
```

If the issue chooses a specific existing Playwright spec, run that spec and report the result.

## Final Report Requirements

- Area reviewed
- Commands run
- Pass/fail result
- Follow-up issue recommendations, if any
- Human Review readiness

