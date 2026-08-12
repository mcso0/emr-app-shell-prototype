"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import animalDogIcon from "../../../../icons/Illustration/animal-dog.svg";
import vitalHeartPulseIcon from "../../../../icons/Illustration/vital-heart-pulse.svg";
import { CdsFilesFileTextIcon } from "@/components/cds-icons/files-and-layout";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
  CdsNavigationMaximize2Icon,
} from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import {
  CdsMedicalBedIcon,
  CdsMedicalHeartPulseIcon,
  CdsMedicalMessagesSquareIcon,
} from "@/components/cds-icons/medical-and-domain";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ChartPatientVitalItem = {
  label: string;
  value: string;
};

type ChartPatientMemoItem = {
  disabled?: boolean;
  label: string;
  summary: string;
};

type ChartPatientContextBarProps = {
  doctorName: string;
  guardianName: string;
  guardianPhone: string;
  memoItems: ChartPatientMemoItem[];
  patientMeta: string;
  patientName: string;
  vitalItems: ChartPatientVitalItem[];
};

type ScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

const getAssetSrc = (asset: string | { src?: string }) =>
  typeof asset === "string" ? asset : asset.src ?? "";

function getScrollState(element: HTMLDivElement | null): ScrollState {
  if (!element) return { canScrollLeft: false, canScrollRight: false };

  const maxScrollLeft = element.scrollWidth - element.clientWidth;
  return {
    canScrollLeft: element.scrollLeft > 2,
    canScrollRight: element.scrollLeft < maxScrollLeft - 2,
  };
}

export function ChartPatientContextBar({
  doctorName,
  guardianName,
  guardianPhone,
  memoItems,
  patientMeta,
  patientName,
  vitalItems,
}: ChartPatientContextBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const updateScrollState = useCallback(() => {
    setScrollState(getScrollState(scrollRef.current));
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const scrollByViewport = (direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      left: direction * Math.max(240, element.clientWidth * 0.42),
    });
  };

  return (
    <div
      data-slot="chart-patient-context-bar"
      className="flex h-14 min-h-14 w-full items-center border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-workspace)] px-2 py-2"
    >
      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          aria-label="환자 컨텍스트 정보"
          className="flex min-w-0 items-center overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ContextSection className="min-w-[235px]">
            <ContextIllustration src={getAssetSrc(animalDogIcon)} />
            <ContextText primary={patientName} secondary={patientMeta} inline />
          </ContextSection>
          <ContextDivider />
          <ContextSection className="min-w-[210px]">
            <ContextIcon>
              <CdsPeopleUserIcon />
            </ContextIcon>
            <ContextText primary={guardianName} secondary={guardianPhone} inline />
          </ContextSection>
          <ContextDivider />
          <ContextSection className="min-w-[365px]">
            <ContextIllustration src={getAssetSrc(vitalHeartPulseIcon)} />
            <div className="flex items-center gap-1.5">
              {vitalItems.map((item) => (
                <span
                  key={`${item.label}-${item.value}`}
                  className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-md bg-[var(--clair-color-atomic-black-alpha-4)] px-2 text-xs font-medium leading-4 text-[var(--emr-text-primary)]"
                >
                  <span className="text-[var(--emr-text-tertiary)]">
                    {item.label}
                  </span>
                  <span>{item.value}</span>
                </span>
              ))}
            </div>
          </ContextSection>
          <ContextDivider />
          <ContextSection className="min-w-[170px]">
            <ContextIcon>
              <CdsMedicalHeartPulseIcon />
            </ContextIcon>
            <ContextText primary="주치의" secondary={doctorName} inline />
          </ContextSection>
          <ContextDivider />
          <ContextSection className="min-w-[350px] gap-1 pr-2">
            {memoItems.map((item, index) => (
              <PatientMemoButton key={`${item.label}-${index}`} item={item} />
            ))}
          </ContextSection>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--emr-surface-workspace)] to-transparent transition-opacity",
            scrollState.canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--emr-surface-workspace)] to-transparent transition-opacity",
            scrollState.canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <ContextScrollButton
          label="환자 정보 이전 항목으로 이동"
          disabled={!scrollState.canScrollLeft}
          onClick={() => scrollByViewport(-1)}
        >
          <CdsNavigationChevronLeftIcon />
        </ContextScrollButton>
        <ContextScrollButton
          label="환자 정보 다음 항목으로 이동"
          disabled={!scrollState.canScrollRight}
          onClick={() => scrollByViewport(1)}
        >
          <CdsNavigationChevronRightIcon />
        </ContextScrollButton>
      </div>
    </div>
  );
}

function ContextSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 px-3 first:pl-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ContextDivider() {
  return (
    <div className="h-5 w-px shrink-0 bg-[var(--emr-border-default)]" />
  );
}

function ContextIllustration({ src }: { src: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--clair-color-atomic-blue-50)]">
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={18}
        height={18}
        unoptimized
        className="size-[18px] object-contain"
        draggable={false}
      />
    </span>
  );
}

function ContextIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--clair-color-atomic-blue-50)] text-[var(--clair-color-atomic-blue-600)] [&_svg]:size-4">
      {children}
    </span>
  );
}

function ContextText({
  inline = false,
  primary,
  secondary,
}: {
  inline?: boolean;
  primary: string;
  secondary: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 text-[13px] font-medium leading-[18px]",
        inline ? "flex items-center gap-2" : "grid",
      )}
    >
      <span className="truncate text-[var(--emr-text-primary)]">{primary}</span>
      <span className="truncate text-[var(--emr-text-secondary)]">
        {secondary}
      </span>
    </span>
  );
}

function PatientMemoButton({ item }: { item: ChartPatientMemoItem }) {
  const icon =
    item.label === "보호자메모" ? (
      <CdsPeopleUserIcon />
    ) : item.label === "환자메모" ? (
      <Image
        src={getAssetSrc(animalDogIcon)}
        alt=""
        aria-hidden="true"
        width={14}
        height={14}
        unoptimized
        className="size-3.5"
      />
    ) : (
      <CdsFilesFileTextIcon />
    );

  if (item.disabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="inline-flex cursor-not-allowed"
              tabIndex={0}
              aria-label={`${item.label} 준비 중`}
            />
          }
        >
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-7 rounded-lg bg-card px-2 text-xs opacity-50"
            tabIndex={-1}
            disabled
          >
            <span data-icon="inline-start" className="[&_svg]:size-3.5">
              {icon}
            </span>
            {item.label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">준비 중 · {item.summary}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-7 rounded-lg bg-card px-2 text-xs"
          />
        }
      >
        <span data-icon="inline-start" className="[&_svg]:size-3.5">
          {icon}
        </span>
        {item.label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="text-sm font-semibold text-foreground">{item.label}</div>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
          {item.summary}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function ContextScrollButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className="size-6 rounded-md bg-card [&_svg]:size-3.5"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ChartWorkspacePanel({
  actions,
  children,
  className,
  title,
  toolbar,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]",
        className,
      )}
    >
      <div className="flex h-[38px] min-h-[38px] shrink-0 items-center justify-between gap-3 px-3">
        <h2 className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
      {toolbar ? (
        <div className="flex h-11 min-h-11 shrink-0 items-center overflow-x-auto border-b border-[var(--emr-line-hairline)] px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {toolbar}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function ChartActionBar({
  chartDate,
  completionAction,
  doctorName,
  encounterNo,
  pendingIndicator,
  startTime,
  visitLabel,
}: {
  chartDate: string;
  completionAction?: ReactNode;
  doctorName: string;
  encounterNo: string;
  pendingIndicator?: ReactNode;
  startTime: string;
  visitLabel: string;
}) {
  return (
    <div
      data-slot="chart-action-bar"
      className="flex h-12 min-h-12 shrink-0 items-center justify-between gap-4 overflow-x-auto border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-workspace)] px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max items-center gap-2">
        <span
          className="inline-flex size-6 items-center justify-center rounded-md border border-input bg-card"
          aria-hidden="true"
        >
          <span className="text-[11px] font-semibold">◴</span>
        </span>
        <h1 className="whitespace-nowrap text-base font-semibold leading-6 text-foreground">
          차트 <span className="text-muted-foreground">{chartDate}</span>
        </h1>
        <Badge
          variant="secondary"
          className="h-[22px] rounded-md px-2 text-xs font-medium"
        >
          {visitLabel}
        </Badge>
        <Badge
          variant="outline"
          className="h-[22px] max-w-40 truncate rounded-md border-dashed px-2 text-xs font-medium text-muted-foreground"
        >
          {encounterNo}
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pendingIndicator}
        <span className="whitespace-nowrap text-[13px] font-medium leading-[18px] text-[var(--emr-text-secondary)]">
          진료 시작 {startTime}
        </span>
        <span
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-input bg-card px-2 text-xs font-medium"
        >
          <CdsPeopleUserIcon className="size-3.5" aria-hidden="true" />
          {doctorName}
        </span>
        <div className="mx-1 h-5 w-px bg-[var(--emr-line-hairline)]" />
        <UnavailableActionButton
          icon={<CdsMedicalBedIcon />}
          label="입원 수속"
        />
        <UnavailableActionButton
          icon={<CdsMedicalMessagesSquareIcon />}
          label="케어가이드 발송"
        />
        {completionAction}
      </div>
    </div>
  );
}

function UnavailableActionButton({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex cursor-not-allowed" tabIndex={0} />}
      >
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 rounded-lg bg-card px-2 text-xs disabled:opacity-50"
          disabled
        >
          <span data-icon="inline-start" className="[&_svg]:size-3.5">
            {icon}
          </span>
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">준비 중 · 업무 흐름 연결 후 제공됩니다.</TooltipContent>
    </Tooltip>
  );
}

export function ChartPanelIconButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children?: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="inline-flex cursor-not-allowed"
              tabIndex={0}
              aria-label={label}
            />
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 rounded-md text-[var(--emr-text-secondary)] opacity-50 [&_svg]:size-3.5"
            tabIndex={-1}
            disabled
          >
            {children ?? <CdsNavigationMaximize2Icon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 rounded-md text-[var(--emr-text-secondary)] [&_svg]:size-3.5"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children ?? <CdsNavigationMaximize2Icon />}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ChartPanelActions({
  onMore,
}: {
  onMore?: () => void;
}) {
  return (
    <>
      <ChartPanelIconButton label="패널 확대 준비 중" disabled />
      <ChartPanelIconButton
        label={onMore ? "더보기" : "더보기 준비 중"}
        disabled={!onMore}
        onClick={onMore}
      >
        <CdsFilesMoreHorizontalIcon />
      </ChartPanelIconButton>
    </>
  );
}
