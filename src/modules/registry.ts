import {
  BedIcon,
  BuildingIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FlaskIcon,
  HomeIcon,
  ImagesIcon,
  PillIcon,
  StethoscopeIcon,
} from "@/components/icons";
import type { ModuleDefinition } from "@/types/emr";
import {
  ChartContent,
  ChartContentAside,
  ChartHeader,
  ChartRightPanel,
  ChartSidePanel,
} from "@/features/chart/module";
import {
  BillingContent,
  BillingSidePanel,
} from "@/features/billing/module";
import {
  DispensingContent,
  DispensingContentAside,
  DispensingDrawer,
  DispensingHeader,
  DispensingSidePanel,
} from "@/features/dispensing/module";
import {
  LabContentAside,
  ImagingContent,
  ImagingSidePanel,
  LabContent,
  LabHeader,
  LabRightPanel,
  LabSidePanel,
} from "@/features/lab-imaging/module";
import {
  PlaceholderContent,
  PlaceholderRightPanel,
  PlaceholderSidePanel,
} from "@/features/placeholders/module";
import {
  ReceptionContent,
  ReceptionDrawer,
  ReceptionSidePanel,
} from "@/features/reception/module";

export const modules: ModuleDefinition[] = [
  {
    id: "home",
    label: "홈",
    icon: HomeIcon,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
  },
  {
    id: "reception",
    label: "접수/예약",
    icon: BuildingIcon,
    sidePanel: ReceptionSidePanel,
    content: ReceptionContent,
    drawer: ReceptionDrawer,
  },
  {
    id: "treatment",
    label: "진료(차트)",
    icon: StethoscopeIcon,
    sidePanel: ChartSidePanel,
    contentHeader: ChartHeader,
    contentAside: ChartContentAside,
    content: ChartContent,
    rightPanel: ChartRightPanel,
    defaultRightPanelOpen: false,
  },
  {
    id: "lab",
    label: "검사",
    icon: FlaskIcon,
    sidePanel: LabSidePanel,
    contentHeader: LabHeader,
    contentAside: LabContentAside,
    content: LabContent,
    rightPanel: LabRightPanel,
    defaultContentAsideOpen: true,
    defaultRightPanelOpen: false,
  },
  {
    id: "imaging",
    label: "영상",
    icon: ImagesIcon,
    sidePanel: ImagingSidePanel,
    content: ImagingContent,
  },
  {
    id: "dispensing",
    label: "조제",
    icon: PillIcon,
    sidePanel: DispensingSidePanel,
    contentHeader: DispensingHeader,
    contentAside: DispensingContentAside,
    content: DispensingContent,
    drawer: DispensingDrawer,
  },
  {
    id: "orders",
    label: "오더",
    icon: ClipboardListIcon,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
  {
    id: "billing",
    label: "수납",
    icon: CreditCardIcon,
    sidePanel: BillingSidePanel,
    content: BillingContent,
  },
  {
    id: "inpatient",
    label: "병동",
    icon: BedIcon,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
];

export const getModule = (moduleId: string) =>
  modules.find((module) => module.id === moduleId) ?? modules[5];
