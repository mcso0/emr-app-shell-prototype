---
id: PRODUCT-FEATURE-RECEPTION-APPOINTMENT-OVERVIEW
status: draft
area: product
doc_type: feature-overview
last_updated: 2026-06-14
---

# Reception / Appointment Overview

접수 / 예약은 병원의 외래 업무가 운영 흐름으로 들어오는 시작점이다.

예약은 미래 또는 예정된 내원 약속이고, 접수는 환자가 실제로 병원에 도착해 오늘의 진료 업무가 시작되는 시점이다. 이 패키지는 예약 생성/변경/취소, 현장 접수, 예약 환자 접수 처리, 캘린더 운영, 대기열 진입 기준을 한 곳에서 찾기 위한 기능별 기획 묶음이다.

## Package Map

| 문서 | 역할 |
|---|---|
| [Users / Roles](./users-roles.md) | 주요 사용자와 권한 경계 |
| [Feature Spec](../reception-appointment-spec.md) | 접수/예약의 상세 기능 명세와 상태 모델 |
| [Epic Index](./epics/README.md) | 큰 작업 단위와 Epic 상세 문서 |
| [Current State](../../current-state/reception-appointment-current-state.md) | 현재 구현된 화면과 기능 인벤토리 |

## Product Boundary

- 포함: 현장 접수, 예약 생성/변경/취소, 예약 환자 접수 처리, 선택 날짜 기준 캘린더와 접수/예약 목록, 지연/노쇼/취소 상태 관리.
- 제외: 외부 메시지 발송, 자동 리마인더, 예약 최적화, live DB/API persistence 구현, provider integration.
- 구현 문서가 아니라 product planning source다. 실제 개발 작업은 별도 work item에서 다룬다.

## Core Definitions

| 구분 | 예약 | 접수 |
|---|---|---|
| 의미 | 예정된 방문 약속 | 실제 내원 후 운영 시작 |
| 시간 | 미래 또는 오늘의 예정 시간 | 도착 이후 현재 업무 |
| 핵심 객체 | Appointment | Encounter / Queue |
| 결과 | 캘린더와 예약 목록에 표시 | 진료 대기열과 진료 흐름에 진입 |

## Related Source

- [Reception / Appointment Feature Spec](../reception-appointment-spec.md)
- [Outpatient Workflow State Model](../../domain/outpatient-workflow-state-model.md)
- [Reception Appointment Current State](../../current-state/reception-appointment-current-state.md)
