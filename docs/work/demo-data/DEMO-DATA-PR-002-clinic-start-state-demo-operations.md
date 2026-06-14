---
id: "DEMO-DATA-PR-002"
status: "ready"
area: "demo-data"
priority: "P0"
target_pr: "TBD"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/clinic-start-state-and-demo-operations-v1.md"
  - "docs/product/roadmap/product-mvp-scope.md"
dependencies:
  - "DEMO-DATA-PR-001"
updated: "2026-06-12"
---

# Clinic Start State and Demo Operations

## Goal

Define and implement the next demo-data baseline so the default portfolio workspace opens as a newly started clinic with realistic setup/master data, no pre-filled daily work, resettable state, date-correct behavior, and no stale mock flash.

## Background

승욱 wants the demo to start like a real newly opened hospital:

- staff, roles, workspace membership, patients, guardians, order catalog, and hospital-admin setup already exist
- order categories, order catalogs, order sets, lab items, pricing, and presets are prepared enough to feel like a real hospital setup
- active work does not already exist
- users can click around and create real workflow state
- stale May 2026 fixture data should not appear by default
- reset should make demos repeatable
- real-time day progression is preferred if previous-day work can remain visible without making the demo brittle

This is a portfolio/demo-readiness scope using synthetic data. It is not a real-data import, remote Supabase mutation, or production launch scope.

## Scope

- Audit current mock, fixture, seed, local-first, and API fallback sources used by main workspaces.
- Define the central demo date source and remove hardcoded stale daily work from the default path.
- Add or adapt the synthetic empty-clinic seed:
  - one workspace
  - users and role memberships
  - patient and guardian master records
  - order categories, order catalog, order sets, lab items, pricing examples, and admin presets
  - no active reception, appointment, encounter, fulfillment, or billing work by default
- Define reset behavior for returning to the empty clinic baseline.
- Ensure legacy fixtures, old log-style records, and stale dummy daily work do not appear in the default path.
- Preserve older Sales Demo fixture behavior only behind developer/test opt-in if still needed.
- Assess real-time day progression versus fixed review-date reset:
  - preferred: June 11 work remains available on June 12/13 via date picker or calendar views
  - fallback: fixed review date plus reset if multi-day state is too complex for this demo phase
- Add basic role-specific workflow checks for administrator, veterinarian, technician, front desk, and fulfillment staff:
  - administrator can review/manage almost everything, including sensitive settings
  - veterinarian can handle most clinical work but not sensitive hospital/security settings or restricted admin configuration
  - technician/front desk/fulfillment can view and act in their work areas but cannot edit veterinarian chart authority, order catalog/admin setup, or sensitive settings
- Reframe the audit-style surface as staff-readable `변경 이력` where this can be done without deep security expansion.
- Add first-pass empty/loading/error/validation UX hooks where stale fallback flashes occur.
- Verify cross-workflow status consistency for chart, fulfillment, and billing on the main golden path.
- Add a concise demo script that 승욱 can click through and judge manually.
- Add focused regression coverage for the empty baseline, demo date correctness, reset behavior, role smoke paths, and chart/fulfillment/billing readback.

## Out Of Scope

- Real patient, guardian, hospital, billing, identity, or payment data.
- Remote Supabase validation, mutation, migration push, or staging replay without explicit approval.
- Production deploy or production monitoring.
- Full production-grade RLS/security certification.
- Payment, email, KakaoTalk, PACS, device, accounting, or provider integrations.
- Scenario replay implementation in the first pass.
- Automatic long-running multi-day simulation before resettable baseline and date-history behavior are validated.
- Detailed visual redesign of empty/loading/error states beyond reliable first-pass UX hooks.
- Deep cross-workspace isolation work beyond basic demo confidence checks.

## Done Criteria

- The default demo workspace opens with master/setup data but no active daily work.
- Order categories, order catalog, order sets, patient/guardian master records, users, and roles are ready enough to support real workflow creation.
- Screens do not show stale May 2026 work by default on a current-date review.
- Data-source precedence is documented and implemented for touched surfaces.
- Reset restores the empty clinic baseline.
- The implementation decision for real-time day progression versus fixed review-date reset is recorded with rationale.
- Focused test setup can create a bounded outpatient workflow from the empty baseline.
- Role-specific smoke coverage verifies the main action boundaries for admin, vet, technician, front desk, and fulfillment staff.
- Chart, fulfillment, and billing status readback stay consistent on the covered golden path.
- Empty/loading/error/validation hooks prevent stale mock flash on touched screens.
- A first demo script exists for owner review.
- Documentation links point to the updated product source doc.

## Verification

- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- focused Playwright coverage for:
  - empty clinic baseline
  - demo date correctness
  - reset behavior
  - role-specific smoke paths
  - chart/fulfillment/billing status readback

## Approval Gates

Stop and ask 승욱 before:

- remote Supabase staging/live validation or mutation
- migration push or remote SQL/RLS work
- production deploy
- real hospital, patient, guardian, staff, billing, identity, or payment data
- provider/payment/email/KakaoTalk/PACS/device integration

## Notes

- 2026-06-12 DEN-468/DEN-491 implementation note:
  - Cheongdam home, chart, lab, imaging, dispensing/treatment, inpatient, and billing modules now suppress legacy active daily-work fixtures and fixed May 2026 labels for `workspace-clair-cheongdam`.
  - Cheongdam global command search now suppresses legacy mock patients, guardians, appointments, and active encounters; global notifications use an empty notification set so stale fixture badges do not appear.
  - Staging Cheongdam master seed now includes 5 synthetic staff users, 25 guardians, 25 linked dog/cat patients, service categories/items/prices, order catalog items, and order sets.
  - Staging readback confirmed zero appointments, encounters, waiting queue entries, orders, fulfillment work items, and invoices for the Cheongdam default start state.
  - Fixed staging was redeployed and aliased to the latest preview. In-app browser access is still stopped by Vercel Deployment Protection before app login, so protected-page verification used `vercel curl`, local Playwright coverage, and remote DB readback.

- 2026-06-12 scoped implementation note:
  - DEN-469/DEN-471 rework removed `clair-demo` reception fixture inheritance from `workspace-clair-cheongdam`.
  - `workspace-clair-cheongdam` now uses the current operating date and no default active reception appointment/encounter/queue cards.
  - `clair-demo` remains the explicit Sales Demo fixture path with the fixed `2026-05-01` regression data.
  - This does not complete the full DEMO-DATA-PR-002 scope; reset, role smoke, broader shell/search cleanup, and full cross-module QA remain separate issue work.

- 2026-06-12 DEN-472/DEN-473 implementation note:
  - Cheongdam reception read errors now keep a prepared empty-clinic fallback message and retry action instead of saying legacy local demo data is maintained.
  - Cheongdam queue/calendar error states are covered by focused Playwright assertions that reject `26.05.01`, Kong/Nabi/Coco fixture text, and appointment/walk-in cards.
  - Reception session draft creation now receives the active workspace/date so local fallback work created in Cheongdam does not default to `clair-demo`.
  - Broader shell search, tabs, notifications, and cross-module empty-state cleanup remain separate follow-up scope, especially DEN-491 and DEN-468.

- 2026-06-12 DEN-483 rework note:
  - Cheongdam reception walk-in creation now keeps a selected live patient/guardian lookup result even when the selected display label triggers a follow-up search with no rows.
  - Follow-up correction: reception patient summaries are now workspace-scoped before rendering/selecting candidates, so Cheongdam no longer offers legacy `clair-demo` patients such as Nabi/Sea from the empty search state.
  - Follow-up correction: Cheongdam customer management now filters local profile state by workspace and hydrates from the live seeded patient/guardian lookup, so customer rows match reception search instead of showing legacy `P-260414-*` fixtures such as Coco/Nabi.
  - Follow-up correction: Cheongdam reception side-panel `전체` now shows only active reception/appointment work, not all 25 seeded master patients.
  - Follow-up correction: Cheongdam reception content now renders the calendar workspace even when no patient is selected; the selected-patient empty state is not allowed to replace the calendar body.
  - Follow-up correction: the reception detail drawer now reads live seeded patient/guardian profiles and the live encounter handoff, so selecting a newly created ticket shows the registered reception information.
  - Follow-up correction: Cheongdam chart queue no longer hides Supabase live queue rows behind the prepared-empty guard, and chart history includes the current live encounter.
  - Follow-up correction: Cheongdam reception now clears same-workspace browser session drafts and transient calendar draft selection after a successful prepared-empty queue read, so `대기 0` no longer leaves a stale unassigned card on the calendar. Calendar draft rendering is also workspace-scoped.
  - Follow-up correction: Cheongdam reception calendar no longer merges stale calendar queue records into walk-in cards unless both the encounter and queue entry are still active. This prevents completed/done calendar records from reappearing as `환자 미지정` cards while the queue side panel shows `대기 0`.
  - Follow-up correction: Cheongdam day/week calendar now filters queue-derived walk-in cards by the current operating date, so an active record from a previous operating date cannot appear on today's calendar.
  - Remote staging reset: after approval, one lingering Cheongdam active daily-work row (`E-260612-18EDFA`, patient `49121000-0000-4000-8000-000000000015`) was cancelled in `encounters` and `waiting_queue_entries`. Readback confirmed active encounter 0, active queue 0, active appointment 0 for `workspace-clair-cheongdam`.
  - The focused regression proves the generated reception payload keeps the seeded `patientId`, `guardianId`, patient name, and visit purpose instead of failing as if no customer was selected.
  - Chart live queue and order catalog server contracts were rechecked: live chart queue reads the reception queue RPC, and chart order search reads the workspace hospital-admin order catalog.
  - Queue/detail/chart correction deployed as `dpl_6Nv8MzaVLeDBBYkcd22U8zR3yNiX`; reception calendar restore hotfix deployed as `dpl_8fH6hwM6YJvzzuQVJ4mNs6gGnrHP`; stale session draft cleanup hotfix deployed as `dpl_GR6tTp3FeB6wMy6Ti1WixKA758kE`; stale completed calendar queue filter hotfix deployed as `dpl_8qbhDUwASa3hF9MHxUbSjdihoSFQ`; operating-date calendar guard and staging reset verification deployed as `dpl_E5chMHPh2MXxbaAYgTGfs15DSjxZ`. Fixed staging alias points to the latest hotfix preview. Browser click verification is still blocked by Vercel SSO/passkey in the in-app browser, while `vercel curl` confirms the protected Cheongdam route serves the app HTML.
  - No remote staging encounter was created during this pass, so the Cheongdam empty daily-work baseline remains clean. Remote write-through golden-path validation still needs an approved create-and-reset scope.
  - DID/waiting-room call display, reset automation, role-account smoke coverage, diagnosis catalog API/seed expansion, and full order fulfillment readback remain follow-up work.

- Keep the implementation PR-sized. If the audit finds broad churn, split into:
  1. data-source/date audit and contract
  2. empty-clinic seed and reset
  3. loading/error/validation UX pass
  4. role, change-history, and golden-path QA

- Do not implement scenario replay in the first pass unless 승욱 separately approves that scope after the baseline exists.
