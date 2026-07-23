"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmrRequiredIndicator } from "@/components/emr/required-indicator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
      <section className="flex flex-col gap-3" aria-labelledby="hospital-contact-title">
        <h2 id="hospital-contact-title" className="text-base font-semibold">
          연락처 및 채널
        </h2>
        <Card size="sm">
          <CardContent className="p-0">
            <FieldGroup className="divide-y divide-border">
              <ContactSettingRow
                error={findIssue(validationIssues, "hospital-settings-phone")}
                id="hospital-settings-phone"
                label="대표 전화"
                description="고객 안내 및 문서에 표시되는 필수 연락처입니다."
                required
                value={draft.contact.phone}
                onChange={(value) => updateContact("phone", value)}
              />
              <ContactSettingRow
                id="hospital-settings-fax"
                label="팩스"
                value={draft.contact.fax}
                onChange={(value) => updateContact("fax", value)}
              />
              <ContactSettingRow
                error={findIssue(validationIssues, "hospital-settings-homepage")}
                id="hospital-settings-homepage"
                label="홈페이지"
                placeholder="https://"
                value={draft.contact.homepage}
                onChange={(value) => updateContact("homepage", value)}
              />
              <ContactSettingRow
                id="hospital-settings-instagram"
                label="인스타그램"
                placeholder="@account"
                value={draft.contact.instagram}
                onChange={(value) => updateContact("instagram", value)}
              />
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] sm:items-start">
                <div>
                  <p className="text-sm font-medium">고객 안내 메모</p>
                  <p className="mt-0.5 emr-text-dense text-muted-foreground">
                    예약 알림과 방문 안내에 표시할 문구를 입력합니다.
                  </p>
                </div>
                <Field
                  data-invalid={Boolean(
                    findIssue(validationIssues, "hospital-settings-customer-guide-memo")
                  )}
                >
                  <FieldLabel className="sr-only" htmlFor="hospital-settings-customer-guide-memo">
                    고객 안내 메모
                  </FieldLabel>
                  <Textarea
                    id="hospital-settings-customer-guide-memo"
                    className="min-h-[120px] resize-y"
                    aria-invalid={Boolean(
                      findIssue(validationIssues, "hospital-settings-customer-guide-memo")
                    )}
                    rows={5}
                    maxLength={300}
                    value={draft.contact.customerGuideMemo}
                    onChange={(event) => updateContact("customerGuideMemo", event.target.value)}
                  />
                  <FieldDescription>
                    {draft.contact.customerGuideMemo.length}/300자
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
            </FieldGroup>
          </CardContent>
        </Card>
      </section>
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
  value,
}: {
  description?: string;
  error?: HospitalSettingsValidationIssue;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] sm:items-center">
      <div>
        <p className="text-sm font-medium">
          {label}
          {required ? <EmrRequiredIndicator className="ml-1" /> : null}
        </p>
        {description ? (
          <p className="mt-0.5 emr-text-dense text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Field data-invalid={Boolean(error)}>
        <FieldLabel className="sr-only" htmlFor={id}>
          {label}
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
    </div>
  );
}

function findIssue(issues: HospitalSettingsValidationIssue[], fieldId: string) {
  return issues.find((issue) => issue.fieldId === fieldId);
}
