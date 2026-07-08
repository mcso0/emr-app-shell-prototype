"use client";

import type { ElementType, ReactNode } from "react";
import {
  CdsCommunicationMailIcon,
  CdsCommunicationPhoneIcon,
} from "@/components/cds-icons/communication-and-media";
import { CdsActionsPinIcon } from "@/components/cds-icons/actions-and-controls";
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
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
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
export const emrRegistrationDialogOverlayClassName =
  "bg-transparent supports-backdrop-filter:backdrop-blur-none";

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
  주소: CdsActionsPinIcon,
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
      motion="none"
      overlayClassName={emrRegistrationDialogOverlayClassName}
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
        <FieldLegend className="flex h-6 items-center !text-[13px] font-medium leading-[18px] text-[var(--emr-text-placeholder)]">
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
      <FieldLabel className="flex h-8 min-w-0 items-center gap-2 text-[14px] font-medium leading-5 text-[var(--clair-color-atomic-neutral-500)]">
        <span aria-hidden="true" className="flex size-[15px] shrink-0 items-center justify-center text-[var(--clair-color-atomic-neutral-500)]">
          {getRegistrationFieldIcon(label, icon)}
        </span>
        <span className="inline-flex min-w-0 items-baseline gap-0.5">
          <span className="min-w-0 truncate">
            {label}
          </span>
          {required ? (
            <span aria-hidden="true" className="shrink-0 text-[var(--emr-text-danger)]">
              *
            </span>
          ) : null}
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
  onSearchAddress,
  postalCode,
  road,
  searchError,
  searchLoading,
}: {
  detail: ReactNode;
  onSearchAddress?: () => void;
  postalCode: ReactNode;
  road: ReactNode;
  searchError?: string;
  searchLoading?: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[minmax(0,175px)_81px] gap-3">
        {postalCode}
        <Button
          type="button"
          variant="outline"
          className="w-[81px]"
          disabled={searchLoading}
          onClick={onSearchAddress}
        >
          {searchLoading ? "검색 중" : "주소 검색"}
        </Button>
      </div>
      {road}
      {detail}
      {searchError ? (
        <div className="emr-text-metadata leading-4 text-[var(--emr-status-danger-text)]">
          {searchError}
        </div>
      ) : null}
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

export function EmrRegistrationCheckboxLabel({
  children,
  control,
}: {
  children: ReactNode;
  control: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-[50px] shrink-0 items-center justify-end gap-1.5 whitespace-nowrap emr-text-metadata font-semibold text-[var(--emr-text-secondary)]">
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
    <EmrRegistrationFieldRow error={error} label="전자 서명" required>
      <Button
        type="button"
        variant="outline"
        className="w-[122px]"
        disabled={signatureStatus === "completed"}
        onClick={handleClick}
      >
        {actionLabel}
      </Button>
    </EmrRegistrationFieldRow>
  );
}

export function EmrRegistrationSummaryItem({
  details,
  icon,
  title,
}: {
  details: ReactNode[];
  icon: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="flex h-[54px] min-w-0 items-center gap-[10px] rounded-[12px] border border-[var(--clair-color-atomic-neutral-100)] bg-[var(--clair-color-atomic-neutral-50)] p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center text-[var(--clair-color-atomic-sky-500)]">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 items-start gap-2 text-[14px] font-medium leading-5 tracking-[0.014em]">
          <span className="shrink-0 text-[var(--clair-color-atomic-neutral-800)]">
            {title}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1 text-[var(--clair-color-atomic-neutral-500)]">
          {details.map((detail, index) => (
            <span key={index} className="contents">
              {index > 0 ? (
                <span className="shrink-0">
                  ·
                </span>
              ) : null}
              <span className="min-w-0 truncate">
                {detail}
              </span>
            </span>
          ))}
          </span>
        </div>
      </div>
      <span className="flex h-5 w-[34px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--clair-color-atomic-sky-50)] px-1.5 py-0.5 text-[12px] font-medium leading-4 tracking-[0.025em] text-[var(--clair-color-atomic-sky-600)]">
        신규
      </span>
    </section>
  );
}
