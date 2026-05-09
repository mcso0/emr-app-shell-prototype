# Work Order 04: Membership Permission Enforcement

## 세부 목표

로그인 이후 membership/permission source와 server-side enforcement/RLS 범위를 계획하거나 구현한다.

## 목적

provider session만으로 제품 권한이 완성된 것처럼 다루지 않고, 앱 도메인 membership과 permission source를 기준으로 서버 권한 경계를 만든다.

## 범위

- Work Order 03 완료 후 별도 승인된 권한 작업.
- membership 조회와 permission policy source 연결.
- server-side permission enforcement 범위 결정 또는 구현.
- RLS/migration 범위 결정 또는 구현.

## 완성 기준

- session source와 permission source가 분리되어 있다.
- server-side enforcement가 필요한 API/route/server action 범위가 명확하다.
- RLS/migration이 필요하면 별도 검증 가능한 단위로 작성된다.
- client UI gating만으로 보안이 완료된 것처럼 문서화하지 않는다.

## 선행 조건

- Work Order 01 완료.
- Work Order 02 완료.
- Work Order 03 완료.
- server permission enforcement/RLS 작업에 대한 별도 승인이 있어야 한다.

## 작업 순서

1. Work Order 01/02/03 산출물과 closeout을 읽는다.
2. Supabase Postgres/RLS 공식 문서를 확인한다.
3. security best practices를 확인한다.
4. API/route/server action 권한 적용 범위를 식별한다.
5. RLS/migration 범위를 문서화하거나 승인된 범위에서 구현한다.
6. 검증 가능한 테스트를 추가한다.
7. status와 closeout을 갱신한다.

## 검증/테스트 명령

권한 계획 문서화만 하는 경우:

```bash
npm run lint
rg "membership|permission|RLS|server-side enforcement" docs/implementation
```

코드나 migration이 포함되는 경우:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts --reporter=line
```

추가 검증은 실제 구현 범위에 맞춰 work order 수행자가 명시한다.

## 사용해야 할 스킬

- `supabase:supabase`
- `supabase:supabase-postgres-best-practices`
- `security-best-practices`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## 확인해야 할 공식/로컬 문서

- Supabase Auth 공식 문서
- Supabase RLS/Postgres 공식 문서
- `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`
- `docs/engineering/auth-security/auth-login/work-orders/01-supabase-auth-mapping.md`
- `docs/engineering/auth-security/auth-login/work-orders/03-supabase-provider-implementation.md`

## 하지 말아야 할 것

- 사용자 수정 가능 metadata를 권한 source로 쓰지 않는다.
- client UI gating만으로 서버 권한 구현이 끝난 것처럼 처리하지 않는다.
- service role key 또는 secret을 client에 노출하지 않는다.
- 업무 화면 변경을 권한 작업에 섞지 않는다.

## 건드리지 말아야 할 파일/영역

- 업무 화면은 권한 enforcement 검증에 필요한 최소 변경 외에는 수정하지 않는다.
- sales demo fixture와 golden path는 auth 회귀 보정 목적 외에는 수정하지 않는다.

## 작업 완료 시 해야 할 일

- `docs/engineering/auth-security/auth-login/status.md` 갱신.
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md` 갱신.
- `docs/engineering/current-status.md` 갱신.
- `docs/completed/auth/YYYY-MM-DD-membership-permission-enforcement.md` 작성.
- 검증 명령 실행.
- 사용자 요청 시 커밋, PR, 머지까지 진행.
