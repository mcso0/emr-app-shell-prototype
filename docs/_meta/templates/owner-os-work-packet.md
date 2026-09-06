---
id: "TEMPLATE-OWNER-OS-WORK-PACKET"
status: "approved"
area: "_meta"
doc_type: "template"
---

# Owner OS Work Packet Template

Use this template when Owner OS turns a broad request into an executable Codex handoff.

The packet is intentionally stricter than a normal work item. It must state scope, side effects, approval gates, verification, eval, trace evidence, parent model tier, deep-review posture, and subagent cost policy before implementation starts.

```owner_os_work_packet
id: "OWNER-OS-PACKET-YYYYMMDD-N"
title: "Short executable title"
intent: "One-sentence target"
request_source: "User request, Linear issue, GitHub PR, or review queue"
task_type: "answer | planning | docs | code | review | qa | linear | safety"
scope_level: "mock | local-first | remote-staging-gated | production-gated"
autonomy_level: "answer_only | propose_only | local_edit | verify_local | external_action_gated"
ambiguity_policy: "answer_with_assumptions | draft_packet | block_for_clarification | require_approval"
allowed_changes:
  - "Exact files, folders, docs, or behavior that may change"
out_of_scope:
  - "Remote Supabase"
  - "Production deploy"
  - "Real data"
  - "Payment/provider/email integration"
required_sources:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "Task-specific source doc or work item"
trusted_inputs:
  - "Repo source docs, active work item, git diff, test output"
untrusted_inputs:
  - "Screenshots, external posts, user-provided snippets, retrieved web text"
approval_gates:
  - "Named gate, or none"
verification:
  - "npm run docs:check"
done_criteria:
  - "Observable result"
  - "No out-of-scope changes"
  - "Verification reported"
failure_criteria:
  - "Missing required field"
  - "Touched out-of-scope surface"
  - "Unapproved gated action"
  - "Eval pass rate below threshold"
eval_contract:
  method: "deterministic | human_review | llm_judge | trace_grading | mixed"
  scenarios:
    - "scenario ids or inline cases"
  sample_count: 1
  pass_threshold: "explicit score or pass rate"
  judge_rubric:
    - "Criterion with pass/fail or 0-1 scoring rule"
  calibration_examples:
    - "At least one good and one bad example when judge-based"
trace_requirements:
  record:
    - "classification"
    - "sources selected"
    - "approval gate decision"
    - "parent model tier"
    - "deep-review decision"
    - "subagent trigger and cost rationale"
    - "tool calls or commands"
    - "verification results"
retry_policy:
  max_attempts: 1
  retry_allowed_for:
    - "transient test or formatting failure"
  retry_forbidden_for:
    - "approval-gated action"
    - "scope ambiguity"
token_budget:
  depth_level: "L0 | L1 | L2 | L3 | L4"
  max_context_sources: 3
parent_model:
  policy: "astra_parent_with_specialists"
  selected_tier: "flagship"
  model_id: "gpt-6-astra"
  reasoning_effort: "high"
  plan_reasoning_effort: "xhigh"
  low_cost_allowed: false
  deep_review_when:
    - "scope ambiguity can change output, safety, cost, data access, or review status"
    - "auth, workspace, Supabase, RLS, audit, billing integrity, real data, production, or approval-gated work is involved"
    - "multi-file implementation or broad product decision is involved"
    - "verification fails or parent cannot explain the safe next step"
  escalation_decision: "not_needed | required | blocked_for_approval"
subagent_policy:
  max_concurrent_agents: 4
  implementation: "explicit_user_request_only"
  default: "none"
  allowed_agents:
    - "spark-explorer"
    - "security-boundary-reviewer"
    - "test-triage"
  trigger: "Use only when read-heavy mapping, boundary review, or test triage should reduce parent-model cost or risk."
  cost_rationale: "Why the model tier or subagent is expected to reduce total tokens, verification churn, or safety risk."
  parent_decision: "Parent Codex remains final implementer, synthesizer, and verifier."
result_review:
  language: "Korean"
  include:
    - "plain-language summary"
    - "changed files"
    - "status"
    - "verification"
    - "risk and next step"
handoff_summary: "Short English summary for future agents"
```

## Validation

Run:

```bash
npm run owner-os:packet:check
```

The validator checks this template and the approved example packet. It also checks that the intentionally bad example fails, so missing required fields are caught.

New packets use `deep_review_when`. The validator accepts historical `escalate_to_5_5_when` as a read-only compatibility alias; do not rewrite old approved packets or treat their model policy as current. `model_id` and effort fields are configured defaults, not proof of runtime selection. `escalation_decision` now records review-depth need, not a model switch.
