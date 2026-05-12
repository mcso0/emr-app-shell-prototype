"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import Image from "next/image";
import animalDogIcon from "../../../icons/Illustration/animal-dog.svg";
import memoNoteLinesIcon from "../../../icons/Illustration/memo-note-lines.svg";
import vitalHeartPulseIcon from "../../../icons/Illustration/vital-heart-pulse.svg";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsAlertsLockIcon } from "@/components/cds-icons/alerts-and-status";
import { CdsFilesMenuIcon } from "@/components/cds-icons/files-and-layout";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
} from "@/components/cds-icons/navigation";
import { CdsUtilitiesHistoryIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrIconButton } from "@/components/emr/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PatientContextDatum = {
  label: ReactNode;
  value: ReactNode;
};

type PatientContextMemoAction = {
  disabled?: boolean;
  label: ReactNode;
  locked?: boolean;
  onClick?: () => void;
};

type PatientContextBarProps = {
  className?: string;
  historyButton?: {
    controls?: string;
    expanded?: boolean;
    label?: ReactNode;
    onClick?: () => void;
  };
  memoActions?: PatientContextMemoAction[];
  onToggleRightPanel?: () => void;
  patientItems: PatientContextDatum[];
  rightPanelBadgeCount?: number;
  rightPanelDisabled?: boolean;
  rightPanelToggleIcon?: ReactNode;
  rightPanelToggleLabel?: string;
  rightPanelToggleTooltipLabel?: ReactNode;
  rightPanelOpen?: boolean;
  trailingItems?: PatientContextDatum[];
  vitalItems?: PatientContextDatum[];
};

type ScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

const SCROLL_EDGE_TOLERANCE = 2;
const getAssetSrc = (asset: string | { src?: string }) =>
  typeof asset === "string" ? asset : asset.src ?? "";

function getScrollState(element: HTMLDivElement | null): ScrollState {
  if (!element) {
    return {
      canScrollLeft: false,
      canScrollRight: false,
    };
  }

  const maxScrollLeft = element.scrollWidth - element.clientWidth;

  return {
    canScrollLeft: element.scrollLeft > SCROLL_EDGE_TOLERANCE,
    canScrollRight: element.scrollLeft < maxScrollLeft - SCROLL_EDGE_TOLERANCE,
  };
}

export function EmrPatientContextBar({
  className,
  historyButton,
  memoActions = [],
  onToggleRightPanel,
  patientItems,
  rightPanelBadgeCount,
  rightPanelDisabled = false,
  rightPanelToggleIcon,
  rightPanelToggleLabel,
  rightPanelToggleTooltipLabel,
  rightPanelOpen = false,
  trailingItems = [],
  vitalItems = [],
}: PatientContextBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState<ScrollState>(() => ({
    canScrollLeft: false,
    canScrollRight: false,
  }));
  const updateScrollState = useCallback(() => {
    setScrollState(getScrollState(scrollRef.current));
  }, []);
  const scrollToEdge = useCallback((edge: "start" | "end") => {
    const element = scrollRef.current;

    if (!element) return;

    element.scrollTo({
      left: edge === "start" ? 0 : element.scrollWidth - element.clientWidth,
      behavior: "smooth",
    });
  }, []);
  const shouldShowRightPanelToggle = Boolean(onToggleRightPanel);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) return;

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  return (
    <div className={cn("border-b border-[var(--clair-color-atomic-gray-300)] bg-card", className)}>
      <div className="flex h-12 items-center gap-3 px-4">
        {historyButton ? (
          <>
            <Button
              variant="outline"
              size="xs"
              className="h-[26px] bg-card aria-expanded:border-ring aria-expanded:bg-background aria-expanded:ring-3 aria-expanded:ring-ring/50"
              aria-expanded={historyButton.expanded}
              aria-controls={historyButton.controls}
              onClick={historyButton.onClick}
            >
              <CdsUtilitiesHistoryIcon data-icon="inline-start" />
              {historyButton.label ?? "이력"}
            </Button>
            <div className="h-[18px] w-px shrink-0 bg-border" />
          </>
        ) : null}

        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            className="flex min-w-0 items-center gap-3 overflow-x-auto overflow-y-hidden pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="환자 컨텍스트 정보"
          >
            <div className="flex shrink-0 items-center gap-1.5">
              <IllustrationIcon src={getAssetSrc(animalDogIcon)} alt="" />
              <PatientContextDatumGroup items={patientItems} />
            </div>

            {vitalItems.length ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <IllustrationIcon src={getAssetSrc(vitalHeartPulseIcon)} alt="" />
                <PatientContextDatumGroup items={vitalItems} />
                <EmrIconButton
                  type="button"
                  aria-label="바이탈 입력"
                  className="size-[26px] bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-label-alternative)] hover:bg-[var(--clair-color-background-subtle)]"
                >
                  <CdsActionsPlusIcon />
                </EmrIconButton>
              </div>
            ) : null}

            {memoActions.length ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <IllustrationIcon src={getAssetSrc(memoNoteLinesIcon)} alt="" />
                <div className="flex items-center gap-1">
                  {memoActions.map((action, index) => (
                    <PatientContextMemoButton
                      key={`${String(action.label)}-${index}`}
                      action={action}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {trailingItems.length ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <PatientContextDatumGroup items={trailingItems} />
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-r from-transparent to-card transition-opacity",
              scrollState.canScrollRight ? "opacity-100" : "opacity-0"
            )}
            aria-hidden="true"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <PatientContextControlButton
              aria-label="환자 정보 처음으로 이동"
              disabled={!scrollState.canScrollLeft}
              onClick={() => scrollToEdge("start")}
            >
              <CdsNavigationChevronLeftIcon />
            </PatientContextControlButton>
            <PatientContextControlButton
              aria-label="환자 정보 끝으로 이동"
              disabled={!scrollState.canScrollRight}
              onClick={() => scrollToEdge("end")}
            >
              <CdsNavigationChevronRightIcon />
            </PatientContextControlButton>
          </div>
          {shouldShowRightPanelToggle ? (
            <>
              <div className="h-[18px] w-px shrink-0 bg-border" />
              {rightPanelToggleLabel ? (
                <RightPanelToggleButton
                  badgeCount={rightPanelBadgeCount}
                  disabled={rightPanelDisabled}
                  icon={rightPanelToggleIcon}
                  label={rightPanelToggleLabel}
                  open={rightPanelOpen}
                  tooltipLabel={rightPanelToggleTooltipLabel}
                  onClick={onToggleRightPanel}
                />
              ) : (
                <PatientContextControlButton
                  aria-label={rightPanelOpen ? "환자 사이드 패널 접기" : "환자 사이드 패널 열기"}
                  disabled={rightPanelDisabled}
                  onClick={onToggleRightPanel}
                >
                  <CdsFilesMenuIcon />
                </PatientContextControlButton>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RightPanelToggleButton({
  badgeCount,
  disabled,
  icon,
  label,
  onClick,
  open,
  tooltipLabel,
}: {
  badgeCount?: number;
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  onClick?: () => void;
  open: boolean;
  tooltipLabel?: ReactNode;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="relative h-6 rounded-[var(--clair-radius-atomic-4)] bg-card px-2 text-[12px] leading-4 tracking-[0.025em] text-[var(--clair-color-label-normal)] disabled:bg-card disabled:text-[var(--clair-color-label-assistive)] disabled:opacity-100"
      aria-label={`${label} ${open ? "접기" : "열기"}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? (
        <span data-icon="inline-start" className="flex size-3 items-center justify-center [&_svg]:size-3">
          {icon}
        </span>
      ) : null}
      {label}
      {badgeCount ? (
        <span
          className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--clair-color-atomic-blue-500)] px-1 text-[10px] font-semibold leading-none text-white"
          aria-label={`새 장비결과 ${badgeCount}건`}
        >
          {badgeCount}
        </span>
      ) : null}
    </Button>
  );

  if (!tooltipLabel) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}

function PatientContextDatumGroup({ items }: { items: PatientContextDatum[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {items.map((item, index) => (
        <PatientContextDatumBadge
          key={`${String(item.label)}-${String(item.value)}-${index}`}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
}

function PatientContextDatumBadge({ label, value }: PatientContextDatum) {
  return (
    <Badge
      variant="secondary"
      className="h-[22px] shrink-0 gap-1 rounded-[var(--clair-radius-atomic-6)] border-transparent bg-[var(--clair-color-atomic-gray-50)] px-2 py-0.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]"
    >
      <span className="text-[var(--clair-color-atomic-gray-500)]">{label}</span>
      <span className="text-[var(--clair-color-atomic-gray-700)]">{value}</span>
    </Badge>
  );
}

function PatientContextMemoButton({ action }: { action: PatientContextMemoAction }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="h-[22px] rounded-[var(--clair-radius-atomic-6)] bg-card px-2 text-[12px] leading-4 tracking-[0.025em] text-[var(--clair-color-label-normal)] disabled:bg-[var(--clair-color-atomic-gray-50)]"
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
      {action.locked ? (
        <CdsAlertsLockIcon
          className="ml-0.5 size-3 text-[var(--clair-color-label-assistive)]"
          aria-hidden="true"
        />
      ) : null}
    </Button>
  );
}

function PatientContextControlButton({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof EmrIconButton>, "iconSize">) {
  return (
    <EmrIconButton
      type="button"
      iconSize="md"
      className={cn(
        "size-6 rounded-[var(--clair-radius-atomic-4)] border border-[var(--clair-color-line-normal)] bg-card text-[var(--clair-color-label-normal)] hover:bg-[var(--clair-color-background-surface)] disabled:border-[var(--clair-color-line-normal)] disabled:bg-card disabled:text-[var(--clair-color-label-assistive)] disabled:opacity-100",
        className
      )}
      {...props}
    >
      {children}
    </EmrIconButton>
  );
}

function IllustrationIcon({
  alt,
  className,
  src,
}: {
  alt: string;
  className?: string;
  src: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={20}
      height={20}
      unoptimized
      aria-hidden={alt ? undefined : true}
      className={cn("size-5 shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
