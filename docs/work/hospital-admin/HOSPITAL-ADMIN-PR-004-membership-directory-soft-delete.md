---
id: HOSPITAL-ADMIN-PR-004
title: 병원 구성원 디렉터리와 구성원·역할·직무 lifecycle
status: human_review
area: hospital-admin
---

# 병원 구성원 디렉터리와 구성원·역할·직무 lifecycle

## 목표

구성원·초대 목록을 검색, 상태 탭, 비모달 상세 패널, 상태별 작업 메뉴가 있는 운영 디렉터리로 전환한다. 구성원은 삭제가 아니라 `보관됨` lifecycle로 관리하고, 역할과 직무 정의는 별도 관리 화면에서 승인된 비활성화 규칙을 따른다.

## 범위

* `활성`, `초대 대기`, `비활성`, `보관됨` 목록과 검색·직무·부서 필터
* 구성원 상세 우측 패널, 상태별 더보기 메뉴, 구성원 보관 및 inactive 복구
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
* 원격 migration history 정합화가 완료되기 전에는 원격 스키마 push를 진행하지 않는다. 이 조건은 2026-07-12의 격리 release bundle과 후속 ENGINEERING-DB-PR-001 이력 정리로 충족했다.

## 구현 계획

* [Membership, Permission Role, and Job Position Lifecycle Implementation Plan](../../superpowers/plans/2026-07-11-membership-role-job-lifecycle.md)

## 검증

* archive route 권한·본인 조작·복구·마지막 소유자 계약 테스트
* 역할 대체, 직무 초대 대체, migration 호환 전환 및 RLS 테스트
* 구성원 상태 reader/UI 회귀 테스트

## 구현 결과

* 구성원 상태를 `활성 / 비활성 / 보관됨`으로 정리하고, 복구 결과를 항상 비활성으로 제한했다.
* 구성원 lifecycle 변경과 감사 이벤트를 동일 DB 트랜잭션에서 기록한다.
* 커스텀 역할 비활성화는 활성·비활성 구성원과 대기 초대를 대체 역할로 이동하며 보관 이력은 유지한다.
* 직무 비활성화는 구성원 배정을 유지하고 대기 초대에만 대체 직무를 적용한다.
* 역할·직무 정의 관리 화면을 서버 API와 연결하고 비활성 정의를 신규 선택에서 제외했다.
* 직접 테이블 mutation 권한을 회수해 lifecycle RPC 보안 경계를 우회하지 못하도록 했다.

### 2026-07-22 화면 구성 보완

* 검색 옆 분류 필터는 원시 값 `all` 대신 `모든 직군`, `모든 부서`를 항상 표시한다.
* 구성원 상세는 기존 직원 운영 프로필과 동일한 `380px` 우측 패널 토큰, 헤더 높이, 탭 구조를 사용한다.
* 상세 패널은 dim/blur 없이 테이블과 함께 열리며, 다른 검색·행 선택을 계속할 수 있다.
* 직원 초대와 초대 정보 수정은 배경을 비활성화하는 중앙 `Dialog`로 전환해 단일 입력 업무에 집중하도록 했다.
* 기존 멤버십 권한, 보관/복구, 초대 상태와 API 경계는 변경하지 않았다. 실제 이메일 발송도 계속 제외한다.

## 검증 결과

* 로컬 Supabase 전체 migration replay 성공
* 구성원·초대·역할·직무 관련 Playwright 77건 중 74건 통과, 실패 3건 중 2건 단독 재실행 통과
* 잔여 1건은 로컬 DB reset 뒤 테스트 전용 workspace bootstrap 대기 timeout으로 기록
* 구성원 디렉터리와 역할·직무 관리 화면 브라우저 QA 완료
* `npx tsc --noEmit` 및 변경 UI ESLint 통과
* 전체 release gate 결과는 PR/릴리스 보고서에 기록한다.
* 2026-07-22 화면 보완은 필터 표시, 비모달 패널, Escape/포커스 복귀, 중앙 초대 Dialog 회귀 테스트로 검증한다.

## 화면 보완 결과 보고서

* [2026-07-22 병원 구성원 화면 구성 보완 결과](../../completed/hospital-admin/2026-07-22-membership-management-surface-refinement-report.html)

## 릴리스 주의

새 API와 원격 DB migration은 같은 릴리스 단위로 적용해야 한다. PR #329와 migration `20260711162828`, `20260711164114`, `20260711164859`는 2026-07-12에 함께 production 반영됐다. 이후 migration 이력 운영은 [Supabase Migration History Reconciliation](../../engineering/operations/supabase-migration-history-reconciliation.md)을 따른다.
