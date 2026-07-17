# Decision Rules

Use these rules to classify components, tokens, conflicts, and approval boundaries consistently.

## Component ownership

Classify by verified ownership, not visual similarity alone.

### Shared component

Use when the same semantic control or pattern has multiple real consumers across features, a design-system contract already exists, or the project explicitly designates it as shared.

Report:

- current consumers and owner path;
- public props, variants, states, composition slots, and accessibility contract;
- backward-compatibility and migration impact;
- whether the Figma change should extend, replace, or leave the shared contract untouched.

Any shared API or behavior change requires an itemized approval gate.

### Feature component

Use when a component belongs to one product capability but is reused by multiple screens or flows within it. Put it under the owning feature rather than the global design system.

### Local component

Use when a component exists for one screen or one composition, has no stable semantic reuse case, or would force unrelated props into a shared API.

Local does not mean inline everything. Extract repeated or stateful subparts when it improves testing and clarity, but keep ownership local.

### Primitive

Use for low-level layout, typography, icon, surface, overlay, or interaction foundations. Prefer existing primitives and composition. Do not create a new primitive to avoid learning the current system.

## Component decision order

1. Reuse an existing component unchanged.
2. Compose existing primitives locally.
3. Add a compatible variant to an owning component.
4. Create a feature component.
5. Create a new shared component only with proven cross-feature demand.

If an existing component is visually close but semantically wrong, do not reuse it merely to reduce file count.

## Token mapping

Trace every important visual value through this order:

1. Figma variable or style.
2. Existing semantic project token.
3. Existing primitive token.
4. Feature-local semantic token.
5. New shared semantic token.
6. Literal value only when the design is intentionally one-off and the project permits it.

Report local CSS-variable or class overrides that shadow the owning token.

### Token action types

- `reuse`: exact semantic match; no token edit.
- `alias`: map Figma naming to an existing project token.
- `local-add`: add a feature-scoped token.
- `shared-add`: add a shared semantic token; approval required.
- `shared-change`: change an existing token; show all affected consumers and require approval.
- `literal-exception`: intentional one-off; record why a token would be misleading.

Do not change a global token merely to make one frame match.

## Conflict classes

Create a conflict record when Figma and the repository cannot both be honored without a decision.

- `visual`: size, spacing, typography, color, radius, effect, icon, or asset differs.
- `semantic`: visual pattern maps to a different component meaning or interaction role.
- `api`: Figma requires a state or composition the current component cannot express.
- `token`: Figma value conflicts with existing semantic or primitive token behavior.
- `responsive`: Figma provides one frame but project conventions imply different collapse or overflow behavior.
- `state`: required loading, empty, error, disabled, permission, or recovery behavior is missing or inconsistent.
- `accessibility`: exact visual treatment would violate keyboard, focus, semantics, contrast, reduced-motion, or target-size requirements.
- `motion`: explicit or inferred transition conflicts with project motion language or platform capability.
- `data`: the visual assumes fields, ordering, permissions, or persistence not supported by the current model.
- `dependency`: fidelity would require a new library or asset pipeline.

Each conflict must include at least two options when a real choice exists. Recommend one and explain the tradeoff, but leave the record `decision-needed` until the user chooses.

## Approval gates

Explicit, itemized approval is required before:

- editing application code after a report-only request;
- changing shared component props, variants, semantics, or behavior;
- changing an existing shared token or adding a global token;
- adding, replacing, or upgrading a dependency;
- changing an API, schema, server boundary, permission, RLS policy, or persistence behavior;
- broad migrations across unrelated consumers;
- writing to Figma;
- publishing, deploying, or exposing the report externally.

Approval is not required to create a read-only report, copy the bundled report scaffold into an artifact workspace, or generate clearly labeled motion proposals inside that report.

## Recommendation format

For every approval item, use:

```text
APR-### — concise decision title
Why: verified need
Recommended: preferred option
Alternatives: realistic options
Affected: components, tokens, routes, consumers, tests
Risk: regression or migration impact
Rollback: how to reverse it
Decision: decision-needed | approved | rejected
```
