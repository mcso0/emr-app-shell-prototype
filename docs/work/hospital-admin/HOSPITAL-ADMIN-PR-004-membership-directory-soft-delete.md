---
id: HOSPITAL-ADMIN-PR-004
title: 병원 구성원 디렉터리와 구성원·역할·직무 lifecycle
status: in_progress
area: hospital-admin
---

# 병원 구성원 디렉터리와 구성원·역할·직무 lifecycle

## 목표

구성원·초대 목록을 검색, 상태 탭, 상세 Sheet, 상태별 작업 메뉴가 있는 운영 디렉터리로 전환한다. 구성원은 삭제가 아니라 `보관됨` lifecycle로 관리하고, 역할과 직무 정의는 별도 관리 화면에서 승인된 비활성화 규칙을 따른다.

## 범위

* `활성`, `초대 대기`, `비활성`, `보관됨` 목록과 검색·직무·부서 필터
* 구성원 상세 Sheet, 상태별 더보기 메뉴, 구성원 보관 및 inactive 복구
* 커스텀 역할 비활성화 시 활성·비활성 구성원과 초대 대기의 대체 역할 일괄 적용
* 직무 비활성화 시 기존 구성원 배정 유지, 신규 선택 차단, 초대 대기의 대체 직무 적용
* DB 보관 메타데이터, permission-checked archive API, audit event

## 제외

* 영구 삭제, 사용자 계정 삭제, 자동 삭제 스케줄러, 90일 영구 삭제 검토
* 실제 이메일 발송 및 외부 identity provider 연동

## 제품 계약

* [Membership, Permission Role, and Job Position Lifecycle](../../product/domain/membership-role-job-lifecycle.md)
* [Workspace Auth and Permissions](../../product/domain/workspace-auth-permissions.md)
* [Role / Job Position Source Map](../../product/domain/role-permission-source-map.md)

## 구현 전제

* 기존 `soft_deleted` 구현 초안은 승인된 제품 용어와 다르므로 새 forward migration과 호환 전환이 필요하다.
* 이미 migration history에 기록된 migration 파일을 수정해 기존 환경을 바꾸지 않는다.
* 원격 migration history 정합화가 완료되기 전에는 원격 스키마 push를 진행하지 않는다.

## 검증

* archive route 권한·본인 조작·복구·마지막 소유자 계약 테스트
* 역할 대체, 직무 초대 대체, migration 호환 전환 및 RLS 테스트
* 구성원 상태 reader/UI 회귀 테스트
