# Coding Discipline

Use this file for non-trivial implementation work. Keep `AGENTS.md` compact and link here instead of duplicating these rules in the always-loaded repo contract.

## Think Before Coding

Use existing project conventions for routine choices. Surface assumptions and tradeoffs when they materially affect the result.

- State material assumptions when the request is ambiguous.
- If interpretations materially change scope, behavior, data access, cost, or safety, present them before dependent implementation.
- If a simpler approach solves the same problem, say so and prefer it.
- Ask only about material ambiguity; continue independent, already-authorized work while awaiting an answer.

## Simplicity First

Use the minimum code that solves the requested problem.

- Do not add speculative features, abstractions, configurability, or future-proofing.
- Do not add broad handling for impossible or unsupported scenarios.
- Prefer a smaller direct implementation when it solves the same task.

## Complexity Budget

Before adding code, dependencies, or abstractions, choose the smallest option that fits the existing project boundaries.

- Check native platform features, Next.js/Supabase capabilities, and existing dependencies before adding a new dependency.
- Do not add an abstraction unless there is a second real caller or implementation.
- Prefer a small change in an existing module over a new file, framework-level pattern, or cross-cutting helper.
- Do not implement speculative "later" flexibility; leave the upgrade trigger in a work item or concise comment only when it is known.
- Never simplify away trust-boundary validation, permissions, workspace scoping, audit, money/data integrity, accessibility, or required verification.

## Surgical Changes

Touch only what the task requires.

- Do not refactor unrelated code or polish adjacent files as a side effect.
- Match the existing style, even when a different design might be preferable.
- Remove unused imports, variables, functions, or files introduced by your own change.
- Mention unrelated issues instead of changing them.

## Goal-Driven Execution

Define success criteria and verify with the narrowest useful command first.

- For bug fixes, prefer a focused reproduction or test before the fix.
- For validation changes, include invalid-input coverage when practical.
- Broaden verification when the blast radius requires it.
- Report what passed, what failed, and what could not be verified.
- After required checks pass, finish the task. Repeat or broaden checks only for new changes, failures, or unresolved risks.
- Do not add tests that merely mirror reversible, low-impact changes. Preserve required boundary, data-integrity, accessibility, and release checks.
