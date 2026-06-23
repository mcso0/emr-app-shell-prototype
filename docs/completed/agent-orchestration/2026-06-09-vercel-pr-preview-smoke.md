---
id: COMPLETED-AGENT-ORCHESTRATION-VERCEL-PR-PREVIEW-SMOKE-2026-06-09
status: completed
area: agent-orchestration
doc_type: verification-note
related_work:
  - RELEASE-OPS-PR-001
supersedes: []
superseded_by: []
last_updated: 2026-06-09
---

# Vercel PR Preview Smoke Note

This docs-only change exists to verify that Vercel Git Integration creates a Preview deployment for a pull request.

Scope:

- create a PR preview test from a feature branch;
- avoid fixed staging alias changes;
- avoid production deploy or production promote;
- avoid secret, env, live data, email, payment, provider, or Supabase changes.

Expected result:

- GitHub shows the existing checks for the PR;
- Vercel creates a Preview deployment or PR comment/check for this branch;
- fixed staging and production aliases remain unchanged.
