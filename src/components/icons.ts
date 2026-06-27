import * as React from "react";
import {
  IconBankCard,
  IconBed,
  IconBone,
  IconBusiness,
  IconCalendar,
  IconCalendarDates,
  IconCalendarCheck,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleClose,
  IconCircleCloseFill,
  IconCircleInfo,
  IconCircleQuestion,
  IconClipboardTasks,
  IconClock3,
  IconClose,
  IconCommand,
  IconContactBook,
  IconDatabase,
  IconDocument,
  IconDocumentCheck,
  IconDownload,
  IconFilter,
  IconFlask,
  IconFolder,
  IconGrid,
  IconHome,
  IconImage,
  IconLayers,
  IconMenu,
  IconMessages,
  IconNotification,
  IconPill,
  IconPrint,
  IconSearch,
  IconSend,
  IconSettings,
  IconShield,
  IconSidebar,
  IconSliders,
  IconSpinnerBall,
  IconStethoscope,
  IconUser,
  IconUserCross,
  IconUsers,
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
  "clip-path": "clipPath",
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
export const CalendarOutlineIcon = createIcon(IconCalendar, "CalendarOutlineIcon");
export const CalendarCheckIcon = createIcon(
  IconCalendarCheck,
  "CalendarCheckIcon",
);
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
export const CircleCloseFillIcon = createIcon(
  IconCircleCloseFill,
  "CircleCloseFillIcon",
);
export const InfoIcon = createIcon(IconCircleInfo, "InfoIcon");
export const HelpIcon = createIcon(IconCircleQuestion, "HelpIcon");
export const ClipboardListIcon = createIcon(
  IconClipboardTasks,
  "ClipboardListIcon",
);
export const ClockIcon = createIcon(IconClock3, "ClockIcon");
export const CloseIcon = createIcon(IconClose, "CloseIcon");
export const CommandIcon = createIcon(IconCommand, "CommandIcon");
export const ContactBookIcon = createIcon(
  IconContactBook,
  "ContactBookIcon",
);
export const DatabaseIcon = createIcon(IconDatabase, "DatabaseIcon");
export const DocumentIcon = createIcon(IconDocument, "DocumentIcon");
export const DocumentCheckIcon = createIcon(
  IconDocumentCheck,
  "DocumentCheckIcon",
);
export const DownloadIcon = createIcon(IconDownload, "DownloadIcon");
export const ExcelFileIcon = React.forwardRef<SVGSVGElement, AppIconProps>(
  ({ size = 16, style, ...props }, ref) =>
    React.createElement(
      "svg",
      {
        ...props,
        ref,
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        style,
      },
      React.createElement("path", {
        d: "M6 3.5H15.5L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V5.5C4 4.39543 4.89543 3.5 6 3.5Z",
        fill: "var(--emr-status-success-bg)",
        stroke: "var(--emr-status-success-text)",
        strokeWidth: 1.4,
        strokeLinejoin: "round",
      }),
      React.createElement("path", {
        d: "M15.5 3.5V8H20",
        stroke: "var(--emr-status-success-text)",
        strokeWidth: 1.4,
        strokeLinejoin: "round",
      }),
      React.createElement("path", {
        d: "M13.5 12H17.5M13.5 16H17.5",
        stroke: "var(--emr-status-success-text)",
        strokeWidth: 1.4,
        strokeLinecap: "round",
      }),
      React.createElement("rect", {
        x: 2.5,
        y: 8,
        width: 11,
        height: 10,
        rx: 1.6,
        fill: "var(--emr-status-success-text)",
      }),
      React.createElement("path", {
        d: "M6 11L10 15M10 11L6 15",
        stroke: "var(--emr-text-inverse)",
        strokeWidth: 1.6,
        strokeLinecap: "round",
      }),
    ),
);
ExcelFileIcon.displayName = "ExcelFileIcon";
export const FilterIcon = createIcon(IconFilter, "FilterIcon");
export const FlaskIcon = createIcon(IconFlask, "FlaskIcon");
export const FolderIcon = createIcon(IconFolder, "FolderIcon");
export const GridIcon = createIcon(IconGrid, "GridIcon");
export const HomeIcon = createIcon(IconHome, "HomeIcon");
export const BoneIcon = createIcon(IconBone, "BoneIcon");
export const ImagesIcon = createIcon(IconImage, "ImagesIcon");
export const LayersIcon = createIcon(IconLayers, "LayersIcon");
export const MenuIcon = createIcon(IconMenu, "MenuIcon");
export const MessagesIcon = createIcon(IconMessages, "MessagesIcon");
export const BellIcon = createIcon(IconNotification, "BellIcon");
export const PillIcon = createIcon(IconPill, "PillIcon");
export const PrinterIcon = createIcon(IconPrint, "PrinterIcon");
export const SearchIcon = createIcon(IconSearch, "SearchIcon");
export const SendIcon = createIcon(IconSend, "SendIcon");
export const SettingsIcon = createIcon(IconSettings, "SettingsIcon");
export const ShieldIcon = createIcon(IconShield, "ShieldIcon");
export const PanelCloseIcon = createIcon(IconSidebar, "PanelCloseIcon");
export const PanelOpenIcon = createIcon(IconSidebar, "PanelOpenIcon");
export const SlidersIcon = createIcon(IconSliders, "SlidersIcon");
export const LoaderIcon = createIcon(IconSpinnerBall, "LoaderIcon");
export const StethoscopeIcon = createIcon(
  IconStethoscope,
  "StethoscopeIcon",
);
export const UserIcon = createIcon(IconUser, "UserIcon");
export const UserCrossIcon = createIcon(IconUserCross, "UserCrossIcon");
export const UsersIcon = createIcon(IconUsers, "UsersIcon");
export const WarningIcon = createIcon(IconWarningTriangle, "WarningIcon");

export const WorkspaceLogoMarkIcon = React.forwardRef<
  SVGSVGElement,
  AppIconProps
>(({ color, size = 16, style, ...props }, ref) =>
  React.createElement(
    "svg",
    {
      ...props,
      ref,
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      style: { color, ...style },
    },
    React.createElement(
      "g",
      { transform: "translate(4.28569 3.42857)" },
      React.createElement("path", {
        d: "M1.31159e-08 2.66755C-3.79695e-05 2.5078 0.0824223 2.35952 0.217716 2.27609L3.79845 0.0675967C3.93372 -0.0158421 4.10237 -0.0224488 4.24368 0.0501571L7.17994 1.55879C7.49698 1.72169 7.51455 2.17128 7.21116 2.35874L0.694891 6.38508C0.39124 6.57271 0.000797685 6.35277 0.00072172 5.99403L1.31159e-08 2.66755Z",
        fill: "currentColor",
      }),
      React.createElement("path", {
        d: "M1.10266 7.436C0.800698 7.23374 0.810739 6.78488 1.12144 6.59643L4.22422 4.71453C4.39559 4.6106 4.61242 4.62042 4.77376 4.73943L7.22649 6.54863C7.48513 6.73941 7.49762 7.12295 7.25195 7.33029L4.74567 9.16907C4.57706 9.31137 4.33513 9.32482 4.15189 9.20209L1.10266 7.436Z",
        fill: "currentColor",
      }),
    ),
  ),
);
WorkspaceLogoMarkIcon.displayName = "WorkspaceLogoMarkIcon";
