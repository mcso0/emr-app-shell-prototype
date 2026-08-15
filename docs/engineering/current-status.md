# MVP Current Status

Updated: 2026-07-23

This is the short startup status for new Codex sessions and human review. It should stay compact. Detailed historical updates are preserved in [MVP Current Status History](current-status-history.md).

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

The app currently has usable prototype screens for:

| Area                      | Current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                      | `원내 현황` operations workspace with shell side panel, Kanban board, drawer detail, and first live operations work-item API/read-model adoption for Cheongdam/prepared-clinic work; legacy `clair-demo` still uses scoped local mock fixtures                                                                                                                                                                                                                                                                                                                                                  |
| Reception and appointment | Reception queue, walk-in intake, patient/guardian registration, local-first encounter path foundations, and API-backed queue/calendar/profile hydration through existing reception routes. The day calendar includes a reusable, non-modal 380px staff profile side panel with exactly profile/work tabs plus a selected-date operational-status snapshot derived from published/changed schedule and time-clock facts. The profile read allows active same-workspace members, exposes nullable `public.users` contact values, uses published/changed weeks for today's shift and safe 14-day availability, and omits private schedule notes/reasons. Assigned work is a minimal, cursor-paged projection of the existing fulfillment table; full source snapshots/internal instructions are excluded and detail links are server-filtered by destination permission. Activity migration `20260714213000` and receive-only Presence handshake hotfix `20260715014500` are applied remotely; an authenticated synthetic probe verified same-workspace subscribe/track, heartbeat readback, and cross-workspace denial. The app-shell reporter owns the single Presence channel, profile consumers distinguish unknown from authoritative online/offline snapshots, and the heartbeat path awaits Supabase's lazy `rpc()` result. The operational-status read still requires `reception:view` and distinguishes explicit `clocked_out` from elapsed `shift_ended`. RECEPTION-QA-PR-011 adds walk-in-only weight/temperature/respiration/blood-pressure capture, a nested optional API payload, and an atomic RPC that writes encounter, queue, vital history, and the weight compatibility snapshot together. Reservation creation intentionally exposes and sends no vitals. Staging migrations `20260714102902` and `20260714110547` are applied. Post-application catalog and synthetic transaction replay verified RLS/direct-write denial, authenticated wrapper-only execution, DB-backed `reception:create`, exact readback, and full rollback with zero persistent probe rows. RECEPTION-LIVE-PR-017 adds an authenticated `reception:view` exact-encounter-and-patient vital read and makes the reception detail render only non-null values enabled by workspace settings; remote migrations `20260724021247` and `20260724023220` are applied, and read-only inspection confirmed the reported synthetic encounter's weight, temperature, and heart-rate row plus the patient's date-grouped history. HOSPITAL-ADMIN-LIVE-PR-012 extends the day response with selected-date effective operating hours, replaces fixed writer and visible form-time checks with the shared timezone/exception/break resolver, compresses non-business hours to 72px/hour while preserving 36px business quarters, and applies the 36px/8px compact-card contract. Its remote migration was applied and catalog-verified on 2026-07-15; PR #409 released the application to production, where weekday, Saturday, closed-Sunday, break, density, and card-token smoke checks passed. The current Vercel production environment points to the same staging Supabase project, so no second production migration target exists. |
| Customer management       | Guardian/patient profile, relationship management, and soft delete/restore persistence boundaries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Chart                     | SOAP, diagnosis/search, order draft/confirmation, fulfillment sync handoff, downstream fulfillment lifecycle readback, local-first persistence checkpoints, and live queue API adoption. CHART-PR-012 replaces the pre-call lock placeholder with a DB-backed veterinarian preconsultation view for patient/guardian identity, visit and reception context, vitals, and prior encounters. CHART-PR-022 makes the workspace operating date the queue, selection, URL, header, and content scope; populated dates auto-select the valid direct link or first server-sorted task, while loading, empty, error, and permission states never retain a prior-date chart. CHART-PR-023 adds actual selected-patient/guardian previews, existing URL-backed profile drawer activation, and one shared vital dialog for waiting and active consultations. Remote synthetic versions `20260815102642` and `20260815103052` passed fixed-search-path/grant checks and rollback-only allowed/denied state probes with no retained rows. The read boundary requires active membership plus `chart:view`; call/return writers require `chart:update` and actor/session equality. Production application release remains approval-gated. |
| Lab and imaging           | Workspace screens exist; DEN-238 connects queue status context and status mutation to the shared fulfillment route. UI PR 2 adds lab result-sheet catalog read adoption for live lab work items and a local/dev result-entry server boundary. DEN-452 adds local/dev/test DB tables, RLS policies, RPCs, and API wiring for durable lab result value persistence. DEN-453 distinguishes catalog loading/empty/error/permission states and save retry/permission states in the visible lab result UI. Provider integrations and remote Supabase replay remain outside current completion claims |
| Dispensing/treatment      | Workspace screen exists; DEN-239 connects queue status context and status mutation to the shared fulfillment route, and UI PR 2 covers treatment/dispensing route-boundary status transitions. DEN-456 adds visible execution-screen readback from `order_fulfillment_work_items`, server-backed status mutation, permission/failure states, and focused UI regression coverage. Cheongdam cleanup work should prevent legacy fixture fallback from hiding seed/API readback gaps                                                                                                              |
| Billing                   | Invoice candidate, invoice line edit, billing confirmation, payment state, guardian checkout, fulfillment completion candidate sync, and amount-integrity regression foundations. UI PR 2 covers checkout route consumption in visible billing UI. DEN-454 makes the selected billing demo path API-primary for invoice-line, payment-status, and checkout-session snapshots, and DEN-455 adds visible loading, permission, retryable failure, empty, and checkout retry states while mock fallback remains                                                                                    |
| Inpatient                 | Session-only ward board and detail surface                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Hospital admin            | Order catalog persistence foundation, server-backed membership/invitation directory, archived membership lifecycle, permission-role and job-position definition lifecycle, audit-atomic mutation RPCs, grouped settings-hub UI, and a Flex-inspired session-only `근무표`. HOSPITAL-ADMIN-LIVE-PR-012 persists operating hours, date exceptions, timezone, and holiday policy behind member-read/admin-write API/RLS/RPC boundaries; settings updates emit central audit events and block future appointment conflicts. HOSPITAL-ADMIN-LIVE-PR-018 adds workspace-wide curated vital presets, admin-managed order/visibility/units, canonical measurement conversion, and shared reception/chart/current-summary consumption. PR #479 released the feature to production, and remote migration `20260722112553` passed catalog, permission, authenticated rollback-only writer/readback, and persisted-default checks. HOSPITAL-ADMIN-LIVE-PR-019 makes weight/temperature catalog-required while keeping measurements optional, adds reversible optional-preset removal, and preserves historical measurements. Its remote migration `20260722130209` passed catalog, required-writer rejection, optional removal/re-add, front-desk denial, rollback, and unchanged-measurement checks; PR #483 carries the application release. HOSPITAL-ADMIN-LIVE-PR-020 locally implements workspace category/space CRUD with archive-safe Supabase schema, permission-checked command RPCs, audit events, and the approved two-level `공간 관리` UI; remote migration and release are not claimed. HOSPITAL-ADMIN-PR-007 splits hospital identity, contact/channel, and operating-time management into independent URL-backed screens while preserving live space/vital screens. HOSPITAL-ADMIN-LIVE-PR-021/022 locally implement workspace-scoped profile/contact/change requests and private hospital-logo Storage with API/RPC/RLS/audit boundaries; remote migration, Storage provisioning, and production readback remain release-gated. HOSPITAL-ADMIN-LIVE-PR-023 links that stored private-logo pointer to the workspace-list read model and app-shell switcher, preserves one shared fallback mark, and refreshes shell identity after upload or removal; no schema or remote logo asset change is included. |
| Audit                     | Audit schema, append helper, mutation emission hooks, and hospital-admin review surface                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Auth/workspace            | Mock fallback plus Supabase/server-session boundaries, workspace membership, role management, and local DB/RLS foundations                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

RECEPTION-LIVE-PR-016 is implemented: effective break time is now a
warning-confirmed creation state for walk-ins and reservations, the day calendar
uses a selectable, center-labeled hatch, and a forward migration removes only
break-only write/settings conflicts while preserving the existing security
boundary. Local RPC transaction replay passed and rolled back. Remote migration
`20260722112803` is applied to the shared staging/production Supabase project;
catalog readback verified fixed function search paths, private helper isolation,
authenticated-only public execution, and retained closed/treatment-hour guards.

Project 08 `Clinical Order Fulfillment Handoff Persistence` is ready for representative Human Review after DEN-235 through DEN-242. It verifies the local-first chart-confirmed order handoff through downstream fulfillment queues, lifecycle readback, and billing candidate readback. Its original remote staging replay was approval-gated at closeout; the current operating policy now allows scoped synthetic/demo remote validation under an active work item unless it triggers the cost/security/real-data/destructive-operation gates below.

Demo DB PR 1 through PR 5 closed the earlier seed-family gaps for the `clair-demo` synthetic local/dev dataset, and later Cheongdam work introduced `workspace-clair-cheongdam` as the default prepared-clinic seed workspace. UI PR 1 starts the API-backed adoption phase by hydrating reception patient/guardian profiles from the reception lookup route, loading the chart queue through the chart live-queue route, and adding a focused synthetic E2E route-boundary test that covers reception, chart order confirmation, fulfillment work-item completion, result-review billing, checkout/payment status, and audit readback. UI PR 2 extends downstream adoption by connecting live lab fulfillment work items to the seeded lab result-sheet catalog, adding a local/dev lab result-entry server boundary, covering treatment/dispensing fulfillment transitions at the route boundary, and exercising billing checkout plus audit review in visible UI E2E. DEN-452 replaces the lab result-entry proof with local/dev/test Supabase persistence tables, RLS, RPC save/readback, and server-permission-checked API wiring. DEN-453 adds visible lab result API state handling for catalog retry, save retry, and permission-denied outcomes. DEN-454 makes billing invoice-line, payment-status, and checkout-session snapshots API-primary in the visible selected-invoice demo path and verifies payment-status readback after mutation. DEN-455 adds visible billing API loading, empty, retryable failure, permission-denied, and checkout retry states. DEN-456 makes the dispensing/treatment execution screen show fulfillment work-item readback, server status transitions, permission denial, and mutation failure states instead of silently relying on local queue state. DEN-457 adds a visible day-in-clinic Playwright demo that walks reception, chart queue, lab result entry, dispensing fulfillment readback, billing checkout, and audit review surfaces with explicit API-call assertions. DEN-458 adds a local Supabase replay helper and docs that separate Docker/Supabase/psql environment gaps from actual seed/readback regressions. DEN-459 adds focused API boundary regression coverage for lab result entry, fulfillment, and billing denial paths, and keeps client-only gating explicitly outside the security-complete claim. DEN-460 synchronizes the engineering docs and adds an API-backed demo runbook so new sessions can interpret current mock/live/API boundaries and verification results without relying on old handoff context. DEN-461 closes out the earlier demo readiness report and remaining-gap inventory. DEMO-DATA-PR-002 now treats legacy Sales Demo fallback as removable technical debt while keeping unconfigured local mock mode local-only and non-authoritative for seed-backed workflow verification. HOME-PR-011 adds the first Home `원내 현황` live operations read model and API path for Cheongdam/prepared-clinic work items, so API failure or permission denial is no longer hidden as an empty Home board. HOSPITAL-ADMIN-PR-002 reframes `병원관리` as the hospital operating settings hub, keeps `감사 로그` as a minimal admin review surface, distinguishes `역할별 업무 관리` from member/permission assignment, and adds mock/static screen concepts for the prioritized settings pages. HOSPITAL-ADMIN-PR-003 replaces only the static `근무표` concept with an interactive synthetic session screen; HOSPITAL-ADMIN-PR-005 turns 병원기본설정 into a dedicated session-local form. Neither claims DB/API/RLS persistence, server authorization, audit emission, notifications, or external support-request delivery.

HOSPITAL-ADMIN-PR-004 adds the membership archive/restore contract, role replacement lifecycle, job-position retention lifecycle, server API boundaries, and audit-atomic DB mutations. PR #329 and forward migrations `20260711162828`, `20260711164114`, and `20260711164859` were released together on 2026-07-12. HOSPITAL-ADMIN-LIVE-PR-012 adds forward migration `20260715100000`, an operating-hours replay snippet, settings GET/PUT, effective-date calendar response, writer enforcement, and variable calendar density. The migration was applied to the linked synthetic/demo Supabase project under remote version `20260714162034` and catalog-verified on 2026-07-15.

The latest detailed change history before this split is in [MVP Current Status History](current-status-history.md).

RECEPTION-PR-007 adds the first reusable staff operational profile entry from the reception day calendar. It reuses the existing veterinarian filter state for lane hiding, prevents removal of the last visible lane, and composes approved profile, organization, and selected-date shift fields without a new migration. Reception appointment counts remain a client-side summary of the already authorized calendar source. Cross-module reuse still needs a dedicated `staff:read` policy decision; the current API intentionally uses `reception:view` and does not expose permission roles, personal phone numbers, login history, or internal membership IDs.

RECEPTION-PR-008 adds the reception veterinarian operational-status read model without storing a mutable "current status" field. The workspace/date-scoped RPC derives `available`, `scheduled`, `shift_ended`, `clocked_out`, `leave`, or `off` from published/changed shifts and explicit time-clock facts, while missing authoritative schedule data remains `unknown` and renders no badge. The reception UI can overlay `진료중` only from an already-authorized checked-in appointment overlapping the current time. Status RPC failure is isolated from the base staff list. The day-lane header keeps the approved Figma-derived radius, padding, badge, avatar, and ghost actions, with the later compact override of body-2 14/20 names, a 6px name-to-badge gap, and same-hue `200` borders while preserving the existing stable per-veterinarian tone mapping.

RECEPTION-PR-009 replaces the staff modal Sheet with a Figma-aligned detached side-panel column: desktop `336px` with a `10px` content gap and no backdrop/blur, and backdrop-free full width on narrow screens. It removes reservation statistics, exposes nullable `public.users` email/phone to active same-workspace members, and adds reusable disabled-placeholder tabs. Private workspace Realtime Presence remains the only online source, while additive `workspace_member_activity` persistence stores throttled last-seen timestamps without `is_online` or session data. Both activity and receive-only Broadcast handshake migrations are applied and their synthetic authorization probes passed. The app-shell reporter owns the single Realtime channel, profile consumers read its shared snapshot without late callback binding, and the heartbeat path explicitly awaits Supabase's lazy `rpc()` result so `last_seen_at` writes actually execute.

RECEPTION-LIVE-PR-014 adds the workspace-scoped staff status-message table,
same-workspace read and self-only mutation RLS, Supabase-session-only PATCH route,
atomic optimistic-concurrency RPC, and body-free audit metadata. Remote versions
`20260715164007` and `20260715164307` are applied to the linked synthetic/demo
project. Catalog checks and a rollback-only synthetic transaction verified self
save/read/delete, same-workspace read, stale-write conflict, other-user/inactive/
cross-workspace denial, and zero persistent probe rows.

RECEPTION-LIVE-PR-015 adds private self-service profile avatars without changing
the public synthetic seed bucket. A 2KB JSON prepare/finalize/discard API keeps
raw files out of the Vercel request body; the browser uploads to an owner-derived
private quarantine path, and the Node server verifies/decode-bounds/re-encodes a
static 512px WebP before a self-only CAS pointer swap. Remote version
`20260715172425` is applied to the linked synthetic/demo project. Catalog,
transactional RLS/RPC replay, and authenticated Storage API QA verified private
bucket configuration, owner-only quarantine, pointer-scoped same-workspace
signed reads, direct/other-user/inactive/cross-workspace denial, pointer restore,
and zero remaining probe objects. Existing signed/cached reads have a bounded
five-minute residual lifetime; new signing is denied after pointer removal.

RECEPTION-QA-PR-012 closes the Staff Profile Side Panel V2 release surface with
200% zoom/long-content browser regression, a private Presence probe, a
transaction-safe schedule/status/activity/assigned-work replay, and the final
Korean release report. The replay found that the real-session assigned-work API
could not reach its existing active-workspace RLS policy because the table had
no `authenticated` read privilege. Migration
`20260716030000_staff_assigned_work_items_authenticated_select.sql` grants only
`SELECT`; remote version `20260715180209` is applied. Local and approved-remote
replays verified same-workspace read, self-only status mutation, other-user and
cross-workspace denial, private Presence subscribe/track/cleanup, private avatar
pointer/object cleanup, and zero fixed synthetic probe rows. The immutable
production deployment ID and exact final merge SHA are recorded at the
post-merge release gate rather than guessed in pre-merge docs.

## Not Complete Yet

Do not claim these as done without a scoped work item and verification evidence:

* remote Supabase validation
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

The baseline docs operating-system project is `CLAiR EMR 문서 운영 체계 구축`. It produced the current docs portal, startup rules, baseline source docs, and GitBook handoff set.

The docs navigation improvement project `CLAiR EMR GitBook/docs 운영 고도화` is completed in Linear. It was private/internal GitBook-oriented work for making repo docs easier for 승욱 to read and review; it was not a public publishing or production launch project.

Completed or in Human Review:

* DEN-171: GitBook docs home and sidebar map
* DEN-172: Agent RAG map and startup reading rules
* DEN-173: split this status document into compact summary and preserved history
* DEN-174: SaaS operating map
* DEN-175: Product MVP scope and non-goals
* DEN-176: outpatient workflow state model
* DEN-177: EMR domain entity map
* DEN-178: role/permission source normalization
* DEN-179: mock/live boundary map
* DEN-180: persistence and data security checklist
* DEN-181: Product MVP QA scenario pack
* DEN-182: launch readiness checklist
* DEN-183: decision log index and GitBook handoff

Current work:

* Representative Human Review of the baseline docs operating system.
* GitBook/docs navigation improvement through DEN-252 through DEN-257 is completed in Linear. Manual GitBook site setup or access changes still require a separate explicit request from 승욱.

Upcoming baseline docs in this project:

* None. The current baseline set is ready for Human Review.

## Recommended Next Work

Review the `CLAiR EMR 문서 운영 체계 구축` baseline documents in Human Review when ready. The `CLAiR EMR GitBook/docs 운영 고도화` project is completed; do not create, publish, or widen access to a GitBook site until 승욱 explicitly asks for manual setup.

Do not infer next implementation work from the large `human_review` count in `docs/work/index.md`. Use Linear issue status first, then use `docs/work/index.md` to find the matching repo work item or review queue.

For product/live-MVP work outside this docs project, review the current Linear project/issue first. Do not infer readiness from old status bullets; use the active issue, source docs, and latest closeout reports.

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
