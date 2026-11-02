"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  PatientPreworkHeader,
  MemoSection,
  VitalSection,
  type PatientPreworkContext,
} from "@/features/chart/preconsultation-context-panel";
import { useCustomerProfileOverview } from "@/features/customer/use-customer-profile-overview";
import { useWorkspaceVitalSettings } from "@/features/patient-vitals/use-workspace-vital-settings";
import type { PatientVitalMeasurement } from "@/features/patient-vitals/patient-vital-types";
import {
  usePatientFulfillmentHistory,
  getPatientHistoryStatus,
  getFulfillmentOrderDisplayName,
} from "@/features/fulfillment/patient-history-aside";
import type { FulfillmentWorkItem } from "@/features/fulfillment/server-fulfillment-work-item-core";
import { TaskInstructionReview } from "@/features/fulfillment/components/task-instruction-review";
import { useLayoutStore } from "@/stores/layout-store";
import {
  createInstructionView,
  formatInstructionValue,
} from "../instruction-view-model";
import type { FulfillmentInstructionController } from "../use-fulfillment-instruction";
import { InstructionActions } from "./instruction-workspace";

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
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="text-base font-semibold text-[var(--emr-text-secondary)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DispensingPreworkContext({
  controller,
  workItem,
  onChanged,
  onEntered,
  onCompletionOpenChange,
}: {
  controller: FulfillmentInstructionController;
  workItem: Pick<
    FulfillmentWorkItem,
    | "id"
    | "workspaceId"
    | "encounterId"
    | "patientId"
    | "patientName"
    | "guardianName"
    | "requesterName"
    | "queueType"
  > & { createdAt?: string; sourceSnapshot?: Record<string, unknown> };
  onChanged: () => void;
  onEntered: () => void;
  onCompletionOpenChange?: (open: boolean) => void;
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
    workItem.patientId ?? undefined,
    [workItem.queueType],
  );
  const [expanded, setExpanded] = useState(false);
  const document = controller.document;
  if (!document) return null;
  const label = document.queueType === "dispensing" ? "조제" : "처치";
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
        document.encounterNo ??
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
    guardian: guardianId
      ? {
          id: guardianId,
          name: field(guardianRow, "name") ?? workItem.guardianName ?? "—",
          memo:
            field(guardianProfile, "memo") ??
            (guardian.overviewStatus === "ready"
              ? undefined
              : guardian.overviewStatus === "denied"
                ? "보호자 메모 조회 권한 없음"
                : "보호자 메모를 불러오지 못했어요."),
        }
      : undefined,
  };
  const items = createInstructionView(document).orders[0].items;
  const historyItems = history.workItems
    .filter(
      (item) =>
        !document.items.some((current) => current.id === item.id) &&
        Boolean(workItem.createdAt && item.createdAt < workItem.createdAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const currentVitals = vitals?.key === vitalKey ? vitals : null;
  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportClassName="px-4"
      viewportStyle={{ overflowX: "hidden" }}
      data-testid="fulfillment-prework"
    >
      <div className="mx-auto w-full max-w-[1024px] bg-[var(--emr-surface-panel)]">
        <PatientPreworkHeader
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
          actions={
            <InstructionActions
              prework
              controller={controller}
              workspaceId={workspaceId}
              onChanged={onChanged}
              onEntered={onEntered}
              onCompletionOpenChange={onCompletionOpenChange}
            />
          }
        />
        <Separator className="mx-6 !w-auto" />
        <main className="flex min-w-0 flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
          {controller.error && (
            <div
              role="alert"
              className="flex items-center gap-3 text-sm text-destructive"
            >
              {controller.error}
              <Button size="sm" variant="outline" onClick={controller.refresh}>
                다시 조회
              </Button>
            </div>
          )}
          {controller.instructionReview && (
            <TaskInstructionReview controller={controller.instructionReview} />
          )}
          <Section title="요청 정보">
            <dl className="grid grid-cols-2 rounded-xl border border-border sm:grid-cols-5">
              {[
                ["요청 일시", date(workItem.createdAt)],
                ["요청 수의사", workItem.requesterName ?? "—"],
                ["요청 항목", `${label} ${items.length}개`],
                [`${label} 담당`, document.mainAssigneeName ?? "미지정"],
                [`${label} 시작`, "미시작"],
              ].map(([key, value]) => (
                <div key={key} className="min-w-0 px-4 py-4">
                  <dt className="mb-2 text-xs text-muted-foreground">{key}</dt>
                  <dd className="break-words text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
          <Separator />
          <Section title={`요청된 ${label} 오더 · ${items.length}`}>
            <div
              className="overflow-x-auto rounded-lg border border-border"
              tabIndex={0}
              role="region"
              aria-label={`요청된 ${label} 오더`}
            >
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    {(document.queueType === "dispensing"
                      ? [
                          "오더명",
                          "1회 용량",
                          "단위",
                          "복용 주기",
                          "총량",
                          "단위",
                          "투여 경로",
                          "보관 방법",
                          "담당자",
                        ]
                      : ["오더명", "처치 지시", "담당자"]
                    ).map((name, index) => (
                      <th
                        scope="col"
                        className="whitespace-nowrap px-3 py-3 font-medium"
                        key={`${name}-${index}`}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                {items.map((item) => (
                  <tbody
                    key={item.id}
                    aria-label={item.name}
                    className="border-t border-border"
                  >
                    <tr>
                      <th
                        scope="row"
                        className="min-w-36 px-3 py-4 font-medium"
                      >
                        {item.name}
                      </th>
                      {(document.queueType === "dispensing"
                        ? [
                            item.dose,
                            item.doseUnit,
                            item.frequency,
                            item.total,
                            item.totalUnit,
                            formatInstructionValue("route", item.route),
                            formatInstructionValue("storage", item.storage),
                          ]
                        : [item.note || "—"]
                      ).map((value, index) => (
                        <td
                          className="px-3 py-4 whitespace-pre-wrap"
                          key={index}
                        >
                          {value}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-4">
                        {document.items.find((row) => row.id === item.id)
                          ?.assigneeName ?? "미지정"}
                      </td>
                    </tr>
                    {document.queueType === "dispensing" && item.note && (
                      <tr>
                        <td colSpan={9} className="bg-muted/20 px-3 pb-3">
                          <div className="flex gap-3 whitespace-pre-wrap text-sm">
                            <span className="shrink-0 text-muted-foreground">
                              조제 지시
                            </span>
                            <span>{item.note}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </div>
            {!items.length && (
              <p className="text-sm text-muted-foreground">
                요청된 오더가 없어요.
              </p>
            )}
          </Section>
          {document.isSet && document.instruction.trim() && (
            <Section title={`${label} 공통 지시`}>
              <p className="rounded-lg border border-border bg-muted/30 px-5 py-4 whitespace-pre-wrap text-sm">
                {document.instruction}
              </p>
            </Section>
          )}
          <Separator />
          <MemoSection
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
          />
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
          ) : (
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
          <Section title={`과거 ${label} 이력`}>
            {history.status !== "ready" ? (
              <p className="text-sm text-muted-foreground">
                {history.status === "loading"
                  ? "이력을 불러오는 중이에요."
                  : history.status === "permission_denied"
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
            {history.status === "error" && (
              <Button variant="outline" onClick={history.refresh}>
                이력 다시 조회
              </Button>
            )}
          </Section>
        </main>
      </div>
    </ScrollArea>
  );
}
