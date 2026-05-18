# AUTH-PR-037 API Error And Telemetry Contract

Linear: DEN-96
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Define a safe error response and request telemetry contract for workspace/member live APIs.

## Scope

- Define success and failure response envelopes.
- Define status code and denial reason mapping.
- Define safe server logging context.
- Define raw secret/error leak prohibitions.
- Review current workspace/member/profile route shapes.

## Out Of Scope

- No full route implementation rewrite.
- No external observability vendor.
- No production log pipeline.
- No clinical/domain persistence route design.

## Result

Added `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md` with the canonical response envelope, status matrix, logging rules, and route handoff checklist.

## Verification

- `rg -n "Response.json|NextResponse.json|catch|requestId|denialReason|db_write_failed" src/app/api src/features/auth`
- `npm run docs:check`

Result: passed on 2026-05-18.
