# Result Review Rules

Use this document when deciding whether the requested outcome is complete and how much to report. Reply in concise Korean unless asked otherwise; supporting agent handoffs use concise English.

## Completion By Request

| Request | Complete when |
| --- | --- |
| Investigation or proposal | Current evidence, findings, recommendation, and relevant uncertainty are reported. Do not create files solely for the report. |
| Local implementation | Requested behavior works, relevant checks are complete, failures caused by the change are fixed, and affected contracts/status docs are updated. |
| Read-only review | Actionable findings include evidence and impact, with verification limits stated. Review itself does not authorize fixes. |
| Release preparation | Candidate/scope, verification, smoke plan, rollback, and remaining approval are concrete and reviewable. |
| Authorized delivery | The approved delivery workflow and actual outcome are verified under its release gates; report partial or blocked stages truthfully. |

Do not stop at a first implementation while authorized verification or corrections remain. Once required checks pass, broaden or repeat only for new changes, failures, or unresolved concerns. A concrete blocker permits a handoff, not an unsupported completion claim.

`Human Review` means implementation and applicable verification are ready for human acceptance. Continue other work already authorized in the same objective; only change an external status when authorized. Mark `Done` only when 승욱 accepts or asks.

## Concise Result

Lead with what changed, why it matters, and the current state. Include relevant files, verification, and limitations without repeating the same result in multiple sections. Distinguish local implementation, remote delivery, and human acceptance.

Mention a failed or unavailable check, material residual risk, or existing WIP when it affects the result. Link evidence rather than copying long logs. Include a next step only when one is useful.

## Record Depth

Use `docs/_meta/documentation-depth-rules.md` for the owning record:

- Tiny one-off changes: final response only.
- Behavior/contract/durable-guidance changes: update the owning source doc and work item when applicable. Do not create another report solely to repeat them.
- Create a Korean HTML report when the user or active work item explicitly requires it, or a substantial multi-part result/decision needs a separate visual review artifact. Merely having a Linear issue is not sufficient.
- Read-only consultation and review remain in chat unless a durable artifact is requested or required by the active work item.

When warranted, use `docs/completed/<area>/YYYY-MM-DD-<issue-or-slug>-report.html`. Keep it decision-oriented: requested outcome, changes, verification, material risks, and unresolved decisions. Add it to Linear or another external service only within the authorized sharing/update scope; otherwise provide the local link.
