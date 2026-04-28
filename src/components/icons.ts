import * as React from "react";
import {
  IconBankCard,
  IconBed,
  IconBusiness,
  IconCalendarDates,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleClose,
  IconCircleInfo,
  IconCircleQuestion,
  IconClipboardTasks,
  IconClock3,
  IconClose,
  IconCommand,
  IconDownload,
  IconFilter,
  IconFlask,
  IconHome,
  IconImage,
  IconMenu,
  IconNotification,
  IconPill,
  IconPrint,
  IconSearch,
  IconSettings,
  IconSidebar,
  IconSliders,
  IconSpinnerBall,
  IconStethoscope,
  IconWarningTriangle,
} from "obra-icons-react";

export type AppIconProps = Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export type AppIcon = React.ForwardRefExoticComponent<
  AppIconProps & React.RefAttributes<SVGSVGElement>
>;

type ObraIcon = AppIcon & {
  render?: (
    props: AppIconProps,
    ref: React.ForwardedRef<SVGSVGElement>,
  ) => React.ReactNode;
};

const svgPropAliases = {
  "clip-rule": "clipRule",
  "fill-rule": "fillRule",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-width": "strokeWidth",
} as const;

function normalizeIconNode(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map(normalizeIconNode);
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  const props = node.props as Record<string, unknown> & {
    children?: React.ReactNode;
  };
  let nextProps: Record<string, unknown> | undefined;

  for (const [svgProp, reactProp] of Object.entries(svgPropAliases)) {
    if (svgProp in props) {
      nextProps ??= { ...props };
      nextProps[reactProp] ??= props[svgProp];
      delete nextProps[svgProp];
    }
  }

  const children = normalizeIconNode(props.children);

  if (children !== props.children) {
    nextProps ??= { ...props };
    nextProps.children = children;
  }

  if (!nextProps) {
    return node;
  }

  const cloneProps = { ...nextProps };
  delete cloneProps.children;
  const elementType = node.type as React.ElementType;

  if (Array.isArray(children)) {
    return React.createElement(elementType, cloneProps, ...children);
  }

  if (children !== undefined) {
    return React.createElement(elementType, cloneProps, children);
  }

  return React.createElement(elementType, cloneProps);
}

function createIcon(Icon: ObraIcon, displayName: string): AppIcon {
  const WrappedIcon = React.forwardRef<SVGSVGElement, AppIconProps>(
    (props, ref) => {
      if (typeof Icon.render === "function") {
        return normalizeIconNode(Icon.render(props, ref));
      }

      return React.createElement(Icon, { ...props, ref });
    },
  );

  WrappedIcon.displayName = displayName;

  return WrappedIcon;
}

export const CreditCardIcon = createIcon(IconBankCard, "CreditCardIcon");
export const BedIcon = createIcon(IconBed, "BedIcon");
export const ActivityIcon = createIcon(IconBusiness, "ActivityIcon");
export const BuildingIcon = createIcon(IconBusiness, "BuildingIcon");
export const CalendarIcon = createIcon(IconCalendarDates, "CalendarIcon");
export const CheckIcon = createIcon(IconCheck, "CheckIcon");
export const ChevronDownIcon = createIcon(IconChevronDown, "ChevronDownIcon");
export const ChevronLeftIcon = createIcon(IconChevronLeft, "ChevronLeftIcon");
export const ChevronRightIcon = createIcon(
  IconChevronRight,
  "ChevronRightIcon",
);
export const ChevronUpIcon = createIcon(IconChevronUp, "ChevronUpIcon");
export const CircleCheckIcon = createIcon(IconCircleCheck, "CircleCheckIcon");
export const CircleCloseIcon = createIcon(IconCircleClose, "CircleCloseIcon");
export const InfoIcon = createIcon(IconCircleInfo, "InfoIcon");
export const HelpIcon = createIcon(IconCircleQuestion, "HelpIcon");
export const ClipboardListIcon = createIcon(
  IconClipboardTasks,
  "ClipboardListIcon",
);
export const ClockIcon = createIcon(IconClock3, "ClockIcon");
export const CloseIcon = createIcon(IconClose, "CloseIcon");
export const CommandIcon = createIcon(IconCommand, "CommandIcon");
export const DownloadIcon = createIcon(IconDownload, "DownloadIcon");
export const FilterIcon = createIcon(IconFilter, "FilterIcon");
export const FlaskIcon = createIcon(IconFlask, "FlaskIcon");
export const HomeIcon = createIcon(IconHome, "HomeIcon");
export const ImagesIcon = createIcon(IconImage, "ImagesIcon");
export const MenuIcon = createIcon(IconMenu, "MenuIcon");
export const BellIcon = createIcon(IconNotification, "BellIcon");
export const PillIcon = createIcon(IconPill, "PillIcon");
export const PrinterIcon = createIcon(IconPrint, "PrinterIcon");
export const SearchIcon = createIcon(IconSearch, "SearchIcon");
export const SettingsIcon = createIcon(IconSettings, "SettingsIcon");
export const PanelCloseIcon = createIcon(IconSidebar, "PanelCloseIcon");
export const PanelOpenIcon = createIcon(IconSidebar, "PanelOpenIcon");
export const SlidersIcon = createIcon(IconSliders, "SlidersIcon");
export const LoaderIcon = createIcon(IconSpinnerBall, "LoaderIcon");
export const StethoscopeIcon = createIcon(
  IconStethoscope,
  "StethoscopeIcon",
);
export const WarningIcon = createIcon(IconWarningTriangle, "WarningIcon");
