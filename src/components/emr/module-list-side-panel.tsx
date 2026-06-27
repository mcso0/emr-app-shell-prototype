"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EmrSubpanelTitle } from "@/components/emr/subpanel";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type EmrModuleListSidePanelBaseItem = {
  id: string;
  label: ReactNode;
};

export type EmrModuleListSidePanelButtonItem = EmrModuleListSidePanelBaseItem & {
  type: "button";
  active?: boolean;
  count?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  testId?: string;
};

export type EmrModuleListSidePanelGroupLabelItem = EmrModuleListSidePanelBaseItem & {
  type: "groupLabel";
};

export type EmrModuleListSidePanelLeafItem = EmrModuleListSidePanelBaseItem & {
  type: "leaf";
  active?: boolean;
  count?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  testId?: string;
};

export type EmrModuleListSidePanelSectionChild =
  | EmrModuleListSidePanelGroupLabelItem
  | EmrModuleListSidePanelLeafItem;

export type EmrModuleListSidePanelSectionItem = EmrModuleListSidePanelBaseItem & {
  type: "section";
  children: EmrModuleListSidePanelSectionChild[];
  icon?: ReactNode;
  testId?: string;
};

export type EmrModuleListSidePanelItem =
  | EmrModuleListSidePanelButtonItem
  | EmrModuleListSidePanelSectionItem;

type EmrModuleListSidePanelProps = {
  items: EmrModuleListSidePanelItem[];
  title: ReactNode;
  className?: string;
  collapseLabel?: string;
  onCollapse?: () => void;
  onToggleSection: (sectionId: string) => void;
  openSectionIds: ReadonlySet<string>;
  testId?: string;
};

const moduleListItemBaseClassName =
  "group/emr-module-list-item flex h-[var(--emr-module-list-item-height)] w-full items-center gap-[var(--emr-module-list-item-gap)] rounded-[var(--emr-module-list-item-radius)] px-[var(--emr-module-list-item-padding-x)] py-[var(--emr-module-list-item-padding-y)] text-left outline-none transition-colors";

const moduleListItemEnabledClassName =
  "text-[var(--emr-module-list-item-text)] hover:bg-[var(--emr-module-list-item-hover-bg)] focus-visible:ring-3 focus-visible:ring-ring/50";

const moduleListItemSelectedClassName =
  "bg-[var(--emr-module-list-item-selected-bg)] text-[var(--emr-module-list-item-selected-text)]";

const moduleListItemDisabledClassName =
  "cursor-not-allowed text-[var(--emr-module-list-item-disabled-text)] hover:bg-transparent";

export function EmrModuleListSidePanelBadge({
  children,
  variant = "secondary",
}: {
  children: ReactNode;
  variant?: "outline" | "secondary";
}) {
  return (
    <Badge
      variant={variant}
      className={cn(
        "emr-text-metadata inline-flex h-[var(--emr-module-list-badge-height)] min-w-[var(--emr-module-list-badge-min-width)] items-center justify-center rounded-[var(--emr-module-list-badge-radius)] border px-[var(--emr-module-list-badge-padding-x)] py-[var(--emr-module-list-badge-padding-y)] font-medium",
        variant === "secondary"
          ? "border-[var(--emr-module-list-badge-border)] bg-[var(--emr-module-list-badge-bg)] text-[var(--emr-module-list-badge-text)]"
          : "border-[var(--emr-module-list-badge-outline-border)] bg-[var(--emr-module-list-badge-outline-bg)] text-[var(--emr-module-list-badge-outline-text)]"
      )}
    >
      {children}
    </Badge>
  );
}

function EmrModuleListSidePanelItemButton({
  active,
  children,
  className,
  count,
  disabled = false,
  icon,
  onClick,
  testId,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  count?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        moduleListItemBaseClassName,
        disabled ? moduleListItemDisabledClassName : moduleListItemEnabledClassName,
        active && moduleListItemSelectedClassName,
        className,
      )}
      aria-pressed={active}
      data-selected={active ? "true" : undefined}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? (
        <span className="flex size-[var(--emr-module-list-item-icon-size)] shrink-0 items-center justify-center text-[var(--emr-module-list-item-icon)] [&_svg]:size-[var(--emr-module-list-item-icon-size)]">
          {icon}
        </span>
      ) : null}
      <span className="emr-text-dense flex min-w-0 flex-1 items-center gap-[var(--emr-module-list-item-left-gap)] font-medium tracking-[var(--emr-type-tracking-dense-label)]">
        <span className="truncate">{children}</span>
      </span>
      {count ? <span className="shrink-0">{count}</span> : null}
    </button>
  );
}

function EmrModuleListSidePanelGroupTitle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-[var(--emr-module-list-group-title-height)] items-center px-[var(--emr-module-list-group-title-padding-x)] py-[var(--emr-module-list-group-title-padding-y)] first:mt-0">
      <span className="emr-text-metadata truncate font-medium tracking-[var(--emr-type-tracking-metadata)] text-[var(--emr-module-list-group-title-text)]">
        {children}
      </span>
    </div>
  );
}

function EmrModuleListSidePanelSection({
  children,
  icon,
  open,
  testId,
  title,
  onToggle,
}: {
  children: ReactNode;
  icon?: ReactNode;
  open: boolean;
  testId?: string;
  title: string;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="flex flex-col gap-[var(--emr-module-list-group-gap)]">
      <button
        type="button"
        className={cn(
          moduleListItemBaseClassName,
          moduleListItemEnabledClassName,
        )}
        aria-expanded={open}
        data-testid={testId}
        onClick={onToggle}
      >
        {icon ? (
          <span className="flex size-[var(--emr-module-list-item-icon-size)] shrink-0 items-center justify-center text-[var(--emr-module-list-item-icon)] [&_svg]:size-[var(--emr-module-list-item-icon-size)]">
            {icon}
          </span>
        ) : null}
        <span className="emr-text-dense min-w-0 flex-1 truncate font-medium tracking-[var(--emr-type-tracking-dense-label)]">
          {title}
        </span>
        <span className="flex size-[var(--emr-module-list-action-size)] shrink-0 items-center justify-center rounded-[var(--clair-radius-atomic-4)]">
          <motion.span
            className="flex items-center justify-center"
            animate={{ rotate: open ? 0 : -90 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <CdsNavigationChevronDownIcon
              className="size-[var(--emr-module-list-action-icon-size)] text-[var(--emr-module-list-action-icon)]"
              aria-hidden="true"
            />
          </motion.span>
        </span>
      </button>
      {open ? (
        <div className="flex items-start">
          <div className="flex self-stretch overflow-hidden pl-[var(--emr-module-list-child-rail-padding-left)] pr-[var(--emr-module-list-child-rail-padding-right)]">
            <span className="my-[var(--emr-module-list-item-padding-y)] w-px bg-[var(--emr-module-list-child-rail-color)]" aria-hidden="true" />
          </div>
          <div className="grid min-w-0 flex-1 gap-[var(--emr-module-list-group-gap)]">
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function EmrModuleListSidePanel({
  className,
  collapseLabel,
  items,
  onCollapse,
  onToggleSection,
  openSectionIds,
  testId,
  title,
}: EmrModuleListSidePanelProps) {
  return (
    <aside
      className={cn(
        "group/emr-subpanel flex h-full min-h-0 w-full min-w-[var(--emr-module-list-panel-width)] max-w-[var(--emr-module-list-panel-width)] flex-col bg-[var(--emr-surface-sidepanel)]",
        className
      )}
      data-testid={testId}
    >
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{title}</span>}
        className="h-auto px-[var(--emr-module-list-header-padding-x)] pb-[var(--emr-module-list-header-padding-bottom)] pt-[var(--emr-module-list-header-padding-top)]"
        collapseLabel={collapseLabel}
        onCollapse={onCollapse}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid w-[var(--emr-module-list-panel-width)] gap-[var(--emr-module-list-section-gap)] px-[var(--emr-module-list-body-padding-x)] py-[var(--emr-module-list-body-padding-y)]">
          {items.map((item) =>
            item.type === "button" ? (
              <EmrModuleListSidePanelItemButton
                key={item.id}
                active={item.active}
                count={item.count}
                disabled={item.disabled}
                icon={item.icon}
                onClick={item.onClick}
                testId={item.testId}
              >
                {item.label}
              </EmrModuleListSidePanelItemButton>
            ) : (
              <EmrModuleListSidePanelSection
                key={item.id}
                title={String(item.label)}
                icon={item.icon}
                open={openSectionIds.has(item.id)}
                testId={item.testId}
                onToggle={() => onToggleSection(item.id)}
              >
                {item.children.map((child) =>
                  child.type === "groupLabel" ? (
                    <EmrModuleListSidePanelGroupTitle key={child.id}>
                      {child.label}
                    </EmrModuleListSidePanelGroupTitle>
                  ) : (
                    <EmrModuleListSidePanelItemButton
                      key={child.id}
                      active={child.active}
                      count={child.count}
                      disabled={child.disabled}
                      onClick={child.onClick}
                      testId={child.testId}
                    >
                      {child.label}
                    </EmrModuleListSidePanelItemButton>
                  )
                )}
              </EmrModuleListSidePanelSection>
            )
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
