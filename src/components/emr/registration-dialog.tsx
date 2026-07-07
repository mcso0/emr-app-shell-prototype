"use client";

import type { ElementType, ReactNode } from "react";
import {
  CdsCommunicationMailIcon,
  CdsCommunicationPhoneIcon,
} from "@/components/cds-icons/communication-and-media";
import { CdsContentEdit2Icon } from "@/components/cds-icons/content-and-editor";
import {
  CdsFilesCalendarIcon,
  CdsFilesFileTextIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalClipboardPenIcon,
  CdsMedicalNotebookTextIcon,
  CdsMedicalPawPrintIcon,
  CdsMedicalScanLineIcon,
} from "@/components/cds-icons/medical-and-domain";
import { CdsPeopleMapPinIcon, CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field as FormField,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { cn } from "@/lib/utils";

export type EmrRegistrationDialogKind = "form" | "confirm";
export type EmrRegistrationSignatureStatus = "idle" | "pending" | "completed";

export const emrRegistrationControlClassName = "h-[var(--clair-control-height-md)] bg-card";
export const emrRegistrationTextareaClassName = "h-[76px] min-h-[76px] resize-none bg-card";

type EmrRegistrationLabelIcon = ElementType<{
  className?: string;
  color?: string;
  size?: number;
}>;

const registrationFieldIconByLabel: Record<string, EmrRegistrationLabelIcon> = {
  보호자명: CdsPeopleUserIcon,
  "보호자 검색": CdsPeopleUserIcon,
  환자명: CdsMedicalPawPrintIcon,
  종류: CdsMedicalPawPrintIcon,
  품종: CdsMedicalPawPrintIcon,
  "추가 품종": CdsMedicalPawPrintIcon,
  성별: CdsPeopleUserIcon,
  나이: CdsFilesCalendarIcon,
  생년월일: CdsFilesCalendarIcon,
  전화번호: CdsCommunicationPhoneIcon,
  이메일: CdsCommunicationMailIcon,
  주소: CdsPeopleMapPinIcon,
  "보호자 메모": CdsMedicalNotebookTextIcon,
  "환자 메모": CdsMedicalNotebookTextIcon,
  마이크로칩: CdsMedicalScanLineIcon,
  동물등록번호: CdsFilesFileTextIcon,
  "전자 서명": CdsMedicalClipboardPenIcon,
};

function getRegistrationFieldIcon(label: ReactNode, icon?: ReactNode) {
  if (icon) return icon;
  if (typeof label !== "string") return <CdsContentEdit2Icon className="size-[15px]" />;

  const Icon = registrationFieldIconByLabel[label] ?? CdsContentEdit2Icon;
  return <Icon className="size-[15px]" />;
}

export function EmrRegistrationDialogShell({
  children,
  closeAriaLabel,
  description,
  footer,
  kind = "form",
  stepLabel,
  title,
}: {
  children: ReactNode;
  closeAriaLabel: string;
  description?: ReactNode;
  footer: ReactNode;
  kind?: EmrRegistrationDialogKind;
  stepLabel?: string;
  title: ReactNode;
}) {
  return (
    <EmrDialogShell
      closeAriaLabel={closeAriaLabel}
      description={description}
      footer={footer}
      showCloseButton
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {stepLabel ? (
            <Badge
              variant="secondary"
              className="h-6 rounded-[var(--emr-radius-control)] px-2 emr-text-metadata font-semibold"
            >
              {stepLabel}
            </Badge>
          ) : null}
        </span>
      }
      variant={kind === "confirm" ? "registration-confirm" : "registration-form"}
    >
      <div className="flex flex-col gap-3">{children}</div>
    </EmrDialogShell>
  );
}

export function EmrRegistrationFooter({
  cancelLabel = "취소",
  nextDisabled,
  nextLabel,
  previousLabel = "이전",
  showPrevious,
  onCancel,
  onNext,
  onPrevious,
}: {
  cancelLabel?: string;
  nextDisabled?: boolean;
  nextLabel: string;
  previousLabel?: string;
  showPrevious?: boolean;
  onCancel: () => void;
  onNext: () => void;
  onPrevious?: () => void;
}) {
  return (
    <>
      <Button variant="ghost" className="px-3 font-semibold" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <div className="flex shrink-0 items-center gap-2">
        {showPrevious ? (
          <Button variant="outline" className="px-3 font-semibold" onClick={onPrevious}>
            {previousLabel}
          </Button>
        ) : null}
        <Button className="px-4 font-semibold" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </>
  );
}

export function EmrRegistrationSection({
  children,
  className,
  separated = true,
  title,
}: {
  children: ReactNode;
  className?: string;
  separated?: boolean;
  title: ReactNode;
}) {
  return (
    <>
      {separated ? <Separator /> : null}
      <FieldSet className={cn("gap-3", className)}>
        <FieldLegend className="flex h-6 items-center text-[13px] font-medium leading-[18px] text-[var(--emr-text-placeholder)]">
          {title}
        </FieldLegend>
        <div className="grid gap-3">{children}</div>
      </FieldSet>
    </>
  );
}

export function EmrRegistrationFieldRow({
  children,
  className,
  controlClassName,
  error,
  icon,
  label,
  required,
}: {
  children: ReactNode;
  className?: string;
  controlClassName?: string;
  error?: string;
  icon?: ReactNode;
  label: ReactNode;
  required?: boolean;
}) {
  return (
    <FormField
      className={cn(
        "grid min-h-8 grid-cols-[128px_minmax(0,1fr)] items-start",
        className
      )}
      data-required={required || undefined}
      data-invalid={Boolean(error) || undefined}
      style={{ gap: "var(--clair-spacing-12)" }}
    >
      <FieldLabel className="flex h-8 min-w-0 items-center gap-2 text-[14px] font-medium leading-5 text-foreground">
        <span aria-hidden="true" className="flex size-[15px] shrink-0 items-center justify-center text-[var(--emr-text-tertiary)]">
          {getRegistrationFieldIcon(label, icon)}
        </span>
        <span className="min-w-0 truncate">
          {label}
        </span>
      </FieldLabel>
      <div className={cn("min-w-0", controlClassName)}>
        {children}
        {error ? <FieldError className="mt-1 emr-text-metadata leading-4">{error}</FieldError> : null}
      </div>
    </FormField>
  );
}

export function EmrRegistrationInlineControl({
  children,
  control,
  className,
}: {
  children: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {control}
    </div>
  );
}

export function EmrRegistrationAddressControls({
  detail,
  postalCode,
  road,
}: {
  detail: ReactNode;
  postalCode: ReactNode;
  road: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[minmax(0,175px)_81px] gap-3">
        {postalCode}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-[var(--clair-control-height-md)] px-2.5 font-semibold"
        >
          주소 검색
        </Button>
      </div>
      {road}
      {detail}
    </div>
  );
}

export function EmrRegistrationAgeControls({
  estimate,
  months,
  years,
}: {
  estimate: ReactNode;
  months: ReactNode;
  years: ReactNode;
}) {
  return (
    <EmrRegistrationInlineControl
      control={estimate}
      className="grid grid-cols-[minmax(0,206px)_50px]"
    >
      <div className="grid grid-cols-2 gap-3">
        {years}
        {months}
      </div>
    </EmrRegistrationInlineControl>
  );
}

export function EmrRegistrationSwitchLabel({
  children,
  control,
}: {
  children: ReactNode;
  control: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-[54px] shrink-0 items-center justify-end gap-1.5 whitespace-nowrap emr-text-metadata font-semibold text-[var(--emr-text-secondary)]">
      {control}
      {children}
    </span>
  );
}

export function EmrRegistrationSignatureConsentCard({
  error,
  signatureStatus,
  onCompleteSignature,
  onRequestSignature,
}: {
  error?: string;
  signatureStatus: EmrRegistrationSignatureStatus;
  onCompleteSignature: () => void;
  onRequestSignature: () => void;
}) {
  const actionLabel =
    signatureStatus === "completed"
      ? "서명 완료"
      : signatureStatus === "pending"
        ? "서명 완료 처리"
        : "태블릿 서명 요청";
  const handleClick = signatureStatus === "pending" ? onCompleteSignature : onRequestSignature;

  return (
    <EmrRegistrationFieldRow error={error} label="전자 서명">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-[var(--clair-control-height-md)] w-[122px] px-2 text-[12px] font-bold"
        disabled={signatureStatus === "completed"}
        onClick={handleClick}
      >
        {actionLabel}
      </Button>
    </EmrRegistrationFieldRow>
  );
}

export function EmrRegistrationSummaryItem({
  badge,
  details,
  icon,
  tone,
  title,
}: {
  badge: ReactNode;
  details: ReactNode[];
  icon: ReactNode;
  tone: "guardian" | "patient";
  title: ReactNode;
}) {
  return (
    <section className="flex h-[54px] min-w-0 items-center gap-3 rounded-lg border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-4">
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          tone === "guardian"
            ? "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
            : "bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]"
        )}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 emr-text-dense font-semibold text-[var(--emr-text-secondary)]">
            {badge}
          </span>
          <span className="min-w-0 truncate text-[16px] font-bold leading-5 text-foreground">
            {title}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {details.map((detail, index) => (
            <span key={index} className="contents">
              {index > 0 ? (
                <span className="shrink-0 emr-text-metadata text-[var(--emr-text-tertiary)]">
                  ·
                </span>
              ) : null}
              <span className="min-w-0 truncate emr-text-metadata text-[var(--emr-text-secondary)]">
                {detail}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
