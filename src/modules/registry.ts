import {
  BedIcon,
  BoneIcon,
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
  BillingHeader,
  BillingRightPanel,
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
  ImagingContentAside,
  LabContentAside,
  ImagingContent,
  ImagingHeader,
  ImagingRightPanel,
  ImagingSidePanel,
  LabContent,
  LabHeader,
  LabRightPanel,
  LabSidePanel,
} from "@/features/lab-imaging/module";
import {
  InpatientContent,
  InpatientDrawer,
} from "@/features/inpatient/module";
import {
  CustomerContent,
  CustomerSidePanel,
} from "@/features/customer/module";
import {
  HospitalAdminContent,
  HospitalAdminDrawer,
  HospitalAdminSidePanel,
} from "@/features/hospital-admin/module";
import { HomeContent } from "@/features/home/module";
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
    content: HomeContent,
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
    label: "진료/차트",
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
    contentHeader: ImagingHeader,
    contentAside: ImagingContentAside,
    content: ImagingContent,
    rightPanel: ImagingRightPanel,
    defaultContentAsideOpen: true,
    defaultRightPanelOpen: true,
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
    label: "병원관리",
    icon: ClipboardListIcon,
    sidePanel: HospitalAdminSidePanel,
    content: HospitalAdminContent,
    drawer: HospitalAdminDrawer,
  },
  {
    id: "billing",
    label: "수납",
    icon: CreditCardIcon,
    sidePanel: BillingSidePanel,
    contentHeader: BillingHeader,
    content: BillingContent,
    rightPanel: BillingRightPanel,
    defaultRightPanelOpen: true,
  },
  {
    id: "inpatient",
    label: "입원",
    icon: BedIcon,
    content: InpatientContent,
    drawer: InpatientDrawer,
  },
  {
    id: "customer",
    label: "고객관리",
    icon: BoneIcon,
    sidePanel: CustomerSidePanel,
    content: CustomerContent,
  },
];

const moduleAliases: Record<string, string> = {
  chart: "treatment",
};

export function normalizeModuleId(moduleId: string) {
  return moduleAliases[moduleId] ?? moduleId;
}

export const getModule = (moduleId: string) =>
  modules.find((module) => module.id === normalizeModuleId(moduleId)) ?? modules[5];
