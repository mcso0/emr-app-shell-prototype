# MVP Current Status

Updated: 2026-06-11

This is the short startup status for new Codex sessions and human review. It should stay compact. Detailed historical updates are preserved in [MVP Current Status History](current-status-history.md).

## Agent Compact Summary

- Current target: Product MVP.
- The app is a veterinary EMR SaaS prototype with outpatient workflows from reception through billing.
- The product has moved beyond a pure static demo: many auth, workspace, local-first DB/RLS, persistence, audit, billing, and customer-management foundations have been implemented in local-first form.
- Remote Supabase staging/live validation, production deployment, real customer data, real provider integrations, payment provider confirmation, and final compliance/legal review are not complete.
- Client-only permission gating is not complete security. Treat server/API/DB/RLS enforcement as the required security boundary.
- Use concise English for agent-facing plans and handoff notes. Keep user-facing result reviews in Korean unless requested otherwise.

## Current Working Target

The current target is **Product MVP**.

The MVP direction is to keep the connected outpatient workflow visible while replacing demo-only assumptions with product-ready boundaries:

- login and workspace entry
- role and permission based UX backed by server-side enforcement boundaries
- workspace-scoped data access
- reception, chart, order, billing, customer, hospital-admin, and audit workflows moving from session-only mock toward local-first persistence
- Sales Demo golden path preserved as regression coverage and representative fixture

## Current Product State

The app currently has usable prototype screens for:

| Area | Current state |
| --- | --- |
| Home | Operational dashboard and work-status view with session-only mock data |
| Reception and appointment | Reception queue, walk-in intake, patient/guardian registration, local-first encounter path foundations, and first-pass API-backed queue/calendar/profile hydration through existing reception routes |
| Customer management | Guardian/patient profile, relationship management, and soft delete/restore persistence boundaries |
| Chart | SOAP, diagnosis/search, order draft/confirmation, fulfillment sync handoff, downstream fulfillment lifecycle readback, local-first persistence checkpoints, and first-pass live queue API adoption in the chart side panel |
| Lab and imaging | Workspace screens exist; DEN-238 connects queue status context and status mutation to the shared fulfillment route. UI PR 2 adds lab result-sheet catalog read adoption for live lab work items and a local/dev result-entry server boundary. DEN-452 adds local/dev/test DB tables, RLS policies, RPCs, and API wiring for durable lab result value persistence. DEN-453 distinguishes catalog loading/empty/error/permission states and save retry/permission states in the visible lab result UI. Provider integrations and remote Supabase replay remain outside current completion claims |
| Dispensing/treatment | Workspace screen exists; DEN-239 connects queue status context and status mutation to the shared fulfillment route, and UI PR 2 covers treatment/dispensing route-boundary status transitions. DEN-456 adds visible execution-screen readback from `order_fulfillment_work_items`, server-backed status mutation, permission/failure states, and focused UI regression coverage while Sales Demo fallback remains |
| Billing | Invoice candidate, invoice line edit, billing confirmation, payment state, guardian checkout, fulfillment completion candidate sync, and amount-integrity regression foundations. UI PR 2 covers checkout route consumption in visible billing UI. DEN-454 makes the selected billing demo path API-primary for invoice-line, payment-status, and checkout-session snapshots, and DEN-455 adds visible loading, permission, retryable failure, empty, and checkout retry states while mock fallback remains |
| Inpatient | Session-only ward board and detail surface |
| Hospital admin | Order catalog persistence foundation and membership/invitation management surfaces |
| Audit | Audit schema, append helper, mutation emission hooks, and hospital-admin review surface |
| Auth/workspace | Mock fallback plus Supabase/server-session boundaries, workspace membership, role management, and local DB/RLS foundations |

Project 08 `Clinical Order Fulfillment Handoff Persistence` is ready for representative Human Review after DEN-235 through DEN-242. It verifies the local-first chart-confirmed order handoff through downstream fulfillment queues, lifecycle readback, and billing candidate readback. Remote Supabase staging replay remains gated by explicit approval.

Demo DB PR 1 through PR 5 closed the current seed-family gaps for the `clair-demo` synthetic local/dev dataset. UI PR 1 starts the API-backed adoption phase by hydrating reception patient/guardian profiles from the reception lookup route, loading the chart queue through the chart live-queue route, and adding a focused synthetic E2E route-boundary test that covers reception, chart order confirmation, fulfillment work-item completion, result-review billing, checkout/payment status, and audit readback. UI PR 2 extends downstream adoption by connecting live lab fulfillment work items to the seeded lab result-sheet catalog, adding a local/dev lab result-entry server boundary, covering treatment/dispensing fulfillment transitions at the route boundary, and exercising billing checkout plus audit review in visible UI E2E. DEN-452 replaces the lab result-entry proof with local/dev/test Supabase persistence tables, RLS, RPC save/readback, and server-permission-checked API wiring. DEN-453 adds visible lab result API state handling for catalog retry, save retry, and permission-denied outcomes. DEN-454 makes billing invoice-line, payment-status, and checkout-session snapshots API-primary in the visible selected-invoice demo path and verifies payment-status readback after mutation. DEN-455 adds visible billing API loading, empty, retryable failure, permission-denied, and checkout retry states. DEN-456 makes the dispensing/treatment execution screen show fulfillment work-item readback, server status transitions, permission denial, and mutation failure states instead of silently relying on local queue state. DEN-457 adds a visible day-in-clinic Playwright demo that walks reception, chart queue, lab result entry, dispensing fulfillment readback, billing checkout, and audit review surfaces with explicit API-call assertions. DEN-458 adds a local Supabase replay helper and docs that separate Docker/Supabase/psql environment gaps from actual seed/readback regressions. DEN-459 adds focused API boundary regression coverage for lab result entry, fulfillment, and billing denial paths, and keeps client-only gating explicitly outside the security-complete claim. DEN-460 synchronizes the engineering docs and adds an API-backed demo runbook so new sessions can interpret current mock/live/API boundaries and verification results without relying on old handoff context. Mock fallback remains intentionally preserved for Sales Demo and unconfigured local sessions.

The latest detailed change history before this split is in [MVP Current Status History](current-status-history.md).

## Not Complete Yet

Do not claim these as done without a scoped work item and verification evidence:

- remote Supabase staging/live project validation
- production deploy and production monitoring
- real hospital/customer data import or storage
- final clinical/business domain RLS replay for every live table
- payment provider, receipt, refund, accounting, or settlement integrations
- real email, KakaoTalk, PACS, device, Excel, or external provider integrations
- legal/compliance certification
- full lab/imaging/dispensing durable live persistence across every screen and complete mock-store removal
- final launch-readiness signoff

## Guardrails

- Do not treat client-only permission checks, hidden buttons, or mock role labels as complete security.
- Do not run remote Supabase commands, migration push, production deploy, real email, payment, or provider integration without explicit approval from 승욱.
- Keep mock fallback and Sales Demo paths working unless a work item explicitly scopes their removal.
- Use synthetic demo data only. Do not introduce real patient, guardian, hospital, payment, or identity data.
- For Next.js application code, read the relevant guide in `node_modules/next/dist/docs/` before coding.
- For docs, planning, and Linear work, use `docs/_meta/agent-rag-map.md` to choose the smallest source-doc set.

## Current Verification Baseline

Use the active work item for exact verification commands. Recent relevant verification categories include:

- `npm run docs:check` for docs path/reference changes
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` for implementation changes
- focused Playwright specs for touched workflows
- `tests/ui-demo-api-wiring-e2e.spec.ts` for current reception/chart/downstream API wiring and synthetic outpatient route-boundary proof
- `tests/fulfillment-handoff-replay.spec.ts` for chart confirmation through downstream fulfillment, lifecycle, and billing readback
- `docs/engineering/testing/api-backed-demo-runbook.md` for the current command set and failure interpretation for the synthetic API-backed demo
- focused server/API regression specs for auth, workspace, billing, customer, audit, and persistence boundaries
- secret scans and migration/static checks when auth, DB, RLS, or env handling changes

Do not assume the full suite has been run for a new task unless the current work item records it.

## Current Documentation Work

The baseline docs operating-system project is `CLAiR EMR 문서 운영 체계 구축`. It produced the current docs portal, startup rules, baseline source docs, and GitBook handoff set.

The docs navigation improvement project `CLAiR EMR GitBook/docs 운영 고도화` is completed in Linear. It was private/internal GitBook-oriented work for making repo docs easier for 승욱 to read and review; it was not a public publishing or production launch project.

Completed or in Human Review:

- DEN-171: GitBook docs home and sidebar map
- DEN-172: Agent RAG map and startup reading rules
- DEN-173: split this status document into compact summary and preserved history
- DEN-174: SaaS operating map
- DEN-175: Product MVP scope and non-goals
- DEN-176: outpatient workflow state model
- DEN-177: EMR domain entity map
- DEN-178: role/permission source normalization
- DEN-179: mock/live boundary map
- DEN-180: persistence and data security checklist
- DEN-181: Product MVP QA scenario pack
- DEN-182: launch readiness checklist
- DEN-183: decision log index and GitBook handoff

Current work:

- Representative Human Review of the baseline docs operating system.
- GitBook/docs navigation improvement through DEN-252 through DEN-257 is completed in Linear. Manual GitBook site setup or access changes still require a separate explicit request from 승욱.

Upcoming baseline docs in this project:

- None. The current baseline set is ready for Human Review.

## Recommended Next Work

Review the `CLAiR EMR 문서 운영 체계 구축` baseline documents in Human Review when ready. The `CLAiR EMR GitBook/docs 운영 고도화` project is completed; do not create, publish, or widen access to a GitBook site until 승욱 explicitly asks for manual setup.

Do not infer next implementation work from the large `human_review` count in `docs/work/index.md`. Use Linear issue status first, then use `docs/work/index.md` to find the matching repo work item or review queue.

For product/live-MVP work outside this docs project, review the current Linear project/issue first. Do not infer readiness from old status bullets; use the active issue, source docs, and latest closeout reports.

## Related Docs

- Human docs portal: [Docs Portal](../index.md)
- Codex startup guide: [Agent Start Here](../agent-start-here.md)
- Agent reading map: [Agent RAG Map](../_meta/agent-rag-map.md)
- Detailed status history: [MVP Current Status History](current-status-history.md)
- Engineering docs: [Engineering README](README.md)
- Auth transition roadmap: [MVP Auth Transition Roadmap](auth-security/mvp-auth-transition-roadmap.md)
- Auth/login package index: [Auth Login README](auth-security/auth-login/README.md)
- Testing gap analysis: [MVP Gap Analysis](testing/mvp-gap-analysis.md)
- Work index: [Work Index](../work/index.md)
