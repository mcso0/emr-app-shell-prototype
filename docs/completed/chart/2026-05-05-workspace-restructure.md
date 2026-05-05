---
id: CHART-CLOSEOUT-2026-05-05-WORKSPACE-RESTRUCTURE
status: completed
area: chart
work_item: CHART-PR-001
completed_at: 2026-05-05
---

# Chart Workspace Restructure Closeout

## Result

진료(차트) 화면을 조제/처치 workspace와 같은 슬롯 구조로 재구성했다. 좌측 진료 대기열, 상단 환자 컨텍스트 바, patient bar 아래 차트 이력, 우측 환자 사이드 패널, SOAP/Assessment/Order 본문이 각각 독립 슬롯으로 분리되었다.

## Notes

- 조제/처치 화면은 기존 동작을 유지했다.
- `EmrOrderQueueSidePanel`과 `EmrPatientContextBar`에는 chart에서 필요한 optional prop만 추가했다.
- SOAP는 Tiptap 기반 편집기로 교체했고, 진단계통별 고밀도 텍스트 템플릿, 기본 서식/링크, 섹션 내부 첨부 슬롯, SOAP 추가 UI를 제공한다.
- 진단 코멘트와 Plan은 입력 가능한 textarea로 제공한다.
- 처방/오더 하단 요약은 오더 그룹 스크롤과 분리한 고정 footer로 제공하고 Order 청구/확정 액션을 배치했다.
- 저장/확정/생성류 액션은 prototype UI 배치 범위로 유지했다.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`
