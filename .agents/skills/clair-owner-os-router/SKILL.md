---
name: clair-owner-os-router
description: Use for CLAiR Owner OS routing requests, especially when 승욱 asks to turn a broad request into an AI work packet, reduce token waste, choose the safest next Codex action, classify work before implementation, create an intake brief, decide whether to answer/propose/edit/verify/escalate, or apply the Owner OS no-gray-zone/eval/trace contract. This skill routes first and does not perform full implementation by default.
---

# CLAiR Owner OS Router

Use this skill to turn 승욱's broad direction into the safest next Owner OS action before Codex spends tokens or edits files.

## Core Rule

Route first. Do not jump directly into implementation unless the request is already scoped, low-risk, and clearly inside an active issue.

The router decides:

- task type
- depth level
- autonomy level
- approval-gate posture
- required source docs
- model and subagent cost posture
- output shape
- whether to answer, ask, draft a packet, or start work

## Required Startup

Read only the smallest useful set:

1. Current user request and thread context.
2. `docs/agent-start-here.md` and `docs/engineering/current-status.md` if not already read in the session.
3. `docs/product/service/clair-owner-os-product-plan.md` for Owner OS behavior.
4. Active Linear issue or `docs/work/` item when known.
5. `docs/_meta/agent-rag-map.md` only when choosing task-specific source docs.

Do not read archive, completed, long history, or unrelated work items during routing.

## Classification

Set one task type:

- `answer`: explain or answer without changing state
- `planning`: shape a direction or implementation sequence
- `docs`: create or update durable docs
- `code`: implementation in repo files
- `review`: inspect work and report findings
- `qa`: run or design verification
- `linear`: create/update project, issue, milestone, status, or comment
- `safety`: run Owner Safety OS intake

If multiple types apply, pick the highest-risk controlling type and mention the secondary type.

## Depth Levels

Use progressive disclosure:

| Level | Use when | Context cap | Default output |
| --- | --- | --- | --- |
| L0 | Simple answer | current thread | short Korean answer |
| L1 | Need routing or safety posture | startup docs + local status if relevant | intake brief |
| L2 | Need plan or packet | 1-3 task-specific docs | work packet draft |
| L3 | Need local docs/code edit | active issue + touched files | scoped implementation |
| L4 | Security, DB, release, broad QA | approved checklist + source docs | review report |

Escalate depth only when the current depth cannot produce a safe answer.

## Autonomy Levels

Choose one:

- `answer_only`: no files, no tools beyond reading if needed
- `propose_only`: draft plan or packet, no mutation
- `local_edit`: edit repo files inside scope
- `verify_local`: run local verification commands
- `external_action_gated`: requires explicit 승욱 approval before high-cost, security-sensitive, real-data, destructive, external-publication, or real-user-launch mutation

Linear creation/update, GitHub write actions, scoped synthetic/demo remote services, and production-demo deployment preparation may proceed when the user or active Linear/work item explicitly scopes them. Treat actions as approval-gated when they can create meaningful cost, expose secrets, weaken security, publish private assets, use real data, perform destructive remote data changes, send real external communications/payments/provider side effects, or launch to real external users.

## Parent Model And Subagent Cost Policy

Use a tiered parent-model policy.

- Lower-cost parent models may handle L0 direct answers, L1 status/intake, and obvious small local edits with narrow verification.
- Escalate the parent to 5.5 when ambiguity can change output, safety, cost, data access, or review status.
- Use 5.5 for auth, workspace, Supabase, RLS, audit, billing integrity, real data, provider, payment, production, broad product decisions, multi-file implementation, failed verification, or approval-gated scope.

Use `$codex-agent-router` only when a bounded read-only subagent is likely to reduce parent-model cost, verification churn, or safety risk:

- Broad repo or document mapping: use `spark-explorer` read-only, then synthesize in the parent thread at the needed model tier.
- Auth, workspace, Supabase, RLS, audit, billing integrity, real data, provider, payment, or production risk: use `security-boundary-reviewer` read-only when the boundary risk is material.
- Failing logs, CI, regression choice, or flaky behavior: use `test-triage`, then let the parent choose the next command or fix; escalate to 5.5 when the failure affects safety, data boundaries, or architecture.

Do not use subagents for simple answers, obvious small edits, or work where the subagent summary would cost more than the parent reading the target file directly.

Subagent summaries are evidence, not authority. The parent thread must record the parent model tier, 5.5 escalation decision, trigger, cost rationale, summary used, and final parent decision.

## Approval Gates

Stop before:

- meaningful cost or paid external-service usage
- secret, credential, auth, private repo visibility, or security-boundary exposure
- real hospital, staff, guardian, patient, billing, identity, or payment data
- destructive or hard-to-rollback remote data changes
- real email, KakaoTalk, SMS, PACS, device, accounting, payment, or provider side effects
- public launch, real external-user access, or private repo/open-source publication
- canonical role or permission policy changes
- broad UI direction changes outside the active scope

Scoped synthetic/demo-data Supabase validation, migration/RLS, server/API hardening, and production-demo deployment preparation are allowed when the active issue or work item explicitly includes them.

If a gated action is required for correctness, do not suggest a weaker workaround. Explain the gate and ask 승욱 for explicit approval naming target environment, operation, verification, and stop condition.

## Output Decision

Use this routing table:

| Situation | Output |
| --- | --- |
| Safe factual answer | L0 short answer |
| Scope unclear but low-risk | L1 intake brief with assumptions |
| Work is implementable but not yet scoped | L2 work packet draft |
| User approved scoped local work | L3 implementation |
| User asks safety review | Hand off to `$emr-owner-safety-os` intake |
| User asks Linear placement/issues/status | Use `$manual-linear-ops` after this routing |
| Request is approval-gated | Stop and ask approval |
| Request is ambiguous and affects safety/cost/state | Ask a concise clarification |

## Intake Brief Format

Reply in Korean:

```text
승욱, 이 요청은 <task_type> / <depth_level>로 보는 게 맞아.

판단:
- 목표: <observable outcome>
- 자율성: <autonomy_level>
- 필요한 문서: <source docs, max 3 unless justified>
- 승인 게이트: <none or named gate>
- 추천 출력: <answer | packet | implementation | review>

다음 액션:
<one concise action>
```

## Work Packet Draft Format

Use this compact packet shape:

```yaml
title: ""
intent: ""
task_type: ""
depth_level: ""
autonomy_level: ""
ambiguity_policy: ""
allowed_changes: []
forbidden_changes: []
required_sources: []
approval_gates: []
verification: []
done_criteria: []
failure_criteria: []
eval_contract:
  method: ""
  scenarios: []
  pass_threshold: ""
trace_requirements: []
subagent_policy:
  parent_model_policy: "tiered_by_depth_and_risk"
  low_cost_parent_allowed_for: []
  escalate_parent_to_5_5_when: []
  default: "none"
  allowed_agents: []
  trigger: ""
  cost_rationale: ""
  parent_decision: ""
result_review: "Korean, concise, decision-oriented"
```

## Scenario Dry-Run Checks

When validating this skill, use at least these scenarios:

1. `루멘, 이 요청을 작업 패킷으로 만들어줘.`
2. `이거 바로 구현해줘.` with unclear scope.
3. `실제 비용/secret/real data가 걸린 production 작업 해줘.`
4. `안전 점검 게이트 열어줘.`
5. `리니어 프로젝트랑 이슈로 쪼개줘.`

Expected behavior:

- Scenario 1 produces a packet draft.
- Scenario 2 asks for scope or creates a packet before editing.
- Scenario 3 stops for explicit approval.
- Scenario 4 routes to `$emr-owner-safety-os`.
- Scenario 5 routes through `$manual-linear-ops` and reads Linear before mutation.

## Relationship To Nearby Skills

- Use `$emr-owner-safety-os` for safety-review intake and approved review checklists.
- Use `$manual-linear-ops` for Linear project, milestone, issue, status, Human Review, Rework, and Done handling.
- Use `$codex-agent-router` when 승욱 specifically asks to choose or coordinate custom subagents, or when bounded read-only delegation is likely to reduce parent-model cost or catch boundary/test risk.

This skill is the front door for Owner OS routing, packet drafting, and token-depth decisions.
