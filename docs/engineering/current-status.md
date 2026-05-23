# MVP Current Status

Updated: 2026-05-23

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
| Reception and appointment | Reception queue, walk-in intake, patient/guardian registration, and local-first encounter path foundations |
| Customer management | Guardian/patient profile, relationship management, and soft delete/restore persistence boundaries |
| Chart | SOAP, diagnosis/search, order draft/confirmation, fulfillment sync handoff, downstream fulfillment lifecycle readback, and local-first persistence checkpoints |
| Lab and imaging | Workspace screens exist; DEN-238 connects queue status context and status mutation to the shared fulfillment route, while full live result/provider persistence remains outside current completion claims |
| Dispensing/treatment | Workspace screen exists; DEN-239 connects queue status context and status mutation to the shared fulfillment route, while full live dispensing/treatment execution persistence remains outside current completion claims |
| Billing | Invoice candidate, invoice line edit, billing confirmation, payment state, fulfillment completion candidate sync, and amount-integrity regression foundations |
| Inpatient | Session-only ward board and detail surface |
| Hospital admin | Order catalog persistence foundation and membership/invitation management surfaces |
| Audit | Audit schema, append helper, mutation emission hooks, and hospital-admin review surface |
| Auth/workspace | Mock fallback plus Supabase/server-session boundaries, workspace membership, role management, and local DB/RLS foundations |

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
- full lab/imaging/dispensing live persistence
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
- focused server/API regression specs for auth, workspace, billing, customer, audit, and persistence boundaries
- secret scans and migration/static checks when auth, DB, RLS, or env handling changes

Do not assume the full suite has been run for a new task unless the current work item records it.

## Current Documentation Work

The active docs operating-system project is `CLAiR EMR 문서 운영 체계 구축`.

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

- Representative Human Review of the docs operating system.

Upcoming baseline docs in this project:

- None. The current baseline set is ready for Human Review.

## Recommended Next Work

Review the `CLAiR EMR 문서 운영 체계 구축` project documents in Human Review. After approval, commit and push the docs so GitBook can sync the updated portal from GitHub `main`.

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
