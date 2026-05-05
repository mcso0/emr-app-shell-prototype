---
id: CHART-PR-001
status: done
area: chart
priority: P1
target_pr: PR 1
last_updated: 2026-05-05
---

# Chart Workspace Restructure

## Goal

진료(차트) 화면을 조제/처치 workspace 구조와 맞춰 재구성한다. 기존 공통 shell 슬롯과 EMR 컴포넌트를 재사용해 진료 대기열, 환자 컨텍스트 바, 차트 이력, 우측 환자 패널, SOAP/Assessment/Order 본문을 분리한다.

## Scope

- `treatment` module에 `contentHeader`, `contentAside`, `rightPanel` 슬롯을 연결한다.
- 진료 대기열은 조제/처치 대기열 패널 컴포넌트를 optional 설정으로 재사용한다.
- 환자 컨텍스트 바는 기존 컴포넌트를 재사용하고 담당 수의사 표시를 추가한다.
- 차트 이력은 patient bar 아래 접이식 content aside로 이동한다.
- Assessment History와 환자/보호자 메모는 우측 환자 사이드 패널로 이동한다.
- Order 영역은 조제 전용 table을 직접 재사용하지 않고, 동일한 order group/table 패턴으로 chart domain data를 표시한다.
- SOAP 영역은 Tiptap 기반 편집기로 교체해 진단계통별 텍스트 템플릿, 기본 서식, 링크, 섹션 내부 첨부 슬롯, SOAP 추가 액션을 제공한다.
- 진단 코멘트와 Plan은 입력 가능한 textarea로 제공한다.
- 처방/오더 하단에는 오더 현황, 금액 요약, Order 청구/확정 액션을 오더 그룹 스크롤과 분리한 고정 footer로 제공한다.

## Out Of Scope

- 실제 저장, chart 생성, order 확정, chart 공유, 외부 연동 구현
- DB/API/Supabase persistence
- 조제/처치 화면의 기존 동작 변경

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`
