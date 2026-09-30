"use client";

import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { useLayoutStore } from "@/stores/layout-store";
import { useCustomerProfileOverview } from "@/features/customer/use-customer-profile-overview";
import { ChartProfilePreviewCard } from "@/features/chart/components/chart-profile-preview-card";
import { getPatientDisplayAge, getPatientSexLabel } from "@/features/reception/data";
import type { ContextBarProfileInteraction } from "@/components/emr/patient-context-bar";
import type { Guardian, Patient } from "@/types/emr-domain";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textField(value: Record<string, unknown> | undefined, key: string) {
  const field = value?.[key];
  return typeof field === "string" && field.trim() ? field : undefined;
}

function patientStatusLabel(status: unknown) {
  if (status === "deceased") return "사망";
  if (status === "inactive") return "비활성";
  return "진료 가능";
}

export function usePatientContextProfileInteractions({
  allowLocalProfiles = false,
  guardian,
  patient,
  patientId,
  workspaceId,
}: {
  allowLocalProfiles?: boolean;
  guardian?: Guardian;
  patient?: Patient;
  patientId?: string | null;
  workspaceId: string;
}): {
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
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const currentOverview =
    overviewStatus === "ready" && overview?.subjectId === livePatientId
      ? overview
      : null;
  const liveProfile = currentOverview?.profile;
  const guardianRows = Array.isArray(currentOverview?.relationships.guardians)
    ? currentOverview.relationships.guardians as Array<Record<string, unknown>>
    : [];
  const primaryGuardian = guardianRows.find((row) => row.isPrimary === true);
  const liveGuardianId = textField(primaryGuardian, "id");
  const localProfileAvailable = allowLocalProfiles && Boolean(patient) && !livePatientId;
  const patientProfileId = currentOverview ? livePatientId :
    localProfileAvailable ? patient?.id : undefined;
  const guardianProfileId = currentOverview ? liveGuardianId :
    localProfileAvailable ? guardian?.id : undefined;
  const patientName = textField(liveProfile, "name") ?? patient?.name ?? "환자 미상";
  const guardianName = textField(primaryGuardian, "name") ?? guardian?.name ?? "보호자 미지정";

  const openProfile = (type: "patient" | "guardian", id: string) => {
    if (localProfileAvailable && patient) {
      applyPatientGuardianLookupItem({ patient, primaryGuardian: guardian });
    }
    setActiveDrawer({ type, id });
  };

  return {
    patientInteraction: patientProfileId
      ? {
          ariaLabel: `${patientName} 환자 프로필 열기`,
          onActivate: () => openProfile("patient", patientProfileId),
          preview: (
            <ChartProfilePreviewCard
              badge={patientStatusLabel(liveProfile?.status ?? patient?.status)}
              kind="patient"
              title={patientName}
              items={[
                { label: "환자번호", value: textField(liveProfile, "patientNo") ?? patient?.patientNo },
                { label: "품종", value: textField(liveProfile, "breed") ?? patient?.breed },
                { label: "나이", value: textField(liveProfile, "estimatedAgeText") ?? (patient ? getPatientDisplayAge(patient) : undefined) },
                { label: "성별", value: liveProfile
                  ? getPatientSexLabel({ sex: liveProfile.sex, neutered: liveProfile.neutered } as Patient)
                  : patient ? getPatientSexLabel(patient) : undefined },
              ]}
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
              badge="주보호자"
              kind="guardian"
              title={guardianName}
              items={[
                { label: "대표 연락처", value: textField(primaryGuardian, "mobilePhone") ?? guardian?.mobilePhone ?? guardian?.phone },
                { label: "이메일", value: textField(primaryGuardian, "email") ?? guardian?.email },
                { label: "환자 관계", value: `${patientName}의 주보호자` },
              ]}
            />
          ),
        }
      : undefined,
  };
}
