# Owner OS Work Packets

Read only when drafting a packet or validating Owner OS routing/schema behavior. Ordinary fixes and reviews do not need this format.

Use the canonical `docs/_meta/templates/owner-os-work-packet.md` and the active work item's scope. Read `docs/product/service/clair-owner-os-product-plan.md` only for product/trace/eval semantics. Avoid a second copy of the schema in this skill.

## Routing Vocabulary

- Task type: `answer`, `planning`, `docs`, `code`, `review`, `qa`, `linear`, or `safety`.
- Depth: `L0` direct answer; `L1` brief routing; `L2` packet; `L3` implementation; `L4` relevant deeper review. Escalate only when the result needs it.
- Autonomy: `answer_only`, `propose_only`, `local_edit`, `verify_local`, or `external_action_gated`. A label describes scope; it grants no permission.

## Draft

Record the observable result, allowed changes, exclusions, necessary sources, verification, completion and failure criteria, and any remaining approval. Carry forward valid approval for the same operation/target/scope. Record actual model/effort only when known; template/helper examples are not runtime model-selection instructions.

Use eval/trace details when the requested packet contract requires them. The user should be reviewing a concrete scope and outcome, not a scorecard attached to every small task.

## Verification

For schema/helper changes, use the focused Owner OS packet/eval checks required by the work item. These validate local artifacts and deterministic helper output, not live-model behavior.

For instruction changes, examine representative requests: an explanation, a clear local fix, an ordinary read-only review, an explicit Safety OS intake, release preparation, authorized delivery, and a material scope change. Check the proposed next action and evidence rather than matching headings or exact prose. Use independent read-only forward testing when the risk warrants it.
