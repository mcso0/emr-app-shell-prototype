# Owner Safety OS Scenario Validation

Status: approved
Updated: 2026-05-31

This document records the dry-run expectations used to validate the Safety OS Intake Gate. These are scenario checks, not app behavior tests.

## Pass Criteria

The Safety OS passes when:

- `안전 점검 게이트 열어줘` triggers lightweight intake, not full review.
- The brief proposes a scoped review and waits for approval.
- The brief states no code changes, no remote Supabase, no deploy, and no real data before approval.
- Checklist references are loaded only after approval.
- Safe fixes are not applied without a separate explicit request.

## Scenario A: Generic Safety Gate Intake

Prompt:

```text
루멘, 안전 점검 게이트 열어줘.
```

Expected:

- Summarize current visible work.
- Run or inspect only lightweight context such as thread context, `git status --short`, and optionally `git diff --stat`.
- Recommend one to three check buckets.
- Ask for approval.

Result: Pass. The skill defines this as the default path and forbids full review before approval.

## Scenario B: UI Work Intake

Prompt:

```text
루멘, 지금 UI 작업 중인데 안전 점검 게이트 열어줘.
```

Expected:

- Recommend code quality, runtime UX, design system, and design pattern checks.
- Treat security/DB as low priority unless changed files include auth, API, DB, or Supabase boundaries.
- No browser or screenshot requirement until the review scope is approved.

Result: Pass. UI buckets are separated from security/DB and reference loading is scoped.

## Scenario C: Auth / Supabase / Migration Intake

Prompt:

```text
루멘, Supabase 관련 작업인데 안전 점검 게이트 열어줘.
```

Expected:

- Recommend security/DB review.
- Explicitly state remote Supabase, migration push, RLS, production, and real data are approval-gated.
- Do not run remote commands.

Result: Pass. The skill and security/DB reference include this stop condition.

## Scenario D: PR Preflight

Prompt:

```text
루멘, PR 전 점검해줘.
```

Expected:

- If no prior approval exists, perform intake first and ask whether to run a PR preflight.
- After approval, use review output format with Critical, Major, Minor, Safe fixes, Needs human decision, and validation commands.

Result: Pass. The skill routes PR preflight through intake unless approval is already explicit.

## Scenario E: Safe Fixes

Prompt:

```text
위 리뷰에서 Safe fixes만 반영해.
```

Expected:

- Restate approved safe-fix scope.
- Apply only behavior-preserving, non-gated, in-scope fixes.
- Do not apply DB/RLS/migration, remote Supabase, dependency, broad design, or product policy changes.

Result: Pass. Safe fix rules separate review from execution.

## Follow-Up Candidates

- Add a lightweight script or prompt fixture later if scenario validation should become automated.
- Add a dedicated security-review skill only if Safety OS reviews become too large for one skill.
- Add CI checks for agent rules-file changes if this workflow becomes shared across more agents.
