# Safety OS Intake Gate

Use this reference after the skill triggers and before any full review.

## Purpose

The intake gate prevents token waste and accidental overreach. It classifies the current work, proposes the smallest useful review set, and waits for 승욱's approval.

## Intake Inputs

Use the smallest available set:

- Latest user request and thread context.
- `git status --short`.
- `git diff --stat` when the working tree matters.
- Active Linear issue or repo work item when known.
- Startup docs already required by the repo contract.

Avoid during intake:

- Full checklist reference loading.
- Broad source-doc reads.
- Test/build runs unless the user already requested verification.
- File edits.

## Classification

Classify the work into one or more buckets:

- `docs/work`: planning, source docs, work items, Linear handoff.
- `code-quality`: lint, typecheck, build, dependency, React/Next.js structure.
- `security-db`: secrets, auth, permission, Supabase, RLS, migration, data integrity.
- `runtime-ux`: loading, empty, error, duplicate submit, unsaved changes.
- `design-system`: tokens, shared primitives, shadcn/EMR component consistency.
- `design-pattern`: navigation, list/detail, forms, tables, filters, status, permission UX.
- `qa`: tests, regression, scenario replay, browser verification.

## Briefing Rules

- Keep the brief short.
- Explain why each check is relevant.
- Say what will not be done before approval.
- If the current work is ambiguous, propose a default and ask for confirmation.

## Approval Handling

- `승인`, `진행해`: run the proposed review.
- `리젝`, `중단`: stop without review.
- Scoped approval: run only the named bucket.
- Exclusions such as `DB 제외`, `Supabase 제외`, or `디자인만`: honor exactly.

If approval would enter a repo-level approval gate, ask again with the gated operation named.
