---
id: "CHART-PR-016"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "User correction / allow hospital administrators to enter waiting vitals"
source_docs:
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/product/domain/role-permission-source-map.md"
  - "docs/engineering/data-model/patient-vital-measurements.md"
depends_on:
  - "CHART-PR-015"
result_report: "docs/completed/chart/2026-07-20-chart-pr-016-admin-vital-write-report.html"
---

# Goal

Allow an active hospital administrator to open and use the waiting-chart today-vital dialog while preserving the existing veterinarian and technician workflow.

# Scope

- Expand the shared application eligibility check to active `hospital_admin` memberships.
- Add a forward migration that applies the same eligibility at the server-owned RPC boundary.
- Preserve effective `vital:write`, actor/session equality, workspace ownership, waiting encounter and queue status, input validation, and audit attribution.
- Keep front-desk-only memberships excluded even when their permission policy contains `vital:write`.
- Restore CHART-PR-015 and register this follow-up in the work index.

# Out Of Scope

- Remote Supabase migration application, deployment, or authenticated production smoke testing.
- Historical vital editing, hospital vital-option settings, device integration, or new vital fields.
- Treating every owner or permission-role label as a hospital administrator without active `hospital_admin` membership.

# Done Criteria

1. An active `hospital_admin` with effective `vital:write` receives `canWriteVitals: true` and can reach the existing writer.
2. Veterinarian and technician behavior remains unchanged; front-desk-only behavior remains denied.
3. The database writer enforces the same administrator/clinical eligibility after the forward migration.
4. Focused tests, lint, typecheck, build, docs, and diff checks pass.

# Verification

- RED: administrator writer test returned `403` before implementation.
- RED: migration contract test did not find `hospital_admin` in the DB eligibility boundary before implementation.
- GREEN: `npx playwright test tests/patient-vital-server.spec.ts --reporter=line` passed (10 tests).
- `npm run security:secrets`, `npm run lint`, `npx next typegen`, and `npx tsc --noEmit --pretty false` passed.
- `npm run build` completed and produced a production `BUILD_ID`.
- `npx playwright test tests/patient-vital-server.spec.ts tests/chart-preconsultation-context-server.spec.ts --reporter=line` passed (15 tests).
- `npx playwright test tests/chart.spec.ts --grep "waiting chart saves and clears only today's vital values" --reporter=line` passed (1 test).
- Remote Supabase apply and deployment were not performed.
