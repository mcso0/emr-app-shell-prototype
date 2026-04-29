"use client";

import type { ReactNode } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { CollapseGnbIcon } from "@/components/gnb-icons";
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
  leadingIcon?: ReactNode;
};

type EmrListGroupProps = {
  children: ReactNode;
  label: ReactNode;
  className?: string;
  collapsed?: boolean;
  count?: ReactNode;
  groupActions?: ReactNode;
};

type EmrListItemProps = {
  title?: ReactNode;
  className?: string;
  footer?: ReactNode;
  itemBadge?: ReactNode;
  meta?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
  subtitle?: ReactNode;
  variant?: "default" | "outline";
};

export function EmrSubpanel({ children, className }: EmrSubpanelProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-[320px] max-w-[320px] flex-col bg-[var(--clair-color-background-normal)]",
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
  titleActions,
}: EmrSubpanelTitleProps) {
  return (
    <div className={cn("flex h-16 shrink-0 items-start px-4 py-4", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {onCollapse ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded bg-transparent text-[var(--clair-color-label-alternative)] hover:bg-muted hover:text-[var(--clair-color-label-strong)]"
            aria-label={collapseLabel}
            onClick={onCollapse}
          >
            <CollapseGnbIcon aria-hidden="true" />
          </Button>
        ) : null}
        <div className="min-w-0 truncate text-[18px] font-semibold leading-[26px] tracking-normal text-[var(--clair-color-label-strong)]">
          {title}
        </div>
      </div>
      {tabs ? <div className="ml-3 shrink-0">{tabs}</div> : null}
      {titleActions ? <div className="ml-2 shrink-0">{titleActions}</div> : null}
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
    <div className={cn("flex h-12 shrink-0 items-center justify-between px-4", className)}>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-8 rounded-[var(--clair-radius-md)] bg-card"
        aria-label={previousLabel}
        onClick={onPrevious}
      >
        <ChevronLeftIcon />
      </Button>
      <button
        type="button"
        className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[14px] font-medium leading-5 tracking-[0.196px] text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={onOpenDatePicker}
        aria-label={typeof dateLabel === "string" ? `${dateLabel} 날짜 선택` : "날짜 선택"}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{dateLabel}</span>
        {todayLabel ? (
          <Badge variant="outline" className="h-5 rounded-md bg-card px-1.5 text-[11px]">
            {todayLabel}
          </Badge>
        ) : null}
      </button>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-8 rounded-[var(--clair-radius-md)] bg-card"
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
  leadingIcon,
}: EmrListHeaderProps) {
  return (
    <div className={cn("mx-4 flex h-10 shrink-0 items-center border-y border-border", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-label-alternative)]">
        {leadingIcon ? <span className="flex size-4 shrink-0 items-center justify-center">{leadingIcon}</span> : null}
        <span className="truncate">{label}</span>
        {count !== undefined ? (
          <Badge variant="secondary" className="h-5 min-w-5 rounded-md px-1.5 text-[11px]">
            {count}
          </Badge>
        ) : null}
      </div>
      {headerActions ? <div className="flex shrink-0 items-center gap-1">{headerActions}</div> : null}
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
}: EmrListGroupProps) {
  return (
    <section className={cn("flex flex-col gap-1 rounded-[var(--clair-radius-atomic-10)]", className)}>
      <div className="flex h-8 items-center gap-3 rounded-md p-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 border-l-2 border-[var(--clair-color-atomic-orange-400)] pl-2 text-[14px] font-medium leading-5 tracking-[0.196px]">
          <span className="truncate text-[var(--clair-color-label-alternative)]">{label}</span>
          {count !== undefined ? (
            <span className="shrink-0 text-[var(--clair-color-label-assistive)]">{count}</span>
          ) : null}
        </div>
        {groupActions ? (
          <div className="flex shrink-0 items-center gap-1">{groupActions}</div>
        ) : (
          <ChevronDownIcon
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")}
            aria-hidden="true"
          />
        )}
      </div>
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
  subtitle,
  variant = "default",
}: EmrListItemProps) {
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
        <div className="mt-2 flex min-h-5 items-center justify-between gap-2 border-t border-[var(--clair-color-line-subtle)] pt-1.5 text-[11px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </>
  );
  const itemClassName = cn(
    "w-full rounded-md border text-left transition-colors",
    variant === "outline" ? "px-3 py-2.5" : "px-1 py-1",
    selected
      ? "border-[var(--selection-border)] bg-selection"
      : variant === "outline"
        ? "border-border bg-card hover:bg-background"
        : "border-transparent bg-transparent hover:border-border hover:bg-card",
    className
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={cn(itemClassName, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return <div className={itemClassName}>{content}</div>;
}

export function EmrSubpanelBody({ children, className }: EmrSubpanelProps) {
  return (
    <ScrollArea className={cn("min-h-0 flex-1", className)}>
      <div className="flex flex-col gap-2 px-4 py-2">{children}</div>
    </ScrollArea>
  );
}
