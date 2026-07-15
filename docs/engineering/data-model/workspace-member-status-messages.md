---
id: ENGINEERING-WORKSPACE-MEMBER-STATUS-MESSAGES
type: Data Contract
title: Workspace Member Status Messages
description: Defines workspace-scoped staff status-message persistence, self-only mutation, audit, and optimistic concurrency.
status: active
area: engineering
doc_type: data-contract
tags: [staff, profile, status-message, rls, audit]
created: 2026-07-16
last_updated: 2026-07-16
---

# Workspace Member Status Messages

## Purpose

직원이 한 병원 workspace 안에서만 공유하는 짧은 상태 메시지를 저장한다.
전역 `user_profiles`나 접속 관측용 `workspace_member_activity`에 섞지 않는다.

## Table And Value Contract

`public.workspace_member_status_messages`는 `(workspace_id, user_id)`를 기본
키로 사용하고 동일 키의 active membership을 외래 키로 참조한다. 저장 값은
앞뒤 공백을 제거한 1–60 Unicode 문자이며, 빈 값은 placeholder 행을 남기지
않고 삭제한다. `updated_at`은 optimistic concurrency version이다.

## Authorization And API

- active same-workspace member는 해당 workspace의 메시지를 읽을 수 있다.
- insert/update/delete는 `user_id = auth.uid()`인 본인 행만 허용한다.
- `PATCH /api/workspaces/{workspaceId}/members/me/status-message`는 Supabase
  session, active membership, JSON/content-size, 길이, version을 다시 검증한다.
- 원자적 `clair_set_my_workspace_status_message` RPC는 target user ID를 받지
  않고 `auth.uid()`만 사용한다. stale `updated_at`은 overwrite 대신 conflict다.
- anonymous table/RPC 접근은 허용하지 않는다. client의 editable 표시는 보안
  경계가 아니다.

## Audit And Privacy

insert/update/delete는 `user.workspace_status_message_updated`를 중앙 audit에
남긴다. snapshot과 metadata에는 operation, 존재 여부, 이전/이후 길이만 있고
메시지 본문은 기록하지 않는다.

## Migration And Verification

- canonical schema: `20260716010000_workspace_member_status_messages.sql`
- RLS init-plan optimization: `20260716011000_workspace_status_message_rls_initplan.sql`
- linked synthetic/demo remote versions: `20260715164007`, `20260715164307`

원격 catalog에서 RLS, 네 정책, authenticated grant, anon denial, audit trigger를
확인했다. 합성 transaction은 self save/read/delete, same-workspace read,
other-user/inactive/cross-workspace denial, CAS conflict, body-free audit를 검증하고
rollback 뒤 probe row가 0개임을 확인했다.
