# MVP Current Status

Updated: 2026-09-06

This is the current product-status source for scope, mock/live boundaries, and human review. Read the relevant sections when those facts affect the task. It should stay compact. Module and release evidence is preserved in [MVP Status Detail Snapshot](current-status-details.md). Older history remains in [MVP Current Status History](current-status-history.md). Read details only for the active task.

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
* Apply the project operating and approval boundaries in `AGENTS.md`; an active work item records scope but does not itself grant new remote-action permission. Production and `main` follow the release runbook.
* Do not let mock fallback or legacy Sales Demo paths silently mask Cheongdam seed/API failures; legacy Sales Demo removal is now explicitly scoped through DEMO-DATA-PR-002.
* Use synthetic demo data only. Do not introduce real patient, guardian, hospital, payment, or identity data.
* Use `docs/agent-start-here.md` when choosing a task-specific reading path.

## Current Verification Baseline

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
