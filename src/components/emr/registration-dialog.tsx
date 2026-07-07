"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
        <FieldLegend className="flex h-6 items-center emr-text-dense font-bold text-[var(--emr-text-tertiary)]">
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
  label,
  labelWidth = "default",
  required,
}: {
  children: ReactNode;
  className?: string;
  controlClassName?: string;
  error?: string;
  label: ReactNode;
  labelWidth?: "default" | "narrow";
  required?: boolean;
}) {
  return (
    <FormField
      className={cn(
        "grid min-h-8 items-start gap-3",
        labelWidth === "narrow"
          ? "grid-cols-[108px_minmax(0,1fr)]"
          : "grid-cols-[128px_minmax(0,1fr)]",
        className
      )}
      data-invalid={Boolean(error) || undefined}
    >
      <FieldLabel className="flex h-8 min-w-0 items-center gap-2 emr-text-dense font-bold text-foreground">
        <span
          aria-hidden="true"
          className="size-[15px] shrink-0 rounded-[5px] border border-input bg-card"
        />
        <span className="min-w-0 truncate">
          {label}
          {required ? <span className="ml-0.5 text-[var(--emr-text-danger)]">*</span> : null}
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
    <div className="grid gap-2">
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
  marketingConsent,
  privacyConsent,
  signatureStatus,
  onCompleteSignature,
  onMarketingConsentChange,
  onRequestSignature,
}: {
  error?: string;
  marketingConsent: boolean;
  privacyConsent: boolean;
  signatureStatus: EmrRegistrationSignatureStatus;
  onCompleteSignature: () => void;
  onMarketingConsentChange: (checked: boolean) => void;
  onRequestSignature: () => void;
}) {
  const statusLabel =
    signatureStatus === "completed" ? "서명 완료" : signatureStatus === "pending" ? "서명 대기" : "미요청";

  return (
    <div data-invalid={Boolean(error) || undefined}>
      <div className="grid rounded-lg border border-[var(--emr-line-hairline)] bg-card p-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-bold leading-4 text-foreground">전자서명</div>
            <div className="mt-0.5 text-[11px] font-medium leading-[15px] text-[var(--emr-text-tertiary)]">
              개인정보 수집 동의는 태블릿 서명 완료 후 등록할 수 있습니다.
            </div>
          </div>
          <Badge
            variant={signatureStatus === "completed" ? "default" : "outline"}
            className="h-5 shrink-0 rounded-full bg-card px-2 text-[11px] font-bold"
          >
            {statusLabel}
          </Badge>
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {signatureStatus !== "completed" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[var(--clair-control-height-md)] px-2 text-[12px] font-bold"
              onClick={onRequestSignature}
            >
              태블릿 서명 요청
            </Button>
          ) : null}
          {signatureStatus === "pending" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-[var(--clair-control-height-md)] px-2 text-[12px] font-bold"
              onClick={onCompleteSignature}
            >
              서명 완료 처리
            </Button>
          ) : null}
          <label className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-4 text-[var(--emr-text-secondary)]">
            <Checkbox checked={privacyConsent} disabled />
            <span className="whitespace-nowrap">개인정보 수집 동의</span>
          </label>
          <label className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-4 text-[var(--emr-text-secondary)]">
            <Checkbox
              checked={marketingConsent}
              onCheckedChange={(checked) => onMarketingConsentChange(Boolean(checked))}
            />
            <span className="whitespace-nowrap">마케팅 수신 동의</span>
          </label>
        </div>
      </div>
      {error ? <FieldError className="mt-1 emr-text-metadata leading-4">{error}</FieldError> : null}
    </div>
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
