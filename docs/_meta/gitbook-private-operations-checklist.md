---
id: DOCS-META-gitbook-private-operations-checklist
status: deprecated
area: docs-restructure
doc_type: checklist
related_work:
  - DEN-256
supersedes: []
superseded_by: []
last_updated: 2026-06-11
---

# GitBook Private Operations Checklist

> Inactive/deprecated: GitBook is no longer the active reader path. Use this checklist only if 승욱 explicitly revives GitBook, asks to widen GitBook access, or asks to publish/share a GitBook surface.

Use this checklist before changing GitBook navigation, widening GitBook access, sharing a private GitBook link, or converting the docs site from private/internal to external-public after GitBook has been explicitly revived.

Current decision: GitBook is inactive/deprecated. The active reader path is repo `docs/` plus the internal `/docs` product-doc viewer.

## Private/Internal Review

Before making a doc prominent in the private GitBook sidebar or portal:

- [ ] The doc is current or clearly marked as historical, completed evidence, compatibility-only, draft, or superseded.
- [ ] The doc helps a reader decide where to start, what is source of truth, or what the current boundary is.
- [ ] The doc avoids real patient, guardian, customer, hospital, payment, identity, credential, or access data.
- [ ] The doc avoids secrets, environment values, tokens, private keys, service-role keys, or operational access details.
- [ ] The doc does not imply unverified production readiness, compliance readiness, full RLS coverage, live provider integration, or legal signoff.
- [ ] The doc uses synthetic examples when examples are needed.
- [ ] The sidebar does not list every child document when an area README can carry deeper navigation.

## Sensitive Areas

Run an extra reader-boundary check before promoting docs from these areas:

| Area | Check |
|---|---|
| Auth and security | No secrets, credential values, private access details, or unsupported claims that client-only permission gating is complete security. |
| DB, RLS, and live Supabase | No remote project secrets, unapproved migration/RLS execution claims, or production DB assumptions. |
| Operations and launch readiness | No production deploy, rollback, incident, monitoring, real email, payment, or provider-operation detail that needs explicit approval first. |
| Demo data and clinical examples | Synthetic-only data; no real hospital, patient, guardian, staff, billing, identity, or clinical guidance claims. |
| Provider, PACS, device, email, KakaoTalk, payment, compliance | No integration or certification claim unless the scoped work verified it and the source doc states the boundary. |

## Access Changes

Before widening GitBook access:

- [ ] Confirm the intended audience: 승욱 only, internal collaborators, contractors, prospective customer reviewers, or external-public.
- [ ] Confirm whether the audience can see auth/security, DB/RLS, operations, launch readiness, and completed reports.
- [ ] Confirm whether private links can be forwarded or indexed by the chosen GitBook setting.
- [ ] Confirm whether customer-facing or public wording is needed; if yes, create a separate publishing review issue first.

## External-Public Conversion Gate

Do not convert this GitBook space/site to external-public without a separate explicit review. That review should:

1. Define the audience and purpose.
2. Decide which docs are excluded from public navigation.
3. Review auth/security, DB/RLS, operations, launch, completed-report, and demo-data pages.
4. Remove or rewrite internal-only operational detail.
5. Confirm no real data, secrets, credentials, or unsupported production/compliance claims are present.
6. Record approval and rollback/unpublish conditions.

## Verification

- Run `npm run docs:check` after sidebar, portal, README, or path changes.
- For docs-only checklist updates, code/test/build verification is not required.
- If `npm run docs:check` fails because of unrelated dirty work, run a focused check for touched Markdown files and report the unrelated failure explicitly.
