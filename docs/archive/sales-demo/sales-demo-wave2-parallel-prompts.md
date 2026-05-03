# Sales Demo Wave 2 Parallel Prompts

Updated: 2026-05-02

이 문서는 `sales demo spine`이 `main`에 병합된 뒤, Wave 2 화면별 polish/continuity 작업을 여러 채팅에서 안전하게 나누기 위한 handoff 문서다.

Wave 2의 목표는 새 기능을 넓게 추가하는 것이 아니라, 이미 `main`에 들어간 `kong-vomit` 골든 시나리오를 기준으로 접수, 진료, 검사/영상, 수납 화면이 더 자연스럽게 이어져 보이게 만드는 것이다.

Status: 2026-05-02 기준 Wave 2 작업은 완료되어 `main`에 병합되었다. 완료 결과는 `docs/archive/sales-demo/sales-demo-wave2-closeout.md`를 기준으로 확인한다.

## Operating Model

진행 방식:

1. 각 채팅은 최신 `origin/main`에서 자기 전용 `git worktree`와 branch를 만든다.
2. 각 채팅은 이 문서의 "소유 파일"만 수정한다.
3. `src/shell/app-shell.tsx`, `tests/sales-demo-flow.spec.ts`, broad URL/query strategy는 통합 채팅만 소유한다.
4. `src/mocks/emr-domain.ts`와 `src/lib/emr-domain/demo-scenarios.ts`는 기본적으로 read-only로 둔다. 데이터가 꼭 부족하면 통합 채팅에 넘긴다.
5. 조제/처치 화면 디자인과 동작은 보존한다. `src/features/dispensing/*`는 이번 Wave 2의 수정 대상이 아니다.
6. 각 채팅은 PR을 만들기 전 자기 범위 테스트를 통과시키고, 통합 채팅은 마지막에 golden path 전체 테스트를 통과시킨다.

공통 시작 명령:

```bash
git fetch origin
git worktree add <worktree-path> -b <branch-name> origin/main
cd <worktree-path>
test -d node_modules || npm install
```

이미 branch가 있다면 `-b` 없이 기존 branch로 worktree를 추가한다.

```bash
git worktree add <worktree-path> <branch-name>
```

공통으로 먼저 읽을 문서:

1. `AGENTS.md`
2. `docs/engineering/current-status.md`
3. `docs/archive/sales-demo/demo-sales-strategy.md`
4. `docs/archive/sales-demo/sales-demo-readiness-audit.md`
5. `docs/archive/implementation-waves/mvp-parallel-workstreams.md`
6. `docs/archive/sales-demo/sales-demo-wave2-parallel-prompts.md`

Next.js application code를 수정한다면 코드 작성 전에 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.

## Branch And Worktree Map

| Workstream | Branch | Worktree path |
|---|---|---|
| Reception/Patient Continuity | `codex/wave2-reception-patient-continuity` | `../emr-app-shell-prototype-wave2-reception` |
| Chart/SOAP/Order Continuity | `codex/wave2-chart-soap-order-continuity` | `../emr-app-shell-prototype-wave2-chart` |
| Lab/Imaging Result Flow | `codex/wave2-lab-imaging-continuity` | `../emr-app-shell-prototype-wave2-lab-imaging` |
| Billing Sales Polish | `codex/wave2-billing-sales-polish` | `../emr-app-shell-prototype-wave2-billing` |
| Demo Flow Integration | `codex/wave2-demo-flow-integration` | `../emr-app-shell-prototype-wave2-integration` |

## Ownership Matrix

| Workstream | Owns | Avoids |
|---|---|---|
| Reception/Patient | `src/features/reception/*`, `tests/reception.spec.ts` | shell URL sync, chart/lab/billing modules, demo seed rewrites |
| Chart/SOAP/Order | `src/features/chart/module.tsx`, `tests/chart.spec.ts` | billing store/state, lab/imaging module, shell URL sync |
| Lab/Imaging | `src/features/lab-imaging/module.tsx`, `tests/lab-imaging.spec.ts` | shell URL sync, chart/billing module state, dispensing |
| Billing Polish | `src/features/billing/module.tsx`, `tests/billing.spec.ts` | chart/lab state, service catalog rewrites, shell URL sync |
| Integration | `src/shell/app-shell.tsx`, `tests/app-shell.spec.ts`, `tests/sales-demo-flow.spec.ts`, cross-doc updates | broad feature polish unless resolving integration conflicts |

## Merge Order

Recommended order:

1. Reception/Patient, Chart/SOAP/Order, Lab/Imaging, Billing can run in parallel.
2. Merge the lowest-conflict PRs first. Prefer branches that only touched one feature module and one module spec.
3. Rebase the remaining branches on latest `origin/main` before merge.
4. Run Demo Flow Integration last. It owns cross-module golden path assertions and URL/query cleanup.
5. After integration, run the full verification set.

Final verification:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright test --reporter=line
```

If any branch touches shell routing, panel URL state, or 조제/처치-adjacent behavior, also run:

```bash
npx playwright test tests/app-shell.spec.ts --reporter=line
```

## Prompt A: Reception/Patient Continuity

```text
sales demo spine이 main에 들어갔어. Wave 2 중 "Reception/Patient Continuity"를 맡아줘.

작업 시작:
1. 원본 repo에서 최신 main 기준으로 worktree를 만들어줘.

   git fetch origin
   git worktree add ../emr-app-shell-prototype-wave2-reception -b codex/wave2-reception-patient-continuity origin/main
   cd ../emr-app-shell-prototype-wave2-reception
   test -d node_modules || npm install

2. 먼저 아래 문서를 읽어줘.
   - AGENTS.md
   - docs/engineering/current-status.md
   - docs/archive/sales-demo/demo-sales-strategy.md
   - docs/archive/sales-demo/sales-demo-readiness-audit.md
   - docs/archive/implementation-waves/mvp-parallel-workstreams.md
   - docs/archive/sales-demo/sales-demo-wave2-parallel-prompts.md

3. Next.js application code를 수정하기 전에 node_modules/next/dist/docs/에서 App Router/search params 관련 문서를 확인해줘.

목표:
- /w/clair-demo/reception?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501 진입 시 김하늘/콩이/구토 내원 맥락이 더 자연스럽게 보이게 해줘.
- 접수 카드, 상세 drawer, 환자/보호자 context에서 보호자, 환자, 증상, 담당 수의사, encounter가 같은 이야기로 읽히게 다듬어줘.
- 화면 첫 인상에서 "이 환자가 오늘 왜 왔는지"가 명확해야 해.
- session-only prototype이라는 전제는 유지해줘.

소유 파일:
- src/features/reception/*
- tests/reception.spec.ts

가능하면 피할 파일:
- src/shell/app-shell.tsx
- tests/sales-demo-flow.spec.ts
- src/features/chart/*
- src/features/lab-imaging/*
- src/features/billing/*
- src/features/dispensing/*
- src/mocks/emr-domain.ts
- src/lib/emr-domain/demo-scenarios.ts

구현 가이드:
- 새 backend/API/auth/persistence를 만들지 마.
- demo seed data가 부족하면 직접 대수정하지 말고, 필요한 데이터 gap을 문서나 PR 설명에 남겨줘.
- 조제/처치 화면은 건드리지 마.
- 공통 컴포넌트 추출은 꼭 필요한 경우에만 해줘.
- reference image가 없으면 pixel alignment를 주장하지 마.

테스트:
- npx playwright test tests/reception.spec.ts --reporter=line
- npx playwright test tests/demo-scenarios.spec.ts --reporter=line
- 변경이 URL/panel state에 닿았다면 npx playwright test tests/app-shell.spec.ts --reporter=line

완료 기준:
- kong-vomit query로 접수 화면을 열었을 때 콩이/김하늘 맥락이 우선 선택 또는 우선 노출된다.
- 기존 코코/두부/나비/하루 fixture 기반 접수 테스트가 깨지지 않는다.
- PR 설명에 변경한 UX 의도, 건드린 파일, 테스트 결과를 간략히 적어줘.
```

## Prompt B: Chart/SOAP/Order Continuity

```text
sales demo spine이 main에 들어갔어. Wave 2 중 "Chart/SOAP/Order Continuity"를 맡아줘.

작업 시작:
1. 원본 repo에서 최신 main 기준으로 worktree를 만들어줘.

   git fetch origin
   git worktree add ../emr-app-shell-prototype-wave2-chart -b codex/wave2-chart-soap-order-continuity origin/main
   cd ../emr-app-shell-prototype-wave2-chart
   test -d node_modules || npm install

2. 먼저 아래 문서를 읽어줘.
   - AGENTS.md
   - docs/engineering/current-status.md
   - docs/archive/sales-demo/demo-sales-strategy.md
   - docs/archive/sales-demo/sales-demo-readiness-audit.md
   - docs/archive/implementation-waves/mvp-parallel-workstreams.md
   - docs/archive/sales-demo/sales-demo-wave2-parallel-prompts.md

3. Next.js application code를 수정하기 전에 node_modules/next/dist/docs/에서 App Router/search params 관련 문서를 확인해줘.

목표:
- /w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501 진입 시 콩이의 SOAP, Assessment, order 맥락이 한 흐름으로 읽히게 해줘.
- 수의사가 "대기열에서 콩이를 열고, 주관/객관/평가/계획과 검사/영상/조제/처치 오더를 확인한다"는 데모 beat가 자연스러워야 해.
- 오더 목록은 검사/영상/조제/처치/수납과 이어지는 설명이 가능해야 해.

소유 파일:
- src/features/chart/module.tsx
- tests/chart.spec.ts

가능하면 피할 파일:
- src/shell/app-shell.tsx
- tests/sales-demo-flow.spec.ts
- src/features/reception/*
- src/features/lab-imaging/*
- src/features/billing/*
- src/features/dispensing/*
- src/mocks/emr-domain.ts
- src/lib/emr-domain/demo-scenarios.ts

구현 가이드:
- 새 persistence나 실제 SOAP 저장 API를 만들지 마.
- 기존 chart queue/history selection 동작은 유지해줘.
- demo scenario가 없을 때 기존 기본 선택 동작이 깨지면 안 돼.
- UI polish는 데모 narrative를 분명히 하는 범위로 제한해줘.

테스트:
- npx playwright test tests/chart.spec.ts --reporter=line
- npx playwright test tests/demo-scenarios.spec.ts --reporter=line
- shell query/panel state를 건드렸다면 npx playwright test tests/app-shell.spec.ts --reporter=line

완료 기준:
- kong-vomit query로 진료 화면을 열었을 때 콩이 encounter가 우선 맥락으로 보인다.
- SOAP/Assessment/order 영역에서 급성 위장관염 의심과 구토 완화 처방이 데모 문맥으로 설명 가능하다.
- 기존 chart 테스트가 깨지지 않는다.
```

## Prompt C: Lab/Imaging Result Flow

```text
sales demo spine이 main에 들어갔어. Wave 2 중 "Lab/Imaging Result Flow"를 맡아줘.

작업 시작:
1. 원본 repo에서 최신 main 기준으로 worktree를 만들어줘.

   git fetch origin
   git worktree add ../emr-app-shell-prototype-wave2-lab-imaging -b codex/wave2-lab-imaging-continuity origin/main
   cd ../emr-app-shell-prototype-wave2-lab-imaging
   test -d node_modules || npm install

2. 먼저 아래 문서를 읽어줘.
   - AGENTS.md
   - docs/engineering/current-status.md
   - docs/archive/sales-demo/demo-sales-strategy.md
   - docs/archive/sales-demo/sales-demo-readiness-audit.md
   - docs/archive/implementation-waves/mvp-parallel-workstreams.md
   - docs/archive/sales-demo/sales-demo-wave2-parallel-prompts.md

3. Next.js application code를 수정하기 전에 node_modules/next/dist/docs/에서 App Router/search params 관련 문서를 확인해줘.

목표:
- /w/clair-demo/lab?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc 진입 시 콩이 CBC 결과 흐름이 명확해야 해.
- /w/clair-demo/imaging?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&imagingStudyId=imaging-kong-abdomen 진입 시 복부 영상 판독과 종합소견이 명확해야 해.
- 검사/영상 담당자가 결과를 확인하고 수의사/수납으로 이어진다는 데모 설명이 가능해야 해.

소유 파일:
- src/features/lab-imaging/module.tsx
- tests/lab-imaging.spec.ts

가능하면 피할 파일:
- src/shell/app-shell.tsx
- tests/sales-demo-flow.spec.ts
- src/features/reception/*
- src/features/chart/*
- src/features/billing/*
- src/features/dispensing/*
- src/mocks/emr-domain.ts
- src/lib/emr-domain/demo-scenarios.ts

구현 가이드:
- lab과 imaging이 같은 module file을 공유하므로 변경 범위를 작게 유지해줘.
- 기존 검사/영상 기본 테스트와 기존 fixture가 깨지면 안 돼.
- 장비 수신, 첨부, 결과 입력 UI를 새 backend로 연결하지 마.
- reference image가 없으므로 pixel-perfect alignment를 주장하지 마.

테스트:
- npx playwright test tests/lab-imaging.spec.ts --reporter=line
- npx playwright test tests/demo-scenarios.spec.ts --reporter=line
- shell query/panel state를 건드렸다면 npx playwright test tests/app-shell.spec.ts --reporter=line

완료 기준:
- kong-vomit query로 lab/imaging 화면을 각각 열면 콩이 결과가 우선 표시된다.
- CBC WBC 21.4, 복부 영상 판독/종합소견이 데모 중 설명 가능하다.
- 기존 lab/imaging tests가 깨지지 않는다.
```

## Prompt D: Billing Sales Polish

```text
sales demo spine이 main에 들어갔어. Wave 2 중 "Billing Sales Polish"를 맡아줘.

작업 시작:
1. 원본 repo에서 최신 main 기준으로 worktree를 만들어줘.

   git fetch origin
   git worktree add ../emr-app-shell-prototype-wave2-billing -b codex/wave2-billing-sales-polish origin/main
   cd ../emr-app-shell-prototype-wave2-billing
   test -d node_modules || npm install

2. 먼저 아래 문서를 읽어줘.
   - AGENTS.md
   - docs/engineering/current-status.md
   - docs/archive/sales-demo/demo-sales-strategy.md
   - docs/archive/sales-demo/sales-demo-readiness-audit.md
   - docs/archive/implementation-waves/mvp-parallel-workstreams.md
   - docs/archive/sales-demo/sales-demo-wave2-parallel-prompts.md

3. Next.js application code를 수정하기 전에 node_modules/next/dist/docs/에서 App Router/search params 관련 문서를 확인해줘.

목표:
- /w/clair-demo/billing?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&invoiceId=invoice-kong-260501 진입 시 콩이 청구가 바로 설명 가능해야 해.
- 진료/검사/영상/조제/처치 항목이 156,500원 수납 흐름으로 자연스럽게 읽혀야 해.
- 상태 label, 금액 표시, CTA hierarchy, 빈 상태/완료 상태 문구를 세일즈 데모 관점에서 다듬어줘.

소유 파일:
- src/features/billing/module.tsx
- tests/billing.spec.ts

가능하면 피할 파일:
- src/shell/app-shell.tsx
- tests/sales-demo-flow.spec.ts
- src/features/reception/*
- src/features/chart/*
- src/features/lab-imaging/*
- src/features/dispensing/*
- src/mocks/emr-domain.ts
- src/lib/emr-domain/demo-scenarios.ts
- src/lib/emr-domain/service-catalog.ts

구현 가이드:
- 실제 결제, PG, 현금영수증, 영수증 출력 연동은 만들지 마.
- session-only payment completion은 유지해도 된다.
- 기존 billing queue, unpaid/closed side panel, payment action 동작은 깨지면 안 돼.
- 서비스 카탈로그나 invoice seed를 대수정하지 마. 데이터 gap은 PR 설명에 남겨줘.

테스트:
- npx playwright test tests/billing.spec.ts --reporter=line
- npx playwright test tests/demo-scenarios.spec.ts --reporter=line
- shell query/panel state를 건드렸다면 npx playwright test tests/app-shell.spec.ts --reporter=line

완료 기준:
- kong-vomit query로 수납 화면을 열면 INV-260501-0003, 콩이, 김하늘, 156,500원이 명확히 보인다.
- 수납 완료 액션 후 완료 상태가 데모 중 자연스럽게 설명 가능하다.
- 기존 billing tests가 깨지지 않는다.
```

## Prompt E: Demo Flow Integration

```text
sales demo spine이 main에 들어갔어. Wave 2 중 "Demo Flow Integration"을 맡아줘.

이 작업은 네 개 화면별 Wave 2 PR이 올라오거나 병합된 뒤 마지막에 진행하는 통합 작업이야. shell URL query 보존, golden path Playwright, 충돌 조정은 이 채팅만 소유한다.

작업 시작:
1. 원본 repo에서 최신 main 기준으로 worktree를 만들어줘.

   git fetch origin
   git worktree add ../emr-app-shell-prototype-wave2-integration -b codex/wave2-demo-flow-integration origin/main
   cd ../emr-app-shell-prototype-wave2-integration
   test -d node_modules || npm install

2. 먼저 아래 문서를 읽어줘.
   - AGENTS.md
   - docs/engineering/current-status.md
   - docs/archive/sales-demo/demo-sales-strategy.md
   - docs/archive/sales-demo/sales-demo-readiness-audit.md
   - docs/archive/implementation-waves/mvp-parallel-workstreams.md
   - docs/archive/sales-demo/sales-demo-wave2-parallel-prompts.md

3. Next.js application code를 수정하기 전에 node_modules/next/dist/docs/에서 App Router/search params, Link, navigation 관련 문서를 확인해줘.

목표:
- Wave 2 화면별 PR들이 병합된 뒤, 접수 -> 진료 -> 검사/영상 -> 조제/처치 설명 -> 수납까지 `kong-vomit` golden path가 끊기지 않는지 검증해줘.
- `scenario`, `patientId`, `encounterId`, `labResultId`, `imagingStudyId`, `invoiceId` 같은 query가 shell layout sync 중 사라지지 않게 유지해줘.
- `tests/sales-demo-flow.spec.ts`를 golden path 기준으로 강화하되, 화면별 채팅이 소유한 module spec과 중복이 너무 커지지 않게 해줘.
- 조제/처치 화면은 디자인/동작을 바꾸지 않고, golden path에서 접근 가능하고 설명 가능한지만 확인해줘.

소유 파일:
- src/shell/app-shell.tsx
- tests/app-shell.spec.ts
- tests/sales-demo-flow.spec.ts
- docs/implementation/* 중 integration 결과 기록이 필요한 문서

가능하면 피할 파일:
- src/features/reception/*, 단 merge conflict 해결 또는 tiny URL integration fix는 허용
- src/features/chart/*, 단 merge conflict 해결 또는 tiny URL integration fix는 허용
- src/features/lab-imaging/*, 단 merge conflict 해결 또는 tiny URL integration fix는 허용
- src/features/billing/*, 단 merge conflict 해결 또는 tiny URL integration fix는 허용
- src/features/dispensing/* 디자인/동작 변경 금지
- src/mocks/emr-domain.ts 대수정 금지

구현 가이드:
- 이 작업은 polish branch가 아니라 integration branch다. 화면 디자인을 새로 다듬지 마.
- feature branch들의 변경이 충돌하면 기능별 의도를 보존하면서 최소 수정으로 합쳐줘.
- shell URL sync를 바꾸면 반드시 app-shell regression을 돌려줘.
- 새로고침 후 persistence를 약속하지 않는다.

테스트:
- npx playwright test tests/sales-demo-flow.spec.ts --reporter=line
- npx playwright test tests/app-shell.spec.ts --reporter=line
- npx playwright test tests/reception.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/billing.spec.ts --reporter=line
- npm run lint
- npx tsc --noEmit
- npm run build
- npx playwright test --reporter=line

완료 기준:
- full Playwright가 통과한다.
- golden path가 home launcher에서 시작해 각 주요 화면 query context를 유지한다.
- 조제/처치 회귀가 깨지지 않는다.
- PR 설명에 병합한 Wave 2 범위, 남은 gap, 실행한 테스트를 정리해줘.
```

## Coordinator Checklist

병렬 작업을 시작하는 사람이 각 채팅을 열기 전에 확인할 것:

- [ ] `main`에 `sales demo spine`과 `fix: guard stale shell url sync`가 들어갔는지 확인한다.
- [ ] 각 채팅에 위 프롬프트 하나만 붙여넣는다.
- [ ] 동시에 같은 branch/worktree를 두 채팅에서 쓰지 않는다.
- [ ] 화면별 채팅에는 `tests/sales-demo-flow.spec.ts`를 수정하지 말라고 유지한다.
- [ ] integration 채팅은 마지막에 시작하거나, 최소한 화면별 PR들이 올라온 뒤 최신 `origin/main`으로 rebase한다.
- [ ] 각 PR 설명에 테스트 결과를 반드시 남긴다.

## Expected Output Per Workstream

각 채팅이 완료 시 남겨야 할 정보:

- branch name
- changed files
- UX/flow change summary
- tests run and result
- known gaps or handoff notes for integration
