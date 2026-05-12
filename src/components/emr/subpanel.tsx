"use client";

import type { ReactNode } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { CollapseGnbIcon } from "@/components/gnb-icons";
import { EmrIconButton } from "@/components/emr/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type EmrSubpanelProps = {
  children: ReactNode;
  className?: string;
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
  nextLabel?: string;
  onNext?: () => void;
  onOpenDatePicker?: () => void;
  onPrevious?: () => void;
  previousLabel?: string;
  todayLabel?: ReactNode;
};

type EmrListHeaderProps = {
  label: ReactNode;
  className?: string;
  count?: ReactNode;
  headerActions?: ReactNode;
  leadingAction?: ReactNode;
  leadingIcon?: ReactNode;
  topDividerVisible?: boolean;
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

export function EmrSubpanel({ children, className }: EmrSubpanelProps) {
  return (
    <div
      className={cn(
        "group/emr-subpanel flex h-full min-h-0 w-full min-w-[296px] max-w-[296px] flex-col bg-[var(--emr-surface-panel)]",
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
    <div className={cn("flex h-12 shrink-0 items-center px-4 py-3", className)}>
      <div className="flex min-w-0 flex-1 items-center">
        <div className="relative flex min-w-0 max-w-full items-center">
          <div className="min-w-0 truncate text-[16px] font-semibold leading-6 tracking-normal text-[var(--clair-color-label-strong)]">
            {title}
          </div>
          {onCollapse ? (
            <span className="pointer-events-auto absolute left-full z-10 ml-1 flex w-7 shrink-0 opacity-0 group-hover/emr-subpanel:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-[var(--clair-color-atomic-gray-500)] hover:text-[var(--clair-color-atomic-gray-500)]"
                aria-label={collapseLabel}
                onClick={onCollapse}
              >
                <CollapseGnbIcon aria-hidden="true" />
              </Button>
            </span>
          ) : null}
        </div>
      </div>
      {tabs ? <div className={cn("ml-3 flex shrink-0 items-center", tabsClassName)}>{tabs}</div> : null}
      {titleActions ? <div className="ml-2 flex shrink-0 items-center">{titleActions}</div> : null}
    </div>
  );
}

export function EmrDateNavigator({
  dateLabel,
  className,
  nextLabel = "다음 날짜",
  onNext,
  onOpenDatePicker,
  onPrevious,
  previousLabel = "이전 날짜",
  todayLabel,
}: EmrDateNavigatorProps) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center justify-between gap-1 px-4", className)}>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-7 rounded-[var(--clair-radius-md)] bg-[var(--emr-surface-panel)]"
        aria-label={previousLabel}
        onClick={onPrevious}
      >
        <ChevronLeftIcon />
      </Button>
      <button
        type="button"
        className="flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium leading-[18px] tracking-[0.019em] text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={onOpenDatePicker}
        aria-label={typeof dateLabel === "string" ? `${dateLabel} 날짜 선택` : "날짜 선택"}
      >
        <CalendarIcon
          className="size-3.5 shrink-0 text-[var(--clair-color-atomic-gray-400)]"
          aria-hidden="true"
        />
        <span className="truncate">{dateLabel}</span>
        {todayLabel ? (
          <Badge variant="outline" className="h-[18px] rounded-md bg-[var(--emr-surface-panel)] px-1.5 text-[10px] leading-4">
            {todayLabel}
          </Badge>
        ) : null}
      </button>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-7 rounded-[var(--clair-radius-md)] bg-[var(--emr-surface-panel)]"
        aria-label={nextLabel}
        onClick={onNext}
      >
        <ChevronRightIcon />
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
  topDividerVisible = false,
}: EmrListHeaderProps) {
  return (
    <div
      className={cn(
        "mx-4 flex h-10 shrink-0 items-center border-y border-[var(--emr-line-hairline)]",
        !topDividerVisible && "border-t-transparent",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-600)]">
        {leadingAction}
        {leadingIcon ? <span className="flex size-4 shrink-0 items-center justify-center">{leadingIcon}</span> : null}
        <span className="truncate">{label}</span>
        {count !== undefined ? (
          <Badge variant="secondary" className="h-5 min-w-5 rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-surface-muted)] px-1 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-900)]">
            {count}
          </Badge>
        ) : null}
      </div>
      {headerActions ? <div className="flex shrink-0 items-start gap-1.5">{headerActions}</div> : null}
    </div>
  );
}

export function EmrListHeaderIconButton({
  ariaLabel,
  children,
  iconSize = "sm",
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  iconSize?: "sm" | "md";
  onClick?: () => void;
}) {
  return (
    <EmrIconButton aria-label={ariaLabel} iconSize={iconSize} onClick={onClick}>
      {children}
    </EmrIconButton>
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
        <span className="h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)] bg-[var(--clair-color-atomic-orange-400)]" />
        <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium leading-5 tracking-[0.196px]">
          <span className="truncate text-[var(--clair-color-atomic-gray-600)]">{label}</span>
          {count !== undefined ? (
            <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{count}</span>
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
    <section className={cn("flex flex-col gap-1 rounded-[var(--clair-radius-atomic-10)]", className)}>
      {onToggle ? (
        <button
          type="button"
          className="flex h-8 w-full items-center gap-3 rounded-md p-1 text-left outline-none transition-colors hover:bg-[var(--emr-surface-muted)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {titleContent}
        </button>
      ) : (
        <div className="flex h-8 items-center gap-3 rounded-md p-1">{titleContent}</div>
      )}
      {collapsed ? null : <div className="flex flex-col gap-1">{children}</div>}
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
            <div className="truncate text-[13px] font-semibold leading-5 text-[var(--clair-color-label-normal)]">
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <div className="truncate text-[12px] font-medium leading-4 tracking-[0.3px] text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        {itemBadge ? <div className="shrink-0">{itemBadge}</div> : null}
      </div>
      {meta ? <div className="mt-1 min-w-0 truncate text-[12px] leading-4 text-muted-foreground">{meta}</div> : null}
      {footer ? (
        <div className="mt-2 flex min-h-5 items-center justify-between gap-2 border-t border-[var(--emr-line-hairline)] pt-1.5 text-[11px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </>
  );
  const itemClassName = cn(
    "group/emr-list-item w-full border text-left transition-colors",
    variant === "outline"
      ? "rounded-[var(--clair-radius-atomic-8)] px-3 pb-2.5 pt-2"
      : "rounded-[var(--clair-radius-sm)] px-1 py-1",
    selected
      ? variant === "outline"
        ? "border-[var(--emr-accent)] bg-[var(--emr-surface-selected)]"
        : usesTransparentSurface
          ? "border-transparent bg-transparent hover:bg-[var(--emr-surface-muted)]"
          : "border-transparent bg-[var(--emr-accent-subtle)]"
      : variant === "outline"
        ? "border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-muted)]"
        : usesTransparentSurface
          ? "border-transparent bg-transparent hover:bg-[var(--emr-surface-muted)]"
          : "border-transparent bg-transparent hover:border-[var(--emr-line-hairline)] hover:bg-[var(--emr-surface-panel)]",
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

export function EmrSubpanelBody({ children, className }: EmrSubpanelProps) {
  return (
    <ScrollArea className={cn("min-h-0 flex-1", className)}>
      <div className="flex flex-col gap-2 px-4 py-2">{children}</div>
    </ScrollArea>
  );
}
