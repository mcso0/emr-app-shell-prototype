# Owner Safety OS

Status: approved
Updated: 2026-09-06

Owner Safety OS is the operating layer that lets 승욱 ask for safety review without remembering skill names, checklists, or agent-specific commands.

## Goal

When 승욱 says `안전 점검 게이트 열어줘`, 루멘 should:

1. identify the current work with a lightweight intake
2. propose the right safety checks and skills
3. explain the reason briefly
4. wait for 승욱 approval
5. run only the approved checks

This is not a full review by default. It is an intake gate before review.

Legacy alias: `작업 점검 하자` should still trigger the same intake gate, but new docs and examples should use `안전 점검 게이트 열어줘`.

Ordinary requests such as `PR 전 점검해줘`, `수정하지 말고 리뷰해줘`, and `코드 확인해줘` authorize scoped read-only review directly. Do not turn them into a separate approval gate. Explicit intake requests retain the propose-and-wait behavior above. Prior approval remains valid for the same scope.

## Source Standards

Use only official or standards-oriented references for durable Safety OS rules:

- OpenAI Skills documentation: https://help.openai.com/en/articles/20001066
- OWASP Secure Coding with AI Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secure_Coding_with_AI_Cheat_Sheet.html
- OWASP Agentic Skills Top 10 checklist: https://owasp.org/www-project-agentic-skills-top-10/checklist.html
- NIST SSDF profile for generative AI: https://www.nist.gov/publications/secure-software-development-practices-generative-ai-and-dual-use-foundation-models-ssdf
- Local Next.js docs under `node_modules/next/dist/docs/` before Next.js app-code changes

Do not turn blog posts or marketing articles into durable Safety OS rules without a separate representative decision.

## Skill

Repo-local skill:

- `.agents/skills/emr-owner-safety-os/SKILL.md`

The skill uses progressive disclosure:

- the `SKILL.md` file contains the lightweight workflow
- detailed checklists live in `references/`
- only the checklist needed for the approved scope should be read

## Intake Gate

The intake gate should use the smallest useful context:

- current thread and latest request
- `git status --short`
- `git diff --stat` when local changes matter
- active Linear issue or repo work item when known
- startup docs already required by the repo contract

During intake, do not:

- modify files
- run full review
- load all checklists
- enter remote Supabase, production deploy, real data, provider integration, payment, or email scope

## Standard Brief

Use this exact shape unless the user asks otherwise:

```text
승욱, 현재 작업은 <작업 요약>로 보여.

추천 점검:
- <점검 A>: <이유>
- <점검 B>: <이유>

사용할 스킬:
- emr-owner-safety-os: <이유>
- 필요 시 emr-docs-sync/manual-linear-ops: <이유>

진행 범위:
- 코드 수정 없음
- remote Supabase/배포/실데이터 접근 없음
- 승인 후 선택한 점검만 실행

진행할까?
```

## Review Buckets

- Code quality: lint, TypeScript, build, tests, dependency risk, React/Next.js structure.
- Security/DB: secrets, auth, permission, workspace isolation, Supabase, RLS, migration, rollback.
- Runtime UX: loading, empty, error, permission denied, duplicate submit, unsaved changes.
- Design system: shadcn tokens, EMR alias tokens, shared primitives, component consistency.
- Design pattern: navigation, list/detail, drawer/modal/page, form/save, table/filter/search, status, permission UX.
- Docs/work: source docs, work items, Linear handoff, result review.

## Approval Gates

Stop and ask 승욱 before:

- meaningful cost, secret/security exposure, or private asset publication
- destructive or hard-to-rollback remote operations
- production release outside the already-approved target, source, and scope
- real customer, patient, guardian, identity, billing, or payment data
- real email, KakaoTalk, PACS, device, payment, or provider integration
- role/permission policy changes
- broad UI direction changes outside the active scope

Scoped synthetic/demo work follows [current project guardrails](../engineering/current-status.md#guardrails); use the release runbook for production. Finish authorized preparation before requesting a remaining approval.

If a gated action is required for correctness, do not work around it with a weaker path. Explain the gate and wait.

## Linear Project

Linear project:

- `CLAiR EMR Owner Safety OS`

Initial issue set:

- `DEN-342`: Define Owner Safety OS scope and acceptance contract
- `DEN-343`: Map source text and official standards into checklist taxonomy
- `DEN-344`: Build repo-local Safety OS intake skill
- `DEN-345`: Add owner-facing workflow docs and routing hooks
- `DEN-346`: Run scenario-based Safety OS dry-run validation
- `DEN-347`: Produce Korean closeout report and Human Review handoff
