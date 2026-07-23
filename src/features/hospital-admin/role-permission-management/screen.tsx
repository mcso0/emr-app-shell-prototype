"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrPageHeader } from "@/components/emr/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldIcon,
  SlidersIcon,
  UsersIcon,
} from "@/components/icons";
import {
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG,
  archiveSessionWorkspaceCustomJobPosition,
  createOrUpdateSessionWorkspaceCustomPermissionRole,
  createSessionWorkspaceCustomJobPosition,
  deleteSessionWorkspaceCustomPermissionRole,
  getSessionWorkspaceEffectiveJobPositionKey,
  getSessionWorkspaceJobPositionLabel,
  getSessionWorkspaceJobPositions,
  getSessionWorkspacePermissionRoles,
  updateSessionWorkspaceCustomJobPosition,
  type SessionWorkspaceJobPosition,
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
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { cn } from "@/lib/utils";

type RolePermissionManagementScreenProps = {
  onOpenMemberManagement?: () => void;
  workspaceId: string;
};

type RoleDialogState =
  | { mode: "create"; role: null }
  | { mode: "edit"; role: SessionWorkspacePermissionRole };

type JobDialogState =
  | { mode: "create"; position: null }
  | { mode: "edit"; position: SessionWorkspaceJobPosition };

type CatalogDestructiveAction =
  | { type: "role.delete"; label: string }
  | { type: "job.archive"; label: string };

type SettingsSectionKey = "roles" | "positions" | "work-defaults";

type PendingUnsavedAction =
  | { type: "return-to-hub" }
  | { type: "select-role"; roleKey: string | null }
  | { type: "open-member-management" };

const settingsSectionKeys = new Set<SettingsSectionKey>([
  "roles",
  "positions",
  "work-defaults",
]);

function haveSamePermissionIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;

  const rightIds = new Set(right);
  return left.every((permissionId) => rightIds.has(permissionId));
}

const permissionDescriptions: Record<string, string> = {
  "reception:view": "접수 현황과 예약 정보를 확인할 수 있습니다.",
  "reception:create": "새 접수와 예약을 등록할 수 있습니다.",
  "reception:update": "기존 접수와 예약 정보를 변경할 수 있습니다.",
  "patient:view": "보호자와 환자의 기본 정보를 확인할 수 있습니다.",
  "chart:view": "진료 차트와 이전 진료 기록을 확인할 수 있습니다.",
  "chart:update": "진료 차트에 내용을 작성하고 수정할 수 있습니다.",
  "order:request": "검사, 처치, 처방 오더를 요청할 수 있습니다.",
  "order:update": "요청한 오더의 내용을 변경할 수 있습니다.",
  "lab:complete": "검사와 처치 결과를 입력하고 완료할 수 있습니다.",
  "billing:view": "수납 내역과 청구 정보를 확인할 수 있습니다.",
  "billing:issue": "청구서를 발행하고 수납을 처리할 수 있습니다.",
  "service_catalog:view": "병원관리 설정과 서비스 목록을 확인할 수 있습니다.",
  "workspace:delete": "병원 워크스페이스와 연결된 데이터를 삭제합니다.",
  "workspace:ownership_transfer": "병원의 소유자 권한을 다른 구성원에게 이전합니다.",
  "billing:contract_manage": "계약, 요금제, 청구 정보를 변경합니다.",
  "data:dangerous_delete": "복구하기 어려운 병원 데이터를 삭제합니다.",
};

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
  canManage,
  isDirty,
  jobPositions,
  onChange,
  onReset,
  onSave,
  workDefaultsDraft,
  workDefaultsError,
  workDefaultsSaved,
}: {
  canManage: boolean;
  isDirty: boolean;
  jobPositions: ReturnType<typeof getSessionWorkspaceJobPositions>;
  onChange: (next: WorkspaceRoleWorkDefaults) => void;
  onReset: () => void;
  onSave: () => void;
  workDefaultsDraft: WorkspaceRoleWorkDefaults;
  workDefaultsError: string | null;
  workDefaultsSaved: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">권한과 분리된 설정입니다</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          이 브라우저에서만 저장되며 실제 권한이나 구성원 배정을 바꾸지 않습니다.
        </p>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {workDefaultFields.map((field) => (
          <div
            key={field.key}
            className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center"
          >
            <div>
              <FieldLabel htmlFor={`role-work-default-${field.key}`}>{field.label}</FieldLabel>
              <FieldDescription className="mt-1">{field.description}</FieldDescription>
            </div>
            <Select
              disabled={!canManage}
              value={workDefaultsDraft[field.key]}
              onValueChange={(value) => {
                onChange({
                  ...workDefaultsDraft,
                  [field.key]: String(value),
                });
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
          </div>
        ))}
      </div>
      {workDefaultsError ? (
        <p className="text-sm text-destructive" role="alert">
          {workDefaultsError}
        </p>
      ) : null}
      {isDirty || workDefaultsSaved ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground" role={workDefaultsSaved ? "status" : undefined}>
            {workDefaultsSaved
              ? "이 브라우저의 업무 기본값을 저장했습니다."
              : "저장하지 않은 변경이 있습니다."}
          </p>
          {isDirty && canManage ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onReset}>
                취소
              </Button>
              <Button size="sm" onClick={onSave}>
                저장
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SettingsHubRow({
  description,
  icon,
  id,
  onOpen,
  summary,
  summaryIsDirty = false,
  title,
}: {
  description: string;
  icon: ReactNode;
  id: SettingsSectionKey;
  onOpen: () => void;
  summary: string;
  summaryIsDirty?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      data-testid={`role-permission-hub-${id}`}
      className="group flex min-h-20 w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:gap-4"
      onClick={onOpen}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "hidden shrink-0 text-xs text-muted-foreground sm:block",
          summaryIsDirty && "font-medium text-foreground"
        )}
      >
        {summary}
      </span>
      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

function SettingsDetailHeader({
  action,
  description,
  onBack,
  title,
}: {
  action?: ReactNode;
  description: string;
  onBack: () => void;
  title: string;
}) {
  return (
    <header>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4 gap-1.5 text-muted-foreground"
        onClick={onBack}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        역할 및 권한
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold leading-8">{title}</h1>
          <p className="mt-1 emr-text-dense text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

export function RolePermissionManagementScreen({
  onOpenMemberManagement,
  workspaceId,
}: RolePermissionManagementScreenProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const workspace = useWorkspaceRoleState(workspaceId);
  const localRoles = useMemo(
    () => getSessionWorkspacePermissionRoles(workspace.state, workspaceId),
    [workspace.state, workspaceId]
  );
  const localJobPositions = useMemo(
    () => getSessionWorkspaceJobPositions(workspace.state, workspaceId),
    [workspace.state, workspaceId]
  );
  const roles = workspace.permissionRoles ?? localRoles;
  const jobPositions = workspace.jobPositions ?? localJobPositions;
  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>("admin");
  const [selectedJobPositionKey, setSelectedJobPositionKey] = useState("front_desk");
  const [assignedRoleKey, setAssignedRoleKey] = useState<string | null>(null);
  const [roleDialogState, setRoleDialogState] = useState<RoleDialogState | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(() => createRoleDraft());
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleActionError, setRoleActionError] = useState<string | null>(null);
  const [jobDialogState, setJobDialogState] = useState<JobDialogState | null>(null);
  const [jobLabel, setJobLabel] = useState("");
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobActionError, setJobActionError] = useState<string | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [rolePermissionDrafts, setRolePermissionDrafts] = useState<Record<string, string[]>>({});
  const [savedInlineRoleKey, setSavedInlineRoleKey] = useState<string | null>(null);
  const [savedWorkDefaults, setSavedWorkDefaults] = useState<WorkspaceRoleWorkDefaults>(() =>
    readWorkspaceRoleWorkDefaults(workspaceId)
  );
  const [workDefaultsDraft, setWorkDefaultsDraft] = useState<WorkspaceRoleWorkDefaults>(
    savedWorkDefaults
  );
  const [workDefaultsSaved, setWorkDefaultsSaved] = useState(false);
  const [workDefaultsError, setWorkDefaultsError] = useState<string | null>(null);
  const [pendingUnsavedAction, setPendingUnsavedAction] =
    useState<PendingUnsavedAction | null>(null);
  const [catalogDestructiveAction, setCatalogDestructiveAction] =
    useState<CatalogDestructiveAction | null>(null);
  const requestedSettingsSection = searchParams.get("roleSettings");
  const activeSettingsSection = settingsSectionKeys.has(
    requestedSettingsSection as SettingsSectionKey
  )
    ? (requestedSettingsSection as SettingsSectionKey)
    : null;
  const activeSelectedRoleKey =
    selectedRoleKey && roles.some((role) => role.roleKey === selectedRoleKey)
      ? selectedRoleKey
      : null;
  const activeSelectedJobPositionKey = jobPositions.some(
    (position) => position.positionKey === selectedJobPositionKey
  )
    ? selectedJobPositionKey
    : (jobPositions[0]?.positionKey ?? "front_desk");
  const selectedRole = activeSelectedRoleKey
    ? (roles.find((role) => role.roleKey === activeSelectedRoleKey) ?? null)
    : null;
  const selectedJobPosition =
    jobPositions.find((position) => position.positionKey === activeSelectedJobPositionKey) ?? jobPositions[0];
  const selectedRoleMembers = selectedRole
    ? getRoleAssignedMembers(workspace.state, workspaceId, selectedRole.roleKey)
    : [];
  const assignedMembers = assignedRoleKey
    ? getRoleAssignedMembers(workspace.state, workspaceId, assignedRoleKey)
    : [];
  const assignedRole = roles.find((role) => role.roleKey === assignedRoleKey) ?? null;
  const selectedRolePermissionIds = selectedRole
    ? (rolePermissionDrafts[selectedRole.roleKey] ?? selectedRole.permissionIds)
    : [];
  const selectedRoleWithDraft = selectedRole
    ? { ...selectedRole, permissionIds: selectedRolePermissionIds }
    : null;
  const permissionGroups = selectedRoleWithDraft
    ? buildRolePermissionGroups(selectedRoleWithDraft)
    : [];
  const permissionCount = permissionGroups.reduce((count, group) => count + group.rows.length, 0);
  const allowedPermissionCount = permissionGroups.reduce(
    (count, group) => count + group.allowedCount,
    0
  );
  const inlineRolePermissionsDirty = selectedRole
    ? !haveSamePermissionIds(selectedRolePermissionIds, selectedRole.permissionIds)
    : false;
  const dirtyRoleKeys = roles
    .filter((role) => {
      const draftPermissionIds = rolePermissionDrafts[role.roleKey];
      return (
        draftPermissionIds !== undefined &&
        !haveSamePermissionIds(draftPermissionIds, role.permissionIds)
      );
    })
    .map((role) => role.roleKey);
  const hasRolePermissionDrafts = dirtyRoleKeys.length > 0;
  const isWorkDefaultsDirty =
    JSON.stringify(savedWorkDefaults) !== JSON.stringify(workDefaultsDraft);
  const hasUnsavedChanges = hasRolePermissionDrafts || isWorkDefaultsDirty;

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getWorkspaceRoleWorkDefaultsStorageKey(workspaceId)) return;

      const nextDefaults = readWorkspaceRoleWorkDefaults(workspaceId);
      setSavedWorkDefaults((previousSavedDefaults) => {
        setWorkDefaultsDraft((currentDraft) =>
          JSON.stringify(currentDraft) === JSON.stringify(previousSavedDefaults)
            ? nextDefaults
            : currentDraft
        );
        return nextDefaults;
      });
      setWorkDefaultsSaved(false);
      setWorkDefaultsError(null);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [workspaceId]);

  useEffect(() => {
    setSettingsDirty(hasUnsavedChanges);
    return () => setSettingsDirty(false);
  }, [hasUnsavedChanges, setSettingsDirty]);

  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [hasUnsavedChanges]);

  const openSettingsSection = (section: SettingsSectionKey) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("section", "roles");
    nextSearchParams.set("roleSettings", section);
    router.push(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
  };

  const navigateToSettingsHub = () => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("section", "roles");
    nextSearchParams.delete("roleSettings");
    router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
  };

  const navigateToMemberManagement = () => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("section", "members");
    nextSearchParams.delete("roleSettings");
    router.push(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
    onOpenMemberManagement?.();
  };

  const runUnsavedAction = (action: PendingUnsavedAction) => {
    if (action.type === "return-to-hub") {
      navigateToSettingsHub();
      return;
    }

    if (action.type === "open-member-management") {
      navigateToMemberManagement();
      return;
    }

    setSelectedRoleKey(action.roleKey);
    setSavedInlineRoleKey(null);
    setRoleActionError(null);
  };

  const activeSectionHasUnsavedChanges =
    (activeSettingsSection === "roles" && inlineRolePermissionsDirty) ||
    (activeSettingsSection === "work-defaults" && isWorkDefaultsDirty);

  const requestUnsavedAction = (action: PendingUnsavedAction) => {
    if (activeSectionHasUnsavedChanges) {
      setPendingUnsavedAction(action);
      return;
    }

    runUnsavedAction(action);
  };

  const discardActiveChanges = () => {
    if (activeSettingsSection === "roles" && selectedRole) {
      setRolePermissionDrafts((current) => {
        const next = { ...current };
        delete next[selectedRole.roleKey];
        return next;
      });
      setSavedInlineRoleKey(null);
      setRoleActionError(null);
    }

    if (activeSettingsSection === "work-defaults") {
      setWorkDefaultsDraft(savedWorkDefaults);
      setWorkDefaultsSaved(false);
      setWorkDefaultsError(null);
    }
  };

  const confirmUnsavedAction = () => {
    if (!pendingUnsavedAction) return;

    const action = pendingUnsavedAction;
    discardActiveChanges();
    setPendingUnsavedAction(null);
    runUnsavedAction(action);
  };

  const returnToSettingsHub = () => {
    requestUnsavedAction({ type: "return-to-hub" });
  };

  const openMemberManagement = () => {
    requestUnsavedAction({ type: "open-member-management" });
  };

  const updateWorkDefaultsDraft = (nextDefaults: WorkspaceRoleWorkDefaults) => {
    setWorkDefaultsDraft(nextDefaults);
    setWorkDefaultsSaved(false);
    setWorkDefaultsError(null);
  };

  const resetWorkDefaults = () => {
    setWorkDefaultsDraft(savedWorkDefaults);
    setWorkDefaultsSaved(false);
    setWorkDefaultsError(null);
  };

  const saveWorkDefaults = () => {
    try {
      persistWorkspaceRoleWorkDefaults(workspaceId, workDefaultsDraft);
      setSavedWorkDefaults(workDefaultsDraft);
      setWorkDefaultsSaved(true);
      setWorkDefaultsError(null);
    } catch {
      setWorkDefaultsSaved(false);
      setWorkDefaultsError(
        "브라우저 저장소에 저장하지 못했습니다. 브라우저 설정을 확인한 뒤 다시 시도하세요."
      );
    }
  };

  const openRoleDialog = (role?: SessionWorkspacePermissionRole) => {
    setRoleDialogState(role ? { mode: "edit", role } : { mode: "create", role: null });
    setRoleDraft(createRoleDraft(role));
    setRoleError(null);
  };

  const openJobDialog = (position?: SessionWorkspaceJobPosition) => {
    setJobDialogState(position ? { mode: "edit", position } : { mode: "create", position: null });
    setJobLabel(position?.label ?? "");
    setJobError(null);
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

  const toggleInlineRolePermission = (permissionId: string, checked: boolean) => {
    if (!selectedRole || selectedRole.isSystem || !workspace.canManage) return;
    if (
      !SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.some(
        (permission) => permission.id === permissionId
      )
    ) {
      return;
    }

    setRolePermissionDrafts((current) => {
      const currentIds = current[selectedRole.roleKey] ?? selectedRole.permissionIds;
      return {
        ...current,
        [selectedRole.roleKey]: checked
          ? Array.from(new Set([...currentIds, permissionId]))
          : currentIds.filter((item) => item !== permissionId),
      };
    });
    setSavedInlineRoleKey(null);
    setRoleActionError(null);
  };

  const resetInlineRolePermissions = () => {
    if (!selectedRole) return;

    setRolePermissionDrafts((current) => {
      const next = { ...current };
      delete next[selectedRole.roleKey];
      return next;
    });
    setSavedInlineRoleKey(null);
    setRoleActionError(null);
  };

  const saveInlineRolePermissions = async () => {
    if (!selectedRole || selectedRole.isSystem || !workspace.canManage) return;

    const validation = validateRoleDraft({
      roleKey: selectedRole.roleKey,
      label: selectedRole.label,
      description: selectedRole.description ?? "",
      permissionIds: selectedRolePermissionIds,
    });
    if (!validation.valid) {
      setRoleActionError(getRoleValidationMessage(validation.reason));
      return;
    }

    setRoleActionError(null);
    setSavingCatalog(true);

    if (workspace.usesServerCatalog) {
      const snapshot = await workspace.mutateCatalog({
        action: "role.update",
        roleKey: selectedRole.roleKey,
        role: {
          label: selectedRole.label,
          description: selectedRole.description ?? "",
          permissionIds: selectedRolePermissionIds,
        },
      });

      if (!snapshot) {
        setSavingCatalog(false);
        setRoleActionError(workspace.catalogError ?? "역할 권한을 저장하지 못했습니다.");
        return;
      }
    } else {
      const result = createOrUpdateSessionWorkspaceCustomPermissionRole(workspace.state, {
        workspaceId,
        roleKey: selectedRole.roleKey,
        label: selectedRole.label,
        description: selectedRole.description ?? "",
        permissionIds: selectedRolePermissionIds,
      });

      if (!result.success) {
        setSavingCatalog(false);
        setRoleActionError(getRoleValidationMessage(result.reason));
        return;
      }

      workspace.updateState(result.state);
    }

    setRolePermissionDrafts((current) => {
      const next = { ...current };
      delete next[selectedRole.roleKey];
      return next;
    });
    setSavedInlineRoleKey(selectedRole.roleKey);
    setSavingCatalog(false);
  };

  const saveRole = async () => {
    const validation = validateRoleDraft(roleDraft);
    if (!validation.valid) {
      setRoleError(getRoleValidationMessage(validation.reason));
      return;
    }

    const roleKey = roleDialogState?.mode === "edit" ? roleDialogState.role.roleKey : undefined;
    if (workspace.usesServerCatalog) {
      setSavingCatalog(true);
      const snapshot = await workspace.mutateCatalog({
        action: roleKey ? "role.update" : "role.create",
        roleKey,
        role: {
          label: roleDraft.label,
          description: roleDraft.description,
          permissionIds: roleDraft.permissionIds,
        },
      });
      setSavingCatalog(false);

      if (!snapshot) {
        setRoleError(workspace.catalogError ?? "역할 변경을 저장하지 못했습니다.");
        return;
      }

      const nextRole = roleKey
        ? snapshot.permissionRoles.find((role) => role.roleKey === roleKey)
        : snapshot.permissionRoles.find(
            (role) => role.roleType === "custom" && role.label === roleDraft.label.trim()
          );
      setSelectedRoleKey(nextRole?.roleKey ?? selectedRoleKey);
      setRoleDialogState(null);
      return;
    }

    const result = createOrUpdateSessionWorkspaceCustomPermissionRole(workspace.state, {
      workspaceId,
      roleKey,
      label: roleDraft.label,
      description: roleDraft.description,
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

  const saveJobPosition = async () => {
    const positionKey = jobDialogState?.mode === "edit" ? jobDialogState.position.positionKey : undefined;
    if (workspace.usesServerCatalog) {
      if (!jobLabel.trim()) {
        setJobError(getJobValidationMessage("empty_label"));
        return;
      }

      setSavingCatalog(true);
      const snapshot = await workspace.mutateCatalog({
        action: positionKey ? "job.update" : "job.create",
        positionKey,
        job: { label: jobLabel },
      });
      setSavingCatalog(false);
      if (!snapshot) {
        setJobError(workspace.catalogError ?? "직무 변경을 저장하지 못했습니다.");
        return;
      }

      const nextPosition = positionKey
        ? snapshot.jobPositions.find((position) => position.positionKey === positionKey)
        : snapshot.jobPositions.find(
            (position) => !position.isSystem && position.label === jobLabel.trim() && position.isActive
          );
      setSelectedJobPositionKey(nextPosition?.positionKey ?? selectedJobPositionKey);
      setJobDialogState(null);
      setJobLabel("");
      setJobError(null);
      return;
    }

    const result = positionKey
      ? updateSessionWorkspaceCustomJobPosition(workspace.state, {
          workspaceId,
          positionKey,
          label: jobLabel,
        })
      : createSessionWorkspaceCustomJobPosition(workspace.state, {
          workspaceId,
          label: jobLabel,
        });

    if (!result.success) {
      setJobError(getJobValidationMessage(result.reason));
      return;
    }

    workspace.updateState(result.state);
    setSelectedJobPositionKey(result.position.positionKey);
    setJobDialogState(null);
    setJobLabel("");
    setJobError(null);
  };

  const deleteSelectedRole = async () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setRoleActionError(null);

    if (workspace.usesServerCatalog) {
      setSavingCatalog(true);
      const snapshot = await workspace.mutateCatalog({ action: "role.delete", roleKey: selectedRole.roleKey });
      setSavingCatalog(false);
      if (!snapshot) {
        setRoleActionError(workspace.catalogError ?? "역할을 삭제하지 못했습니다.");
        return;
      }
    } else {
      const result = deleteSessionWorkspaceCustomPermissionRole(workspace.state, {
        workspaceId,
        roleKey: selectedRole.roleKey,
      });
      if (!result.success) {
        setRoleActionError(
          result.reason === "role_referenced"
            ? "구성원 또는 초대에 배정된 역할은 삭제할 수 없습니다. 먼저 배정을 변경하세요."
            : "역할을 삭제할 수 없습니다."
        );
        return;
      }
      workspace.updateState(result.state);
    }

    setSelectedRoleKey(roles.find((role) => role.roleKey !== selectedRole.roleKey)?.roleKey ?? "admin");
  };

  const archiveSelectedJobPosition = async () => {
    if (!selectedJobPosition || selectedJobPosition.isSystem) return;
    setJobActionError(null);

    if (workspace.usesServerCatalog) {
      setSavingCatalog(true);
      const snapshot = await workspace.mutateCatalog({
        action: "job.archive",
        positionKey: selectedJobPosition.positionKey,
      });
      setSavingCatalog(false);
      if (!snapshot) {
        setJobActionError(workspace.catalogError ?? "직무를 보관하지 못했습니다.");
        return;
      }
    } else {
      const result = archiveSessionWorkspaceCustomJobPosition(workspace.state, {
        workspaceId,
        positionKey: selectedJobPosition.positionKey,
      });
      if (!result.success) {
        setJobActionError("직무를 보관할 수 없습니다.");
        return;
      }
      workspace.updateState(result.state);
    }

    setSelectedJobPositionKey(
      jobPositions.find((position) => position.positionKey !== selectedJobPosition.positionKey)?.positionKey ??
        "front_desk"
    );
  };

  if (!workspace.hydrated || (workspace.usesServerCatalog && workspace.catalogStatus === "loading")) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] p-5">
        <EmrPageHeader title="역할 및 권한" />
        <p className="mt-6 text-sm text-muted-foreground">권한 정보를 준비하고 있습니다.</p>
      </div>
    );
  }

  if (workspace.usesServerCatalog && workspace.catalogStatus === "error") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] p-5">
        <EmrPageHeader title="역할 및 권한" />
        <Card className="mt-6 max-w-xl">
          <CardHeader>
            <CardTitle>역할 정보를 불러오지 못했습니다</CardTitle>
            <CardDescription role="alert">
              {workspace.catalogError ?? "권한 또는 연결 상태를 확인한 뒤 다시 시도하세요."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void workspace.reloadCatalog()}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      data-testid="hospital-admin-role-permission-screen"
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
    >
      <ScrollArea className="min-h-0 flex-1">
        <main
          data-testid="role-permission-content"
          className="mx-auto grid w-full max-w-[920px] gap-8 px-5 py-8 pb-24 md:px-8"
        >
          {!workspace.canView ? (
            <div className="grid gap-6">
              <header>
                <h1 className="text-[24px] font-semibold leading-8">역할 및 권한</h1>
                <p className="mt-1 emr-text-dense text-muted-foreground">
                  구성원이 할 수 있는 일과 병원 안에서 맡는 업무를 관리합니다.
                </p>
              </header>
              <Card>
                <CardHeader>
                  <CardTitle>역할 정보를 볼 수 없습니다</CardTitle>
                  <CardDescription>로그인한 구성원만 역할과 권한을 확인할 수 있습니다.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          ) : activeSettingsSection === null ? (
            <div className="grid gap-8 animate-in fade-in-0 duration-150">
              <header>
                <h1 className="text-[24px] font-semibold leading-8">역할 및 권한</h1>
                <p className="mt-1 emr-text-dense text-muted-foreground">
                  구성원이 할 수 있는 일과 병원 안에서 맡는 업무를 관리합니다.
                </p>
                {workspace.canManage && workspace.ownerReconciliation?.needsConfirmation ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p>소유자 확인 필요: 기존 병원관리자 중 한 명을 임시 소유자로 지정했습니다.</p>
                    {onOpenMemberManagement ? (
                      <Button size="sm" variant="outline" onClick={openMemberManagement}>
                        구성원 관리 열기
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </header>
              <section aria-labelledby="role-permission-settings-heading" className="grid gap-3">
                <div>
                  <h2 id="role-permission-settings-heading" className="text-sm font-medium">설정 항목</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    관리할 항목을 선택하면 상세 설정 화면으로 이동합니다.
                  </p>
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  <SettingsHubRow
                    id="roles"
                    title="권한 역할"
                    description="구성원이 사용할 수 있는 화면과 기능을 역할별로 설정합니다."
                    summary={
                      hasRolePermissionDrafts ? "저장하지 않은 변경" : `${roles.length}개 역할`
                    }
                    summaryIsDirty={hasRolePermissionDrafts}
                    icon={<ShieldIcon className="size-4" aria-hidden="true" />}
                    onOpen={() => openSettingsSection("roles")}
                  />
                  <SettingsHubRow
                    id="positions"
                    title="직무"
                    description="병원에서 맡는 업무 표기와 분류를 관리합니다."
                    summary={`${jobPositions.length}개 직무`}
                    icon={<UsersIcon className="size-4" aria-hidden="true" />}
                    onOpen={() => openSettingsSection("positions")}
                  />
                  <SettingsHubRow
                    id="work-defaults"
                    title="업무 기본값"
                    description="업무를 시작할 때 제안할 기본 담당 직무를 설정합니다."
                    summary={
                      isWorkDefaultsDirty
                        ? "저장하지 않은 변경"
                        : `${workDefaultFields.length}개 업무`
                    }
                    summaryIsDirty={isWorkDefaultsDirty}
                    icon={<SlidersIcon className="size-4" aria-hidden="true" />}
                    onOpen={() => openSettingsSection("work-defaults")}
                  />
                </div>
              </section>
            </div>
          ) : activeSettingsSection === "roles" ? (
            <div className="grid gap-8 animate-in fade-in-0 slide-in-from-right-2 duration-150">
              <SettingsDetailHeader
                title="권한 역할"
                description="역할을 선택해 배정된 구성원과 사용할 수 있는 기능을 확인합니다."
                onBack={returnToSettingsHub}
                action={workspace.canManage ? (
                  <Button size="sm" onClick={() => openRoleDialog()}>새 커스텀 역할</Button>
                ) : undefined}
              />
              <section aria-labelledby="role-item-list-heading" className="grid gap-3">
                <div>
                  <h2 id="role-item-list-heading" className="text-sm font-medium">역할 목록</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    역할을 열면 배정된 구성원과 세부 권한이 같은 항목 안에 표시됩니다.
                  </p>
                </div>
                <div
                  data-testid="role-summary-grid"
                  className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
                >
                  {roles.map((role) => {
                    const roleMembers = getRoleAssignedMembers(
                      workspace.state,
                      workspaceId,
                      role.roleKey
                    );
                    const memberLabels = roleMembers.map(getRoleMemberLabel);
                    const selected = activeSelectedRoleKey === role.roleKey;
                    const roleForSummary =
                      selected && selectedRoleWithDraft ? selectedRoleWithDraft : role;
                    const roleGroups = buildRolePermissionGroups(roleForSummary);
                    const rolePermissionCount = roleGroups.reduce(
                      (count, group) => count + group.rows.length,
                      0
                    );
                    const roleAllowedPermissionCount = roleGroups.reduce(
                      (count, group) => count + group.allowedCount,
                      0
                    );
                    const panelId = `role-permission-panel-${role.roleKey}`;

                    return (
                      <section
                        key={role.roleKey}
                        data-state={selected ? "open" : "closed"}
                        className={cn(
                          "transition-colors duration-150",
                          selected && "bg-muted/30"
                        )}
                      >
                        <button
                          type="button"
                          data-testid={`role-item-${role.roleKey}`}
                          className="group grid min-h-20 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[180px_minmax(0,1fr)_auto]"
                          aria-expanded={selected}
                          aria-controls={panelId}
                          onClick={() => {
                            requestUnsavedAction({
                              type: "select-role",
                              roleKey: selected ? null : role.roleKey,
                            });
                          }}
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{role.label}</span>
                            <Badge variant="outline">
                              {role.isSystem ? "시스템 · 읽기 전용" : "커스텀 역할"}
                            </Badge>
                          </span>
                          <span className="col-span-2 min-w-0 text-xs leading-5 text-muted-foreground md:col-span-1">
                            <span className="block">
                              {role.description ?? "권한 구성과 배정 현황을 확인합니다."}
                            </span>
                            <span className="mt-0.5 block text-foreground/75">
                              {memberLabels.length > 0
                                ? memberLabels.join(" · ")
                                : "배정된 구성원 없음"}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            <strong className="font-medium text-foreground">{roleMembers.length}명</strong>
                            <span>
                              {roleAllowedPermissionCount}/{rolePermissionCount} 허용
                            </span>
                            <ChevronDownIcon
                              className={cn(
                                "size-4 transition-transform duration-150",
                                selected && "rotate-180"
                              )}
                              aria-hidden="true"
                            />
                          </span>
                        </button>

                        {selected && selectedRole ? (
                          <div
                            id={panelId}
                            data-testid={`role-panel-${role.roleKey}`}
                            className="grid gap-6 border-t border-border px-4 py-5 md:px-5"
                          >
                            <div className="grid gap-4 rounded-lg bg-muted/45 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground">
                                  배정 구성원 {selectedRoleMembers.length}명
                                </p>
                                <p
                                  data-testid={`role-member-names-${selectedRole.roleKey}`}
                                  className="mt-1 text-sm leading-6 text-foreground"
                                >
                                  {selectedRoleMembers.length > 0
                                    ? selectedRoleMembers.map(getRoleMemberLabel).join(" · ")
                                    : "아직 배정된 구성원이 없습니다."}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {allowedPermissionCount}/{permissionCount}개 권한 허용 ·{" "}
                                  {selectedRole.isSystem
                                    ? "시스템 기본 역할"
                                    : "병원 커스텀 역할"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {onOpenMemberManagement ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setAssignedRoleKey(selectedRole.roleKey)}
                                  >
                                    구성원 관리
                                  </Button>
                                ) : null}
                                {!selectedRole.isSystem ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!workspace.canManage || savingCatalog}
                                      onClick={() => openRoleDialog(selectedRole)}
                                    >
                                      역할 정보 편집
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!workspace.canManage || savingCatalog}
                                      onClick={() =>
                                        setCatalogDestructiveAction({
                                          type: "role.delete",
                                          label: selectedRole.label,
                                        })
                                      }
                                    >
                                      역할 삭제
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {roleActionError ? (
                              <p role="alert" className="text-sm text-destructive">
                                {roleActionError}
                              </p>
                            ) : null}

                            <section
                              aria-labelledby={`permission-detail-heading-${selectedRole.roleKey}`}
                              className="grid gap-6"
                            >
                              <div>
                                <h3
                                  id={`permission-detail-heading-${selectedRole.roleKey}`}
                                  className="text-sm font-medium"
                                >
                                  세부 권한
                                </h3>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {selectedRole.isSystem
                                    ? "시스템 역할은 현재 권한 상태만 확인할 수 있습니다."
                                    : "토글을 변경한 뒤 아래 저장 버튼으로 적용합니다."}
                                </p>
                              </div>
                              {permissionGroups.map((group) => (
                                <section
                                  key={group.id}
                                  aria-labelledby={`permission-group-${selectedRole.roleKey}-${group.id}`}
                                  className="grid gap-2"
                                >
                                  <div className="flex items-center justify-between gap-3 px-1">
                                    <h4
                                      id={`permission-group-${selectedRole.roleKey}-${group.id}`}
                                      className="text-sm font-medium"
                                    >
                                      {group.label}
                                    </h4>
                                    <span className="text-xs text-muted-foreground">
                                      {group.allowedCount}/{group.rows.length} 허용
                                    </span>
                                  </div>
                                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                                    {group.rows.map((permission) => {
                                      const switchDisabled =
                                        !permission.editable ||
                                        !workspace.canManage ||
                                        savingCatalog;

                                      return (
                                        <div
                                          key={permission.id}
                                          className={cn(
                                            "flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:flex-nowrap sm:gap-4",
                                            !permission.allowed && "text-muted-foreground"
                                          )}
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="text-sm font-medium">
                                                {permission.label}
                                              </span>
                                              {permission.lockReason === "owner_only" ? (
                                                <Badge variant="outline">소유자 전용</Badge>
                                              ) : null}
                                            </div>
                                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                              {permissionDescriptions[permission.id] ??
                                                "해당 기능을 사용할 수 있습니다."}
                                            </p>
                                          </div>
                                          <div className="ml-auto flex shrink-0 items-center gap-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              {permission.allowed ? "허용" : "차단"}
                                            </span>
                                            <Switch
                                              aria-label={`${permission.label} · ${
                                                permission.allowed ? "허용" : "차단"
                                              }${
                                                selectedRole.isSystem
                                                  ? " · 시스템 역할 읽기 전용"
                                                  : permission.lockReason === "owner_only"
                                                    ? " · 소유자 전용"
                                                    : ""
                                              }`}
                                              checked={permission.allowed}
                                              disabled={switchDisabled}
                                              onCheckedChange={(checked) =>
                                                toggleInlineRolePermission(
                                                  permission.id,
                                                  Boolean(checked)
                                                )
                                              }
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </section>
                              ))}
                            </section>

                            {!selectedRole.isSystem &&
                            (inlineRolePermissionsDirty ||
                              savedInlineRoleKey === selectedRole.roleKey) ? (
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
                                <p
                                  className="text-sm text-muted-foreground"
                                  role={
                                    savedInlineRoleKey === selectedRole.roleKey
                                      ? "status"
                                      : undefined
                                  }
                                >
                                  {savedInlineRoleKey === selectedRole.roleKey
                                    ? "역할 권한을 저장했습니다."
                                    : "저장하지 않은 권한 변경이 있습니다."}
                                </p>
                                {inlineRolePermissionsDirty ? (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={savingCatalog}
                                      onClick={resetInlineRolePermissions}
                                    >
                                      취소
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={savingCatalog}
                                      onClick={() => void saveInlineRolePermissions()}
                                    >
                                      {savingCatalog ? "저장 중" : "권한 저장"}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
                {roles.every((role) => role.isSystem) ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    아직 커스텀 역할이 없습니다. 병원 업무에 맞는 역할이 필요하면 새로 추가할 수 있습니다.
                  </p>
                ) : null}
              </section>
            </div>
          ) : activeSettingsSection === "positions" ? (
            <div className="grid gap-8 animate-in fade-in-0 slide-in-from-right-2 duration-150">
              <SettingsDetailHeader
                title="직무"
                description="구성원의 업무 표기와 분류를 관리합니다."
                onBack={returnToSettingsHub}
                action={(
                  <Button
                    size="sm"
                    disabled={!workspace.canManage || savingCatalog}
                    onClick={() => openJobDialog()}
                  >
                    직무 추가
                  </Button>
                )}
              />
              <div className="grid gap-5">
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">직무와 권한 역할은 별개입니다</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      직무를 바꿔도 사용할 수 있는 화면이나 기능은 달라지지 않습니다.
                    </p>
                  </div>
                  <div>
                    <h2 className="text-sm font-medium">직무 목록</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      커스텀 직무를 선택하면 기존 편집 창이 열립니다.
                    </p>
                  </div>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {jobPositions.map((position) => {
                      const assignedCount = workspace.state.memberships.filter(
                        (member) =>
                          member.workspaceId === workspaceId &&
                          member.status === "active" &&
                          getSessionWorkspaceEffectiveJobPositionKey(member) === position.positionKey
                      ).length;
                      const rowContent = (
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{position.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {position.isSystem ? "시스템 직무" : "커스텀 직무"} · {assignedCount}명 배정
                          </span>
                        </span>
                      );

                      if (position.isSystem || !workspace.canManage) {
                        return (
                          <div
                            key={position.positionKey}
                            data-testid={`job-position-readonly-${position.positionKey}`}
                            className="flex min-h-16 w-full items-center px-4 py-3.5"
                          >
                            {rowContent}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={position.positionKey}
                          type="button"
                          data-testid={`job-position-action-${position.positionKey}`}
                          className="group flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          onClick={() => {
                            setSelectedJobPositionKey(position.positionKey);
                            openJobDialog(position);
                          }}
                        >
                          {rowContent}
                          <ChevronRightIcon
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                  </div>

                  {jobPositions.every((position) => position.isSystem) ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      아직 커스텀 직무가 없습니다. 필요한 업무 분류가 있다면 새 직무를 추가하세요.
                    </p>
                  ) : null}
                  {jobActionError ? (
                    <p role="alert" className="text-sm text-destructive">{jobActionError}</p>
                  ) : null}
                  {onOpenMemberManagement ? (
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={openMemberManagement}>구성원 관리 열기</Button>
                    </div>
                  ) : null}
                </div>
            </div>
          ) : (
            <div className="grid gap-8 animate-in fade-in-0 slide-in-from-right-2 duration-150">
              <SettingsDetailHeader
                title="업무 기본값"
                description="업무를 시작할 때 먼저 제안할 담당 직무를 설정합니다."
                onBack={returnToSettingsHub}
              />
                <WorkDefaultsPanel
                  canManage={workspace.canManage}
                  isDirty={isWorkDefaultsDirty}
                  jobPositions={jobPositions}
                  onChange={updateWorkDefaultsDraft}
                  onReset={resetWorkDefaults}
                  onSave={saveWorkDefaults}
                  workDefaultsDraft={workDefaultsDraft}
                  workDefaultsError={workDefaultsError}
                  workDefaultsSaved={workDefaultsSaved}
                />
            </div>
          )}
        </main>
      </ScrollArea>

      <Dialog
        open={pendingUnsavedAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnsavedAction(null);
        }}
      >
        <EmrConfirmDialogContent
          title="저장하지 않은 변경사항이 있습니다"
          description={
            activeSettingsSection === "work-defaults"
              ? "업무 기본값 변경을 저장하지 않았습니다. 변경사항을 버리고 이동할까요?"
              : "역할 권한 변경을 저장하지 않았습니다. 변경사항을 버리고 이동할까요?"
          }
          cancelLabel="계속 편집"
          confirmLabel="변경사항 버리기"
          confirmButtonVariant="destructive"
          onCancel={() => setPendingUnsavedAction(null)}
          onConfirm={confirmUnsavedAction}
        />
      </Dialog>

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
              <FieldLabel htmlFor="role-permission-custom-role-description">설명</FieldLabel>
              <Input
                id="role-permission-custom-role-description"
                value={roleDraft.description}
                placeholder="검사 결과 확인과 입력을 맡습니다."
                onChange={(event) => {
                  setRoleDraft((current) => ({ ...current, description: event.target.value }));
                  setRoleError(null);
                }}
              />
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
            <Button variant="outline" disabled={savingCatalog} onClick={() => setRoleDialogState(null)}>
              취소
            </Button>
            <Button
              disabled={
                savingCatalog ||
                roleDialogState?.mode === "edit" &&
                !isRoleDraftDirty(roleDraft, roleDialogState.role)
              }
              onClick={() => void saveRole()}
            >
              {savingCatalog ? "저장 중" : "역할 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(jobDialogState)}
        onOpenChange={(open) => {
          if (open) return;
          setJobDialogState(null);
          if (!open) {
            setJobLabel("");
            setJobError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{jobDialogState?.mode === "edit" ? "직무 편집" : "직무 추가"}</DialogTitle>
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
            {jobDialogState?.mode === "edit" ? (
              <Button
                className="sm:mr-auto"
                variant="outline"
                disabled={savingCatalog}
                onClick={() => {
                  setJobDialogState(null);
                  setCatalogDestructiveAction({
                    type: "job.archive",
                    label: jobDialogState.position.label,
                  });
                }}
              >
                직무 보관
              </Button>
            ) : null}
            <Button variant="outline" disabled={savingCatalog} onClick={() => setJobDialogState(null)}>
              취소
            </Button>
            <Button disabled={savingCatalog} onClick={() => void saveJobPosition()}>
              {savingCatalog ? "저장 중" : "직무 저장"}
            </Button>
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
              <EmrEmptyState
                kind="no-data"
                priority="supporting"
                surface="drawer"
                size="sm"
                reserveActionSpace={false}
                testId="hospital-role-assigned-members-empty-state"
                title="지정된 활성 구성원이 없습니다"
              />
            )}
            {onOpenMemberManagement ? (
              <Button
                variant="outline"
                onClick={() => {
                  setAssignedRoleKey(null);
                  openMemberManagement();
                }}
              >
                구성원 관리 열기
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(catalogDestructiveAction)}
        onOpenChange={(open) => {
          if (!open) setCatalogDestructiveAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {catalogDestructiveAction?.type === "role.delete" ? "역할 삭제" : "직무 보관"}
            </DialogTitle>
            <DialogDescription>
              {catalogDestructiveAction?.type === "role.delete"
                ? `${catalogDestructiveAction.label} 역할을 삭제합니다. 구성원이나 초대에 배정되어 있으면 삭제할 수 없습니다.`
                : `${catalogDestructiveAction?.label ?? "선택한"} 직무를 보관합니다. 새 배정과 업무 기본값에서는 제외됩니다.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingCatalog}
              onClick={() => setCatalogDestructiveAction(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={savingCatalog}
              onClick={() => {
                const action = catalogDestructiveAction;
                setCatalogDestructiveAction(null);
                if (action?.type === "role.delete") void deleteSelectedRole();
                if (action?.type === "job.archive") void archiveSelectedJobPosition();
              }}
            >
              {catalogDestructiveAction?.type === "role.delete" ? "역할 삭제" : "직무 보관"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
