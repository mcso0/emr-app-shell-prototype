---
id: ENGINEERING-AUTH-SECURITY-APPLICATION-SECURITY-REVIEW-2026-07-07
type: Security Review
title: Application Security Review 2026-07-07
status: review_snapshot
area: engineering
doc_type: review
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-07-07T00:00:00.000Z
description: >-
  Records the first checklist-based application security review snapshot for
  secrets, client exposure, auth boundaries, route rate limits, dependency
  advisories, and launch-grade follow-up items.
tags:
  - security
  - auth
  - audit
  - rate-limit
  - dependencies
---

# Application Security Review 2026-07-07

This is a checklist-based first pass using
[Application Security Review Checklist](application-security-review-checklist.md).
It is not a full repository-wide Codex Security scan, penetration test,
Supabase remote review, production deployment review, or compliance/legal
signoff.

## Scope

Reviewed:

- tracked secret scanning
- public env and Supabase client/server config shape
- server session and demo-header fallback shape
- API route mutation and rate-limit coverage by direct route helper usage
- selected auth/security docs and Supabase local config
- current npm advisory snapshot

Not reviewed:

- remote Supabase dashboard/project configuration
- production Vercel secrets or deployment settings
- full endpoint-by-endpoint object authorization proof
- external provider credentials, email delivery, KakaoTalk, payment, PACS, or device integrations
- real customer/patient/guardian/payment/identity data

## Summary

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Tracked secrets | Pass | `npm run security:secrets` passed; 2900 tracked files checked. | No tracked `.env*` or `.vercel/.env*` files were reported. |
| Local env hygiene | Partial | `.gitignore` ignores `.env*` and `.vercel`; `.vercel/.env.production.local` exists locally and is ignored. | Local secret contents were not printed or inspected. |
| Client-bundled env | Pass | `src/lib/supabase/config.ts` reads `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. | No client-bundled service-role or secret key use was found in the sampled config path. |
| Server session boundary | Pass | `readServerSession()` uses Supabase `auth.getClaims()` through the server client. | This avoids treating client-only session state as the sensitive authorization source. |
| Demo identity header | Partial | `resolveRoleUpdateActorIdentity()` accepts `x-clair-demo-session-user-id` only when the server session result is `mock_mode`. | Keep launch tests proving this header is rejected in live Supabase mode. |
| Mutation rate-limit coverage | Pass after follow-up | Initial scan found seven mutating route files without direct helper evidence; follow-up added shared limiter coverage and `tests/workspace-rate-limit-server.spec.ts` passed. | Reinvite request uses request-fingerprint limiting; lab result and notification mutations use actor/workspace limiting. |
| Rate-limit store | Decision recorded | `src/lib/security/rate-limit.ts` still uses an in-memory `Map` locally. | [Workspace Live API Rate Limiting](auth-login/workspace-live-api-rate-limiting.md) now records managed Redis-compatible shared storage as the production decision. |
| Supabase auth local policy | Partial | `supabase/config.toml` disables anonymous sign-ins and includes auth rate-limit settings. | Local config still has `enable_signup = true`, `minimum_password_length = 6`, and no password complexity requirement; production policy must be verified separately. |
| DB network posture | Partial | Local Supabase DB port is configured for local development. | Remote DB network restrictions and production exposure were not reviewed. |
| Dependency advisories | Pass after follow-up | Initial `npm audit --audit-level=moderate --json` exited 1 with 8 advisories; targeted dependency updates now return 0 vulnerabilities. | Storybook patch update allowed `esbuild@0.28.1`; other vulnerable transitive packages were updated through npm resolution. |

## Rate-Limit Follow-Up

The first-pass search found these mutating route files without direct
`enforceWorkspaceMutationRateLimit` or `checkRateLimit` evidence:

- `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/reinvite-request/route.ts`
- `src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts`
- `src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/archive/route.ts`
- `src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/read/route.ts`
- `src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/restore/route.ts`
- `src/app/api/workspaces/[workspaceId]/notifications/order-recheck-requests/route.ts`
- `src/app/api/workspaces/[workspaceId]/notifications/read-all/route.ts`

Follow-up disposition:

- `reinvite-request` now calls `enforceRequestRateLimit(...)` before invite
  lookup using workspace, invitation, email, and client fingerprint key parts.
- `lab-imaging/result-entries` now calls
  `enforceWorkspaceMutationRateLimit(...)` after actor resolution and before
  clinical result save work.
- Notification mutation routes now pass `mutationRateLimitOperation` into
  `resolveNotificationRouteActor(...)`; that shared resolver applies
  `enforceWorkspaceMutationRateLimit(...)` only when a mutating operation is
  provided, so notification read routes are not accidentally throttled.
- `tests/workspace-rate-limit-server.spec.ts` now checks the coverage contract
  and verifies `429`/`Retry-After` behavior for personal profile, lab result
  entry, and notification mutation loops.

## Dependency Advisory Snapshot

The initial `npm audit --audit-level=moderate --json` reported:

| Package | Severity | Direct? | Observed path | Triage note |
| --- | --- | ---: | --- | --- |
| `hono` | High | No | Transitive through `shadcn` / `@modelcontextprotocol/sdk` / `@hono/node-server`. | Needs package update or confirmation that affected Hono server/middleware surfaces are not runtime-exposed by the app. |
| `ws` | High | No | Transitive through Storybook/Vitest and `@supabase/realtime-js`. | Needs update/triage because websocket code can be runtime-relevant through Supabase realtime paths. |
| `dompurify` | Moderate | No | Transitive through `mermaid`. | Needs update/triage before any untrusted diagram/HTML rendering claim. |
| `brace-expansion` | Moderate | No | Transitive through lint/storybook tooling paths. | Likely dev/tooling risk, but still should be resolved or documented. |
| `js-yaml` | Moderate | No | Transitive through ESLint/cosmiconfig. | Likely dev/tooling risk; resolve via dependency update when practical. |
| `qs` | Moderate | No | Transitive through Express under MCP SDK. | Needs runtime exposure check. |
| `@babel/core` | Low | No | Transitive through Storybook/shadcn/lint tooling. | Tooling risk; update when dependency chain allows. |
| `esbuild` | Low | No | Transitive through Storybook/Vite. | Dev-server risk; update when dependency chain allows. |

Do not run `npm audit fix` automatically without a scoped dependency update
work item because it may rewrite lockfile ranges or pull framework/tooling
updates that need build, lint, and Storybook verification.

Follow-up remediation:

- Ran targeted npm updates for vulnerable transitive packages:
  `@babel/core`, `brace-expansion`, `dompurify`, `esbuild`, `hono`,
  `js-yaml`, `qs`, and `ws`.
- Updated Storybook packages from `10.4.4` to `10.4.6` so their dependency
  range permits patched `esbuild@0.28.1`.
- Current `npm audit --json` and `npm audit --audit-level=moderate --json`
  report 0 vulnerabilities.

## Findings

| Priority | Finding | Recommended next action |
| --- | --- | --- |
| P1 | Seven mutating route files lacked direct rate-limit evidence in the first-pass scan. | Closed in this pass with route/shared resolver limiters and regression coverage. |
| P1 | Initial npm advisory snapshot included high transitive advisories in `hono` and `ws`. | Closed in this pass with targeted dependency updates; current npm audit reports 0 vulnerabilities. |
| P1 | Production-grade rate limiting still needs shared storage implementation. | Decision recorded: use managed Redis-compatible shared storage before production-demo or multi-instance deployment. |
| P2 | Demo identity header is intentionally present for mock fallback. | Keep regression coverage proving demo headers are ignored outside mock mode and cannot authorize live Supabase routes. |
| P2 | Supabase local auth config is not a production password/signup policy. | Before live launch, verify invite-only onboarding, signup policy, password policy, and provider/session settings against the launch gate. |
| P2 | Remote DB/network posture was not reviewed. | Review Supabase remote network restrictions, exposed schemas, RLS/grants, and advisor output under an approved remote/staging work item. |

## Commands Run

```bash
python3 /Users/iseung-ug/.codex/plugins/cache/openai-curated-remote/codex-security/0.1.10/scripts/config_preflight.py --profile security_scan --cwd /Users/iseung-ug/Projects/emr-app-shell-prototype --runtime-check delegation_available=true --runtime-check goal_tools_available=true --available-plugin-skill attack-path-analysis --available-plugin-skill deep-security-scan --available-plugin-skill finding-discovery --available-plugin-skill fix-finding --available-plugin-skill security-diff-scan --available-plugin-skill security-scan --available-plugin-skill threat-model --available-plugin-skill track-findings --available-plugin-skill triage-finding --available-plugin-skill validation
npm run security:secrets
npm audit --audit-level=moderate --json
npm ls hono ws dompurify brace-expansion js-yaml qs esbuild @babel/core --depth=6
npm update @babel/core brace-expansion dompurify esbuild hono js-yaml qs ws
npm update storybook @storybook/addon-docs @storybook/addon-mcp @storybook/addon-vitest @storybook/nextjs-vite eslint-plugin-storybook esbuild
npx playwright test tests/workspace-rate-limit-server.spec.ts
npm audit --json
npm audit --audit-level=moderate --json
npm run lint
npx tsc --noEmit
npm run build
npm run build-storybook
find src/app/api -type f -name 'route.ts' | sort
rg -l "export async function (POST|PATCH|PUT|DELETE)" src/app/api -g 'route.ts'
rg -l "enforceWorkspaceMutationRateLimit|checkRateLimit" src/app/api -g 'route.ts'
git ls-files .vercel .env .env.local .env.production.local
git check-ignore -v .vercel/.env.production.local
```

## Claim Boundaries

- This review found follow-up work and closed the route rate-limit and npm
  advisory items in this pass; it does not claim the app is security-complete.
- No live remote Supabase configuration was changed or verified.
- No real secrets were printed, copied, or tested against live services.
- No production, payment, provider, email, KakaoTalk, PACS, or device side effects were performed.
