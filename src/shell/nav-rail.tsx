"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import {
  BellGnbIcon,
  SidebarGnbIcon,
} from "@/components/gnb-icons";
import { CdsGnbHeadphonesGnbIcon } from "@/components/cds-icons/gnb";
import { modules } from "@/modules/registry";
import { moduleIconById, moduleNavLabelById, type GnbIcon } from "@/shell/module-nav-icons";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GlobalCommandPalette } from "@/shell/global-command-palette";

type NavRailProps = {
  activeModuleId: string;
  navigationSearch?: string;
  workspaceId: string;
  onNavigateModule?: (href: string, moduleId: string) => void;
};

type RailNavItem = {
  id: string;
  icon: GnbIcon;
  iconClassName: string;
  label: string;
  moduleId?: string;
};

const moduleSections = [
  ["home"],
  ["reception", "treatment", "lab", "imaging", "dispensing", "billing", "inpatient"],
  ["customer", "orders"],
] as const;

const RAIL_LAYOUT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 430,
  damping: 38,
  mass: 0.8,
};

const RAIL_REDUCED_TRANSITION: Transition = { duration: 0 };
const RAIL_ROOT_CLASS_NAME =
  "flex min-h-0 min-w-[var(--emr-navrail-width)] max-w-[var(--emr-navrail-width)] flex-col items-center gap-[var(--emr-navrail-root-gap)] overflow-hidden rounded-[var(--emr-navrail-radius)] bg-[var(--emr-navrail-bg)] p-[var(--emr-navrail-padding)] text-[var(--emr-navrail-icon)]";
const RAIL_ITEM_CLASS_NAME =
  "flex size-[var(--emr-navrail-item-size)] items-center justify-center rounded-[var(--emr-navrail-item-radius)] p-[var(--emr-navrail-item-padding)] text-[var(--emr-navrail-icon)] outline-none transition-colors hover:bg-[var(--emr-navrail-item-hover)] hover:text-[var(--emr-navrail-icon-hover)] focus-visible:ring-3 focus-visible:ring-ring/50";
const RAIL_ICON_FRAME_CLASS_NAME = "flex size-[var(--emr-navrail-icon-frame-size)] items-center justify-center";
const RAIL_TOOLTIP_SIDE_OFFSET = 16;
const RAIL_TOP_ENTER_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};
const RAIL_TOP_EXIT_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

function getModuleItem(moduleId: string): RailNavItem | null {
  const moduleDefinition = modules.find((item) => item.id === moduleId);
  const iconSpec = moduleIconById[moduleId];

  if (!moduleDefinition || !iconSpec) {
    return null;
  }

  return {
    id: moduleDefinition.id,
    icon: iconSpec.icon,
    iconClassName: iconSpec.iconClassName,
    label: moduleNavLabelById[moduleId] ?? moduleDefinition.label,
    moduleId: moduleDefinition.id,
  };
}

export function NavRail({ activeModuleId, navigationSearch = "", workspaceId, onNavigateModule }: NavRailProps) {
  const { modulePanelOpen, setModulePanelOpen } = useLayoutStore();
  const reduceMotion = useReducedMotion();
  const railLayoutTransition = reduceMotion
    ? RAIL_REDUCED_TRANSITION
    : RAIL_LAYOUT_TRANSITION;
  const collapsedTopTransition: Transition = reduceMotion
    ? RAIL_REDUCED_TRANSITION
    : modulePanelOpen
      ? RAIL_TOP_EXIT_TRANSITION
      : RAIL_TOP_ENTER_TRANSITION;
  const sections = moduleSections.map((section) =>
    section.map(getModuleItem).filter((item): item is RailNavItem => Boolean(item))
  );

  return (
    <nav className={RAIL_ROOT_CLASS_NAME} aria-label="워크스페이스 주요 메뉴">
      <div className="flex min-h-0 w-[var(--emr-navrail-content-width)] flex-1 flex-col items-center gap-[var(--emr-navrail-content-gap)] overflow-y-auto">
        <AnimatePresence initial={false}>
          {!modulePanelOpen ? (
            <motion.div
              key="collapsed-panel-toggle"
              initial={reduceMotion ? false : { height: 0, opacity: 0, y: -8 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={reduceMotion ? { height: 0 } : { height: 0, opacity: 0, y: -8 }}
              transition={collapsedTopTransition}
              className="flex w-full shrink-0 flex-col items-center gap-[var(--emr-navrail-content-gap)] overflow-hidden"
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className={RAIL_ITEM_CLASS_NAME}
                      onClick={() => setModulePanelOpen(true)}
                      aria-label="사이드 패널 펼치기"
                    >
                      <IconFrame>
                        <SidebarGnbIcon className="h-[13.7px] w-[18.4px]" />
                      </IconFrame>
                    </button>
                  }
                />
                <TooltipContent side="right" sideOffset={RAIL_TOOLTIP_SIDE_OFFSET}>
                  사이드 패널 펼치기
                </TooltipContent>
              </Tooltip>
              <NavDivider transition={railLayoutTransition} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <NavSection
          activeModuleId={activeModuleId}
          items={sections[0]}
          transition={railLayoutTransition}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
          onNavigateModule={onNavigateModule}
        />
        <RailLayoutItem transition={railLayoutTransition}>
          <GlobalCommandPalette
            triggerVariant="rail"
            tooltipSideOffset={RAIL_TOOLTIP_SIDE_OFFSET}
            workspaceId={workspaceId}
          />
        </RailLayoutItem>
        <RailActionItem
          icon={BellGnbIcon}
          iconClassName="h-[17.3px] w-[17.6px]"
          label="알림"
          transition={railLayoutTransition}
        />
        <NavDivider transition={railLayoutTransition} />
        <NavSection
          activeModuleId={activeModuleId}
          items={sections[1]}
          transition={railLayoutTransition}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
          onNavigateModule={onNavigateModule}
        />
        <NavDivider transition={railLayoutTransition} />
        <NavSection
          activeModuleId={activeModuleId}
          items={sections[2]}
          transition={railLayoutTransition}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
          onNavigateModule={onNavigateModule}
        />
      </div>
      <div className="flex w-[var(--emr-navrail-content-width)] shrink-0 flex-col items-center justify-center pb-[var(--emr-navrail-footer-padding-bottom)]">
        <RailActionItem
          icon={CdsGnbHeadphonesGnbIcon}
          iconClassName="h-[17.5px] w-[18.5px]"
          label="고객센터"
          transition={railLayoutTransition}
        />
      </div>
    </nav>
  );
}

function NavSection({
  activeModuleId,
  items,
  transition,
  navigationSearch,
  workspaceId,
  onNavigateModule,
}: {
  activeModuleId: string;
  items: RailNavItem[];
  transition: Transition;
  navigationSearch: string;
  workspaceId: string;
  onNavigateModule?: (href: string, moduleId: string) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <RailModuleItem
          key={item.id}
          active={item.moduleId === activeModuleId}
          item={item}
          transition={transition}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
          onNavigateModule={onNavigateModule}
        />
      ))}
    </>
  );
}

function RailModuleItem({
  active,
  item,
  transition,
  navigationSearch,
  workspaceId,
  onNavigateModule,
}: {
  active: boolean;
  item: RailNavItem;
  transition: Transition;
  navigationSearch: string;
  workspaceId: string;
  onNavigateModule?: (href: string, moduleId: string) => void;
}) {
  const Icon = item.icon;
  const href = `/w/${workspaceId}/${item.moduleId}${navigationSearch ? `?${navigationSearch}` : ""}`;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    if (!item.moduleId || !onNavigateModule) return;

    event.preventDefault();
    onNavigateModule(href, item.moduleId);
  }

  return (
    <RailLayoutItem transition={transition}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={href}
              className={cn(
                RAIL_ITEM_CLASS_NAME,
                active && "bg-[var(--emr-navrail-item-selected)] text-[var(--emr-navrail-icon-selected)]"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              data-testid={active ? "nav-rail-active-item" : undefined}
              onClick={handleClick}
            >
              <IconFrame>
                <Icon className={item.iconClassName} />
              </IconFrame>
            </Link>
          }
        />
        <TooltipContent side="right" sideOffset={RAIL_TOOLTIP_SIDE_OFFSET}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    </RailLayoutItem>
  );
}

function RailActionItem({
  icon: Icon,
  iconClassName,
  label,
  transition,
}: {
  icon: GnbIcon;
  iconClassName: string;
  label: string;
  transition: Transition;
}) {
  return (
    <RailLayoutItem transition={transition}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={RAIL_ITEM_CLASS_NAME}
              aria-label={label}
            >
              <IconFrame>
                <Icon className={iconClassName} />
              </IconFrame>
            </button>
          }
        />
        <TooltipContent side="right" sideOffset={RAIL_TOOLTIP_SIDE_OFFSET}>
          {label}
        </TooltipContent>
      </Tooltip>
    </RailLayoutItem>
  );
}

function IconFrame({ children }: { children: ReactNode }) {
  return (
    <span className={RAIL_ICON_FRAME_CLASS_NAME} aria-hidden="true">
      {children}
    </span>
  );
}

function RailLayoutItem({
  children,
  transition,
}: {
  children: ReactNode;
  transition: Transition;
}) {
  return (
    <motion.div layout="position" transition={transition} className="w-full shrink-0">
      {children}
    </motion.div>
  );
}

function NavDivider({ transition }: { transition: Transition }) {
  return (
    <motion.div
      layout="position"
      transition={transition}
      className="flex w-full shrink-0 flex-col items-center justify-center overflow-hidden px-[var(--emr-navrail-divider-padding-x)] py-0"
    >
      <div className="h-[var(--emr-navrail-divider-height)] w-[var(--emr-navrail-divider-width)] bg-[var(--emr-navrail-divider)]" />
    </motion.div>
  );
}
