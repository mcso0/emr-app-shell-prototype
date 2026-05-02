"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import {
  BellGnbIcon,
  CalendarGnbIcon,
  HomeGnbIcon,
  HospitalGnbIcon,
  HotelGnbIcon,
  MedicalGnbIcon,
  PayGnbIcon,
  PetGnbIcon,
  PharmacyGnbIcon,
  PillGnbIcon,
  RadiographyGnbIcon,
  SidebarGnbIcon,
} from "@/components/gnb-icons";
import { modules } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NavRailProps = {
  activeModuleId: string;
  navigationSearch?: string;
  workspaceId: string;
};

type GnbIcon = (props: { className?: string }) => ReactNode;

type RailNavItem = {
  id: string;
  icon: GnbIcon;
  iconClassName: string;
  label: string;
  moduleId?: string;
};

const moduleIconById: Record<string, { icon: GnbIcon; iconClassName: string }> = {
  home: { icon: HomeGnbIcon, iconClassName: "h-[17.105px] w-[18.5px]" },
  reception: { icon: CalendarGnbIcon, iconClassName: "h-[18.472px] w-[19px]" },
  treatment: { icon: MedicalGnbIcon, iconClassName: "h-[17.793px] w-[19.5px]" },
  lab: { icon: PharmacyGnbIcon, iconClassName: "h-[17.5px] w-[12.5px] rotate-45" },
  imaging: { icon: RadiographyGnbIcon, iconClassName: "size-[18.5px]" },
  dispensing: { icon: PillGnbIcon, iconClassName: "h-[18.397px] w-[17.533px]" },
  billing: { icon: PayGnbIcon, iconClassName: "size-[19.5px]" },
  inpatient: { icon: HotelGnbIcon, iconClassName: "h-[14.5px] w-[18.5px]" },
  orders: { icon: HospitalGnbIcon, iconClassName: "size-[19px]" },
};

const moduleNavLabelById: Partial<Record<string, string>> = {
  treatment: "진료(차트)",
  lab: "임상병리검사",
  imaging: "영상검사",
  dispensing: "조제/처치",
  inpatient: "입원",
  orders: "병원관리",
};

const moduleSections = [
  ["home"],
  ["reception", "treatment", "lab", "imaging", "dispensing", "billing", "inpatient"],
  ["orders"],
] as const;

const RAIL_LAYOUT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 430,
  damping: 38,
  mass: 0.8,
};

const RAIL_REDUCED_TRANSITION: Transition = { duration: 0 };
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

export function NavRail({ activeModuleId, navigationSearch = "", workspaceId }: NavRailProps) {
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
    <nav className="flex min-h-0 min-w-[60px] max-w-[60px] flex-col items-center rounded-lg bg-[#171923] p-2 text-[#cbd5e0]">
      <div className="flex min-h-0 w-11 flex-1 flex-col items-center gap-0.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {!modulePanelOpen ? (
            <motion.div
              key="collapsed-panel-toggle"
              initial={reduceMotion ? false : { height: 0, opacity: 0, y: -8 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={reduceMotion ? { height: 0 } : { height: 0, opacity: 0, y: -8 }}
              transition={collapsedTopTransition}
              className="flex w-full shrink-0 flex-col items-center gap-0.5 overflow-hidden"
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-[6px] text-[#cbd5e0] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-[var(--clair-color-atomic-sky-500)]/50"
                      onClick={() => setModulePanelOpen(true)}
                      aria-label="사이드 패널 펼치기"
                    >
                      <IconFrame>
                        <SidebarGnbIcon className="h-[14.5px] w-[19.5px]" />
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
        />
        <RailActionItem
          icon={BellGnbIcon}
          iconClassName="h-[18.299px] w-[18.5px]"
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
        />
        <NavDivider transition={railLayoutTransition} />
        <RailActionItem
          icon={PetGnbIcon}
          iconClassName="h-[18.359px] w-[19.5px]"
          label="고객관리"
          transition={railLayoutTransition}
        />
        <NavSection
          activeModuleId={activeModuleId}
          items={sections[2]}
          transition={railLayoutTransition}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
        />
      </div>
      <button
        type="button"
        className="relative mt-2 flex size-11 items-center justify-center rounded-[6px] outline-none focus-visible:ring-3 focus-visible:ring-[var(--clair-color-atomic-sky-500)]/50"
        aria-label="사용자 프로필"
      >
        <span className="relative flex size-7 items-center justify-center rounded-full bg-[#a0aec0] text-[9px] font-medium leading-none text-black">
          SH
          <span className="absolute bottom-0 right-0 size-1.5 rounded-full border border-[#171923] bg-[var(--clair-color-atomic-green-500)]" />
        </span>
      </button>
    </nav>
  );
}

function NavSection({
  activeModuleId,
  items,
  transition,
  navigationSearch,
  workspaceId,
}: {
  activeModuleId: string;
  items: RailNavItem[];
  transition: Transition;
  navigationSearch: string;
  workspaceId: string;
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
}: {
  active: boolean;
  item: RailNavItem;
  transition: Transition;
  navigationSearch: string;
  workspaceId: string;
}) {
  const Icon = item.icon;
  const href = `/w/${workspaceId}/${item.moduleId}${navigationSearch ? `?${navigationSearch}` : ""}`;

  return (
    <RailLayoutItem transition={transition}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={href}
              className={cn(
                "flex size-11 items-center justify-center rounded-[6px] text-[#cbd5e0] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-[var(--clair-color-atomic-sky-500)]/50",
                active && "bg-[rgba(255,255,255,0.16)] text-white"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              data-testid={active ? "nav-rail-active-item" : undefined}
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
              className="flex size-11 items-center justify-center rounded-[6px] text-[#cbd5e0] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-[var(--clair-color-atomic-sky-500)]/50"
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
    <span className="flex size-6 items-center justify-center" aria-hidden="true">
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
      className="flex w-full shrink-0 flex-col items-start overflow-hidden px-1.5 py-3"
    >
      <div className="h-px w-full bg-[#2d3748]" />
    </motion.div>
  );
}
