# AUTH-PR-038 Workspace Live API Rate Limiting

Linear: DEN-97
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Add route-level rate limiting for workspace live mutation APIs.

## Scope

- Add a shared rate limit boundary.
- Apply it to workspace creation, invitation lifecycle, membership role/status mutation, and profile update routes.
- Return `429` with `Retry-After` on excess requests.
- Add regression coverage for route adoption and 429 behavior.

## Out Of Scope

- No external Redis, Upstash, Vercel KV, or production shared store provisioning.
- No production traffic analytics.
- No clinical/domain route rate limit.
- No bot detection or WAF configuration.

## Result

Workspace live mutation routes now pass through `enforceWorkspaceMutationRateLimit(...)` before write work continues.

## Verification

- `npx playwright test tests/workspace-rate-limit-server.spec.ts --reporter=line`
- `npx playwright test tests/workspace-rate-limit-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-invitation-server.spec.ts --reporter=line`
- `npx tsc --noEmit`

Result: passed on 2026-05-18.
