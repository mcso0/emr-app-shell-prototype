---
id: "PRODUCT-SERVICE-OWNER-OS-WORK-PACKET-EXAMPLES"
status: "approved"
area: "product"
doc_type: "service"
related_work:
  - DEN-422
---

# Owner OS Work Packet Examples

These examples are fixtures for `scripts/validate-owner-os-packets.mjs`.

## Good Example

```owner_os_work_packet
id: "OWNER-OS-PACKET-20260605-1"
title: "Add work packet template and validator"
intent: "Create the reusable Owner OS work packet contract and required-field validation path."
request_source: "Linear DEN-422"
task_type: "docs"
scope_level: "local-first"
autonomy_level: "local_edit"
ambiguity_policy: "draft_packet"
allowed_changes:
  - "docs/_meta/templates/owner-os-work-packet.md"
  - "docs/product/service/owner-os-work-packet-examples.md"
  - "scripts/validate-owner-os-packets.mjs"
  - "package.json"
out_of_scope:
  - "OpenAI API calls"
  - "Automatic multi-agent dispatch"
  - "Remote Supabase"
  - "Production deploy"
required_sources:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/service/clair-owner-os-product-plan.md"
trusted_inputs:
  - "Repo source docs"
  - "Active Linear issue"
  - "Local verification output"
untrusted_inputs:
  - "Screenshots"
  - "External posts"
approval_gates:
  - "none"
verification:
  - "npm run owner-os:packet:check"
  - "npm run docs:check"
done_criteria:
  - "Template includes required model, eval, trace, and safety fields"
  - "Validator catches missing required fields"
failure_criteria:
  - "Required packet field is missing"
  - "Validator accepts the bad example"
  - "Docs check fails"
eval_contract:
  method: "deterministic"
  scenarios:
    - "template_has_required_fields"
    - "good_example_passes"
    - "bad_example_fails"
  sample_count: 3
  pass_threshold: "3/3 deterministic checks pass"
  judge_rubric:
    - "Not used for deterministic template validation"
  calibration_examples:
    - "Good example passes"
    - "Bad example fails"
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
    - "formatting failure"
  retry_forbidden_for:
    - "approval-gated action"
    - "scope ambiguity"
token_budget:
  depth_level: "L3"
  max_context_sources: 3
parent_model:
  policy: "tiered_by_depth_and_risk"
  selected_tier: "standard"
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
  trigger: "none"
  cost_rationale: "The relevant files are already known, so subagents would add overhead."
  parent_decision: "Parent Codex implements and verifies directly."
result_review:
  language: "Korean"
  include:
    - "plain-language summary"
    - "changed files"
    - "status"
    - "verification"
    - "risk and next step"
handoff_summary: "DEN-422 defines the Owner OS packet template and required-field validation path."
```

## Bad Example

This packet is intentionally incomplete. The validator must reject it.

```owner_os_work_packet
id: "OWNER-OS-PACKET-BAD-1"
title: "Incomplete packet"
intent: "Show a packet with missing fields."
task_type: "docs"
allowed_changes:
  - "docs/example.md"
verification:
  - "npm run docs:check"
```
