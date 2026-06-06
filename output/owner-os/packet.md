# Owner OS Packet Draft

Request: Create Owner OS packet

```owner_os_work_packet
id: "OWNER-OS-PACKET-YYYYMMDD-N"
title: "Create Owner OS packet"
intent: "Create Owner OS packet"
request_source: "User request, Linear issue, GitHub PR, or review queue"
task_type: "answer"
scope_level: "mock | local-first | remote-staging-gated | production-gated"
autonomy_level: "answer_only"
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
    - "5.5 escalation decision"
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
  policy: "tiered_by_depth_and_risk"
  selected_tier: "low_cost"
  low_cost_allowed: true
  escalate_to_5_5_when:
    - "scope ambiguity can change output, safety, cost, data access, or review status"
    - "auth, workspace, Supabase, RLS, audit, billing integrity, real data, production, or approval-gated work is involved"
    - "multi-file implementation or broad product decision is involved"
    - "verification fails or parent cannot explain the safe next step"
  escalation_decision: "not_needed"
subagent_policy:
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
