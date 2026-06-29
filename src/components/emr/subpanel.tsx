"use client";

import { useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import {
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesReceptionCalendarIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
} from "@/components/cds-icons/navigation";
import { ChevronDownIcon } from "@/components/icons";
import { SidebarGnbIcon } from "@/components/gnb-icons";
import { EmrDatePickerDayButton } from "@/components/emr/date-picker-day-button";
import { EmrIconButton } from "@/components/emr/icon-button";
import { EmrMotionIcon } from "@/components/emr/motion-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addMonthsToIsoDate,
  formatCompactKoreanOperatingDateLabel,
  parseIsoDateParts,
} from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";
import folderFileCloseMotionIcon from "../../../icons/motionIcon/Folder File close.json";
import queueLoadingMotionIcon from "../../../icons/motionIcon/iconly-icon-export-1782392467.json";
import searchNotFoundMotionIcon from "../../../icons/motionIcon/search-not-found.json";

type EmrSubpanelProps = {
  children: ReactNode;
  className?: string;
};

type EmrSubpanelBodyProps = EmrSubpanelProps & {
  contentClassName?: string;
  density?: "default" | "queue";
};

type EmrSubpanelTitleProps = {
  title: ReactNode;
  className?: string;
  collapseLabel?: string;
  onCollapse?: () => void;
  tabs?: ReactNode;
  tabsClassName?: string;
  titleActions?: ReactNode;
};

type EmrDateNavigatorProps = {
  dateLabel: ReactNode;
  className?: string;
  onDateChange?: (date: string) => void;
  nextLabel?: string;
  onNext?: () => void;
  onOpenDatePicker?: () => void;
  onPrevious?: () => void;
  previousLabel?: string;
  selectedDate?: string;
  todayDate?: string;
  todayLabel?: ReactNode;
};

type EmrListHeaderProps = {
  label: ReactNode;
  className?: string;
  count?: ReactNode;
  headerActions?: ReactNode;
  leadingAction?: ReactNode;
  leadingIcon?: ReactNode;
  search?: EmrListHeaderSearchProps;
  topDividerVisible?: boolean;
};

type EmrListHeaderSearchProps = {
  active: boolean;
  query: string;
  resultCount: number;
  closeLabel?: string;
  inputLabel?: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  placeholder?: string;
};

type EmrListGroupProps = {
  children: ReactNode;
  label: ReactNode;
  className?: string;
  collapsed?: boolean;
  count?: ReactNode;
  groupActions?: ReactNode;
  onToggle?: () => void;
};

type EmrListItemProps = {
  title?: ReactNode;
  className?: string;
  footer?: ReactNode;
  itemBadge?: ReactNode;
  meta?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
  surface?: "default" | "transparent";
  subtitle?: ReactNode;
  testId?: string;
  variant?: "default" | "outline";
};

const emrDatePickerWeekdays = ["일", "월", "화", "수", "목", "금", "토"];
const emrDateNavigatorClassName =
  "flex h-[calc(var(--clair-control-height-md)+var(--clair-spacing-8)*2)] shrink-0 items-center justify-between gap-[var(--clair-spacing-6)] px-[var(--clair-spacing-12)]";
const emrDateNavigatorTriggerClassName =
  "emr-text-dense-label flex h-[var(--clair-control-height-md)] min-w-0 flex-1 items-center justify-center gap-[var(--clair-spacing-6)] rounded-[var(--clair-radius-md)] px-[var(--clair-spacing-10)] font-medium tabular-nums text-foreground outline-none transition-[scale,background-color] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50";
const emrDateNavigatorIconButtonClassName =
  "rounded-[var(--clair-radius-md)] bg-transparent text-[var(--emr-text-tertiary)] shadow-none transition-transform hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-secondary)] active:scale-[0.96]";
const emrDateNavigatorTodayBadgeClassName =
  "rounded-[var(--clair-radius-atomic-6)] border-transparent bg-[var(--clair-color-atomic-black-alpha-4)] px-[var(--clair-spacing-6)] emr-text-metadata font-medium";
const emrSubpanelHeaderIconButtonClassName =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-[var(--clair-radius-sm)] bg-transparent p-0 text-[var(--clair-color-atomic-gray-600)] outline-none transition-[background-color,box-shadow,color] duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] hover:bg-[var(--emr-state-hover)] hover:text-[var(--clair-color-atomic-gray-600)] focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-[var(--emr-state-active)] aria-pressed:text-[var(--clair-color-atomic-gray-600)] aria-pressed:hover:bg-[var(--emr-state-active)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--emr-text-disabled)] disabled:opacity-100 disabled:hover:bg-transparent disabled:hover:text-[var(--emr-text-disabled)] [&_svg]:size-5 [&_svg]:shrink-0";

function getIsoDateFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getEmrMonthDatePickerCells(
  visibleMonthDate: string,
  selectedDate: string,
  todayDate?: string,
) {
  const parts = parseIsoDateParts(visibleMonthDate);
  const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  const firstCellDate = new Date(monthStart);
  firstCellDate.setUTCDate(1 - monthStart.getUTCDay());

  return Array.from({ length: 35 }, (_, index) => {
    const cellDate = new Date(firstCellDate);
    cellDate.setUTCDate(firstCellDate.getUTCDate() + index);
    const key = getIsoDateFromUtcDate(cellDate);

    return {
      key,
      day: String(cellDate.getUTCDate()),
      inMonth: cellDate.getUTCMonth() === parts.month - 1,
      selected: key === selectedDate,
      today: key === todayDate,
    };
  });
}

export function EmrSubpanel({ children, className }: EmrSubpanelProps) {
  return (
    <div
      className={cn(
        "group/emr-subpanel flex h-full min-h-0 w-full min-w-[296px] max-w-[296px] flex-col bg-[var(--emr-surface-sidepanel)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function EmrSubpanelTitle({
  title,
  className,
  collapseLabel = "사이드 패널 접기",
  onCollapse,
  tabs,
  tabsClassName,
  titleActions,
}: EmrSubpanelTitleProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center px-[var(--clair-spacing-16)] pb-[var(--clair-spacing-10)] pt-[var(--clair-spacing-16)]",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center">
        <div className="emr-text-panel-title min-w-0 truncate font-semibold text-foreground">
          {title}
        </div>
      </div>
      {tabs ? <div className={cn("ml-3 flex shrink-0 items-center", tabsClassName)}>{tabs}</div> : null}
      {titleActions ? <div className="ml-2 flex shrink-0 items-center">{titleActions}</div> : null}
      {onCollapse ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <EmrSubpanelHeaderIconButton
                aria-label={collapseLabel}
                onClick={onCollapse}
                className={cn((tabs || titleActions) && "ml-2")}
              >
                <SidebarGnbIcon />
              </EmrSubpanelHeaderIconButton>
            }
          />
          <TooltipContent side="right" sideOffset={8}>
            {collapseLabel}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function EmrSubpanelHeaderIconButton({
  className,
  selected = false,
  type = "button",
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected ? "true" : undefined}
      className={cn(emrSubpanelHeaderIconButtonClassName, className)}
      {...props}
    />
  );
}

export function EmrDateNavigator({
  dateLabel,
  className,
  onDateChange,
  nextLabel = "다음 날짜",
  onNext,
  onOpenDatePicker,
  onPrevious,
  previousLabel = "이전 날짜",
  selectedDate,
  todayDate,
  todayLabel,
}: EmrDateNavigatorProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonthDate, setPickerMonthDate] = useState(selectedDate ?? "");
  const datePickerEnabled = Boolean(selectedDate && onDateChange);
  const pickerMonthDateParts = parseIsoDateParts(pickerMonthDate || selectedDate || "");
  const datePickerCells = selectedDate
    ? getEmrMonthDatePickerCells(
        pickerMonthDate || selectedDate,
        selectedDate,
        todayDate,
      )
    : [];
  const renderedDateLabel = selectedDate
    ? formatCompactKoreanOperatingDateLabel(selectedDate)
    : dateLabel;

  const openDatePicker = () => {
    onOpenDatePicker?.();
    if (datePickerEnabled) {
      setPickerMonthDate(selectedDate ?? "");
      setDatePickerOpen(true);
    }
  };
  const selectDate = (date: string) => {
    onDateChange?.(date);
    setDatePickerOpen(false);
  };
  const trigger = (
    <button
      type="button"
      className={emrDateNavigatorTriggerClassName}
      onClick={openDatePicker}
      disabled={!datePickerEnabled && !onOpenDatePicker}
      aria-label={
        typeof renderedDateLabel === "string"
          ? `${renderedDateLabel} 날짜 선택`
          : "날짜 선택"
      }
    >
      <CdsFilesReceptionCalendarIcon
        className="size-[var(--clair-spacing-16)] shrink-0 text-[var(--emr-text-secondary)]"
        aria-hidden="true"
      />
      <span className="truncate">{renderedDateLabel}</span>
      {todayLabel ? (
        <Badge variant="outline" className={emrDateNavigatorTodayBadgeClassName}>
          {todayLabel}
        </Badge>
      ) : null}
    </button>
  );

  return (
    <div className={cn(emrDateNavigatorClassName, className)}>
      <Button
        variant="ghost"
        size="icon"
        className={emrDateNavigatorIconButtonClassName}
        aria-label={previousLabel}
        disabled={!onPrevious}
        onClick={onPrevious}
      >
        <CdsNavigationChevronLeftIcon />
      </Button>
      {datePickerEnabled ? (
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger render={trigger} />
          <PopoverContent
            align="center"
            className="w-[244px] gap-3 p-3"
            initialFocus={false}
          >
            <div className="flex items-center justify-between">
              <div className="emr-text-dense font-semibold leading-5 text-foreground">
                {pickerMonthDateParts.year}년 {pickerMonthDateParts.month}월
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="이전 달"
                  onClick={() =>
                    setPickerMonthDate((current) =>
                      addMonthsToIsoDate(current || selectedDate || "", -1),
                    )
                  }
                >
                  <CdsNavigationChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="다음 달"
                  onClick={() =>
                    setPickerMonthDate((current) =>
                      addMonthsToIsoDate(current || selectedDate || "", 1),
                    )
                  }
                >
                  <CdsNavigationChevronRightIcon />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {emrDatePickerWeekdays.map((weekday) => (
                <span
                  key={weekday}
                  className="h-6 emr-text-micro font-medium leading-6 text-muted-foreground"
                >
                  {weekday}
                </span>
              ))}
              {datePickerCells.map((cell) => (
                <EmrDatePickerDayButton
                  key={cell.key}
                  date={cell.key}
                  day={cell.day}
                  inMonth={cell.inMonth}
                  selected={cell.selected}
                  today={cell.today}
                  onClick={() => selectDate(cell.key)}
                />
              ))}
            </div>
            {todayDate ? (
              <div className="flex justify-end border-t border-[var(--emr-line-hairline)] pt-[var(--clair-spacing-8)]">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={selectedDate === todayDate}
                  onClick={() => selectDate(todayDate)}
                >
                  오늘로 이동
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : (
        trigger
      )}
      <Button
        variant="ghost"
        size="icon"
        className={emrDateNavigatorIconButtonClassName}
        aria-label={nextLabel}
        disabled={!onNext}
        onClick={onNext}
      >
        <CdsNavigationChevronRightIcon />
      </Button>
    </div>
  );
}

export function EmrListHeader({
  label,
  className,
  count,
  headerActions,
  leadingAction,
  leadingIcon,
  search,
  topDividerVisible = false,
}: EmrListHeaderProps) {
  const searchQuery = search?.query ?? "";
  const searchActive = search?.active ?? false;
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape" || !search) return;

    event.preventDefault();

    if (search.query) {
      search.onQueryChange("");
      return;
    }

    search.onClose();
  };

  return (
    <>
      {topDividerVisible ? (
        <div className="mx-[var(--clair-spacing-16)] h-px shrink-0 bg-[var(--emr-line-hairline)]" />
      ) : null}
      <div
        className={cn(
          "flex shrink-0 items-center gap-[var(--clair-spacing-12)] px-[var(--clair-spacing-16)] py-[var(--clair-spacing-12)]",
          className
        )}
      >
        {searchActive && search ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <CdsActionsSearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-tertiary)]"
              />
              <Input
                autoFocus
                aria-label={search.inputLabel ?? "대기열 검색"}
                className="h-8 rounded-[var(--clair-radius-md)] border-[var(--emr-state-selected-border)] bg-card pl-8 pr-2 font-semibold shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                placeholder={search.placeholder ?? "대기열 검색"}
                type="search"
                value={searchQuery}
                onChange={(event) => search.onQueryChange(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <EmrListHeaderIconButton ariaLabel={search.closeLabel ?? "검색 닫기"} onClick={search.onClose}>
              <CdsActionsXIcon className="size-4" />
            </EmrListHeaderIconButton>
          </div>
        ) : (
          <>
            <div className="emr-text-section flex min-w-0 flex-1 items-center gap-1.5 font-medium text-[var(--emr-text-secondary)]">
              {leadingAction}
              {leadingIcon ? <span className="flex size-4 shrink-0 items-center justify-center">{leadingIcon}</span> : null}
              {typeof label === "string" ? (
                <span className="truncate">{label}</span>
              ) : (
                <div className="min-w-0">{label}</div>
              )}
              {count !== undefined ? (
                <Badge variant="secondary" className="emr-text-metadata h-5 min-w-5 rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-surface-muted)] px-1 font-medium text-[var(--emr-text-primary)]">
                  {count}
                </Badge>
              ) : null}
            </div>
            {headerActions ? <div className="flex shrink-0 items-start gap-1.5">{headerActions}</div> : null}
          </>
        )}
      </div>
      {searchActive && searchQuery.trim() ? (
        <div className="emr-text-metadata mx-4 flex min-h-7 shrink-0 items-center border-b border-[var(--emr-line-hairline)] text-[var(--emr-text-tertiary)]">
          검색 결과 {search?.resultCount ?? 0}건
        </div>
      ) : null}
    </>
  );
}

export function EmrListHeaderIconButton({
  ariaLabel,
  children,
  iconSize = "sm",
  ...props
}: {
  ariaLabel: string;
  children?: ReactNode;
  iconSize?: "sm" | "md";
} & Omit<ComponentProps<typeof EmrIconButton>, "aria-label" | "children" | "iconSize">) {
  return (
    <EmrIconButton aria-label={ariaLabel} iconSize={iconSize} {...props}>
      {children}
    </EmrIconButton>
  );
}

export function EmrListSearchEmptyState(props: {
  motionIcon?: ReactNode;
  objectLabel?: string;
  onClear: () => void;
  query: string;
}) {
  const motionIcon = props.motionIcon ?? (
    <EmrMotionIcon
      animationData={searchNotFoundMotionIcon}
      className="size-10 text-[var(--emr-text-placeholder)] [&_path]:!stroke-current"
      loop={false}
    />
  );

  return (
    <EmrQueueEmptyState
      icon={motionIcon}
      title="검색 결과가 없습니다"
      data-testid="emr-list-search-empty-state"
    />
  );
}

export function EmrQueueLoadingState({
  title = "업무 정보를 불러오는 중입니다",
}: {
  title?: string;
}) {
  return (
    <EmrQueueEmptyState
      icon={
        <EmrMotionIcon
          animationData={queueLoadingMotionIcon}
          className="size-10 text-[var(--emr-text-placeholder)] [&_path]:!stroke-current"
        />
      }
      title={title}
      data-testid="emr-queue-loading-state"
    />
  );
}

export function EmrQueueEmptyState({
  children,
  className,
  icon,
  iconClassName,
  title,
  ...props
}: {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  iconClassName?: string;
  title?: ReactNode;
} & ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-1 flex-col items-center justify-center px-4 py-8 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "mb-2 flex size-10 items-center justify-center text-[var(--emr-text-placeholder)]",
          iconClassName,
        )}
      >
        {icon ?? (
          <EmrMotionIcon
            animationData={folderFileCloseMotionIcon}
            className="size-9 text-[var(--emr-text-placeholder)] [&_path]:!stroke-current"
            loop={false}
          />
        )}
      </div>
      <div className="emr-text-dense font-medium text-[var(--emr-text-placeholder)]">
        {title ?? children}
      </div>
    </div>
  );
}

export function EmrListGroup({
  children,
  label,
  className,
  collapsed = false,
  count,
  groupActions,
  onToggle,
}: EmrListGroupProps) {
  const titleContent = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)] bg-[var(--emr-state-selected-border)]" />
        <div className="emr-text-section flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate text-[var(--emr-text-secondary)]">{label}</span>
          {count !== undefined ? (
            <span className="shrink-0 text-[var(--emr-text-tertiary)]">{count}</span>
          ) : null}
        </div>
      </div>
      {groupActions ? (
        <div className="flex shrink-0 items-center gap-1">{groupActions}</div>
      ) : (
        <span className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm p-1">
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--clair-motion-duration-normal)] ease-[var(--clair-motion-easing-standard)]",
              collapsed && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      )}
    </>
  );

  return (
    <section className={cn("emr-density-stack-sm flex flex-col rounded-[var(--clair-radius-atomic-10)]", className)}>
      {onToggle ? (
        <button
          type="button"
          className="emr-density-list-compact flex h-8 w-full items-center gap-3 rounded-md text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {titleContent}
        </button>
      ) : (
        <div className="emr-density-list-compact flex h-8 items-center gap-3 rounded-md">{titleContent}</div>
      )}
      {collapsed ? null : <div className="emr-density-stack-sm flex flex-col">{children}</div>}
    </section>
  );
}

export function EmrListItem({
  title,
  className,
  footer,
  itemBadge,
  meta,
  onSelect,
  selected = false,
  surface = "default",
  subtitle,
  testId,
  variant = "default",
}: EmrListItemProps) {
  const usesTransparentSurface = surface === "transparent";
  const content = (
    <>
      <div className="flex min-h-6 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="emr-text-dense truncate font-semibold text-[var(--emr-text-secondary)]">
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <div className="emr-text-metadata truncate font-medium text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        {itemBadge ? <div className="shrink-0">{itemBadge}</div> : null}
      </div>
      {meta ? <div className="emr-text-status mt-1 min-w-0 truncate text-muted-foreground">{meta}</div> : null}
      {footer ? (
        <div className="emr-text-micro mt-2 flex min-h-5 items-center justify-between gap-2 border-t border-[var(--emr-line-hairline)] pt-1.5 text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </>
  );
  const itemClassName = cn(
    "group/emr-list-item w-full border text-left transition-colors",
    variant === "outline"
      ? "emr-density-card rounded-[var(--clair-radius-atomic-8)]"
      : "emr-density-list-compact rounded-[var(--clair-radius-sm)]",
    selected
      ? variant === "outline"
        ? "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
        : usesTransparentSurface
          ? "border-transparent bg-transparent hover:bg-[var(--emr-state-hover)]"
          : "border-transparent bg-[var(--emr-state-selected)]"
      : variant === "outline"
        ? "border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-state-hover)]"
        : usesTransparentSurface
          ? "border-transparent bg-transparent hover:bg-[var(--emr-state-hover)]"
          : "border-transparent bg-transparent hover:border-[var(--emr-line-hairline)] hover:bg-[var(--emr-state-hover)]",
    className
  );

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(itemClassName, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
        data-selected={selected ? "true" : undefined}
        data-testid={testId}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return <div className={itemClassName} data-testid={testId}>{content}</div>;
}

export function EmrSubpanelBody({
  children,
  className,
  contentClassName,
  density = "default",
}: EmrSubpanelBodyProps) {
  const insetClassName =
    density === "queue"
      ? "px-[var(--clair-spacing-16)] py-0"
      : "emr-density-panel-inset";

  return (
    <ScrollArea className={cn("min-h-0 flex-1", className)}>
      <div className={cn(insetClassName, "emr-density-stack-md flex min-h-full flex-col", contentClassName)}>
        {children}
      </div>
    </ScrollArea>
  );
}
