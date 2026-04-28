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
  DispensingContextPanel,
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
    icon: Home,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    defaultLayout: { modulePanelOpen: true },
  },
  {
    id: "reception",
    label: "접수",
    icon: Building2,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
    defaultLayout: { modulePanelOpen: true, rightPanelOpen: true },
  },
  {
    id: "treatment",
    label: "진료",
    icon: Stethoscope,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
    defaultLayout: { modulePanelOpen: true, rightPanelOpen: true },
  },
  {
    id: "lab",
    label: "검사",
    icon: FlaskConical,
    sidePanel: PlaceholderSidePanel,
    contentHeader: DispensingHeader,
    contextPanel: DispensingContextPanel,
    content: PlaceholderContent,
    defaultLayout: { modulePanelOpen: true, contextPanelOpen: true },
  },
  {
    id: "imaging",
    label: "영상",
    icon: Images,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    defaultLayout: { modulePanelOpen: true },
  },
  {
    id: "dispensing",
    label: "조제",
    icon: Pill,
    sidePanel: DispensingSidePanel,
    contentHeader: DispensingHeader,
    contextPanel: DispensingContextPanel,
    content: DispensingContent,
    rightPanel: DispensingRightPanel,
    drawer: DispensingDrawer,
    defaultLayout: {
      modulePanelOpen: true,
      contextPanelOpen: false,
      rightPanelOpen: true,
      rightPanelWidth: 316,
    },
  },
  {
    id: "orders",
    label: "오더",
    icon: ClipboardList,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
    defaultLayout: { modulePanelOpen: true, rightPanelOpen: false },
  },
  {
    id: "billing",
    label: "수납",
    icon: CreditCard,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    defaultLayout: { modulePanelOpen: true },
  },
  {
    id: "inpatient",
    label: "병동",
    icon: Bed,
    sidePanel: PlaceholderSidePanel,
    content: PlaceholderContent,
    rightPanel: PlaceholderRightPanel,
    defaultLayout: { modulePanelOpen: true, rightPanelOpen: true },
  },
];

export const getModule = (moduleId: string) =>
  modules.find((module) => module.id === moduleId) ?? modules[5];
