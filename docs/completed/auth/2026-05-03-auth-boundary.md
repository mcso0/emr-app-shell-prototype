# Auth Boundary Closeout

완료 날짜: 2026-05-03

## 최종 목표와 실제 결과물

- UI가 `useMockAuthStore`를 직접 import하지 않도록 `src/features/auth/auth-client.ts`를 추가했다.
- public auth boundary는 `AuthSession`과 `useAuthClient()`로 고정했다.
- `LoginForm`, `AuthGate`, `TopMenu`는 mock 저장소 세부사항 대신 `useAuthClient()`를 사용한다.
- 기존 mock auth 흐름인 `/login`, safe `next`, 기본 reception 진입, mock session, app guard, top menu role, logout flow는 유지했다.

## 변경한 주요 파일

- `src/features/auth/auth-client.ts`
- `src/features/auth/login-form.tsx`
- `src/features/auth/auth-gate.tsx`
- `src/shell/top-menu.tsx`
- `tests/auth.spec.ts`

## 사용한 스킬과 문서

- `build-web-apps:react-best-practices`: client state boundary와 hook 구독 기준 확인
- `superpowers:test-driven-development`: boundary 회귀 테스트를 먼저 추가하고 실패를 확인한 뒤 구현
- `security-best-practices`: client bundle에 secret/privileged server logic을 넣지 않는지 점검
- local Next docs: `useRouter`, `useSearchParams`, Server/Client Components 문서 확인

## 통과한 검증 명령

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line`
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`

## 남은 후속 작업

- 실제 Supabase session adapter는 아직 만들지 않는다.
- `useAuthClient()` 뒤의 mock 구현을 유지하면서 Supabase 매핑 설계를 먼저 진행한다.
