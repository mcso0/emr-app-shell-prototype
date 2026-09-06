# Non-Developer Codex Workflow

Status: approved
Updated: 2026-09-06

This is 승욱's short usage guide for Owner Safety OS. 승욱 should not need to remember skill names.

Ordinary requests such as `PR 전 점검해줘` or `수정하지 말고 리뷰해줘` authorize read-only review immediately. The separate intake-and-wait flow below applies to an explicit Safety OS gate request. Existing approval remains valid for the same operation, target, and scope.

## Start A Safety Intake

Use:

```text
루멘, 안전 점검 게이트 열어줘.
```

Expected 루멘 behavior:

1. inspect the current work lightly
2. propose the useful checks
3. name the relevant skill and reason
4. state what will not be touched
5. wait for approval

## Approve Or Narrow The Review

Use:

```text
승인
```

or:

```text
디자인 패턴만 승인
```

or:

```text
DB/Supabase는 제외하고 승인
```

or:

```text
PR 전 전체 점검해줘
```

## Review Only, No Fixes

Use:

```text
아직 수정하지 말고 비개발자 오너 관점으로 위험요소만 리뷰해줘.
```

Expected result:

- Critical
- Major
- Minor
- Safe fixes
- Needs human decision
- Recommended validation commands
- Non-developer summary

## Apply Only Safe Fixes

Use:

```text
위 리뷰에서 Safe fixes만 반영해.
```

루멘 should not apply:

- DB/RLS/migration changes
- remote Supabase work
- production deploy
- role/permission policy changes
- new dependency decisions
- broad UI direction changes
- clinical/billing workflow behavior changes

unless that additional scope is already explicitly authorized. Approval for Safe fixes alone does not authorize these actions; scoped synthetic/demo work follows current project guardrails.

## DB, Supabase, Security, Or Deployment

Use:

```text
remote Supabase는 건드리지 말고 local 기준으로만 필요한 DB 변경 여부를 분석해줘.
```

If 루멘 says approval is required, 승욱 should decide whether the named gated operation is actually allowed. No approval means 루멘 must stop that path.

## Good Default Work Flow

```text
루멘, 이 작업 진행해. 안전 점검 게이트도 켜고.
```

Then:

1. 루멘 implements within the active scope.
2. 루멘 runs appropriate verification.
3. 승욱 says `안전 점검 게이트 열어줘`.
4. 루멘 proposes the review.
5. 승욱 approves all or part of it.
6. 루멘 reports findings.
7. 승욱 says `Safe fixes만 반영해` if appropriate.

## Legacy Alias

`작업 점검 하자` is still accepted as a legacy alias, but `안전 점검 게이트 열어줘` is the preferred phrase because it makes clear that 루멘 should brief first and wait for approval before running a full review.

## What 승욱 Should Check In Final Reviews

- Did 루멘 say what changed and why it matters?
- Did 루멘 mention verification results?
- Did 루멘 clearly state what was not verified?
- Did 루멘 avoid claiming remote Supabase, production, real data, legal/compliance, payment, or provider readiness unless explicitly scoped and verified?
