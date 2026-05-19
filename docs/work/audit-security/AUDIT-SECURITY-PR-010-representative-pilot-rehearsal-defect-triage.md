---
id: "AUDIT-SECURITY-PR-010"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-91"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-91"
---

# Representative Pilot Rehearsal And Defect Triage

## Goal

Run a representative 7-10 minute Product MVP pilot rehearsal and classify defects before closeout.

## Scope

- Use the synthetic Kong outpatient scenario as the pilot walkthrough.
- Capture places where the explanation gets blocked, the screen could confuse the representative, or product readiness could be overclaimed.
- Classify findings as blocker, follow-up, or Post-MVP.
- Keep Linear and docs aligned for Human Review.

## Out Of Scope

- Immediate implementation.
- Sales copy overhaul.
- Production deployment.
- Remote Supabase, staging/live mutation, provider rollout, or real patient/hospital data access.
- Real medical advice or clinical decision support claims.

## Handoff Notes

The canonical report is:

- `docs/engineering/auth-security/auth-login/representative-pilot-rehearsal-defect-triage.md`

Result:

- Representative local-first pilot rehearsal can proceed with follow-ups.
- No new local-first walkthrough blocker was found.
- Remote/live pilot approval is still blocked until DEN-88 audit completeness and clinical/billing RLS validation are accepted or resolved.

Follow-up issue candidates:

- Align mock UI role labels with canonical MVP roles.
- Resolve or explicitly accept DEN-88 audit completeness gap.
- Add friendlier Korean denial copy.
- Clean Tiptap duplicate extension warning.
- Clean broad Playwright Node listener warning.
- Create a repeatable pilot reset checklist.

Next recommended Project 05 issue:

- DEN-92 `04-01 Produce Product MVP live transition closeout report`

## Verification

- `npx playwright test tests/sales-demo-flow.spec.ts tests/outpatient-persistence-regression.spec.ts --reporter=line` (`4 passed`)
- `npm run docs:check`
- `npm run security:secrets`
