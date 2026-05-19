---
id: "AUDIT-SECURITY-PR-008"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-89"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-89"
---

# Full Live Outpatient Workflow QA

## Goal

QA the core outpatient workflow from login/workspace entry through reception, chart, order, and billing reload checkpoints.

## Scope

- Verify login/workspace selection through reception/chart/order/billing.
- Verify reload checkpoints for the main persisted outpatient state.
- Review failure, empty, and error-state coverage in relevant suites.
- Classify QA findings as blocker, follow-up, or Post-MVP.

## Out Of Scope

- Code modification.
- Performance benchmark.
- External provider QA.
- Remote Supabase, production deploy, provider rollout, or real patient/hospital data access.

## Handoff Notes

The canonical QA report is:

- `docs/engineering/auth-security/auth-login/full-live-outpatient-workflow-qa.md`

Result:

- Workflow health score: `92 / 100`
- Blockers: none found in local-first QA.
- Follow-ups: Tiptap duplicate extension warning, Node listener warning in broad Playwright runs, DEN-88 audit completeness, remote/live validation gate.

Next recommended Project 05 issue:

- DEN-90 `03-02 QA role workspace boundary and denial UX`

## Verification

- `npx playwright test tests/auth.spec.ts tests/reception.spec.ts tests/chart.spec.ts tests/billing.spec.ts tests/outpatient-persistence-regression.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
