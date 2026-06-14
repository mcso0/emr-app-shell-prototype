---
id: RA-EPIC-001
status: draft
area: product
doc_type: epic
last_updated: 2026-06-14
---

# 예약 환자 접수 처리

## Purpose

예약 환자가 실제로 병원에 도착했을 때, 기존 appointment를 오늘의 encounter와 진료 대기열로 전환한다.

## Background

예약은 아직 내원이 확정된 운영 업무가 아니다. 보호자와 환자가 병원에 도착해 확인되는 순간부터 병원 내부 업무가 시작된다. 따라서 예약 환자 접수 처리는 예약 데이터와 당일 encounter/queue 데이터를 연결하는 핵심 전환점이다.

## Scope

Included:

- 예약확정 또는 지연 상태의 appointment를 접수 처리한다.
- 보호자, 환자, 예약 시간, 방문 목적, 담당 수의사를 확인한다.
- 접수 처리 전에 담당 수의사, 방문 목적, 진료과, 메모를 보정할 수 있다.
- 접수 완료 시 appointment status는 접수완료가 되고, encounter는 진료대기 상태로 생성된다.
- 이미 접수완료, 취소, 노쇼 상태인 예약은 중복 접수할 수 없다.

Out of scope:

- 외부 메시지 발송.
- 자동 리마인더.
- live DB/API persistence 구현.
- 결제, 수납, 영수증 처리.

## Primary User Stories

| ID | User Story |
|---|---|
| RA-US-001 | 데스크 직원으로서 예약 환자가 도착했을 때 예약 정보를 확인하고 접수 처리하여 진료 대기열에 올리고 싶다. |
| RA-US-002 | 수의사로서 작은 병원 상황에서 예약 환자의 도착을 직접 확인하고 접수 처리할 수 있어야 한다. |
| RA-US-003 | 데스크 직원으로서 보호자가 늦게 도착했거나 예약 내용이 바뀐 경우 접수 전에 담당 수의사나 방문 목적을 보정하고 싶다. |

## Main Flow

1. 사용자가 선택 날짜의 예약 목록 또는 캘린더에서 예약 항목을 선택한다.
2. 시스템은 보호자, 환자, 예약 시간, 방문 목적, 담당 수의사, 예약 상태를 보여준다.
3. 사용자는 필요한 경우 접수 전에 담당 수의사, 방문 목적, 진료과, 메모를 수정한다.
4. 사용자가 접수 처리를 실행한다.
5. 시스템은 appointment를 접수완료 상태로 바꾸고 encounter를 생성한다.
6. 시스템은 생성된 encounter를 진료대기 상태로 대기열에 표시한다.

## Acceptance Criteria

- 예약확정 또는 지연 상태의 appointment만 접수 처리할 수 있다.
- 접수 처리 후 같은 appointment를 다시 접수 처리할 수 없다.
- encounter는 appointment id와 연결되어야 한다.
- 대기열에는 환자명, 보호자명, 담당 수의사, 접수 시각, 방문 목적, 상태가 표시되어야 한다.
- 수의사 미지정 예약도 접수 처리할 수 있어야 한다.
- 실패 문구는 정중한 서비스 톤을 사용한다. 예: `접수 정보를 불러오지 못했습니다.`

## Done Criteria

- 예약 환자 접수 처리의 기본 흐름이 Feature Spec과 일치한다.
- 권한 기준은 데스크, 수의사, 병원 관리자 가능 / 수의테크니션 제한으로 정리된다.
- 중복 접수, 취소 예약, 노쇼 예약, 날짜 불일치 같은 예외 케이스가 UX에 반영된다.
- Current State / Gap Review에서 현재 구현과의 차이를 확인할 수 있다.

## Exception Cases

| Case | Recommended Handling |
|---|---|
| 이미 접수완료된 예약 | 중복 접수 차단, 기존 encounter로 이동 |
| 취소된 예약 | 접수 처리 차단, 재예약 또는 새 현장 접수 안내 |
| 노쇼 처리된 예약 | 직접 접수 차단, 관리자 또는 권한 있는 사용자의 상태 복구 필요 |
| 선택 날짜와 예약 날짜 불일치 | 선택 날짜 기준 경고 후 해당 예약 날짜로 이동 |
| 보호자/환자 정보 불완전 | 접수 저장 전 필수 정보 보완 요청 |

## Related Documents

- [Reception / Appointment Overview](../README.md)
- [Users / Roles](../users-roles.md)
- [Feature Spec](../../reception-appointment-spec.md)
- [Current State](../../../current-state/reception-appointment-current-state.md)
