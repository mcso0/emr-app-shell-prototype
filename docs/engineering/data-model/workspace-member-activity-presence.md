---
id: ENGINEERING-WORKSPACE-MEMBER-ACTIVITY-PRESENCE
type: Data Contract
title: Workspace Member Activity And Presence
description: Defines workspace-scoped private Presence and throttled last-seen persistence for staff operational profiles.
status: active
area: engineering
doc_type: data-contract
tags: [staff, presence, realtime, last-seen, rls]
created: 2026-07-14
last_updated: 2026-07-14
---

# Workspace Member Activity And Presence

## Purpose

현재 접속 여부와 최근 접속 기록을 서로 다른 원본으로 관리한다.

- online/offline: ephemeral Supabase Realtime Presence
- recent activity: persisted `public.workspace_member_activity.last_seen_at`

Presence가 사라지면 즉시 offline으로 본다. `last_seen_at`은 설명용 history이며 online 판정에 사용하지 않는다.

## Realtime channel

Private topic은 `workspace:{workspaceId}:staff-presence` 형식이다. client는 Supabase session access token으로 Realtime auth를 설정한 뒤 자신의 `userId`를 Presence key로 track한다.

`realtime.messages`의 SELECT/INSERT policy는 다음을 모두 요구한다.

- `extension = 'presence'`
- topic이 정확한 staff-presence 형식
- `realtime.topic()`에서 읽은 workspace에 active membership이 존재

Presence state에 같은 user key의 meta가 하나 이상 있으면 online이다. 따라서 한 탭이나 기기가 종료돼도 다른 meta가 남으면 online을 유지한다. unload 신호는 권위 있는 원본으로 사용하지 않는다.

## Persisted table

```sql
public.workspace_member_activity (
  workspace_id text not null,
  user_id uuid not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id)
    references public.user_memberships (workspace_id, user_id)
    on delete cascade
)
```

이 테이블은 session, token, device identifier, IP, `is_online`을 저장하지 않는다. membership 삭제 시 함께 삭제된다.

## Write contract

`public.clair_touch_workspace_member_activity(p_workspace_id text)`만 activity를 기록한다.

- `auth.uid()`가 없으면 거부한다.
- actor가 요청 workspace의 active member가 아니면 거부한다.
- actor는 자신 행만 upsert할 수 있고 대상 user ID를 인자로 받지 않는다.
- 마지막 accepted write 이후 60초 이내 호출은 timestamp를 변경하지 않고 기존 값을 반환한다.
- client는 Presence subscribe 직후 한 번, 이후 연결 유지 중 60초 간격으로 호출한다.
- disconnect/unload write에 의존하지 않는다.

직접 table write grant는 없고 authenticated에는 RLS가 적용된 SELECT만 허용한다.

## Read and API contract

RLS SELECT는 active same-workspace member에게만 해당 workspace 행을 허용한다. staff operational profile API는 대상의 `last_seen_at`을 nullable `lastSeenAt`으로 직렬화한다.

activity read 실패는 base profile read 실패로 승격하지 않는다. migration rollout 전 또는 Realtime 일시 장애에서도 이름·연락처·근무 정보는 계속 제공하고 최근 접속만 `접속 기록 없음`으로 낮춘다.

## Stale and failure semantics

- live online state는 Presence server의 heartbeat/leave state를 그대로 따른다.
- DB heartbeat가 오래됐다는 이유로 online을 만들지 않는다.
- Presence 연결이 없으면 `오프라인`; `last_seen_at`이 없으면 추가로 `접속 기록 없음`이다.
- 여러 탭 중 하나가 남아 있으면 online이다.
- Realtime 또는 activity migration이 준비되지 않은 mock/local 환경은 fake online/contact/history를 만들지 않는다.

## Migration and rollback

Forward migration: `supabase/migrations/20260714213000_workspace_member_activity_presence.sql`.

원격 적용 전 migration drift를 정합화해야 한다. rollback이 필요하면 먼저 두 `realtime.messages` policy와 RPC/function grants/functions를 제거하고, 마지막에 `workspace_member_activity` table을 제거한다. rollback은 last-seen history를 삭제하므로 synthetic/staging 확인 후 별도 승인된 migration으로 수행한다.

## Verification

- static migration contract: table, FK, RLS, grants, private topic policies, 60-second throttle
- same-workspace active member allow / unauthenticated and cross-workspace deny
- multi-tab/device join and partial leave
- last-seen missing/valid formatting
- activity relation unavailable while base profile remains readable
