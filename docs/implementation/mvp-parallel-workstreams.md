# MVP Parallel Workstreams

Updated: 2026-05-02

이 문서는 EMR SaaS MVP 작업을 여러 Codex/AI 채팅에서 병렬로 진행하기 위한 작업 분배 기준이다. 각 채팅은 자기 전용 `git worktree`와 브랜치를 만들고, 이 문서의 범위 안에서만 작업한다.

## Purpose

현재 primary 작업은 **PR7: Figma Reference Capture & MVP Screen Alignment**이다. 이 작업은 접수/예약, 환자/보호자 드로어, 진료(차트), 검사/영상, 수납 화면의 UI 파일을 넓게 건드릴 수 있다.

따라서 A/B/C/D 병렬 작업은 PR7 UI 정렬과 충돌하지 않는 foundation 작업으로 제한한다.

목표:

- 각 채팅의 작업 범위와 금지 범위를 명확히 한다.
- 같은 repo 폴더에서 여러 채팅이 동시에 `git checkout`하지 않게 한다.
- PR7 UI 작업과 A/B/C/D foundation 작업의 merge conflict 가능성을 낮춘다.
- 나중에 MVP 통합 순서와 검증 기준을 분명히 남긴다.

## Global Start Procedure

각 병렬 채팅은 원본 repo 폴더에서 바로 작업하지 않는다. 먼저 최신 `origin/main`에서 자기 전용 worktree를 만든 뒤, 생성된 worktree 경로에서만 작업한다.

공통 절차:

```bash
git fetch origin
git worktree add <worktree-path> -b <branch-name> origin/main
cd <worktree-path>
```

그 다음 아래 문서를 순서대로 읽는다.

1. `AGENTS.md`
2. `docs/implementation/mvp-current-status.md`
3. `docs/implementation/mvp-parallel-workstreams.md`

Next.js application code를 작성하거나 수정해야 한다면, 코드 작성 전에 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.

## Branch And Worktree Map

| Workstream | Branch | Worktree path |
|---|---|---|
| PR7 Reference UI Alignment | `codex/pr7-reference-ui-alignment` | `../emr-app-shell-prototype-pr7` |
| A. Auth Mock Foundation | `codex/auth-mock-foundation` | `../emr-app-shell-prototype-auth` |
| B. Audit Log Foundation | `codex/audit-log-foundation` | `../emr-app-shell-prototype-audit` |
| C. Service Catalog / Role Seed | `codex/service-catalog-role-seed` | `../emr-app-shell-prototype-service-catalog` |
| D. API Boundary / Selectors Plan | `codex/api-boundary-selectors` | `../emr-app-shell-prototype-api-boundary` |

If a branch already exists locally, do not recreate it with `-b`. Add the worktree from the existing branch instead:

```bash
git worktree add <worktree-path> <branch-name>
```

## Global Rules

- 한 채팅은 하나의 worktree와 하나의 branch만 소유한다.
- 원본 repo 폴더에서 여러 채팅이 동시에 `git checkout`하지 않는다.
- 조제/처치 화면의 현재 디자인과 동작은 명시 요청 없이는 수정하지 않는다.
- 입원과 병원관리 전체 화면은 현재 병렬 작업 범위 밖이다.
- 병원관리 Order 관리 / Order 세트 reference는 구현 대상이 아니다.
- PR7 UI 정렬과 충돌할 수 있는 파일은 수정하지 않는다.
- 기존 feature UI에 연결하기보다, 새 foundation 파일과 테스트를 우선한다.
- 기능을 실제 DB/API/auth/provider와 연결하지 않는다. 현재 MVP는 frontend prototype과 mock/session-only foundation이다.

## Do Not Touch During A/B/C/D

A/B/C/D 병렬 작업은 아래 파일과 폴더를 수정하지 않는다. 필요한 경우 작업을 멈추고 PR7 담당 채팅과 통합 순서를 다시 잡는다.

```text
src/features/reception/*
src/features/chart/*
src/features/lab-imaging/*
src/features/billing/*
src/features/reception/profile-drawer.tsx
src/components/emr/*
src/styles/tokens/*
src/app/globals.css
```

## Current Primary Workstream: PR7 Reference UI Alignment

Branch:

```text
codex/pr7-reference-ui-alignment
```

Worktree:

```text
../emr-app-shell-prototype-pr7
```

Goal:

- Figma/reference screen captures를 `docs/assets/reference-screens/*`에 저장한다.
- `docs/implementation/reference-screen-index.md`의 실제 파일 존재 여부와 notes를 갱신한다.
- PR 1-6 화면을 reference intent에 맞춰 정렬한다.
- 기능과 mock data flow는 유지하고, 정보 우선순위, 밀도, 간격, 상태 표현, 텍스트를 다듬는다.

Allowed areas:

- `docs/assets/reference-screens/*`
- `docs/implementation/reference-screen-index.md`
- `src/features/reception/*`
- `src/features/chart/*`
- `src/features/lab-imaging/*`
- `src/features/billing/*`
- 환자/보호자 drawer 관련 UI
- 해당 화면 테스트

Do not:

- 조제/처치 화면을 변경하지 않는다.
- 새 backend/auth/API integration을 만들지 않는다.
- 병원관리/입원 화면을 구현하지 않는다.

## Workstream A: Auth Mock Foundation

Branch:

```text
codex/auth-mock-foundation
```

Worktree:

```text
../emr-app-shell-prototype-auth
```

Goal:

MVP에서 역할 기반 UX를 검증할 수 있도록 로그인 mock foundation을 만든다. 이번 작업은 foundation까지만 포함하고, 기존 app shell 전체에 접근 제어를 강제하지 않는다.

In scope:

- `/login` page 추가
- 역할 선택 기반 mock login
- session-only 또는 `localStorage` 기반 mock session
- logout utility
- auth/session helper 또는 store
- auth Playwright 또는 unit-level test

Recommended roles:

- `front_desk`
- `vet`
- `nurse`
- `billing_admin`
- `hospital_admin`

Out of scope:

- 기존 app shell route에 전역 auth guard 적용
- 실제 auth provider 연동
- DB/API session 연동
- PR7 UI 파일 수정
- nav/shell 대규모 변경

Expected result:

- 사용자가 `/login`에서 mock 역할을 선택해 session을 만들 수 있다.
- session과 logout helper가 후속 통합 작업에서 재사용 가능한 형태로 존재한다.
- 기존 workspace 화면은 auth guard 없이 그대로 접근 가능하다.

Suggested verification:

```bash
npm run lint
npx tsc --noEmit
npx playwright test tests/auth.spec.ts --reporter=line
```

## Workstream B: Audit Log Foundation

Branch:

```text
codex/audit-log-foundation
```

Worktree:

```text
../emr-app-shell-prototype-audit
```

Goal:

접수, 환자/보호자 수정, SOAP 저장, 오더 상태 변경, 수납 액션이 나중에 감사 이벤트를 남길 수 있도록 audit log type/helper/mock foundation을 만든다.

In scope:

- audit event type 정의
- append/build helper 작성
- mock audit event fixture 작성
- status transition, profile edit, billing action 같은 대표 이벤트 seed
- audit helper test

Out of scope:

- 실제 backend 저장
- UI 화면 연결
- 기존 feature UI 수정
- `src/mocks/emr-domain.ts` 대수정
- 권한 정책 enforcement

Expected result:

- 후속 작업이 `actor`, `target`, `action`, `timestamp`, `metadata`를 가진 audit event를 만들 수 있다.
- helper는 deterministic test가 가능하다.
- 기존 PR 1-6 화면 동작은 변하지 않는다.

Suggested verification:

```bash
npm run lint
npx tsc --noEmit
npx playwright test tests/audit-log.spec.ts --reporter=line
```

## Workstream C: Service Catalog / Role Seed

Branch:

```text
codex/service-catalog-role-seed
```

Worktree:

```text
../emr-app-shell-prototype-service-catalog
```

Goal:

처방, 검사, 영상, 조제, 수납에서 나중에 같은 수가/서비스 항목과 역할 seed를 참조할 수 있도록 service catalog와 role/permission seed foundation을 만든다.

In scope:

- service catalog type/seed
- role seed
- permission seed
- service item lookup helper
- role/permission lookup helper
- seed consistency test

Out of scope:

- 설정 화면 구현
- nav에 설정/병원관리 메뉴 연결
- 수납/차트 UI 직접 연결
- 실제 권한 enforcement
- 가격 변경 이력 UI

Expected result:

- 후속 작업에서 invoice line, prescription/order item, role-gated UI가 같은 seed를 참조할 수 있다.
- seed는 MVP mock foundation으로 충분하고 실제 DB schema migration은 포함하지 않는다.

Suggested verification:

```bash
npm run lint
npx tsc --noEmit
npx playwright test tests/service-catalog.spec.ts --reporter=line
```

## Workstream D: API Boundary / Selectors Plan

Branch:

```text
codex/api-boundary-selectors
```

Worktree:

```text
../emr-app-shell-prototype-api-boundary
```

Goal:

현재 연결형 mock domain을 나중에 API/DB-backed repository로 교체하기 쉽도록 최소 boundary와 selector plan을 만든다. 기존 feature module을 대규모로 갈아끼우지 않고, 새 helper와 문서 중심으로 진행한다.

In scope:

- mock domain read selector 정리
- repository interface 초안
- API boundary 문서 작성
- selector/helper test
- 후속 통합 시 어떤 feature가 어떤 selector를 쓰면 되는지 정리

Out of scope:

- 실제 API route 구현
- DB client 또는 migration 추가
- 기존 feature module 대규모 refactor
- UI 화면 변경
- auth/audit/service catalog를 강제로 통합

Expected result:

- 후속 작업자가 mock data 직접 import를 줄이고 selector/repository boundary로 이동할 수 있는 기준을 가진다.
- 지금 PR 1-6 화면 동작은 변하지 않는다.

Suggested verification:

```bash
npm run lint
npx tsc --noEmit
npx playwright test tests/api-boundary.spec.ts --reporter=line
```

## Integration Order

추천 merge 순서:

1. D. API Boundary / Selectors Plan
2. C. Service Catalog / Role Seed
3. B. Audit Log Foundation
4. A. Auth Mock Foundation
5. PR7 Reference UI Alignment

이 순서는 UI 충돌 가능성이 낮은 foundation 작업을 먼저 합치고, 화면 변경 폭이 큰 PR7을 마지막에 확인하기 위한 것이다.

각 브랜치를 병합하기 전:

- `main` 최신화를 확인한다.
- 해당 workstream의 suggested verification을 실행한다.
- PR7의 금지 범위를 건드렸는지 `git diff --name-only origin/main...HEAD`로 확인한다.

## Handoff Prompt: A. Auth Mock Foundation

```text
먼저 원본 repo에서 아래 명령을 실행해 전용 worktree를 만들고, 생성된 worktree에서만 작업해줘.

git fetch origin
git worktree add ../emr-app-shell-prototype-auth -b codex/auth-mock-foundation origin/main
cd ../emr-app-shell-prototype-auth

작업 전 `AGENTS.md`, `docs/implementation/mvp-current-status.md`, `docs/implementation/mvp-parallel-workstreams.md`를 읽어줘.

목표는 로그인 mock foundation 구현이야. 범위는 `/login` 페이지, 역할 선택, session-only 또는 localStorage 기반 mock session, logout utility, auth/session helper 또는 store, auth 테스트까지야.

추천 역할은 `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin`이야.

하지 말아야 할 것:
- 기존 app shell에 전역 auth guard를 걸지 마.
- 실제 auth provider나 DB/API session을 붙이지 마.
- `src/features/reception/*`, `src/features/chart/*`, `src/features/lab-imaging/*`, `src/features/billing/*`, `src/features/reception/profile-drawer.tsx`, `src/components/emr/*`, `src/styles/tokens/*`, `src/app/globals.css`를 수정하지 마.
- PR7 UI 작업 파일을 건드리지 마.

검증은 가능한 범위에서 `npm run lint`, `npx tsc --noEmit`, `npx playwright test tests/auth.spec.ts --reporter=line`로 해줘.
```

## Handoff Prompt: B. Audit Log Foundation

```text
먼저 원본 repo에서 아래 명령을 실행해 전용 worktree를 만들고, 생성된 worktree에서만 작업해줘.

git fetch origin
git worktree add ../emr-app-shell-prototype-audit -b codex/audit-log-foundation origin/main
cd ../emr-app-shell-prototype-audit

작업 전 `AGENTS.md`, `docs/implementation/mvp-current-status.md`, `docs/implementation/mvp-parallel-workstreams.md`를 읽어줘.

목표는 audit log type/helper/mock event foundation 구현이야. UI 연결보다 이벤트 구조, append/build helper, fixture, deterministic test를 우선해줘.

대표 이벤트는 status transition, profile edit, SOAP save, order status change, billing action을 seed로 잡아줘.

하지 말아야 할 것:
- 실제 backend 저장을 만들지 마.
- 기존 feature UI에 연결하지 마.
- `src/mocks/emr-domain.ts`를 대수정하지 마.
- 권한 정책 enforcement를 구현하지 마.
- `src/features/reception/*`, `src/features/chart/*`, `src/features/lab-imaging/*`, `src/features/billing/*`, `src/features/reception/profile-drawer.tsx`, `src/components/emr/*`, `src/styles/tokens/*`, `src/app/globals.css`를 수정하지 마.

검증은 가능한 범위에서 `npm run lint`, `npx tsc --noEmit`, `npx playwright test tests/audit-log.spec.ts --reporter=line`로 해줘.
```

## Handoff Prompt: C. Service Catalog / Role Seed

```text
먼저 원본 repo에서 아래 명령을 실행해 전용 worktree를 만들고, 생성된 worktree에서만 작업해줘.

git fetch origin
git worktree add ../emr-app-shell-prototype-service-catalog -b codex/service-catalog-role-seed origin/main
cd ../emr-app-shell-prototype-service-catalog

작업 전 `AGENTS.md`, `docs/implementation/mvp-current-status.md`, `docs/implementation/mvp-parallel-workstreams.md`를 읽어줘.

목표는 service catalog, role seed, permission seed foundation 구현이야. 수납/차트 UI에 직접 연결하지 말고 데이터, lookup helper, consistency test 중심으로 끝내줘.

추천 역할은 `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin`이야. service catalog는 진료, 처방/조제, 검사, 영상, 수납 invoice line에서 나중에 공통 참조할 수 있는 mock seed로 만들어줘.

하지 말아야 할 것:
- 설정 화면을 구현하지 마.
- nav에 설정/병원관리 메뉴를 연결하지 마.
- 수납/차트 UI에 직접 연결하지 마.
- 실제 권한 enforcement를 만들지 마.
- `src/features/reception/*`, `src/features/chart/*`, `src/features/lab-imaging/*`, `src/features/billing/*`, `src/features/reception/profile-drawer.tsx`, `src/components/emr/*`, `src/styles/tokens/*`, `src/app/globals.css`를 수정하지 마.

검증은 가능한 범위에서 `npm run lint`, `npx tsc --noEmit`, `npx playwright test tests/service-catalog.spec.ts --reporter=line`로 해줘.
```

## Handoff Prompt: D. API Boundary / Selectors Plan

```text
먼저 원본 repo에서 아래 명령을 실행해 전용 worktree를 만들고, 생성된 worktree에서만 작업해줘.

git fetch origin
git worktree add ../emr-app-shell-prototype-api-boundary -b codex/api-boundary-selectors origin/main
cd ../emr-app-shell-prototype-api-boundary

작업 전 `AGENTS.md`, `docs/implementation/mvp-current-status.md`, `docs/implementation/mvp-parallel-workstreams.md`를 읽어줘.

목표는 mock domain을 나중에 API/DB로 교체하기 위한 repository/selectors boundary를 설계하고 최소 helper를 추가하는 거야. 기존 feature module을 대규모로 갈아끼우지 말고, 독립 helper와 문서 중심으로 작업해줘.

결과물은 read selector, repository interface 초안, API boundary 문서, selector/helper test, 후속 통합 가이드야.

하지 말아야 할 것:
- 실제 API route를 만들지 마.
- DB client나 migration을 추가하지 마.
- 기존 feature module을 대규모 refactor하지 마.
- UI 화면을 변경하지 마.
- auth/audit/service catalog를 강제로 통합하지 마.
- `src/features/reception/*`, `src/features/chart/*`, `src/features/lab-imaging/*`, `src/features/billing/*`, `src/features/reception/profile-drawer.tsx`, `src/components/emr/*`, `src/styles/tokens/*`, `src/app/globals.css`를 수정하지 마.

검증은 가능한 범위에서 `npm run lint`, `npx tsc --noEmit`, `npx playwright test tests/api-boundary.spec.ts --reporter=line`로 해줘.
```
