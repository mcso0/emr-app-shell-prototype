---
id: HOSPITAL-ADMIN-PR-004
title: 병원 구성원 디렉터리와 복구 가능한 구성원 삭제
status: in_progress
area: hospital-admin
---

# 병원 구성원 디렉터리와 복구 가능한 구성원 삭제

## 목표

구성원·초대 목록을 검색, 상태 탭, 상세 Sheet, 상태별 작업 메뉴가 있는 운영 디렉터리로 전환한다. 역할과 직무 정의는 `역할별 업무 관리` 화면에서 관리하고, 초대에서는 선택만 제공한다.

## 범위

* `활성`, `초대 대기`, `비활성`, `삭제됨` 목록과 검색·직무·부서 필터
* 구성원 상세 Sheet, 상태별 더보기 메뉴, Soft delete 및 inactive 복구
* DB 삭제 메타데이터, permission-checked archive API, audit event
* 90일 검토 예정일 표시는 가능하되 자동 영구 삭제는 하지 않음

## 제외

* 영구 삭제, 사용자 계정 삭제, 자동 삭제 스케줄러
* 실제 이메일 발송 및 외부 identity provider 연동

## 검증

* archive route 권한·본인 조작·복구 계약 테스트
* migration 정적 보호 테스트
* 구성원 상태 reader/UI 회귀 테스트
