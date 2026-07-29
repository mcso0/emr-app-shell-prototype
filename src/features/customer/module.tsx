"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  EmrModuleListSidePanel,
  EmrModuleListSidePanelBadge,
  type EmrModuleListSidePanelItem,
} from "@/components/emr/module-list-side-panel";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import {
  CalendarCheckIcon,
  ContactBookIcon,
  DocumentIcon,
  MessagesIcon,
  SendIcon,
  UserCrossIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
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
import { CustomerArchiveTable } from "@/features/customer/components/customer-archive-table";
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
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import type { ReceptionPatientGuardianLookupResponse } from "@/features/reception/patient-guardian-lookup";
import {
  isPreparedEmptyClinicWorkspace,
  resolveWorkspaceRouteParam,
} from "@/lib/emr-domain/demo-workspaces";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

const customerSideItems = [
  { value: "patient" as const, label: "동물", icon: UserIcon },
  { value: "guardian" as const, label: "보호자", icon: UsersIcon },
  {
    value: "deleted" as const,
    label: "삭제된 보호자/동물",
    icon: UserCrossIcon,
  },
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
  patient: 1480,
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
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const patients = usePatientProfileStore((state) => state.patients);
  const profileReadState = useCustomerStore((state) => state.profileReadState);
  const archiveCount = useCustomerStore((state) => state.archiveCount);
  const archiveCountLoading = useCustomerStore(
    (state) => state.archiveCountLoading,
  );
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["master"]),
  );
  const patientCount = useMemo(
    () =>
      getCustomerPatientRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }).length,
    [guardians, patientGuardians, patients, workspaceId],
  );
  const guardianCount = useMemo(
    () =>
      getCustomerGuardianRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }).length,
    [guardians, patientGuardians, patients, workspaceId],
  );
  const customerCounts: Record<CustomerListMode, number> = {
    deleted: archiveCount,
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
              loading={
                item.value === "deleted"
                  ? archiveCountLoading
                  : profileReadLoading && customerCounts[item.value] === 0
              }
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
        count: (
          <EmrModuleListSidePanelBadge variant="outline">
            후속
          </EmrModuleListSidePanelBadge>
        ),
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

function PatientTable({
  loading,
  onRetry,
  readStatus,
  rows,
}: {
  loading: boolean;
  onRetry: () => void;
  readStatus: CustomerTableReadStatus;
  rows: CustomerPatientRow[];
}) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const columns = useMemo(() => createCustomerPatientColumns(), []);

  return (
    <CustomerDataTable
      columns={columns}
      emptyActionLabel="신규 동물"
      emptyLabel="동물 정보가 없습니다."
      getRowLabel={(row) => row.name}
      isActiveRow={(row) =>
        activeDrawer?.id === row.id &&
        (activeDrawer.type === "patient" ||
          activeDrawer.type === "reception-patient")
      }
      loading={loading}
      minTableWidth={customerTableMinWidths.patient}
      onOpenRow={(row) => setActiveDrawer({ type: "patient", id: row.id })}
      onRetry={onRetry}
      pinnedIdentityColumnId="name"
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
  onRetry,
  readStatus,
  rows,
}: {
  loading: boolean;
  onRetry: () => void;
  readStatus: CustomerTableReadStatus;
  rows: CustomerGuardianRow[];
}) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const columns = useMemo(() => createCustomerGuardianColumns(), []);

  return (
    <CustomerDataTable
      columns={columns}
      emptyActionLabel="신규 보호자"
      emptyLabel="보호자 정보가 없습니다."
      getRowLabel={(row) => row.name}
      isActiveRow={(row) =>
        activeDrawer?.id === row.id &&
        (activeDrawer.type === "guardian" ||
          activeDrawer.type === "reception-guardian")
      }
      loading={loading}
      minTableWidth={customerTableMinWidths.guardian}
      onOpenRow={(row) => setActiveDrawer({ type: "guardian", id: row.id })}
      onRetry={onRetry}
      pinnedIdentityColumnId="name"
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
  const setProfileReadState = useCustomerStore(
    (state) => state.setProfileReadState,
  );
  const authSession = useMockAuthStore((state) => state.session);
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const patients = usePatientProfileStore((state) => state.patients);
  const [profileReadAttempt, setProfileReadAttempt] = useState(0);

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
          setProfileReadState({
            status:
              response.status === 401 || response.status === 403
                ? "denied"
                : "error",
            workspaceId,
          });
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
  }, [
    applyPatientGuardianLookupItem,
    authSession?.id,
    profileReadAttempt,
    setProfileReadState,
    workspaceId,
  ]);
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
    profileReadState.workspaceId === workspaceId &&
    (profileReadState.status === "denied" ||
      profileReadState.status === "error")
      ? profileReadState.status
      : "ready";
  const retryCustomerProfiles = () =>
    setProfileReadAttempt((current) => current + 1);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
      data-testid="customer-workspace"
    >
      <EmrMainContentHeader
        aria-hidden="true"
        heightMode="adaptive"
      />
      {listMode === "patient" ? (
        <PatientTable
          loading={customerProfileLoading}
          onRetry={retryCustomerProfiles}
          readStatus={tableReadStatus}
          rows={patientRows}
        />
      ) : null}
      {listMode === "guardian" ? (
        <GuardianTable
          loading={customerProfileLoading}
          onRetry={retryCustomerProfiles}
          readStatus={tableReadStatus}
          rows={guardianRows}
        />
      ) : null}
      {listMode === "deleted" ? (
        <CustomerArchiveTable workspaceId={workspaceId} />
      ) : null}
    </div>
  );
}
