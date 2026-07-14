---
id: DESIGN-SYSTEM-STAFF-OPERATIONAL-PROFILE-DRAWER
type: Design Contract
title: Staff Operational Profile Drawer
description: Defines a reusable, read-oriented staff operational profile and its reception calendar entry interaction.
status: draft
area: design-system
doc_type: design-contract
tags:
  - staff
  - operational-profile
  - drawer
  - reception-calendar
  - workspace-membership
created: 2026-07-14
last_updated: 2026-07-14
---

# 직원 운영 프로필 드로우 기획

## 요약

직원 운영 프로필은 특정 수의사만을 위한 상세 화면이 아니라, 접수 캘린더·근무표·병원관리 등 여러 업무 화면에서 동일한 직원을 일관되게 확인하는 공통 조회 화면이다.

프로필은 다음 네 영역만 사용한다.

1. 모든 직원에게 공통인 기본 프로필
2. 운영 관리자가 관리하는 조직 정보
3. 근무표 원본에서 계산하는 기준일 근무
4. 현재 화면이 신뢰할 수 있는 원본 데이터를 가진 경우에만 표시하는 선택적 화면 정보

`담당 업무`, 업무 역량, 진료 분야, 수행 가능한 업무 목록은 이번 기능에 포함하지 않는다. 권한 역할, 직무, 오늘의 근무 배정을 업무 역량으로 변환하거나 추론해서도 안 된다.

## 사용자 목표

직원은 현재 업무 화면을 벗어나지 않고 다음을 빠르게 확인할 수 있어야 한다.

- 이 직원이 누구인지
- 어느 부서에서 어떤 직무와 직책을 맡고 있는지
- 조회 기준일에 근무하는지, 근무시간과 근무 위치가 무엇인지
- 현재 화면이 제공할 수 있는 추가 운영 정보가 있는지

접수 캘린더에서는 수의사 레인의 더보기 메뉴에서 해당 레인을 숨기거나 운영 프로필을 열 수 있어야 한다.

## 적용 화면

초기 진입점은 접수/예약 day calendar의 수의사 레인 헤더다. 공통 드로우는 이후 다음 화면에서도 같은 기본 계약으로 재사용할 수 있다.

- 접수/예약 캘린더
- 병원관리 구성원 목록
- 병원 근무표
- 직원 식별이 필요한 검사, 조제/처치 또는 운영 작업 화면

재사용은 공통 기본 프로필을 기준으로 한다. 화면별 정보가 없다는 이유로 빈 수의사 전용 섹션이나 직군별 가짜 요약을 만들지 않는다.

## 조사 근거

### 내부 근거

- 접수 캘린더는 이미 상단 수의사 필터와 `selectedVeterinarianIds` 표시 상태를 가진다. 레인 숨기기는 동일한 상태 변경을 재사용할 수 있다.
- 현재 workspace staff reader는 이름, 사진, 부서, 직책, 역할, 활성 상태를 제공한다.
- 개인 프로필 수정 route는 이름, 이니셜, 전화번호, 알림 설정만 본인이 수정하도록 제한하고 역할·권한·멤버십 필드를 차단한다.
- 직원 초대 route는 이메일, 권한 역할, 직무, 직책, 부서를 운영 관리자가 지정할 수 있다.
- 병원 근무표는 membership과 연결된 staff profile, shift 시간, work label, 위치 정보를 보유한다.
- 병원관리의 기존 구성원 상세 Sheet는 권한·멤버십 이력 중심이다. 공통 운영 프로필은 이 관리 상세를 복제하지 않는다.

### 외부 패턴

- Jane Schedule은 직원명 호버에서 일정 표시 전환과 직원 프로필 보기를 함께 제공한다. 캘린더 표시 제어와 사람 정보 조회를 같은 진입점에 두되 서로 다른 동작으로 분리하는 근거로 사용한다.
- Google Calendar는 캘린더별 표시/숨김을 개인 보기 상태로 처리한다. 레인 숨기기는 직원 정보나 공유 권한을 변경하는 관리 작업이 아니다.

References:

- https://jane.app/guide/working-with-the-schedule
- https://jane.app/guide/lesson-1-schedule
- https://support.google.com/calendar/answer/37188

## 정보 구조

### 1. 프로필 헤더

- 프로필 사진 또는 이니셜 fallback
- 표시 이름
- `직무 · 직책` 조합
- 부서
- 활성/비활성 상태

권한 역할, 사용자 ID, 최근 로그인, 멤버십 생성 이력은 일반 운영 프로필 헤더에 표시하지 않는다.

### 2. 조직 정보

- 직무
- 직책
- 부서
- 소속 상태
- 근무 지점이 별도 데이터로 존재하는 경우 근무 지점

직무는 조직 내 역할을 설명하는 표시 정보다. 시스템 권한 또는 실제 업무 역량과 동일한 의미로 사용하지 않는다.

### 3. 기준일 근무

근무표 원본에 조회 기준일의 shift가 있을 때 다음을 표시한다. 기준일이 오늘이면 section 제목을 `오늘 근무`, 다른 날짜면 `7월 15일 근무`처럼 표시한다.

- 시작·종료 시각
- 기준일 근무 label
- 근무 위치
- 현재 시각과 근무시간을 기준으로 계산한 `근무 전`, `근무 중`, `근무 종료`
- shift 종류가 휴가 또는 휴무인 경우 해당 상태

`휴게 중` 상태는 실제 휴게시간 또는 time-clock 데이터가 존재할 때만 표시한다. 근거 데이터가 없으면 시간만으로 휴게 상태를 추정하지 않는다. 과거·미래 기준일에는 현재 근무 상태를 계산하지 않고 `근무 종료` 또는 `근무 예정`으로 표시한다.

근무표 원본에 해당 직원이 없거나 오늘 shift가 없으면 `오늘 등록된 근무가 없어요`를 표시한다. 근무 데이터 조회 실패를 휴무나 빈 상태로 표현하지 않는다.

### 4. 선택적 화면 정보

화면별 정보는 공통 프로필에 저장하지 않는다. 프로필을 연 화면이 대상 직원과 연결된 신뢰 가능한 원본 데이터를 제공할 수 있을 때만 별도 section으로 붙인다.

접수 캘린더의 첫 적용에서는 다음 값만 허용한다.

- 선택 날짜의 예약 전체 건수
- 완료 또는 접수 처리된 건수
- 남은 예약 건수

이 section의 제목은 `선택 날짜 예약`으로 사용한다. 오늘이 아닌 날짜의 캘린더에서도 `오늘 예약`이라고 표시하지 않는다. 환자명, 보호자명, 진료 메모 같은 개인·진료 정보는 운영 프로필 요약에 포함하지 않는다.

지원하지 않는 역할이나 화면에서는 section 자체를 렌더링하지 않는다. `0건`과 `지원하지 않음`을 같은 상태로 취급하지 않는다.

## 정보 소유권과 수정 권한

| 정보 | 최초 입력 | 이후 수정 | 다른 직원 |
| --- | --- | --- | --- |
| 초대 이메일 | 운영 관리자 | 본인 인증·이메일 변경 정책 | 조회 범위에 따라 제한 |
| 직무·직책·부서 | 운영 관리자 | 권한 보유 운영 관리자 | 조회만 가능 |
| 권한 역할 | 운영 관리자 | 권한 보유 운영 관리자 | 운영 프로필에서 숨김 |
| 이름·이니셜 | 초대 수락자 또는 임시 기본값 | 본인 | 조회만 가능 |
| 프로필 사진 | 본인 | 본인 | 조회만 가능 |
| 개인 전화번호 | 본인 | 본인 | 기본 운영 프로필에서 숨김 |
| 업무용 연락처 | 운영 정책에 따른 관리자 또는 본인 | 승인된 주체 | 허용 범위에서 조회 |
| 기준일 근무 | 근무표 관리자 | 근무표 관리자 | 조회만 가능 |
| 화면별 운영 요약 | 시스템 계산 | 직접 수정 불가 | 권한 범위에서 조회 |

초대 수락 과정에서 표시 이름을 이메일 앞부분으로 임시 생성할 수 있지만, 최종 흐름은 수락 직후 본인이 이름·이니셜·사진을 확인하는 기본 프로필 설정 단계를 제공한다.

다른 직원의 프로필 수정은 UI에서 버튼을 숨기는 것만으로 완료되지 않는다. 서버 route와 DB/RLS 경계에서 대상 사용자와 actor 권한을 검증해야 한다.

## 접수 캘린더 진입 상호작용

### 레인 헤더

- 마우스 hover와 키보드 `focus-within`에서 오른쪽 더보기 icon button을 표시한다.
- touch 또는 hover를 사용할 수 없는 환경에서는 버튼을 항상 표시한다.
- 버튼 표시 여부가 이름 영역 너비를 바꾸지 않도록 액션 공간을 미리 확보한다.
- icon button은 최소 32px hit area와 `이수지 수의사 옵션` 같은 접근 가능한 이름을 가진다.
- 헤더의 기존 색상과 사진·이름 위계는 유지한다.

### 더보기 메뉴

메뉴는 두 항목만 제공한다.

1. `캘린더에서 숨기기`
   - 상단 수의사 필터에서 해당 수의사의 선택을 해제하는 것과 동일하다.
   - 개인의 현재 캘린더 보기 상태만 변경한다.
   - 직원 상태, 근무표, 예약, 공유 권한을 변경하지 않는다.
   - 마지막으로 보이는 수의사 한 명은 숨길 수 없다. 메뉴를 disabled 처리하고 `최소 1명의 수의사를 표시해야 해요` 설명을 제공한다.
2. `운영 프로필 보기`
   - 같은 workspace shell 위에서 공통 운영 프로필 드로우를 연다.
   - 기존 환자·접수 drawer가 열려 있으면 shell의 단일 drawer 정책에 따라 운영 프로필로 전환한다.

`보기 옵션`처럼 결과가 불분명한 추상 label은 사용하지 않는다. 메뉴 항목은 실행 결과를 직접 설명한다.

## 드로우 레이아웃

- desktop width: 440px 기준, 최소 400px에서 최대 480px 범위
- mobile: 화면 폭 전체를 사용하는 Sheet
- header: 프로필 사진, 이름, 조직 요약, 상태, 닫기
- body: `조직 정보` → `기준일 근무` → 선택적 화면 정보 순서
- footer: 일반 조회에서는 footer action을 두지 않는다.
- 관리자에게만 `병원관리에서 구성원 보기` deep link를 보조 action으로 제공할 수 있다. 운영 프로필 안에서 권한이나 조직 정보를 직접 편집하지 않는다.

정보가 적을 때도 빈 카드 또는 장식용 통계를 채우지 않는다. 각 section은 실제 데이터와 사용 목적이 있을 때만 렌더링한다.

## 상태 및 오류 처리

### Loading

- 헤더와 주요 section의 구조를 유지하는 skeleton을 표시한다.
- 이전 직원의 정보를 새 대상의 정보로 오인하지 않도록 대상 변경 즉시 이전 데이터를 제거한다.

### Empty

- 오늘 shift 없음: `오늘 등록된 근무가 없어요`
- 선택 날짜 예약 0건: `선택한 날짜에 예약이 없어요`
- 조직 필드 일부 없음: 값별 `미지정`을 사용하되 section 전체가 비어 있으면 생략한다.

### Error

- 프로필 기본 정보 실패: 드로우 안에 retry action이 있는 오류 상태를 표시한다.
- 기준일 근무 또는 화면별 정보만 실패: 기본 프로필은 유지하고 실패한 section에만 재시도 가능한 inline alert를 표시한다.
- 오류를 `휴무`, `0건`, `미지정`으로 변환하지 않는다.

### Permission

- 다른 workspace 직원 조회는 404 또는 권한 거부로 처리하고 데이터 존재를 노출하지 않는다.
- 허용되지 않은 필드는 masking한 값이 아니라 API 응답에서 제외한다.
- 개인 전화번호, 권한 역할, 로그인 이력, 내부 사용자 ID는 일반 운영 프로필 응답에 포함하지 않는다.

## 데이터와 API 계약

### 기존 데이터 재사용

- `users`: 표시 이름, 이니셜, 앱 표시용 이메일·전화번호, 사용자 상태
- `user_profiles`: 프로필 사진, 개인 설정
- `user_memberships`: workspace 소속, 부서, 직책, 상태
- membership job-position assignment: 직무
- `hospital_schedule_staff_profiles`: membership과 근무표 직원의 연결
- `hospital_schedule_shifts`: 날짜별 근무시간, 근무 label, 위치
- reception appointment/encounter source: 선택 날짜 예약 통계

1차 운영 프로필 때문에 새 DB 테이블을 만들지 않는다. `담당 업무`나 업무 역량 데이터도 추가하지 않는다.

### 조회 API 제안

```http
GET /api/workspaces/{workspaceId}/staff/{userId}/operational-profile?date=2026-07-14&context=reception
```

```json
{
  "ok": true,
  "profile": {
    "userId": "user-id",
    "displayName": "이수지",
    "initials": "SJ",
    "avatarUrl": null,
    "jobPositionLabel": "수의사",
    "title": "진료팀장",
    "department": "진료팀",
    "membershipStatus": "active"
  },
  "shift": {
    "date": "2026-07-14",
    "startMinutes": 540,
    "endMinutes": 1080,
    "workLabel": "진료",
    "locationLabel": "제2진료실",
    "state": "working"
  },
  "context": {
    "type": "reception-appointment-summary",
    "date": "2026-07-14",
    "totalCount": 6,
    "processedCount": 2,
    "remainingCount": 4
  },
  "enforcedBy": "staff-operational-profile-read"
}
```

`shift`와 `context`는 선택 값이다. 데이터가 없으면 `null`, 지원하지 않는 context면 field 생략을 사용해 실제 0건과 구분한다.

### API 권한

- actor는 대상과 동일한 workspace의 active member여야 한다.
- 기본 운영 프로필 read permission은 최소한의 workspace staff read 권한으로 분리한다.
- reception context를 요청하면 actor에게 `reception:view`가 있어야 한다.
- 관리자용 membership reader의 `role_permission:manage` 응답을 일반 프로필 조회에 그대로 재사용하지 않는다.
- 응답에는 actor가 볼 수 있는 필드만 직렬화한다.
- 다른 workspace의 `userId`, inactive/archived member 처리, 존재하지 않는 user를 구분해 정보가 새지 않도록 한다.

### 수정 API 경계

- 본인 개인 프로필: 기존 `PATCH /api/users/me/profile` 사용
- 본인 사진: 기존 avatar storage/upload 경계 사용
- 조직 정보: 관리자 전용 membership organization update route가 별도로 필요
- 근무 정보: 병원 근무표 mutation만 사용
- 화면별 요약: 원본 업무 데이터에서 계산하며 수정 endpoint를 만들지 않음

운영 프로필 drawer 자체는 read-only다. drawer 안에 범용 edit mode를 넣지 않는다.

## 공통 컴포넌트 제안

공유 소유자는 `StaffOperationalProfileDrawer`로 둔다.

```ts
type StaffOperationalProfileDrawerProps = {
  open: boolean;
  workspaceId: string;
  userId: string | null;
  date?: string;
  context?: "reception" | "schedule" | "hospital-admin";
  onOpenChange: (open: boolean) => void;
};
```

초기 reception 전용 레인 메뉴는 feature-local `VeterinarianLaneHeader`가 소유하되, drawer content와 데이터 계약을 reception module 안에 복제하지 않는다.

## 허용 변형

- `base`: 프로필과 조직 정보만 표시
- `schedule`: 기준일 근무를 포함
- `contextual`: 권한과 원본 데이터가 있을 때 화면별 section 추가

변형은 표시 가능한 데이터 조합만 바꾼다. 직군마다 완전히 다른 drawer를 만들지 않는다.

## 금지 패턴

- 권한 역할을 직원의 담당 업무나 실제 역량으로 표시
- 직무만 보고 진료 분야 또는 가능한 업무를 추정
- 오늘 예약 정보를 모든 역할의 공통 일정으로 표시
- 예약 통계를 프로필 테이블에 중복 저장
- 개인 전화번호, 권한 역할, 최근 로그인, 내부 ID를 일반 운영 프로필에 노출
- 다른 사용자가 운영 프로필 drawer에서 이름이나 조직 정보를 직접 수정
- 조회 오류를 `0건`, `휴무`, `미지정`으로 표현
- 화면별로 별도의 수의사·테크니션·접수 프로필 drawer를 생성

## 검토한 대안

### 최소 프로필

이름, 사진, 부서, 직책만 표시하는 방식은 구현은 단순하지만 업무 화면에서 drawer를 열 이유가 약해 제외했다.

### 관리자 구성원 상세 재사용

기존 구성원 Sheet를 그대로 열면 권한·멤버십 이력이 일반 운영 흐름에 노출되고 병원관리와 역할이 섞이므로 제외했다.

### 모든 역할에 공통 일정과 담당 업무 제공

역할별 원본 데이터와 assignment 구조가 다르고 업무 역량 모델이 없으므로 제외했다. 공통 `기준일 근무`와 선택적 화면 정보만 사용한다.

## 접근성 및 반응형 기준

- 더보기 버튼은 hover 없이 keyboard focus로 발견 가능해야 한다.
- `Escape`는 메뉴를 먼저 닫고, 메뉴가 닫힌 상태에서는 drawer를 닫는다.
- 메뉴 항목은 위·아래 화살표와 Enter/Space로 실행 가능해야 한다.
- focus는 drawer open 시 title 또는 첫 의미 있는 control로 이동하고, close 시 레인 더보기 버튼으로 복귀한다.
- 색상만으로 활성 상태나 근무 상태를 구분하지 않는다.
- mobile에서는 메뉴 버튼을 항상 표시하고 drawer를 full-width Sheet로 전환한다.
- 긴 이름, 긴 부서·직책, 200% zoom에서도 닫기와 핵심 값이 겹치지 않아야 한다.

## 검증 범위

### 문서·계약

- `담당 업무`와 업무 역량이 명시적으로 제외되어 있는지 확인
- 개인/조직/근무/화면별 데이터 소유권이 충돌하지 않는지 확인
- API 응답에 일반 직원이 볼 수 없는 필드가 없는지 확인

### 상호작용

- hover와 keyboard focus에서 더보기 버튼 표시
- 메뉴가 정확히 두 항목만 제공
- 숨기기가 상단 수의사 필터와 동일 상태를 변경
- 마지막 레인은 숨길 수 없고 이유를 설명
- 프로필 open/close와 focus return

### 데이터 상태

- 기본 프로필 loading/error/retry
- 오늘 shift 있음/없음/실패
- 선택 날짜 예약 0건/집계 있음/권한 없음/실패
- 다른 workspace와 inactive/archived target 차단
- 본인만 개인 프로필 수정 가능
- 권한 보유 관리자만 조직 정보 수정 가능

### 기술 검증

- focused unit tests for profile response serialization and field omission
- server route permission and cross-workspace tests
- RLS/RPC tests for self profile and membership organization mutations
- focused Playwright coverage for reception lane menu and drawer states
- responsive browser QA at desktop and mobile widths
- lint, TypeScript, docs check, and relevant build verification

## 구현 범위 제안

첫 구현 단위는 다음으로 제한한다.

- 접수 day calendar 레인 hover/focus 더보기 버튼
- `캘린더에서 숨기기`와 `운영 프로필 보기` 메뉴
- read-only 공통 운영 프로필 drawer
- 기존 데이터 기반 프로필·조직 정보·기준일 근무
- reception context의 예약 건수 요약
- loading, empty, partial error, permission states
- focused API/interaction/accessibility tests

## 제외 범위

- 담당 업무, 업무 역량, 진료 분야, 가능한 예약 유형
- 프로필 안에서 다른 직원 정보 수정
- 권한 역할 또는 로그인 이력 노출
- 개인 전화번호의 동료 공개
- 근무표 편집
- 환자·보호자·진료 상세 노출
- 새로운 DB 테이블 또는 역량 관리 시스템
- 다른 화면 전체 적용
