# Safe Fix Rules

Use only after 승욱 asks to apply Safe fixes or explicitly approves a scoped fix pass.

## Safe Fix Definition

A Safe fix:

- is already identified in the approved review
- does not change product behavior
- does not widen scope
- does not touch approval-gated systems
- does not require a product, security, DB, or design decision
- has a clear verification path

## Not Safe Without New Approval

- DB schema, migration, RLS, remote Supabase, or live data changes.
- Role/permission policy changes.
- Production deploy or external provider integration.
- Broad visual direction changes.
- Replacing a library or adding a dependency.
- Deleting tests or weakening assertions.
- Changing clinical/billing workflow semantics.

## Execution

1. Restate the approved safe-fix scope.
2. Edit only the files needed for those fixes.
3. Preserve existing user changes.
4. Run the narrowest useful verification.
5. Report changed files, verification, and anything intentionally left for human decision.
