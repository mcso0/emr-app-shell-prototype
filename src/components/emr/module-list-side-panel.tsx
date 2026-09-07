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
  disabledBadgeLabel?: string;
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
  showGroupLabels?: boolean;
  testId?: string;
};

export type EmrModuleListSidePanelItem =
  | EmrModuleListSidePanelButtonItem
  | EmrModuleListSidePanelGroupLabelItem
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
  "group/emr-module-list-item flex h-[var(--emr-module-list-item-height)] w-full items-center rounded-[var(--emr-module-list-item-radius)] px-[var(--emr-module-list-item-padding-x)] py-[var(--emr-module-list-item-padding-y)] text-left outline-none transition-colors";

const moduleListLeafItemClassName =
  "h-[var(--emr-module-list-leaf-item-height)] px-[var(--emr-module-list-leaf-item-padding-x)] py-[var(--emr-module-list-leaf-item-padding-y)]";

const moduleListItemIconClassName =
  "mr-[var(--emr-module-list-item-gap)] flex size-[var(--emr-module-list-item-icon-size)] shrink-0 items-center justify-center [&_svg]:size-[var(--emr-module-list-item-icon-size)]";

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
      data-emr-module-list-badge="true"
      className={cn(
        "inline-flex h-[var(--emr-module-list-badge-height)] min-w-[var(--emr-module-list-badge-min-width)] items-center justify-center rounded-[var(--emr-module-list-badge-radius)] border px-[var(--emr-module-list-badge-padding-x)] py-[var(--emr-module-list-badge-padding-y)] text-[length:var(--emr-module-list-metadata-font-size)] leading-[var(--emr-module-list-metadata-line-height)] font-medium tracking-[var(--emr-type-tracking-metadata)]",
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
  disabledBadge,
  icon,
  onClick,
  testId,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  count?: ReactNode;
  disabled?: boolean;
  disabledBadge?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  const trailing = disabled && disabledBadge ? disabledBadge : count;

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
        <span
          className={cn(
            moduleListItemIconClassName,
            disabled
              ? "text-[var(--emr-module-list-item-disabled-text)]"
              : "text-[var(--emr-module-list-item-icon)]"
          )}
          data-emr-module-list-item-icon="true"
        >
          {icon}
        </span>
      ) : null}
      <span
        className="flex min-w-0 flex-1 items-center gap-[var(--emr-module-list-item-left-gap)] text-[length:var(--emr-module-list-item-font-size)] leading-[var(--emr-module-list-item-line-height)] font-medium tracking-[var(--emr-type-tracking-dense-label)]"
        data-emr-module-list-item-label="true"
      >
        <span className="truncate">{children}</span>
      </span>
      {trailing ? (
        <span className="ml-[var(--emr-module-list-item-slot-gap)] shrink-0">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

function EmrModuleListSidePanelGroupTitle({
  children,
  size = "md",
}: {
  children: ReactNode;
  size?: "md" | "sm";
}) {
  return (
    <div
      className={cn(
        "flex items-center first:mt-0",
        size === "md"
          ? "h-[var(--emr-module-list-group-title-height)] px-[var(--emr-module-list-group-title-padding-x)] py-[var(--emr-module-list-group-title-padding-y)]"
          : "h-[var(--emr-module-list-child-group-title-height)] px-[var(--emr-module-list-child-group-title-padding-x)] py-[var(--emr-module-list-child-group-title-padding-y)]",
      )}
      data-emr-module-list-group-label="true"
      data-emr-module-list-group-label-size={size}
    >
      <span
        className={cn(
          "truncate font-medium",
          size === "md"
            ? "text-[length:var(--emr-module-list-item-font-size)] leading-[var(--emr-module-list-item-line-height)] tracking-[var(--emr-type-tracking-dense-label)] text-[var(--emr-module-list-group-title-text)]"
            : "text-[length:var(--emr-module-list-metadata-font-size)] leading-[var(--emr-module-list-metadata-line-height)] tracking-[var(--emr-type-tracking-metadata)] text-[var(--emr-module-list-child-group-title-text)]",
        )}
      >
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
          <span
            className={cn(moduleListItemIconClassName, "text-[var(--emr-module-list-item-icon)]")}
            data-emr-module-list-item-icon="true"
            data-emr-module-list-section-icon="true"
          >
            {icon}
          </span>
        ) : null}
        <span
          className="min-w-0 flex-1 truncate text-[length:var(--emr-module-list-item-font-size)] leading-[var(--emr-module-list-item-line-height)] font-medium tracking-[var(--emr-type-tracking-dense-label)]"
          data-emr-module-list-item-label="true"
        >
          {title}
        </span>
        <span
          className="ml-[var(--emr-module-list-item-slot-gap)] flex size-[var(--emr-module-list-action-size)] shrink-0 items-center justify-center rounded-[var(--clair-radius-atomic-4)]"
          data-emr-module-list-action="true"
        >
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
        <div className="grid grid-cols-[var(--emr-module-list-child-rail-column-width)_minmax(0,1fr)] items-start">
          <div className="relative self-stretch overflow-hidden">
            <span
              className="absolute inset-y-0 w-[var(--emr-module-list-child-rail-line-width)] bg-[var(--emr-module-list-child-rail-color)]"
              aria-hidden="true"
              data-emr-module-list-child-rail="true"
              style={{ left: "var(--emr-module-list-child-rail-line-left)" }}
            />
          </div>
          <div
            className="grid min-w-0 gap-[var(--emr-module-list-group-gap)] pr-[var(--emr-module-list-leaf-list-padding-right)]"
            data-emr-module-list-child-list="true"
          >
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
  const itemGroups = items.reduce<EmrModuleListSidePanelItem[][]>((groups, item) => {
    if (item.type === "groupLabel" || groups.length === 0) {
      groups.push([item]);
    } else {
      groups[groups.length - 1]?.push(item);
    }

    return groups;
  }, []);

  return (
    <aside
      className={cn(
        "group/emr-subpanel flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--emr-surface-sidepanel)]",
        className
      )}
      data-testid={testId}
    >
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{title}</span>}
        collapseLabel={collapseLabel}
        onCollapse={onCollapse}
      />
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade-y scroll-fade-8"
      >
        <div
          className="grid w-full gap-[var(--emr-module-list-section-gap)] py-[var(--emr-module-list-body-padding-y)]"
          data-emr-module-list-body="true"
        >
          {itemGroups.map((group) => (
            <div
              key={group[0]?.id}
              className="grid w-full gap-[var(--emr-module-list-group-gap)] px-[var(--emr-module-list-body-padding-x)]"
              data-emr-module-list-group="true"
            >
              {group.map((item) =>
                item.type === "groupLabel" ? (
                  <EmrModuleListSidePanelGroupTitle key={item.id}>
                    {item.label}
                  </EmrModuleListSidePanelGroupTitle>
                ) : item.type === "button" ? (
                  <EmrModuleListSidePanelItemButton
                    key={item.id}
                    active={item.active}
                    count={item.count}
                    disabled={item.disabled}
                    disabledBadge={<EmrModuleListSidePanelBadge variant="outline">{item.disabledBadgeLabel ?? "미구현"}</EmrModuleListSidePanelBadge>}
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
                    {item.children.flatMap((child, childIndex) => {
                      if (child.type === "groupLabel" && item.showGroupLabels !== false) {
                        const hasPreviousGroup = item.children
                          .slice(0, childIndex)
                          .some((candidate) => candidate.type === "groupLabel");

                        return [
                          hasPreviousGroup ? (
                            <span
                              key={`${child.id}-separator`}
                              className="h-[var(--emr-module-list-child-group-separator-height)]"
                              aria-hidden="true"
                              data-emr-module-list-child-group-separator="true"
                            />
                          ) : null,
                          <EmrModuleListSidePanelGroupTitle key={child.id} size="sm">
                            {child.label}
                          </EmrModuleListSidePanelGroupTitle>,
                        ];
                      }

                      return child.type === "leaf" ? (
                        <EmrModuleListSidePanelItemButton
                          key={child.id}
                          active={child.active}
                          className={moduleListLeafItemClassName}
                          count={child.count}
                          disabled={child.disabled}
                          disabledBadge={<EmrModuleListSidePanelBadge variant="outline">미구현</EmrModuleListSidePanelBadge>}
                          onClick={child.onClick}
                          testId={child.testId}
                        >
                          {child.label}
                        </EmrModuleListSidePanelItemButton>
                      ) : null;
                    })}
                  </EmrModuleListSidePanelSection>
                )
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
