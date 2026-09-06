---
name: emr-owner-safety-os
description: Use for CLAiR EMR Owner Safety OS requests, especially when the user says "안전 점검 게이트", "안전 점검 게이트 열어줘", "작업 점검", "안전운영체계", "Safety OS", "PR 전 점검", "수정하지 말고 리뷰", "Safe fixes만", "비개발자 안전검토", or asks to review code/security/DB/testing/design/documentation risk before or after Codex work. Explicit Safety OS gate requests start with intake and approval; ordinary review requests directly authorize read-only inspection. Fixes require an explicit in-scope change request.
---

# EMR Owner Safety OS

Use this skill to help 승욱 run a token-efficient safety gate around Codex work without needing to remember skill names or checklists.

## Core Rule

When the user says `안전 점검 게이트 열어줘`, `안전 점검 게이트`, `작업 점검 하자`, `안전운영체계`, `Safety OS`, or explicitly asks for a Safety OS intake:

1. Do a lightweight intake first.
2. Do not modify files.
3. Do not run a full review yet.
4. Do not load all checklist references.
5. Brief 승욱 with the proposed checks, skills, and reasons.
6. Wait for explicit approval before running the selected review.

Approval can be broad (`승인`, `진행해`) or scoped (`디자인 패턴만`, `DB/Supabase 제외`, `Safe fixes만`).

Ordinary requests such as `PR 전 점검해줘`, `수정하지 말고 리뷰해줘`, or `코드 확인해줘` authorize scoped read-only review immediately. Load only relevant references and report findings; do not add an intake approval round. A gate request with no selected scope still follows the intake flow above. Prior approval for the same review scope remains valid.

## Lightweight Intake

Read only enough to classify the work:

- Current thread context and latest user request.
- `git status --short`.
- `git diff --stat` when local changes matter.
- Active Linear issue or `docs/work/` item when known.
- `docs/agent-start-here.md` and `docs/engineering/current-status.md` if not already read in the current session.

Do not read checklist references during intake unless the user already approved a specific review.

## Intake Brief Format

Use this concise Korean format:

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

## After Review Authorization

Load only the references needed for the approved scope:

- Intake mechanics: `references/intake-gate.md`
- Code quality, lint, typecheck, build, dependency risk: `references/code-quality-checklist.md`
- Security, auth, DB, RLS, migration, Supabase gates: `references/security-db-checklist.md`
- Loading, empty, error, duplicate submit, unsaved changes: `references/runtime-ux-checklist.md`
- Tokens, shadcn, EMR alias tokens, component consistency: `references/design-system-checklist.md`
- Navigation, list/detail, forms, tables, status, permission UX: `references/design-pattern-checklist.md`
- Review report shape: `references/review-output-format.md`
- Safe fix execution: `references/safe-fix-rules.md`

If the request involves Linear project, issue, milestone, Human Review, or Done/Rework status, also use `$manual-linear-ops`.

If the request involves docs sync or GitBook-facing docs updates, also use `$emr-docs-sync`.

## Approval Gates

Stop and ask for explicit approval before:

- meaningful cost, secret/security exposure, or private asset publication
- real-data access or destructive/hard-to-rollback remote operations
- production release outside the already-approved target, source, and scope
- real email, KakaoTalk, PACS, device, payment, or provider integration
- real hospital, patient, guardian, payment, or identity data
- role/permission policy changes
- broad UI direction changes beyond the active scope

Follow `AGENTS.md` and `docs/engineering/current-status.md` for scoped synthetic/demo Supabase, migration, and RLS work. Their authorization does not extend to real data or destructive operations. Production release follows the release runbook. Complete authorized preparation before a remaining gate; do not repeat unchanged approvals.

Do not route around a gated action with a weaker workaround if the gated action is required for correctness. Explain the gate and wait.

## Default Output Expectations

For review results, use the report shape from `references/review-output-format.md`.

For requested fixes, use `references/safe-fix-rules.md`: apply only Safe fixes, preserve behavior, keep scope narrow, and report verification.

Reply to 승욱 in Korean unless asked otherwise. Keep agent-facing notes and durable docs concise English.
