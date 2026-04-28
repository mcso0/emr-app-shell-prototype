import {
  Bed,
  Building2,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Home,
  Images,
  Pill,
  Stethoscope,
} from "lucide-react";
import type { ModuleDefinition } from "@/types/emr";
import {
  DispensingContent,
  DispensingContentAside,
  DispensingDrawer,
  DispensingHeader,
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
    icon: Home,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
  },
  {
    id: "reception",
    label: "접수",
    icon: Building2,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
  {
    id: "treatment",
    label: "진료",
    icon: Stethoscope,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
  {
    id: "lab",
    label: "검사",
    icon: FlaskConical,
    sidePanel: PlaceholderSidePanel,
    contentHeader: DispensingHeader,
    contentAside: DispensingContentAside,
    content: PlaceholderContent,
  },
  {
    id: "imaging",
    label: "영상",
    icon: Images,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
  },
  {
    id: "dispensing",
    label: "조제",
    icon: Pill,
    sidePanel: DispensingSidePanel,
    contentHeader: DispensingHeader,
    contentAside: DispensingContentAside,
    content: DispensingContent,
    drawer: DispensingDrawer,
  },
  {
    id: "orders",
    label: "오더",
    icon: ClipboardList,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
  {
    id: "billing",
    label: "수납",
    icon: CreditCard,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
  },
  {
    id: "inpatient",
    label: "병동",
    icon: Bed,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
  },
];

export const getModule = (moduleId: string) =>
  modules.find((module) => module.id === moduleId) ?? modules[5];
