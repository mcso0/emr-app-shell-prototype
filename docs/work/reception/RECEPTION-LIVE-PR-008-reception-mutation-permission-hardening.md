---
id: "RECEPTION-LIVE-PR-008"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-61"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/reception-patient-guardian-registration-write.md"
  - "docs/engineering/auth-security/auth-login/reception-walk-in-encounter-create.md"
  - "docs/engineering/auth-security/auth-login/reception-appointment-check-in-transition.md"
dependencies:
  - "RECEPTION-LIVE-PR-005"
  - "RECEPTION-LIVE-PR-006"
  - "RECEPTION-LIVE-PR-007"
updated: "2026-05-19"
---

# Reception Mutation Permission Hardening

## Goal

Lock the workspace and role permission boundary for reception mutations.

## Scope

- Define one shared reception mutation permission matrix.
- Keep patient/guardian registration, walk-in encounter creation, and appointment check-in on `reception:create`.
- Add denial coverage for unauthenticated actor, inactive app user, cross-workspace membership, inactive membership, and role without `reception:create`.
- Preserve mock fallback and existing Sales Demo behavior.
- Prepare audit hook point names without implementing audit persistence.

## Out Of Scope

- Role policy changes.
- Full audit persistence.
- Chart/order/billing permission enforcement.
- Final domain RLS policy SQL.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- Reception mutation permission matrix exists in source.
- All three reception mutations use the shared matrix.
- Focused DEN-61 denial tests pass.
- Korean HTML report exists for DEN-61.
- Linear DEN-61 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception-mutation-permissions-server.spec.ts --reporter=line`: 17 passed
- `npx playwright test tests/reception-patient-guardian-registration-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-mutation-permissions-server.spec.ts --reporter=line`: 35 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 25 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 358 docs/agent markdown files

Additional verification is recorded in the final DEN-61 report.

## Result

Ready for Human Review.

DEN-61 fixed the reception mutation permission contract around `reception:create` and added regression coverage for workspace/member denial cases. Remote Supabase, production deploy, and real clinic/patient data were not touched.
