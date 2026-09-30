import { createElement } from "react";
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
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
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

function FixedEmptyMainContentHeader() {
  return createElement(EmrMainContentHeader, {
    "aria-hidden": true,
    heightMode: "fixed",
  });
}

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
    documentLayout: {
      narrowWidth: 1040,
      historyPanelId: "chart-content-aside",
      historyLabel: "차트 이력",
    },
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
    documentLayout: {
      narrowWidth: 1120,
      historyPanelId: "lab-content-aside",
      historyLabel: "임상병리검사 이력",
      rightPanelId: "lab-receipt-panel",
      rightLabel: "장비 검사 수신함",
    },
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
    documentLayout: {
      narrowWidth: 1280,
      historyPanelId: "imaging-content-aside",
      historyLabel: "영상검사 이력",
      rightPanelId: "imaging-summary-panel",
      rightLabel: "종합소견",
    },
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
    documentLayout: {
      narrowWidth: 1120,
      historyPanelId: "dispensing-content-aside",
      historyLabel: "조제/처치 이력",
    },
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
    documentLayout: {
      narrowWidth: 1120,
      historyPanelId: "billing-content-aside",
      historyLabel: "수납이력",
      rightPanelId: "billing-summary-panel",
      rightLabel: "수납 요약",
    },
    slotAvailabilityProvider: BillingSlotAvailabilityProvider,
    defaultRightPanelOpen: true,
  },
  {
    id: "inpatient",
    label: "입원",
    icon: BedIcon,
    contentHeader: FixedEmptyMainContentHeader,
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
