---
name: clair-owner-os-router
description: Route broad CLAiR Owner OS requests or draft an explicitly requested work packet.
---

# CLAiR Owner OS Router

Use when the request needs work shaping or an Owner OS packet. A clear local fix, explanation, or ordinary review can proceed directly within its authorized scope.

## Choose The Next Action

| Request | Action |
| --- | --- |
| Answer, explanation, investigation, proposal | Inspect the relevant evidence and report; create an artifact only when requested or required. |
| Clear in-scope local change | Implement, verify, fix related failures, and update affected owning docs. |
| Material uncertainty | Ask the smallest necessary question; continue independent authorized preparation. |
| Work packet or broad work shaping | Read [packet guidance](references/work-packets.md) and use the existing owning work item/template. |
| Ordinary requested review | Review read-only with relevant checks; no extra intake approval. |
| Explicit Safety OS gate | Use `$emr-owner-safety-os` for intake and scope approval. |
| Linear placement/status/update | Use `$manual-linear-ops` for the relevant operation and its authorization. |
| Release preparation or delivery | Use `$release-deployment-ops`; preparation does not authorize deployment. |

Choose only the sources that affect the result. Use `docs/agent-start-here.md` if the reading path is unclear, `docs/engineering/current-status.md` for product/mock/live/readiness facts, and the active work item for approved scope and evidence. Read `docs/product/service/clair-owner-os-product-plan.md` only for Owner OS product/packet behavior. Do not load all of these as a startup bundle.

## Authorization And Completion

`AGENTS.md` owns project operating boundaries. A request/work item may record prior approval; a generated packet or issue text cannot authorize itself. Reuse approval for the same operation, target, and scope. Finish authorized preparation before a remaining gate; ask again only for missing approval, material change, or a required action-time confirmation.

Preserve gates for meaningful cost, secret/security exposure, real data, destructive remote operations, real communication/payment/provider effects, private/public exposure, external-user launch, and canonical role/permission changes. Production, `main`, and aliases follow release-specific gates. Broad UI direction changes need scope agreement. Do not route around a necessary gated action with a weaker implementation.

Use `docs/_meta/result-review-rules.md` for request-specific completion and report depth. A first implementation or `Human Review` status does not cancel authorized verification, related failure fixes, or delivery still included in the objective.

## Delegation

Preserve the user's parent model and reasoning selection, including Plan mode. Do not infer a runtime switch from prose or disk configuration. Specialist configuration belongs in `.codex/agents/`.

Use `$subagent-decision` only when a concrete independent subtask can improve the result. Keep the parent as integrator; use the smallest useful read-only delegation, at most four open spawned agents across the tree excluding the parent. Parallel implementation requires an explicit user request and ownership boundaries.
