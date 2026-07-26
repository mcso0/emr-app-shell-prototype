"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrPageHeader } from "@/components/emr/page-header";
import {
  EmrModuleListSidePanel,
  EmrModuleListSidePanelBadge,
  type EmrModuleListSidePanelItem,
} from "@/components/emr/module-list-side-panel";
import {
  CalendarCheckIcon,
  CircleCloseFillIcon,
  ContactBookIcon,
  DocumentIcon,
  MessagesIcon,
  SendIcon,
  UserCrossIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomerGuardianRows,
  getCustomerPatientRows,
  type CustomerGuardianRow,
  type CustomerPatientRow,
} from "@/features/customer/data";
import {
  CustomerDataTable,
  type CustomerTableReadStatus,
} from "@/features/customer/components/customer-data-table";
import {
  createCustomerGuardianColumns,
  createCustomerPatientColumns,
} from "@/features/customer/components/customer-table-columns";
import { useMockAuthStore } from "@/features/auth/session-store";
import {
  useCustomerStore,
  type CustomerListMode,
  type CustomerProfileReadStatus,
} from "@/features/customer/store";
import { NewUnifiedRegistrationButton } from "@/features/reception/profile-drawer";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import type { ReceptionPatientGuardianLookupResponse } from "@/features/reception/patient-guardian-lookup";
import {
  isPreparedEmptyClinicWorkspace,
  resolveWorkspaceRouteParam,
} from "@/lib/emr-domain/demo-workspaces";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

const customerSideItems = [
  { value: "patient" as const, label: "동물", icon: UserIcon },
  { value: "guardian" as const, label: "보호자", icon: UsersIcon },
  { value: "deleted" as const, label: "삭제된 보호자/동물", icon: UserCrossIcon },
];

const placeholderSideItems = [
  { label: "스케줄 관리", icon: CalendarCheckIcon },
  { label: "발송 관리", icon: SendIcon },
  { label: "서류 관리", icon: DocumentIcon },
  { label: "CS내역", icon: MessagesIcon },
  { label: "진료의뢰수신", icon: ContactBookIcon },
];
const customerTableMinWidths = {
  guardian: 1120,
  patient: 1320,
} as const;

function getCustomerWorkspaceId(value?: string | string[]) {
  return resolveWorkspaceRouteParam(value);
}

function isCustomerProfileReadLoading({
  status,
  workspaceId,
  workspaceIdForState,
}: {
  status: CustomerProfileReadStatus;
  workspaceId: string;
  workspaceIdForState: string | null;
}) {
  if (!isPreparedEmptyClinicWorkspace(workspaceId)) return false;
  if (workspaceIdForState !== workspaceId) return true;

  return status === "idle" || status === "loading";
}

export function CustomerSidePanel({ moduleLabel }: ShellComponentProps) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getCustomerWorkspaceId(params.workspaceId);
  const listMode = useCustomerStore((state) => state.listMode);
  const setListMode = useCustomerStore((state) => state.setListMode);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const patients = usePatientProfileStore((state) => state.patients);
  const profileReadState = useCustomerStore((state) => state.profileReadState);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["master"]));
  const patientCount = useMemo(
    () =>
      getCustomerPatientRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }).length,
    [guardians, patientGuardians, patients, workspaceId]
  );
  const guardianCount = useMemo(
    () =>
      getCustomerGuardianRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }).length,
    [guardians, patientGuardians, patients, workspaceId]
  );
  const customerCounts: Record<CustomerListMode, number> = {
    deleted: 0,
    guardian: guardianCount,
    patient: patientCount,
  };
  const profileReadLoading = isCustomerProfileReadLoading({
    status: profileReadState.status,
    workspaceId,
    workspaceIdForState: profileReadState.workspaceId,
  });
  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  };
  const sidePanelItems: EmrModuleListSidePanelItem[] = [
    {
      type: "section",
      id: "master",
      label: "보호자/동물 관리",
      icon: <ContactBookIcon className="size-4 shrink-0" />,
      children: customerSideItems.map((item) => {
        const Icon = item.icon;

        return {
          type: "leaf" as const,
          id: item.value,
          active: listMode === item.value,
          count: (
            <CustomerSidePanelCountBadge
              count={customerCounts[item.value]}
              loading={profileReadLoading && item.value !== "deleted" && customerCounts[item.value] === 0}
              label={item.label}
            />
          ),
          icon: <Icon className="size-4 shrink-0" />,
          label: item.label,
          onClick: () => setListMode(item.value),
          testId: `customer-side-panel-${item.value}`,
        };
      }),
    },
    ...placeholderSideItems.map((item) => {
      const Icon = item.icon;

      return {
        type: "button" as const,
        id: item.label,
        count: <EmrModuleListSidePanelBadge variant="outline">후속</EmrModuleListSidePanelBadge>,
        disabled: true,
        icon: <Icon className="size-4 shrink-0" />,
        label: item.label,
      };
    }),
  ];

  return (
    <EmrModuleListSidePanel
      title={moduleLabel}
      items={sidePanelItems}
      onCollapse={() => setModulePanelOpen(false)}
      onToggleSection={toggleSection}
      openSectionIds={openSections}
      testId="customer-side-panel"
    />
  );
}

function CustomerSidePanelCountBadge({
  count,
  label,
  loading,
}: {
  count: number;
  label: string;
  loading: boolean;
}) {
  return (
    <EmrModuleListSidePanelBadge>
      {loading ? (
        <Skeleton
          aria-label={`${label} 수 불러오는 중`}
          className="h-3 w-4 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]"
          data-testid={`customer-side-panel-${label}-count-skeleton`}
        />
      ) : (
        count
      )}
    </EmrModuleListSidePanelBadge>
  );
}

function CustomerSearchInput({
  value,
  onValueChange,
  className,
  placeholder = "동물명, 보호자명, 전화번호, 환자코드 검색",
}: {
  className?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative w-[320px] max-w-full min-w-0", className)}>
      <CdsActionsSearchIcon
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label="고객관리 검색"
        placeholder={placeholder}
        value={value}
        className={cn("h-9 pl-8", value ? "pr-8" : "pr-3")}
        onValueChange={onValueChange}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="고객관리 검색어 초기화"
          onClick={() => onValueChange("")}
        >
          <CircleCloseFillIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function CustomerToolbar({
  loading,
  listMode,
  patientCount,
  guardianCount,
}: {
  guardianCount: number;
  listMode: CustomerListMode;
  loading: boolean;
  patientCount: number;
}) {
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const activeCount = listMode === "patient" ? patientCount : listMode === "guardian" ? guardianCount : 0;
  const activeLabel =
    listMode === "patient" ? "동물" : listMode === "guardian" ? "보호자" : "삭제된 보호자/동물";
  const countLoading = loading && listMode !== "deleted" && activeCount === 0;

  return (
    <div className="shrink-0 border-b bg-card px-4 py-3" data-testid="customer-page-header">
      <EmrPageHeader
        title={activeLabel}
        className="h-auto flex-wrap gap-y-3"
        actionsClassName="ml-auto flex-wrap justify-end"
        icon={
          <UsersIcon
            className="size-5 shrink-0 text-[var(--emr-text-tertiary)]"
            aria-hidden="true"
          />
        }
        badge={
          <Badge variant="secondary" className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground">
            {countLoading ? (
              <Skeleton
                aria-label={`${activeLabel} 수 불러오는 중`}
                className="h-3 w-5 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]"
                data-testid="customer-page-header-count-skeleton"
              />
            ) : (
              activeCount
            )}
          </Badge>
        }
        actions={
          <NewUnifiedRegistrationButton onPatientReady={(patientId) => setActiveDrawer({ type: "patient", id: patientId })} />
        }
      />
      <span className="sr-only">
        {countLoading
          ? `${activeLabel} 정보를 불러오는 중`
          : `${activeLabel} ${activeCount}`}
      </span>
    </div>
  );
}

function DeletedCustomerContent() {
  const query = useCustomerStore((state) => state.query);
  const setQuery = useCustomerStore((state) => state.setQuery);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="emr-text-body font-semibold">
            {query ? "표시 삭제 항목" : "전체 삭제 항목"}
          </span>
          <Badge variant="secondary">0건</Badge>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <CustomerSearchInput
            value={query}
            onValueChange={setQuery}
            className="w-[260px] sm:w-[300px]"
            placeholder="삭제 항목 검색"
          />
        </div>
      </div>
      <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center border-b bg-card text-center">
        <EmrEmptyState
          kind={query.trim() ? "no-filter-results" : "no-data"}
          priority={query.trim() ? "local-recovery" : "supporting"}
          surface="table"
          size="md"
          testId="customer-deleted-empty-state"
          title={query.trim() ? "조건에 맞는 삭제 항목이 없습니다" : "삭제된 보호자/동물이 없습니다"}
          description={query.trim() ? "검색어를 바꾸면 삭제 이력이 다시 보입니다." : "삭제 이력이 없습니다."}
        />
      </div>
    </div>
  );
}

function PatientTable({
  loading,
  readStatus,
  rows,
}: {
  loading: boolean;
  readStatus: CustomerTableReadStatus;
  rows: CustomerPatientRow[];
}) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const columns = useMemo(() => createCustomerPatientColumns(), []);

  return (
    <CustomerDataTable
      columns={columns}
      emptyLabel="동물 정보가 없습니다."
      getRowLabel={(row) => row.name}
      isActiveRow={(row) =>
        activeDrawer?.id === row.id &&
        (activeDrawer.type === "patient" || activeDrawer.type === "reception-patient")
      }
      loading={loading}
      minTableWidth={customerTableMinWidths.patient}
      onOpenRow={(row) => setActiveDrawer({ type: "patient", id: row.id })}
      readStatus={readStatus}
      rowTestId={(row) => `customer-patient-row-${row.id}`}
      rows={rows}
      title="동물"
      testId="customer-patient-table"
    />
  );
}

function GuardianTable({
  loading,
  readStatus,
  rows,
}: {
  loading: boolean;
  readStatus: CustomerTableReadStatus;
  rows: CustomerGuardianRow[];
}) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const columns = useMemo(() => createCustomerGuardianColumns(), []);

  return (
    <CustomerDataTable
      columns={columns}
      emptyLabel="보호자 정보가 없습니다."
      getRowLabel={(row) => row.name}
      isActiveRow={(row) =>
        activeDrawer?.id === row.id &&
        (activeDrawer.type === "guardian" || activeDrawer.type === "reception-guardian")
      }
      loading={loading}
      minTableWidth={customerTableMinWidths.guardian}
      onOpenRow={(row) => setActiveDrawer({ type: "guardian", id: row.id })}
      readStatus={readStatus}
      rowTestId={(row) => `customer-guardian-row-${row.id}`}
      rows={rows}
      title="보호자"
      testId="customer-guardian-table"
    />
  );
}

export function CustomerContent() {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getCustomerWorkspaceId(params.workspaceId);
  const listMode = useCustomerStore((state) => state.listMode);
  const profileReadState = useCustomerStore((state) => state.profileReadState);
  const setProfileReadState = useCustomerStore((state) => state.setProfileReadState);
  const authSession = useMockAuthStore((state) => state.session);
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const patients = usePatientProfileStore((state) => state.patients);

  useLayoutEffect(() => {
    if (!isPreparedEmptyClinicWorkspace(workspaceId)) return;

    setProfileReadState({ status: "loading", workspaceId });
  }, [setProfileReadState, workspaceId]);

  useEffect(() => {
    if (!isPreparedEmptyClinicWorkspace(workspaceId)) {
      setProfileReadState({ status: "ready", workspaceId });
      return;
    }

    let cancelled = false;
    setProfileReadState({ status: "loading", workspaceId });

    async function loadSeededCustomerProfiles() {
      try {
        const headers = authSession?.id
          ? { "x-clair-demo-session-user-id": authSession.id }
          : undefined;
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-lookup?query=`,
          {
            cache: "no-store",
            headers,
          },
        );
        const result =
          (await response.json()) as ReceptionPatientGuardianLookupResponse;

        if (cancelled) return;
        if (!response.ok || !result.ok) {
          setProfileReadState({ status: "error", workspaceId });
          return;
        }

        result.patients.forEach((item) => applyPatientGuardianLookupItem(item));
        setProfileReadState({ status: "ready", workspaceId });
      } catch {
        if (!cancelled) {
          setProfileReadState({ status: "error", workspaceId });
        }
      }
    }

    void loadSeededCustomerProfiles();

    return () => {
      cancelled = true;
    };
  }, [applyPatientGuardianLookupItem, authSession?.id, setProfileReadState, workspaceId]);
  const patientRows = useMemo(
    () =>
      getCustomerPatientRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }),
    [guardians, patientGuardians, patients, workspaceId],
  );
  const guardianRows = useMemo(
    () =>
      getCustomerGuardianRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }),
    [guardians, patientGuardians, patients, workspaceId],
  );
  const customerProfileLoading = isCustomerProfileReadLoading({
    status: profileReadState.status,
    workspaceId,
    workspaceIdForState: profileReadState.workspaceId,
  });
  const tableReadStatus: CustomerTableReadStatus =
    profileReadState.workspaceId === workspaceId && profileReadState.status === "error"
      ? "error"
      : "ready";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]" data-testid="customer-workspace">
      {listMode === "patient" ? (
        <PatientTable
          loading={customerProfileLoading}
          readStatus={tableReadStatus}
          rows={patientRows}
        />
      ) : null}
      {listMode === "guardian" ? (
        <GuardianTable
          loading={customerProfileLoading}
          readStatus={tableReadStatus}
          rows={guardianRows}
        />
      ) : null}
      {listMode === "deleted" ? (
        <>
          <CustomerToolbar
            loading={customerProfileLoading}
            listMode={listMode}
            patientCount={patientRows.length}
            guardianCount={guardianRows.length}
          />
          <DeletedCustomerContent />
        </>
      ) : null}
    </div>
  );
}
