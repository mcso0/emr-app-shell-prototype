"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { useLayoutStore } from "@/stores/layout-store";
import { useCustomerProfileOverview, type CustomerProfileOverviewState } from "@/features/customer/use-customer-profile-overview";
import { ChartProfilePreviewCard } from "@/features/chart/components/chart-profile-preview-card";
import { getPatientDisplayAge, getPatientSexLabel, getSpeciesLabel } from "@/features/reception/data";
import type { ChartPreconsultationContextResponse } from "@/features/chart/preconsultation-context";
import type { ContextBarProfileInteraction, EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import type { Encounter, Guardian, Patient } from "@/types/emr-domain";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ReadStatus = CustomerProfileOverviewState["overviewStatus"];
type ContextBarContent = Pick<ComponentProps<typeof EmrPatientContextBar>, "patientItems" | "guardianItems" | "memoActions">;
type EncounterMemo = Pick<Encounter, "visitPurpose" | "chiefComplaint">;

function textField(value: Record<string, unknown> | undefined, key: string) {
  const field = value?.[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function unavailableText(status: ReadStatus, subject: string) {
  if (status === "loading") return `${subject} 불러오는 중`;
  if (status === "denied") return `${subject} 조회 권한 없음`;
  if (status === "error") return `${subject} 불러오기 실패`;
  if (status === "not_found") return `${subject} 조회 대상 없음`;
  return `${subject} 확인 불가`;
}

function useEncounterMemo({
  encounterId,
  patientId,
  workspaceId,
}: {
  encounterId?: string;
  patientId?: string;
  workspaceId: string;
}): { encounter?: EncounterMemo; status: ReadStatus } {
  const enabled = Boolean(encounterId && patientId);
  const scopeKey = JSON.stringify([workspaceId, encounterId, patientId]);
  const [state, setState] = useState<{ encounter?: EncounterMemo; scopeKey: string; status: ReadStatus }>({ scopeKey: "", status: "idle" });

  useEffect(() => {
    if (!enabled || !encounterId || !patientId) return;
    const controller = new AbortController();
    const kickoff = window.setTimeout(() => {
      setState({ scopeKey, status: "loading" });
      void fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/preconsultation-context?encounterId=${encodeURIComponent(encounterId)}`,
        { cache: "no-store", signal: controller.signal },
      ).then(async (response) => {
        const payload = await response.json().catch(() => null) as ChartPreconsultationContextResponse | null;
        if (controller.signal.aborted) return;
        if (!response.ok || !payload?.ok) {
          setState({ scopeKey, status: response.status === 401 || response.status === 403 ? "denied" : response.status === 404 ? "not_found" : "error" });
          return;
        }
        if (payload.context?.encounter.id !== encounterId || payload.context.patient.id !== patientId) {
          setState({ scopeKey, status: "error" });
          return;
        }
        setState({ scopeKey, status: "ready", encounter: payload.context.encounter });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ scopeKey, status: "error" });
      });
    }, 0);
    return () => {
      window.clearTimeout(kickoff);
      controller.abort();
    };
  }, [enabled, encounterId, patientId, scopeKey, workspaceId]);

  if (!enabled) return { status: "idle" };
  return state.scopeKey === scopeKey ? state : { status: "loading" };
}

export function usePatientContextProfileInteractions({
  allowLocalProfiles = false,
  encounter,
  encounterId,
  guardian,
  includeMemoSummaries = false,
  patient,
  patientId,
  workspaceId,
}: {
  allowLocalProfiles?: boolean;
  encounter?: Encounter;
  encounterId?: string | null;
  guardian?: Guardian;
  includeMemoSummaries?: boolean;
  patient?: Patient;
  patientId?: string | null;
  workspaceId: string;
}): ContextBarContent & {
  guardianInteraction?: ContextBarProfileInteraction;
  patientInteraction?: ContextBarProfileInteraction;
} {
  const resolvedPatientId = patientId ?? patient?.id;
  const livePatientId = resolvedPatientId && uuidPattern.test(resolvedPatientId)
    ? resolvedPatientId
    : undefined;
  const { overview, overviewStatus } = useCustomerProfileOverview({
    enabled: Boolean(livePatientId),
    subjectId: livePatientId ?? "",
    subjectType: "patient",
    workspaceId,
  });
  const currentOverview = overviewStatus === "ready" && overview?.subjectId === livePatientId
    ? overview
    : null;
  const liveProfile = currentOverview?.profile;
  const guardianRows = Array.isArray(currentOverview?.relationships.guardians)
    ? currentOverview.relationships.guardians as Array<Record<string, unknown>>
    : [];
  const primaryGuardian = guardianRows.find((row) => row.isPrimary === true && (row.workspaceId === undefined || row.workspaceId === workspaceId));
  const liveGuardianId = textField(primaryGuardian, "id");
  const guardianOverview = useCustomerProfileOverview({
    enabled: includeMemoSummaries && Boolean(liveGuardianId && uuidPattern.test(liveGuardianId)),
    subjectId: liveGuardianId ?? "",
    subjectType: "guardian",
    workspaceId,
  });
  const liveGuardianProfile = guardianOverview.overviewStatus === "ready"
    ? guardianOverview.overview?.profile
    : undefined;
  const liveEncounterId = includeMemoSummaries && encounterId && uuidPattern.test(encounterId)
    ? encounterId
    : undefined;
  const encounterMemo = useEncounterMemo({
    encounterId: liveEncounterId,
    patientId: livePatientId,
    workspaceId,
  });
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const localProfileAvailable = allowLocalProfiles && Boolean(patient) && patient?.workspaceId === workspaceId && patient.id === resolvedPatientId && !livePatientId;
  const localGuardian = localProfileAvailable && guardian?.workspaceId === workspaceId ? guardian : undefined;
  const localEncounter = localProfileAvailable && encounter?.workspaceId === workspaceId && encounter.patientId === resolvedPatientId ? encounter : undefined;
  const patientProfileId = currentOverview ? livePatientId : localProfileAvailable ? patient?.id : undefined;
  const guardianProfileId = currentOverview ? liveGuardianId : localGuardian?.id;
  const patientProfile = liveProfile ?? (localProfileAvailable ? patient as unknown as Record<string, unknown> : undefined);
  const guardianProfile = liveGuardianProfile ?? primaryGuardian ?? (localGuardian as unknown as Record<string, unknown> | undefined);
  const profileStatus = localProfileAvailable ? "ready" : overviewStatus;
  const patientName = textField(patientProfile, "name") ?? unavailableText(profileStatus, "환자 정보");
  const guardianName = textField(guardianProfile, "name") ?? (profileStatus === "ready" ? "보호자 미지정" : unavailableText(profileStatus, "보호자 정보"));
  const patientNotes = ["allergyNote", "handlingCautionNote", "specialNote"].flatMap((key) => {
    const note = textField(patientProfile, key);
    return note ? [note] : [];
  });
  const patientAge = patientProfile && (textField(patientProfile, "estimatedAgeText") || textField(patientProfile, "birthDate"))
    ? getPatientDisplayAge(patientProfile as unknown as Patient)
    : profileStatus === "ready" ? "나이 미입력" : unavailableText(profileStatus, "환자 정보");
  const patientSex = patientProfile && ["male", "female", "unknown"].includes(String(patientProfile.sex))
    ? getPatientSexLabel(patientProfile as unknown as Patient)
    : profileStatus === "ready" ? "성별 미입력" : unavailableText(profileStatus, "환자 정보");
  const patientBreed = textField(patientProfile, "breed") ?? (textField(patientProfile, "species")
    ? getSpeciesLabel(patientProfile as unknown as Patient)
    : profileStatus === "ready" ? "품종 미입력" : unavailableText(profileStatus, "환자 정보"));
  const currentEncounter = livePatientId ? encounterMemo.encounter : localEncounter;
  const encounterStatus = localEncounter ? "ready" : encounterMemo.status;
  const guardianMemoStatus = localGuardian ? "ready" : guardianOverview.overviewStatus;
  const guardianMemoProfile = liveGuardianProfile ?? (localGuardian as unknown as Record<string, unknown> | undefined);

  const openProfile = (type: "patient" | "guardian", id: string) => {
    if (localProfileAvailable && patient) {
      applyPatientGuardianLookupItem({ patient, primaryGuardian: localGuardian });
    }
    setActiveDrawer({ type, id });
  };

  return {
    patientItems: profileStatus !== "ready" ? [
      { label: "환자", value: unavailableText(profileStatus, "환자 정보") },
    ] : [
      { label: "환자", value: patientName },
      { label: "품종", value: patientBreed },
      { label: "성별", value: patientSex },
      { label: "나이", value: patientAge },
    ],
    guardianItems: profileStatus !== "ready" ? [
      { label: "보호자", value: unavailableText(profileStatus, "보호자 정보") },
    ] : [
      { label: "보호자", value: `${guardianName}${guardianProfileId ? "(주보호자)" : ""}` },
      { label: "연락처", value: textField(guardianProfile, "mobilePhone") ?? textField(guardianProfile, "phone") ?? (profileStatus === "ready" ? "연락처 미입력" : unavailableText(profileStatus, "보호자 정보")) },
    ],
    memoActions: [
      {
        label: "방문목적",
        disabled: encounterStatus !== "ready",
        summary: currentEncounter?.visitPurpose?.trim() || currentEncounter?.chiefComplaint?.trim() || (encounterStatus === "ready" ? "방문 목적 기록 없음" : unavailableText(encounterStatus, "방문 목적")),
        unavailableReason: encounterStatus !== "ready" ? unavailableText(encounterStatus, "방문 목적") : undefined,
      },
      {
        label: "보호자메모",
        disabled: guardianMemoStatus !== "ready",
        summary: textField(guardianMemoProfile, "memo") ?? (guardianMemoStatus === "ready" ? "보호자 메모 없음" : profileStatus === "ready" && !guardianProfileId ? "보호자 미지정" : unavailableText(liveGuardianId || localGuardian ? guardianMemoStatus : profileStatus, "보호자 메모")),
        unavailableReason: guardianMemoStatus !== "ready"
          ? profileStatus === "ready" && !guardianProfileId ? "주보호자가 지정되지 않았습니다." : unavailableText(liveGuardianId ? guardianMemoStatus : profileStatus, "보호자 메모")
          : undefined,
      },
      {
        label: "환자메모",
        disabled: profileStatus !== "ready",
        summary: patientNotes.join(" · ") || (profileStatus === "ready" ? "환자 특이 메모 없음" : unavailableText(profileStatus, "환자 메모")),
        unavailableReason: profileStatus !== "ready" ? unavailableText(profileStatus, "환자 메모") : undefined,
      },
      {
        label: "수납메모",
        disabled: true,
        unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
      },
    ],
    patientInteraction: patientProfileId
      ? {
          ariaLabel: `${patientName} 환자 프로필 열기`,
          onActivate: () => openProfile("patient", patientProfileId),
          preview: (
            <ChartProfilePreviewCard
              onOpenProfile={() => openProfile("patient", patientProfileId)}
              kind="patient"
              title={patientName}
              items={[
                { label: "품종", value: patientBreed },
                { label: "나이", value: patientAge },
                { label: "성별", value: patientSex },
              ]}
              notes={patientNotes}
            />
          ),
        }
      : undefined,
    guardianInteraction: guardianProfileId
      ? {
          ariaLabel: `${guardianName} 보호자 프로필 열기`,
          onActivate: () => openProfile("guardian", guardianProfileId),
          preview: (
            <ChartProfilePreviewCard
              onOpenProfile={() => openProfile("guardian", guardianProfileId)}
              kind="guardian"
              title={guardianName}
              items={[
                { label: "대표 연락처", value: textField(guardianProfile, "mobilePhone") ?? textField(guardianProfile, "phone") },
                { label: "이메일", value: textField(guardianProfile, "email") },
                { label: "환자 관계", value: `${patientName}의 주보호자` },
              ]}
            />
          ),
        }
      : undefined,
  };
}
