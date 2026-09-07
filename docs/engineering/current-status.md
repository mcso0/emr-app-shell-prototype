# MVP Current Status

Updated: 2026-09-07

This is the short startup status for new Codex sessions and human review. It should stay compact. Module and release evidence is preserved in [MVP Status Detail Snapshot](current-status-details.md). Older history remains in [MVP Current Status History](current-status-history.md). Read details only for the active task.

## Agent Compact Summary

* Current target: Product MVP.
* The app is a veterinary EMR SaaS prototype with outpatient workflows from reception through billing.
* The product has moved beyond a pure static demo: many auth, workspace, local-first DB/RLS, persistence, audit, billing, and customer-management foundations have been implemented in local-first form.
* Remote Supabase validation, production-demo deployment, DB/API hardening, migration/RLS work, and server-side enforcement may now be scoped for synthetic/demo data under active Linear/work items. Real customer data, real provider/payment side effects, and final compliance/legal review are not complete.
* Client-only permission gating is not complete security. Treat server/API/DB/RLS enforcement as the required security boundary.
* Use concise English for agent-facing plans and handoff notes. Keep user-facing result reviews in Korean unless requested otherwise.

## Current Working Target

The current target is **Product MVP**.

The MVP direction is to keep the connected outpatient workflow visible while replacing demo-only assumptions with product-ready boundaries:

* login and workspace entry
* role and permission based UX backed by server-side enforcement boundaries
* workspace-scoped data access
* reception, chart, order, billing, customer, hospital-admin, and audit workflows moving from session-only mock toward local-first persistence
* Cheongdam seed workspace (`workspace-clair-cheongdam`) used as the default synthetic operating proof, with legacy Sales Demo paths treated as cleanup candidates rather than preservation requirements

## Current Product State

- Outpatient screens connect Home, reception/appointments, customer management, chart, lab/imaging, dispensing/treatment, and billing. Persistence and remote verification differ by module; do not infer full live readiness from screen availability.
- Hospital administration includes workspace/member/settings foundations with separately recorded local, remote, and production boundaries. Inpatient remains session-only.
- Cheongdam is the default prepared-clinic synthetic proof. Preserve current workspace/API boundaries; do not mask failures with legacy Sales Demo fallback.
- Use the [module table and implementation evidence](current-status-details.md#current-product-state) for the exact feature, migration, permission, and release facts relevant to the task.

## Clinical Master Phase 1 Closeout

Clinical Master Phase 1 and Operational Master V3 have recorded scoped completion evidence. Later defaults/remediation work is separate. Use the [clinical-master detail](current-status-details.md#clinical-master-phase-1-closeout), current work item, and latest scoped evidence; do not treat the recorded release as approval for a new remote operation.

## Not Complete Yet

Do not claim these as done without a scoped work item and verification evidence:

* broad remote Supabase validation outside the scoped synthetic Airtable pilot
* production-demo deploy and production monitoring
* real hospital/customer data import or storage
* final clinical/business domain RLS replay for every live table
* payment provider, receipt, refund, accounting, or settlement integrations
* real email, KakaoTalk, PACS, device, Excel, or external provider integrations
* legal/compliance certification
* full lab/imaging/dispensing durable live persistence across every screen and complete mock-store removal
* final launch-readiness signoff

## Guardrails

* Do not treat client-only permission checks, hidden buttons, or mock role labels as complete security.
* Scoped synthetic/demo-data Supabase, migration, RLS, server/API, and production-demo deployment work is allowed when the active Linear issue or work item includes it.
* Stop for explicit approval before meaningful cost, secret/security exposure, private repo/public exposure, real customer/patient/guardian/payment/identity data, destructive or hard-to-rollback remote data changes, real external email/KakaoTalk/payment/provider side effects, or real external-user launch.
* Do not let mock fallback or legacy Sales Demo paths silently mask Cheongdam seed/API failures; legacy Sales Demo removal is now explicitly scoped through DEMO-DATA-PR-002.
* Use synthetic demo data only. Do not introduce real patient, guardian, hospital, payment, or identity data.
* For Next.js application code, read the relevant guide in `node_modules/next/dist/docs/` before coding.
* For docs, planning, and Linear work, use `docs/_meta/agent-rag-map.md` to choose the smallest source-doc set.

## Current Verification Baseline

WP-01B–09 integration is locally verified: persisted Admin/chart scope, field
merge and all-category actual/history. Original522 reconcile to524 candidates
(51 explicit replacements,53 additions). Lab86 resolve to90 atomic orders,
35 compositions and24 profiles; no real device integration or clinical approval.
The three-workspace operator harness passes all18 new migrations plus one existing
prerequisite, full rollback/late-failure/retry, existing prices/history/foreign
preservation, and524 selectable/51 paused/53 new prices per workspace.
Targets, synthetic-selectable108 dispensing profiles, manual profiles, parent-only
billing, existing pilot nonbillable exceptions and differentiated new-item demo
prices are approved. Fresh delivery checks include203 contracts,93 artifact tests,
docs/secrets/typecheck/build; publisher35 and mocked browser evidence are recorded
separately. [WP09](../work/clinical-master/order-execution-defaults/WP-09-complete-candidate-and-rollout.md)
owns exact hashes and remaining gates. Remote DDL and the approved three-workspace
candidate are installed; the compatible Production app is not yet delivered. After a
rehearsal-time server restart,44 master/116 workspace fingerprints remained exact.
Two scalar memory fixes passed1516 differential cases locally and remotely; the
parity-corrected23-migration rollback/late-failure/retry harness also passed.
Do not use the old Production writer against the new actual-value triggers.
The full remote rehearsal passed without residue, followed by one committed rollout.
Its postcommit bulk guard timed out; independent split readback matched all116
fingerprints and the persisted receipt, with524 selectable/51 paused/53 new prices
per workspace,9 manual devices/519 synthetic bindings/90 compositions, and all1597
existing catalog pricing rows unchanged. No replay was performed after the timeout.
Final exact-candidate checks, Production delivery and three-workspace authenticated
smoke remain. The full objective stays active; data adoption is not app delivery.
Authenticated Preview Admin save/reload/use-stop passed in Cheongdam, with test
alias/status restored. Chart loading exposed an explicit-null set-price mapper
bug; a narrow local correction passed541 real-row replay and104 focused tests.
Its exact5b731 Preview and Release Check passed; authenticated chart search now
loads. New-order save exposed resubmission of untouched old drafts, including a
paused source. The narrow client delta-save fix passes10 serializer regressions,
28 existing contracts and one local API test. Exact3658 Preview/Release Check
passed. Cheongdam added and confirmed consultation/WBC/CT-review candidates;
all four old drafts retained exact fingerprints. Consultation and imaging actual
v1/v2 persisted with unchanged Task plans; WBC9.9 and separate no-charge retest10.1
saved and completed, with original result preserved and no retest billing candidate.
Follow-up local fixes correct stale post-confirm revision and Task-plan history
labels, remove unsaved/mock narratives and media from live lab/imaging surfaces,
and route pilot live reception through existing real staff sourcing. Focused
regressions and237 combined contracts, full type/lint/build/docs/UX checks pass.
Clair-demo Admin alias/default edit/reload/master-reset/use-stop passed and original
values/status/price were restored. New Preview and remaining workspace flow
acceptance are pending. Production delivery and the full objective remain open.

Use the active work item for exact verification commands. Recent relevant verification categories include:

* `npm run docs:check` for docs path/reference changes
* `npm run lint`, `npx tsc --noEmit`, and `npm run build` for implementation changes
* focused Playwright specs for touched workflows
* `tests/ui-demo-api-wiring-e2e.spec.ts` for current reception/chart/downstream API wiring and synthetic outpatient route-boundary proof
* `tests/fulfillment-handoff-replay.spec.ts` for chart confirmation through downstream fulfillment, lifecycle, and billing readback
* `docs/engineering/testing/api-backed-demo-runbook.md` for the current command set and failure interpretation for the synthetic API-backed demo
* focused server/API regression specs for auth, workspace, billing, customer, audit, and persistence boundaries
* secret scans and migration/static checks when auth, DB, RLS, or env handling changes

Do not assume the full suite has been run for a new task unless the current work item records it.

## Current Documentation Work

The internal `/docs` viewer is the active read-only reader path; GitBook is inactive/deprecated unless explicitly revived. See [Docs Portal](../README.md). Historical documentation milestones are preserved in the [detail snapshot](current-status-details.md#current-documentation-work).

Agent operating guidance now uses Astra `high`, Plan `xhigh`, bounded read-only delegation (maximum four), and separate ordinary-review versus explicit Safety OS intake routes. See [OWNER-OS-PR-012](../work/agent-orchestration/OWNER-OS-PR-012-astra-agent-guidance.md). Disk settings do not establish what an already-running task has loaded.

## Recommended Next Work

Use the user's active request and current Linear issue/work item. Do not infer readiness or priority from old status bullets or the number of `human_review` entries. Search the [work index](../work/index.md) by area or ID, then read the matching source docs and evidence.

## Related Docs

* Human docs portal: [Docs Portal](../)
* Codex startup guide: [Agent Start Here](../agent-start-here.md)
* Agent reading map: [Agent RAG Map](../_meta/agent-rag-map.md)
* Detailed status history: [MVP Current Status History](current-status-history.md)
* Engineering docs: [Engineering README](./)
* Auth transition roadmap: [MVP Auth Transition Roadmap](auth-security/mvp-auth-transition-roadmap.md)
* Auth/login package index: [Auth Login README](auth-security/auth-login/)
* API-backed demo runbook: [API-Backed Demo Runbook](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/testing/api-backed-demo-runbook.md)
* Demo completion readiness report: [DEN-461 Demo Readiness Closeout](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/completed/engineering/2026-06-11-den-461-demo-readiness-closeout-report.html)
* Testing gap analysis: [MVP Gap Analysis](testing/mvp-gap-analysis.md)
* Work index: [Work Index](../work/index.md)
