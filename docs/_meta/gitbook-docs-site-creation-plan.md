---
id: DOCS-META-gitbook-docs-site-creation-plan
status: approved
area: docs-restructure
doc_type: plan
related_work:
  - DEN-257
supersedes: []
superseded_by: []
last_updated: 2026-05-24
---

# GitBook Docs Site Creation Plan

This plan defines how to create a GitBook docs site for CLAiR EMR docs without changing the repo source-of-truth model or publishing external-public documentation by default.

Current decision: use GitBook as a private/internal reader portal for 승욱 and project review. Do not create or publish the site from Codex; use this plan as the manual setup path.

## Official GitBook Facts Checked

| Topic | Official GitBook guidance |
|---|---|
| Docs site model | GitBook publishes documentation as a `docs site`; site content comes from organization `spaces`. A new docs site can create a new space or link an existing one. Source: [Publish a docs site](https://gitbook.com/docs/published-documentation/overview). |
| Visibility and audience | GitBook says sites are public by default, and visibility/audience can be changed in site settings. Primary publishing options include public, private share links, and authenticated access. Source: [Publish a docs site](https://gitbook.com/docs/published-documentation/overview), [Site settings](https://gitbook.com/docs/publishing-documentation/site-settings). |
| Space/site structure | A docs site can link one or multiple spaces. Spaces can be arranged as site sections or content variants. Source: [Site structure](https://gitbook.com/docs/publishing-documentation/site-structure), [Concepts](https://gitbook.com/docs/getting-started/concepts). |
| Private share links | Share links are available on Premium and Ultimate site plans; anyone with an active private link can read the content. Links can be revoked. Source: [Private publishing with share links](https://gitbook.com/docs/publishing-documentation/publish-a-docs-site/share-links). |
| Custom domain | Default sites use `[subdomain].gitbook.io`; custom domains are available on Premium and Ultimate site plans. Source: [Set a custom domain](https://gitbook.com/docs/publishing-documentation/custom-domain). |
| Git Sync | GitBook supports GitHub/GitLab sync for docs-as-code workflows. Source: [Git Sync](https://www.gitbook.com/features/git-sync). |

## Recommended Setup

Use this initial setup:

| Decision | Recommendation | Reason |
|---|---|---|
| Site purpose | Private/internal docs portal | Current need is easier review by 승욱, not external documentation. |
| Source of truth | Repo `docs/` remains canonical | Existing agent workflow, `docs/SUMMARY.md`, and `npm run docs:check` already protect repo docs. |
| GitBook editing | Treat GitBook as reader portal; avoid direct GitBook edits for source-of-truth content | Prevent drift between GitBook and repo. If GitBook edits happen, reconcile them back into repo immediately. |
| Space mapping | Start with one GitBook space linked to repo `docs/` | Current docs are one product/workstream. Multiple spaces are premature. |
| Site structure | One docs site, one primary docs space | Keep navigation simple; use `docs/SUMMARY.md` and area README files for depth. |
| Audience mode | Prefer unpublished/manual review first; then private/internal access | Avoid accidental public exposure while validating sync, sidebar, and sensitive areas. |
| Share links | Use only if the plan/feature is available and the audience is explicit | GitBook share links grant read access to anyone with the link. |
| Authenticated access | Defer | Useful for an internal knowledge base, but setup should be a later access-control decision. |
| Public access | Do not use for now | Current docs include auth/security, DB/RLS, operations, and launch-readiness boundaries that are internal-review material. |
| Custom domain | Defer; use default GitBook URL first | Custom domains require plan eligibility and DNS work. Not needed for private review. |

## Manual Creation Path

1. In GitBook, create or select the organization that will own CLAiR EMR docs.
2. Create a docs site from the Docs site sidebar flow or from an existing space.
3. Choose a site name such as `CLAiR EMR Docs`.
4. Link or import the existing repo `docs/` content through Git Sync if available for the workspace.
5. Configure the content root so `docs/index.md` is the portal entry and `docs/SUMMARY.md` controls the curated sidebar.
6. Keep the site unpublished or private/internal while validating navigation.
7. Check the first reading path:
   - `docs/index.md`
   - `docs/agent-start-here.md`
   - `docs/engineering/current-status.md`
   - `docs/work/index.md`
   - `docs/_meta/gitbook-private-operations-checklist.md`
8. Run `npm run docs:check` locally before pushing docs changes intended for GitBook sync.
9. If widening access beyond 승욱, run [GitBook Private Operations Checklist](gitbook-private-operations-checklist.md).

## Pre-Publish Review Gate

Before changing the site from private/internal review to public, private share-link, authenticated access, or customer-facing review:

- [ ] Define the audience and why GitBook access is needed.
- [ ] Confirm whether the audience can see auth/security, DB/RLS, operations, launch readiness, completed reports, and demo data.
- [ ] Review [GitBook Private Operations Checklist](gitbook-private-operations-checklist.md).
- [ ] Confirm no real data, secrets, credentials, or unsupported launch/compliance claims are present.
- [ ] Decide whether `archive/`, `completed/`, and long history docs should stay out of primary navigation.
- [ ] Decide whether custom domain or authenticated access is worth the plan/setup overhead.
- [ ] Record the approval, rollback/unpublish condition, and owner.

## Stop Conditions

Stop and ask 승욱 before:

- creating or publishing a real GitBook site
- enabling public access
- creating private share links for anyone beyond 승욱
- enabling authenticated access or connecting an identity provider
- configuring DNS or custom domains
- editing GitBook content directly instead of repo docs
- syncing changes that expose secrets, real data, private access details, or unsupported production/compliance claims

## Verification

For this plan:

- Run `npm run docs:check` after link/sidebar/portal changes.
- Validate frontmatter with the available local YAML parser.

For actual site setup later:

- Verify GitBook renders `docs/index.md` as the intended entry point.
- Verify `docs/SUMMARY.md` produces the expected sidebar.
- Verify sensitive areas are not more prominent than intended.
- Verify access mode before sharing the URL.
