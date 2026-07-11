"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  createEmptySessionWorkspacesState,
  createOrUpdateSessionWorkspaceCustomPermissionRole,
  createSessionWorkspaceCustomJobPosition,
  getSessionWorkspaceJobPositions,
  getSessionWorkspacePermissionRoles,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  type SessionWorkspacesState,
} from "@/features/auth/workspace-session";

type Props = { workspaceId: string };

export function WorkspaceRolePermissionManagement({ workspaceId }: Props) {
  const { hydrated, hydrate, session } = useAuthClient();
  const [state, setState] = useState<SessionWorkspacesState>(() =>
    typeof window === "undefined" ? createEmptySessionWorkspacesState() : readSessionWorkspacesState(window.sessionStorage, window.localStorage) ?? createEmptySessionWorkspacesState()
  );
  const [tab, setTab] = useState<"roles" | "jobs">("roles");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canManage = session?.role === "hospital_admin" || session?.role === "supabase";
  const roles = getSessionWorkspacePermissionRoles(state, workspaceId);
  const jobs = getSessionWorkspaceJobPositions(state, workspaceId);
  const displayItems = tab === "roles"
    ? roles.map((role) => ({ key: role.roleKey, label: role.label, isSystem: role.isSystem }))
    : jobs.map((job) => ({ key: job.positionKey, label: job.label, isSystem: job.isSystem }));

  useEffect(() => { hydrate(); }, [hydrate]);

  function commit(next: SessionWorkspacesState) {
    setState(next);
    if (session && typeof window !== "undefined") {
      persistSessionWorkspacesState(next, session.storageMode, window.sessionStorage, window.localStorage);
      window.dispatchEvent(new Event("clair.sessionWorkspaces.v1"));
    }
  }

  function createRole() {
    const result = createOrUpdateSessionWorkspaceCustomPermissionRole(state, {
      workspaceId,
      label: name,
      permissionIds: ["reception:view"],
    });
    if (!result.success) { setMessage("역할 이름을 확인해 주세요."); return; }
    commit(result.state); setName(""); setMessage("새 역할을 만들었습니다. 권한 범위 편집은 다음 권한 정책 작업에서 연결됩니다.");
  }

  function createJob() {
    const result = createSessionWorkspaceCustomJobPosition(state, { workspaceId, label: name });
    if (!result.success) { setMessage("직무 이름을 확인해 주세요."); return; }
    commit(result.state); setName(""); setMessage("새 직무를 만들었습니다.");
  }

  function disable(key: string) {
    if (tab === "roles") {
      commit({ ...state, permissionRoles: (state.permissionRoles ?? []).map((role) => role.workspaceId === workspaceId && role.roleKey === key ? { ...role, isAssignable: false } : role) });
    } else {
      commit({ ...state, jobPositions: (state.jobPositions ?? []).map((job) => job.workspaceId === workspaceId && job.positionKey === key ? { ...job, isActive: false } : job) });
    }
  }

  if (!hydrated) return <div className="p-5 text-sm text-muted-foreground">역할과 직무를 불러오는 중입니다.</div>;

  return <div className="flex h-full flex-col gap-5 overflow-auto p-5"><div><h1 className="text-xl font-semibold">역할 및 권한</h1><p className="mt-1 text-sm text-muted-foreground">구성원 초대에서 사용할 역할과 직무를 한 곳에서 관리합니다.</p></div><LineTabs aria-label="역할 및 직무" size="default" value={tab} onValueChange={setTab} items={[{ value: "roles", label: "권한 역할", count: roles.length }, { value: "jobs", label: "직무", count: jobs.length }]} /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"><Card><CardHeader><CardTitle>{tab === "roles" ? "권한 역할" : "직무"}</CardTitle><CardDescription>{tab === "roles" ? "권한 역할은 접근 범위를 결정합니다." : "직무는 구성원 검색과 조직 표시에만 사용합니다."}</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{displayItems.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"><div><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.isSystem ? "기본 제공" : "병원 정의"}</p></div>{!item.isSystem ? <Button size="xs" variant="outline" disabled={!canManage} onClick={() => disable(item.key)}>비활성화</Button> : null}</div>)}</CardContent></Card><Card><CardHeader><CardTitle>{tab === "roles" ? "새 역할" : "새 직무"}</CardTitle><CardDescription>구성원 초대 화면에서는 여기에서 활성화된 항목만 선택할 수 있습니다.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="role-or-job-name">이름</FieldLabel><Input id="role-or-job-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={tab === "roles" ? "예: 검사 보조" : "예: CS"} disabled={!canManage} /><FieldDescription>{message ?? ""}</FieldDescription></Field><Button type="button" disabled={!canManage || !name.trim()} onClick={tab === "roles" ? createRole : createJob}>추가</Button></FieldGroup></CardContent></Card></div></div>;
}
