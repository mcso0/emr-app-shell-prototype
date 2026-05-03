# Login UX State Closeout

완료 날짜: 2026-05-03

## 최종 목표와 실제 결과물

- 로그인 submit을 async 흐름으로 바꾸고 submit 중 버튼 disabled 상태와 `로그인 중` 문구를 추가했다.
- 로그인 폼 내부에 provider error 표시 영역을 `role="alert"`로 추가했다.
- Supabase 미연결 상태에서 error UI를 테스트하기 위해 development/test 전용 `mockProviderError=1` query mode를 추가했다.
- `MVP 테스트 옵션` 패널의 mock role/storage 선택은 기존처럼 유지했다.

## 변경한 주요 파일

- `src/features/auth/auth-client.ts`
- `src/features/auth/login-form.tsx`
- `tests/auth.spec.ts`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/current-status.md`

## 사용한 스킬과 문서

- `build-web-apps:react-best-practices`: form state, client rendering, query-derived state 기준 확인
- `superpowers:test-driven-development`: pending/error 회귀 테스트를 먼저 추가하고 실패를 확인한 뒤 구현
- `security-best-practices`: query mode를 production provider error 강제 수단으로 쓰지 않도록 제한
- local Next docs: `useRouter`, `useSearchParams`, Server/Client Components 문서 확인

## 통과한 검증 명령

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line`
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`

## 남은 후속 작업

- 실제 provider error는 Supabase Auth 연결 계획이 승인된 뒤 provider adapter에서 연결한다.
- 비밀번호 검증, OAuth callback, MFA, refresh token, 이메일 인증은 직접 구현하지 않는다.
