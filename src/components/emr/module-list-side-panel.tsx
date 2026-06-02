"use client";

import type { ReactNode } from "react";
import { EmrSubpanelTitle } from "@/components/emr/subpanel";
import {
  EmrTextSideNavButton,
  EmrTextSideNavSection,
} from "@/components/emr/text-side-panel";
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
        "h-5 rounded-md px-1.5 emr-text-micro",
        variant === "secondary" && "min-w-5"
      )}
    >
      {children}
    </Badge>
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
        "group/emr-subpanel flex h-full min-h-0 w-full min-w-[280px] max-w-[280px] flex-col bg-[var(--emr-surface-sidepanel)]",
        className
      )}
      data-testid={testId}
    >
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{title}</span>}
        collapseLabel={collapseLabel}
        onCollapse={onCollapse}
      />
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        <div className="grid gap-1 pt-1">
          {items.map((item) =>
            item.type === "button" ? (
              <EmrTextSideNavButton
                key={item.id}
                active={item.active}
                count={item.count}
                disabled={item.disabled}
                icon={item.icon}
                onClick={item.onClick}
                testId={item.testId}
              >
                {item.label}
              </EmrTextSideNavButton>
            ) : (
              <EmrTextSideNavSection
                key={item.id}
                title={String(item.label)}
                icon={item.icon}
                open={openSectionIds.has(item.id)}
                testId={item.testId}
                onToggle={() => onToggleSection(item.id)}
              >
                <div className="ml-4 border-l py-1 pl-3">
                  <div className="grid gap-1">
                    {item.children.map((child) =>
                      child.type === "groupLabel" ? (
                        <div
                          key={child.id}
                          className="mt-1 flex h-8 items-center rounded-md px-2 first:mt-0 emr-text-body font-semibold text-[var(--emr-text-primary)]"
                        >
                          {child.label}
                        </div>
                      ) : (
                        <EmrTextSideNavButton
                          key={child.id}
                          active={child.active}
                          className={cn(!child.icon && "pl-4")}
                          count={child.count}
                          disabled={child.disabled}
                          icon={child.icon}
                          onClick={child.onClick}
                          testId={child.testId}
                        >
                          {child.label}
                        </EmrTextSideNavButton>
                      )
                    )}
                  </div>
                </div>
              </EmrTextSideNavSection>
            )
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
