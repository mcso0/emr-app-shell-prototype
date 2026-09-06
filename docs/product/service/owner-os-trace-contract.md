---
id: "PRODUCT-SERVICE-OWNER-OS-TRACE-CONTRACT"
status: "approved"
area: "product"
doc_type: "service"
related_work:
  - DEN-424
  - DEN-426
  - DEN-428
---

# Owner OS Trace Contract

Owner OS traces are compact evidence records for debugging agent behavior. They are not full transcripts.

## Required Fields

```json
{
  "trace_id": "owner-os-trace-YYYYMMDD-N",
  "packet_id": "OWNER-OS-PACKET-YYYYMMDD-N",
  "issue_id": "DEN-000",
  "request_summary": "Short summary of the user request",
  "classification": {
    "task_type": "answer | planning | docs | code | review | qa | linear | safety",
    "depth_level": "L0 | L1 | L2 | L3 | L4",
    "autonomy_level": "answer_only | propose_only | local_edit | verify_local | external_action_gated"
  },
  "context": {
    "sources_selected": [],
    "sources_skipped": [],
    "max_context_sources": 3
  },
  "model": {
    "parent_model_tier": "flagship",
    "configured_model_id": "gpt-6-astra",
    "configured_reasoning_effort": "high",
    "runtime_selection_verified": false,
    "requires_deep_review": false,
    "escalation_reason": "none"
  },
  "subagents": {
    "used": [],
    "recommended": [],
    "max_concurrent_agents": 4,
    "trigger": "none",
    "cost_rationale": "none",
    "summaries_used": []
  },
  "approval_gates": {
    "status": "none | stopped | approved",
    "named_gates": [],
    "approval_evidence": "none"
  },
  "tool_calls": [],
  "verification": {
    "commands": [],
    "passed": [],
    "failed": []
  },
  "result": {
    "status": "draft | implemented | human_review | blocked",
    "summary": "Short result",
    "handoff": "Short English handoff"
  }
}
```

## Do Not Store

- Real patient, guardian, hospital, staff, payment, or identity data.
- Secrets, API keys, tokens, cookies, or environment variable values.
- Full chat transcripts when a compact summary is enough.
- Remote Supabase, production, provider, payment, or email evidence unless explicitly approved and redacted.

## Packet Link Rule

Each trace must reference one packet ID or state why no packet was required. Any L3 or L4 work without a packet is a trace failure unless it was an emergency user-approved direct edit.

## Eval Link Rule

The eval runner may grade traces on:

- correct classification
- context minimality
- approval gate stop
- parent model tier and deep-review decision
- subagent trigger and cost rationale
- verification evidence
- result review completeness

## Migration And Evidence

New artifacts use `requires_deep_review` rather than the model-specific `escalate_to_5_5`. Historical traces remain unchanged and are not fresh runtime evidence. Configured model/effort fields describe defaults; set `runtime_selection_verified` only from actual dispatch evidence. A CLI draft lists recommended agents separately and leaves `used` empty until an agent really runs.
