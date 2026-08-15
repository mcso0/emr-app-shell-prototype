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
import companionIcon from "../../../icons/Illustration/companion.svg";
import memoNoteLinesIcon from "../../../icons/Illustration/memo-note-lines.svg";
import vitalHeartPulseIcon from "../../../icons/Illustration/vital-heart-pulse.svg";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsAlertsLockIcon } from "@/components/cds-icons/alerts-and-status";
import {
  CdsFilesFileTextIcon,
  CdsFilesMenuIcon,
  CdsFilesMoreHorizontalIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsGnbPayGnbIcon } from "@/components/cds-icons/gnb";
import { CdsMedicalPawPrintIcon } from "@/components/cds-icons/medical-and-domain";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
} from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { CdsUtilitiesHistoryIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrIconButton } from "@/components/emr/icon-button";
import {
  EmrPopoverOption,
  EmrPopoverOptionGroup,
  EmrPopoverShell,
} from "@/components/emr/popover-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  summary?: ReactNode;
  unavailableReason?: ReactNode;
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
  guardianItems?: PatientContextDatum[];
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
  typeof asset === "string" ? asset : (asset.src ?? "");

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
  guardianItems = [],
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
  const [memoPopoverOpen, setMemoPopoverOpen] = useState(false);
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
    <div
      data-slot="patient-context-bar"
      className={cn(
        "flex h-full min-h-[var(--emr-context-bar-min-height)] flex-col border-b border-[var(--emr-context-bar-divider)] bg-[var(--emr-surface-workspace)]",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 items-center pl-[var(--emr-context-bar-padding-x)] pr-[var(--clair-spacing-20)] py-[var(--emr-context-bar-padding-y)]">
        {historyButton ? (
          <div className="mr-[var(--emr-context-bar-section-gap)] flex shrink-0 items-center gap-[var(--emr-context-bar-section-gap)]">
            <Button
              variant="outline"
              size="xs"
              className="h-[var(--emr-context-bar-control-size)] rounded-[var(--emr-context-bar-button-radius)] bg-card data-[state=on]:border-[var(--emr-border-strong)] data-[state=on]:bg-[var(--emr-context-bar-chip-bg)] data-[state=on]:text-[var(--emr-text-primary)]"
              aria-expanded={historyButton.expanded}
              aria-pressed={historyButton.expanded}
              aria-controls={historyButton.controls}
              data-state={historyButton.expanded ? "on" : "off"}
              onClick={historyButton.onClick}
            >
              <CdsUtilitiesHistoryIcon data-icon="inline-start" />
              {historyButton.label ?? "이력"}
            </Button>
            <PatientContextDivider />
          </div>
        ) : null}

        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            className="flex min-w-0 items-center gap-[var(--emr-context-bar-section-gap)] overflow-x-auto overflow-y-hidden pr-[var(--clair-spacing-32)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="환자 컨텍스트 정보"
          >
            <PatientContextInfoSection
              dataSlot="patient-context-patient"
              hoverAction={<CdsNavigationChevronRightIcon />}
              iconSrc={getAssetSrc(animalDogIcon)}
            >
              <PatientContextInlineSummary items={patientItems} />
            </PatientContextInfoSection>

            {guardianItems.length ? (
              <>
                <PatientContextDivider />
                <PatientContextInfoSection
                  dataSlot="patient-context-guardian"
                  hoverAction={<CdsNavigationChevronRightIcon />}
                  iconSrc={getAssetSrc(companionIcon)}
                >
                  <PatientContextInlineSummary items={guardianItems} />
                </PatientContextInfoSection>
              </>
            ) : null}

            {vitalItems.length ? (
              <>
                <PatientContextDivider />
                <PatientContextInfoSection
                  dataSlot="patient-context-vitals"
                  hoverAction={<CdsActionsPlusIcon />}
                  iconSrc={getAssetSrc(vitalHeartPulseIcon)}
                >
                  <PatientContextDatumGroup items={vitalItems} />
                </PatientContextInfoSection>
              </>
            ) : null}

            {memoActions.length ? (
              <>
                <PatientContextDivider />
                <PatientContextMemoActions
                  actions={memoActions}
                  open={memoPopoverOpen}
                  onOpenChange={setMemoPopoverOpen}
                />
              </>
            ) : null}

            {trailingItems.length ? (
              <>
                <PatientContextDivider />
                <div className="flex shrink-0 items-center">
                  <PatientContextDatumGroup items={trailingItems} />
                </div>
              </>
            ) : null}
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-[var(--clair-spacing-32)] bg-gradient-to-r from-transparent to-[var(--emr-surface-workspace)] transition-opacity",
              scrollState.canScrollRight ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          />
        </div>

        <div className="flex shrink-0 items-center gap-[var(--clair-spacing-10)]">
          <div className="flex items-center gap-[var(--clair-spacing-8)]">
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
              <PatientContextDivider />
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
                  aria-label={
                    rightPanelOpen
                      ? "환자 사이드 패널 접기"
                      : "환자 사이드 패널 열기"
                  }
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
      className="emr-text-status relative h-[var(--emr-context-bar-control-size)] rounded-[var(--emr-context-bar-button-radius)] bg-card px-[var(--clair-spacing-8)] text-[var(--emr-text-secondary)] shadow-[var(--clair-shadow-xs)] data-[state=on]:border-[var(--emr-border-strong)] data-[state=on]:bg-[var(--emr-context-bar-chip-bg)] data-[state=on]:text-[var(--emr-text-primary)] disabled:bg-card disabled:text-[var(--emr-text-disabled)] disabled:opacity-100"
      aria-label={`${label} ${open ? "접기" : "열기"}`}
      aria-expanded={open}
      aria-pressed={open}
      data-state={open ? "on" : "off"}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? (
        <span
          data-icon="inline-start"
          className="flex size-3 items-center justify-center [&_svg]:size-3"
        >
          {icon}
        </span>
      ) : null}
      {label}
      {badgeCount ? (
        <span
          className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--emr-status-info-text)] px-1 text-[10px] font-semibold leading-none text-[var(--emr-text-inverse)]"
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
    <div className="flex items-center gap-[var(--emr-context-bar-item-gap)]">
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

function PatientContextDivider() {
  return (
    <div
      className="h-[var(--emr-context-bar-divider-height)] w-px shrink-0 bg-[var(--emr-context-bar-divider)]"
      aria-hidden="true"
    />
  );
}

function PatientContextInfoSection({
  children,
  dataSlot,
  hoverAction,
  iconSrc,
}: {
  children: ReactNode;
  dataSlot: string;
  hoverAction?: ReactNode;
  iconSrc: string;
}) {
  return (
    <div
      data-slot={dataSlot}
      className="group relative flex h-9 shrink-0 items-center gap-[var(--emr-context-bar-item-gap)] overflow-hidden rounded-[var(--emr-context-bar-button-radius)] p-[var(--clair-spacing-6)] hover:bg-[var(--emr-context-bar-hover-bg)]"
    >
      <IllustrationIcon
        src={iconSrc}
        alt=""
        className="group-hover:bg-[var(--emr-context-bar-hover-icon-bg)]"
      />
      {children}
      {hoverAction ? (
        <PatientContextHoverAction>{hoverAction}</PatientContextHoverAction>
      ) : null}
    </div>
  );
}

function PatientContextInlineSummary({
  items,
}: {
  items: PatientContextDatum[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--clair-spacing-2)] pr-[var(--clair-spacing-4)] font-medium whitespace-nowrap">
      {items.map((item, index) => (
        <span
          key={`${String(item.label)}-${String(item.value)}-${index}`}
          className="contents"
        >
          {index ? (
            <span
              className="emr-text-body text-[var(--emr-text-tertiary)]"
              aria-hidden="true"
            >
              ·
            </span>
          ) : null}
          <span className="emr-text-dense text-[var(--emr-text-primary)]">
            <span className="sr-only">{item.label}: </span>
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function PatientContextDatumBadge({ label, value }: PatientContextDatum) {
  return (
    <Badge
      variant="secondary"
      className="emr-text-metadata h-[var(--emr-context-bar-chip-height)] shrink-0 gap-[var(--clair-spacing-2)] rounded-[var(--emr-context-bar-chip-radius)] border-transparent bg-[var(--emr-context-bar-chip-bg)] px-[var(--clair-spacing-8)] py-[3px] font-medium"
    >
      <span className="text-[var(--emr-context-bar-chip-label)]">{label}</span>
      <span className="text-[var(--emr-context-bar-chip-value)]">{value}</span>
    </Badge>
  );
}

function PatientContextMemoActions({
  actions,
  onOpenChange,
  open,
}: {
  actions: PatientContextMemoAction[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [firstAction, ...remainingActions] = actions;

  if (!firstAction) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        data-slot="patient-context-memos"
        className="group relative flex h-9 shrink-0 items-center gap-[var(--emr-context-bar-item-gap)] overflow-hidden rounded-[var(--emr-context-bar-button-radius)] p-[var(--clair-spacing-6)] hover:bg-[var(--emr-context-bar-hover-bg)] focus-within:bg-[var(--emr-context-bar-hover-bg)]"
      >
        <IllustrationIcon
          src={getAssetSrc(memoNoteLinesIcon)}
          alt=""
          className="group-hover:bg-[var(--emr-context-bar-hover-icon-bg)] group-focus-within:bg-[var(--emr-context-bar-hover-icon-bg)]"
        />
        <div className="flex items-center gap-[var(--clair-spacing-6)]">
          <PopoverTrigger
            render={
              <PatientContextMemoInlineButton action={firstAction} index={0} />
            }
          />
          {remainingActions.map((action, index) => (
            <PatientContextMemoInlineButton
              key={`${String(action.label)}-${index + 1}`}
              action={action}
              index={index + 1}
              onClick={() => onOpenChange(true)}
            />
          ))}
        </div>
        <PatientContextHoverAction>
          <CdsFilesMoreHorizontalIcon />
        </PatientContextHoverAction>
      </div>
      <PatientMemoPopover
        actions={actions}
        onClose={() => onOpenChange(false)}
      />
    </Popover>
  );
}

function PatientContextHoverAction({ children }: { children: ReactNode }) {
  return (
    <span
      data-slot="patient-context-hover-action"
      className="pointer-events-none absolute right-0 top-1/2 flex h-[var(--emr-context-bar-control-size)] -translate-y-1/2 items-center bg-[linear-gradient(to_right,transparent,var(--emr-context-bar-hover-bg)_var(--clair-spacing-8))] pl-[var(--clair-spacing-16)] pr-[var(--clair-spacing-6)] text-[var(--emr-text-secondary)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [&_svg]:size-[var(--emr-context-bar-hover-action-icon-size)]"
      aria-hidden="true"
    >
      <span className="flex size-[var(--emr-context-bar-control-size)] items-center justify-center rounded-[var(--emr-context-bar-control-radius)]">
        {children}
      </span>
    </span>
  );
}

function PatientContextMemoInlineButton({
  action,
  index,
  onClick,
}: {
  action: PatientContextMemoAction;
  index: number;
  onClick?: () => void;
}) {
  const title =
    typeof action.summary === "string"
      ? action.summary
      : typeof action.unavailableReason === "string"
        ? action.unavailableReason
        : undefined;

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="emr-text-metadata h-[var(--emr-context-bar-control-size)] gap-[var(--clair-spacing-4)] rounded-[var(--emr-context-bar-button-radius)] bg-card px-[var(--clair-spacing-8)] text-[var(--emr-context-bar-chip-value)] shadow-[var(--clair-shadow-xs)] disabled:bg-card disabled:text-[var(--emr-text-disabled)] disabled:opacity-50 [&_svg]:size-[var(--emr-context-bar-inline-icon-size)]"
      aria-label={`${String(action.label)} 메모 보기`}
      disabled={action.disabled}
      title={title}
      onClick={onClick}
    >
      <PatientContextMemoActionIcon index={index} />
      {action.label}
    </Button>
  );
}

function PatientContextMemoActionIcon({ index }: { index: number }) {
  if (index === 1) return <CdsPeopleUserIcon aria-hidden="true" />;
  if (index === 2) return <CdsMedicalPawPrintIcon aria-hidden="true" />;
  if (index === 3) return <CdsGnbPayGnbIcon aria-hidden="true" />;

  return <CdsFilesFileTextIcon aria-hidden="true" />;
}

function PatientMemoPopover({
  actions,
  onClose,
}: {
  actions: PatientContextMemoAction[];
  onClose: () => void;
}) {
  return (
    <EmrPopoverShell
      align="start"
      width="lg"
      title="메모"
      meta="환자 인포바"
      description="방문, 보호자, 환자, 수납 메모를 환자 맥락에서 빠르게 확인합니다."
      onClose={onClose}
    >
      <EmrPopoverOptionGroup selectionMode="none" closeOnSelect={false}>
        {actions.map((action, index) => {
          const disabled = action.disabled || action.locked || !action.onClick;
          const description =
            action.summary ??
            action.unavailableReason ??
            (action.locked
              ? "권한 또는 업무 단계상 현재 화면에서 바로 열 수 없습니다."
              : action.disabled
                ? "현재 환자 맥락에서는 사용할 수 없는 메모입니다."
                : !action.onClick
                  ? "현재 화면에서는 빠른 조회 상태만 표시합니다."
                  : undefined);
          const meta = action.locked
            ? "잠김"
            : action.disabled
              ? "비활성"
              : action.onClick
                ? "열기"
                : "조회";

          return (
            <EmrPopoverOption
              key={`${String(action.label)}-${index}`}
              disabled={disabled}
              title={
                <span className="inline-flex min-w-0 items-center gap-1">
                  <span className="truncate">{action.label}</span>
                  {action.locked ? (
                    <CdsAlertsLockIcon
                      className="size-[var(--emr-context-bar-inline-icon-size)] text-[var(--emr-text-tertiary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
              }
              description={description}
              meta={meta}
              onSelect={() => {
                action.onClick?.();
                onClose();
              }}
            />
          );
        })}
      </EmrPopoverOptionGroup>
    </EmrPopoverShell>
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
        "size-[var(--emr-context-bar-control-size)] rounded-[var(--emr-context-bar-control-radius)] border border-[var(--emr-context-bar-divider)] bg-card text-[var(--emr-text-secondary)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--emr-state-hover)] disabled:border-[var(--emr-context-bar-divider)] disabled:bg-card disabled:text-[var(--emr-text-disabled)] disabled:opacity-50",
        className,
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
    <span
      className={cn(
        "flex size-[var(--emr-context-bar-icon-size)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--emr-context-bar-chip-radius)] bg-[var(--emr-context-bar-chip-bg)]",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={16}
        height={16}
        unoptimized
        aria-hidden={alt ? undefined : true}
        className="size-4 object-contain"
        draggable={false}
      />
    </span>
  );
}
