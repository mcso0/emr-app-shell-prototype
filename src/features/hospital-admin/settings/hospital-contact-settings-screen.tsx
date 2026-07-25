"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createInitialHospitalBasicSettingsDraft,
  hasContactSettingsChanges,
  validateContactSettingsDraft,
  type HospitalBasicSettingsDraft,
  type HospitalSettingsValidationIssue,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { HospitalSettingsPage } from "@/features/hospital-admin/settings/hospital-settings-page";
import { HospitalProfileReadState } from "@/features/hospital-admin/settings/hospital-profile-read-state";
import { useHospitalProfile } from "@/features/hospital-admin/settings/use-hospital-profile";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";

type ContactField = keyof HospitalBasicSettingsDraft["contact"];

export function HospitalContactSettingsScreen({ workspaceId }: { workspaceId: string }) {
  const initialDraft = useMemo(() => createInitialHospitalBasicSettingsDraft(), []);
  const record = useHospitalBasicSettingsStore((state) => state.records[workspaceId]);
  const ensureWorkspace = useHospitalBasicSettingsStore((state) => state.ensureWorkspace);
  const revertContact = useHospitalBasicSettingsStore((state) => state.revertContact);
  const saveContact = useHospitalBasicSettingsStore((state) => state.saveContact);
  const setDraft = useHospitalBasicSettingsStore((state) => state.setDraft);
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const [validationIssues, setValidationIssues] = useState<HospitalSettingsValidationIssue[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const {
    demoActorId,
    profile,
    reload,
    status: profileStatus,
  } = useHospitalProfile(workspaceId);

  useEffect(() => {
    ensureWorkspace(workspaceId);
  }, [ensureWorkspace, workspaceId]);

  const draft = record?.draft ?? initialDraft;
  const savedDraft = record?.savedDraft ?? initialDraft;
  const isDirty = hasContactSettingsChanges(draft, savedDraft);

  useEffect(() => {
    setSettingsDirty(isDirty);
    return () => setSettingsDirty(false);
  }, [isDirty, setSettingsDirty]);

  const updateContact = (field: ContactField, value: string) => {
    setValidationIssues((current) =>
      current.filter((issue) => issue.fieldId !== contactFieldIds[field])
    );
    setDraft(workspaceId, {
      ...draft,
      contact: { ...draft.contact, [field]: value },
    });
  };

  const handleSave = async () => {
    const issues = validateContactSettingsDraft(draft);
    if (issues.length > 0) {
      setValidationIssues(issues);
      window.requestAnimationFrame(() => document.getElementById(issues[0].fieldId)?.focus());
      toast.error("입력한 연락처 정보를 확인해 주세요.");
      return;
    }

    if (!profile) {
      toast.error("병원 정보를 불러온 후 다시 시도해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(
          workspaceId
        )}/hospital-admin/settings/profile`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...(demoActorId
              ? { "x-clair-demo-session-user-id": demoActorId }
              : {}),
          },
          body: JSON.stringify({
            revision: profile.revision,
            contact: draft.contact,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok || !body.ok || !body.profile) {
        toast.error(
          response.status === 409
            ? "다른 관리자가 정보를 변경했습니다. 입력 내용은 유지되며, 최신 정보를 확인한 후 다시 저장해 주세요."
            : "연락처 및 채널 정보를 저장하지 못했습니다."
        );
        return;
      }
      useHospitalBasicSettingsStore
        .getState()
        .hydrateProfile(workspaceId, body.profile);
      saveContact(workspaceId);
      setValidationIssues([]);
      toast.success("연락처 및 채널 정보가 저장되었습니다.");
    } catch {
      toast.error("연락처 및 채널 정보를 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HospitalSettingsPage
      testId="hospital-admin-settings-contact-screen"
      title="연락처 및 채널"
      description="고객 안내, 문서 및 예약 메시지에 사용할 연락처를 관리합니다."
      layout="summary"
      dirty={isDirty}
      isSaving={isSaving}
      onRevert={() => {
        revertContact(workspaceId);
        setValidationIssues([]);
        toast.success("연락처 변경사항을 되돌렸습니다.");
      }}
      onSave={handleSave}
    >
      {profileStatus !== "ready" || !profile ? (
        <HospitalProfileReadState
          status={
            profileStatus === "ready" ? "error" : profileStatus
          }
          onRetry={() => void reload()}
        />
      ) : (
        <>
          <section
            className="flex w-full flex-col pb-2"
            aria-labelledby="hospital-contact-title"
          >
            <SectionTitle id="hospital-contact-title">연락처</SectionTitle>
            <Card
              className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
              data-testid="hospital-contact-card"
            >
              <CardContent className="p-0">
                <ContactSettingRow
                  error={findIssue(validationIssues, "hospital-settings-phone")}
                  id="hospital-settings-phone"
                  label="대표 번호"
                  description="고객 안내 및 문서에 표시되는 필수 연락처입니다."
                  required
                  type="tel"
                  value={draft.contact.phone}
                  onChange={(value) => updateContact("phone", value)}
                />
                <ContactSettingRow
                  id="hospital-settings-fax"
                  label="팩스 번호"
                  description="문서 전송에 사용하는 팩스 번호입니다."
                  type="tel"
                  value={draft.contact.fax}
                  onChange={(value) => updateContact("fax", value)}
                />
                <div
                  className="px-4 pt-4 md:min-h-[143px] md:px-6 md:pt-5"
                  data-testid="hospital-settings-row-customer-guide-memo"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="text-sm leading-5 font-medium tracking-[0.014em] text-foreground">
                        고객 안내 메모
                      </p>
                      <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
                        예약 알림과 방문 안내에 표시할 문구를 입력합니다.
                      </p>
                    </div>
                    <Field
                      className="w-full gap-0 md:w-[320px]"
                      data-invalid={Boolean(
                        findIssue(
                          validationIssues,
                          "hospital-settings-customer-guide-memo"
                        )
                      )}
                    >
                      <FieldLabel
                        className="sr-only"
                        htmlFor="hospital-settings-customer-guide-memo"
                      >
                        고객 안내 메모
                      </FieldLabel>
                      <Textarea
                        id="hospital-settings-customer-guide-memo"
                        className="h-[76px] min-h-[76px] resize-y"
                        aria-invalid={Boolean(
                          findIssue(
                            validationIssues,
                            "hospital-settings-customer-guide-memo"
                          )
                        )}
                        placeholder="고객 안내 메모를 입력해 주세요."
                        rows={3}
                        maxLength={300}
                        value={draft.contact.customerGuideMemo}
                        onChange={(event) =>
                          updateContact(
                            "customerGuideMemo",
                            event.target.value
                          )
                        }
                      />
                      <FieldDescription className="mt-2 text-right text-xs leading-4 tracking-[0.025em]">
                        최대 {draft.contact.customerGuideMemo.length}/300자
                      </FieldDescription>
                      <FieldError>
                        {
                          findIssue(
                            validationIssues,
                            "hospital-settings-customer-guide-memo"
                          )?.message
                        }
                      </FieldError>
                    </Field>
                  </div>
                  <Separator className="mt-4 md:mt-5" />
                </div>
                <ContactActionRow
                  label="대표 번호 변경"
                  description="대표 번호는 위 입력란에서 수정한 후 저장해 주세요."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="대표 번호 입력란으로 이동"
                      onClick={() =>
                        document
                          .getElementById("hospital-settings-phone")
                          ?.focus()
                      }
                    >
                      <CdsContentEditIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      변경 요청
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </section>

          <section
            className="flex w-full flex-col pb-2"
            aria-labelledby="hospital-channel-title"
          >
            <SectionTitle id="hospital-channel-title">병원 채널</SectionTitle>
            <Card
              className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
              data-testid="hospital-channel-card"
            >
              <CardContent className="p-0">
                <ContactSettingRow
                  error={findIssue(validationIssues, "hospital-settings-homepage")}
                  id="hospital-settings-homepage"
                  label="홈페이지"
                  description="고객 안내와 문서에 표시되는 병원 홈페이지입니다."
                  placeholder="https://"
                  type="url"
                  value={draft.contact.homepage}
                  onChange={(value) => updateContact("homepage", value)}
                />
                <ContactSettingRow
                  id="hospital-settings-instagram"
                  label="인스타그램"
                  description="고객에게 안내할 병원 인스타그램 계정입니다."
                  placeholder="@account"
                  value={draft.contact.instagram}
                  onChange={(value) => updateContact("instagram", value)}
                />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </HospitalSettingsPage>
  );
}

const contactFieldIds: Record<ContactField, string> = {
  phone: "hospital-settings-phone",
  fax: "hospital-settings-fax",
  homepage: "hospital-settings-homepage",
  instagram: "hospital-settings-instagram",
  customerGuideMemo: "hospital-settings-customer-guide-memo",
};

function ContactSettingRow({
  description,
  error,
  id,
  label,
  onChange,
  placeholder,
  required,
  type,
  value,
}: {
  description?: string;
  error?: HospitalSettingsValidationIssue;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  value: string;
}) {
  return (
    <div className="px-4 pt-4 md:h-[85px] md:px-6 md:pt-5">
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
        <Field
          className="w-full gap-0 md:w-[320px]"
          data-invalid={Boolean(error)}
        >
          <FieldLabel className="sr-only" htmlFor={id}>
            {label}
          </FieldLabel>
          <Input
            id={id}
            aria-invalid={Boolean(error)}
            placeholder={placeholder}
            required={required}
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <FieldError>{error?.message}</FieldError>
        </Field>
      </div>
      <Separator className="mt-4 md:mt-5" />
    </div>
  );
}

function ContactActionRow({
  action,
  description,
  label,
}: {
  action: React.ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div
      className="px-4 pt-4 md:h-[85px] md:px-6 md:pt-5"
      data-testid="hospital-settings-row-phone-change"
    >
      <div className="flex min-h-11 flex-col gap-3 md:h-11 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm leading-5 font-medium tracking-[0.014em] text-foreground">
            {label}
          </p>
          <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
            {description}
          </p>
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

function findIssue(issues: HospitalSettingsValidationIssue[], fieldId: string) {
  return issues.find((issue) => issue.fieldId === fieldId);
}
