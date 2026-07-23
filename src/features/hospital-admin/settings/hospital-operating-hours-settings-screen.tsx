"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import {
  createInitialHospitalBasicSettingsDraft,
  hasOperatingHoursChanges,
  validateOperatingHoursDraft,
  type HospitalSettingsValidationIssue,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { HospitalOperatingHoursEditor } from "@/features/hospital-admin/settings/hospital-operating-hours-editor";
import { HospitalSettingsPage } from "@/features/hospital-admin/settings/hospital-settings-page";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { useMockAuthStore } from "@/features/auth/session-store";

export function HospitalOperatingHoursSettingsScreen({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const authSession = useMockAuthStore((state) => state.session);
  const demoActorId =
    authSession?.role === "hospital_admin" ? "user-admin" : authSession?.id;
  const initialDraft = useMemo(() => createInitialHospitalBasicSettingsDraft(), []);
  const record = useHospitalBasicSettingsStore((state) => state.records[workspaceId]);
  const ensureWorkspace = useHospitalBasicSettingsStore((state) => state.ensureWorkspace);
  const hydrateOperatingHours = useHospitalBasicSettingsStore(
    (state) => state.hydrateOperatingHours
  );
  const revertOperatingHours = useHospitalBasicSettingsStore(
    (state) => state.revertOperatingHours
  );
  const saveOperatingHours = useHospitalBasicSettingsStore(
    (state) => state.saveOperatingHours
  );
  const setDraft = useHospitalBasicSettingsStore((state) => state.setDraft);
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const [validationIssues, setValidationIssues] = useState<HospitalSettingsValidationIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    ensureWorkspace(workspaceId);
  }, [ensureWorkspace, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void fetch(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/hospital-admin/basic-settings/operating-hours`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: demoActorId
          ? { "x-clair-demo-session-user-id": demoActorId }
          : undefined,
      }
    )
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok || !body.ok) {
          toast.error("운영시간을 불러오지 못했습니다.");
          return;
        }
        hydrateOperatingHours(workspaceId, body.settings);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError" && !cancelled) {
          toast.error("운영시간을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [demoActorId, hydrateOperatingHours, workspaceId]);

  const draft = record?.draft ?? initialDraft;
  const savedDraft = record?.savedDraft ?? initialDraft;
  const isDirty = hasOperatingHoursChanges(draft, savedDraft);

  useEffect(() => {
    setSettingsDirty(isDirty);
    return () => setSettingsDirty(false);
  }, [isDirty, setSettingsDirty]);

  const handleSave = async () => {
    const issues = validateOperatingHoursDraft(draft);
    if (issues.length > 0) {
      setValidationIssues(issues);
      toast.error("운영시간 입력값을 확인해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(
          workspaceId
        )}/hospital-admin/basic-settings/operating-hours`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...(demoActorId
              ? { "x-clair-demo-session-user-id": demoActorId }
              : {}),
          },
          body: JSON.stringify({
            timezone: draft.timezone,
            weeklyHours: draft.weeklyHours,
            holidayPolicy: draft.holidayPolicy,
            exceptions: draft.exceptions,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok || !body.ok) {
        toast.error(
          body.error === "future_appointment_conflict"
            ? "변경할 운영시간과 겹치는 미래 예약이 있어 저장할 수 없습니다."
            : "운영시간을 저장하지 못했습니다."
        );
        return;
      }
      hydrateOperatingHours(workspaceId, body.settings);
      saveOperatingHours(workspaceId);
      setValidationIssues([]);
      toast.success("병원 운영시간이 저장되었습니다.");
    } catch {
      toast.error("운영시간을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HospitalSettingsPage
      testId="hospital-admin-settings-hours-screen"
      title="운영시간 관리"
      description="주간 진료시간, 휴게시간 및 공휴일·예외 운영 일정을 설정합니다."
      dirty={isDirty}
      isSaving={isSaving}
      onRevert={() => {
        revertOperatingHours(workspaceId);
        setValidationIssues([]);
        toast.success("운영시간 변경사항을 되돌렸습니다.");
      }}
      onSave={handleSave}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-label="운영시간 불러오는 중">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : (
        <HospitalOperatingHoursEditor
          validationIssues={validationIssues}
          value={draft}
          onChange={(next) => {
            setValidationIssues([]);
            setDraft(workspaceId, next);
          }}
        />
      )}
    </HospitalSettingsPage>
  );
}
