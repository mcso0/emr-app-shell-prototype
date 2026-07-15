"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CdsActionsCheckIcon,
  CdsActionsCopyIcon,
} from "@/components/cds-icons/actions-and-controls";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrRequiredIndicator } from "@/components/emr/required-indicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  createInitialHospitalBasicSettingsDraft,
  hasHospitalBasicSettingsChanges,
  hasOperatingHoursChanges,
  validateHospitalBasicSettingsDraft,
  type HospitalBasicSettingsDraft,
  type HospitalSettingsValidationIssue,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { HospitalOperatingHoursEditor } from "@/features/hospital-admin/settings/hospital-operating-hours-editor";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { useMockAuthStore } from "@/features/auth/session-store";

type ContactField = keyof HospitalBasicSettingsDraft["contact"];

const hospitalIdentity = {
  address: "서울 강남구 도산대로 000",
  director: "김청담",
  name: "VIP동물의료센터 청담점",
};

export function HospitalBasicSettingsScreen({ workspaceId }: { workspaceId: string }) {
  const authSession = useMockAuthStore((state) => state.session);
  const demoActorId = authSession?.role === "hospital_admin" ? "user-admin" : authSession?.id;
  const initialDraft = useMemo(() => createInitialHospitalBasicSettingsDraft(), []);
  const record = useHospitalBasicSettingsStore((state) => state.records[workspaceId]);
  const ensureWorkspace = useHospitalBasicSettingsStore((state) => state.ensureWorkspace);
  const save = useHospitalBasicSettingsStore((state) => state.save);
  const hydrateOperatingHours = useHospitalBasicSettingsStore((state) => state.hydrateOperatingHours);
  const revert = useHospitalBasicSettingsStore((state) => state.revert);
  const setDraft = useHospitalBasicSettingsStore((state) => state.setDraft);
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const [validationIssues, setValidationIssues] = useState<HospitalSettingsValidationIssue[]>([]);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [copySucceeded, setCopySucceeded] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    ensureWorkspace(workspaceId);
  }, [ensureWorkspace, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/basic-settings/operating-hours`, {
      cache: "no-store",
      headers: demoActorId ? { "x-clair-demo-session-user-id": demoActorId } : undefined,
    })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (cancelled || !response.ok || !body.ok) return;
        hydrateOperatingHours(workspaceId, body.settings);
      })
      .catch(() => {
        if (!cancelled) toast.error("운영시간을 불러오지 못했습니다.");
      })
      .finally(() => { if (!cancelled) setIsLoadingHours(false); });
    return () => { cancelled = true; };
  }, [demoActorId, hydrateOperatingHours, workspaceId]);

  useEffect(
    () => () => {
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
    },
    []
  );

  const draft = record?.draft ?? initialDraft;
  const savedDraft = record?.savedDraft ?? initialDraft;
  const isDirty = hasHospitalBasicSettingsChanges(draft, savedDraft);

  useEffect(() => {
    setSettingsDirty(isDirty);
    return () => setSettingsDirty(false);
  }, [isDirty, setSettingsDirty]);

  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty]);

  const updateDraft = (next: HospitalBasicSettingsDraft) => {
    setValidationIssues([]);
    setDraft(workspaceId, next);
  };

  const updateContact = (field: ContactField, value: string) => {
    updateDraft({
      ...draft,
      contact: { ...draft.contact, [field]: value },
    });
  };

  const handleSave = async () => {
    const issues = validateHospitalBasicSettingsDraft(draft);
    if (issues.length > 0) {
      setValidationIssues(issues);
      window.requestAnimationFrame(() => document.getElementById(issues[0].fieldId)?.focus());
      return;
    }

    const scheduleChanged = hasOperatingHoursChanges(draft, savedDraft);
    if (scheduleChanged) {
      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/basic-settings/operating-hours`,
          {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              ...(demoActorId ? { "x-clair-demo-session-user-id": demoActorId } : {}),
            },
            body: JSON.stringify({
              timezone: draft.timezone,
              weeklyHours: draft.weeklyHours,
              holidayPolicy: draft.holidayPolicy,
              exceptions: draft.exceptions,
            }),
          },
        );
        const body = await response.json();
        if (!response.ok || !body.ok) {
          toast.error(body.error === "future_appointment_conflict"
            ? "변경 후 운영시간과 겹치지 않는 미래 예약이 있어 저장할 수 없습니다."
            : "운영시간을 저장하지 못했습니다.");
          return;
        }
        hydrateOperatingHours(workspaceId, body.settings);
      } catch {
        toast.error("운영시간을 저장하지 못했습니다.");
        return;
      } finally {
        setIsSaving(false);
      }
    }
    save(workspaceId);
    setValidationIssues([]);
    toast.success(scheduleChanged ? "운영시간이 변경되었습니다." : "병원 기본 설정이 저장되었습니다.");
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(hospitalIdentity.address);
      setCopySucceeded(true);
      setCopyStatus("주소가 복사되었습니다.");
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => {
        setCopySucceeded(false);
        setCopyStatus("");
      }, 1800);
    } catch {
      setCopySucceeded(false);
      setCopyStatus("주소를 복사하지 못했습니다.");
      toast.error("주소를 복사하지 못했습니다.");
    }
  };

  const submitIdentityRequest = () => {
    if (!requestReason.trim()) {
      setRequestError("변경 사유를 입력해 주세요.");
      return;
    }

    setRequestDialogOpen(false);
    setRequestError("");
    setRequestReason("");
    setRequestStatus("변경 요청 내용을 확인했습니다.");
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
      data-testid="hospital-admin-settings-screen"
    >
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto grid w-full max-w-[920px] gap-8 px-5 py-8 pb-32 md:px-8">
          <header>
            <h1 className="text-[24px] font-semibold leading-8">병원 기본 설정</h1>
            <p className="mt-1 emr-text-dense text-muted-foreground">
              병원 정보와 운영시간을 관리합니다.
            </p>
          </header>

          <Card size="sm">
            <CardHeader>
              <CardTitle>병원 정보</CardTitle>
              <CardDescription>병원 개설 시 등록된 정보입니다. 변경이 필요한 경우 요청해 주세요.</CardDescription>
              <CardAction>
                <Button type="button" size="sm" variant="outline" onClick={() => setRequestDialogOpen(true)}>
                  병원 정보 변경 요청
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 lg:grid-cols-2" data-testid="hospital-settings-identity-fields">
                <ReadOnlyField id="hospital-settings-name" label="병원명" value={hospitalIdentity.name} />
                <ReadOnlyField
                  id="hospital-settings-director"
                  label="대표자/원장명"
                  value={hospitalIdentity.director}
                />
                <Field className="lg:col-span-2">
                  <FieldLabel htmlFor="hospital-settings-address">주소</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="hospital-settings-address"
                      aria-label="주소"
                      className="bg-muted/40"
                      readOnly
                      value={hospitalIdentity.address}
                    />
                    <Button type="button" variant="outline" onClick={() => void handleCopyAddress()}>
                      {copySucceeded ? (
                        <CdsActionsCheckIcon data-icon="inline-start" />
                      ) : (
                        <CdsActionsCopyIcon data-icon="inline-start" />
                      )}
                      {copySucceeded ? "복사됨" : "주소 복사"}
                    </Button>
                  </div>
                  <span className="sr-only" role="status" aria-live="polite">
                    {copyStatus}
                  </span>
                </Field>
              </FieldGroup>
              {requestStatus ? <p className="mt-3 emr-text-dense text-muted-foreground">{requestStatus}</p> : null}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>연락처</CardTitle>
              <CardDescription>대표 전화는 필수이며, 나머지 연락처는 필요한 경우 추가할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 lg:grid-cols-2" data-testid="hospital-settings-contact-fields">
                <ContactField
                  error={findIssue(validationIssues, "hospital-settings-phone")}
                  id="hospital-settings-phone"
                  label="대표 전화"
                  required
                  value={draft.contact.phone}
                  onChange={(value) => updateContact("phone", value)}
                />
                <ContactField
                  id="hospital-settings-fax"
                  label="팩스"
                  value={draft.contact.fax}
                  onChange={(value) => updateContact("fax", value)}
                />
                <ContactField
                  error={findIssue(validationIssues, "hospital-settings-homepage")}
                  id="hospital-settings-homepage"
                  label="홈페이지"
                  placeholder="https://"
                  value={draft.contact.homepage}
                  onChange={(value) => updateContact("homepage", value)}
                />
                <ContactField
                  id="hospital-settings-instagram"
                  label="인스타그램"
                  placeholder="@account"
                  value={draft.contact.instagram}
                  onChange={(value) => updateContact("instagram", value)}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <HospitalOperatingHoursEditor
            validationIssues={validationIssues}
            value={draft}
            onChange={updateDraft}
          />
        </main>
      </ScrollArea>

      {isDirty ? (
        <div
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[808px] -translate-x-1/2 flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"
          data-testid="hospital-settings-change-bar"
          role="status"
          aria-live="polite"
        >
          <div>
            <p className="text-sm font-medium">저장하지 않은 변경사항이 있습니다.</p>
            <p className="emr-text-dense text-muted-foreground">변경사항을 저장하거나 저장된 값으로 되돌릴 수 있습니다.</p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setRevertDialogOpen(true)}>
              변경 전으로 되돌리기
            </Button>
            <Button type="button" size="sm" disabled={isSaving || isLoadingHours} onClick={() => void handleSave()}>
              {isSaving ? "저장 중..." : "변경사항 저장"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) setRequestError("");
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>병원 정보 변경 요청</DialogTitle>
            <DialogDescription>변경이 필요한 이유를 작성해 주세요.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(requestError)}>
            <FieldLabel htmlFor="hospital-settings-request-reason">변경 사유</FieldLabel>
            <Textarea
              id="hospital-settings-request-reason"
              aria-invalid={Boolean(requestError)}
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value)}
            />
            <FieldError>{requestError}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={submitIdentityRequest}>
              내용 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <EmrConfirmDialogContent
          title="저장하지 않은 변경사항을 되돌릴까요?"
          description="현재 편집한 내용은 사라지고 마지막으로 저장한 값으로 돌아갑니다."
          cancelLabel="계속 편집"
          confirmLabel="모두 되돌리기"
          onCancel={() => setRevertDialogOpen(false)}
          onConfirm={() => {
            revert(workspaceId);
            setValidationIssues([]);
            setRevertDialogOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-label={label} className="bg-muted/40" readOnly value={value} />
    </Field>
  );
}

function ContactField({
  error,
  id,
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  error?: HospitalSettingsValidationIssue;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <EmrRequiredIndicator className="ml-1" /> : null}
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError>{error?.message}</FieldError>
    </Field>
  );
}

function findIssue(issues: HospitalSettingsValidationIssue[], fieldId: string) {
  return issues.find((issue) => issue.fieldId === fieldId);
}
