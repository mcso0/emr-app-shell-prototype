# Supabase Integration Readiness

Updated: 2026-05-03

이 문서는 Work Order 02의 결과물이다. 실제 Supabase provider 구현 전에 설치, env, callback, SSR cookie session, helper, proxy/server guard, local demo fallback 결정을 고정한다.

## 공식/로컬 문서 확인

확인한 기준:

- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client): Next.js SSR에서는 `@supabase/supabase-js`와 `@supabase/ssr`를 설치하고, browser/server client helper를 분리한다. Server Components는 cookie를 쓸 수 없으므로 Proxy가 token refresh와 cookie propagation을 담당한다.
- [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide): SSR auth token은 cookie로 공유되고, `@supabase/ssr` client는 PKCE flow와 cookie storage를 기본으로 구성한다. auth refresh가 `Set-Cookie`를 만들 수 있으므로 인증 route는 cache leakage에 주의한다.
- [Supabase Users](https://supabase.com/docs/guides/auth/users): `user_metadata`는 사용자가 수정할 수 있으므로 authorization logic 또는 RLS source로 쓰지 않는다.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): exposed schema table에는 RLS를 활성화해야 하며, `auth.jwt()`의 `raw_user_meta_data`는 권한 source로 부적절하다. `service_role`/secret key는 browser에 노출하지 않는다.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`: callback 같은 request handler는 `app/**/route.ts`로 둔다.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`: Next.js 16에서는 Middleware가 Proxy로 이름이 바뀌었고, Proxy는 full authorization solution이 아니라 request 전 cookie/session refresh와 optimistic redirect에 쓴다.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`: `cookies()`는 async이고 Server Components에서는 cookie read만 가능하다. write/delete는 Server Function 또는 Route Handler에서 한다.
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`: `NEXT_PUBLIC_` env는 browser bundle에 inline되는 public 값이다.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`: server redirect와 route handler redirect는 Next redirect/response API를 사용한다.

## 승인 결정

### Package 설치

Work Order 03에서 아래 package 설치를 승인한다.

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Work Order 02에서는 package 설치, lockfile 변경, Supabase project/API 연결을 하지 않는다.

### Env naming

공개 browser client가 필요한 값:

| Env | 공개 여부 | 책임 |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Supabase publishable key. 신규 key 체계를 우선 사용한다 |
| `NEXT_PUBLIC_AUTH_MODE` | public | `mock`, `supabase`, `auto` 중 하나 |

`NEXT_PUBLIC_AUTH_MODE` 동작:

- `mock`: 항상 mock/local demo auth를 사용한다.
- `supabase`: Supabase env가 없으면 login submit에서 provider 설정 오류를 표시한다.
- `auto`: Supabase URL/key가 모두 있으면 Supabase provider를 사용하고, 둘 중 하나라도 없으면 mock/local demo auth를 사용한다.
- 미설정 기본값은 `auto`다.

금지:

- `service_role`, secret API key, database password, JWT secret, OAuth client secret은 `NEXT_PUBLIC_` env에 두지 않는다.
- secret env를 Client Component 또는 client-bundled shared module에서 import하지 않는다.
- `.env*` 파일은 계속 gitignore 상태를 유지한다.

### Helper 위치

Work Order 03에서 생성할 helper 책임:

| File | Runtime | 책임 |
|---|---|---|
| `src/lib/supabase/config.ts` | shared-safe | public env presence와 auth mode 판정. secret을 읽지 않는다 |
| `src/lib/supabase/client.ts` | browser/client | `createBrowserClient()` 생성. login/logout/session hydrate에 사용 |
| `src/lib/supabase/server.ts` | server only | `cookies()` 기반 `createServerClient()` 생성. Route Handler, Server Component, Server Function에서 사용 |
| `src/lib/supabase/proxy.ts` | proxy | `createServerClient()`와 request/response cookie sync로 token refresh를 수행 |
| `src/proxy.ts` | Next Proxy | Supabase cookie refresh helper를 호출하고 matcher를 제한 |

### Session validation과 guard 범위

- Browser login/logout은 Supabase client의 `auth.signInWithPassword()`와 `auth.signOut()`에 위임한다.
- Server-side session check는 server/proxy code에서 `auth.getClaims()`를 우선 사용한다. server code에서 `auth.getSession()` 결과만으로 보호하지 않는다.
- 현재 `/w/[workspaceId]/[module]` guard는 Work Order 03에서 기존 client `AuthGate` 흐름을 유지하되, Supabase mode에서는 provider session hydrate를 사용할 수 있게 한다.
- Server permission enforcement는 Work Order 04에서 범위를 문서화한다. Work Order 03 완료 기준에 포함하지 않는다.

### Callback route

- Email/password login은 callback route 없이 browser client submit으로 처리한다.
- OAuth, magic link, email OTP, password reset처럼 auth code/token exchange가 필요한 흐름은 후속 별도 work order에서 `app/auth/**/route.ts`로 구현한다.
- Work Order 03에서는 OAuth callback, MFA, refresh token, email verification, password reset을 직접 구현하지 않는다.

### Mock/local demo fallback

- local demo mode는 유지한다.
- `NEXT_PUBLIC_AUTH_MODE=mock` 또는 `auto` + Supabase env 누락이면 현재 mock role/session 흐름을 유지한다.
- Playwright 기본 workspace regression은 mock/local demo auth를 계속 사용할 수 있다.
- Supabase provider mode가 켜져도 MVP 테스트 옵션 패널은 development/test/local demo 용도로 남긴다.
- mock session은 제품 권한 source가 아니다. server-side permission/RLS 완료처럼 문서화하지 않는다.

## Work Order 03 입력값

구현자는 아래 순서로 진행한다.

1. 위 package를 설치한다.
2. Supabase helper를 `src/lib/supabase/**`와 `src/proxy.ts`에 추가한다.
3. `useAuthClient()` boundary 뒤에서 auth mode를 선택한다.
4. Supabase mode login은 email/password form 값을 `signInWithPassword()`로 넘긴다.
5. mock/local demo mode는 기존 `signInWithMockRole()` 흐름을 유지한다.
6. logout은 Supabase sign out과 mock storage clear를 모두 고려한다.
7. `/login`, safe `next`, app guard, top menu role, logout 회귀를 `tests/auth.spec.ts`로 보호한다.

## 금지 범위

- Work Order 02에서 package 설치, env 연결, API 호출, callback route 구현, DB migration, RLS policy를 하지 않는다.
- Work Order 03에서 `service_role`/secret key client 노출, password 검증 직접 구현, OAuth/MFA/refresh/email verification 직접 구현, DB migration/RLS policy 작성을 하지 않는다.
- Work Order 04는 별도 승인 전 plan-only로 진행한다.
