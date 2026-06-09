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
import {
  EmrPopoverFieldRow,
  EmrPopoverOption,
  EmrPopoverOptionGroup,
  EmrPopoverShell,
} from "@/components/emr/popover-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
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

type VitalDraftState = {
  key: string;
  values: string[];
};

const SCROLL_EDGE_TOLERANCE = 2;
const getAssetSrc = (asset: string | { src?: string }) =>
  typeof asset === "string" ? asset : asset.src ?? "";

function getNodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

function getVitalUnit(label: ReactNode, value: ReactNode): string {
  const labelText = getNodeText(label);
  const valueText = getNodeText(value);
  const suffix = valueText.match(/(kg|°C|bpm|rpm|mmHg)$/)?.[1];

  if (suffix) return suffix;
  if (labelText.includes("체중")) return "kg";
  if (labelText.includes("체온")) return "°C";
  if (labelText.includes("심박")) return "bpm";
  if (labelText.includes("호흡")) return "rpm";
  if (labelText.includes("혈압")) return "mmHg";

  return "";
}

function getVitalInputValue(value: ReactNode, unit: string): string {
  const text = getNodeText(value);

  if (!unit) return text;

  return text.replace(new RegExp(`\\s*${unit}$`), "");
}

function getVitalDraft(items: PatientContextDatum[]) {
  return items.map((item) => getVitalInputValue(item.value, getVitalUnit(item.label, item.value)));
}

function getVitalItemsKey(items: PatientContextDatum[]) {
  return items
    .map((item) => `${getNodeText(item.label)}=${getNodeText(item.value)}`)
    .join("|");
}

function applyVitalDraft(items: PatientContextDatum[], draft: string[]) {
  return items.map((item, index) => {
    const unit = getVitalUnit(item.label, item.value);
    const value = draft[index]?.trim() ?? "";

    return {
      ...item,
      value: unit && value ? `${value} ${unit}` : value,
    };
  });
}

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
  const [vitalPopoverOpen, setVitalPopoverOpen] = useState(false);
  const [memoPopoverOpen, setMemoPopoverOpen] = useState(false);
  const [savedVitalDraft, setSavedVitalDraft] =
    useState<VitalDraftState | null>(null);
  const [editingVitalDraft, setEditingVitalDraft] =
    useState<VitalDraftState | null>(null);
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
  const vitalItemsKey = getVitalItemsKey(vitalItems);
  const committedVitalDraft =
    savedVitalDraft?.key === vitalItemsKey
      ? savedVitalDraft.values
      : getVitalDraft(vitalItems);
  const vitalDraft =
    editingVitalDraft?.key === vitalItemsKey
      ? editingVitalDraft.values
      : committedVitalDraft;
  const displayedVitalItems = applyVitalDraft(vitalItems, committedVitalDraft);

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
      className={cn("border-b border-[var(--emr-context-bar-divider)] bg-[var(--emr-surface-workspace)]", className)}
    >
      <div className="flex min-h-[var(--emr-context-bar-min-height)] items-center gap-[var(--emr-context-bar-section-gap)] px-[var(--emr-context-bar-padding-x)] py-[var(--emr-context-bar-padding-y)]">
        {historyButton ? (
          <>
            <Button
              variant="outline"
              size="xs"
              className="h-[var(--emr-context-bar-control-size)] rounded-[var(--emr-context-bar-button-radius)] bg-card data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--clair-color-atomic-black-alpha-4)] data-[state=on]:text-[var(--emr-text-primary)]"
              aria-expanded={historyButton.expanded}
              aria-pressed={historyButton.expanded}
              aria-controls={historyButton.controls}
              data-state={historyButton.expanded ? "on" : "off"}
              onClick={historyButton.onClick}
            >
              <CdsUtilitiesHistoryIcon data-icon="inline-start" />
              {historyButton.label ?? "이력"}
            </Button>
            <div className="h-[var(--emr-context-bar-divider-height)] w-px shrink-0 bg-[var(--emr-context-bar-divider)]" />
          </>
        ) : null}

        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            className="flex min-w-0 items-center gap-[var(--emr-context-bar-section-gap)] overflow-x-auto overflow-y-hidden pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="환자 컨텍스트 정보"
          >
            <div className="flex shrink-0 items-center gap-[var(--emr-context-bar-item-gap)]">
              <IllustrationIcon src={getAssetSrc(animalDogIcon)} alt="" />
              <PatientContextDatumGroup items={patientItems} />
            </div>

            {displayedVitalItems.length ? (
              <div className="flex shrink-0 items-center gap-[var(--emr-context-bar-item-gap)]">
                <IllustrationIcon src={getAssetSrc(vitalHeartPulseIcon)} alt="" />
                <PatientContextDatumGroup items={displayedVitalItems} />
                <Popover
                  open={vitalPopoverOpen}
                  onOpenChange={(open) => {
                    if (open) {
                      setEditingVitalDraft({
                        key: vitalItemsKey,
                        values: committedVitalDraft,
                      });
                    }

                    setVitalPopoverOpen(open);
                  }}
                >
                  <PopoverTrigger
                    render={
                      <EmrIconButton
                        type="button"
                        aria-label="바이탈 입력"
                        aria-expanded={vitalPopoverOpen}
                        className="size-[26px] rounded-[var(--emr-context-bar-chip-radius)] bg-[var(--emr-context-bar-control-muted-bg)] text-[var(--emr-text-tertiary)] hover:bg-[var(--emr-state-hover)]"
                      >
                        <CdsActionsPlusIcon />
                      </EmrIconButton>
                    }
                  />
                  <PatientVitalPopover
                    draft={vitalDraft}
                    vitalItems={displayedVitalItems}
                    onCancel={() => {
                      setEditingVitalDraft(null);
                      setVitalPopoverOpen(false);
                    }}
                    onDraftChange={(index, value) => {
                      setEditingVitalDraft((current) => {
                        const currentValues =
                          current?.key === vitalItemsKey
                            ? current.values
                            : committedVitalDraft;
                        const next = [...currentValues];
                        next[index] = value;

                        return {
                          key: vitalItemsKey,
                          values: next,
                        };
                      });
                    }}
                    onSave={() => {
                      setSavedVitalDraft({
                        key: vitalItemsKey,
                        values: vitalDraft,
                      });
                      setEditingVitalDraft(null);
                      setVitalPopoverOpen(false);
                    }}
                  />
                </Popover>
              </div>
            ) : null}

            {memoActions.length ? (
              <div className="flex shrink-0 items-center gap-[var(--emr-context-bar-item-gap)]">
                <IllustrationIcon src={getAssetSrc(memoNoteLinesIcon)} alt="" />
                <Popover open={memoPopoverOpen} onOpenChange={setMemoPopoverOpen}>
                  <PopoverTrigger
                    render={
                      <PatientContextMemoButton
                        actionCount={memoActions.length}
                        open={memoPopoverOpen}
                      />
                    }
                  />
                  <PatientMemoPopover
                    actions={memoActions}
                    onClose={() => setMemoPopoverOpen(false)}
                  />
                </Popover>
              </div>
            ) : null}

            {trailingItems.length ? (
              <div className="flex shrink-0 items-center gap-[var(--emr-context-bar-item-gap)]">
                <PatientContextDatumGroup items={trailingItems} />
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-r from-transparent to-[var(--emr-surface-workspace)] transition-opacity",
              scrollState.canScrollRight ? "opacity-100" : "opacity-0"
            )}
            aria-hidden="true"
          />
        </div>

        <div className="flex shrink-0 items-center gap-[var(--emr-context-bar-section-gap)]">
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
              <div className="h-[var(--emr-context-bar-divider-height)] w-px shrink-0 bg-[var(--emr-context-bar-divider)]" />
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
      className="emr-text-status relative h-[var(--emr-context-bar-control-size)] rounded-[var(--emr-context-bar-button-radius)] bg-card px-[var(--clair-spacing-8)] text-[var(--emr-text-secondary)] shadow-[var(--clair-shadow-xs)] data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--clair-color-atomic-black-alpha-4)] data-[state=on]:text-[var(--emr-text-primary)] disabled:bg-card disabled:text-[var(--emr-text-disabled)] disabled:opacity-100"
      aria-label={`${label} ${open ? "접기" : "열기"}`}
      aria-expanded={open}
      aria-pressed={open}
      data-state={open ? "on" : "off"}
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

function PatientVitalPopover({
  draft,
  onCancel,
  onDraftChange,
  onSave,
  vitalItems,
}: {
  draft: string[];
  onCancel: () => void;
  onDraftChange: (index: number, value: string) => void;
  onSave: () => void;
  vitalItems: PatientContextDatum[];
}) {
  return (
    <EmrPopoverShell
      align="start"
      width="md"
      title="바이탈"
      meta="환자 인포바"
      description="현재 진료에서 확인한 수치를 빠르게 수정합니다."
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="outline" size="xs" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" size="xs" onClick={onSave}>
            저장
          </Button>
        </>
      }
    >
      {vitalItems.slice(0, 4).map((item, index) => {
        const unit = getVitalUnit(item.label, item.value);

        return (
          <EmrPopoverFieldRow
            key={`${String(item.label)}-${index}`}
            label={item.label}
            required={index < 2}
            unit={unit}
          >
            <Input
              aria-label={`${getNodeText(item.label)} 입력`}
              className={cn("h-8 bg-card", unit && "pr-10")}
              value={draft[index] ?? ""}
              onValueChange={(value) => onDraftChange(index, value)}
            />
          </EmrPopoverFieldRow>
        );
      })}
    </EmrPopoverShell>
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

function PatientContextMemoButton({
  actionCount,
  className,
  open,
  ...props
}: {
  actionCount: number;
  open: boolean;
} & ComponentProps<typeof Button>) {
  const label = `메모 ${open ? "닫기" : "열기"}`;

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn(
        "emr-text-metadata h-[var(--emr-context-bar-control-size)] rounded-[var(--emr-context-bar-button-radius)] bg-card px-[var(--clair-spacing-8)] text-[var(--emr-context-bar-chip-value)] shadow-[var(--clair-shadow-xs)] data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--clair-color-atomic-black-alpha-4)] data-[state=on]:text-[var(--emr-text-primary)]",
        className
      )}
      aria-label={label}
      aria-expanded={open}
      data-state={open ? "on" : "off"}
      title="환자 맥락 메모 보기"
      {...props}
    >
      메모
      <span className="ml-1 rounded-full bg-[var(--emr-context-bar-chip-bg)] px-1.5 text-[10px] font-semibold text-[var(--emr-text-secondary)]">
        {actionCount}
      </span>
    </Button>
  );
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
      className={cn("size-[var(--emr-context-bar-icon-size)] shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
