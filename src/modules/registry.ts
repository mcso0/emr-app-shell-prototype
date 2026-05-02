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
  ChartSidePanel,
} from "@/features/chart/module";
import {
  DispensingContent,
  DispensingContentAside,
  DispensingDrawer,
  DispensingHeader,
  DispensingRightPanel,
  DispensingSidePanel,
} from "@/features/dispensing/module";
import {
  ImagingContent,
  ImagingSidePanel,
  LabContent,
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
    content: ChartContent,
  },
  {
    id: "lab",
    label: "검사",
    icon: FlaskIcon,
    sidePanel: LabSidePanel,
    content: LabContent,
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
    rightPanel: DispensingRightPanel,
    defaultRightPanelOpen: false,
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
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
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
