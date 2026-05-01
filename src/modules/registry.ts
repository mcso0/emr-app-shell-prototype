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
  DispensingContent,
  DispensingContentAside,
  DispensingDrawer,
  DispensingHeader,
  DispensingRightPanel,
  DispensingSidePanel,
} from "@/features/dispensing/module";
import {
  PlaceholderContent,
  PlaceholderRightPanel,
  PlaceholderSidePanel,
} from "@/features/placeholders/module";

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
    label: "접수",
    icon: BuildingIcon,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
  {
    id: "treatment",
    label: "처치",
    icon: StethoscopeIcon,
    sidePanel: PlaceholderSidePanel,
    content: DispensingContent,
    rightPanel: PlaceholderRightPanel,
    drawer: DispensingDrawer,
  },
  {
    id: "lab",
    label: "검사",
    icon: FlaskIcon,
    sidePanel: PlaceholderSidePanel,
    contentHeader: DispensingHeader,
    contentAside: DispensingContentAside,
    content: PlaceholderContent,
  },
  {
    id: "imaging",
    label: "영상",
    icon: ImagesIcon,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
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
