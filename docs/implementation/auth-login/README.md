# Auth Login Implementation Docs

이 폴더는 MVP 로그인 기능 구현을 단계별로 이어가기 위한 전용 작업 패키지다. 상위 기준 문서는 계속 `docs/implementation/mvp-current-status.md`와 `docs/implementation/mvp-auth-transition-roadmap.md`이며, 이 폴더는 로그인 구현 작업자가 바로 실행 가능한 순서와 작업지시서를 제공한다.

## 현재 시작점

현재 상태는 **mock auth shell 완료, Supabase 실제 연결 전**이다. 다음 작업은 `work-orders/01-supabase-auth-mapping.md`부터 시작한다.

## 작업 전 읽는 순서

1. `AGENTS.md`
2. `docs/implementation/mvp-current-status.md`
3. `docs/implementation/mvp-auth-transition-roadmap.md`
4. `docs/implementation/auth-login/README.md`
5. `docs/implementation/auth-login/status.md`
6. `docs/implementation/auth-login/agent-briefing.md`
7. 현재 작업할 `docs/implementation/auth-login/work-orders/*.md`

## 문서 구성

| 문서 | 역할 |
|---|---|
| `status.md` | 로그인 구현 목표, 현상태, 완료 기준, 다음 작업, 검증 기록 |
| `plan.md` | 4단계 master plan과 단계별 gate |
| `agent-briefing.md` | 작업 전 에이전트 운영 규칙과 금지 범위 |
| `completed-summary.md` | 완료된 auth/login closeout 문서 요약 인덱스 |
| `work-orders/01-supabase-auth-mapping.md` | Supabase Auth와 앱 도메인 사용자/멤버십/권한 매핑 설계 |
| `work-orders/02-supabase-integration-readiness.md` | 실제 연결 전 설치/env/callback/session/helper/middleware 계획 |
| `work-orders/03-supabase-provider-implementation.md` | 승인된 계획 기준 실제 Supabase provider adapter 구현 |
| `work-orders/04-membership-permission-enforcement.md` | membership/permission source와 서버 권한 enforcement/RLS 작업 |

## 진행 원칙

- 작업 순서는 `01 -> 02 -> 03 -> 04`로 고정한다.
- 앞 단계 완료와 closeout 없이 다음 단계로 넘어가지 않는다.
- 공식 완료 문서는 계속 `docs/completed/auth/YYYY-MM-DD-<slug>.md`에 작성한다.
- 문서 작업만 할 때는 code auth 검증을 요구하지 않는다.
- auth 코드가 바뀌면 `docs/implementation/mvp-auth-transition-roadmap.md`의 auth 코드 검증 세트를 따른다.
