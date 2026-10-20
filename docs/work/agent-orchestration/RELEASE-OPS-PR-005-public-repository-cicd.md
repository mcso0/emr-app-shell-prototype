---
id: RELEASE-OPS-PR-005
status: in_progress
area: agent-orchestration
priority: P1
source_docs:
  - docs/engineering/operations/release-environment-policy.md
  - docs/engineering/operations/manual-merge-gate-runbook.md
  - docs/engineering/operations/production-release-pr-to-main-runbook.md
updated: 2026-10-20
---

# Public Repository CI/CD

## Outcome And Authorization

Align AGENTS.md, active release guidance, and the release skill with the public repository, automatic PR checks, and reusable explicit merge approval. Preserve unrelated WIP. Automatic Preview configuration remains conditional on satisfactory data/provider and plan/usage checks.

Initial investigation authority covered read-only checks and conditional automatic Preview activation, with no main merge or Production deployment. The user later explicitly authorized the agreed ordered work and granted approval in advance. Current bounded authority covers PR #1002 UI verification, a separate policy-documentation PR, and separate request-reduction work for duplicate profile/billing reads, focus/visibility refreshes, and notification sharing across windows while preserving the 30-second behavior and existing functionality. Each scoped PR may proceed through commit, push, PR, main merge, and Production verification after its checks, review, Ready Preview, smoke, and rollback gates pass. This work item owns only the policy slice and Preview findings; request-reduction implementation stays in a separate worktree/PR. This records direct user authority; it does not grant permission by itself.

No paid upgrade/resource, real sensitive-data access, migration, provider side effect, or material scope expansion is authorized. The automatic Preview activation hold remains in force until its usage/data conditions pass; it is not a blanket ban on an otherwise verified, separately authorized PR with an existing Ready Preview.

PR #1002 release smoke is limited to read-only UI interactions in the source-defined synthetic workspace `workspace-clair-cheongdam`, in authenticated Preview and Production. Verify that the reception create dropdown opens/closes without submitting, the plus icon is 18 px and chevron is 16 px, and queue-footer gap is 4 px with expected truncation. Do not create clinical records or trigger provider/email writes. The parent release task awaits EMR sign-in for the authenticated checks. Minimal approved smoke and a one-off Preview remain within the separate release scope; neither authorizes a paid feature or clears the automatic-Preview hold.

The read-only Supabase scope is the existing linked demo project: schema metadata, known synthetic workspace membership counts, and aggregate resource usage only. Do not retrieve patient, guardian, staff, identity, payment, or clinical row contents; do not mutate data, migrations, policies, or credentials. Existing source contracts define the synthetic allowlist; an arbitrary live row is not assumed synthetic.

## Scope

- Reconcile current GitHub/Vercel state with canonical operational guidance.
- Retain automatic Release Check, strict main protection, focused tests, Ready Preview, approval, smoke, and rollback evidence.
- Recognize explicit conditional merge authorization without a redundant confirmation; retain SHA-specific approval when the user pins a SHA.
- Audit agent entry points and stale current-state pointers; preserve historical evidence.
- Enable automatic Preview only after data and usage preconditions pass.

## Exclusions

Application code in this policy PR, workflow changes unless required by evidence, DB separation or cloning, external side effects, real data inspection, subscription changes, migrations, and unrelated WIP. Main/Production delivery is limited to the explicitly authorized scoped PR after all release gates pass.

## Verification And Completion

Run documentation and secret scans, diff validation, and a targeted stale-guidance audit. Verify live configuration only if changed. Record the final branch/candidate, evidence, remaining dependency, and primary-WIP comparison. Never describe prepared policy as an activated remote setting.

## Findings

- Preview and Production public Supabase endpoints match the same linked demo project; both auth modes are Supabase. Preview email delivery mode is staging. Endpoint and credential values are omitted.
- Vercel plan: Hobby. Supabase organization plan: Free.
- Vercel usage API returned Costs not found (404). Dashboard Last 30 Days, all projects, Sep 19–Oct 19: Fluid Active CPU 5h19m / 4h; Build Time 27h / 100h; Fast Data Transfer 3.6GB / 100GB; Fast Origin Transfer 2.88GB / 10GB; function invocations about 566K / 1M.
- The project-specific usage view also attributes 5h19m of Fluid Active CPU to this EMR project. Build CPU minutes and runtime CPU are different metrics; the runtime allowance finding does not imply build-time exhaustion.
- Automatic Preview activation is held pending resolution of the CPU allowance finding and data-scope verification. No upgrade or charge was initiated.
- Read-only aggregate verification: four workspaces, all four in the source-documented synthetic allowlist, zero outside it. No workspace synthetic-classification column exists; row-level synthetic-only status remains unproven. Database physical size was 263,842,963 bytes (~251.6 MiB), not a monthly billing metric.
- Preview invitation delivery is enabled and a recipient allowlist is configured. Provider key values and recipient addresses were not retrieved. The source permits real allowlisted staging email; no email was sent.
- Initial Supabase usage inspection required dashboard sign-in; the connected MCP confirmed Free without complete monthly counters. The signed-in follow-up below resolves the login dependency and records current usage and the previous-cycle grace warning.

## Local Implementation

- Updated AGENTS.md, release skill, three canonical policy/runbook files, start-here and RAG routing, and operations navigation.
- Marked old Git-integration snapshots as superseded; retained historical content and added a current-policy pointer to the old private-plan cost-control work item.
- No application or workflow code changed. No Vercel setting, environment, subscription, GitHub protection, DB row, migration, or policy changed. No merge or Production deployment occurred.
- Changes are isolated on `codex/public-cicd-policy`, based on `9002e19b83aef3c72333aac1af0336d90433ff32`. They are not yet merged into the shared main policy.

## Investigation Checkpoint Validation

- `npm run docs:check`: passed, 1,074 Markdown files.
- `npm run security:secrets`: passed, 4,916 tracked files including the new work item.
- `git diff --check`: passed.
- Targeted active-guidance audit removed private-plan/manual-only and unconditional reapproval requirements from entry points, canonical release docs, and the release skill. Historical instructions remain clearly marked as superseded.
- Manual decision review: no merge approval blocks; valid conditional scope approval proceeds after gates; explicit human-review condition remains required; SHA-pinned changed candidate blocks; routine in-scope corrections refresh checks; material scope/cost/data changes require clarification; failed checks never permit bypass.
- Primary checkout tracked-WIP diff SHA-256 remained unchanged before/after. Its status-list hash changed during the task; the original checkout was never edited by this task. All prepared changes are confined to the isolated worktree.
- No commit, push, or PR was created for this policy change.
- App tests/build not rerun: documentation-only local change, no release attempted.

## Remaining Dependencies

- Automatic Preview remains disabled by the existing ignore command. The user authorized activation only after satisfactory data/cost checks; latest observed CPU usage is 5h15m / 4h. This is not proof of a charge, immediate suspension, or a required paid upgrade. Resolve and recheck usage before expanding automation. It does not prohibit an existing Ready Preview from satisfying the separate release gate when current runtime health and all other conditions pass.
- Supabase monthly egress/storage/auth usage is now verified through the signed-in Chrome dashboard; see the follow-up below. The earlier login dependency is resolved. A previous-cycle egress grace warning remains visible.
- Source-allowlisted workspace counts are verified, but row-level synthetic-only status is not certified. No real data inspection or provider side effect is authorized by enabling Preview.
- Resume activation only within the user's approved scope after resolving these findings; recheck live state rather than treating this snapshot as permanent.

## CPU Investigation — 2026-10-20 KST

At this investigation checkpoint, the user requested diagnosis and a free-plan feasibility assessment, with no paid upgrade, merge, or Production deployment. Inspection was read-only; automatic Preview remained unchanged. Later bounded delivery approval is recorded above; it does not retroactively change the actions or findings in this historical checkpoint.

### Observed Usage

- Refreshed Usage view, Sep 19 09:00–Oct 19 09:00 as displayed: runtime Fluid Active CPU **5h15m**. The earlier 08:00-window snapshot was 5h19m; these are different moving windows, not contradictory measurements.
- Last 7 Days, Oct 12 09:00–Oct 19 09:00 as displayed: **18m53s**, all attributed to this project. Approximately 94% of the displayed 30-day CPU therefore falls before this seven-day window. The chart shows multiple earlier high-use days; this is not evidence of a single ongoing runaway request.
- Recent Functions Observability, Last 12 hours: Production **497 invocations**, notifications **210 invocations / 11s CPU**, module rendering **148 / 2.96s**. Remaining routes use smaller amounts. Preview **2 invocations / 160ms CPU**, on `/reset-password`. Filters were read sequentially and refresh over time; do not treat their totals as an exactly synchronized comparison.
- In this recent sample, notifications account for roughly half the Production runtime CPU. The sample does **not** establish the route distribution of the previous 30 days.
- Hobby UI permits 12-hour function analysis; 24 hours requires Pro and longer retention requires Observability Plus. No upgrade or trial was started. Historical route-level attribution cannot be reconstructed from this available view.

### Source Evidence And Limits

- Source baseline `9002e19b83aef3c72333aac1af0336d90433ff32`, `src/shell/use-shell-notifications.ts`: authenticated Supabase sessions refresh the notification snapshot every 30 seconds.
- `src/lib/visible-refresh.ts` already pauses interval refresh while the document is hidden, refreshes on focus/visibility resume, and coalesces pending requests within a subscriber. It does not elect one shared polling leader across separate visible browser windows. A visible but idle window can keep polling.
- `src/features/notifications/server-notifications-route.ts` authenticates each read and loads workspace permission context before the notification query. Do not remove those security checks as a cost shortcut.
- This explains a recurring source of current request/CPU usage. It does not prove that polling alone caused the historical excess, nor that bots, failures, or one deployment were responsible. No application code, clinical data, or production behavior was changed.

### Free-Plan Assessment

- Automatic Git Preview is compatible with Hobby. Its builds consume build resources; requests to a running Preview also consume runtime resources. Existing Build Time was 27h/100h, separate from the runtime CPU excess.
- At the latest seven-day average, a simple 30-day extrapolation is about **81 minutes** of runtime CPU, below the four-hour allowance. This is a scenario, not a forecast or a verified capacity guarantee for extra Preview traffic.
- At this checkpoint activation was held because 30-day CPU exceeded the allowance and Supabase monthly usage plus Preview data boundaries were unresolved. The signed-in follow-up below resolves the monthly-usage evidence gap. CPU and data/provider conditions still hold activation; a paid upgrade is not established as necessary by these observations alone.
- A free-plan path is to close unused authenticated app windows, keep Preview access protection, avoid repetitive full browser checks on every push, and use the already prepared automatic CI checks. Confirm the rolling CPU total returns below the allowance and confirm Supabase usage before activating automatic Preview. Any code optimization should be a separately scoped change that preserves notification freshness and authorization.
- At this checkpoint Supabase organization usage required user sign-in. That dependency was subsequently resolved below. The MCP Free-plan confirmation and physical database size do not replace egress/storage/auth quota evidence.
- Official references: [Hobby plan and usage limits](https://vercel.com/docs/plans/hobby), [Function usage and pricing](https://vercel.com/docs/functions/usage-and-pricing), [Observability plans](https://vercel.com/docs/observability/observability-plus). Hobby is for personal non-commercial use; public repository visibility alone does not establish eligibility.

## Signed-In Supabase Follow-Up — 2026-10-20 KST

The user completed login and requested monthly usage verification and continued free-plan Preview assessment. The authenticated session was in Chrome; the in-app browser was still signed out. No credentials were read or copied. Only aggregate usage was inspected.

Current billing cycle shown: **05 Oct 2026–05 Nov 2026**, Free Plan:

| Resource | Used / allowance | Remaining |
| --- | --- | --- |
| Uncached egress | 0.904 / 5 GB (18%) | 4.096 GB |
| Cached egress | 0.092 / 5 GB (2%) | 4.908 GB |
| Database size | 0.279 / 0.5 GB (56%) | 0.221 GB |
| Storage size | 0.029 / 1 GB (3%) | 0.971 GB |
| Monthly active users | 5 / 50,000 | 49,995 |
| Realtime messages | 1,635 / 2,000,000 | 1,998,365 |
| Realtime concurrent peak connections | 12 / 200 | 188 |
| Edge Function invocations | 0 / 500,000 | 500,000 |

The summary's decimal-GB database size and the details panel's 266.04 MB display use different presentations. They are separate from the earlier physical-size SQL snapshot; do not describe them as one identical measurement. Usage can lag by an hour; MAU can lag by 24 hours.

- Previous billing cycle selection shows uncached egress **9.127 GB**, exceeding the 5 GB allowance by 4.127 GB. The selected previous-period view retains the current-cycle header, so no unverified prior date range is asserted.
- The account is in a grace period ending **24 Oct 2026** due to previous-cycle egress excess. The banner says restrictions can apply if the organization remains over quota; restricted requests may return 402. The current project was Healthy and current major usage counters are below quota.
- The [official Fair Use FAQ](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy) explains that a warning can remain after usage drops and that another excess may receive no new grace period. The banner alone is not proof that service will stop on 24 October, nor proof that an upgrade is required.
- Log ingestion is **0.914 / 1 GB (91%)**, marked **Upcoming**. Its UI says billing begins after the grace period at the start of 2027. Log query is 5.747 / 100 GB and also marked Upcoming, with enforcement beginning in 2027. Do not confuse these future-meter notices with a current invoice or current egress restriction.
- Supabase Free is presently feasible within the observed current usage, but extra Preview API reads share the same allowance and database. No new DB, clone, subscription, or side-effecting smoke was created.
- Vercel was refreshed in this follow-up and remains **5h15m / 4h** for the displayed 30-day CPU window. Thus the earlier conditional automatic Preview activation remains held. No new approval question is needed for the already authorized same-scope activation once its preconditions are satisfied; no activation is claimed now.
- No paid upgrade, merge, Production deployment, app-code edit, or remote configuration write occurred. The follow-up changes only this isolated work-item report.

## Policy Review And Delivery Preparation — 2026-10-20 KST

- Audited all 14 prepared documentation changes against automatic PR CI, reusable conditional approval, and the separate automatic Preview usage/data hold. No application, workflow, provider, or DB change is part of this policy PR.
- Updated the current authorization record after the user's bounded advance approval. Preserved initial no-merge investigation instructions as historical evidence and retained candidate/checks/Preview/smoke/rollback gates.
- Removed misleading data-isolation wording from the environment table and clarified that an automatic Preview activation hold does not itself block a separately verified release with a Ready Preview. Rollback and correction instructions reuse existing authority only when it covers that operation.
- Local documentation check passed for 1,074 Markdown files; secret scan passed for 4,916 tracked files; working-tree and staged `git diff --check` passed. Targeted stale-guidance audit found no active private/manual-only release rule or unconditional duplicate approval gate.
- The policy-review worker did not commit, push, open a PR, merge, change remote configuration, or touch the primary checkout. Final candidate and remote release evidence remain the parent release task's responsibility. App-only local checks were not rerun for this documentation slice; the required automatic PR Release Check still runs its full combined job before merge.
