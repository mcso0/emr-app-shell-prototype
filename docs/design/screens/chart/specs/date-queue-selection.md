---
type: "screen-spec"
title: "진료/차트 날짜·대기열 선택 상태"
description: "진료/차트 화면의 날짜, 대기열, URL, 헤더와 콘텐츠를 하나의 선택 범위로 유지하는 상태 계약"
tags:
  - "chart"
  - "queue"
  - "operating-date"
status: "implemented"
related_work:
  - "CHART-PR-022"
last_updated: "2026-08-14"
---

# 진료/차트 날짜·대기열 선택 상태

## User Goal

사용자는 좌측에서 보고 있는 날짜와 본문 차트의 진료 일자가 같다고 신뢰할 수 있어야 한다. 업무가 있는 날짜에 진입하면 별도 선택 없이 바로 첫 업무를 시작할 수 있어야 한다.

## Single Scope

선택 날짜는 화면 전체의 기준이다. 다음 요소는 항상 같은 workspace와 날짜 범위를 사용한다.

- 진료 대기열 조회 및 선택 강조
- 선택 encounter와 workspace layout 선택
- 환자 정보 헤더와 차트 콘텐츠
- URL `encounterId`
- 날짜별 로딩, 빈 상태, 오류, 권한 상태

## State Matrix

| State | Queue | Header / actions | Content | URL |
| --- | --- | --- | --- | --- |
| Initial or date loading | 이전 범위 미사용 | 숨김 | 접근 가능한 로딩 상태 | 날짜 전환 시 encounter 관련 파라미터 제거 |
| Ready with tasks | 서버 정렬 순서 | 선택 업무 기준 표시 | 선택 차트 표시 | 선택 encounter로 replace 정규화 |
| Ready without tasks | 빈 목록 | 숨김 | `{YY.MM.DD(요일)}에 표시할 진료 업무가 없습니다.` | `encounterId`, `patientId`, `scenario` 없음 |
| Read error | 이전 범위 미사용 | 숨김 | 재시도 가능한 읽기 오류 | stale encounter 없음 |
| Permission denied | 이전 범위 미사용 | 숨김 | 권한 안내와 재시도 | stale encounter 없음 |

로딩 중에는 성공한 빈 조회가 아니므로 빈 상태를 표시하지 않는다. 오류와 권한 거부도 업무가 없다는 의미로 표현하지 않는다.

## Selection Priority

1. 선택 날짜 대기열에 포함된 URL `encounterId`
2. 같은 날짜 새로고침에서 아직 유효한 현재 선택
3. 서버 `sortOrder` 기준 첫 업무
4. 업무가 없으면 선택 없음

이전 날짜의 선택, sessionStorage 선택값, 현재 날짜 queue에 없는 URL encounter는 복구 후보가 아니다.

## Interaction Rules

- 날짜를 바꾸는 순간 이전 queue records, encounter 선택, layout 선택, `encounterId`, `patientId`, `scenario`를 해제한다.
- 자동 선택과 stale URL 정규화는 `replace`를 사용해 탭 방문 기록을 늘리지 않는다.
- 사용자가 queue card를 직접 고르는 동작은 기존 workspace navigation 흐름을 유지한다.
- 빠르게 날짜를 바꾸면 현재 workspace/date와 일치하는 최신 응답만 적용한다.
- 모듈 패널이 접혀 있어도 coordinator가 마운트되어 직접 링크와 자동 선택이 동작한다.
- 작성 중 보호는 기존 차트 간 이동의 저장 규칙을 그대로 사용하며 새 확인창을 추가하지 않는다.

## Accessibility and Responsive Behavior

- 로딩 컨테이너는 `role=status`와 polite live region을 사용한다.
- 날짜별 빈 상태, 읽기 오류, 권한 거부는 서로 다른 제목과 설명을 제공한다.
- 헤더와 콘텐츠를 숨기는 규칙은 viewport 크기나 모듈 패널 열림 상태와 무관하다.
