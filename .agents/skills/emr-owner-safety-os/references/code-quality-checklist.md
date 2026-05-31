# Code Quality Checklist

Use after approval for implementation, PR, or safe-fix review.

## Required Context

- Active issue/work item scope.
- Changed files from `git diff --name-only` or equivalent.
- Relevant Next.js docs from `node_modules/next/dist/docs/` before Next.js app code changes.

## Checks

- Lint: unused imports, unused variables, risky patterns, dead code, inconsistent style.
- TypeScript: type errors, excessive `any`, missing null/undefined handling, wrong props, wrong function calls.
- Build readiness: code can be bundled for the current target; app code does not depend on local-only accidents.
- Tests: impacted unit, component, integration, E2E, smoke, or regression coverage is identified.
- React/Next.js: client/server component boundary, server route shape, state ownership, unnecessary rerender risk, file responsibility.
- Dependency risk: new package is necessary, maintained, not duplicating existing libraries, and lockfile changes are expected.
- Supply-chain-sensitive files: `package.json`, lockfiles, CI, Docker, build scripts, postinstall/preinstall/prepare hooks.

## CLAiR EMR Defaults

- Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` for broad implementation changes when feasible.
- Prefer narrower focused tests first, then broaden when shared behavior or data/security boundaries are touched.
- Do not add dependencies just because they are convenient. Reuse existing project libraries unless there is a clear reason.
- Do not delete or weaken existing tests without explicit justification.

## Report Evidence

For each finding, include:

- file path and line when available
- why it matters
- whether it is Critical, Major, Minor, Safe fix, or Needs human decision
