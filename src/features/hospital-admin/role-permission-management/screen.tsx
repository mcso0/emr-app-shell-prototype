"use client";

import { useEffect, useMemo, useState } from "react";
import { EmrPageHeader } from "@/components/emr/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG,
  createOrUpdateSessionWorkspaceCustomPermissionRole,
  createSessionWorkspaceCustomJobPosition,
  getSessionWorkspaceEffectiveJobPositionKey,
  getSessionWorkspaceJobPositionLabel,
  getSessionWorkspaceJobPositions,
  getSessionWorkspacePermissionRoles,
  type SessionWorkspacePermissionRole,
} from "@/features/auth/workspace-session";
import {
  buildRolePermissionGroups,
  createRoleDraft,
  getRoleAssignedMembers,
  getRoleMemberLabel,
  isRoleDraftDirty,
  validateRoleDraft,
  type RoleDraft,
} from "@/features/hospital-admin/role-permission-management/model";
import {
  getWorkspaceRoleWorkDefaultsStorageKey,
  persistWorkspaceRoleWorkDefaults,
  readWorkspaceRoleWorkDefaults,
  type WorkspaceRoleWorkDefaults,
} from "@/features/hospital-admin/role-permission-management/work-defaults";
import { useWorkspaceRoleState } from "@/features/hospital-admin/role-permission-management/use-workspace-role-state";

type RolePermissionManagementScreenProps = {
  onOpenMemberManagement?: () => void;
  workspaceId: string;
};

type RoleDialogState =
  | { mode: "create"; role: null }
  | { mode: "edit"; role: SessionWorkspacePermissionRole };

const workDefaultFields: Array<{
  key: keyof WorkspaceRoleWorkDefaults;
  label: string;
  description: string;
}> = [
  {
    key: "receptionPositionKey",
    label: "기본 접수 담당",
    description: "새 접수 업무를 시작할 때 보여 줄 기본 직무입니다.",
  },
  {
    key: "chartPositionKey",
    label: "기본 차트 담당",
    description: "차트 업무에서 먼저 제안할 기본 직무입니다.",
  },
  {
    key: "labResultPositionKey",
    label: "검사 결과 담당",
    description: "검사 결과 입력 업무에서 먼저 제안할 기본 직무입니다.",
  },
  {
    key: "billingReviewPositionKey",
    label: "수납 검토 담당",
    description: "수납 검토 업무에서 먼저 제안할 기본 직무입니다.",
  },
];

function getRoleValidationMessage(reason: string) {
  if (reason === "empty_label") return "커스텀 역할 이름을 입력하세요.";
  if (reason === "empty_permissions") return "하나 이상의 권한을 선택하세요.";
  if (reason === "owner_only_permission") return "소유자 전용 권한은 커스텀 역할에 넣을 수 없습니다.";
  return "선택할 수 없는 권한이 포함되어 있습니다.";
}

function getJobValidationMessage(reason: string) {
  return reason === "empty_label" ? "직무 이름을 입력하세요." : "이미 있는 직무입니다.";
}

function WorkDefaultsPanel({
  jobPositions,
  workspaceId,
}: {
  jobPositions: ReturnType<typeof getSessionWorkspaceJobPositions>;
  workspaceId: string;
}) {
  const [savedWorkDefaults, setSavedWorkDefaults] = useState<WorkspaceRoleWorkDefaults>(() =>
    readWorkspaceRoleWorkDefaults(workspaceId)
  );
  const [workDefaultsDraft, setWorkDefaultsDraft] = useState<WorkspaceRoleWorkDefaults>(
    savedWorkDefaults
  );
  const [workDefaultsSaved, setWorkDefaultsSaved] = useState(false);
  const [workDefaultsError, setWorkDefaultsError] = useState<string | null>(null);
  const isWorkDefaultsDirty = JSON.stringify(savedWorkDefaults) !== JSON.stringify(workDefaultsDraft);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getWorkspaceRoleWorkDefaultsStorageKey(workspaceId)) return;

      const nextDefaults = readWorkspaceRoleWorkDefaults(workspaceId);
      setSavedWorkDefaults(nextDefaults);
      setWorkDefaultsDraft(nextDefaults);
      setWorkDefaultsSaved(false);
      setWorkDefaultsError(null);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [workspaceId]);

  const saveWorkDefaults = () => {
    try {
      persistWorkspaceRoleWorkDefaults(workspaceId, workDefaultsDraft);
      setSavedWorkDefaults(workDefaultsDraft);
      setWorkDefaultsSaved(true);
      setWorkDefaultsError(null);
    } catch {
      setWorkDefaultsSaved(false);
      setWorkDefaultsError("브라우저 저장소에 저장하지 못했습니다. 브라우저 설정을 확인한 뒤 다시 시도하세요.");
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-5">
        <Card className="max-w-3xl">
          <CardHeader className="border-b">
            <CardTitle>업무 기본값</CardTitle>
            <CardDescription>
              권한과 분리된 설정입니다. 이 브라우저에서만 저장되며 실제 권한이나 배정을 바꾸지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {workDefaultFields.map((field) => (
                <Field key={field.key}>
                  <FieldLabel htmlFor={`role-work-default-${field.key}`}>{field.label}</FieldLabel>
                  <Select
                    value={workDefaultsDraft[field.key]}
                    onValueChange={(value) => {
                      setWorkDefaultsDraft((current) => ({
                        ...current,
                        [field.key]: String(value),
                      }));
                      setWorkDefaultsSaved(false);
                      setWorkDefaultsError(null);
                    }}
                  >
                    <SelectTrigger id={`role-work-default-${field.key}`} className="w-full">
                      <SelectValue>
                        {jobPositions.find(
                          (position) => position.positionKey === workDefaultsDraft[field.key]
                        )?.label ?? workDefaultsDraft[field.key]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {jobPositions.map((position) => (
                          <SelectItem key={position.positionKey} value={position.positionKey}>
                            {position.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{field.description}</FieldDescription>
                </Field>
              ))}
            </FieldGroup>
          </CardContent>
          {workDefaultsError ? (
            <div className="border-t px-4 py-3">
              <p className="text-sm text-destructive" role="alert">
                {workDefaultsError}
              </p>
            </div>
          ) : null}
          {isWorkDefaultsDirty || workDefaultsSaved ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/50 px-4 py-3">
              <p className="text-sm text-muted-foreground" role={workDefaultsSaved ? "status" : undefined}>
                {workDefaultsSaved
                  ? "이 브라우저의 업무 기본값을 저장했습니다."
                  : "저장하지 않은 변경이 있습니다."}
              </p>
              {isWorkDefaultsDirty ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setWorkDefaultsDraft(savedWorkDefaults)}>
                    취소
                  </Button>
                  <Button size="sm" onClick={saveWorkDefaults}>
                    저장
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </ScrollArea>
  );
}

export function RolePermissionManagementScreen({
  onOpenMemberManagement,
  workspaceId,
}: RolePermissionManagementScreenProps) {
  const workspace = useWorkspaceRoleState(workspaceId);
  const roles = useMemo(
    () => getSessionWorkspacePermissionRoles(workspace.state, workspaceId),
    [workspace.state, workspaceId]
  );
  const jobPositions = useMemo(
    () => getSessionWorkspaceJobPositions(workspace.state, workspaceId),
    [workspace.state, workspaceId]
  );
  const [selectedRoleKey, setSelectedRoleKey] = useState("admin");
  const [selectedJobPositionKey, setSelectedJobPositionKey] = useState("front_desk");
  const [assignedRoleKey, setAssignedRoleKey] = useState<string | null>(null);
  const [roleDialogState, setRoleDialogState] = useState<RoleDialogState | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(() => createRoleDraft());
  const [roleError, setRoleError] = useState<string | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobLabel, setJobLabel] = useState("");
  const [jobError, setJobError] = useState<string | null>(null);
  const activeSelectedRoleKey = roles.some((role) => role.roleKey === selectedRoleKey)
    ? selectedRoleKey
    : (roles[0]?.roleKey ?? "admin");
  const activeSelectedJobPositionKey = jobPositions.some(
    (position) => position.positionKey === selectedJobPositionKey
  )
    ? selectedJobPositionKey
    : (jobPositions[0]?.positionKey ?? "front_desk");
  const selectedRole = roles.find((role) => role.roleKey === activeSelectedRoleKey) ?? roles[0];
  const selectedRoleMembers = selectedRole
    ? getRoleAssignedMembers(workspace.state, workspaceId, selectedRole.roleKey)
    : [];
  const assignedMembers = assignedRoleKey
    ? getRoleAssignedMembers(workspace.state, workspaceId, assignedRoleKey)
    : [];
  const assignedRole = roles.find((role) => role.roleKey === assignedRoleKey) ?? null;

  const openRoleDialog = (role?: SessionWorkspacePermissionRole) => {
    setRoleDialogState(role ? { mode: "edit", role } : { mode: "create", role: null });
    setRoleDraft(createRoleDraft(role));
    setRoleError(null);
  };

  const toggleDraftPermission = (permissionId: string, checked: boolean) => {
    setRoleDraft((current) => ({
      ...current,
      permissionIds: checked
        ? Array.from(new Set([...current.permissionIds, permissionId]))
        : current.permissionIds.filter((item) => item !== permissionId),
    }));
    setRoleError(null);
  };

  const saveRole = () => {
    const validation = validateRoleDraft(roleDraft);
    if (!validation.valid) {
      setRoleError(getRoleValidationMessage(validation.reason));
      return;
    }

    const result = createOrUpdateSessionWorkspaceCustomPermissionRole(workspace.state, {
      workspaceId,
      roleKey: roleDialogState?.mode === "edit" ? roleDialogState.role.roleKey : undefined,
      label: roleDraft.label,
      permissionIds: roleDraft.permissionIds,
    });

    if (!result.success) {
      setRoleError(getRoleValidationMessage(result.reason));
      return;
    }

    workspace.updateState(result.state);
    setSelectedRoleKey(result.role.roleKey);
    setRoleDialogState(null);
  };

  const saveJobPosition = () => {
    const result = createSessionWorkspaceCustomJobPosition(workspace.state, {
      workspaceId,
      label: jobLabel,
    });

    if (!result.success) {
      setJobError(getJobValidationMessage(result.reason));
      return;
    }

    workspace.updateState(result.state);
    setSelectedJobPositionKey(result.position.positionKey);
    setJobDialogOpen(false);
    setJobLabel("");
    setJobError(null);
  };

  if (!workspace.hydrated) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] p-5">
        <EmrPageHeader title="역할 및 권한" />
        <p className="mt-6 text-sm text-muted-foreground">권한 정보를 준비하고 있습니다.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="hospital-admin-role-permission-screen"
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
    >
      <section className="border-b bg-card px-5 py-4">
        <EmrPageHeader
          title="역할 및 권한"
          actions={
            workspace.canManage ? (
              <Button size="sm" onClick={() => openRoleDialog()}>
                새 커스텀 역할
              </Button>
            ) : undefined
          }
        />
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          역할은 할 수 있는 일을, 직무는 병원 안에서의 업무 표기를 정합니다.
        </p>
      </section>

      {!workspace.canView ? (
        <div className="p-5">
          <Card>
            <CardHeader>
              <CardTitle>역할 정보를 볼 수 없습니다</CardTitle>
              <CardDescription>로그인한 구성원만 역할과 권한을 확인할 수 있습니다.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <Tabs defaultValue="roles" className="min-h-0 flex-1">
          <div className="border-b bg-card px-5">
            <TabsList variant="line" aria-label="역할 및 권한 탭">
              <TabsTrigger value="roles">권한 역할</TabsTrigger>
              <TabsTrigger value="positions">직무</TabsTrigger>
              <TabsTrigger value="work-defaults">업무 기본값</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="roles" className="min-h-0">
            <ScrollArea className="h-full">
              <div className="grid gap-4 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card size="sm" className="h-fit">
                  <CardHeader className="border-b">
                    <CardTitle>권한 역할</CardTitle>
                    <CardDescription>구성원에게 배정할 역할을 선택해 확인합니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-1">
                    {roles.map((role) => {
                      const memberCount = getRoleAssignedMembers(
                        workspace.state,
                        workspaceId,
                        role.roleKey
                      ).length;
                      const selected = activeSelectedRoleKey === role.roleKey;

                      return (
                        <Button
                          key={role.roleKey}
                          type="button"
                          variant={selected ? "secondary" : "ghost"}
                          className="h-auto justify-between px-2.5 py-2 text-left"
                          aria-pressed={selected}
                          onClick={() => setSelectedRoleKey(role.roleKey)}
                        >
                          <span className="min-w-0 truncate">{role.label}</span>
                          <span className="text-xs text-muted-foreground">{memberCount}명</span>
                        </Button>
                      );
                    })}
                  </CardContent>
                </Card>

                {selectedRole ? (
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>{selectedRole.label}</CardTitle>
                      <CardDescription>
                        {selectedRole.description ?? "권한 구성을 확인하고 구성원 배정 현황을 봅니다."}
                      </CardDescription>
                      <CardAction className="flex items-center gap-2">
                        {selectedRole.isSystem ? <Badge variant="outline">시스템 역할</Badge> : null}
                        {!selectedRole.isSystem ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!workspace.canManage}
                            onClick={() => openRoleDialog(selectedRole)}
                          >
                            역할 편집
                          </Button>
                        ) : null}
                      </CardAction>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">지정 구성원</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            이 역할이 배정된 활성 구성원을 확인합니다.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAssignedRoleKey(selectedRole.roleKey)}
                        >
                          지정 구성원 {selectedRoleMembers.length}명 보기
                        </Button>
                      </div>
                      <Separator />
                      <div className="grid gap-5">
                        {buildRolePermissionGroups(selectedRole).map((group) => (
                          <section key={group.id} className="grid gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="text-sm font-medium">{group.label}</h2>
                              <span className="text-xs text-muted-foreground">
                                {group.allowedCount}/{group.rows.length} 허용
                              </span>
                            </div>
                            <div className="grid gap-1">
                              {group.rows.map((permission) => (
                                <div
                                  key={permission.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                                >
                                  <label className="flex min-w-0 items-center gap-2 text-sm">
                                    <Checkbox
                                      aria-label={permission.label}
                                      checked={permission.allowed}
                                      disabled
                                    />
                                    <span className="min-w-0 truncate">{permission.label}</span>
                                  </label>
                                  {permission.lockReason === "owner_only" ? (
                                    <Badge variant="outline">소유자 전용</Badge>
                                  ) : permission.lockReason === "system_role" ? (
                                    <Badge variant="outline">읽기 전용</Badge>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="positions" className="min-h-0">
            <ScrollArea className="h-full">
              <div className="grid gap-4 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card size="sm" className="h-fit">
                  <CardHeader className="border-b">
                    <CardTitle>직무</CardTitle>
                    <CardDescription>직무는 화면 접근 권한을 바꾸지 않습니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-1">
                    {jobPositions.map((position) => {
                      const assignedCount = workspace.state.memberships.filter(
                        (member) =>
                          member.workspaceId === workspaceId &&
                          member.status === "active" &&
                          getSessionWorkspaceEffectiveJobPositionKey(member) === position.positionKey
                      ).length;
                      const selected = activeSelectedJobPositionKey === position.positionKey;

                      return (
                        <Button
                          key={position.positionKey}
                          type="button"
                          variant={selected ? "secondary" : "ghost"}
                          className="h-auto justify-between px-2.5 py-2 text-left"
                          aria-pressed={selected}
                          onClick={() => setSelectedJobPositionKey(position.positionKey)}
                        >
                          <span className="min-w-0 truncate">{position.label}</span>
                          <span className="text-xs text-muted-foreground">{assignedCount}명</span>
                        </Button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <CardTitle>
                      {getSessionWorkspaceJobPositionLabel(
                        activeSelectedJobPositionKey,
                        workspace.state,
                        workspaceId
                      )}
                    </CardTitle>
                    <CardDescription>
                      직무는 구성원의 업무 표기와 기본 업무 제안에만 사용됩니다.
                    </CardDescription>
                    <CardAction>
                      <Button
                        size="sm"
                        disabled={!workspace.canManage}
                        onClick={() => {
                          setJobDialogOpen(true);
                          setJobError(null);
                        }}
                      >
                        직무 추가
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                      직무를 바꿔도 권한 역할은 바뀌지 않습니다. 구성원 배정은 병원구성원 관리에서 합니다.
                    </p>
                    {onOpenMemberManagement ? (
                      <Button className="mt-4" variant="outline" onClick={onOpenMemberManagement}>
                        구성원 관리 열기
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="work-defaults" className="min-h-0">
            <WorkDefaultsPanel key={workspaceId} workspaceId={workspaceId} jobPositions={jobPositions} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={Boolean(roleDialogState)}
        onOpenChange={(open) => {
          if (!open) setRoleDialogState(null);
        }}
      >
        <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {roleDialogState?.mode === "edit" ? "커스텀 역할 편집" : "새 커스텀 역할"}
            </DialogTitle>
            <DialogDescription>
              필요한 권한만 선택하세요. 소유자 전용 권한은 커스텀 역할에 추가할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(roleError)}>
              <FieldLabel htmlFor="role-permission-custom-role-name">커스텀 역할 이름</FieldLabel>
              <Input
                id="role-permission-custom-role-name"
                value={roleDraft.label}
                aria-invalid={Boolean(roleError)}
                placeholder="검사 보조"
                onChange={(event) => {
                  setRoleDraft((current) => ({ ...current, label: event.target.value }));
                  setRoleError(null);
                }}
              />
              {roleError ? <FieldError>{roleError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel>허용 권한</FieldLabel>
              <div className="grid gap-1 rounded-lg border border-border p-2">
                {SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.map((permission) => (
                  <label key={permission.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox
                      aria-label={permission.label}
                      checked={roleDraft.permissionIds.includes(permission.id)}
                      onCheckedChange={(checked) => toggleDraftPermission(permission.id, Boolean(checked))}
                    />
                    {permission.label}
                  </label>
                ))}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogState(null)}>
              취소
            </Button>
            <Button
              disabled={
                roleDialogState?.mode === "edit" &&
                !isRoleDraftDirty(roleDraft, roleDialogState.role)
              }
              onClick={saveRole}
            >
              역할 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={jobDialogOpen}
        onOpenChange={(open) => {
          setJobDialogOpen(open);
          if (!open) {
            setJobLabel("");
            setJobError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>직무 추가</DialogTitle>
            <DialogDescription>직무는 권한 역할과 분리된 업무 표기입니다.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(jobError)}>
            <FieldLabel htmlFor="role-permission-custom-job-name">직무 이름</FieldLabel>
            <Input
              id="role-permission-custom-job-name"
              value={jobLabel}
              aria-invalid={Boolean(jobError)}
              placeholder="CS"
              onChange={(event) => {
                setJobLabel(event.target.value);
                setJobError(null);
              }}
            />
            {jobError ? <FieldError>{jobError}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={saveJobPosition}>직무 저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(assignedRoleKey)} onOpenChange={(open) => !open && setAssignedRoleKey(null)}>
        <SheetContent className="w-[min(440px,calc(100vw-1rem))] sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle>{assignedRole?.label ?? "역할"} 지정 구성원</SheetTitle>
            <SheetDescription>현재 이 역할이 배정된 활성 구성원입니다.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 px-4 pb-4">
            {assignedMembers.length > 0 ? (
              assignedMembers.map((member) => (
                <div key={member.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{getRoleMemberLabel(member)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getSessionWorkspaceJobPositionLabel(
                      getSessionWorkspaceEffectiveJobPositionKey(member),
                      workspace.state,
                      workspaceId
                    )}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">지정된 활성 구성원이 없습니다.</p>
            )}
            {onOpenMemberManagement ? (
              <Button
                variant="outline"
                onClick={() => {
                  setAssignedRoleKey(null);
                  onOpenMemberManagement();
                }}
              >
                구성원 관리 열기
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
