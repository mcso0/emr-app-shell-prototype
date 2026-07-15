---
id: DESIGN-SYSTEM-STAFF-OPERATIONAL-PROFILE-DRAWER
type: Design Contract
title: Staff Operational Profile Side Panel
description: Defines the reusable, read-only staff profile side panel, contact visibility, Presence, and last-seen behavior.
status: active
area: design-system
doc_type: design-contract
tags:
  - staff
  - operational-profile
  - side-panel
  - presence
  - workspace-membership
created: 2026-07-14
last_updated: 2026-07-14
---

# 직원 운영 프로필 사이드 패널

## 현재 구현 상태

RECEPTION-PR-009에서 Figma node `27682:46426`을 기준으로 기존 modal Sheet를 독립형 side panel로 교체했다.

- desktop은 메인 콘텐츠 바깥 오른쪽에 `336px` 열을 만들고 콘텐츠와 `10px` 간격을 둔다.
- 패널이 열리면 shell이 총 `346px`를 확보한다. 콘텐츠 위에 겹치지 않고 backdrop, blur, background inert를 사용하지 않는다.
- 공간이 부족한 화면에서는 backdrop 없는 full-width panel로 전환한다.
- `선택 날짜 예약`과 예약 통계는 패널 및 관련 props에서 제거했다.
- 공유 Base UI tabs에서 `프로필`만 활성화하고 `tab2`, `tab3`는 표시하되 `aria-disabled`로 둔다.
- 이메일과 전화번호는 `public.users`의 nullable 값만 표시한다. 값이 없으면 `미등록`을 사용하고 목업 값은 만들지 않는다.
- 현재 접속 여부는 workspace private Realtime Presence, 최근 접속은 workspace-scoped `last_seen_at`으로 구분한다.

구현·검증 기록은 [RECEPTION-PR-009](../../work/reception/RECEPTION-PR-009-staff-operational-profile-side-panel-presence.md), 데이터 계약은 [Workspace Member Activity And Presence](../../engineering/data-model/workspace-member-activity-presence.md)에서 관리한다.

## 사용자 목표와 정보 구조

직원은 현재 업무 화면을 떠나지 않고 대상 직원의 신원, 연락처, 현재 접속 여부, 기준일 근무 정보를 확인할 수 있어야 한다. 운영 프로필은 조회 전용이며 권한 역할, 내부 ID, 세션 정보, 역량 추론을 노출하지 않는다.

표시 순서는 다음과 같다.

1. 프로필 헤더: 사진/이니셜, 이름, 접속 상태, `직무 · 이메일`, 최근 접속
2. 탭: `프로필`, disabled `tab2`, disabled `tab3`
3. 기준일 근무: 오늘이면 `오늘 근무`, 다른 날짜면 날짜가 포함된 제목
4. 계정 정보: 이메일, 전화번호, 직무, 직책

Figma의 중복 `tab3`와 임시 title 문구는 제품 요구사항으로 사용하지 않는다. 부서와 소속 상태는 서버 프로필 계약에 남아 있어도 현재 Figma 패널의 계정 행에는 표시하지 않는다.

## 레이아웃과 시각 계약

| 영역 | 계약 |
| --- | --- |
| panel | width `336px`, white, border `1px #D4D4D4`, radius `12px`, shadow `0 1px 1px rgba(0,0,0,0.05)` |
| shell placement | content right edge와 `10px` gap, layout column, no overlay/backdrop/blur |
| header | height `128px`, padding `12px 16px`, bottom border `#E5E5E5` |
| avatar | `66px`, radius `6px`, border `#E5E5E5`, cover crop |
| name | Pretendard `18/26`, weight `600`, `#171717` |
| status badge | height `20px`, green online / neutral offline, text와 dot을 함께 사용 |
| close | `32px` hit area, `16px` icon, top/right `12px` |
| tabs | header 안쪽 x `16px`, height `34px`, text `14/20`, active indicator `1px` |
| content | horizontal padding `16px`, top padding `16px`, internal vertical scroll |
| section title | Pretendard `14/20`, weight `500`, `#525252`, content gap `10px` |
| shift card | width fill (`302px` at desktop), height `72px`, border `#E5E5E5`, radius `12px` |
| shift icon area | `48px`, black 4% background, radius `8px`, icon `24px` |
| account rows | label/value `14/20`, row gap `10px`, copy control `24px` |

실제 앱 shell의 outer shadow가 패널 표면을 소유한다. 내부 화면은 별도 modal shadow를 중첩하지 않는다.

## 상호작용

### 열기와 닫기

- 접수 day calendar 레인 메뉴의 `운영 프로필 보기`가 side panel을 연다.
- shell에는 한 번에 하나의 우측 panel만 활성화한다.
- profile panel은 URL에 대상 user ID를 영속화하지 않는 transient surface다.
- 열릴 때 닫기 버튼으로 focus를 이동한다.
- 닫기 버튼과 `Escape`가 panel을 닫고 레인 메뉴 trigger로 focus를 돌려준다.
- 비모달이므로 배경 콘텐츠는 계속 접근 가능하며 `aria-hidden` 또는 `inert`로 만들지 않는다.

### 탭

- 공유 `TabGroup`, `Tab`, `TabPanel`은 Base UI tabs semantics와 controlled/uncontrolled 동작을 그대로 사용한다.
- 활성 `프로필`은 `role=tab`, 연결된 `tabpanel`, focus indicator를 제공한다.
- `tab2`, `tab3`는 미래 탐색 label로만 보이고 `aria-disabled=true`다. 빈 panel이나 가짜 내용을 만들지 않는다.
- 화살표 키 탐색은 disabled tab을 선택하지 않는다.

### 연락처 복사

- 값이 존재할 때만 복사 버튼을 표시한다.
- accessible name은 각각 `이메일 복사`, `전화번호 복사`다.
- 성공과 실패는 toast로 알린다.
- 긴 값은 value column에서 truncate하며 패널 폭을 늘리지 않는다.

## 접속 상태 계약

- `접속 중`: 대상 user ID의 Presence meta가 현재 workspace private channel에 하나 이상 존재한다.
- `오프라인`: Presence meta가 하나도 없다.
- multi-tab/multi-device에서는 하나라도 남아 있으면 online이다.
- `접속 기록 없음`: workspace-scoped `last_seen_at`이 없거나 유효하지 않다.
- 접속 기록이 있으면 `방금 접속`, `5분 전 접속`, `2시간 전 접속`처럼 상대 시각을 표시한다.

Presence가 live online state의 유일한 원본이다. DB에 `is_online`을 저장하지 않으며 Auth의 `last_sign_in_at`, 세션, refresh token을 대신 사용하지 않는다. disconnect stale 정리는 Supabase Presence heartbeat/leave 동작에 맡기고, persisted `last_seen_at`은 online 판정에 사용하지 않는다.

## 근무와 상태 처리

- 실제 shift가 있으면 시간, work label, 위치와 계산된 근무 상태를 표시한다.
- 오늘이 아닌 기준일의 기존 예정/종료 표현을 유지한다.
- shift가 없으면 `등록된 근무가 없어요`를 표시한다.
- 근무 조회 실패는 기본 프로필을 유지한 채 section-level 오류와 재시도를 표시한다.
- 로딩, 전체 오류, 근무 부분 오류, 근무 없음은 Figma 목업 값으로 대체하지 않는다.

## API와 권한 경계

```http
GET /api/workspaces/{workspaceId}/staff/{userId}/operational-profile?date=2026-07-14
```

성공 응답의 `profile`은 필요한 값만 포함한다.

```json
{
  "displayName": "표시 이름",
  "initials": "AB",
  "avatarUrl": null,
  "email": "nullable",
  "phone": "nullable",
  "jobPositionLabel": "수의사",
  "title": "진료팀장",
  "department": "진료팀",
  "membershipStatus": "active",
  "lastSeenAt": "2026-07-14T12:00:00.000Z"
}
```

- actor는 인증된 active same-workspace member여야 한다. `reception:view`는 요구하지 않는다.
- 다른 workspace target, 비인증 actor, 비활성 actor는 프로필을 받지 못한다.
- 연락처 원본은 `public.users`; `auth.users`와 세션 정보는 응답하지 않는다.
- activity migration이 아직 배포되지 않았거나 activity 조회만 실패하면 기본 프로필은 성공하고 `lastSeenAt`만 생략한다.
- shift read만 실패하면 `sectionErrors.shift`로 격리한다.
- 운영 프로필에서 편집 mutation을 제공하지 않는다.

## 상태와 접근성

- base loading은 구조를 유지하는 skeleton을 사용한다.
- base error는 alert와 `다시 시도`를 제공한다.
- section error를 빈 근무 또는 휴무로 오해하게 만들지 않는다.
- online/offline은 색상뿐 아니라 badge text로 전달한다.
- 닫기와 주요 controls는 최소 `32px` hit area를 가진다.
- mobile full-width DOM에서도 Escape, focus entry, focus return을 유지한다.
- 200% zoom, 긴 이름/직책/연락처에서 닫기 버튼과 핵심 값이 겹치지 않아야 한다.

## 금지 패턴

- modal Sheet, backdrop, backdrop blur, background inert
- 예약 통계 또는 환자/보호자/진료 정보 재도입
- `tab2`, `tab3`의 가짜 콘텐츠
- 연락처·최근 접속의 목업 값 생성
- `is_online` DB boolean, Auth 세션 기반 online 추론
- `authenticated`만 확인하고 workspace membership 검증 생략
- permission role을 직무나 역량으로 표시
- 오류를 `미등록`, `오프라인`, `근무 없음`으로 변환

## 배포 경계

`20260714213000_workspace_member_activity_presence.sql`은 2026-07-15 원격
synthetic/demo DB에 적용됐고 인증 heartbeat RPC는 통과했다. 최초 production
rollout은 hosted Realtime이 private Presence join에서도 `broadcast.read`를
검사해 구독을 거부하면서 이전 안정 배포로 롤백됐다. 후속
`20260715014500_staff_presence_broadcast_read_hotfix.sql`은 같은 workspace의
active member에게 staff-presence topic의 Broadcast 수신만 허용하고 Broadcast
발행은 계속 금지하며 원격 적용과 synthetic 권한 검증을 통과했다. 다음 앱
rollout에서는 Supabase-js가 같은 topic channel을 재사용하는데 profile hook이
subscribe 뒤 callback을 추가해 화면이 중단되어 다시 롤백됐다. app-shell
reporter가 channel과 callback을 단독 소유하고 profile은 workspace snapshot만
구독해야 한다.
