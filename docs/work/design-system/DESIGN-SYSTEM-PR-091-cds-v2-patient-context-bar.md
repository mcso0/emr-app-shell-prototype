---
id: "DESIGN-SYSTEM-PR-091"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "PR #554 / CDS.V2 patient information bar"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-038-cds-v2-app-shell-scope.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-048-patient-info-bar-memo-action-ux.md"
updated: "2026-10-12"
---

# CDS.V2 Patient Context Bar

## Goal

Align the existing shared patient context bar with Figma node `27383:24831` without introducing screen-local variants or a second patient-bar component.

## Scope

- Keep `EmrPatientContextBar` as the shared owner for chart, dispensing, lab, and imaging; the chart compatibility wrapper delegates to it.
- Separate patient and guardian identity into their own icon-led sections.
- Preserve vital values as display-only badges and keep their server-owned read contract unchanged.
- Show the Figma memo set as four compact inline actions while retaining the existing shared memo popover for summaries, locked states, and unavailable reasons.
- Map the 56px bar, 36px sections, asymmetric padding, 24px icon tiles, dividers, fade, and controls to existing CLAiR/EMR spacing, radius, color, typography, and shadow tokens.
- Preserve the existing fixed right controls and horizontally scroll only the information track.

## Out Of Scope

- New patient, guardian, or vital-write navigation.
- New permissions, APIs, persistence, Supabase, RLS, migrations, or production release.
- A second shared abstraction, a broad header refactor, or unrelated screen styling.
- Figma writes or Code Connect changes.

## Done Criteria

- Patient, guardian, vital, and memo sections render in the Figma order from the existing shared component.
- All four direct consumers provide guardian data through the shared `guardianItems` contract.
- Memo buttons use the Figma labels and icon hierarchy; disabled states and existing popover details remain accessible.
- Shared geometry uses tokens and exposes stable `data-slot` hooks for focused regression checks.
- Existing display-only vital contract, overflow controls, and right-panel actions remain intact.

## Verification

- `npm run security:secrets`: passed.
- `npm run docs:check`: passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with the existing Turbopack NFT trace warning.
- `git diff --check`: passed.
- `tests/patient-vital-server.spec.ts`: 10/10 passed.
- Focused chart hover browser regression: 1/1 passed.
- Focused dispensing patient-context browser regression: 1/1 passed.
- Local mock-auth browser QA: patient, guardian, vital, memo, overflow, disabled billing memo, and memo popover verified.
- Manual GitHub Release Check for the PR candidate: passed.
- Vercel Preview for the PR candidate: Ready.

## Result

The shared patient bar now follows the approved CDS.V2 composition while preserving current domain ownership and avoiding screen-specific forks. The hover variants from Figma node `27936:111406` are also represented: every section uses the specified hover surface and icon-tile treatment, while patient/guardian chevrons, the vital plus, and the memo ellipsis appear in a right-edge gradient overlay. The base contract remains display-only unless a feature explicitly supplies an interaction.

## CHART-PR-023 Follow-up

The shared component now exposes optional patient/guardian preview activation and vital-action contracts. It still owns no data fetching, profile state, permissions, or persistence. CHART-PR-023 originally enabled these contracts only in chart; that was the scope of that release.

## 2026-09-27 Local Follow-up

Lab, imaging, and dispensing now opt into the existing profile preview, profile drawer, and vital dialog contracts. Live profile actions appear only after the selected work item resolves to a real patient ID and the workspace-scoped profile read succeeds. Billing keeps its guardian-centered summary layout and adds the same preview and drawer behavior to each identified guardian/patient badge. Vital actions continue through the existing permissioned latest-vital read and guarded chart vital writer; completed work is disabled in the context bar. This follow-up is implemented locally and has not been delivered to the production deployment.

## 2026-10-11 Chart-baseline Alignment Follow-up

Status: local implementation complete; final verification recorded below.
Local implementation was accepted on 2026-10-12. Release preparation is now
authorized; exact-candidate Production approval remains the final merge gate.

### Approved Scope

승욱 approved local implementation after the read-only cross-screen audit and
scope proposal. The parent orchestrates GPT-6.1 workers at `max` reasoning.

- Align dispensing/treatment, lab, and imaging patient and guardian identity
  composition with chart: name, breed, sex/neuter, age; guardian relationship
  and contact. Preserve workload-specific trailing information.
- Resolve false `미상` values through existing workspace-scoped authorized
  profile reads, including direct entry and reload without chart handoff state.
- Correct visit-purpose and memo composition through existing read contracts;
  distinguish missing values, pending reads, failures, and denied access.
- Align billing geometry, typography, identity presentation, hover, and overflow
  controls with chart. Preserve guardian-first ordering, individually interactive
  multiple patients, masking, financial summaries, and existing billing data.
- Preserve existing profile navigation, vital permissions/writes, work selection,
  queue state, and financial actions. Keep shared visual components data-agnostic.

The user explicitly excluded billing data remediation. No remote writes,
database/migration/RLS changes, production delivery, or main merge are authorized
by this local implementation request. Use synthetic fixtures and mocked existing
API responses for local verification. Do not replace real read failures with
legacy demo profiles or modify immutable order snapshots to fix header display.

### Implementation And Verification Plan

1. Reuse the existing profile read for the visible identity and preview, and
   protect patient/workspace changes from stale responses.
2. Apply the chart identity/memo contract to clinical callers.
3. Reuse shared context-bar presentation for guardian-centered billing without
   changing billing calculations or source data.
4. Verify direct entry, reload, delayed selection changes, denied/missing reads,
   long content, profile activation, vital controls, and billing multi-patient
   behavior. Run focused regressions, lint, typecheck, and documentation checks.

Work is isolated in `codex/patient-context-alignment` from `710b810a`, preserving
the existing checkout's configuration and documentation WIP.


### Local Result And Verification (2026-10-12)

Clinical headers and their previews now share one authorized patient overview.
Guardian memo and visit purpose use the existing guardian overview and chart
preconsultation reads. Pending, denied, failed, missing-subject, and empty-field
states remain distinct. Scope checks reject mismatched responses and suppress
previous-patient or previous-workspace content during selection changes.

Billing uses the shared bar with guardian-first order and independently
interactive patient sections. Its source values, masking, totals, selection, and
financial actions remain unchanged. The information track observes content
resizing so fixed overflow controls update after asynchronous content changes.

- Full `npm run lint`: passed, with five existing unused-variable warnings in
  unrelated WP10 scripts and zero errors.
- `npx tsc --noEmit --pretty false`, `npm run docs:check`,
  `npm run security:secrets`, and `git diff --check`: passed.
- Clinical identity/memo/direct-entry/reload/scope/failure browser regressions:
  17/17 passed.
- Profile projection, preconsultation, and vital server regressions: 22/22 passed.
- Existing lab/imaging profile browser regressions: 2/2 passed after correcting
  obsolete preview assertions to the existing breed/age/sex contract.
- Current chart/dispensing vital-history launch, exact measurement update, header
  refresh, permission denial, and completed-work guards: 5/5 passed.
- Shared-bar Storybook interaction checks: 4/4 passed.
- Billing geometry/overflow/masking/summary browser regression: 1/1 passed.
- Selected existing chart/billing regressions: 6/7 passed. The remaining legacy
  chart test expects the superseded `오늘 바이탈 수정` dialog; the unchanged baseline
  already uses `바이탈 이력` and the history endpoint.
- The existing broad dispensing app-shell test retains obsolete instruction
  header expectations (32px versus baseline 36px; then an absent RX title).
  Its patient-bar assertions passed. Product behavior was not changed to satisfy
  those unrelated assertions, and the app-shell test remains unchanged.

Verification uses local synthetic fixtures and mocked API responses. This is not
production data verification or authenticated production smoke. Existing legacy
test failures above prevent claiming a completely green repository-wide suite.


### Release Request (2026-10-12)

승욱 requested committing and pushing only this follow-up, opening a PR to
`main`, merging, and verifying deployment. Prepare the exact candidate and
required Release Check/Preview evidence under the release runbook before the
final Production approval gate. No database, migration, permission-policy,
financial-data, or external-provider changes are included.

The initial comparison target is `710b810aa1101a8efb7a03dc64642dd8c3580ff6`.
The current Ready Production deployment and rollback candidate is
`dpl_85zaRvdLxWYPGKR2TcZ1m7QYdZWq`, sourced from that commit. Reconfirm both before
merge. Post-merge smoke covers `/login` and read-only navigation to chart,
dispensing/treatment, lab, imaging, and billing. Authenticated screen inspection
uses only available synthetic/demo context; if authentication is unavailable,
report the redirect boundary without claiming authenticated smoke. Do not submit
clinical, billing, or profile mutations in Production.


### Shared Loading Skeleton Follow-up (2026-10-12)

승욱 requested replacing loading copy in the shared patient information bar with
skeleton UI. This follow-up is local implementation only; it has no release
approval yet and does not include the billing permission/checkout limitation.

- The shared datum and memo contracts accept an explicit `loading` flag. Use the
  existing Skeleton styling, suppress pending profile actions and memo actions,
  retain screen-reader loading text and `aria-busy`, and honor reduced motion.
- Clinical profile/memo reads and initial latest-vital reads supply loading state.
  Already-resolved values remain visible during other sections' reads. Missing,
  denied, and failed reads retain their existing messages. Chart and billing
  identities already provided by their selected records are not hidden merely
  because a separate profile preview is loading.
- No fetch, permission, mutation, source-data, or global Skeleton behavior changes.
- Focused clinical/vital browser regressions: 22/22 passed. Story, typecheck, lint,
  and visual verification results are recorded at local completion below.


Local completion evidence:

- Clinical profile/data and vital compatibility browser regressions: 22/22 passed.
- Shared-bar Storybook browser tests: 7/7 passed, including patient-first and
  guardian-first pending/partial/ready transitions, stable bar height, suppressed
  pending interactions, restored keyboard activation, and reduced-motion classes.
- Focused ESLint, TypeScript `--noEmit`, docs link validation (1064 references),
  and `git diff --check` passed.
- The isolated-worktree Storybook preview runs on local port 6127. The connected
  Storybook MCP instance serves another checkout and could not resolve these new
  stories. Manual visual inspection remains unverified because the app browser
  connection was unavailable; CLI browser test results above are independent.
- Local implementation is ready for human review. No commit, push, Production
  merge, or deployment was performed for this skeleton follow-up.


Skeleton release preparation (2026-10-12): 승욱 authorized committing and pushing
only this follow-up, creating its PR, and completing pre-production checks before
requesting final merge approval. This supersedes the local-only delivery state
above; it does not authorize merging to `main` yet. Compare against
`247d21dde86547c4c2ac3c7941af49b29df09a42`. Current Production and proposed rollback
candidate: `dpl_AETpMAkDNkwyJt2CTPwmgyMudBBP`; reconfirm before approval.
Post-merge smoke will cover `/login` and read-only patient bars in chart,
dispensing/treatment, lab, imaging, and billing using available synthetic context.
Do not perform clinical saves, checkout/payment actions, permission changes, or
remote DB mutations. Report any authentication or permission boundary explicitly.
Stop if the candidate changes, a required check fails, Preview is not Ready, or
Production approval is missing. Record exact-candidate results in the PR packet.


### Chart Initial Loading Follow-up (2026-10-12)

승욱 authorized local implementation so the chart patient context bar uses the
shared skeleton while its first data read is pending, keeps already-loaded data
visible, and introduces no artificial delay. No new release was authorized.

The previous chart header rendered an empty fixed header before a selected
bundle existed. It now renders the existing ChartPatientContextBar with explicit
loading state only while no bundle is available and its scoped queue is idle or
loading. Ready empty/error states do not retain a skeleton. Existing bundles
continue to render their identity immediately during same-scope refresh. The
wrapper passes pending identity/memo/vital/doctor fields into the existing shared
skeleton styling and suppresses pending profile/vital actions. No data-fetch,
permission, mutation, queue selection, or clinical record contract changes.

Verification: focused chart/dispensing browser tests 7/7 passed, including held
initial queue reads, immediate resolved identity, unchanged bar height, preserved
identity during refresh, empty-read skeleton removal, and existing vital guards.
Shared-bar Storybook tests 16/16 passed, including the new ChartInitialLoading
composition and existing ready chart/billing cases. Focused ESLint, TypeScript
`--noEmit`, docs checks (1068 references), and diff checks passed. Manual local
Storybook inspection confirmed the chart skeleton composition. Project-scoped
Storybook MCP is not available in this session; the actual source, owned stories,
CLI browser tests, and isolated local preview were used. Local implementation
is ready for human review; no commit, push, merge, or new deployment was performed.


Chart skeleton release preparation (2026-10-12): 승욱 authorized committing and
pushing only the chart initial-loading follow-up, opening its PR, and completing
pre-production verification before requesting final merge approval. Compare target:
`7feef5b5df9edd3f4a74c728b974c940c3bc32e1`. Current Production/rollback candidate:
`dpl_4om9MYjzxbPbA8KDZEuJhiyfrLsi`; reconfirm before approval. This supersedes the
local-only delivery state above and does not authorize a main merge yet.

Post-merge smoke: `/login` and read-only chart patient context with available
synthetic data, including immediate resolved identity and existing vital/memo
controls. Delayed first-read and same-scope refresh behavior are verified by
local synthetic browser regressions. No artificial Production delay, clinical
save, completion, payment, permission, or DB mutation is included. Stop if the
candidate changes, required checks fail, Preview is not Ready, or approval is
missing. Record the exact candidate, final checks, and rollback in the PR packet.
