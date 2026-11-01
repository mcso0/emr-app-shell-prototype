# MVP Current Status

Updated: 2026-10-11

Lab result sheet phase 2 and attachment fixes were merged in PRs #848, #851,
and #853 on 2026-09-29. PR #853 deployed to Ready Production at
`f3d9c647b84336dac863c42f2ad83cdf609a8fa4`. Authenticated synthetic upload,
reload, preview, zoom, byte-identical download, deletion/storage removal,
item/overall findings, and revision history passed. Current synthetic findings
were cleared; immutable audit remains. Retest creation failed with
`chart_id_required`: its RPC omits the prior order's chart origin when inserting
the new draft. A local, guarded migration on `codex/lab-retest-chart-origin`
preserves that origin and passes an isolated SQL regression fixture. Remote DB
apply and the changed candidate's release require approval. One private pending
upload from the earlier failed smoke still needs bounded reconciliation. See
[LAB-PR-003](../work/lab/LAB-PR-003-result-sheet-phase-2.md) for exact evidence.

Latest local fulfillment-queue remediation restores separate workspace-scoped
patient/guardian/requester display context, URL-owned operating dates, exact
queue selection ids, and Asia/Seoul timestamps across lab, imaging,
dispensing, and treatment. Migration `20260912121342` is a local candidate;
no remote apply, merge, deployment, or production acceptance is recorded.

Latest WP09 checkpoint: application1dd8965 passed248 contracts, full type/lint/build,
Release Check34103715994 and Ready Preview. Three-workspace Admin and authenticated
consultation/lab/imaging acceptance now pass, including actual v1/v2 and separate
no-charge retests. Approved Pilot setup adds only synthetic vet002 and a Sep7
09:00–23:59 one-day operating exception; one synthetic encounter was used.
Production/main is still unchanged. The final documentation-only candidate and
exact Production approval remain; see WP09 and the PR711 approval packet.

This is the current product-status source for scope, mock/live boundaries, and human review. Read the relevant sections when those facts affect the task. It should stay compact. Module and release evidence is preserved in [MVP Status Detail Snapshot](current-status-details.md). Older history remains in [MVP Current Status History](current-status-history.md). Read details only for the active task.

Local current-assignee authority candidate (2026-10-12) now covers lab, imaging, dispensing/treatment and billing. Lab input opens on claim; other clinical modules retain start/record/completion/amendment phases. Only the current assignee may edit/execute, and transfer changes authority. Billing ownership/audit and DB guards are in local migration `20261012054346`; no remote application or delivery is verified. See [CLINICAL-FULFILLMENT-PR-010](../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md#current-assignee-boundary-follow-up-2026-10-12) for scoped synthetic verification and remaining integration limits.

Local dispensing/treatment instruction follow-up (2026-10-27) adds explicit set finalization, main/sub item execution, changed-child attempts, common-instruction edits that preserve completion, requester completion, and persisted notifications. The live route requires its five local candidate migrations; none has been remotely applied in this work. Existing actual-result and billing guards remain. Local SQL/API/UI evidence and remaining hosted-schema verification are recorded in [CLINICAL-FULFILLMENT-PR-010](../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md#approved-dispensingtreatment-instruction-workflow--2026-10-27).


Local collected dispensing revisions (2026-10-27) add current-chart oral instruction revisions and task snapshots, chart entry, an infobar, per-child set instructions, row-associated execution history, bounded table geometry and centered transition loading. Verification is local/synthetic; migration `20261027130000` has not been applied remotely and no deployment is authorized. See [CLINICAL-FULFILLMENT-PR-010](../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md#local-implementation-verification--2026-10-27).

Local Plan/Order dispense-quantity candidate (2026-10-31) separates 1회 조제량,
총 조제량 and 실 조제량; supports reason-free manual request edits, reconfirmation
and automatic reset; and adds hospital rules with product exceptions. Migration
`20261031090000` remains local. Synthetic browser/API/isolated-SQL verification
is recorded in [CLINICAL-FULFILLMENT-PR-010](../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-010-plan-order-work-lifecycle.md#approved-local-follow-up--2026-10-31-dispense-request-quantities).
The 2026-11-01 local UI follow-up unifies duration/dose/request text entry, blocks invalid input, and uses compact cell feedback without adjacent reconfirm/reset controls.
No remote DB application or deployment is included.
The local 2026-11-01 follow-up adds strength/SI/product-ratio dose conversion and
atomic dose/unit editing across the table and detail/revision dialogs. Its new
SQL migration preserves physical quantities and needs separate remote application;
local synthetic verification does not establish hosted DB parity.

## Agent Compact Summary

* Current target: Product MVP.
* The app is a veterinary EMR SaaS prototype with outpatient workflows from reception through billing.
* The product has moved beyond a pure static demo: many auth, workspace, local-first DB/RLS, persistence, audit, billing, and customer-management foundations have been implemented in local-first form.
* Remote Supabase validation, production-demo deployment, DB/API hardening, migration/RLS work, and server-side enforcement may now be scoped for synthetic/demo data under active Linear/work items. Real customer data, real provider/payment side effects, and final compliance/legal review are not complete.
* Client-only permission gating is not complete security. Treat server/API/DB/RLS enforcement as the required security boundary.

## Current Working Target

The current target is **Product MVP**.

The MVP direction is to keep the connected outpatient workflow visible while replacing demo-only assumptions with product-ready boundaries:

* login and workspace entry
* role and permission based UX backed by server-side enforcement boundaries
* workspace-scoped data access
* reception, chart, order, billing, customer, hospital-admin, and audit workflows moving from session-only mock toward local-first persistence
* Cheongdam seed workspace (`workspace-clair-cheongdam`) used as the default synthetic operating proof, with legacy Sales Demo paths treated as cleanup candidates rather than preservation requirements

## Current Product State

- The [2026-10-12 local accessibility audit](../completed/design-system/2026-10-12-storybook-accessibility-audit.md) scans705 initial Storybook states and5 additional states with axe. Search roles, input/button names, nested controls, contrast and target-size findings remain. Standalone-page context and manual checks are separated; this is not accessibility completion or a production claim. The chart vital confirmation test now waits for visible content and passes70 checks across10 fresh runs.

- The [2026-10-11 local Storybook follow-up](../work/design-system/DESIGN-SYSTEM-PR-109-origin-main-storybook-full-audit.md#approved-five-issue-follow-up--2026-10-11) repairs schedule close guards, dispensing column labels, SOAP disclosure keys and global-search result filtering. Unconnected support/help, dispensing and inpatient actions are marked `준비 중` and disabled. This candidate is local; no release or remote workflow completion is recorded.
- The [final-review follow-up](../work/design-system/DESIGN-SYSTEM-PR-109-origin-main-storybook-full-audit.md#final-review-regression-follow-up--2026-10-11) locks schedule drafts during pending mutations, prevents disabled inpatient controls from activating their row, and fixes long Home date truncation. The mobile Home test now respects the existing modal-panel contract. Added synthetic delayed-response and physical-click regressions; no release or remote change.

- Outpatient screens connect Home, reception/appointments, customer management, chart, lab/imaging, dispensing/treatment, and billing. Persistence and remote verification differ by module; do not infer full live readiness from screen availability.
- Hospital administration includes workspace/member/settings foundations with separately recorded local, remote, and production boundaries. Inpatient remains session-only.
- Cheongdam is the default prepared-clinic synthetic proof. Preserve current workspace/API boundaries; do not mask failures with legacy Sales Demo fallback.
- The [2026-09-29 queue-loading follow-up](../work/demo-data/DEN-455-billing-ux-loading-failure-retry-payment-state-clarity.md#approved-follow-up--2026-09-29) shipped in PR #856 (`b191765d`) with centered pending states for lab/imaging/dispensing/billing. Authorized function-only billing migrations are applied. Authenticated date-change smoke passed for all four modules after correcting a local/remote membership-schema mismatch; the forward migration and schema-shaped regression proof record that correction.
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
* Apply the project operating and approval boundaries in `AGENTS.md`; an active work item records scope but does not itself grant new remote-action permission. Production and `main` follow the release runbook.
* Do not let mock fallback or legacy Sales Demo paths silently mask Cheongdam seed/API failures; legacy Sales Demo removal is now explicitly scoped through DEMO-DATA-PR-002.
* Use synthetic demo data only. Do not introduce real patient, guardian, hospital, payment, or identity data.
* Use `docs/agent-start-here.md` when choosing a task-specific reading path.

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
values/status/price were restored. Exact974d Preview and Release Check passed.
All three Admin clinical-field reset flows now pass with original values restored.
Pilot actual staff display and one synthetic patient registration pass, but no
operating-hours configuration exists, so reception correctly blocks creation.
Clair-demo actual Nabi encounter adds three drafts without changing five old orders;
WBC and CT-review confirm with revision1 and scoped Task history displayed correctly.
Consultation remains draft because that encounter has no primary veterinarian;
runtime-owned clinician resolution is not weakened. A final local delta restricts
chart sample fallback to mock auth, makes the runtime-owned clinician read-only,
and uses current queue dates in live auth. New Preview verification and remaining
workspace flow acceptance are pending. Production delivery and the full objective remain open.

Use the active work item for exact verification commands. Recent relevant verification categories include:

* `npm run docs:check` for docs path/reference changes
* `npm run lint`, `npx tsc --noEmit`, and `npm run build` when required by the active work item, release gate, or affected implementation scope
* focused Playwright specs for touched workflows
* `tests/ui-demo-api-wiring-e2e.spec.ts` for current reception/chart/downstream API wiring and synthetic outpatient route-boundary proof
* `tests/fulfillment-handoff-replay.spec.ts` for chart confirmation through downstream fulfillment, lifecycle, and billing readback
* `docs/engineering/testing/api-backed-demo-runbook.md` for the current command set and failure interpretation for the synthetic API-backed demo
* focused server/API regression specs for auth, workspace, billing, customer, audit, and persistence boundaries
* secret scans and migration/static checks when auth, DB, RLS, or env handling changes

Do not assume the full suite has been run for a new task unless the current work item records it.

## Current Documentation Work

The internal `/docs` viewer is the active read-only reader path; GitBook is inactive/deprecated unless explicitly revived. See [Docs Portal](../README.md). Historical documentation milestones are preserved in the [detail snapshot](current-status-details.md#current-documentation-work).

Agent operating guidance now uses Astra `high`, Plan `xhigh`, bounded read-only delegation (maximum four), and separate ordinary-review versus explicit Safety OS intake routes. See [OWNER-OS-PR-012](../work/agent-orchestration/OWNER-OS-PR-012-astra-agent-guidance.md). Disk settings do not establish what an already-running task has loaded. Task-conditional reading, progressive skill references, scoped authorization reuse, and request-specific completion/report depth are maintained in the linked work item and operating docs.

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
