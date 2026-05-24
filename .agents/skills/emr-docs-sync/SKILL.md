---
name: emr-docs-sync
description: Repo-specific documentation sync workflow for CLAiR EMR. Use when the user explicitly asks to run docs sync, update GitBook-facing docs, reconcile docs after code or work changes, prepare PR-ready docs updates, or invoke $emr-docs-sync. Do not use for simple discussion about this skill unless asked to execute it.
---

# EMR Docs Sync

Use this skill to keep CLAiR EMR repository docs, work records, and GitBook-facing navigation aligned after meaningful implementation, QA, planning, or work-status changes.

Do not run this workflow just because the user is discussing, creating, or editing this skill. Run it only when the user asks to sync or update docs.

## Required Reading

Read the smallest relevant sections in this order:

1. `docs/agent-start-here.md`
2. `docs/engineering/current-status.md`
3. `docs/README.md`
4. `docs/_meta/intake-rules.md`
5. `docs/_meta/agent-rag-map.md`
6. `docs/_meta/result-review-rules.md`
7. `docs/work/index.md` and the active work item, when PR-scoped work is involved

For GitBook, docs portal, sidebar, area README, reader-boundary, access, sharing, docs-site setup, or docs-structure evaluation work, also read `docs/_meta/gitbook-structure-rules.md`, `docs/_meta/gitbook-private-operations-checklist.md`, and `docs/_meta/gitbook-docs-site-creation-plan.md`.

Use `docs/_meta/agent-rag-map.md` to choose task-specific product, design, engineering, or testing source docs. Avoid broad archive or completed-report reads unless the active task points there.

## Boundaries

- Treat repo `docs/` as the canonical source of truth. GitBook is a readable portal over repo docs.
- Treat `docs/SUMMARY.md` as the GitBook sidebar map and `docs/index.md` as the human-facing portal.
- Update only docs affected by the verified code, test, work-item, or decision changes.
- Keep documentation updates small, factual, and source-backed.
- Do not add new source-of-truth docs under `docs/implementation/`; that area is for compatibility stubs.
- Treat GitBook as a private/internal reader portal by default, but do not add secrets, real data, credentials, or unverified launch/security claims to prominent reading paths.
- Do not publish or expose sensitive auth, security, database, launch-readiness, customer, patient, payment, or identity details externally without explicit review scope.
- Do not widen GitBook access, share private links beyond the current review audience, or convert GitBook to external-public without using the private operations checklist.
- Do not claim remote Supabase staging, production deployment, live provider integrations, RLS completeness, or legal/compliance readiness unless verified in the scoped work.
- Use synthetic examples only.

## Workflow

1. Establish scope:
   - Inspect the user's request, active work item, and current diff.
   - Identify whether the change is product-facing, design-facing, engineering-facing, work-management-only, completion-only, or GitBook navigation-facing.
   - If no files or work status changed, report that no docs update is needed.

2. Map affected docs:
   - Current status: `docs/engineering/current-status.md`
   - Human portal: `docs/index.md`
   - GitBook sidebar: `docs/SUMMARY.md`
   - Operating rules: `docs/README.md` and `docs/_meta/*`
   - Product behavior: `docs/product/**`
   - Design or UX behavior: `docs/design/**`
   - Architecture, auth, data, testing, or operations: `docs/engineering/**`
   - Work tracking: `docs/work/**`
   - Completion records: `docs/completed/**`

3. Decide what to edit:
   - Update `docs/engineering/current-status.md` only for durable MVP status, scope, verification baseline, or recommended-work changes.
   - Update `docs/index.md` when a human-facing entry point or core source changes.
   - Update `docs/SUMMARY.md` when a new or moved document should appear in GitBook navigation.
   - Update source docs when behavior, contracts, mock/live boundaries, QA scenarios, or decisions changed.
   - Update the active work item with status, verification, and handoff notes when applicable.
   - Add a concise `docs/completed/` closeout only when the work item or change meaningfully needs a durable completion record.

4. Preserve structure:
   - Reuse existing section names, terminology, table shapes, and link style.
   - Prefer moving or linking current guidance over duplicating it.
   - If a canonical document moves, leave a short moved stub at important old paths for at least one or two PRs.
   - Keep archive, completed reports, and long history out of the main reading path unless specifically needed.

5. Verify:
   - Run `npm run docs:check` after docs path, link, sidebar, or portal edits.
   - Run additional verification only when the docs update depends on implementation behavior that has not already been verified in the current work.
   - If verification cannot be run, say exactly what was not run and why.

## GitBook Hygiene

When the request mentions GitBook, docs portal, sidebar, navigation, or publishing readiness:

- Read `docs/_meta/gitbook-structure-rules.md` first.
- Check `docs/SUMMARY.md` for sidebar placement.
- Check `docs/index.md` for human entry-point links.
- Check `docs/_meta/gitbook-private-operations-checklist.md` before changing access, sharing, or publication posture.
- Check `docs/_meta/gitbook-docs-site-creation-plan.md` before creating or configuring a GitBook docs site.
- Keep current, high-signal docs visible near the top-level sidebar.
- Keep compatibility, archive, and historical docs out of primary navigation unless the user explicitly asks.
- Do not edit GitBook directly or push to `main` unless the user explicitly scopes that action.

## Docs Audit Checklist

When asked to evaluate docs or GitBook structure, use the audit criteria in `docs/_meta/gitbook-structure-rules.md` before proposing changes.

## Final Response

Reply in Korean unless the user asks otherwise. Start with a brief non-developer explanation of what changed and why it matters, then include:

- Docs changed
- Verification run
- Claims intentionally not made or not verified
- Suggested next step, if useful
