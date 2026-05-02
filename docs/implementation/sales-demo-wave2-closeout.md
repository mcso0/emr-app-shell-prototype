# Sales Demo Wave 2 Closeout

Updated: 2026-05-02

이 문서는 `sales demo spine` 병합 이후 진행한 Wave 2 병렬 작업의 완료 범위, 검증 결과, 남은 gap, 다음 추천 작업을 정리한다.

## Summary

Wave 2는 **접수 -> 진료 -> 검사/영상 -> 조제/처치 -> 수납**까지 `김하늘 / 콩이 / 구토 내원` 골든 시나리오가 실제 화면 전환과 query context 안에서 끊기지 않게 보이도록 다듬은 단계다.

결과적으로 `main`은 다음을 만족한다.

- `/w/clair-demo/home`에서 시작한 `kong-vomit` 시나리오가 주요 업무 화면으로 이어진다.
- 접수, 진료, 검사, 영상, 수납 화면은 `scenario`, `patientId`, `encounterId` 등 데모 query를 우선 맥락으로 사용한다.
- shell navigation은 layout query와 demo query를 함께 보존한다.
- 조제/처치 화면은 기존 디자인과 동작을 보존하면서 golden path에서 접근 가능하다.
- 전체 Playwright suite가 `69 passed`로 통과한다.

## Mainline Commits And PR

| Item | Status | Notes |
|---|---|---|
| `77ee75d` | Merged | Reception/Patient continuity: 접수 화면과 환자/보호자 drawer의 콩이 데모 맥락 강화 |
| `d48f4f1` | Merged | Chart/SOAP/Order continuity: 콩이 SOAP, Assessment, order 흐름 강화 |
| `90ba9cf` | Merged | Lab/Imaging continuity: CBC 결과와 복부 영상 판독 흐름 강화 |
| `a4a39a3` | Merged | Billing sales polish: 콩이 invoice, 금액, 수납 완료 흐름 강화 |
| `44a0255` | Merged branch commit | Demo Flow Integration branch commit |
| `e5c6775` | Merged to `main` | PR #7 merge result: [Integrate Wave 2 demo flow](https://github.com/mcso0/emr-app-shell-prototype/pull/7) |

## Workstream Results

| Workstream | Branch | Result |
|---|---|---|
| Reception/Patient Continuity | `codex/wave2-reception-patient-continuity` | `kong-vomit` query로 접수 화면을 열면 김하늘/콩이/구토 내원 맥락이 우선 노출된다. |
| Chart/SOAP/Order Continuity | `codex/wave2-chart-soap-order-continuity` | 진료 화면에서 콩이 SOAP, 급성 위장관염 의심 Assessment, 검사/영상/조제/처치 order가 한 흐름으로 읽힌다. |
| Lab/Imaging Result Flow | `codex/wave2-lab-imaging-continuity` | 검사 화면은 CBC 결과를, 영상 화면은 복부 영상 판독/종합소견을 데모 query 기준으로 우선 표시한다. |
| Billing Sales Polish | `codex/wave2-billing-sales-polish` | 수납 화면에서 `INV-260501-0003`, 김하늘/콩이, `156,500원`, 수납 완료 상태가 데모 설명에 맞게 정리됐다. |
| Demo Flow Integration | `codex/wave2-demo-flow-integration` | shell query 보존, nav rail demo context propagation, golden path Playwright coverage를 통합했다. |

## Files Touched Across Wave 2

Feature modules:

- `src/features/reception/data.ts`
- `src/features/reception/module.tsx`
- `src/features/reception/profile-drawer.tsx`
- `src/features/chart/module.tsx`
- `src/features/lab-imaging/module.tsx`
- `src/features/billing/module.tsx`

Shell and routing:

- `src/shell/app-shell.tsx`
- `src/shell/nav-rail.tsx`

Tests:

- `tests/reception.spec.ts`
- `tests/chart.spec.ts`
- `tests/lab-imaging.spec.ts`
- `tests/billing.spec.ts`
- `tests/app-shell.spec.ts`
- `tests/sales-demo-flow.spec.ts`

Docs:

- `docs/implementation/sales-demo-readiness-audit.md`
- `docs/implementation/sales-demo-wave2-closeout.md`

## Verification

Verified on `main` after PR #7 merge:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright test --reporter=line
```

Result:

```text
69 passed
```

Focused coverage added or strengthened:

- `tests/reception.spec.ts`: Kong demo context is prioritized from query params.
- `tests/chart.spec.ts`: Kong scenario opens as one SOAP, assessment, and order flow.
- `tests/lab-imaging.spec.ts`: Kong CBC result and abdomen imaging study are prioritized from demo query.
- `tests/billing.spec.ts`: Kong invoice opens from query and completion state is explainable.
- `tests/app-shell.spec.ts`: shell navigation keeps demo query context across modules.
- `tests/sales-demo-flow.spec.ts`: home launcher carries the Kong scenario through the golden path.

## Preserved Boundaries

- 조제/처치 화면의 existing design and behavior are preserved.
- Backend, DB, real auth enforcement, payment, PACS, KakaoTalk, Excel, inpatient, and full hospital-admin screens remain out of scope.
- Demo state remains mock/session-only. Refresh persistence is not promised.
- Existing 코코/두부/나비/하루 fixtures remain part of the prototype baseline.

## Remaining Gaps

These are not blockers for Wave 2 completion, but should be considered before a live sales demo.

- `docs/assets/reference-screens/*` still lacks most binary reference images.
- The demo has automated golden path coverage, but still needs a human 7-minute rehearsal script pass.
- The prototype does not yet have a one-click demo reset.
- Role-specific entry exists through mock auth and launcher context, but role-based enforcement remains intentionally out of scope.
- Final sales copy, objection-handling notes, and demo talk track are still outside the codebase.

## Recommended Next Work

Recommended next step: **Sales Demo Closeout & Rehearsal**.

Suggested tasks:

1. Write a concise 7-minute talk track for `김하늘 / 콩이 / 구토 내원`.
2. Run the demo manually in the browser and record any moments that require verbal explanation.
3. Add missing reference screenshots only if they will guide a concrete UI polish pass.
4. Decide whether a one-click demo reset is worth adding before the first external sales conversation.
5. Keep product MVP backend/auth/payment work separate from the Sales Demo Prototype closeout.

