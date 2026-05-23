# Staging Pilot Demo Package

Updated: 2026-05-23

Use this package when showing the CLAiR EMR staging pilot to a hospital decision-maker. It is written for a guided demo by 승욱 or the CLAiR team, not for unsupervised external onboarding.

## Demo Positioning

CLAiR EMR connects the outpatient day from reception to charting, orders, lab/imaging, dispensing/treatment, billing, customer context, and audit review in one workspace-scoped flow.

The demo should make one promise:

> A hospital team can understand where the patient is, who owns the next action, and how the visit turns into an auditable invoice without jumping across disconnected tools.

## Current Go/No-Go

| Scope | Recommendation | Why |
| --- | --- | --- |
| Guided internal synthetic staging rehearsal | Go | Preview smoke, core UI route rehearsal, tenant denial, and selected regressions passed. |
| External hospital sales conversation using synthetic data | Conditional Go | Safe as a guided walkthrough if claims stay inside the limitations below. |
| Approved staging invite rehearsal with test recipient | Go | DEN-187 verified Resend delivery, latest Preview email link, invite-aware login, and logged-in acceptance routing for the approved test recipient scope. |
| Real hospital pilot with live customer invites | Conditional No-Go | Customer recipients, production domains, production deploy, real staff identities, and unsupervised onboarding remain outside the approved staging scope. |
| Production, real patient data, payment/subscription, external provider integrations | No-Go | Not verified and outside the current staging pilot scope. |

## Demo Setup

| Item | Value |
| --- | --- |
| Preview | `https://emr-app-shell-prototype-lvymhgyla-mcso0s-projects.vercel.app` |
| Workspace | `clair-demo` |
| Recommended entry | `/w/clair-demo/home?modulePanel=open` |
| Golden scenario | 김하늘 / 콩이 / 구토 내원 |
| Data boundary | Synthetic staging/demo data only |

Before the meeting:

1. Open the Preview and confirm the session lands inside `clair-demo`.
2. Keep a second tab ready for the DEN-189 go/no-go report if evidence is requested.
3. Do not enter real guardian, patient, staff, payment, or hospital production data.
4. Do not send real customer invitations during the demo. DEN-187 cleared only the approved staging test-recipient path.

## Seven-Minute Talk Track

| Time | Screen | What to Show | Talking Point |
| --- | --- | --- | --- |
| 0:00-0:45 | Home | Workspace shell, hospital context, work status | "We start from the hospital day, not a single chart screen." |
| 0:45-1:45 | Reception | 보호자/환자 context, appointment or walk-in queue | "The desk can see who arrived, why they are here, and which encounter is active." |
| 1:45-3:00 | Treatment chart | SOAP, assessment, diagnosis/order context | "The vet continues the same encounter instead of rebuilding context from memory." |
| 3:00-4:00 | Lab | CBC/order result context | "Diagnostics are tied back to the visit, so results are not floating outside the chart." |
| 4:00-4:45 | Imaging | Imaging order and reading context | "Imaging is part of the same clinical story, not a separate screenshot archive." |
| 4:45-5:30 | Dispensing/treatment | Operational work queue | "Technicians can see what must be prepared or completed next." |
| 5:30-6:30 | Billing | Invoice lines, amount, paid/unpaid state | "Clinical work turns into a traceable billing handoff." |
| 6:30-7:00 | Customer / denial note | Customer history or foreign workspace denial | "The same data is scoped to the hospital workspace, with cross-workspace access denied." |

## Scenario Talking Points

### Reception

- Start with `콩이` or `예약 코코` visible in the queue/calendar.
- Emphasize that the visit begins as an operational encounter, not just a patient search.
- If asked about persistence, say: "Reception queue and calendar reads have staging-backed smoke evidence, but this demo still avoids real patient data."

### Chart / Orders

- Show SOAP and order context as one connected encounter.
- Emphasize continuity: reception context becomes clinical context.
- Do not claim every domain RPC has final role-specific DB enforcement unless the exact evidence is in the closeout report.

### Lab / Imaging / Dispensing

- Show these as operational handoffs in the outpatient flow.
- Be explicit that full live persistence for every lab/imaging/dispensing path remains outside the current completion claim.
- Avoid saying PACS, device ingestion, KakaoTalk, Excel, or external provider integrations are live.

### Billing

- Show that invoice context is connected to the encounter.
- Mention existing regression coverage for amount integrity and cross-workspace denial.
- Do not claim payment provider, receipt, refund, settlement, or accounting integration is complete.

### Tenant / Audit Confidence

- Use the DEN-197 and DEN-189 reports as evidence that workspace boundary and audit readback were checked.
- Keep the claim narrow: "staging tenant isolation and audit readback evidence passed for the synthetic fixture."

## Evidence Index

| Evidence | Use In Demo |
| --- | --- |
| `docs/completed/saas-launch/2026-05-22-den-189-synthetic-hospital-go-no-go-report.html` | Current go/no-go, Preview route rehearsal, blocker list |
| `docs/completed/saas-launch/2026-05-21-den-188-staging-deploy-smoke-report.html` | Vercel Preview + Supabase staging smoke |
| `docs/completed/saas-launch/2026-05-21-den-196-core-business-flow-replay-evidence-report.html` | Core business flow replay and screenshots |
| `docs/completed/saas-launch/2026-05-21-den-197-role-tenant-audit-isolation-report.html` | Tenant isolation and audit readback |
| `docs/completed/saas-launch/2026-05-21-den-202-reception-queue-calendar-read-smoke-report.html` | Reception queue/calendar staging smoke |
| `docs/completed/saas-launch/evidence/den-196-home-demo.png` | Home demo evidence |
| `docs/completed/saas-launch/evidence/den-196-reception-kong.png` | Reception golden scenario evidence |
| `docs/completed/saas-launch/evidence/den-196-chart-kong.png` | Chart golden scenario evidence |
| `docs/completed/saas-launch/evidence/den-196-billing-kong.png` | Billing golden scenario evidence |

## Known Limitations

- Real email invite delivery is cleared only for the approved staging test recipient path from DEN-187.
- Production deploy and production monitoring are not part of this package.
- Real hospital, guardian, patient, staff, payment, or identity data must not be used.
- Payment provider, receipt, refund, accounting, settlement, KakaoTalk, PACS, device, and Excel integrations are not live claims.
- Full lab/imaging/dispensing live persistence remains outside current MVP completion claims.
- Final legal/compliance certification is not complete.
- The current demo is best used as a guided representative walkthrough, not a self-serve trial.

## Do-Not-Claim List

Do not say:

- "Production-ready."
- "Real patient data can be onboarded now."
- "Payment and external provider integrations are complete."
- "Every clinical table and every role-specific domain RPC has final live enforcement."
- "Email invites are fully verified for customers or production."
- "This is a legally/compliance-certified EMR."

Safer wording:

- "This is a staging pilot rehearsal with synthetic data."
- "The representative outpatient workflow is visible end to end."
- "Workspace boundary, staging smoke, and selected security regressions have passed for this synthetic pilot scope."
- "The next gate before live invite testing is DEN-187 real email dry-run."

## Objection Handling

| Question | Safe Answer |
| --- | --- |
| Can we use this with our real hospital data today? | Not yet. The current package is synthetic staging only. Real data needs separate production, compliance, and migration gates. |
| Are invitations ready? | For staging rehearsal, yes: the approved test-recipient path has delivery and invite-link evidence. For real customers or production, no: that needs a separate approval gate. |
| Is billing connected to payment providers? | Not yet. Billing workflow and amount-integrity regressions are covered, but payment provider integration is outside this scope. |
| Is this secure between hospitals? | The staging synthetic tenant isolation and denial evidence passed. Final live security claims should stay tied to the documented evidence. |
| Can staff self-onboard? | Not as a broad self-serve claim. The current safe path is guided, invite-only, and still gated by email dry-run. |

## Recommended Close

End with:

1. "The representative workflow is now coherent enough for a guided synthetic staging demo."
2. "The approved staging invite path now has email delivery and logged-in acceptance evidence."
3. "A real customer pilot still needs a separate production, recipient, and compliance decision."
