"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmrWorkEntryPage, EmrWorkEntrySection as Section } from "@/components/emr/work-entry-page";
import { PatientPreworkHeader, PatientPreworkMemoLoading, PatientPreworkVitalsLoading, MemoSection, VitalSection, type PatientPreworkContext } from "@/features/chart/preconsultation-context-panel";
import { useCustomerProfileOverview } from "@/features/customer/use-customer-profile-overview";
import { useWorkspaceVitalSettings } from "@/features/patient-vitals/use-workspace-vital-settings";
import type { PatientVitalMeasurement } from "@/features/patient-vitals/patient-vital-types";
import { usePatientFulfillmentHistory, PatientHistoryLoading, getPatientHistoryStatus, getFulfillmentOrderDisplayName } from "@/features/fulfillment/patient-history-aside";
import type { FulfillmentWorkItem } from "@/features/fulfillment/server-fulfillment-work-item-core";
import { useLayoutStore } from "@/stores/layout-store";

export type PatientOrderPreworkItem = Pick<FulfillmentWorkItem, "id" | "workspaceId" | "encounterId" | "patientId" | "patientName" | "guardianName" | "requesterName"> & { queueType?: FulfillmentWorkItem["queueType"]; createdAt?: string; sourceSnapshot?: Record<string, unknown> };
function field(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}
function date(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function PatientOrderPrework({ workItem, label, actions, children, encounterNo, historyContent, excludeWorkItemIds = [], testId }: {
  workItem: PatientOrderPreworkItem;
  label: string;
  actions: ReactNode;
  children: ReactNode;
  excludeWorkItemIds?: readonly string[];
  testId?: string;
  encounterNo?: string | null;
  historyContent?: ReactNode;
}) {
  const workspaceId = workItem.workspaceId;
  const patient = useCustomerProfileOverview({
    enabled: Boolean(workItem.patientId),
    subjectId: workItem.patientId ?? "",
    subjectType: "patient",
    workspaceId,
  });
  const profile =
    patient.overviewStatus === "ready" ? patient.overview?.profile : undefined;
  const relationships =
    patient.overviewStatus === "ready"
      ? patient.overview?.relationships.guardians
      : undefined;
  const guardianRow = Array.isArray(relationships)
    ? (relationships.find(
        (row) =>
          row.isPrimary &&
          (!row.workspaceId || row.workspaceId === workspaceId),
      ) as Record<string, unknown> | undefined)
    : undefined;
  const guardianId = field(guardianRow, "id");
  const guardian = useCustomerProfileOverview({
    enabled: Boolean(guardianId),
    subjectId: guardianId ?? "",
    subjectType: "guardian",
    workspaceId,
  });
  const guardianProfile =
    guardian.overviewStatus === "ready"
      ? guardian.overview?.profile
      : undefined;
  const setDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const settings = useWorkspaceVitalSettings({ workspaceId });
  const [vitals, setVitals] = useState<{
    key: string;
    status: "ready" | "error" | "denied";
    values: PatientVitalMeasurement[];
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const vitalKey = `${workspaceId}:${workItem.encounterId}:${refresh}`;
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      const values: PatientVitalMeasurement[] = [];
      const cursors = new Set<string>();
      let cursor: string | null = null;
      try {
        do {
          const query = new URLSearchParams({
            encounterId: workItem.encounterId,
          });
          if (cursor) query.set("beforeId", cursor);
          const response = await fetch(
            `/api/workspaces/${encodeURIComponent(workspaceId)}/patient-vitals/history?${query}`,
            { cache: "no-store", signal: abort.signal },
          );
          const body = await response.json();
          if (abort.signal.aborted) return;
          if (!response.ok || !body.ok || !Array.isArray(body.measurements)) {
            setVitals({
              key: vitalKey,
              status: [401, 403].includes(response.status) ? "denied" : "error",
              values: [],
            });
            return;
          }
          values.push(...body.measurements);
          cursor = typeof body.nextCursor === "string" ? body.nextCursor : null;
          if (
            values.some((value) => value.encounterId !== workItem.encounterId)
          )
            break;
          if (cursor && cursors.has(cursor))
            throw new Error("Repeated vital cursor");
          if (cursor) cursors.add(cursor);
        } while (cursor);
        setVitals({ key: vitalKey, status: "ready", values });
      } catch {
        if (!abort.signal.aborted)
          setVitals({ key: vitalKey, status: "error", values: [] });
      }
    })();
    return () => abort.abort();
  }, [workspaceId, workItem.encounterId, vitalKey]);
  const history = usePatientFulfillmentHistory(
    workspaceId,
    workItem.queueType ? workItem.patientId ?? undefined : undefined,
    workItem.queueType ? [workItem.queueType] : [],
  );
  const [expanded, setExpanded] = useState(false);
  const unavailable =
    patient.overviewStatus === "denied"
      ? "환자 정보 조회 권한 없음"
      : ["error", "not_found", "idle"].includes(patient.overviewStatus)
        ? "환자 정보 확인 불가"
        : "환자 정보 불러오는 중";
  const context: PatientPreworkContext = {
    encounter: {
      id: workItem.encounterId,
      encounterNo:
        encounterNo ??
        field(workItem.sourceSnapshot, "encounterNo") ??
        "—",
      checkedInAt: workItem.createdAt ?? "",
    },
    patient: {
      id: workItem.patientId ?? "",
      patientNo: field(profile, "patientNo") ?? "",
      name: field(profile, "name") ?? workItem.patientName ?? unavailable,
      species: field(profile, "species") ?? "—",
      breed: field(profile, "breed"),
      sex: field(profile, "sex") ?? "unknown",
      neutered:
        typeof profile?.neutered === "boolean" ? profile.neutered : undefined,
      birthDate: field(profile, "birthDate"),
      estimatedAgeText: field(profile, "estimatedAgeText"),
      handlingCautionNote: field(profile, "handlingCautionNote"),
      allergyNote: field(profile, "allergyNote"),
      specialNote: field(profile, "specialNote"),
    },
    guardian: guardianId || workItem.guardianName
      ? {
          id: guardianId ?? "",
          name: field(guardianRow, "name") ?? workItem.guardianName ?? "—",
          memo:
            !guardianId ? "보호자 메모를 확인할 수 없어요." : field(guardianProfile, "memo") ??
            (guardian.overviewStatus === "ready"
              ? undefined
              : guardian.overviewStatus === "denied"
                ? "보호자 메모 조회 권한 없음"
                : "보호자 메모를 불러오지 못했어요."),
        }
      : undefined,
  };
  const historyItems = history.workItems
    .filter(
      (item) =>
        !excludeWorkItemIds.includes(item.id) && item.id !== workItem.id &&
        Boolean(workItem.createdAt && item.createdAt < workItem.createdAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const currentVitals = vitals?.key === vitalKey ? vitals : null;
  return <EmrWorkEntryPage testId={testId} header={<PatientPreworkHeader
          loadingDetails={patient.overviewStatus === "loading" || patient.overviewStatus === "idle"}
          context={context}
          statusLabel={`${label} 대기`}
          onOpenPatientInformation={
            profile && workItem.patientId
              ? () => setDrawer({ type: "patient", id: workItem.patientId! })
              : undefined
          }
          onOpenGuardianInformation={
            guardianId
              ? () => setDrawer({ type: "guardian", id: guardianId })
              : undefined
          }
          actions={actions}
        />}>
{children}
<Separator />
          {patient.overviewStatus === "loading" || patient.overviewStatus === "idle" ? <PatientPreworkMemoLoading /> : <MemoSection
            guardianLoading={guardian.overviewStatus === "loading"}
            context={context}
            patientMemo={
              [
                field(profile, "handlingCautionNote"),
                field(profile, "allergyNote"),
                field(profile, "specialNote"),
              ]
                .filter(Boolean)
                .join(" · ") || (profile ? undefined : unavailable)
            }
          />}
          {patient.overviewStatus === "error" && (
            <Button variant="outline" onClick={patient.reloadOverview}>
              환자 정보 다시 조회
            </Button>
          )}
          {guardian.overviewStatus === "error" && (
            <Button variant="outline" onClick={guardian.reloadOverview}>
              보호자 메모 다시 조회
            </Button>
          )}
          <Separator />
          {currentVitals?.status === "ready" && settings.status === "ready" ? (
            <VitalSection
              context={{
                encounter: { id: workItem.encounterId },
                vitals: currentVitals.values,
              }}
              canWrite={false}
              onOpenVitalDialog={() => {}}
              vitalSettings={settings.snapshot}
            />
          ) : (!currentVitals || settings.status === "loading") && currentVitals?.status !== "error" && currentVitals?.status !== "denied" && settings.status !== "error" && settings.status !== "denied" ? <PatientPreworkVitalsLoading /> : (
            <Section title="바이탈 정보">
              <p className="text-sm text-muted-foreground">
                {currentVitals?.status === "denied" ||
                settings.status === "denied"
                  ? "바이탈 조회 권한이 없어요."
                  : currentVitals?.status === "error" ||
                      settings.status === "error"
                    ? "바이탈 정보를 불러오지 못했어요."
                    : "바이탈 정보를 불러오는 중이에요."}
              </p>
              {(currentVitals?.status === "error" ||
                settings.status === "error") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setRefresh((value) => value + 1);
                    void settings.reload();
                  }}
                >
                  바이탈 다시 조회
                </Button>
              )}
            </Section>
          )}
          <Separator />
          {historyContent ?? <Section title={`과거 ${label} 이력`}>
            {history.refreshing && <p role="status" className="text-sm text-muted-foreground">이력을 갱신하는 중입니다.</p>}
            {history.readError && <p role="alert" className="text-sm text-destructive">이력을 갱신하지 못했습니다.</p>}
            {history.status === "loading" ? <PatientHistoryLoading /> : history.status !== "ready" ? (
              <p className="text-sm text-muted-foreground">
                {history.status === "permission_denied"
                    ? "이력 조회 권한이 없어요."
                    : "이력을 불러오지 못했어요."}
              </p>
            ) : historyItems.length ? (
              <Fragment>
                {historyItems.slice(0, expanded ? undefined : 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4 text-sm"
                  >
                    <time>{date(item.createdAt)}</time>
                    <strong className="min-w-0 flex-1 break-words">
                      {getFulfillmentOrderDisplayName(item.sourceSnapshot) ??
                        "오더"}
                    </strong>
                    <span>{getPatientHistoryStatus(item.status)}</span>
                    <span>
                      {item.assignedToDisplayName ??
                        (item.assignedToUserId
                          ? history.assigneeNames[item.assignedToUserId]
                          : null) ??
                        "미지정"}
                    </span>
                  </div>
                ))}
                {historyItems.length > 3 && (
                  <Button
                    variant="ghost"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? "접기" : "더 보기"}
                  </Button>
                )}
              </Fragment>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                이전 {label} 이력이 없어요.
              </p>
            )}
            {(history.status === "error" || history.readError) && (
              <Button variant="outline" onClick={history.refresh}>
                이력 다시 조회
              </Button>
            )}
          </Section>}

</EmrWorkEntryPage>;
}
