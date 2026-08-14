"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  CdsActionsCheckIcon,
  CdsActionsCopyIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { HospitalProfileReadState } from "@/features/hospital-admin/settings/hospital-profile-read-state";
import { HospitalLogoEditor } from "@/features/hospital-admin/settings/hospital-logo-editor";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { HospitalSettingsPage } from "@/features/hospital-admin/settings/hospital-settings-page";
import { useHospitalProfile } from "@/features/hospital-admin/settings/use-hospital-profile";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { notifyWorkspaceIdentityChanged } from "@/features/auth/workspace-display";

const changeRequestFields = [
  { id: "hospital_name", label: "병원명" },
  { id: "representative_name", label: "대표자/원장명" },
  { id: "address", label: "주소" },
] as const;

type ChangeRequestField = (typeof changeRequestFields)[number]["id"];

export function HospitalBasicSettingsScreen({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const setPendingChangeRequest = useHospitalBasicSettingsStore(
    (state) => state.setPendingChangeRequest
  );
  const setProfileLogoResult = useHospitalBasicSettingsStore(
    (state) => state.setProfileLogoResult
  );
  const {
    demoActorId,
    profile,
    reload,
    status: profileStatus,
  } = useHospitalProfile(workspaceId);
  const [logoDraftOverride, setLogoDraftOverride] = useState<
    string | null | undefined
  >(undefined);
  const [logoDraftFile, setLogoDraftFile] = useState<File | null>(null);
  const [copySucceeded, setCopySucceeded] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestFields, setRequestFields] = useState<ChangeRequestField[]>([]);
  const [requestDetail, setRequestDetail] = useState("");
  const [requestError, setRequestError] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isLogoSaving, setIsLogoSaving] = useState(false);
  const savedLogo = profile?.logo.url ?? null;
  const logoDraft =
    logoDraftOverride === undefined ? savedLogo : logoDraftOverride;
  const isDirty =
    logoDraftOverride !== undefined && logoDraft !== savedLogo;

  const syncDirty = (dirty: boolean) => {
    setSettingsDirty(dirty);
  };

  const handleLogoChange = (nextValue: string | null, file: File | null) => {
    setLogoDraftOverride(nextValue);
    setLogoDraftFile(file);
    syncDirty(nextValue !== savedLogo);
  };

  const logoRequestHeaders = {
    "content-type": "application/json",
    ...(demoActorId
      ? { "x-clair-demo-session-user-id": demoActorId }
      : {}),
  };

  const discardLogoUpload = async (uploadId: string) => {
    await fetch(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/hospital-admin/settings/logo`,
      {
        method: "POST",
        headers: logoRequestHeaders,
        body: JSON.stringify({ action: "discard", uploadId }),
      }
    ).catch(() => undefined);
  };

  const saveLogo = async () => {
    if (!profile || logoDraftOverride === undefined) return;
    setIsLogoSaving(true);
    let uploadId: string | null = null;
    try {
      const logoUrl = `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/hospital-admin/settings/logo`;

      if (logoDraftOverride === null) {
        const response = await fetch(logoUrl, {
          method: "DELETE",
          headers: logoRequestHeaders,
          body: JSON.stringify({ revision: profile.revision }),
        });
        const body = await response.json();
        if (!response.ok || !body.ok || !Number.isSafeInteger(body.revision)) {
          throw new Error(
            response.status === 409
              ? "hospital_logo_state_conflict"
              : "hospital_logo_remove_failed"
          );
        }
        setProfileLogoResult(workspaceId, {
          url: null,
          revision: body.revision,
        });
        setLogoDraftOverride(undefined);
        setLogoDraftFile(null);
        syncDirty(false);
        notifyWorkspaceIdentityChanged(workspaceId);
        toast.success("병원 로고가 기본 이미지로 변경되었습니다.");
        return;
      }

      if (!logoDraftFile) throw new Error("hospital_logo_file_missing");
      const prepareResponse = await fetch(logoUrl, {
        method: "POST",
        headers: logoRequestHeaders,
        body: JSON.stringify({
          action: "prepare",
          revision: profile.revision,
        }),
      });
      const prepared = await prepareResponse.json();
      if (
        !prepareResponse.ok ||
        !prepared.ok ||
        typeof prepared.objectPath !== "string" ||
        typeof prepared.uploadId !== "string" ||
        typeof prepared.uploadToken !== "string"
      ) {
        throw new Error(
          prepareResponse.status === 503
            ? "configured_data_source_required"
            : "hospital_logo_prepare_failed"
        );
      }
      uploadId = prepared.uploadId;

      const client = getBrowserSupabaseClient();
      if (!client) throw new Error("configured_data_source_required");
      const { error: uploadError } = await client.storage
        .from("hospital-logos")
        .uploadToSignedUrl(
          prepared.objectPath,
          prepared.uploadToken,
          logoDraftFile,
          {
            cacheControl: "0",
            contentType: logoDraftFile.type,
            upsert: false,
          }
        );
      if (uploadError) throw new Error("hospital_logo_upload_failed");

      const finalizeResponse = await fetch(logoUrl, {
        method: "POST",
        headers: logoRequestHeaders,
        body: JSON.stringify({
          action: "finalize",
          uploadId,
          declaredMime: logoDraftFile.type,
          revision: profile.revision,
        }),
      });
      const finalized = await finalizeResponse.json();
      if (
        !finalizeResponse.ok ||
        !finalized.ok ||
        typeof finalized.logoUrl !== "string" ||
        !Number.isSafeInteger(finalized.revision)
      ) {
        throw new Error(
          finalizeResponse.status === 409
            ? "hospital_logo_state_conflict"
            : "hospital_logo_finalize_failed"
        );
      }
      uploadId = null;
      setProfileLogoResult(workspaceId, {
        url: finalized.logoUrl,
        revision: finalized.revision,
      });
      setLogoDraftOverride(undefined);
      setLogoDraftFile(null);
      syncDirty(false);
      notifyWorkspaceIdentityChanged(workspaceId);
      toast.success(
        finalized.cleanupPending
          ? "병원 로고가 저장되었습니다. 이전 파일은 정리 중입니다."
          : "병원 로고가 저장되었습니다."
      );
    } catch (error) {
      if (uploadId) await discardLogoUpload(uploadId);
      const code = error instanceof Error ? error.message : "";
      toast.error(
        code === "configured_data_source_required"
          ? "병원 로고 저장은 실제 데이터가 연결된 환경에서 사용할 수 있습니다."
          : code === "hospital_logo_state_conflict"
            ? "다른 관리자가 로고를 변경했습니다. 최신 정보를 확인한 후 다시 시도해 주세요."
            : "병원 로고를 저장하지 못했습니다."
      );
    } finally {
      setIsLogoSaving(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!profile?.address) {
      toast.error("복사할 주소가 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.address);
      setCopySucceeded(true);
      toast.success("주소가 복사되었습니다.");
      window.setTimeout(() => setCopySucceeded(false), 1800);
    } catch {
      toast.error("주소를 복사하지 못했습니다.");
    }
  };

  const submitChangeRequest = async () => {
    if (requestFields.length === 0) {
      setRequestError("변경이 필요한 항목을 한 개 이상 선택해 주세요.");
      toast.error("변경 요청 항목을 확인해 주세요.");
      return;
    }
    if (!requestDetail.trim()) {
      setRequestError("변경할 내용과 사유를 입력해 주세요.");
      toast.error("변경 요청 내용을 입력해 주세요.");
      return;
    }

    setIsRequesting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(
          workspaceId
        )}/hospital-admin/settings/profile-change-requests`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(demoActorId
              ? { "x-clair-demo-session-user-id": demoActorId }
              : {}),
          },
          body: JSON.stringify({
            fields: requestFields,
            detail: requestDetail,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok || !body.ok || !body.request) {
        toast.error("변경 요청을 접수하지 못했습니다.");
        return;
      }
      setPendingChangeRequest(workspaceId, body.request);
      setRequestDialogOpen(false);
      setRequestFields([]);
      setRequestDetail("");
      setRequestError("");
      toast.success("변경 요청이 접수되었습니다.");
    } catch {
      toast.error("변경 요청을 접수하지 못했습니다.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <HospitalSettingsPage
      testId="hospital-admin-settings-screen"
      title="병원 기본 설정"
      description="병원에 표시되는 기본 정보와 지역 기준을 확인합니다."
      dirty={isDirty}
      isSaving={isLogoSaving}
      layout="summary"
      onRevert={() => {
        setLogoDraftOverride(undefined);
        setLogoDraftFile(null);
        syncDirty(false);
        toast.success("로고 변경사항을 되돌렸습니다.");
      }}
      onSave={saveLogo}
    >
      {profileStatus !== "ready" || !profile ? (
        <HospitalProfileReadState
          status={profileStatus === "ready" ? "error" : profileStatus}
          onRetry={() => void reload()}
        />
      ) : (
        <>
          <section
            className="flex w-full flex-col pb-2"
            aria-labelledby="hospital-profile-title"
          >
            <SectionTitle id="hospital-profile-title">병원 정보</SectionTitle>
            <Card
              className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
              data-testid="hospital-profile-card"
            >
              <CardContent className="p-0">
                <SettingRow
                  testId="hospital-settings-row-logo"
                  label="병원 로고"
                  description="PNG 또는 JPG, 최대 5MB. 256 × 256px 이상을 권장합니다."
                  action={
                    <HospitalLogoEditor
                      value={logoDraft}
                      onChange={handleLogoChange}
                    />
                  }
                />
                <SettingRow
                  testId="hospital-settings-row-name"
                  label="병원명"
                  description="예약과 고객 안내에 표시되는 공식 병원명입니다."
                  action={<SettingValue label="병원명" value={profile.name} />}
                />
                <SettingRow
                  testId="hospital-settings-row-representative"
                  label="대표자/원장명"
                  description="등록된 대표자 또는 원장 정보입니다."
                  action={
                    <SettingValue
                      label="대표자/원장명"
                      value={profile.representativeName}
                      emptyLabel="등록된 대표자/원장 정보가 없습니다."
                    />
                  }
                />
                <SettingRow
                  testId="hospital-settings-row-address"
                  label="주소"
                  description="고객 안내와 문서에 사용하는 등록 주소입니다."
                  action={
                    <div className="flex min-w-0 max-w-full items-center gap-2.5">
                      <SettingValue
                        label="주소"
                        value={profile.address}
                        emptyLabel="등록된 주소가 없습니다."
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-7"
                        aria-label="주소 복사"
                        data-copy-state={copySucceeded ? "succeeded" : "idle"}
                        disabled={!profile.address}
                        onClick={() => void handleCopyAddress()}
                      >
                        {copySucceeded ? (
                          <CdsActionsCheckIcon aria-hidden="true" />
                        ) : (
                          <CdsActionsCopyIcon aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  }
                />
                <SettingRow
                  testId="hospital-settings-row-change-request"
                  label="등록 정보 변경"
                  description="병원명, 대표자 및 주소 변경은 운영팀 확인이 필요합니다."
                  action={
                    profile.pendingChangeRequest ? (
                      <span className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
                        운영팀 확인 대기 중
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="병원 정보 변경 요청"
                        onClick={() => setRequestDialogOpen(true)}
                      >
                        <CdsContentEditIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        변경 요청
                      </Button>
                    )
                  }
                />
              </CardContent>
            </Card>
          </section>

          <section
            className="flex w-full flex-col pb-2"
            aria-labelledby="hospital-region-title"
          >
            <SectionTitle id="hospital-region-title">지역 및 시간대</SectionTitle>
            <Card
              className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
              data-testid="hospital-region-card"
            >
              <CardContent className="p-0">
                <SettingRow
                  testId="hospital-settings-row-timezone"
                  label="시간대"
                  description="예약 및 운영시간 계산에 사용됩니다."
                  action={
                    <SettingValue
                      label="시간대"
                      value={formatTimezone(profile.timezone)}
                    />
                  }
                />
                <SettingRow
                  testId="hospital-settings-row-region"
                  label="지역"
                  description="워크스페이스 생성 후에는 변경할 수 없습니다."
                  action={
                    <SettingValue
                      label="지역"
                      value={formatCountry(profile.countryCode)}
                    />
                  }
                />
              </CardContent>
            </Card>
          </section>
        </>
      )}

      <Dialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) setRequestError("");
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>병원 등록 정보 변경 요청</DialogTitle>
            <DialogDescription>
              변경이 필요한 항목과 운영팀이 확인할 내용을 입력해 주세요.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">변경 항목</FieldLegend>
              <div className="flex flex-col gap-2">
                {changeRequestFields.map((field) => (
                  <label key={field.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={requestFields.includes(field.id)}
                      onCheckedChange={(checked) => {
                        setRequestFields((current) =>
                          checked
                            ? [...new Set([...current, field.id])]
                            : current.filter((item) => item !== field.id)
                        );
                        setRequestError("");
                      }}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </FieldSet>
            <Field data-invalid={Boolean(requestError)}>
              <FieldLabel htmlFor="hospital-settings-request-detail">변경 내용 및 사유</FieldLabel>
              <Textarea
                id="hospital-settings-request-detail"
                aria-invalid={Boolean(requestError)}
                rows={5}
                maxLength={2000}
                value={requestDetail}
                onChange={(event) => {
                  setRequestDetail(event.target.value);
                  setRequestError("");
                }}
              />
              <FieldDescription>{requestDetail.length}/2,000자</FieldDescription>
              <FieldError>{requestError}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              disabled={isRequesting}
              onClick={() => void submitChangeRequest()}
            >
              {isRequesting ? "요청 중..." : "변경 요청 제출"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HospitalSettingsPage>
  );
}

function SettingRow({
  action,
  description,
  label,
  testId,
}: {
  action: React.ReactNode;
  description?: string;
  label: string;
  testId: string;
}) {
  return (
    <div
      className="px-4 pt-4 last:[&>[data-slot=separator]]:hidden md:h-[85px] md:px-6 md:pt-5"
      data-testid={testId}
    >
      <div className="flex min-h-11 flex-col gap-3 md:h-11 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm leading-5 font-medium tracking-[0.014em] text-foreground">
            {label}
          </p>
          {description ? (
            <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 justify-start md:justify-end">
          {action}
        </div>
      </div>
      <Separator className="mt-4 md:mt-5" />
    </div>
  );
}

function SectionTitle({
  children,
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  return (
    <h2
      id={id}
      className="flex h-[52px] shrink-0 items-center px-4 text-base leading-6 font-semibold text-foreground"
    >
      {children}
    </h2>
  );
}

function SettingValue({
  emptyLabel = "등록된 정보가 없습니다.",
  label,
  value,
}: {
  emptyLabel?: string;
  label: string;
  value: string | null | undefined;
}) {
  const displayValue = value?.trim() || emptyLabel;

  return (
    <span
      aria-label={label}
      className={
        value?.trim()
          ? "min-w-0 max-w-[520px] break-words text-left text-sm leading-5 font-medium tracking-[0.014em] text-foreground md:text-right"
          : "min-w-0 max-w-[520px] break-words text-left text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground md:text-right"
      }
    >
      {displayValue}
    </span>
  );
}

function formatCountry(countryCode: string) {
  return countryCode === "KR" ? "대한민국" : countryCode;
}

function formatTimezone(timezone: string) {
  try {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "longOffset",
      })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")
        ?.value.replace("GMT", "UTC") ?? "";
    return offset ? `${timezone} (${offset})` : timezone;
  } catch {
    return timezone;
  }
}
