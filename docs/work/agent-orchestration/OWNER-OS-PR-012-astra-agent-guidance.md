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


## 2026-09-07: Skill And Instruction Simplification

승욱 approved the article-based proposal to simplify global/project skills, document loading, AGENTS guidance, authorization boundaries, and completion criteria. This follow-up is local guidance work and grants no product, remote-data, publication, or release authorization.

### Applied Decisions

- Global AGENTS owns personal language/autonomy defaults; repo AGENTS owns project data/workspace/release boundaries. Startup/RAG documents now route conditionally. Installed Next.js guidance applies to framework-dependent changes, not unrelated copy/styling.
- Preserve the user-selected parent model/effort, specialist configuration, sandbox/approval settings, and unrelated plugin settings.
- Complete authorized implementation, focused verification, and related failure fixes. Human Review records pending human acceptance and does not cancel other authorized work. Done still requires representative acceptance/request.
- Use HTML reports for explicit user/work-item requirements or substantial results/decisions needing a separate visual artifact; Linear membership alone is insufficient. Routine evidence stays in the owning docs/work item.
- Work items/packets record scope and approval evidence; they cannot authorize themselves. Reuse valid approval for unchanged operation/target/source/scope. External comments, attachments, and status updates need their applicable authorization.
- Align production/merge runbooks with approval reuse and authorized Linear updates. Preserve exact-candidate Release Check and release preflight/smoke/rollback gates. Correct the fixed-staging table to staging, consistent with its existing branch rule. Local results do not substitute for unavailable required CI.
- Docs-sync now uses canonical repo docs and the active internal /docs viewer. GitBook/SUMMARY remain legacy-only unless explicitly revived.
- Shorten repo discovery descriptions, remove routine subagent scorecards/mandatory reports, and narrow Owner OS routing to broad shaping/packets. Ordinary reviews do not gain an intake round. Translate review-animations' existing explicit-only intent from imported disable-model-invocation frontmatter into Codex agents/openai.yaml policy allow_implicit_invocation=false; other invocation policies remain unchanged.
- Split Emil/Apple technical guidance into task-selected references. Retain technical content, excluding only boundary blank-line normalization; remove the promotional opening and forced review table. Entrypoints preserve component-contract and accessibility boundaries.
- Retain global find-skills and remove the redundant repo copy. A project-only disable parsed but was not reflected by installed CLI skills/list with either documented path representation, so the ineffective override was removed. Project config is byte-for-byte restored to this follow-up's starting WIP.
- Preserve other plugins: configured entries do not prove current installation, usage, or redundant behavior. No bulk disable, cache edit, global skill relocation, or catalog-budget increase was applied.

### Verification

- Existing Owner OS routing/compatibility regressions: 6/6 passed, including their embedded deterministic routing evaluation. Packet cases: 3/3 passed. These checks do not prove live-model behavior.
- Skill YAML/UI metadata validated with Ruby YAML. The bundled Python quick validator could not start because system Python lacks PyYAML; no dependency was installed. CLI discovery reported zero skill errors.
- CLI 0.153.4 app-server skills/list verified one enabled global find-skills entry in both this repo and an outside directory. Only initialization/config-read/skill-list requests were sent; no model task was started. This does not prove the already-running desktop task refreshed its initial catalog/instructions.
- Technical reference contents match the originals apart from boundary blank lines. Final checks passed for 79 local Markdown references, scoped/task-only whitespace, TOML parsing, and 15 changed skill frontmatters (14 repo plus the retained global skill) with UI metadata. All 314 existing out-of-scope WIP files retained their starting hashes.
- Repo skill entrypoints reduced from 150,164 to 80,652 bytes (46.3%); discovery descriptions from 5,069 to 1,300 characters (74.4%); repo skills from 15 to 14. These measure entrypoint/catalog text, not model token savings or task-speed gains. Reference content remains available on demand.
- Full docs checker still reports the missing persona guide target from the old workspace summary and historical evidence in this work item. No unrelated file was repaired or failure hidden.
- Independent read-only forward review covered nine fictional requests: typo, ordinary review, explicit gate, release preparation, approved delivery, changed candidate, unapproved packet side effect, small Linear-linked fix, and inactive-GitBook docs sync. Five lower-level contradictions were corrected. Fresh review of cases 4-7 plus unavailable CI and delivery without Linear-update authorization found no remaining actionable contradiction. This validates instruction interpretation, not actual execution or benchmark performance.
- Existing out-of-scope WIP matched its starting fingerprints at the verification checkpoint. All edits were made by the parent; the independent reviewer was read-only.

### Sources And Recovery

- [Article discussed with the user](https://x.com/pvncher/status/2095991462416490862)
- [Official skills and progressive disclosure](https://learn.chatgpt.com/docs/build-skills)
- [Official AGENTS discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Official Astra initiative and verification guidance](https://developers.openai.com/api/docs/guides/latest-model)

A temporary pre-change snapshot holds per-file originals and hashes for incremental rollback over existing WIP. Compare those originals against current files and restore only this follow-up's edits; do not reset the checkout or replace newer work wholesale. Restore the repo find-skills file if a self-contained distribution later needs that optional discovery workflow.

Local implementation and focused validation are complete, with the existing full-docs-check failure and live desktop-refresh limitation disclosed. No commit, push, PR, production delivery, account permission change, or model/effort override was performed in this follow-up.


## 2026-09-07: Simplification Delivery Follow-up

The user approved the remaining broken-link repair, fresh-session verification, and commit/push/PR work. This authorizes this guidance slice through PR review, not a Production merge.

- Restored [the historical persona guide](../../business/customer-discovery/persona-qa-skill-guide.html) from the existing 2026-08-01 rewrite artifact. Added an archival notice and replaced links to the three absent persona sources with unavailable labels. This does not install persona-qa or establish current research evidence.
- A fresh ephemeral CLI 0.153.4 read-only task correctly quoted the new conditional startup, exact-scope approval reuse, ordinary-review/Safety OS distinction, and completion rules from already-loaded instructions. It made no tool calls. Existing optional MCP initialization failures did not prevent the response; desktop refresh and model behavior beyond these statements remain unverified.
- Isolated this slice from `origin/main` `22f40916` in `codex/guidance-progressive-disclosure`. Preserved the upstream PR-to-main release model and its retired-staging compatibility stub. Earlier staging-specific edits above describe the primary-checkout pass and are superseded by this delivery integration.
- Excluded unrelated clinical-master WIP and the separate uncommitted model-picker config change. The candidate does not modify project/global config or specialist profiles; its status text retains the actual upstream defaults. Global AGENTS/find-skills changes remain local and are not shipped by this PR.
- Primary full docs check passed (1,051 Markdown files). Isolated docs check passed (982 Markdown files); six routing tests and three packet cases passed. The changed HTML/local links and skill metadata are checked separately. No application code changed, so local app lint/typecheck/build are omitted; the remote Release Check supplies its normal combined gate before a future Production approval.
- The PR records the committed SHA, remote checks, and Preview outcome. Commit/PR completion must not be read as Production approval or deployment completion.
