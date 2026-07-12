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
  ChartSidePanel,
  ChartSlotAvailabilityProvider,
} from "@/features/chart/module";
import {
  BillingContent,
  BillingContentAside,
  BillingHeader,
  BillingRightPanel,
  BillingSidePanel,
  BillingSlotAvailabilityProvider,
} from "@/features/billing/module";
import {
  DispensingContent,
  DispensingContentAside,
  DispensingDrawer,
  DispensingHeader,
  DispensingSidePanel,
  DispensingSlotAvailabilityProvider,
} from "@/features/dispensing/module";
import {
  ImagingContentAside,
  LabContentAside,
  ImagingContent,
  ImagingHeader,
  ImagingRightPanel,
  ImagingSidePanel,
  ImagingSlotAvailabilityProvider,
  LabContent,
  LabHeader,
  LabRightPanel,
  LabSidePanel,
  LabSlotAvailabilityProvider,
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
import { HomeContent, HomeSidePanel } from "@/features/home/module";
import {
  ReceptionContent,
  ReceptionRightPanel,
  ReceptionSidePanel,
} from "@/features/reception/module";

export const modules: ModuleDefinition[] = [
  {
    id: "home",
    label: "원내 현황",
    icon: HomeIcon,
    sidePanel: HomeSidePanel,
    content: HomeContent,
  },
  {
    id: "reception",
    label: "접수/예약",
    icon: BuildingIcon,
    sidePanel: ReceptionSidePanel,
    content: ReceptionContent,
    rightPanel: ReceptionRightPanel,
    rightPanelWidth: 380,
    defaultRightPanelOpen: false,
  },
  {
    id: "treatment",
    label: "진료/차트",
    icon: StethoscopeIcon,
    sidePanel: ChartSidePanel,
    contentHeader: ChartHeader,
    contentAside: ChartContentAside,
    content: ChartContent,
    slotAvailabilityProvider: ChartSlotAvailabilityProvider,
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
    slotAvailabilityProvider: LabSlotAvailabilityProvider,
    rightPanelGap: true,
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
    slotAvailabilityProvider: ImagingSlotAvailabilityProvider,
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
    slotAvailabilityProvider: DispensingSlotAvailabilityProvider,
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
    contentAside: BillingContentAside,
    content: BillingContent,
    rightPanel: BillingRightPanel,
    slotAvailabilityProvider: BillingSlotAvailabilityProvider,
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
