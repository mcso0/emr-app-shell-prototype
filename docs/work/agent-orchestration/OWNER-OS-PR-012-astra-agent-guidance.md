---
id: "OWNER-OS-PR-012"
title: "Align agent guidance and Owner OS contracts with Astra"
status: "human_review"
area: "agent-orchestration"
priority: "P1"
target_pr: "User request / Astra migration"
source_docs:
  - "AGENTS.md"
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/service/clair-owner-os-product-plan.md"
owner: "Codex"
---

# OWNER-OS-PR-012: Astra Agent Guidance

## Goal

Align local agent configuration, operating guidance, and Owner OS artifacts with the user's approved Astra workflow.

## Accepted Decisions

- Apply minimal global AGENTS changes as well as project changes.
- Parent and security review: `gpt-6-astra` / `high`; Plan mode: `xhigh`.
- Preserve Spark / `low` exploration; use GPT-5.6 Luna / `medium` for test triage. This approved follow-up replaces the original GPT-5.4-mini choice after checking its ChatGPT sign-in retirement.
- Allow independent read-only delegation without repeated approval, with at most four spawned agents open concurrently across the task tree, excluding the parent. Use the smallest useful count; four is an initial operating limit, not a measured optimum.
- Parallel implementation requires an explicit user request and disjoint ownership.
- Preserve authorization scope, production release gates, real-data restrictions, and security boundaries.

## Scope

- Remove stale model escalation instructions and align packet, trace, scenario, and CLI fields.
- Distinguish ordinary requested review from explicit Safety OS intake.
- Clarify authorization persistence, material questions, verification completion, and report depth.
- Shorten startup status by moving detailed evidence intact into a linked snapshot.
- Verify configuration persistence constraints and describe restart/runtime limitations honestly.
- User-approved delivery follow-up: isolate this slice, commit, push, open a PR to `main`, and complete the current exact-candidate merge gate. Preserve unrelated primary-checkout WIP and the latest upstream release policy.

## Out Of Scope

- Product, database, migrations, UI, remote data services, paid API calls, manual deployment, or deployment-setting changes. Repository delivery is limited to this slice; a `main` merge follows the active Production gate.
- Unrelated WIP, old completed records, historical model-specific review approvals, installed plugin code, or global security settings.

## Verification

- Focused Owner OS tests for new output, legacy packet compatibility, and review/gate routing.
- `npm run owner-os:packet:check` and `npm run owner-os:eval`, stating exactly what each validates.
- `npm run docs:check`, changed-skill frontmatter validation, TOML parsing, and scoped `git diff --check`.
- Independent read-only review; preserve existing WIP fingerprints and separate disk configuration from already-running task settings.

## Status

Local implementation and isolated-candidate verification completed. User approved repository delivery; the PR candidate preserves the latest `origin/main` release policy. Its exact remote Release Check, Preview, and Production approval packet are required before merge.


## Implementation And Evidence

- Project default and security reviewer use Astra high; Plan stays xhigh and Spark stays low. Test triage now uses GPT-5.6 Luna medium.
- The official spawned-thread limit (`agents.max_threads`) is four, excluding the parent. The desktop V2 slot setting is five because this runtime describes its slots as including the parent. The pre-existing LazyCodex V2-disable workaround is preserved; no launcher, app restart, or plugin change was performed. Already-running tasks may retain old settings, and startup rewrite behavior was not verified.
- Global AGENTS received only wording/autonomy clarification. Global model, service tier, sandbox, and approval configuration were not changed.
- Ordinary review now proceeds read-only; explicit Safety OS intake still waits for scope selection. Release approval remains tied to operation, target, source, and scope.
- New packets/traces use model-neutral deep-review fields and separate model ID/effort. The validator still reads historical packet field names; historical records are not rewritten. CLI recommendations do not claim actual agent execution or runtime model selection.
- The local routing helper now respects read-only explanation/review and release preparation. It is advisory, cannot know all prior approvals, and grants no permissions.
- Startup status reduced from 47,994 to 7,928 bytes. The entire original is retained byte-for-byte as the body of `docs/engineering/current-status-details.md`.

Verification:

- `node --test tests/owner-os-astra-routing.test.mjs`: 6/6 passed, including legacy packet acceptance, wrong-eval rejection, and read-only regressions.
- `owner-os:eval`: 15/15 actual local routing-helper comparisons passed. No live-model performance claim.
- `owner-os:packet:check`: 3/3 expected valid/invalid cases passed.
- Focused ESLint for the two changed scripts and regression test: passed.
- TOML parsing/value assertions and five changed skill frontmatter checks: passed.
- Scoped docs checker: 23 changed Markdown files passed; relative links also passed.
- Full `npm run docs:check`: failed solely on an existing ignored `_workspace/2026-08-01-002/summary.md` reference to missing docs/business/customer-discovery/persona-qa-skill-guide.html. No migration source was reported broken; unrelated workspace notes were not edited.
- Independent Astra boundary review: no remaining must-fix findings after read-only routing fixes. A regex-escaping finding was withdrawn after checking actual Node behavior.
- At the WIP verification checkpoint, 27 initial fingerprints matched (index compared after removing only this task's row); 12 OED artifact/script/test paths had changed independently. During final checks the OED work-index rows also changed independently. This task edited only the new OWNER-OS-PR-012 row and left those concurrent changes intact.

Read-only delegates: one configuration audit and one policy review. The parent made all edits and integrated verification. No parallel implementation was used.

## Review And Follow-Up

- [Korean result report](../../completed/agent-orchestration/2026-09-06-astra-agent-guidance-report.html)
- Fresh-task model/effort and slot-loading verification is complete; see the runtime evidence below. Plan-mode execution, saturation testing, and persistence across an app restart remain unverified.
- Review this local change before any commit or delivery. No app code, DB, external service, or production state was changed.

## Fresh-Task Runtime Verification

- Initial verification task `01a07541-29d5-7393-a908-d276a19baaef` ran Astra / high in Default mode and reported four slots including the parent. Treating this as the meaning of both config keys was incorrect: official documentation defines `agents.max_threads` as a legacy alias for the spawned-thread limit, excluding the parent.
- Kept `agents.max_threads = 4`; changed only `features.multi_agent_v2.max_concurrent_threads_per_session` from four to five and added comments explaining the different counting conventions.
- Fresh verification task `01a0754e-ba2c-7f30-a9ec-1c21f1c24893` was created in the current local checkout without model or effort overrides. Its session `turn_context` confirms `gpt-6-astra`, `high`, and `default`; its runtime reports five slots including the parent. At this initial checkpoint, before the Luna follow-up below, role definitions matched Astra/high, Spark/low, and GPT-5.4-mini/medium.
- The V2 enable flag remains false even though the desktop supplies the five-slot runtime. This observation does not establish internal configuration ownership, flag precedence, or enforced admission behavior. No agents were spawned for a saturation test.
- Plan `xhigh` is parsed and stored. Actual Plan-mode execution remains unverified: the computer-use tool denies access to the Codex app, so no UI mode change was made or bypass attempted.
- Follow-up validation: TOML syntax/value assertions, scoped whitespace, HTML parsing, and 32 local document links passed. The full docs checker was rerun and reports only the same pre-existing ignored workspace-note link described above. No product-code tests were rerun for this config/comment/report follow-up.

## Official Basis

- [Astra model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Configuration precedence](https://learn.chatgpt.com/docs/config-file/config-basic#configuration-precedence)

## Experimental Context Management Follow-Up

- User requested the opt-in shown in the attached screenshot after completing any remaining prior work. The preceding configuration and fresh-task loading checks are complete; corrected the stale follow-up line that still requested those checks. The recorded Plan/UI and saturation-test limits remain unchanged.
- Verified the exact setting against the official configuration reference and [experimental context management guidance](https://learn.chatgpt.com/docs/models#experimental-context-management). The installed Codex executable also contains the context-management configuration type and `experimental_mode` field; this establishes parser support, not runtime activation.
- Added `[features.context_management]` with `experimental_mode = true` to the local user's `~/.codex/config.toml`. No duplicate project override was added. A before/after TOML comparison confirms that this was the only parsed global setting changed; the project's Astra/high, Plan/xhigh, child limit four, and desktop slots five are preserved.
- This opt-in applies to eligible supported clients on new tasks. Official model guidance describes ChatGPT Plus/Pro sign-in and excludes Business, Enterprise, and API-key sign-in at launch; the configuration reference additionally lists Pro Lite. A read-only account lookup confirms Pro, but effective experimental-mode activation remains unverified.
- Fresh task `01a0755b-2475-78e0-a28d-f57aaaf350ad` exposed `get_context_remaining` and `new_context`; a context-budget query and one context transition succeeded. Its inspected `turn_context` did not contain an explicit experimental-mode activation field. No dedicated history-search execution/result was obtained, so do not infer either successful retrieval or confirmed absence/failure of a search tool.
- No long-context filling, repeated transitions, or cross-task-memory test was performed. Do not equate the saved flag or one transition with experimental-mode activation or persistent cross-task memory. To disable the opt-in, change only `experimental_mode` to false.

## Luna Test-Triage Follow-Up

- User approved replacing the retired ChatGPT-sign-in model after reviewing the remaining work. Updated `.codex/agents/test-triage.toml` to `gpt-5.6-luna`, retaining `medium` and its read-only/default-triage boundary; aligned the Owner OS router and this report. See [official model retirement guidance](https://learn.chatgpt.com/docs/models#deprecated-codex-models).
- Verification task `01a0755b-2475-78e0-a28d-f57aaaf350ad` confirmed its parent at Astra/high/Default. It dispatched exactly one test-triage agent without model or effort overrides while checking context capabilities.
- Child task `01a0755b-b4af-7561-95f0-5e7f4e896a9f` matched its task ID to `session_meta.payload.id` and confirmed `gpt-5.6-luna` / `medium` / `default` in its own latest `turn_context`. This establishes actual role execution, beyond the saved profile or role description.
- TOML value assertions, changed-skill YAML frontmatter, scoped whitespace, HTML parsing, and 32 local document links passed. The full docs checker still fails only on the existing ignored workspace-note link recorded above; no product-code tests were needed or rerun.
- The verification task reported unchanged project/role configuration hashes. Other shared-worktree state changed during its run, so no repository-wide unchanged-state claim is made. All implementation remained in the parent task; no commit, push, PR, app restart, or Plan transition was performed.

## Repository Delivery Candidate

- Isolated 31 approved files on `codex/astra-agent-guidance-release` from `origin/main` `c07a9d13a057771cbe6106f90d118b1ff227b57f`. Kept the dirty primary branch and unrelated clinical-master work in place. The work index receives only this issue's row.
- Three-way integration preserves the upstream staging retirement and direct PR-to-main Production gate. The independent reviewer found one stale active model name in the product plan; it is now aligned to Luna/medium. No remaining must-fix integration finding was reported.
- Clean-worktree checks passed: secret scan (4,018 tracked files), full docs check (975 Markdown files), six focused tests, three packet cases, 15 routing cases, focused ESLint, TOML values, five skill frontmatters, and byte-preservation of the original status snapshot. The dirty checkout's ignored workspace-note link is not part of this candidate.
- Product behavior, env files, remote data, and deployment settings are unchanged. Global AGENTS and the experimental context opt-in remain local, outside this repository's PR.
- The exact committed candidate, remote Release Check, Preview, current Production/rollback evidence, and merge approval are recorded in the PR/release handoff. Do not treat the earlier general delivery request as evidence that a later candidate's checks or Production gate passed.
