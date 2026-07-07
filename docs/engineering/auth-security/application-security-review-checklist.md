---
id: ENGINEERING-AUTH-SECURITY-APPLICATION-SECURITY-REVIEW-CHECKLIST
type: Security Checklist
title: Application Security Review Checklist
status: approved
area: engineering
doc_type: checklist
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-07-07T00:00:00.000Z
description: >-
  Defines repeatable application security review checks for secrets, client
  exposure, admin access, object authorization, rate limits, database exposure,
  dependency patches, password handling, and API key scope.
tags:
  - security
  - auth
  - permissions
  - rate-limit
  - secrets
---

# Application Security Review Checklist

Use this checklist before claiming an app surface is safe for pilot, staging,
or production-demo review. It complements the persistence-focused checklist in
[Persistence Data Security Checklist](persistence-data-security-checklist.md).

This checklist is not a legal/compliance signoff and does not authorize real
customer, patient, guardian, payment, identity, provider, or production data.
Remote Supabase, production, provider, or real external-user work still requires
the explicit approval gates defined in the current engineering status docs.

## Review Result Labels

| Label | Meaning |
| --- | --- |
| `Pass` | The reviewed evidence satisfies the check for the scoped work. |
| `Partial` | The pattern exists, but the reviewed evidence is incomplete or local-only. |
| `Follow-up` | The check found a concrete next review or hardening task. |
| `Not reviewed` | The check was not in the current review scope. |

## Checklist

| Area | Check | Required evidence | Follow-up trigger |
| --- | --- | --- | --- |
| Secrets in source control | No real secrets are committed in tracked files. | `npm run security:secrets`; no tracked `.env*` or `.vercel/.env*` files with real values. | Any secret-shaped value, tracked env file, pasted token, or provider key appears in repo docs, code, reports, Linear notes, screenshots, or logs. |
| Client-bundled configuration | Browser-visible values are intentionally public. | `NEXT_PUBLIC_*` usage is limited to browser-safe values such as auth mode, public Supabase URL, and publishable key. | Any service-role, secret, database password, JWT secret, provider secret, or admin token is reachable from Client Components or browser bundles. |
| Admin and protected routes | URL knowledge alone never grants protected access. | Server route checks a verified session, active workspace membership, and required permission before protected read or mutation work. | Admin, audit, member, role, billing, patient, chart, or provider-adjacent route relies only on hidden UI or client-side checks. |
| Object authorization and IDOR | Route parameters are treated as untrusted object references. | Server/API/RPC validates that each requested patient, guardian, encounter, invoice, order, notification, work item, or membership belongs to the active workspace and actor boundary. | Changing a path or query id can read or mutate another workspace or another user's data. UUIDs reduce guessing only; they do not replace authorization. |
| Mutation rate limits | Abuse-prone mutations have a rate-limit boundary. | Mutating routes use a shared limiter or a documented equivalent with `429` and `Retry-After`. | SMS, email, invite, auth, role, member, billing, notification, clinical result, checkout, search, or provider-adjacent mutation can be repeated without throttling. |
| Shared rate-limit storage | Production rate limits survive multi-instance deployment. | Production uses a shared store or platform primitive such as Redis, managed KV, edge limits, or WAF rules. | The limiter is process-local or memory-only outside local/dev/test scope. |
| Database exposure | Direct DB access is not opened as the application access path. | App traffic goes through server/API/RPC/RLS boundaries; local DB ports remain local development details. | DB ports, pooler ports, admin URLs, or connection strings are reachable from the public internet or client code. |
| DB/RLS/grants | Exposed tables and RPCs have explicit auth, RLS, grants, and workspace boundaries. | Migrations enable RLS where relevant, grant only the intended roles, and tests cover unauthenticated, missing membership, inactive membership, cross-workspace, allowed member, and admin paths. | RLS is disabled on protected tables, RPCs bypass workspace checks, or grants expose protected data to `anon` or broad public roles without a documented reason. |
| Dependency security | Current advisories are reviewed before launch-grade claims. | `npm audit --audit-level=moderate` or an approved equivalent records the current advisory snapshot and triage disposition. | High or moderate advisories remain untriaged, especially packages used in runtime server, auth, browser rendering, HTML sanitization, websocket, or build/dev server surfaces. |
| Password and session handling | Passwords are delegated to the auth provider or stored only with approved hashing. | Supabase Auth or an approved provider handles password verification; custom password storage is absent or uses a proven one-way password hash. | Plaintext passwords, reversible encryption for passwords, user-editable auth metadata as authorization truth, or weak production session policy appears. |
| API key authority | Keys use least privilege and are separated by environment. | Local, staging, production, CI, provider, and admin keys are separated; high-authority keys are server-only and rotation-ready. | One broad key can mutate unrelated services, bypass RLS, reach production, or perform provider side effects after a leak. |
| Logging and audit | Logs and audit records are useful without exposing sensitive payloads. | Errors use stable categories/request ids; logs redact secrets, tokens, raw provider payloads, raw clinical note bodies, and unnecessary personal data. | Stack traces, SQL errors, secrets, provider payloads, invitation links, or raw clinical content can be exposed to clients, public logs, reports, or screenshots. |
| Demo and mock boundaries | Demo fallback cannot silently become production security. | Mock/demo headers and local fallback paths are explicitly scoped to local/demo/test mode and denied in live Supabase mode. | Demo identity headers, fixture users, or local mock stores can authorize real live routes or hide failed live/API/RLS checks. |

## Suggested First-Pass Commands

Run only commands that fit the active work scope and approval gates.

```bash
npm run security:secrets
npm audit --audit-level=moderate --json
find src/app/api -type f -name 'route.ts' | sort
rg -n "NEXT_PUBLIC_|process\\.env|SUPABASE|service_role|sb_secret|DATABASE_URL|API_KEY|TOKEN" src scripts tests docs
rg -n "export async function (POST|PATCH|PUT|DELETE)|enforceWorkspaceMutationRateLimit|checkRateLimit" src/app/api src/lib
rg -n "x-clair-demo-session-user-id|mock_fallback|demo_header_mock_mode|getSession\\(|getClaims\\(" src/app/api src/features src/lib
rg -n "enable row level security|create policy|grant execute|security definer|set search_path" supabase/migrations
```

Do not print or paste secret values. If a possible secret is found, record the
file path, line, rule id, and a redacted sample only.

## Related Docs

- [Persistence Data Security Checklist](persistence-data-security-checklist.md)
- [Auth DB Environment, Secret Handling, and Verification Gates](auth-login/auth-db-env-secret-verification-gates.md)
- [Workspace Live API Rate Limiting](auth-login/workspace-live-api-rate-limiting.md)
- [Launch Rate Limit And Abuse Handling](auth-login/launch-rate-limit-abuse-handling.md)
- [Workspace Auth and Permissions](../../product/domain/workspace-auth-permissions.md)
