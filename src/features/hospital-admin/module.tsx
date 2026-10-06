"use client";

import { useModuleSidePanel, useModuleSidePanelPathname, useModuleSidePanelRouter, useModuleSidePanelSearchParams } from "@/components/emr/module-side-panel-context";

import { LabResultProfileSelection } from "@/features/lab-imaging/components/result-profile-selection";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingFn,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrRequiredIndicator } from "@/components/emr/required-indicator";
import {
  EmrModuleListSidePanel,
  EmrModuleListSidePanelBadge,
  type EmrModuleListSidePanelItem,
  type EmrModuleListSidePanelSectionChild,
} from "@/components/emr/module-list-side-panel";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import {
  EmrPinnedTableWorkspace,
  EmrTableCellText,
  EmrTableFeedbackSurface,
  EmrTableIdentityCellContent,
} from "@/components/emr/table-primitives";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";
import { EmrTableWorkspaceHeader } from "@/components/emr/table-workspace-header";
import {
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getEmrTableFilterBuilderActiveCount,
  type EmrTableFilterBuilderField,
} from "@/components/emr/table-filter-builder-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ActivityIcon,
  BuildingIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  DatabaseIcon,
  DocumentCheckIcon,
  DocumentIcon,
  FolderIcon,
  GridIcon,
  LayersIcon,
  PrinterIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersIcon,
  UsersIcon,
} from "@/components/icons";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import {
  deliveryLabels,
  formatHospitalOrderAmount,
  buildWorkspaceCatalogMutationFromHospitalOrder,
  buildWorkspaceCatalogPauseMutation,
  buildWorkspaceDispensingReviewMutation,
  calculateHospitalDispenseQuantity,
  clinicalPathologyCategoryOptions,
  getHospitalOrderCategory,
  formatHospitalOrderClassification,
  isHospitalOrderInCategory,
  getHospitalOrderTaxonomyFields,
  isHospitalOrderTaxonomyChanged,
  isHospitalOrderTaxonomyOnlyChange,
  getHospitalOrderSubcategory,
  mapWorkspaceCatalogItemToHospitalOrder,
  mapWorkspaceCatalogItemsToHospitalOrders,
  roundRuleLabels,
  saleUnitLabels,
  serviceItemTypeLabels,
  targetLabels,
  type HospitalOrderCatalogItem,
  type HospitalOrderCategoryId,
  type HospitalOrderDraft,
  type HospitalOrderSubcategoryId,
} from "@/features/hospital-admin/data";
import { getHospitalOrderCoreDetails, getHospitalOrderCoreStatus } from "@/features/hospital-admin/order-core-details";
import { isOrderTaxonomyValid, orderTaxonomySubcategories, orderTaxonomyLabFamilies } from "@/features/hospital-admin/order-taxonomy";
import {
  getClinicalOrderFieldSchema,
  resolveClinicalOrderMasterContract,
  validateClinicalOrderDetailInputs,
  type ClinicalOrderFieldDefinition,
  type ClinicalOrderMasterContract,
} from "@/features/chart/order-execution-domain";
import type { ClinicalOrderType } from "@/types/emr-domain";
import { parsePlanOrderAuthority, type PlanOrderPreparationPolicy, type PlanOrderAuthorityConfig } from "@/features/chart/plan-order-authority-domain";
import { WorkspaceMembershipManagement } from "@/features/auth/workspace-membership-management";
import { HospitalBasicSettingsScreen } from "@/features/hospital-admin/settings/hospital-basic-settings-screen";
import { HospitalContactSettingsScreen } from "@/features/hospital-admin/settings/hospital-contact-settings-screen";
import { HospitalOperatingHoursSettingsScreen } from "@/features/hospital-admin/settings/hospital-operating-hours-settings-screen";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { HospitalScheduleScreen } from "@/features/hospital-admin/schedule/hospital-schedule-screen";
import { WorkspaceVitalSettingsScreen } from "@/features/hospital-admin/vital-settings/workspace-vital-settings-screen";
import { WorkspaceSpaceManagementScreen } from "@/features/hospital-admin/space-management/screen";
import { RolePermissionManagementScreen } from "@/features/hospital-admin/role-permission-management/screen";
import { OrderSetsPanel } from "@/features/hospital-admin/order-sets-panel";
import {
  useHospitalAdminStore,
  emptyHospitalOrders,
  deniedCatalogCapabilities,
  type HospitalAdminSection,
} from "@/features/hospital-admin/store";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  EmrTableCellTextMode,
  EmrTableDensity,
} from "@/components/emr/table-density";
import type {
  OrderCatalogAdminCapabilities,
  OrderCatalogItem,
  OrderCatalogMutationInput,
} from "@/features/hospital-admin/server-order-catalog";
import type { ShellComponentProps } from "@/types/emr";

const orderSetPlaceholderId = "order-set-placeholder";
const hospitalAdminSections = new Set<HospitalAdminSection>([
  "audit",
  "members",
  "orders",
  "order-sets",
  "roles",
  "schedule",
  "settings",
  "settings-contact",
  "settings-hours",
  "space-time",
  "vitals",
]);

const drawerTabs = [
  { label: "부가정보", value: "meta" },
  { label: "참조값", value: "reference" },
] as const;

type DrawerTab = (typeof drawerTabs)[number]["value"];

const hospitalOrderSelectionColumnWidth = 44;
const hospitalOrderIdentityColumnWidth = 180;
type HospitalOrderTableFilterOption = {
  label: string;
  value: string;
};

const hospitalOrderNameTextMode: EmrTableCellTextMode = "two-line-if-long";
const hospitalOrderStatusFilterOptions: HospitalOrderTableFilterOption[] = [
  { label: "사용", value: "active" },
  { label: "중지", value: "inactive" },
];
const hospitalOrderBillingFilterOptions: HospitalOrderTableFilterOption[] = [
  { label: "청구 가능", value: "billable" },
  { label: "비청구", value: "not-billable" },
];
const hospitalDispensingDoseUnitLabels: Record<string, string> = {
  capsule: "캡슐",
  g: "g",
  ml: "mL",
  sachet: "포",
  tablet: "정",
};
const hospitalDispensingRouteLabels: Record<string, string> = {
  CRI: "지속정주(CRI)",
  IM: "근육(IM)",
  IV: "정맥(IV)",
  PO: "경구(PO)",
  SC: "피하(SC)",
  inhalation: "흡입",
  nasal: "비강",
  ophthalmic: "안과",
  oromucosal: "구강점막",
  other: "기타",
  otic: "귀",
  topical: "외용",
  transdermal: "경피",
};
const hospitalDispensingFrequencyLabels: Record<string, string> = {
  bid: "하루 2회(BID)",
  once: "1회",
  qid: "하루 4회(QID)",
  qod: "격일(QOD)",
  sid: "하루 1회(SID)",
  tid: "하루 3회(TID)",
};
const hospitalDispensingInstructionLabels: Record<string, string> = {
  after_meal: "식후",
  any_time: "시간 무관",
  before_meal: "식전",
  with_meal: "식사와 함께",
};
const hospitalDispensingStorageLabels: Record<string, string> = {
  refrigerated: "냉장",
  refrigerated_light_protected: "냉장·차광",
  room_temp: "실온",
  room_temp_light_protected: "실온·차광",
};
const hospitalDispensingReviewLabels = {
  approved: "수의사 승인",
  clinical_reviewed: "임상 검토 완료",
  clinical_unreviewed: "임상 미검토",
  not_required: "해당 없음",
  pending: "검토 대기",
  rejected: "반려",
} as const;
type HospitalDispensingReviewKey = keyof typeof hospitalDispensingReviewLabels;

function formatHospitalDispensingNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "미설정";
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(3)));
}

function formatHospitalDispensingAmount(value: number | undefined, unit: string) {
  if (value === undefined || !Number.isFinite(value) || !unit) return "미설정";
  const unitLabel = hospitalDispensingDoseUnitLabels[unit] ?? unit;
  return `${formatHospitalDispensingNumber(value)}${unitLabel}`;
}

function getHospitalDispensingReviewKey(
  order: HospitalOrderDraft,
): HospitalDispensingReviewKey {
  if (order.sourceKind === "clair_master") {
    const source = order.sourceCatalogItem;
    return source?.medicationMetadata?.presetStatus === "clinically_reviewed" &&
      source.dispensingLineage?.clinicalUseAllowed === true
      ? "clinical_reviewed"
      : "clinical_unreviewed";
  }

  if (order.dispensingReviewStatus === "approved") return "approved";
  if (order.dispensingReviewStatus === "pending") return "pending";
  if (order.dispensingReviewStatus === "rejected") return "rejected";
  return "not_required";
}

function getHospitalDispensingTableDetails(order: HospitalOrderDraft) {
  const preset = order.dispensingPreset;
  const ingredient = preset?.ingredientName.trim() ?? "";
  const ingredientStrength = [ingredient, order.dispensingStrength]
    .filter(Boolean)
    .join(" · ");
  const reviewKey = getHospitalDispensingReviewKey(order);

  return {
    dosageForm: order.dispensingDosageForm ?? "",
    dose: preset?.dose,
    doseLabel: preset
      ? formatHospitalDispensingAmount(preset.dose, preset.doseUnit)
      : "",
    durationDays: preset?.durationDays,
    durationLabel: preset?.durationDays !== undefined
      ? `${formatHospitalDispensingNumber(preset.durationDays)}일`
      : "",
    frequency: preset?.frequency ?? "",
    frequencyLabel: preset
      ? (hospitalDispensingFrequencyLabels[preset.frequency] ??
        preset.frequency)
      : "",
    ingredientStrength,
    medicationInstruction: preset?.medicationInstruction ?? "",
    medicationInstructionLabel: preset
      ? (hospitalDispensingInstructionLabels[preset.medicationInstruction] ??
        preset.medicationInstruction)
      : "",
    reviewKey,
    reviewLabel: hospitalDispensingReviewLabels[reviewKey],
    route: preset?.route ?? "",
    routeLabel: preset
      ? (hospitalDispensingRouteLabels[preset.route] ?? preset.route)
      : "",
    storageMethod: preset?.storageMethod ?? "",
    storageMethodLabel: preset
      ? (hospitalDispensingStorageLabels[preset.storageMethod] ??
        preset.storageMethod)
      : "",
    totalQuantity: preset?.totalQuantity,
    totalQuantityLabel: preset
      ? formatHospitalDispensingAmount(
          preset.totalQuantity,
          preset.totalQuantityUnit,
        )
      : "",
  };
}

function HospitalOrderTableCellValue({
  className,
  mode = "one-line",
  value,
}: {
  className?: string;
  mode?: EmrTableCellTextMode;
  value?: string | null;
}) {
  const text = value?.trim() || "미설정";

  return (
    <EmrTableCellText
      className={cn(!value?.trim() && "text-muted-foreground", className)}
      fullText={text}
      mode={mode}
    >
      {text}
    </EmrTableCellText>
  );
}

type HospitalOrderTableDetailField = {
  clinicalOrderType: ClinicalOrderType;
  definition: ClinicalOrderFieldDefinition;
};

const hospitalOrderTableClinicalTypeOrder: ClinicalOrderType[] = [
  "consultation",
  "clinical_lab",
  "imaging",
  "external_lab",
  "treatment",
  "hospitalization",
  "system_exam",
  "other",
  "dispensing",
];

function getHospitalOrderTableDetailFields(
  orders: HospitalOrderCatalogItem[],
): HospitalOrderTableDetailField[] {
  const fields = new Map<string, HospitalOrderTableDetailField>();

  orders.forEach((order) => {
    getHospitalOrderCoreDetails(order).forEach(({ clinicalOrderType, definition }) => {
      if (clinicalOrderType === "dispensing") return;
      fields.set(clinicalOrderType + ":" + definition.key, { clinicalOrderType, definition });
    });
  });

  return [...fields.values()].sort((left, right) => {
    const typeOrder =
      hospitalOrderTableClinicalTypeOrder.indexOf(left.clinicalOrderType) -
      hospitalOrderTableClinicalTypeOrder.indexOf(right.clinicalOrderType);

    return (
      typeOrder || left.definition.displayOrder - right.definition.displayOrder
    );
  });
}

function formatHospitalOrderTableDetailValue(
  definition: ClinicalOrderFieldDefinition,
  value: unknown,
) {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    if (definition.valueType === "attachment_array") {
      return value.length > 0 ? `${value.length}개` : "";
    }

    return value
      .map((item) => formatHospitalOrderDetailOption(String(item)))
      .join(", ");
  }

  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (typeof value === "number") {
    const formatted = new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 3,
    }).format(value);

    if (!definition.unit) return formatted;
    return definition.unit === "view"
      ? `${formatted} ${definition.unit}`
      : `${formatted}${definition.unit}`;
  }

  const formatted = String(value);
  return definition.control === "select"
    ? formatHospitalOrderDetailOption(formatted)
    : formatted;
}

function getHospitalOrderTableDetailColumnSize(
  definition: ClinicalOrderFieldDefinition,
) {
  if (definition.control === "switch" || definition.control === "number") {
    return { maxSize: 144, minSize: 88, size: 112 };
  }
  if (
    definition.control === "textarea" ||
    definition.control === "schedule" ||
    definition.control === "attachments"
  ) {
    return { maxSize: 320, minSize: 160, size: 220 };
  }
  return { maxSize: 260, minSize: 120, size: 160 };
}

function getHospitalOrderTableDetailTextMode(
  definition: ClinicalOrderFieldDefinition,
): EmrTableCellTextMode {
  return definition.control === "textarea" ||
    definition.control === "schedule" ||
    definition.control === "attachments"
    ? "two-line-if-long"
    : "one-line";
}
type OrderMenuChild = {
  label: string;
  categoryId?: HospitalOrderCategoryId;
  clinicalOrderType?: ClinicalOrderType;
  disabled?: boolean;
  subcategoryId?: HospitalOrderSubcategoryId;
};

type OrderMenuGroup = {
  children: OrderMenuChild[];
  id: string;
  label: string;
};

type HospitalAdminMenuItem = {
  group: "hospital" | "organization" | "catalog";
  icon: typeof SettingsIcon;
  label: string;
  section?: HospitalAdminSection;
  testId?: string;
};

const hospitalAdminMenuItems: HospitalAdminMenuItem[] = [
  {
    group: "hospital",
    label: "병원 기본 설정",
    icon: SettingsIcon,
    section: "settings",
    testId: "hospital-admin-menu-settings",
  },
  {
    group: "hospital",
    label: "연락처 및 채널",
    icon: UsersIcon,
    section: "settings-contact",
    testId: "hospital-admin-menu-settings-contact",
  },
  {
    group: "hospital",
    label: "운영시간 관리",
    icon: CalendarIcon,
    section: "settings-hours",
    testId: "hospital-admin-menu-settings-hours",
  },
  {
    group: "hospital",
    label: "공간 관리",
    icon: BuildingIcon,
    section: "space-time",
    testId: "hospital-admin-menu-space-time",
  },
  {
    group: "hospital",
    label: "바이탈 관리",
    icon: ActivityIcon,
    section: "vitals",
    testId: "hospital-admin-menu-vitals",
  },
  { group: "hospital", label: "진료과 분리운영", icon: LayersIcon },
  {
    group: "organization",
    label: "병원 구성원",
    icon: UsersIcon,
    section: "members",
    testId: "hospital-admin-menu-members",
  },
  {
    group: "organization",
    label: "역할 및 권한",
    icon: GridIcon,
    section: "roles",
    testId: "hospital-admin-menu-roles",
  },
  {
    group: "organization",
    label: "근무표",
    icon: CalendarIcon,
    section: "schedule",
    testId: "hospital-admin-menu-schedule",
  },
  {
    group: "organization",
    label: "감사 로그",
    icon: DocumentCheckIcon,
    section: "audit",
    testId: "hospital-admin-menu-audit",
  },
  { group: "catalog", label: "차트 템플릿", icon: ClipboardListIcon },
  { group: "catalog", label: "장비 관리", icon: DatabaseIcon },
  { group: "catalog", label: "마약류 관리", icon: ShieldIcon },
];

const orderMenuGroups: OrderMenuGroup[] = [
  {
    id: "general",
    label: "전체",
    children: [{ label: "분류 확인 필요", categoryId: "unclassified", subcategoryId: "unclassified" }],
  },
  {
    id: "care",
    label: "진료",
    children: [
      {
        label: "기본 진료비",
        categoryId: "consultation" as const,
        subcategoryId: "basic-consultation" as const,
      },
      {
        label: "기타 진료비",
        categoryId: "consultation" as const,
        subcategoryId: "other-consultation" as const,
      },
    ],
  },
  {
    id: "prevention",
    label: "예방",
    children: [
      {
        label: "예방",
        categoryId: "prevention" as const,
        subcategoryId: "prevention" as const,
      },
    ],
  },
  {
    id: "lab",
    label: "검사",
    children: [
      {
        label: "영상검사",
        categoryId: "imaging" as const,
        subcategoryId: "radiography" as const,
      },
      {
        label: "임상병리 검사",
        categoryId: "lab" as const,
        subcategoryId: "clinical-pathology" as const,
      },
      {
        label: "계통 검사",
        categoryId: "lab" as const,
        clinicalOrderType: "system_exam",
        subcategoryId: "system-exam" as const,
      },
      {
        label: "의뢰 검사",
        categoryId: "lab" as const,
        subcategoryId: "external-lab" as const,
      },
    ],
  },
  {
    id: "procedure",
    label: "처치",
    children: [
      {
        label: "처치",
        categoryId: "treatment" as const,
        subcategoryId: "basic-treatment" as const,
      },
    ],
  },
  {
    id: "surgery",
    label: "수술",
    children: [
      {
        label: "마취",
        categoryId: "surgery" as const,
        subcategoryId: "anesthesia" as const,
      },
      {
        label: "수술",
        categoryId: "surgery" as const,
        subcategoryId: "surgery" as const,
      },
    ],
  },
  {
    id: "inpatient",
    label: "입원",
    children: [
      {
        label: "입원",
        categoryId: "hospitalization" as const,
        subcategoryId: "hospitalization" as const,
      },
    ],
  },
  {
    id: "therapy",
    label: "치료",
    children: [
      {
        label: "치료",
        categoryId: "therapy" as const,
        subcategoryId: "therapy" as const,
      },
    ],
  },
  {
    id: "other",
    label: "기타",
    children: [
      {
        label: "기타",
        categoryId: "misc" as const,
        clinicalOrderType: "other",
        subcategoryId: "other" as const,
      },
    ],
  },
  {
    id: "inventory",
    label: "처방/조제/의료물품",
    children: [
      {
        label: "처방",
        categoryId: "dispensing" as const,
        subcategoryId: "oral-medication" as const,
      },
      {
        label: "조제",
        categoryId: "dispensing" as const,
        subcategoryId: "injection" as const,
      },
      {
        label: "의료물품",
        categoryId: "medical-supply" as const,
        subcategoryId: "medical-supply" as const,
      },
    ],
  },
];

// Extend navigation with the explicit vocabulary, not with order names or data.
for (const [code, definition] of Object.entries(orderTaxonomySubcategories)) {
  const group = orderMenuGroups.find(group => group.children.some(child => child.categoryId === definition.parent));
  if (group && !group.children.some(child => child.subcategoryId === code)) {
    group.children.push({ label: definition.label, categoryId: definition.parent, subcategoryId: code as HospitalOrderSubcategoryId });
  }
}

const auditEventFilterItems = [
  { label: "전체", value: "all" },
  { label: "구성원 역할 변경", value: "workspace.membership_roles_changed" },
  { label: "구성원 상태 변경", value: "workspace.membership_status_changed" },
  { label: "현장 접수", value: "reception.walk_in_created" },
  { label: "예약 생성", value: "reception.appointment_created" },
  { label: "접수 수정", value: "reception.encounter_updated" },
  { label: "예약 체크인", value: "reception.appointment_checked_in" },
  { label: "SOAP 저장", value: "chart.soap_saved" },
  { label: "차트 완료", value: "chart.completed" },
  { label: "오더 확정", value: "order.confirmed" },
  { label: "결제 상태", value: "billing.payment_state_changed" },
];

const auditEventLabels: Record<string, string> = {
  "workspace.membership_roles_changed": "구성원 역할 변경",
  "workspace.membership_status_changed": "구성원 상태 변경",
  "reception.walk_in_created": "현장 접수",
  "reception.appointment_created": "예약 생성",
  "reception.appointment_checked_in": "예약 체크인",
  "reception.encounter_updated": "접수 수정",
  "chart.soap_saved": "SOAP 저장",
  "chart.completed": "차트 완료",
  "order.confirmed": "오더 확정",
  "order.billing_candidate_requested": "오더 청구 요청",
  "billing.payment_state_changed": "결제 상태 변경",
};

type AuditReviewEventRow = {
  id: string;
  actorUserId?: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  encounterId?: string | null;
  occurredAt: string;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type OrderCatalogAdminReadResponse =
  | {
      ok: true;
      items: OrderCatalogItem[];
      capabilities: OrderCatalogAdminCapabilities;
    }
  | { ok: false; denialReason?: string; error?: string };

type OrderCatalogAdminMutationResponse =
  | { ok: true; item: OrderCatalogItem }
  | { ok: false; denialReason?: string; error?: string };

type OrderCatalogMutationStatus =
  | "idle"
  | "saving"
  | "reviewing"
  | "stopping"
  | "saved"
  | "denied"
  | "error";

async function mutateHospitalAdminOrderCatalog({
  input,
  method,
  session,
  workspaceId,
}: {
  input: OrderCatalogMutationInput;
  method: "POST" | "PATCH";
  session: AuthSession;
  workspaceId: string;
}): Promise<OrderCatalogAdminMutationResponse> {
  try {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog`,
    {
      method,
      headers: {
        ...getDemoActorHeaders(session),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  const body = (await response.json()) as OrderCatalogAdminMutationResponse;

  if (!response.ok || !body.ok) {
    return {
      ok: false,
      denialReason: !body.ok ? body.denialReason : undefined,
      error: !body.ok ? body.error : "request_failed",
    };
  }

  if (body.item.workspaceId !== workspaceId || (input.action !== "create" && "itemId" in input && body.item.id !== input.itemId)) {
    return { ok: false, error: "catalog_response_invalid" };
  }
  return body;
  } catch {
    return { ok: false, error: "request_failed" };
  }
}

function validateHospitalOrderDraft(
  draft: HospitalOrderDraft,
  options: { creating: boolean } = { creating: false },
) {
  const source = draft.sourceCatalogItem;
  if (options.creating || (source && isHospitalOrderTaxonomyChanged(draft, source))) {
    const taxonomy = getHospitalOrderTaxonomyFields(draft);
    if (!isOrderTaxonomyValid(draft.clinicalOrderType, taxonomy.adminSubcategoryCode, taxonomy.labFamilyCode)) {
      return "업무유형에 맞는 세부 분류와 검사 계열을 선택해 주세요.";
    }
    // A classification repair must not require unrelated missing clinical values.
    if (source && isHospitalOrderTaxonomyOnlyChange(draft, source)) return null;
  }
  if (!draft.standardName.trim()) return "표준 Order명을 입력해 주세요.";
  if (!draft.inHospitalName.trim()) return "원내 Order명을 입력해 주세요.";
  if (!draft.billingName.trim()) return "청구서명을 입력해 주세요.";
  if (!draft.delivery) return "일감전달여부를 선택해 주세요.";
  if (!draft.target) return "대상을 선택해 주세요.";
  if (!draft.saleUnit) return "판매 단위를 선택해 주세요.";
  if (options.creating && (!Number.isFinite(draft.price) || draft.price < 0)) {
    return "판매금액을 입력해 주세요.";
  }
  if (!Number.isFinite(draft.price) || draft.price < 0)
    return "판매금액은 0원 이상이어야 합니다.";

  if (draft.categoryId === "dispensing") {
    if (!parsePlanOrderAuthority(draft.defaultDetailInputs?.planOrderAuthority).valid) return "준비량 계산 규칙의 계량 단위·표시 자릿수를 확인해 주세요.";
    const preset = draft.dispensingPreset;
    if (!preset) return "조제 기본값을 입력해 주세요.";
    if (!preset.ingredientName.trim())
      return "성분 또는 조제 내용을 입력해 주세요.";
    if (typeof preset.dose !== "number" || !Number.isFinite(preset.dose) || preset.dose <= 0)
      return "1회 용량은 0보다 커야 합니다.";
    if (!preset.doseUnit.trim()) return "용량 단위를 입력해 주세요.";
    if (!preset.route.trim()) return "투여 경로를 선택해 주세요.";
    if (!preset.frequency.trim()) return "투여 빈도를 선택해 주세요.";
    if (typeof preset.durationDays !== "number" || !Number.isFinite(preset.durationDays) || preset.durationDays <= 0)
      return "투여 일수는 0보다 커야 합니다.";
    if (typeof preset.totalQuantity !== "number" || !Number.isFinite(preset.totalQuantity) || preset.totalQuantity <= 0)
      return "처방 총량은 0보다 커야 합니다.";
    if (!preset.totalQuantityUnit.trim())
      return "총량 단위를 입력해 주세요.";
    if (typeof preset.autoDispenseQuantityEnabled !== "boolean") return "총량 계산 방식을 선택해 주세요.";
    const calculatedQuantity = calculateHospitalDispenseQuantity(preset, draft.defaultDetailInputs?.planOrderAuthority);
    if (preset.autoDispenseQuantityEnabled && calculatedQuantity === undefined) {
      return "자동 계산에 필요한 용량 기준·단위·빈도를 확인해 주세요.";
    }
    if (
      preset.autoDispenseQuantityEnabled && calculatedQuantity !== undefined &&
      Math.abs(
        preset.totalQuantity - calculatedQuantity,
      ) > 0.001
    ) {
      return "자동 계산 총량과 처방 총량이 일치하지 않습니다.";
    }
    if (
      !preset.autoDispenseQuantityEnabled &&
      !preset.manualQuantityReason.trim()
    ) {
      return "수동 총량 보정 사유를 입력해 주세요.";
    }
  }

  const detailContract = getHospitalOrderDetailContract(draft);
  if (
    detailContract &&
    detailContract.clinicalOrderType !== "dispensing"
  ) {
    const validation = validateClinicalOrderDetailInputs({
      clinicalOrderType: detailContract.clinicalOrderType,
      detailInputs: draft.defaultDetailInputs ?? {},
      requireComplete: false,
      schemaVersion: detailContract.detailSchemaVersion,
    });
    if (!validation.valid) return "기본 세부값의 형식이나 선택값을 확인해 주세요.";
  }

  return null;
}

function getHospitalOrderDetailContract(
  draft: HospitalOrderDraft,
): ClinicalOrderMasterContract | null {
  const source = draft.sourceCatalogItem;
  if (!source || !draft.clinicalOrderType) return null;

  try {
    return resolveClinicalOrderMasterContract({
      categoryGroup: source.categoryGroup,
      clinicalOrderType: draft.clinicalOrderType ?? source.clinicalOrderType,
      isExternalLab: source.isExternalLab,
      destinationModule: source.destinationModule,
      defaultDestinationModule: source.defaultDestinationModule,
      executionMode: source.executionMode,
      defaultTaskRequired: source.defaultTaskRequired,
      detailSchemaVersion:
        draft.detailSchemaVersion ?? source.detailSchemaVersion,
      detailFieldSchema: source.detailFieldSchema,
      billingEligible: source.billingEligible,
      billingReflectionEnabled: source.billingReflectionEnabled,
    });
  } catch {
    return null;
  }
}

function getNewOrderDrawerTitle(subcategoryLabel?: string) {
  if (subcategoryLabel === "임상병리 검사") return "임상병리 오더 추가";
  if (!subcategoryLabel) return "오더 추가";

  return `${subcategoryLabel} 오더 추가`;
}

function getOrderCatalogMutationFailureMessage(
  result: Extract<OrderCatalogAdminMutationResponse, { ok: false }>,
) {
  if (result.denialReason === "permission_missing") {
    return "일반 Order는 병원관리자, 조제 Order는 병원관리자 또는 수의사가 작성할 수 있으며 승인은 수의사만 가능합니다.";
  }
  if (result.denialReason === "order_not_found") {
    return "변경할 Order를 찾지 못했습니다. 목록을 새로고침해 주세요.";
  }
  if (result.error === "invalid_input") {
    return "필수값이나 금액 형식이 올바르지 않습니다.";
  }
  if (result.error === "catalog_revision_conflict") {
    return "다른 관리자가 먼저 변경했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.";
  }

  return "Order 변경을 저장하지 못했습니다.";
}

function getVisibleOrders(
  orders: HospitalOrderCatalogItem[],
  {
    searchQuery,
    selectedCategoryId,
    selectedSubcategoryId,
  }: {
    searchQuery: string;
    selectedCategoryId: string;
    selectedSubcategoryId: string;
  },
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return orders
    .filter((order) => isHospitalOrderInCategory(order, selectedCategoryId, selectedSubcategoryId))
    .filter((order) => {
      if (!normalizedQuery) return true;
      const dispensingDetails = getHospitalDispensingTableDetails(order);

      return [
        order.aliases,
        order.billingName,
        dispensingDetails.dosageForm,
        dispensingDetails.ingredientStrength,
        order.inHospitalName,
        order.standardName,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((left, right) => left.standardName.localeCompare(right.standardName));
}

function compareHospitalOrderValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";

  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof left === "number" && typeof right === "number")
    return left - right;

  return String(left).localeCompare(String(right), "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

const compareHospitalOrderRows: SortingFn<HospitalOrderCatalogItem> = (
  left,
  right,
  id,
) => compareHospitalOrderValues(left.getValue(id), right.getValue(id));

function getUniqueHospitalOrderFilterOptions(
  orders: HospitalOrderCatalogItem[],
  getValue: (order: HospitalOrderCatalogItem) => string,
  labels: Record<string, string>,
): HospitalOrderTableFilterOption[] {
  const values = new Set(orders.map(getValue).filter(Boolean));

  return Array.from(values)
    .map((value) => ({ label: labels[value] ?? value, value }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, "ko-KR", {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

function parseHospitalOrderPriceFilterValue(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getHospitalOrderTableFilterFields(
  orders: HospitalOrderCatalogItem[],
  selectedCategoryId: HospitalOrderCategoryId,
  selectedSubcategoryId: HospitalOrderSubcategoryId,
): Array<EmrTableFilterBuilderField<HospitalOrderCatalogItem>> {
  const fields: Array<EmrTableFilterBuilderField<HospitalOrderCatalogItem>> = [
    {
      getValue: (order) => (order.isActive ? "active" : "inactive"),
      id: "status",
      label: "사용여부",
      operators: [{ id: "is", label: "Is" }],
      options: hospitalOrderStatusFilterOptions,
      valuePlaceholder: "사용여부 선택",
    },
    {
      getValue: (order) => order.target,
      id: "target",
      label: "대상",
      operators: [{ id: "is", label: "Is" }],
      options: getUniqueHospitalOrderFilterOptions(
        orders,
        (order) => order.target,
        targetLabels,
      ),
      valuePlaceholder: "대상 선택",
    },
    {
      getValue: (order) => (order.billable ? "billable" : "not-billable"),
      id: "billing",
      label: "청구",
      operators: [{ id: "is", label: "Is" }],
      options: hospitalOrderBillingFilterOptions,
      valuePlaceholder: "청구 선택",
    },
    {
      getValue: (order) => order.price,
      id: "price",
      label: "판매금액",
      operators: [
        {
          id: "gte",
          label: "이상",
          match: (fieldValue, ruleValue) => {
            const threshold = parseHospitalOrderPriceFilterValue(ruleValue);
            return threshold === null
              ? true
              : Number(fieldValue ?? 0) >= threshold;
          },
        },
        {
          id: "lte",
          label: "이하",
          match: (fieldValue, ruleValue) => {
            const threshold = parseHospitalOrderPriceFilterValue(ruleValue);
            return threshold === null
              ? true
              : Number(fieldValue ?? 0) <= threshold;
          },
        },
      ],
      valueKind: "text",
      valuePlaceholder: "금액 입력",
    },
  ];

  if (selectedCategoryId === "dispensing") {
    return [
      {
        getValue: (order) =>
          getHospitalDispensingTableDetails(order).dosageForm,
        id: "dispensingDosageForm",
        label: "제형",
        operators: [{ id: "is", label: "Is" }],
        options: getUniqueHospitalOrderFilterOptions(
          orders,
          (order) => getHospitalDispensingTableDetails(order).dosageForm,
          {},
        ),
        valuePlaceholder: "제형 선택",
      },
      {
        getValue: (order) => getHospitalDispensingTableDetails(order).route,
        id: "dispensingRoute",
        label: "투여 경로",
        operators: [{ id: "is", label: "Is" }],
        options: getUniqueHospitalOrderFilterOptions(
          orders,
          (order) => getHospitalDispensingTableDetails(order).route,
          hospitalDispensingRouteLabels,
        ),
        valuePlaceholder: "투여 경로 선택",
      },
      {
        getValue: (order) => getHospitalDispensingTableDetails(order).frequency,
        id: "dispensingFrequency",
        label: "투여 빈도",
        operators: [{ id: "is", label: "Is" }],
        options: getUniqueHospitalOrderFilterOptions(
          orders,
          (order) => getHospitalDispensingTableDetails(order).frequency,
          hospitalDispensingFrequencyLabels,
        ),
        valuePlaceholder: "투여 빈도 선택",
      },
      {
        getValue: (order) => getHospitalDispensingTableDetails(order).reviewKey,
        id: "dispensingReview",
        label: "검토 상태",
        operators: [{ id: "is", label: "Is" }],
        options: getUniqueHospitalOrderFilterOptions(
          orders,
          (order) => getHospitalDispensingTableDetails(order).reviewKey,
          hospitalDispensingReviewLabels,
        ),
        valuePlaceholder: "검토 상태 선택",
      },
      ...fields,
    ];
  }

  if (selectedSubcategoryId !== "clinical-pathology") return fields;

  return [
    {
      getValue: (order) => order.clinicalPathologyCategoryId,
      id: "clinicalPathologyCategory",
      label: "검사 카테고리",
      operators: [{ id: "is", label: "Is" }],
      options: clinicalPathologyCategoryOptions,
      valuePlaceholder: "검사 카테고리 선택",
    },
    ...fields,
  ];
}

function getSubcategoryCount(
  orders: HospitalOrderCatalogItem[],
  subcategoryId: string,
  categoryId: string,
) {
  return orders.filter((order) => isHospitalOrderInCategory(order, categoryId, subcategoryId)).length;
}

type HospitalAdminConceptSection = "vitals";

type HospitalAdminConceptField = {
  label: string;
  value: string;
  kind?: "input" | "select" | "switch" | "textarea";
  options?: string[];
};

type HospitalAdminConceptTable = {
  columns: string[];
  rows: string[][];
  title: string;
};

type HospitalAdminConceptScreenConfig = {
  badge: string;
  breadcrumb: string;
  description: string;
  fields: HospitalAdminConceptField[];
  highlights: Array<{ label: string; value: string }>;
  impactItems: string[];
  modelItems: string[];
  section: HospitalAdminConceptSection;
  table: HospitalAdminConceptTable;
  title: string;
};

const hospitalAdminConceptScreens: Record<
  HospitalAdminConceptSection,
  HospitalAdminConceptScreenConfig
> = {
  vitals: {
    section: "vitals",
    title: "바이탈 관리",
    badge: "임상 기준",
    breadcrumb: "병원관리 / 바이탈 관리",
    description: "차트와 입원 보드에서 쓰는 바이탈 정상 범위와 경고 기준",
    highlights: [
      { label: "종 기준", value: "개 · 고양이" },
      { label: "경고 기준", value: "6개" },
      { label: "차트 표시", value: "활성" },
      { label: "입원 강조", value: "활성" },
    ],
    fields: [
      {
        label: "기본 종",
        value: "개",
        kind: "select",
        options: ["개", "고양이"],
      },
      { label: "차트 입력 시 경고", value: "true", kind: "switch" },
      { label: "입원 보드 색상 강조", value: "true", kind: "switch" },
      {
        label: "체중 변화 경고",
        value: "10% 이상",
        kind: "select",
        options: ["5% 이상", "10% 이상", "15% 이상"],
      },
      {
        label: "통증 점수 기준",
        value: "5점 이상",
        kind: "select",
        options: ["4점 이상", "5점 이상", "6점 이상"],
      },
    ],
    table: {
      title: "기본 바이탈 정상 범위",
      columns: ["항목", "개", "고양이", "경고"],
      rows: [
        ["체온", "37.8-39.2℃", "38.0-39.3℃", "상/하한 초과"],
        ["심박", "60-140 bpm", "140-220 bpm", "상/하한 초과"],
        ["호흡", "10-30 rpm", "20-30 rpm", "상/하한 초과"],
        ["CRT", "1-2초", "1-2초", "3초 이상"],
        ["통증 점수", "0-4", "0-4", "5 이상"],
      ],
    },
    impactItems: [
      "차트 바이탈 입력",
      "입원 보드 경고",
      "처치 전 체크",
      "퇴원 전 확인",
    ],
    modelItems: [
      "workspace_vital_rules",
      "species_vital_ranges",
      "vital_alert_policies",
    ],
  },
};

function HospitalAdminConceptFieldControl({
  field,
}: {
  field: HospitalAdminConceptField;
}) {
  if (field.kind === "switch") {
    return (
      <div className="flex h-9 items-center rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-card px-3">
        <Switch
          defaultChecked={field.value === "true"}
          aria-label={field.label}
        />
      </div>
    );
  }

  if (field.kind === "select" && field.options?.length) {
    return (
      <Select defaultValue={field.value}>
        <SelectTrigger aria-label={field.label} size="sm" className="bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  if (field.kind === "textarea") {
    return (
      <Textarea
        aria-label={field.label}
        className="min-h-20 resize-none bg-card emr-text-dense"
        defaultValue={field.value}
      />
    );
  }

  return (
    <Input
      aria-label={field.label}
      className="h-9 bg-card emr-text-dense"
      defaultValue={field.value}
      readOnly={field.label === "워크스페이스 ID"}
    />
  );
}

function HospitalAdminConceptTable({
  table,
}: {
  table: HospitalAdminConceptTable;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-default)] bg-card">
      <div className="border-b border-[var(--emr-border-default)] px-4 py-3">
        <h2 className="emr-text-panel-title font-semibold">{table.title}</h2>
      </div>
      <Table aria-label={table.title} density="compact">
        <TableHeader className="bg-[var(--emr-surface-muted)]">
          <TableRow>
            {table.columns.map((column) => (
              <TableHead key={column} className="emr-text-dense-label">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row) => (
            <TableRow key={row.join("-")} className="bg-card">
              {row.map((cell, index) => (
                <TableCell
                  key={`${cell}-${index}`}
                  className={index === 0 ? "font-medium" : undefined}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export function HospitalAdminConceptScreen({
  section,
}: {
  section: HospitalAdminConceptSection;
}) {
  const config = hospitalAdminConceptScreens[section];
  const [savedLabel, setSavedLabel] = useState("시안 편집 중");

  const handleSave = () => {
    setSavedLabel("방금 시안 저장");
    toast.success(`${config.title} 화면 시안 상태를 저장했습니다.`);
  };

  const handleReset = () => {
    setSavedLabel("시안 편집 중");
    toast.message(`${config.title} 시안을 초기 상태로 되돌렸습니다.`);
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
      data-testid={`hospital-admin-${section}-screen`}
    >
      <section className="border-b bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7">
                {config.title}
              </h1>
              <Badge variant="secondary">{config.badge}</Badge>
            </div>
            <div className="mt-1 max-w-2xl emr-text-dense leading-5 text-muted-foreground">
              {config.breadcrumb}
            </div>
            <div className="mt-1 emr-text-metadata text-muted-foreground">
              {config.description} · {savedLabel}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleReset}>
              취소
            </Button>
            <Button size="sm" onClick={handleSave}>
              시안 저장
            </Button>
          </div>
        </div>
      </section>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-5">
          <section className="grid gap-3 md:grid-cols-4">
            {config.highlights.map((item) => (
              <div
                key={item.label}
                className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-default)] bg-card px-4 py-3"
              >
                <div className="emr-text-metadata text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 truncate text-[16px] font-semibold leading-6">
                  {item.value}
                </div>
              </div>
            ))}
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-w-0 gap-4">
              <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-default)] bg-card">
                <div className="border-b border-[var(--emr-border-default)] px-4 py-3">
                  <h2 className="emr-text-panel-title font-semibold">기본값</h2>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {config.fields.map((field) => (
                    <Field
                      key={field.label}
                      className={
                        field.kind === "textarea" ? "md:col-span-2" : undefined
                      }
                    >
                      <FieldLabel>{field.label}</FieldLabel>
                      <FieldContent>
                        <HospitalAdminConceptFieldControl field={field} />
                      </FieldContent>
                    </Field>
                  ))}
                </div>
              </section>

              <HospitalAdminConceptTable table={config.table} />
            </div>

            <aside className="grid content-start gap-4">
              <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-default)] bg-card">
                <div className="border-b border-[var(--emr-border-default)] px-4 py-3">
                  <h2 className="emr-text-panel-title font-semibold">
                    영향 범위
                  </h2>
                </div>
                <div className="grid gap-2 p-3">
                  {config.impactItems.map((item) => (
                    <div
                      key={item}
                      className="rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)] px-3 py-2 emr-text-dense"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-default)] bg-card">
                <div className="border-b border-[var(--emr-border-default)] px-4 py-3">
                  <h2 className="emr-text-panel-title font-semibold">
                    향후 데이터
                  </h2>
                </div>
                <div className="grid gap-2 p-3">
                  {config.modelItems.map((item) => (
                    <Badge
                      key={item}
                      variant="outline"
                      className="w-fit rounded-md"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function useHospitalCatalogRead(workspaceId: string, enabled: boolean, catalogRetryKey = 0) {
  const { hydrated, hydrate, session } = useAuthClient();
  const beginCatalogLoad = useHospitalAdminStore((state) => state.beginCatalogLoad);
  const finishCatalogLoad = useHospitalAdminStore((state) => state.finishCatalogLoad);
  useEffect(() => {
    if (enabled) hydrate();
  }, [enabled, hydrate]);

  useEffect(() => {
    if (!enabled || !hydrated) return;

    const controller = new AbortController();
    let canceled = false;

    const loadCatalog = async () => {
      await Promise.resolve();
      if (canceled) return;
      const generation = beginCatalogLoad(workspaceId);

      if (!session) {
        finishCatalogLoad(workspaceId, generation, { status: "denied" });
        return;
      }

      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog`,
          {
            headers: getDemoActorHeaders(session),
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as OrderCatalogAdminReadResponse;
        if (canceled) return;

        if (!response.ok || !body.ok) {
          finishCatalogLoad(workspaceId, generation, { status:
            response.status === 401 || response.status === 403
              ? "denied"
              : "error",
          });
          return;
        }

        finishCatalogLoad(workspaceId, generation, { status: "ready",
          orders: mapWorkspaceCatalogItemsToHospitalOrders(body.items),
          capabilities: body.capabilities ?? deniedCatalogCapabilities,
        });
      } catch (error: unknown) {
        if (canceled || (error as { name?: string }).name === "AbortError") return;
        finishCatalogLoad(workspaceId, generation, { status: "error" });
      }
    };

    void loadCatalog();

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [
    catalogRetryKey,
    enabled,
    hydrated,
    session,
    beginCatalogLoad,
    finishCatalogLoad,
    workspaceId,
  ]);

  return session;
}

export function HospitalAdminSidePanel({ moduleLabel, workspaceId }: ShellComponentProps) {
  const panelPresentation = useModuleSidePanel();
  useHospitalCatalogRead(workspaceId, Boolean(panelPresentation?.visible && !panelPresentation.isCurrentModule));
  const pathname = useModuleSidePanelPathname();
  const router = useModuleSidePanelRouter();
  const searchParams = useModuleSidePanelSearchParams();
  const activeSection = useHospitalAdminStore((state) => state.activeSection);
  const cancelPendingSectionChange = useHospitalAdminStore(
    (state) => state.cancelPendingSectionChange,
  );
  const confirmPendingSectionChange = useHospitalAdminStore(
    (state) => state.confirmPendingSectionChange,
  );
  const orders = useHospitalAdminStore((state) => state.catalogWorkspaceId === workspaceId && state.catalogReadStatus === "ready" ? state.orders : emptyHospitalOrders);
  const pendingSection = useHospitalAdminStore((state) => state.pendingSection);
  const requestSectionChange = useHospitalAdminStore(
    (state) => state.requestSectionChange,
  );
  const selectedCategoryId = useHospitalAdminStore(
    (state) => state.selectedCategoryId,
  );
  const selectedSubcategoryId = useHospitalAdminStore(
    (state) => state.selectedSubcategoryId,
  );
  const settingsDirty = useHospitalAdminStore((state) => state.settingsDirty);
  const setSelectedCategoryId = useHospitalAdminStore(
    (state) => state.setSelectedCategoryId,
  );
  const setSelectedSubcategoryId = useHospitalAdminStore(
    (state) => state.setSelectedSubcategoryId,
  );
  const discardAllSettingsDrafts = useHospitalBasicSettingsStore(
    (state) => state.discardAllDrafts,
  );
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["orders"]),
  );
  const [pendingOrderSelection, setPendingOrderSelection] = useState<{
    categoryId: HospitalOrderCategoryId;
    subcategoryId: HospitalOrderSubcategoryId;
  } | null>(null);
  const guardedSections = new Set<HospitalAdminSection>([
    "settings",
    "settings-contact",
    "settings-hours",
    "roles",
  ]);
  const pushSection = (section: HospitalAdminSection) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("section", section);
    router.push(`${pathname}?${nextSearchParams.toString()}`);
  };
  const navigateToSection = (section: HospitalAdminSection) => {
    const shouldConfirmNavigation =
      guardedSections.has(activeSection) &&
      settingsDirty &&
      section !== activeSection;
    requestSectionChange(section);
    if (shouldConfirmNavigation) return false;
    pushSection(section);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setModulePanelOpen(false);
    }
    return true;
  };
  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  };
  const orderSectionChildren: EmrModuleListSidePanelSectionChild[] =
    orderMenuGroups.flatMap((group) => [
      {
        type: "groupLabel" as const,
        id: `${group.id}-label`,
        label: group.label,
      },
      ...[
        ...[...new Set(group.children.map(item => item.categoryId).filter((id): id is HospitalOrderCategoryId => Boolean(id) && id !== "unclassified"))]
          .map<OrderMenuChild>(categoryId => ({ label: `${getHospitalOrderCategory(categoryId)?.label} 전체`, categoryId, subcategoryId: "unclassified" })),
        ...group.children,
      ]
        .filter((item) => item.categoryId && item.subcategoryId)
        .map((item) => {
          const active =
            activeSection === "orders" &&
            item.categoryId === selectedCategoryId &&
            item.subcategoryId === selectedSubcategoryId;

          return {
            type: "leaf" as const,
            id: `${group.id}-${item.label}`,
            active,
            count: item.subcategoryId ? (
              <EmrModuleListSidePanelBadge>
                {getSubcategoryCount(orders, item.subcategoryId, item.categoryId!)}
              </EmrModuleListSidePanelBadge>
            ) : undefined,
            disabled: item.disabled,
            label: item.label,
            onClick: () => {
              if (!item.categoryId || !item.subcategoryId) return;

              if (!navigateToSection("orders")) {
                setPendingOrderSelection({
                  categoryId: item.categoryId,
                  subcategoryId: item.subcategoryId,
                });
                return;
              }
              setPendingOrderSelection(null);
              setSelectedCategoryId(item.categoryId);
              setSelectedSubcategoryId(item.subcategoryId);
            },
          };
        }),
    ]);
  const hospitalAdminSidePanelItems = hospitalAdminMenuItems.map((item) => {
    const Icon = item.icon;
    const nextSection = item.section;

    return {
      group: item.group,
      type: "button" as const,
      id: item.label,
      active: nextSection ? activeSection === nextSection : false,
      disabled: !nextSection,
      icon: <Icon className="size-4 shrink-0" />,
      label: item.label,
      onClick: nextSection ? () => navigateToSection(nextSection) : undefined,
      testId: item.testId,
    };
  });
  const sidePanelItems: EmrModuleListSidePanelItem[] = [
    {
      type: "groupLabel",
      id: "hospital-settings-group",
      label: "병원 설정",
    },
    ...hospitalAdminSidePanelItems.filter((item) => item.group === "hospital"),
    {
      type: "groupLabel",
      id: "organization-access-group",
      label: "조직 및 접근",
    },
    ...hospitalAdminSidePanelItems.filter(
      (item) => item.group === "organization",
    ),
    {
      type: "groupLabel",
      id: "care-catalog-group",
      label: "진료 카탈로그",
    },
    {
      type: "section",
      id: "orders",
      label: "개별 Order",
      icon: <DocumentIcon className="size-4 shrink-0" />,
      showGroupLabels: false,
      testId: "hospital-admin-menu-order-management",
      children: orderSectionChildren,
    },
    {
      type: "button",
      id: "order-set",
      count: (
        <EmrModuleListSidePanelBadge variant="outline">
          B2
        </EmrModuleListSidePanelBadge>
      ),
      active: activeSection === "order-sets",
      icon: <FolderIcon className="size-4 shrink-0" />,
      label: "세트 Order",
      onClick: () => navigateToSection("order-sets"),
      testId: orderSetPlaceholderId,
    },
    ...hospitalAdminSidePanelItems.filter((item) => item.group === "catalog"),
    {
      type: "button",
      id: "printer-settings",
      disabled: true,
      icon: <PrinterIcon className="size-4 shrink-0" />,
      label: "프린터 설정",
    },
    {
      type: "button",
      id: "data-lab",
      disabled: true,
      icon: <SlidersIcon className="size-4 shrink-0" />,
      label: "데이터랩",
    },
  ];

  return (
    <>
      <EmrModuleListSidePanel
        title={moduleLabel}
        collapseLabel="병원관리 사이드 패널 접기"
        items={sidePanelItems}
        onCollapse={() => setModulePanelOpen(false)}
        onToggleSection={(sectionId) => {
          if (sectionId === "orders") {
            navigateToSection("orders");
          }

          toggleSection(sectionId);
        }}
        openSectionIds={openSections}
        testId="hospital-admin-side-panel"
      />
      <Dialog
        open={pendingSection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingOrderSelection(null);
            cancelPendingSectionChange();
          }
        }}
      >
        <EmrConfirmDialogContent
          title="저장하지 않은 변경사항이 있습니다"
          description="이 화면을 나가면 저장하지 않은 변경사항이 사라집니다."
          cancelLabel="계속 편집"
          confirmLabel="변경사항 버리고 이동"
          confirmButtonVariant="destructive"
          onCancel={() => {
            setPendingOrderSelection(null);
            cancelPendingSectionChange();
          }}
          onConfirm={() => {
            const nextSection = pendingSection;
            discardAllSettingsDrafts();
            confirmPendingSectionChange();
            if (nextSection === "orders" && pendingOrderSelection) {
              setSelectedCategoryId(pendingOrderSelection.categoryId);
              setSelectedSubcategoryId(pendingOrderSelection.subcategoryId);
            }
            setPendingOrderSelection(null);
            if (nextSection) pushSection(nextSection);
          }}
        />
      </Dialog>
    </>
  );
}

export function HospitalAdminContent({ workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const activeSection = useHospitalAdminStore((state) => state.activeSection);
  const clearSelectedOrders = useHospitalAdminStore(
    (state) => state.clearSelectedOrders,
  );
  const catalogCapabilities = useHospitalAdminStore(
    (state) => state.catalogWorkspaceId === workspaceId && state.catalogReadStatus === "ready" ? state.catalogCapabilities : deniedCatalogCapabilities,
  );
  const createOrder = useHospitalAdminStore((state) => state.createOrder);
  const duplicateOrder = useHospitalAdminStore((state) => state.duplicateOrder);
  const orders = useHospitalAdminStore((state) => state.catalogWorkspaceId === workspaceId && state.catalogReadStatus === "ready" ? state.orders : emptyHospitalOrders);
  const searchQuery = useHospitalAdminStore((state) => state.searchQuery);
  const selectedCategoryId = useHospitalAdminStore(
    (state) => state.selectedCategoryId,
  );
  const selectedOrderIds = useHospitalAdminStore(
    (state) => state.selectedOrderIds,
  );
  const selectedSubcategoryId = useHospitalAdminStore(
    (state) => state.selectedSubcategoryId,
  );
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const setActiveSection = useHospitalAdminStore(
    (state) => state.setActiveSection,
  );
  const setFocusedOrderId = useHospitalAdminStore(
    (state) => state.setFocusedOrderId,
  );
  const setSearchQuery = useHospitalAdminStore((state) => state.setSearchQuery);
  const toggleOrderSelection = useHospitalAdminStore(
    (state) => state.toggleOrderSelection,
  );
  const catalogReadStatus = useHospitalAdminStore(state => state.catalogWorkspaceId === workspaceId ? state.catalogReadStatus : "idle");
  const [catalogRetryKey, setCatalogRetryKey] = useState(0);
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("standard");
  const [orderFilterOpen, setOrderFilterOpen] = useState(false);
  const [orderFilterPopoverReady, setOrderFilterPopoverReady] = useState(false);
  const [orderFilterAutoOpenConsumed, setOrderFilterAutoOpenConsumed] =
    useState(false);
  const [orderFilterModel, setOrderFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel(
      "hospital-order-catalog-filter",
      "hospital-order-catalog-filter-rule-1",
    ),
  );
  const [orderSorting, setOrderSorting] = useState<SortingState>([]);
  const [orderColumnVisibility, setOrderColumnVisibility] =
    useState<VisibilityState>({});
  const [dispensingCreateOpen, setDispensingCreateOpen] = useState(false);
  const selectedSubcategory = getHospitalOrderSubcategory(
    selectedSubcategoryId,
  );
  const selectedLeafLabel =
    selectedSubcategoryId === "unclassified"
      ? selectedCategoryId === "unclassified" ? "분류 확인 필요" : `${getHospitalOrderCategory(selectedCategoryId)?.label} 전체`
      :
    orderMenuGroups
      .flatMap((group) => group.children)
      .find(
        (item) =>
          item.categoryId === selectedCategoryId &&
          item.subcategoryId === selectedSubcategoryId,
      )?.label ??
    selectedSubcategory?.label ??
    "개별 Order";
  const requestedSection = searchParams.get("section");

  useEffect(() => {
    if (
      !requestedSection ||
      !hospitalAdminSections.has(requestedSection as HospitalAdminSection)
    ) {
      return;
    }

    if (activeSection !== requestedSection) {
      setActiveSection(requestedSection as HospitalAdminSection);
    }
  }, [activeSection, requestedSection, setActiveSection]);

  useEffect(() => {
    if (activeSection !== "members" || typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px)");
    const closePanelOnCompactViewport = () => {
      if (media.matches) setModulePanelOpen(false);
    };

    closePanelOnCompactViewport();
    media.addEventListener("change", closePanelOnCompactViewport);

    return () => {
      media.removeEventListener("change", closePanelOnCompactViewport);
    };
  }, [activeSection, setModulePanelOpen]);
  const selectedLeafOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          isHospitalOrderInCategory(order, selectedCategoryId, selectedSubcategoryId),
      ),
    [orders, selectedCategoryId, selectedSubcategoryId],
  );
  const baseVisibleOrders = useMemo(
    () =>
      getVisibleOrders(orders, {
        searchQuery,
        selectedCategoryId,
        selectedSubcategoryId,
      }),
    [orders, searchQuery, selectedCategoryId, selectedSubcategoryId],
  );
  const orderFilterFields = useMemo(
    () =>
      getHospitalOrderTableFilterFields(
        baseVisibleOrders,
        selectedCategoryId,
        selectedSubcategoryId,
      ),
    [baseVisibleOrders, selectedCategoryId, selectedSubcategoryId],
  );
  const activeOrderFilterCount = getEmrTableFilterBuilderActiveCount(
    orderFilterModel,
    orderFilterFields,
  );
  const filteredOrderRows = useMemo(
    () =>
      filterRowsByEmrTableFilterBuilder(
        baseVisibleOrders,
        orderFilterModel,
        orderFilterFields,
      ),
    [baseVisibleOrders, orderFilterFields, orderFilterModel],
  );
  const openDrawer = useCallback(
    (order: HospitalOrderCatalogItem) => {
      const hospitalOrderDrawerOpen = activeDrawer?.type === "hospital-order";
      if (selectedOrderIds.length > 0 && !hospitalOrderDrawerOpen) return;

      if (hospitalOrderDrawerOpen && selectedOrderIds.length > 0) {
        clearSelectedOrders();
      }
      setFocusedOrderId(order.id);
      setActiveDrawer({
        type: "hospital-order",
        id: order.id,
        subtitle: order.inHospitalName,
      });
    },
    [
      activeDrawer?.type,
      clearSelectedOrders,
      selectedOrderIds.length,
      setActiveDrawer,
      setFocusedOrderId,
    ],
  );

  const handleCreateOrder = () => {
    if (selectedCategoryId === "dispensing") {
      setDispensingCreateOpen(true);
      return;
    }
    const order = createOrder();

    setFocusedOrderId(order.id);
    setActiveDrawer({
      type: "hospital-order",
      id: order.id,
      subtitle: getNewOrderDrawerTitle(selectedSubcategory?.label),
    });
  };

  const handleCreateWorkspaceDispensingOrder = () => {
    const order = createOrder();

    setDispensingCreateOpen(false);
    setFocusedOrderId(order.id);
    setActiveDrawer({
      type: "hospital-order",
      id: order.id,
      subtitle: getNewOrderDrawerTitle(selectedSubcategory?.label),
    });
  };

  const handleDuplicateFirstSelected = () => {
    const duplicated = selectedOrderIds[0]
      ? duplicateOrder(selectedOrderIds[0])
      : null;
    clearSelectedOrders();

    if (duplicated) {
      setFocusedOrderId(duplicated.id);
      setActiveDrawer({
        type: "hospital-order",
        id: duplicated.id,
        subtitle: duplicated.inHospitalName,
      });
    }
  };

  const isDispensingOrderTable = selectedCategoryId === "dispensing";
  const hospitalOrderDetailFields = useMemo(
    () => getHospitalOrderTableDetailFields(selectedLeafOrders),
    [selectedLeafOrders],
  );
  const hospitalOrderColumns = useMemo<
    Array<ColumnDef<HospitalOrderCatalogItem, unknown>>
  >(
    () => [
      {
        id: "select",
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { label: "오더 선택", role: "selection" },
        maxSize: hospitalOrderSelectionColumnWidth,
        minSize: hospitalOrderSelectionColumnWidth,
        size: hospitalOrderSelectionColumnWidth,
        header: ({ table }) => {
          const allSelected = table.getIsAllRowsSelected();
          const someSelected = table.getIsSomeRowsSelected();

          return (
            <span
              data-row-interactive="true"
              className="inline-flex size-6 items-center justify-center"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <EmrTableCheckbox
                aria-label="보이는 오더 전체 선택"
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) =>
                  table.toggleAllRowsSelected(Boolean(checked))
                }
              />
            </span>
          );
        },
        cell: ({ row }) => (
          <span
            data-row-interactive="true"
            className="inline-flex size-6 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <EmrTableCheckbox
              aria-label={`${row.original.standardName} 선택`}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked)}
            />
          </span>
        ),
      },
      {
        accessorKey: "standardName",
        id: "standardName",
        enableHiding: false,
        enableSorting: true,
        maxSize: isDispensingOrderTable ? 360 : undefined,
        meta: {
          identity: true,
          label: "표준 Order명",
          resize: "data-column",
          role: "data",
          textMode: hospitalOrderNameTextMode,
        },
        minSize: isDispensingOrderTable ? 220 : undefined,
        size: isDispensingOrderTable ? 260 : hospitalOrderIdentityColumnWidth,
        cell: ({ row }) => (
          <EmrTableIdentityCellContent>
            <EmrTableCellText
              fullText={row.original.standardName}
              mode={hospitalOrderNameTextMode}
            >
              {row.original.standardName}
            </EmrTableCellText>
          </EmrTableIdentityCellContent>
        ),
        sortingFn: (left, right, id) =>
          compareHospitalOrderValues(left.getValue(id), right.getValue(id)),
      },
      ...(isDispensingOrderTable
        ? []
        : [
            {
              accessorFn: () => "개별",
              id: "type",
              enableSorting: false,
              meta: {
                label: "유형",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              size: 72,
              cell: () => <Badge variant="outline">개별</Badge>,
            },
          ]),
      {
        id: "classification",
        accessorFn: formatHospitalOrderClassification,
        meta: { label: "분류", role: "data", textMode: "one-line" },
        size: 180,
        cell: ({ row }) => <HospitalOrderTableCellValue value={formatHospitalOrderClassification(row.original)} />,
      },
      {
        id: "coreStatus",
        accessorFn: getHospitalOrderCoreStatus,
        meta: { label: "핵심 값", role: "data", textMode: "one-line" },
        size: 160,
        cell: ({ row }) => <HospitalOrderTableCellValue value={getHospitalOrderCoreStatus(row.original)} />,
      },
      ...(selectedCategoryId === "unclassified" ? [{
        id: "coreSummary",
        meta: { label: "핵심 세부 내용", role: "data" as const, textMode: "two-line-if-long" as const },
        size: 320,
        cell: ({ row }: { row: { original: HospitalOrderCatalogItem } }) => <HospitalOrderTableCellValue mode="two-line-if-long" value={getHospitalOrderCoreDetails(row.original).map(({definition, value}) => `${definition.label}: ${formatHospitalOrderTableDetailValue(definition, value) || "미설정"}`).join(" · ")} />,
      }] : []),
      {
        accessorKey: "inHospitalName",
        id: "inHospitalName",
        enableSorting: true,
        maxSize: isDispensingOrderTable ? 320 : undefined,
        meta: {
          label: "원내 Order명",
          resize: "data-column",
          role: "data",
          textMode: hospitalOrderNameTextMode,
        },
        minSize: isDispensingOrderTable ? 180 : undefined,
        size: isDispensingOrderTable ? 220 : 170,
        cell: ({ row }) => (
          <EmrTableCellText
            fullText={row.original.inHospitalName}
            mode={hospitalOrderNameTextMode}
          >
            {row.original.inHospitalName}
          </EmrTableCellText>
        ),
        sortingFn: (left, right, id) =>
          compareHospitalOrderValues(left.getValue(id), right.getValue(id)),
      },
      ...(isDispensingOrderTable || selectedCategoryId === "unclassified"
        ? []
        : hospitalOrderDetailFields.map(({ clinicalOrderType, definition }) => {
            const columnSize =
              getHospitalOrderTableDetailColumnSize(definition);
            const textMode = getHospitalOrderTableDetailTextMode(definition);

            return {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                row.clinicalOrderType === clinicalOrderType
                  ? formatHospitalOrderTableDetailValue(
                      definition,
                      row.defaultDetailInputs?.[definition.key],
                    )
                  : "해당 없음",
              id: `detail-${clinicalOrderType}-${definition.key}`,
              enableSorting: true,
              ...columnSize,
              meta: {
                align:
                  definition.control === "number"
                    ? ("right" as const)
                    : undefined,
                label: definition.label,
                resize: "data-column" as const,
                role: "data" as const,
                textMode,
              },
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  mode={textMode}
                  value={
                    row.original.clinicalOrderType === clinicalOrderType
                      ? formatHospitalOrderTableDetailValue(
                          definition,
                          row.original.defaultDetailInputs?.[definition.key],
                        )
                      : "해당 없음"
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            } satisfies ColumnDef<HospitalOrderCatalogItem, unknown>;
          })),
      ...(isDispensingOrderTable
        ? [
            {
              id: "dispensingDoseBasis",
              accessorFn: (row: HospitalOrderCatalogItem) => row.dispensingPreset?.doseBasis,
              meta: { label: "용량 기준", role: "data" as const, textMode: "one-line" as const },
              size: 120,
              cell: ({ row }: { row: { original: HospitalOrderCatalogItem } }) => <HospitalOrderTableCellValue value={formatHospitalOrderDetailOption(row.original.dispensingPreset?.doseBasis ?? "")} />,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).ingredientStrength,
              id: "dispensingIngredient",
              enableSorting: true,
              maxSize: 260,
              meta: {
                label: "성분·함량",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 144,
              size: 180,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original)
                      .ingredientStrength
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).dosageForm,
              id: "dispensingDosageForm",
              enableSorting: true,
              maxSize: 240,
              meta: {
                label: "제형",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 120,
              size: 160,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original).dosageForm
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).dose,
              id: "dispensingDose",
              enableSorting: false,
              maxSize: 144,
              meta: {
                align: "right" as const,
                label: "1회 용량",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 96,
              size: 112,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original).doseLabel
                  }
                />
              ),
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).routeLabel,
              id: "dispensingRoute",
              enableSorting: true,
              maxSize: 128,
              meta: {
                label: "투여 경로",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 88,
              size: 104,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original).routeLabel
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).frequencyLabel,
              id: "dispensingFrequency",
              enableSorting: true,
              maxSize: 128,
              meta: {
                label: "투여 빈도",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 88,
              size: 104,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original)
                      .frequencyLabel
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).durationDays,
              id: "dispensingDuration",
              enableSorting: true,
              maxSize: 104,
              meta: {
                align: "right" as const,
                label: "투여 일수",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 80,
              size: 88,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original)
                      .durationLabel
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                getHospitalDispensingTableDetails(row).totalQuantity,
              id: "dispensingTotalQuantity",
              enableSorting: false,
              maxSize: 160,
              meta: {
                align: "right" as const,
                label: "처방 총량",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 104,
              size: 128,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={
                    getHospitalDispensingTableDetails(row.original)
                      .totalQuantityLabel
                  }
                />
              ),
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                targetLabels[row.target],
              id: "target",
              enableSorting: false,
              maxSize: 144,
              meta: {
                label: "대상",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 96,
              size: 112,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  value={targetLabels[row.original.target]}
                />
              ),
            },
          ]
        : []),
      ...(isDispensingOrderTable
        ? []
        : [
            {
              accessorKey: "billingName",
              id: "billingName",
              enableSorting: true,
              meta: {
                label: "청구서명",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: hospitalOrderNameTextMode,
              },
              size: 160,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <EmrTableCellText
                  fullText={row.original.billingName}
                  mode={hospitalOrderNameTextMode}
                >
                  {row.original.billingName}
                </EmrTableCellText>
              ),
              sortingFn: compareHospitalOrderRows,
            },
          ]),
      {
        accessorFn: (row) =>
          isDispensingOrderTable
            ? row.isActive
              ? "active"
              : "inactive"
            : row.isActive
              ? "active"
              : (row.sourceCatalogItem?.availabilityStatus ?? "inactive"),
        id: "status",
        enableSorting: false,
        maxSize: isDispensingOrderTable ? 112 : undefined,
        meta: {
          label: "사용여부",
          resize: "data-column",
          role: "data",
          textMode: "one-line",
        },
        minSize: isDispensingOrderTable ? 88 : undefined,
        size: isDispensingOrderTable ? 96 : 86,
        cell: ({ row }) => {
          if (isDispensingOrderTable) {
            return (
              <EmrTableCellText
                className={cn(
                  "font-semibold",
                  row.original.isActive
                    ? "text-[var(--emr-status-success-text)]"
                    : "text-muted-foreground",
                )}
                mode="one-line"
              >
                {row.original.isActive ? "사용" : "중지"}
              </EmrTableCellText>
            );
          }

          const pendingActivation =
            row.original.sourceCatalogItem?.availabilityStatus ===
            "pending_activation";
          const serviceReviewActive =
            pendingActivation &&
            row.original.sourceCatalogItem?.dispensingLineage
              ?.serviceReviewOnly === true &&
            row.original.isActive;

          return (
            <EmrTableCellText
              className={cn(
                "font-semibold",
                pendingActivation && !serviceReviewActive
                  ? "text-[var(--emr-status-warning-text)]"
                  : row.original.isActive
                    ? "text-[var(--emr-status-success-text)]"
                    : "text-muted-foreground",
              )}
              mode="one-line"
            >
              {pendingActivation && !serviceReviewActive
                ? "검토 대기"
                : row.original.isActive
                  ? "사용"
                  : "중지"}
            </EmrTableCellText>
          );
        },
      },
      ...(isDispensingOrderTable
        ? []
        : [
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                row.sourceCatalogItem
                  ? row.sourceCatalogItem.priceKrw
                  : row.price,
              id: "price",
              enableSorting: true,
              meta: {
                align: "right" as const,
                label: "판매금액",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              size: 110,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <EmrTableCellText className="font-semibold" mode="one-line">
                  {row.original.sourceCatalogItem?.priceKrw === null
                    ? "미설정"
                    : formatHospitalOrderAmount(row.original.price)}
                </EmrTableCellText>
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                targetLabels[row.target],
              id: "target",
              enableSorting: false,
              meta: {
                grow: true,
                label: "대상",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              size: 158,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <EmrTableCellText mode="one-line">
                  {targetLabels[row.original.target]}
                </EmrTableCellText>
              ),
            },
          ]),
      ...(isDispensingOrderTable
        ? [
            {
              accessorKey: "billingName",
              id: "billingName",
              enableSorting: true,
              maxSize: 320,
              meta: {
                label: "청구서명",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: hospitalOrderNameTextMode,
              },
              minSize: 160,
              size: 200,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  mode={hospitalOrderNameTextMode}
                  value={row.original.billingName}
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
            {
              accessorFn: (row: HospitalOrderCatalogItem) =>
                row.sourceCatalogItem
                  ? row.sourceCatalogItem.priceKrw
                  : row.price,
              id: "price",
              enableSorting: true,
              maxSize: 144,
              meta: {
                align: "right" as const,
                label: "판매금액",
                resize: "data-column" as const,
                role: "data" as const,
                textMode: "one-line" as const,
              },
              minSize: 112,
              size: 120,
              cell: ({
                row,
              }: {
                row: { original: HospitalOrderCatalogItem };
              }) => (
                <HospitalOrderTableCellValue
                  className="font-semibold"
                  value={
                    row.original.sourceCatalogItem?.priceKrw === null
                      ? ""
                      : formatHospitalOrderAmount(row.original.price)
                  }
                />
              ),
              sortingFn: compareHospitalOrderRows,
            },
          ]
        : []),
      {
        id: "actions",
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        maxSize: isDispensingOrderTable ? 52 : 80,
        meta: {
          actionVisibility: "contextual",
          align: "right",
          label: "작업",
          role: "actions",
        },
        minSize: isDispensingOrderTable ? 52 : 80,
        size: isDispensingOrderTable ? 52 : 80,
        cell: ({ row }) => (
          <EmrRowActionMenu
            ariaLabel={`${row.original.standardName} Order 행 작업`}
            contentClassName="w-48"
            items={[
              {
                key: "detail",
                label: "상세 보기",
                description: "Order drawer 열기",
                onSelect: () => openDrawer(row.original),
              },
              {
                key: "duplicate",
                label: "복제",
                description: "현재 row 기준으로 복사",
                onSelect: () => duplicateOrder(row.original.id),
              },
            ]}
            testId={`hospital-order-action-${row.original.id}`}
          />
        ),
      },
    ],
    [
      duplicateOrder,
      hospitalOrderDetailFields,
      isDispensingOrderTable,
      openDrawer,
      selectedCategoryId,
    ],
  );
  const orderRowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries(selectedOrderIds.map((id) => [id, true])),
    [selectedOrderIds],
  );
  const handleOrderRowSelectionChange = (
    updater: Updater<RowSelectionState>,
  ) => {
    const nextSelection =
      typeof updater === "function" ? updater(orderRowSelection) : updater;

    filteredOrderRows.forEach((order) => {
      const current = selectedOrderIds.includes(order.id);
      const next = Boolean(nextSelection[order.id]);
      if (current !== next) toggleOrderSelection(order.id, next);
    });
  };
  // TanStack Table owns sorting, pinning, and the rendered row model; domain
  // filters and selection persistence stay in the hospital-admin store.
  // eslint-disable-next-line react-hooks/incompatible-library
  const orderTable = useReactTable({
    columns: hospitalOrderColumns,
    columnResizeMode: "onChange",
    data: filteredOrderRows,
    enableColumnPinning: true,
    enableMultiSort: false,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setOrderColumnVisibility,
    onRowSelectionChange: handleOrderRowSelectionChange,
    onSortingChange: setOrderSorting,
    state: {
      columnPinning: {
        left: isDispensingOrderTable
          ? ["select", "standardName", "inHospitalName"]
          : ["select", "standardName"],
        right: [],
      },
      columnVisibility: orderColumnVisibility,
      rowSelection: orderRowSelection,
      sorting: orderSorting,
    },
  });
  const visibleOrders = orderTable
    .getRowModel()
    .rows.map((row) => row.original);
  const hasSelectedLeafRows = selectedLeafOrders.length > 0;
  const orderEmptyStateKind = hasSelectedLeafRows
    ? "no-filter-results"
    : "no-data";
  const orderEmptyStatePriority = hasSelectedLeafRows
    ? "local-recovery"
    : "supporting";
  const orderEmptyStateTitle = hasSelectedLeafRows
    ? "조건에 맞는 Order가 없습니다"
    : "등록된 Order가 없습니다";
  const orderEmptyStateDescription = hasSelectedLeafRows
    ? "조건을 초기화하면 숨겨진 Order가 다시 보입니다."
    : "Order가 등록되면 이 표에 표시됩니다.";
  const resetOrderFilters = () => {
    setSearchQuery("");
    setOrderFilterModel(
      createInitialEmrTableFilterBuilderModel(
        "hospital-order-catalog-filter",
        "hospital-order-catalog-filter-rule-1",
      ),
    );
  };
  const session = useHospitalCatalogRead(workspaceId, true, catalogRetryKey);

  if (activeSection === "members") {
    return (
      <WorkspaceMembershipManagement
        workspaceId={workspaceId}
        targetUserId={searchParams.get("memberUserId") ?? undefined}
        onOpenRoleManagement={() => setActiveSection("roles")}
      />
    );
  }

  if (activeSection === "audit") {
    return <HospitalAdminAuditReview workspaceId={workspaceId} />;
  }

  if (activeSection === "order-sets") {
    return <OrderSetsPanel session={session} workspaceId={workspaceId} />;
  }

  if (activeSection === "settings") {
    return <HospitalBasicSettingsScreen workspaceId={workspaceId} />;
  }

  if (activeSection === "settings-contact") {
    return <HospitalContactSettingsScreen workspaceId={workspaceId} />;
  }

  if (activeSection === "settings-hours") {
    return <HospitalOperatingHoursSettingsScreen workspaceId={workspaceId} />;
  }

  if (activeSection === "schedule") {
    return <HospitalScheduleScreen workspaceId={workspaceId} />;
  }

  if (activeSection === "roles") {
    return (
      <RolePermissionManagementScreen
        key={workspaceId}
        workspaceId={workspaceId}
        onOpenMemberManagement={() => setActiveSection("members")}
      />
    );
  }

  if (activeSection === "vitals") {
    return (
      <WorkspaceVitalSettingsScreen
        actorHeaders={session ? getDemoActorHeaders(session) : undefined}
        workspaceId={workspaceId}
      />
    );
  }

  if (activeSection === "space-time") {
    return (
      <WorkspaceSpaceManagementScreen
        actorHeaders={session ? getDemoActorHeaders(session) : undefined}
        workspaceId={workspaceId}
      />
    );
  }

  const catalogReadStatusLabel =
    catalogReadStatus === "loading"
      ? "Workspace catalog 불러오는 중"
      : catalogReadStatus === "ready"
        ? "Workspace catalog 기준"
        : catalogReadStatus === "denied"
          ? "Workspace catalog 접근 제한"
          : catalogReadStatus === "error"
            ? "Workspace catalog 조회 실패"
            : "Workspace catalog 대기";

  return (
    <>
      <Dialog
        open={dispensingCreateOpen}
        onOpenChange={setDispensingCreateOpen}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>조제 오더 추가</DialogTitle>
            <DialogDescription>
              기존 CLAiR 마스터를 먼저 검색하고, 병원 고유 조제법이 없을
              때만 이 워크스페이스 전용 오더를 만들어 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto items-start justify-start whitespace-normal p-4 text-left"
              onClick={() => {
                setDispensingCreateOpen(false);
                setSearchQuery("");
              }}
            >
              <span>
                <strong className="block">마스터에서 추가</strong>
                <span className="mt-1 block emr-text-metadata text-muted-foreground">
                  현재 조제 목록과 검색에서 검토된 마스터를 선택합니다.
                </span>
              </span>
            </Button>
            <Button
              className="h-auto items-start justify-start whitespace-normal p-4 text-left"
              disabled={!catalogCapabilities.canAuthorDispensing}
              onClick={handleCreateWorkspaceDispensingOrder}
            >
              <span>
                <strong className="block">새 조제 오더 만들기</strong>
                <span className="mt-1 block emr-text-metadata opacity-80">
                  병원 전용으로 저장되며 수의사 승인 후 사용할 수 있습니다.
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <EmrPinnedTableWorkspace
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
      data-testid="hospital-admin-order-content"
      identityTextInset={48}
      selectionColumnWidth={hospitalOrderSelectionColumnWidth}
    >
      <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
      <EmrTableWorkspaceHeader
        count={visibleOrders.length}
        countLoading={
          catalogReadStatus === "idle" || catalogReadStatus === "loading"
        }
        countSkeletonTestId="hospital-order-page-header-count-skeleton"
        onSearchChange={setSearchQuery}
        primaryAction={
          <Button
            size="sm"
            className="h-8 min-h-8"
            onClick={handleCreateOrder}
            disabled={selectedCategoryId === "unclassified"}
          >
            + Order
          </Button>
        }
        searchAriaLabel="오더 검색"
        searchClearAriaLabel="오더 검색어 초기화"
        searchPlaceholder="오더 검색"
        searchValue={searchQuery}
        tableControls={
          <>
            <Popover
              open={orderFilterOpen}
              onOpenChange={(open) => {
                setOrderFilterOpen(open);
                if (!open) {
                  setOrderFilterPopoverReady(false);
                  setOrderFilterAutoOpenConsumed(false);
                }
              }}
              onOpenChangeComplete={setOrderFilterPopoverReady}
            >
              <PopoverTrigger
                render={
                  <EmrTableFilterTrigger
                    activeCount={activeOrderFilterCount}
                    aria-label={
                      activeOrderFilterCount > 0
                        ? `오더 필터 ${activeOrderFilterCount}개 설정`
                        : "오더 필터 설정"
                    }
                  />
                }
              />
              <PopoverContent
                align="end"
                className="w-[min(640px,calc(100vw-32px))] gap-0 overflow-visible p-0"
                initialFocus={false}
              >
                <EmrTableFilterBuilder
                  autoOpenFirstField={
                    orderFilterPopoverReady && !orderFilterAutoOpenConsumed
                  }
                  clearAllLabel="초기화"
                  description="오더 필터는 완성된 조건만 자동 적용되며, 그룹 안과 그룹 사이는 선택한 AND/OR로 계산됩니다."
                  fields={orderFilterFields}
                  model={orderFilterModel}
                  title="필터"
                  onClose={() => {
                    setOrderFilterOpen(false);
                    setOrderFilterPopoverReady(false);
                    setOrderFilterAutoOpenConsumed(false);
                  }}
                  onModelChange={(model) => {
                    setOrderFilterAutoOpenConsumed(true);
                    setOrderFilterModel(model);
                  }}
                />
              </PopoverContent>
            </Popover>
            <EmrTableDensitySelector
              value={tableDensity}
              onValueChange={setTableDensity}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 min-h-8 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5 shadow-[var(--clair-shadow-xs)]"
                    aria-label={`${selectedLeafLabel} 컬럼 표시 설정`}
                  />
                }
              >
                전체 컬럼
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>표시 컬럼</DropdownMenuLabel>
                  {orderTable
                    .getAllLeafColumns()
                    .filter(
                      (column) =>
                        column.id !== "select" && column.id !== "actions",
                    )
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        disabled={!column.getCanHide()}
                        onCheckedChange={(checked) =>
                          column.toggleVisibility(Boolean(checked))
                        }
                      >
                        {column.columnDef.meta?.label ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        testId="hospital-order-page-header"
        title={selectedLeafLabel}
      />
      <span
        className="sr-only"
        data-testid="hospital-order-catalog-read-status"
      >
        {catalogReadStatusLabel}
      </span>
      {catalogReadStatus === "denied" ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description="병원관리 Order 조회 권한이 있는 사용자에게 문의해 주세요."
            kind="no-permission"
            priority="local-recovery"
            size="md"
            surface="table"
            testId="hospital-order-read-denied"
            title="Order를 볼 권한이 없습니다"
          />
        </EmrTableFeedbackSurface>
      ) : catalogReadStatus === "error" ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description="연결 상태를 확인한 뒤 다시 시도해 주세요."
            kind="read-error"
            primaryAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCatalogRetryKey((current) => current + 1)}
              >
                다시 시도
              </Button>
            }
            priority="local-recovery"
            size="md"
            surface="table"
            testId="hospital-order-read-error"
            title="Order를 불러오지 못했습니다"
          />
        </EmrTableFeedbackSurface>
      ) : catalogReadStatus === "ready" && visibleOrders.length === 0 ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description={orderEmptyStateDescription}
            kind={orderEmptyStateKind}
            primaryAction={
              hasSelectedLeafRows ? (
                <Button size="sm" variant="outline" onClick={resetOrderFilters}>
                  조건 초기화
                </Button>
              ) : (
                <Button size="sm" onClick={handleCreateOrder}>
                  + Order
                </Button>
              )
            }
            priority={orderEmptyStatePriority}
            size="md"
            surface="table"
            testId="hospital-order-empty-state"
            title={orderEmptyStateTitle}
          />
        </EmrTableFeedbackSurface>
      ) : (
        <div
          className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
          data-testid="hospital-order-table"
        >
          <EmrDataTable
            aria-label="병원관리 개별 Order 테이블"
            className="table-fixed"
            density={tableDensity}
            initialLoading={
              catalogReadStatus === "idle" || catalogReadStatus === "loading"
            }
            overscrollAxes="both"
            skeletonRowCount={6}
            table={orderTable}
            viewportMode="fill"
            getRowProps={(row) => {
              const detailActive =
                activeDrawer?.type === "hospital-order" &&
                activeDrawer.id === row.original.id;

              return {
                "aria-current": detailActive ? "true" : undefined,
                className: "cursor-pointer bg-card",
                "data-detail-active": detailActive ? "true" : undefined,
                "data-state": detailActive ? "selected" : undefined,
                "data-testid": `hospital-order-row-${row.original.id}`,
                onClick: () => openDrawer(row.original),
              };
            }}
          />
        </div>
      )}
      {catalogReadStatus === "ready" && selectedOrderIds.length > 0 ? (
        <div className="pointer-events-none sticky bottom-3 z-20 mt-[-52px] flex justify-center">
          <div className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg border bg-card px-3 shadow-lg">
            <span className="emr-text-metadata font-medium text-muted-foreground">
              선택한 오더 {selectedOrderIds.length}개
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDuplicateFirstSelected}
            >
              선택 복제
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelectedOrders}>
              선택 해제
            </Button>
          </div>
        </div>
      ) : null}
      </EmrPinnedTableWorkspace>
    </>
  );
}

function HospitalAdminAuditReview({ workspaceId }: { workspaceId: string }) {
  const { hydrated, hydrate, session } = useAuthClient();
  const [eventType, setEventType] = useState("all");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<AuditReviewEventRow[]>([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "denied" | "error"
  >("idle");
  const canReview =
    session?.role === "hospital_admin" || session?.role === "supabase";
  const hasAuditFilters = Boolean(query.trim()) || eventType !== "all";
  const auditEmptyStateKind = hasAuditFilters ? "no-filter-results" : "no-data";
  const auditEmptyStateTitle = hasAuditFilters
    ? "조건에 맞는 감사 로그가 없습니다"
    : "표시할 감사 로그가 없습니다";
  const auditEmptyStateDescription = hasAuditFilters
    ? "검색어나 필터를 바꾸면 감사 로그가 다시 표시됩니다."
    : "기록이 생성되면 이 표에 표시됩니다.";
  const columns = useMemo<ColumnDef<AuditReviewEventRow, unknown>[]>(
    () => [
      {
        id: "occurredAt",
        accessorKey: "occurredAt",
        size: 170,
        minSize: 150,
        enableSorting: false,
        enableResizing: false,
        header: "시간",
        meta: { label: "시간", resize: "none" },
        cell: ({ row }) => (
          <span className="font-medium">
            {formatAuditTime(row.original.occurredAt)}
          </span>
        ),
      },
      {
        id: "eventType",
        accessorKey: "eventType",
        size: 180,
        minSize: 150,
        enableSorting: false,
        enableResizing: false,
        header: "이벤트",
        meta: { label: "이벤트", resize: "none" },
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-md">
            {auditEventLabels[row.original.eventType] ?? row.original.eventType}
          </Badge>
        ),
      },
      {
        id: "actor",
        accessorFn: (row) => row.actorUserId ?? "system",
        size: 150,
        minSize: 120,
        enableSorting: false,
        enableResizing: false,
        header: "Actor",
        meta: { label: "Actor", resize: "none" },
        cell: ({ row }) => row.original.actorUserId ?? "system",
      },
      {
        id: "target",
        accessorFn: (row) => row.targetType + " " + row.targetId,
        size: 220,
        minSize: 180,
        enableSorting: false,
        enableResizing: false,
        header: "Target",
        meta: {
          label: "Target",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="font-medium">{row.original.targetType}</span>
            <span className="ml-2 text-muted-foreground">
              {row.original.targetId}
            </span>
          </div>
        ),
      },
      {
        id: "summary",
        accessorFn: (row) => buildAuditSummary(row),
        size: 260,
        minSize: 220,
        enableSorting: false,
        enableResizing: false,
        header: "요약",
        meta: {
          grow: true,
          label: "요약",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {buildAuditSummary(row.original)}
          </span>
        ),
      },
    ],
    [],
  );
  // TanStack Table owns the audit grid renderer; access and feedback remain here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: events,
    enableColumnResizing: false,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    let canceled = false;

    const loadEvents = async () => {
      await Promise.resolve();
      if (canceled) return;

      if (!session || !canReview) {
        setStatus("denied");
        setEvents([]);
        return;
      }

      const params = new URLSearchParams();
      params.set("limit", "50");
      if (eventType !== "all") params.set("eventType", eventType);
      if (query.trim()) params.set("query", query.trim());
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/audit/events?${params.toString()}`,
          {
            headers: getDemoActorHeaders(session),
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as {
          ok: boolean;
          events?: AuditReviewEventRow[];
        };
        if (canceled) return;

        if (!response.ok || !body.ok) {
          setStatus(
            response.status === 401 || response.status === 403
              ? "denied"
              : "error",
          );
          setEvents([]);
          return;
        }

        setEvents(body.events ?? []);
        setStatus("ready");
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return;
        setStatus("error");
        setEvents([]);
      }
    };

    void loadEvents();

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [canReview, eventType, hydrated, query, session, workspaceId]);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
      data-testid="hospital-admin-audit-review"
    >
      <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
      <section className="border-b bg-transparent px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7">감사 로그</h1>
              <Badge variant="secondary">{events.length}</Badge>
            </div>
            <div className="mt-1 max-w-2xl emr-text-dense leading-5 text-muted-foreground">
              병원관리 / 감사 로그 / 주요 변경 이력
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-[54px] shrink-0 flex-wrap items-center gap-2 border-b bg-transparent px-4 py-2">
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-lg border bg-card px-2.5 sm:min-w-[280px]">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            aria-label="감사 로그 검색"
            className="h-8 border-0 bg-transparent px-2 emr-text-dense shadow-none focus-visible:ring-0"
            placeholder="actor, target, encounter 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select
          value={eventType}
          onValueChange={(value) => setEventType(value ?? "all")}
        >
          <SelectTrigger
            aria-label="감사 이벤트 필터"
            size="sm"
            className="w-[188px] bg-card"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {auditEventFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>
      <section className="min-h-0 flex-1 overflow-hidden">
        {status === "denied" ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-6 text-center">
            <h2 className="text-[16px] font-semibold">감사 로그 접근 제한</h2>
            <p className="max-w-md emr-text-dense leading-5 text-muted-foreground">
              병원관리자만 workspace-scoped audit event를 볼 수 있습니다.
            </p>
          </div>
        ) : status === "error" ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-6 text-center">
            <h2 className="text-[16px] font-semibold">
              감사 로그를 불러오지 못했습니다
            </h2>
            <p className="max-w-md emr-text-dense leading-5 text-muted-foreground">
              서버 audit review reader를 다시 확인해 주세요.
            </p>
          </div>
        ) : (
          <EmrDataTable
              aria-label="감사 로그"
              className="table-fixed"
              density="standard"
              initialLoading={status === "loading" && events.length === 0}
              renderAfterRows={({ visibleColumnCount }) => (
                <>
                  {status === "loading" && events.length > 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumnCount}
                        className="h-24 text-center emr-text-dense text-muted-foreground"
                      >
                        불러오는 중
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {status !== "loading" && events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumnCount} className="h-36">
                        <div className="flex justify-center px-4 py-6">
                          <EmrEmptyState
                            kind={auditEmptyStateKind}
                            priority={
                              hasAuditFilters ? "local-recovery" : "supporting"
                            }
                            surface="table"
                            size="md"
                            testId="hospital-audit-empty-state"
                            title={auditEmptyStateTitle}
                            description={auditEmptyStateDescription}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </>
              )}
              skeletonRowCount={5}
              table={table}
              viewportMode="fill"
              getRowProps={(row) => ({
                className: undefined,
                "data-testid": "audit-review-row-" + row.original.id,
              })}
            />
        )}
      </section>
    </div>
  );
}

function formatAuditTime(value: string) {
  return value.replace("T", " ").replace("+09:00", "");
}

function buildAuditSummary(event: AuditReviewEventRow) {
  const after = event.after ?? {};
  const status = typeof after.status === "string" ? after.status : undefined;
  const paymentState =
    typeof after.paymentState === "string" ? after.paymentState : undefined;
  const noteStatus =
    typeof after.noteStatus === "string" ? after.noteStatus : undefined;
  const mode = typeof after.mode === "string" ? after.mode : undefined;
  const confirmation =
    typeof after.orderConfirmationStatus === "string"
      ? after.orderConfirmationStatus
      : undefined;

  return (
    [
      event.encounterId ? `encounter ${event.encounterId}` : null,
      status ? `status ${status}` : null,
      paymentState ? `payment ${paymentState}` : null,
      noteStatus ? `SOAP ${noteStatus}` : null,
      mode ? `mode ${mode}` : null,
      confirmation ? `order ${confirmation}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "safe audit summary"
  );
}

function DrawerField({
  children,
  hint,
  label,
  required = false,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <Field
      orientation="responsive"
      className="gap-2 md:grid md:grid-cols-[150px_minmax(0,1fr)] md:items-start md:gap-5"
    >
      <FieldLabel className="pt-2 emr-text-body font-bold text-foreground">
        {label}
        {required ? <EmrRequiredIndicator className="ml-1" /> : null}
      </FieldLabel>
      <FieldContent className="min-w-0 gap-1.5">
        {children}
        {hint ? (
          <FieldDescription className="emr-text-metadata leading-4">
            {hint}
          </FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  );
}

function DrawerSelect({
  ariaLabel,
  disabled = false,
  items,
  onValueChange,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  items: Array<{ label: string; value: string }>;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onValueChange(nextValue);
      }}
    >
      <SelectTrigger aria-label={ariaLabel} className="h-9 w-full bg-card">
        <SelectValue placeholder="미설정">
          {items.find((item) => item.value === value)?.label ?? (value || "미설정")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

const hospitalRuntimeDetailFieldKeys = new Set([
  "responsibleClinicianId",
  "providerId",
  "wardOrCage",
]);

const hospitalOrderDetailOptionLabels: Record<string, string> = {
  patient: "환자당",
  kg: "체중 기준",
  after_meal: "식후",
  any_time: "시간 무관",
  before_meal: "식전",
  bid: "하루 2회(BID)",
  bilateral: "양측",
  blood: "혈액",
  body_surface_area: "체표면적 기준",
  custom: "사용자 설정",
  enhanced: "강화",
  feces: "분변",
  intensive: "집중",
  isolation: "격리",
  left: "좌측",
  midline: "정중선",
  not_applicable: "해당 없음",
  now: "즉시",
  once: "1회",
  other: "기타",
  plasma: "혈장",
  prn: "필요 시(PRN)",
  qid: "하루 4회(QID)",
  refrigerated: "냉장",
  right: "우측",
  room_temp: "실온",
  scheduled: "예약",
  serum: "혈청",
  sid: "하루 1회(SID)",
  standard: "일반",
  swab: "면봉",
  tid: "하루 3회(TID)",
  tissue: "조직",
  urine: "뇨",
  with_meal: "식사와 함께",
};

function formatHospitalOrderDetailOption(value: string) {
  return hospitalOrderDetailOptionLabels[value] ?? value;
}

function formatHospitalOrderDetailDefault(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (value === null || value === undefined || value === "") return "미설정";
  return String(value);
}

function HospitalOrderDefaultDetailFields({
  contract,
  disabled,
  onChange,
  values,
}: {
  contract: ClinicalOrderMasterContract;
  disabled: boolean;
  onChange: (key: string, value: unknown) => void;
  values: Record<string, unknown>;
}) {
  const canonicalSchema = getClinicalOrderFieldSchema(contract.clinicalOrderType, contract.detailSchemaVersion)!;
  const fields = (contract.detailFieldSchema.fields.length > 0
    ? contract.detailFieldSchema.fields
    : canonicalSchema.fields
  ).slice().sort((left, right) => left.displayOrder - right.displayOrder);

  return (
    <div className="border-t pt-5" data-testid="hospital-order-default-details">
      <div className="emr-text-body font-bold">기본 세부값</div>
      <p className="mt-1 emr-text-metadata text-muted-foreground">
        새 차트 Order에 복사되는 마스터 기본값입니다. 진료 시점에 정해지는
        담당자·검사 기관·병동은 임의로 채우지 않고 워크스페이스 정책으로
        결정합니다.
      </p>
      <div className="mt-4 grid gap-4">
        {fields.map((definition) => {
          const value = values[definition.key];
          const runtimeResolved = hospitalRuntimeDetailFieldKeys.has(
            definition.key,
          );
          const hint = runtimeResolved
            ? "진료/워크스페이스에서 결정됩니다. 마스터 기본값은 입력하지 않습니다."
            : "저장된 값이 없으면 미설정으로 표시됩니다. 스키마 기본값으로 채우지 않습니다.";

          if (runtimeResolved) {
            return (
              <DrawerField
                key={definition.key}
                hint={hint}
                label={definition.label}
                required={definition.required}
              >
                <div
                  aria-label={definition.label}
                  className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 emr-text-body text-muted-foreground"
                >
                  {value === undefined || value === null || value === ""
                    ? "진료/워크스페이스에서 결정"
                    : formatHospitalOrderDetailDefault(value)}
                </div>
              </DrawerField>
            );
          }

          return (
            <DrawerField
              key={definition.key}
              hint={hint}
              label={definition.label}
              required={definition.required}
            >
              <HospitalOrderDefaultDetailControl
                definition={definition}
                disabled={disabled}
                value={value}
                onChange={(nextValue) => onChange(definition.key, nextValue)}
              />
            </DrawerField>
          );
        })}
      </div>
    </div>
  );
}

function HospitalOrderDefaultDetailControl({
  definition,
  disabled,
  onChange,
  value,
}: {
  definition: ClinicalOrderFieldDefinition;
  disabled: boolean;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const ariaLabel = definition.label;
  const stringValue =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value.join(", ")
        : value === undefined || value === null
          ? ""
          : String(value);
  const inputConstraints = {
    maxLength: definition.validation.maxLength,
    min: definition.validation.min,
    max: definition.validation.max,
    step:
      definition.validation.precision === undefined
        ? undefined
        : 10 ** -definition.validation.precision,
  };

  if (definition.control === "switch") {
    if (typeof value !== "boolean") return (
      <Select disabled={disabled} value={null} onValueChange={(next) => onChange(next === null ? undefined : next === "true")}>
        <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder="미설정" /></SelectTrigger>
        <SelectContent><SelectItem value="true">사용</SelectItem><SelectItem value="false">미사용</SelectItem></SelectContent>
      </Select>
    );
    return (
      <label className="flex min-h-9 items-center gap-2 emr-text-body">
        <Switch
          aria-label={ariaLabel}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
        />
        {value === true ? "사용" : "미사용"}
      </label>
    );
  }

  if (definition.control === "select" && definition.options.length > 0) {
    return (
      <Select
        disabled={disabled}
        value={stringValue}
        onValueChange={(nextValue) => onChange(nextValue)}
      >
        <SelectTrigger aria-label={ariaLabel} className="h-9 w-full bg-card">
          <SelectValue placeholder="기본값을 선택해 주세요">
            {formatHospitalOrderDetailOption(stringValue)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {definition.options.map((option) => (
              <SelectItem key={option} value={option}>
                {formatHospitalOrderDetailOption(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  if (
    definition.control === "textarea" ||
    definition.control === "schedule" ||
    definition.valueType === "attachment_array"
  ) {
    return (
      <Textarea
        aria-label={ariaLabel}
        className="min-h-20 resize-none"
        disabled={disabled}
        maxLength={definition.validation.maxLength}
        placeholder="기본값을 입력해 주세요"
        value={stringValue}
        onChange={(event) => {
          const next = event.target.value;
          onChange(
            definition.valueType === "attachment_array"
              ? next
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
              : next,
          );
        }}
      />
    );
  }

  if (definition.valueType === "number" || definition.control === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          aria-label={ariaLabel}
          disabled={disabled}
          inputMode="decimal"
          type="number"
          value={stringValue}
          {...inputConstraints}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? undefined : Number(next));
          }}
        />
        {definition.unit ? (
          <span className="shrink-0 emr-text-metadata text-muted-foreground">
            {definition.unit}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={definition.validation.maxLength}
        placeholder="기본값을 입력해 주세요"
        value={stringValue}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
      {definition.unit ? (
        <span className="shrink-0 emr-text-metadata text-muted-foreground">
          {definition.unit}
        </span>
      ) : null}
    </div>
  );
}

export function HospitalAdminDrawer({ workspaceId }: ShellComponentProps) {
  const { hydrated, hydrate, session } = useAuthClient();
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const clearSelectedOrders = useHospitalAdminStore(
    (state) => state.clearSelectedOrders,
  );
  const orders = useHospitalAdminStore((state) => state.catalogWorkspaceId === workspaceId && state.catalogReadStatus === "ready" ? state.orders : emptyHospitalOrders);
  const catalogCapabilities = useHospitalAdminStore(
    (state) => state.catalogWorkspaceId === workspaceId && state.catalogReadStatus === "ready" ? state.catalogCapabilities : deniedCatalogCapabilities,
  );
  const setFocusedOrderId = useHospitalAdminStore(
    (state) => state.setFocusedOrderId,
  );
  const updateOrder = useHospitalAdminStore((state) => state.updateOrder);
  const order = orders.find((item) => item.id === activeDrawer?.id);
  const drawerRef = useRef<HTMLDivElement>(null);
  const responseScope = useRef<object | null>(null);
  useEffect(() => {
    responseScope.current = {};
    return () => { responseScope.current = null; };
  }, [workspaceId, activeDrawer?.id, activeDrawer?.type, session]);
  const [draftState, setDraftState] = useState<{
    draft: HospitalOrderDraft | null;
    orderId: string | null;
  }>({
    draft: order ?? null,
    orderId: order?.id ?? null,
  });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmTaxonomyResetOpen, setConfirmTaxonomyResetOpen] = useState(false);
  const [executionResolution, setExecutionResolution] = useState<{ field: string; action: "reset" | "keep" } | null>(null);
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<
    "approve" | "reject"
  >("approve");
  const [mutationStatus, setMutationStatus] =
    useState<OrderCatalogMutationStatus>("idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("meta");
  const draft =
    draftState.orderId === order?.id ? draftState.draft : (order ?? null);
  const mutationInFlight =
    mutationStatus === "saving" ||
    mutationStatus === "reviewing" ||
    mutationStatus === "stopping";
  const setDraft = (
    nextDraft:
      | HospitalOrderDraft
      | null
      | ((current: HospitalOrderDraft | null) => HospitalOrderDraft | null),
  ) => {
    if (!order) return;

    setDraftState(() => ({
      draft: typeof nextDraft === "function" ? nextDraft(draft) : nextDraft,
      orderId: order.id,
    }));
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const resetId = window.setTimeout(() => {
      setMutationStatus("idle");
      setMutationMessage(null);
      setConfirmTaxonomyResetOpen(false);
      setExecutionResolution(null);
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [order?.id]);

  useEffect(() => {
    if (activeDrawer?.type !== "hospital-order") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (drawerRef.current?.contains(target)) return;
      if (target.closest('[data-testid^="hospital-order-row-"]')) return;
      if (
        target.closest(
          '[data-slot="dialog-content"], [data-slot="dialog-overlay"], [data-slot="popover-content"], [data-slot="select-content"], [role="listbox"], [role="menu"]',
        )
      ) {
        return;
      }

      setActiveDrawer(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [activeDrawer?.type, setActiveDrawer]);

  if (activeDrawer?.type !== "hospital-order" || !order || !draft) {
    return (
      <div className="flex h-full items-center justify-center emr-text-dense text-muted-foreground">
        오더를 선택해 주세요.
      </div>
    );
  }

  const updateDraft = (nextDraft: Partial<HospitalOrderDraft>) =>
    setDraft((current) => (current ? { ...current, ...nextDraft } : current));
  const captureResponseScope = () => {
    const scope = responseScope.current;
    const generation = useHospitalAdminStore.getState().catalogGeneration;
    return () => {
      const state = useHospitalAdminStore.getState();
      const drawer = useLayoutStore.getState().activeDrawer;
      return scope !== null && responseScope.current === scope &&
        state.catalogWorkspaceId === workspaceId && state.catalogGeneration === generation &&
        state.catalogReadStatus === "ready" && drawer?.type === "hospital-order" && drawer.id === order.id;
    };
  };
  const creatingNewOrder = !order.sourceCatalogItem;
  const dispensingOrder = draft.categoryId === "dispensing";
  // The loaded source was validated. Keep editing an invalid numeric draft
  // visible so it can be corrected; save validation remains strict above.
  const rawPreparationAuthority = draft.defaultDetailInputs?.planOrderAuthority as PlanOrderAuthorityConfig | undefined;
  const preparationAuthority = rawPreparationAuthority?.schemaVersion === 2
    ? rawPreparationAuthority : null;
  const detailContract = getHospitalOrderDetailContract(draft);
  const generalDefaultDetailEditorVisible = Boolean(
    !creatingNewOrder &&
      !dispensingOrder &&
      detailContract &&
      detailContract.clinicalOrderType !== "dispensing",
  );
  const hospitalCreatedDispensing =
    draft.sourceKind === "hospital_created" && dispensingOrder;
  const reviewPending =
    hospitalCreatedDispensing && draft.dispensingReviewStatus === "pending";
  const canEdit = dispensingOrder
    ? catalogCapabilities.canAuthorDispensing
    : catalogCapabilities.canManageCatalog;
  // Preserve the baseline the user actually edited. A same-ID refresh must
  // never silently adopt a newer CAS revision for an older draft.
  const source = draft.sourceCatalogItem;
  const taxonomyChanged = Boolean(source && isHospitalOrderTaxonomyChanged(draft, source));
  const taxonomyOnly = Boolean(source && isHospitalOrderTaxonomyOnlyChange(draft, source));
  const taxonomyTransportReady = !source || (source.adminSubcategoryCode !== undefined && source.labFamilyCode !== undefined);
  const canEditTaxonomy = taxonomyTransportReady && (creatingNewOrder ? canEdit : catalogCapabilities.canManageCatalog);
  const taxonomyOptions = Object.entries(orderTaxonomySubcategories)
    .filter(([, definition]) => definition.clinicalType === draft.clinicalOrderType)
    .map(([value, definition]) => ({ value, label: definition.label }));
  const canResetTaxonomy = source?.originType === "clair_master" && Boolean(source.sourceMasterRecordId) &&
    source.customizationState !== "detached" && !source.customizedFields?.includes("*") &&
    canEditTaxonomy;
  const canResolveExecution = catalogCapabilities.canManageCatalog && source?.originType === "clair_master" &&
    source.customizationState !== "detached" &&
    !source.customizedFields?.some(field => ["*", "defaultDetailInputs", "default_detail_inputs"].includes(field));
  const saveValidationMessage = validateHospitalOrderDraft(draft, {
    creating: creatingNewOrder,
  });
  const saveDisabled =
    mutationInFlight || !(taxonomyOnly ? canEditTaxonomy : canEdit) ||
    (taxonomyChanged && !canEditTaxonomy) || Boolean(saveValidationMessage);
  const drawerTitle = creatingNewOrder
    ? getNewOrderDrawerTitle(draft.subcategoryId === "unclassified"
        ? getHospitalOrderCategory(draft.categoryId)?.label
        : getHospitalOrderSubcategory(draft.subcategoryId)?.label)
    : draft.standardName || "오더 상세";
  const duplicateDispensingOrders = hospitalCreatedDispensing
    ? orders
        .filter((candidate) => candidate.id !== order.id)
        .filter((candidate) => candidate.categoryId === "dispensing")
        .filter((candidate) => {
          const draftName = draft.inHospitalName.trim().toLowerCase();
          const candidateName = candidate.inHospitalName.trim().toLowerCase();
          const ingredient =
            draft.dispensingPreset?.ingredientName.trim().toLowerCase() ?? "";
          const candidateIngredient =
            candidate.dispensingPreset?.ingredientName
              .trim()
              .toLowerCase() ?? "";
          return (
            (draftName.length >= 3 && candidateName.includes(draftName)) ||
            (ingredient.length >= 3 && candidateIngredient === ingredient)
          );
        })
        .slice(0, 3)
    : [];

  const updateDispensingPreset = (
    patch: Partial<NonNullable<HospitalOrderDraft["dispensingPreset"]>>,
  ) => {
    const current = draft.dispensingPreset;
    if (!current) return;
    let next = { ...current, ...patch };
    if (
      next.autoDispenseQuantityEnabled &&
      ("dose" in patch ||
        "doseBasis" in patch || "doseUnit" in patch || "totalQuantityUnit" in patch ||
        "frequency" in patch ||
        "durationDays" in patch ||
        "autoDispenseQuantityEnabled" in patch)
    ) {
      next = {
        ...next,
        totalQuantity: calculateHospitalDispenseQuantity(next, draft.defaultDetailInputs?.planOrderAuthority),
        manualQuantityReason: "",
      };
    }
    updateDraft({ dispensingPreset: next });
  };

  const updateDefaultDetailInput = (key: string, value: unknown) => {
    const nextDefaults = { ...(draft.defaultDetailInputs ?? {}) };
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete nextDefaults[key];
    } else {
      nextDefaults[key] = value;
    }
    updateDraft({ defaultDetailInputs: nextDefaults });
  };

  const updatePreparationPolicy = (patch: Partial<PlanOrderPreparationPolicy>) => {
    if (!preparationAuthority?.preparationPolicy) return;
    const authority = { ...preparationAuthority, preparationPolicy: { ...preparationAuthority.preparationPolicy, ...patch } };
    updateDraft({ defaultDetailInputs: { ...draft.defaultDetailInputs, planOrderAuthority: authority },
      ...(draft.dispensingPreset ? { dispensingPreset: { ...draft.dispensingPreset,
        totalQuantity: calculateHospitalDispenseQuantity(draft.dispensingPreset, authority), autoDispenseQuantityEnabled: true } } : {}) });
  };

  const handleSave = async () => {
    const responseIsCurrent = captureResponseScope();
    if (source && source.workspaceId !== workspaceId) {
      setMutationStatus("error");
      setMutationMessage("워크스페이스가 변경되었습니다. 목록에서 오더를 다시 열어 주세요.");
      return;
    }
    const validationMessage = validateHospitalOrderDraft(draft, {
      creating: creatingNewOrder,
    });
    if (validationMessage) {
      setMutationStatus("error");
      setMutationMessage(validationMessage);
      return;
    }

    if (!hydrated || !session) {
      setMutationStatus("denied");
      setMutationMessage(
        "로그인된 병원관리자 세션을 확인한 뒤 다시 시도해 주세요.",
      );
      return;
    }

    setMutationStatus("saving");
    setMutationMessage("Order 변경사항을 저장하는 중입니다.");

    const input = buildWorkspaceCatalogMutationFromHospitalOrder({
      draft,
      source,
      workspaceId,
    });
    const result = await mutateHospitalAdminOrderCatalog({
      input,
      method: input.action === "create" ? "POST" : "PATCH",
      session,
      workspaceId,
    });

    if (!responseIsCurrent()) return;
    if (!result.ok) {
      setMutationStatus(
        result.denialReason === "permission_missing" ? "denied" : "error",
      );
      setMutationMessage(getOrderCatalogMutationFailureMessage(result));
      return;
    }

    const nextOrder = mapWorkspaceCatalogItemToHospitalOrder(result.item);
    updateOrder(order.id, nextOrder);
    setDraft(nextOrder);
    clearSelectedOrders();
    setFocusedOrderId(nextOrder.id);
    setActiveDrawer({
      type: "hospital-order",
      id: nextOrder.id,
      subtitle: nextOrder.standardName,
    });
    setMutationStatus("saved");
    setMutationMessage(
      creatingNewOrder
        ? "Order를 등록했습니다."
        : "Order 변경사항을 저장했습니다.",
    );
    toast.success(
      creatingNewOrder ? "Order를 등록했어요." : "Order 변경사항을 저장했어요.",
    );
  };

  const handleTaxonomyReset = async () => {
    const responseIsCurrent = captureResponseScope();
    setConfirmTaxonomyResetOpen(false);
    if (!source || source.workspaceId !== workspaceId || !canResetTaxonomy || mutationInFlight || !hydrated || !session) return;
    setMutationStatus("saving");
    setMutationMessage("마스터 분류를 확인하고 있습니다.");
    const result = await mutateHospitalAdminOrderCatalog({
      input: { action: "update", itemId: source.id, expectedCatalogRevision: source.catalogRevision ?? 1,
        patch: { resetTaxonomyFields: ["adminSubcategoryCode", "labFamilyCode"] } },
      method: "PATCH", session, workspaceId,
    });
    if (!responseIsCurrent()) return;
    if (!result.ok) {
      setMutationStatus("error");
      setMutationMessage(result.error === "invalid_input"
        ? "마스터 분류 또는 초기화 조건을 확인해 주세요. 저장값은 변경하지 않았습니다."
        : getOrderCatalogMutationFailureMessage(result));
      return;
    }
    const nextOrder = mapWorkspaceCatalogItemToHospitalOrder(result.item);
    updateOrder(order.id, nextOrder);
    setDraft(nextOrder);
    setMutationStatus("saved");
    setMutationMessage("마스터 분류로 초기화했습니다.");
  };

  const handleExecutionResolution = async () => {
    const responseIsCurrent = captureResponseScope();
    const resolution = executionResolution;
    setExecutionResolution(null);
    if (!resolution || !source || source.workspaceId !== workspaceId || !canResolveExecution || mutationInFlight || !hydrated || !session) return;
    setMutationStatus("saving");
    setMutationMessage("기본값의 원본 버전과 병원 수정값을 확인하고 있습니다.");
    const result = await mutateHospitalAdminOrderCatalog({
      input: { action: "update", itemId: source.id, expectedCatalogRevision: source.catalogRevision ?? 1,
        patch: resolution.action === "reset" ? { resetExecutionFields: [resolution.field] } : { keepExecutionFields: [resolution.field] } },
      method: "PATCH", session, workspaceId,
    });
    if (!responseIsCurrent()) return;
    if (!result.ok) {
      setMutationStatus("error");
      setMutationMessage(getOrderCatalogMutationFailureMessage(result));
      return;
    }
    const nextOrder = mapWorkspaceCatalogItemToHospitalOrder(result.item);
    updateOrder(order.id, nextOrder);
    setDraft(nextOrder);
    setMutationStatus("saved");
    setMutationMessage(resolution.action === "reset" ? "선택한 필드에 마스터 값을 적용했습니다." : "선택한 필드의 병원 값을 유지했습니다.");
  };

  const handleDelete = async () => {
    const responseIsCurrent = captureResponseScope();
    if (!hydrated || !session) {
      setMutationStatus("denied");
      setMutationMessage(
        "로그인된 병원관리자 세션을 확인한 뒤 다시 시도해 주세요.",
      );
      setConfirmDeleteOpen(false);
      return;
    }

    setMutationStatus("stopping");
    setMutationMessage("Order 사용을 중지하는 중입니다.");

    if (!order.sourceCatalogItem) {
      updateOrder(order.id, { isActive: false });
      setMutationStatus("saved");
      setMutationMessage("Order 사용을 중지했습니다.");
      setConfirmDeleteOpen(false);
      setActiveDrawer(null);
      return;
    }

    const result = await mutateHospitalAdminOrderCatalog({
      input: buildWorkspaceCatalogPauseMutation(
        order.sourceCatalogItem.id,
        order.sourceCatalogItem.catalogRevision ?? 1,
      ),
      method: "PATCH",
      session,
      workspaceId,
    });

    if (!responseIsCurrent()) return;
    if (!result.ok) {
      setMutationStatus(
        result.denialReason === "permission_missing" ? "denied" : "error",
      );
      setMutationMessage(getOrderCatalogMutationFailureMessage(result));
      setConfirmDeleteOpen(false);
      return;
    }

    updateOrder(order.id, mapWorkspaceCatalogItemToHospitalOrder(result.item));
    setFocusedOrderId(order.id);
    setMutationStatus("saved");
    setMutationMessage("Order 사용을 중지했습니다.");
    setConfirmDeleteOpen(false);
    setActiveDrawer(null);
  };

  const handleReview = async (decision: "approve" | "reject") => {
    const responseIsCurrent = captureResponseScope();
    if (!hydrated || !session || !order.sourceCatalogItem) {
      setMutationStatus("denied");
      setMutationMessage("로그인된 수의사 세션을 확인해 주세요.");
      setConfirmReviewOpen(false);
      return;
    }
    setMutationStatus("reviewing");
    setMutationMessage("수의사 승인과 사용 상태를 저장하는 중입니다.");
    const result = await mutateHospitalAdminOrderCatalog({
      input: buildWorkspaceDispensingReviewMutation(
        order.sourceCatalogItem.id,
        order.sourceCatalogItem.catalogRevision ?? 1,
        decision,
        decision === "reject" ? "병원 검토 반려" : undefined,
      ),
      method: "PATCH",
      session,
      workspaceId,
    });
    if (!responseIsCurrent()) return;
    setConfirmReviewOpen(false);
    if (!result.ok) {
      setMutationStatus(
        result.denialReason === "permission_missing" ? "denied" : "error",
      );
      setMutationMessage(getOrderCatalogMutationFailureMessage(result));
      return;
    }
    const nextOrder = mapWorkspaceCatalogItemToHospitalOrder(result.item);
    updateOrder(order.id, nextOrder);
    setDraft(nextOrder);
    setMutationStatus("saved");
    setMutationMessage(
      decision === "approve"
        ? "수의사 승인 후 사용 상태로 전환했습니다."
        : "조제 오더를 반려하고 사용 중지 상태로 전환했습니다.",
    );
    toast.success(
      decision === "approve"
        ? "조제 오더를 승인하고 사용 상태로 전환했어요."
        : "조제 오더를 반려했어요.",
    );
  };

  return (
    <div
      ref={drawerRef}
      className="relative flex h-full min-h-0 flex-col bg-card"
      data-testid="hospital-order-drawer"
    >
      <Dialog open={mutationInFlight}>
        {mutationInFlight ? (
          <DialogContent
            className="sm:max-w-[360px]"
            showCloseButton={false}
            data-testid="hospital-order-saving-dialog"
          >
            <DialogHeader>
              <DialogTitle>
                {mutationStatus === "stopping"
                  ? "Order 사용을 중지하는 중"
                  : "Order 저장 중"}
              </DialogTitle>
              <DialogDescription>
                {mutationMessage ??
                  "Workspace catalog 변경사항을 반영하고 있습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--emr-surface-muted)]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
      <header className="flex min-h-[72px] shrink-0 items-center gap-3 border-b px-6">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-semibold leading-7">
            {drawerTitle}
          </h2>
        </div>
        <label className="flex shrink-0 items-center gap-2 emr-text-dense font-semibold">
          사용여부
          <Switch
            aria-label="오더 사용여부"
            checked={reviewPending ? false : draft.isActive}
            disabled={mutationInFlight || reviewPending || !canEdit}
            onCheckedChange={(checked) =>
              updateDraft({ isActive: Boolean(checked) })
            }
          />
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="상세 닫기"
          onClick={() => setActiveDrawer(null)}
        >
          ×
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <FieldGroup className="px-8 py-6">
          <DrawerField label="분류">
            <div className="flex h-9 items-center rounded-lg border bg-[var(--emr-surface-muted)] px-3 emr-text-dense font-semibold">
              {formatHospitalOrderClassification(draft)}
            </div>
            <div className="mt-3 grid gap-3" data-testid="hospital-order-taxonomy-editor">
              <label className="grid gap-1 emr-text-metadata">
                세부 분류
                <DrawerSelect ariaLabel="오더 세부 분류" disabled={mutationInFlight || !canEditTaxonomy}
                  value={draft.subcategoryId}
                  items={[{ value: "unclassified", label: "미설정" }, ...taxonomyOptions,
                    ...(!taxonomyOptions.some(item => item.value === draft.subcategoryId) && draft.subcategoryId !== "unclassified"
                      ? [{ value: draft.subcategoryId, label: `${getHospitalOrderSubcategory(draft.subcategoryId)?.label ?? draft.subcategoryId} · 기존 분류` }] : [])]}
                  onValueChange={value => updateDraft({
                    subcategoryId: value as HospitalOrderSubcategoryId,
                    clinicalPathologyCategoryId: value === "clinical-pathology" ? draft.clinicalPathologyCategoryId : undefined,
                    classificationStatus: value === "unclassified" ? "subcategory_missing" : "resolved",
                  })} />
              </label>
              {draft.subcategoryId === "clinical-pathology" ? (
                <label className="grid gap-1 emr-text-metadata">
                  검사 계열
                  <DrawerSelect ariaLabel="오더 검사 계열" disabled={mutationInFlight || !canEditTaxonomy}
                    value={draft.clinicalPathologyCategoryId ?? "unset"}
                    items={[{ value: "unset", label: "미설정" }, ...Object.entries(orderTaxonomyLabFamilies).map(([value, label]) => ({ value, label }))]}
                    onValueChange={value => updateDraft({ clinicalPathologyCategoryId: value === "unset" ? undefined : value as HospitalOrderDraft["clinicalPathologyCategoryId"] })} />
                </label>
              ) : null}
              <p className="emr-text-metadata text-muted-foreground">
                {taxonomyTransportReady ? "업무유형과 임상 기본값은 바꾸지 않습니다. 변경한 분류는 저장 후 반영됩니다." : "분류 저장 정보가 아직 제공되지 않아 편집할 수 없습니다."}
              </p>
              {source?.taxonomyMergeConflict ? (
                <div role="status" className="rounded-lg border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-surface)] p-3 emr-text-metadata">
                  <strong>마스터 분류 갱신 충돌 · 원본 버전 {source.taxonomyMergeConflict.revision}</strong>
                  <p>병원에 저장된 분류를 유지했습니다. 분류 조합을 직접 수정하거나 마스터 분류로 초기화해 주세요.</p>
                </div>
              ) : null}
              {source?.originType === "clair_master" ? (
                <Dialog open={confirmTaxonomyResetOpen} onOpenChange={setConfirmTaxonomyResetOpen}>
                  <Button variant="outline" size="sm" disabled={mutationInFlight || !canResetTaxonomy}
                    onClick={() => setConfirmTaxonomyResetOpen(true)}>마스터 분류로 초기화</Button>
                  {source.customizedFields?.includes("*") ? <p className="emr-text-metadata text-muted-foreground">전체 수정 표시가 있어 분류만 초기화할 수 없습니다.</p> : null}
                  {confirmTaxonomyResetOpen ? <EmrConfirmDialogContent
                    title="마스터 분류로 초기화할까요?"
                    description="세부 분류와 검사 계열만 현재 마스터 값으로 저장합니다. 임상 기본값은 유지되며, 이 창의 미저장 변경사항은 취소됩니다."
                    cancelLabel="취소" confirmLabel="분류 초기화" closeAriaLabel="분류 초기화 확인 닫기"
                    onCancel={() => setConfirmTaxonomyResetOpen(false)} onConfirm={() => void handleTaxonomyReset()} /> : null}
                </Dialog>
              ) : null}
            </div>
            {draft.sourceCatalogItem?.classificationPath && (
              <p className="mt-2 break-words emr-text-metadata text-muted-foreground">
                저장 분류: {draft.sourceCatalogItem.classificationPath.actionName ?? "명칭 미설정"}
                {" · "}{draft.sourceCatalogItem.classificationPath.key}
                {" · "}{draft.sourceCatalogItem.classificationPath.actionCode}
              </p>
            )}
          </DrawerField>
          {source && ["clinical_lab", "external_lab"].includes(draft.clinicalOrderType ?? "") ? <LabResultProfileSelection
            workspaceId={workspaceId} catalogItemId={source.id} disabled={mutationInFlight} /> : null}
          <DrawerField label="핵심 세부 값" hint="값의 입력 여부이며 임상 검수나 차트 확정 가능 여부를 뜻하지 않습니다.">
            <p className="emr-text-metadata text-muted-foreground">{getHospitalOrderCoreStatus(draft)}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 emr-text-metadata">
              {getHospitalOrderCoreDetails(draft).map(({ definition, value }) => (
                <div key={definition.key}><dt className="text-muted-foreground">{definition.label}</dt><dd>{formatHospitalOrderTableDetailValue(definition, value) || "미설정"}</dd></div>
              ))}
            </dl>
          </DrawerField>
          {source?.executionSourceBaseline && Object.keys(source.executionSourceBaseline).length > 0 ? (
            <DrawerField label="기본값 출처와 갱신" hint="병원에서 수정한 필드는 마스터 갱신 때 유지됩니다. 마스터 적용은 선택한 필드만 저장하며, 이 창의 미저장 변경사항은 취소됩니다.">
              <div className="grid gap-2" data-testid="hospital-order-execution-lineage">
                {Object.entries(source.executionSourceBaseline).map(([key, lineage]) => {
                  const overridden = source.customizedFields?.some(field =>
                    field === `defaultDetailInputs.${key}` || ["*", "defaultDetailInputs", "default_detail_inputs"].includes(field));
                  const conflict = source.executionMergeConflicts?.[key];
                  const fieldLabel = detailContract?.detailFieldSchema.fields.find(field => field.key === key)?.label ?? key;
                  const masterValue = !lineage.cell.present ? "값 없음 · 입력 정책만 저장됨" : lineage.cell.value === null ? "명시적으로 비움" :
                    typeof lineage.cell.value === "string" ? lineage.cell.value || "빈 문자열" : JSON.stringify(lineage.cell.value);
                  return <div key={key} className="rounded-lg border p-3 emr-text-metadata" data-testid={`execution-lineage-${key}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{fieldLabel}</strong><span className="text-muted-foreground">{overridden ? "병원 수정" : "마스터 상속"} · 마스터 {lineage.masterRevision} / 기본값 {lineage.presetRevision}</span></div>
                    <p className="mt-1 break-words text-muted-foreground">마스터 값: {masterValue}</p>
                    {conflict ? <p role="status" className="mt-1">병원과 마스터에서 모두 변경했습니다. 병원 저장값을 유지하고 있습니다.</p> : null}
                    {(overridden || conflict) ? <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={mutationInFlight || !canResolveExecution} onClick={() => setExecutionResolution({ field: key, action: "reset" })}>마스터 값 적용</Button>
                      {conflict ? <Button variant="outline" size="sm" disabled={mutationInFlight || !canResolveExecution} onClick={() => setExecutionResolution({ field: key, action: "keep" })}>병원 값 유지</Button> : null}
                    </div> : null}
                  </div>;
                })}
                {source.executionMergeConflicts?.$schema || source.executionMergeConflicts?.$contract ?
                  <p role="alert" className="emr-text-metadata">업무 스키마 또는 필드 조합이 맞지 않아 자동 갱신을 적용하지 않았습니다. 병원 저장값을 확인해 주세요.</p> : null}
                {!canResolveExecution && source.customizedFields?.some(field => ["*", "defaultDetailInputs", "default_detail_inputs"].includes(field)) ?
                  <p className="emr-text-metadata text-muted-foreground">기존 전체 수정 표시가 있어 필드별 초기화를 할 수 없습니다. 전체 원본 비교·적용으로 먼저 정리해 주세요.</p> : null}
              </div>
              <Dialog open={executionResolution !== null} onOpenChange={open => { if (!open) setExecutionResolution(null); }}>
                {executionResolution ? <EmrConfirmDialogContent
                  title={executionResolution.action === "reset" ? "이 필드에 마스터 값을 적용할까요?" : "이 필드의 병원 값을 유지할까요?"}
                  description="선택한 필드의 갱신 결정을 저장합니다. 다른 저장값은 유지되고 이 창의 미저장 변경사항은 취소됩니다."
                  cancelLabel="취소" confirmLabel={executionResolution.action === "reset" ? "마스터 값 적용" : "병원 값 유지"}
                  closeAriaLabel="기본값 갱신 확인 닫기" onCancel={() => setExecutionResolution(null)} onConfirm={() => void handleExecutionResolution()} /> : null}
              </Dialog>
            </DrawerField>
          ) : null}
          {dispensingOrder ? (
            <DrawerField
              label="출처 / 검토"
              hint={
                draft.sourceKind === "clair_master"
                  ? "CLAiR 마스터의 병원 기본값입니다. 병원 대상 범위 수정은 임상 검토 범위를 확장하지 않습니다."
                  : "이 병원 워크스페이스 전용 오더입니다. CLAiR 글로벌 마스터로 자동 등록되지 않습니다."
              }
            >
              <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-[var(--emr-surface-muted)] px-3 py-2 emr-text-dense">
                <Badge variant="outline">
                  {draft.sourceKind === "clair_master"
                    ? "CLAiR 마스터"
                    : draft.sourceKind === "hospital_created"
                      ? "병원 직접 생성"
                      : "기존 오더"}
                </Badge>
                <Badge
                  variant={
                    draft.dispensingReviewStatus === "approved"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {draft.dispensingReviewStatus === "approved"
                    ? "수의사 승인"
                    : draft.dispensingReviewStatus === "rejected"
                      ? "반려"
                      : draft.dispensingReviewStatus === "pending"
                        ? "검토 대기"
                        : getHospitalDispensingTableDetails(draft).reviewLabel}
                </Badge>
                {draft.dispensingReviewRevision ? (
                  <span className="text-muted-foreground">
                    revision {draft.dispensingReviewRevision}
                  </span>
                ) : null}
              </div>
            </DrawerField>
          ) : null}
          <DrawerField label="표준 Order명">
            <Input
              readOnly={!creatingNewOrder}
              placeholder="표준 Order명을 입력해 주세요"
              value={draft.standardName}
              onChange={(event) =>
                updateDraft({ standardName: event.target.value })
              }
            />
          </DrawerField>
          <DrawerField
            label="원내 Order명"
            required
            hint="진료항목을 원내에서 사용하는 국문 이름으로 변경할 수 있습니다."
          >
            <Input
              placeholder="원내에서 사용할 Order명을 입력해 주세요"
              value={draft.inHospitalName}
              onChange={(event) =>
                updateDraft({ inHospitalName: event.target.value })
              }
            />
          </DrawerField>
          <DrawerField
            label="청구서명"
            required
            hint="보호자에게 표시하는 청구서명을 별도로 지정할 수 있습니다."
          >
            <Input
              placeholder="청구서에 표시할 이름을 입력해 주세요"
              value={draft.billingName}
              onChange={(event) =>
                updateDraft({ billingName: event.target.value })
              }
            />
          </DrawerField>
          {duplicateDispensingOrders.length > 0 ? (
            <DrawerField label="유사 오더">
              <div className="rounded-lg border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-surface)] px-3 py-2 emr-text-metadata">
                <strong className="block">기존 오더와 유사합니다.</strong>
                <span className="mt-1 block text-muted-foreground">
                  {duplicateDispensingOrders
                    .map((candidate) => candidate.inHospitalName)
                    .join(", ")}
                  . 기존 항목을 확인한 뒤 필요하면 계속 등록할 수 있습니다.
                </span>
              </div>
            </DrawerField>
          ) : null}
          <DrawerField
            label="별칭"
            hint="진료항목을 검색하기 위한 별칭입니다. 쉼표로 여러 개를 입력할 수 있습니다."
          >
            <Input
              placeholder="검색 별칭을 입력해 주세요"
              value={draft.aliases}
              onChange={(event) => updateDraft({ aliases: event.target.value })}
            />
          </DrawerField>
          <DrawerField
            label="일감전달여부"
            required
            hint="조제/처치, 임상병리, 영상검사실에 일감을 전달할지 설정합니다."
          >
            <DrawerSelect
              ariaLabel="일감전달여부"
              disabled={!creatingNewOrder}
              value={draft.delivery}
              items={[
                { label: deliveryLabels.deliver, value: "deliver" },
                {
                  label: deliveryLabels["do-not-deliver"],
                  value: "do-not-deliver",
                },
              ]}
              onValueChange={(delivery) =>
                updateDraft({
                  delivery: delivery as HospitalOrderDraft["delivery"],
                })
              }
            />
          </DrawerField>
          <DrawerField
            label="대상"
            required
            hint="하나 이상의 대상을 선택하는 후속 UX 전까지 대표 대상값으로 표시합니다."
          >
            <DrawerSelect
              ariaLabel="대상"
              value={draft.target}
              items={Object.entries(targetLabels).map(([value, label]) => ({
                label,
                value,
              }))}
              onValueChange={(target) =>
                updateDraft({ target: target as HospitalOrderDraft["target"] })
              }
            />
          </DrawerField>
          {dispensingOrder && draft.dispensingPreset ? (
            <>
              <div className="border-t pt-5">
                <div className="emr-text-body font-bold">기본 처방값</div>
                <p className="mt-1 emr-text-metadata text-muted-foreground">
                  새 차트 오더에 복사되는 병원 기본값이며, 수의사는 환자별로
                  확정 전에 수정할 수 있습니다.
                </p>
              </div>
              <DrawerField label="성분 / 조제 내용" required>
                <Input
                  aria-label="성분 또는 조제 내용"
                  placeholder="예: Amoxicillin 50 mg 조제정"
                  value={draft.dispensingPreset.ingredientName}
                  onChange={(event) =>
                    updateDispensingPreset({
                      ingredientName: event.target.value,
                    })
                  }
                />
              </DrawerField>
              <DrawerField label="1회 용량" required>
                <DrawerSelect
                  ariaLabel="용량 기준"
                  value={draft.dispensingPreset.doseBasis ?? ""}
                  items={[{ label: "환자당", value: "patient" }, { label: "체중당", value: "kg" }, { label: "체표면적당", value: "body_surface_area" }]}
                  onValueChange={(value) => updateDispensingPreset({ doseBasis: value })}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
                  <Input
                    aria-label="1회 용량"
                    inputMode="decimal"
                    value={draft.dispensingPreset.dose ?? ""}
                    onChange={(event) =>
                      updateDispensingPreset({
                        dose: event.target.value.trim() === "" ? undefined : Number(event.target.value),
                      })
                    }
                  />
                  <DrawerSelect
                    ariaLabel="용량 단위"
                    value={draft.dispensingPreset.doseUnit}
                    items={[
                      { label: "정", value: "tablet" },
                      { label: "캡슐", value: "capsule" },
                      { label: "mL", value: "ml" },
                      { label: "g", value: "g" },
                      { label: "포", value: "sachet" },
                    ]}
                    onValueChange={(doseUnit) =>
                      updateDispensingPreset({
                        doseUnit,
                        totalQuantityUnit: doseUnit,
                      })
                    }
                  />
                </div>
              </DrawerField>
              <DrawerField label="경로 / 빈도" required>
                <div className="grid grid-cols-2 gap-2">
                  <DrawerSelect
                    ariaLabel="투여 경로"
                    value={draft.dispensingPreset.route}
                    items={[
                      { label: "경구(PO)", value: "PO" },
                      { label: "피하(SC)", value: "SC" },
                      { label: "근육(IM)", value: "IM" },
                      { label: "외용", value: "topical" },
                      { label: "귀", value: "otic" },
                      { label: "안과", value: "ophthalmic" },
                      { label: "경피", value: "transdermal" },
                    ]}
                    onValueChange={(route) =>
                      updateDispensingPreset({ route })
                    }
                  />
                  <DrawerSelect
                    ariaLabel="투여 빈도"
                    value={draft.dispensingPreset.frequency}
                    items={[
                      { label: "1회", value: "once" },
                      { label: "하루 1회", value: "sid" },
                      { label: "하루 2회", value: "bid" },
                      { label: "하루 3회", value: "tid" },
                      { label: "하루 4회", value: "qid" },
                      { label: "격일", value: "qod" },
                    ]}
                    onValueChange={(frequency) =>
                      updateDispensingPreset({ frequency })
                    }
                  />
                </div>
              </DrawerField>
              <DrawerField label="일수 / 총량" required>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] gap-2">
                  <Input
                    aria-label="투여 일수"
                    inputMode="decimal"
                    value={draft.dispensingPreset.durationDays ?? ""}
                    onChange={(event) =>
                      updateDispensingPreset({
                        durationDays: event.target.value.trim() === "" ? undefined : Number(event.target.value),
                      })
                    }
                  />
                  <Input
                    aria-label="처방 총량"
                    disabled={
                      draft.dispensingPreset.autoDispenseQuantityEnabled
                    }
                    inputMode="decimal"
                    value={draft.dispensingPreset.totalQuantity ?? ""}
                    onChange={(event) =>
                      updateDispensingPreset({
                        totalQuantity: event.target.value.trim() === "" ? undefined : Number(event.target.value),
                      })
                    }
                  />
                  <Input
                    aria-label="총량 단위"
                    value={draft.dispensingPreset.totalQuantityUnit}
                    onChange={(event) =>
                      updateDispensingPreset({
                        totalQuantityUnit: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 emr-text-metadata">
                  {typeof draft.dispensingPreset.autoDispenseQuantityEnabled !== "boolean" ? (
                    <DrawerSelect
                      ariaLabel="총량 자동 계산"
                      value=""
                      items={[{ label: "자동 계산", value: "true" }, { label: "수동 입력", value: "false" }]}
                      onValueChange={(value) => updateDispensingPreset({ autoDispenseQuantityEnabled: value === "true" })}
                    />
                  ) : (
                  <Switch
                    aria-label="총량 자동 계산"
                    disabled={Boolean(preparationAuthority)}
                    checked={
                      draft.dispensingPreset.autoDispenseQuantityEnabled
                    }
                    onCheckedChange={(checked) =>
                      updateDispensingPreset({
                        autoDispenseQuantityEnabled: Boolean(checked),
                      })
                    }
                  />
                  )}
                  총량 자동 계산
                  <span className="text-muted-foreground">
                    {calculateHospitalDispenseQuantity(draft.dispensingPreset, draft.defaultDetailInputs?.planOrderAuthority) === undefined
                      ? "계산에 필요한 값 미설정 또는 변환 조건 미충족"
                      : `용량 × 빈도 × 일수${draft.defaultDetailInputs?.planOrderAuthority ? " · 저장된 준비 규칙 적용" : ""} = ${calculateHospitalDispenseQuantity(draft.dispensingPreset, draft.defaultDetailInputs?.planOrderAuthority)}${draft.dispensingPreset.totalQuantityUnit}`}
                  </span>
                </div>
                {preparationAuthority?.preparationPolicy ? (
                  <div className="mt-3 grid gap-3 rounded-lg border p-3" data-testid="hospital-preparation-authority">
                    <p className="emr-text-metadata font-semibold">준비 예정량 규칙 · 실제 수행 기록과 별도</p>
                    {preparationAuthority.productReference ? <p className="emr-text-metadata text-muted-foreground">
                      {preparationAuthority.productReference.productName} · {preparationAuthority.productReference.strengthDescription}
                      <br />합성 데모 전용 · 임상 검증 안 됨
                    </p> : null}
                    <label className="grid gap-1 emr-text-metadata">계량 단위
                      <Input aria-label="준비 계량 단위" type="number" min="0.000000001" step="any"
                        value={preparationAuthority.preparationPolicy.increment}
                        onChange={event => updatePreparationPolicy({ increment: Number(event.target.value) })} />
                    </label>
                    <label className="grid gap-1 emr-text-metadata">반올림 적용 범위
                      <DrawerSelect ariaLabel="준비 반올림 범위" value={preparationAuthority.preparationPolicy.quantityScope ?? ""}
                        items={[{ value: "course_total", label: "처방 전체" }, { value: "per_administration", label: "매회" }]}
                        onValueChange={value => updatePreparationPolicy({ quantityScope: value as PlanOrderPreparationPolicy["quantityScope"] })} />
                    </label>
                    <label className="grid gap-1 emr-text-metadata">계량 방식
                      <DrawerSelect ariaLabel="준비 계량 방식" value={preparationAuthority.preparationPolicy.roundingMode}
                        items={[{ value: "up", label: "올림" }, { value: "nearest", label: "반올림" }, { value: "down", label: "내림" }]}
                        onValueChange={value => updatePreparationPolicy({ roundingMode: value as PlanOrderPreparationPolicy["roundingMode"] })} />
                    </label>
                    <label className="grid gap-1 emr-text-metadata">표시 소수 자릿수
                      <Input aria-label="준비 표시 소수 자릿수" type="number" min="0" max="9" step="1"
                        value={preparationAuthority.preparationPolicy.displayPrecision}
                        onChange={event => updatePreparationPolicy({ displayPrecision: Number(event.target.value) })} />
                    </label>
                    <p className="emr-text-metadata text-muted-foreground">이 규칙은 저장 후 새 오더에 적용됩니다. 환자별 준비량 조정과 실제 조제 결과는 차트·수행 화면에서 따로 기록해 주세요.</p>
                  </div>
                ) : null}
                {draft.dispensingPreset.autoDispenseQuantityEnabled === false ? (
                  <Input
                    aria-label="수동 총량 보정 사유"
                    className="mt-2"
                    placeholder="수동 총량 보정 사유를 입력해 주세요"
                    value={draft.dispensingPreset.manualQuantityReason}
                    onChange={(event) =>
                      updateDispensingPreset({
                        manualQuantityReason: event.target.value,
                      })
                    }
                  />
                ) : null}
              </DrawerField>
              <DrawerField label="복용 / 보관" required>
                <div className="grid grid-cols-2 gap-2">
                  <DrawerSelect
                    ariaLabel="복용 시점"
                    value={draft.dispensingPreset.medicationInstruction}
                    items={[
                      { label: "식후", value: "after_meal" },
                      { label: "식전", value: "before_meal" },
                      { label: "식사와 함께", value: "with_meal" },
                      { label: "시간 무관", value: "any_time" },
                    ]}
                    onValueChange={(medicationInstruction) =>
                      updateDispensingPreset({ medicationInstruction })
                    }
                  />
                  <DrawerSelect
                    ariaLabel="보관 방법"
                    value={draft.dispensingPreset.storageMethod}
                    items={[
                      { label: "실온", value: "room_temp" },
                      {
                        label: "실온·차광",
                        value: "room_temp_light_protected",
                      },
                      { label: "냉장", value: "refrigerated" },
                      {
                        label: "냉장·차광",
                        value: "refrigerated_light_protected",
                      },
                    ]}
                    onValueChange={(storageMethod) =>
                      updateDispensingPreset({ storageMethod })
                    }
                  />
                </div>
              </DrawerField>
              <DrawerField label="조제 지시">
                <Textarea
                  className="min-h-20 resize-none"
                  placeholder="조제 과정에서 확인할 내용을 입력해 주세요"
                  value={draft.dispensingPreset.compoundNote}
                  onChange={(event) =>
                    updateDispensingPreset({
                      compoundNote: event.target.value,
                    })
                  }
                />
              </DrawerField>
              <DrawerField label="보호자 복약지도">
                <Textarea
                  className="min-h-20 resize-none"
                  placeholder="보호자에게 전달할 기본 복약지도를 입력해 주세요"
                  value={draft.dispensingPreset.guardianNote}
                  onChange={(event) =>
                    updateDispensingPreset({
                      guardianNote: event.target.value,
                    })
                  }
                />
              </DrawerField>
            </>
          ) : null}
          {generalDefaultDetailEditorVisible && detailContract ? (
            <HospitalOrderDefaultDetailFields
              contract={detailContract}
              disabled={mutationInFlight || !canEdit}
              onChange={updateDefaultDetailInput}
              values={draft.defaultDetailInputs ?? {}}
            />
          ) : null}
          <DrawerField label="케어가이드">
            <Textarea
              className="min-h-24 resize-none"
              maxLength={500}
              placeholder="내용을 입력해주세요"
              value={draft.careGuide}
              onChange={(event) =>
                updateDraft({ careGuide: event.target.value })
              }
            />
            <div className="mt-1 text-right emr-text-metadata text-muted-foreground">
              {draft.careGuide.length}/500자
            </div>
          </DrawerField>
          <DrawerField label="원내 지시사항">
            <Textarea
              className="min-h-24 resize-none"
              maxLength={500}
              placeholder="내용을 입력해주세요"
              value={draft.hospitalInstruction}
              onChange={(event) =>
                updateDraft({ hospitalInstruction: event.target.value })
              }
            />
            <div className="mt-1 text-right emr-text-metadata text-muted-foreground">
              {draft.hospitalInstruction.length}/500자
            </div>
          </DrawerField>
          <DrawerField label="메모">
            <Textarea
              className="min-h-20 resize-none"
              maxLength={500}
              placeholder="내용을 입력해주세요"
              value={draft.memo}
              onChange={(event) => updateDraft({ memo: event.target.value })}
            />
            <div className="mt-1 text-right emr-text-metadata text-muted-foreground">
              {draft.memo.length}/500자
            </div>
          </DrawerField>
          <DrawerField label="금액" required>
            {dispensingOrder ? (
              <div className="mb-2 grid gap-2 md:grid-cols-[86px_minmax(100px,1fr)]">
                <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">
                  가격 방식
                </div>
                <DrawerSelect
                  ariaLabel="가격 방식"
                  value={draft.priceMode ?? "fixed"}
                  items={[
                    { label: "수량 연동", value: "per_quantity" },
                    { label: "처방 정액", value: "fixed" },
                  ]}
                  onValueChange={(priceMode) =>
                    updateDraft({
                      priceMode: priceMode as NonNullable<
                        HospitalOrderDraft["priceMode"]
                      >,
                      saleUnit:
                        priceMode === "fixed" ? "session" : "each",
                    })
                  }
                />
              </div>
            ) : null}
            <div className="grid gap-2 md:grid-cols-[86px_minmax(100px,1fr)_86px_minmax(100px,1fr)]">
              <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">
                판매 단위
              </div>
              <DrawerSelect
                ariaLabel="판매 단위"
                value={draft.saleUnit}
                items={Object.entries(saleUnitLabels).map(([value, label]) => ({
                  label,
                  value,
                }))}
                onValueChange={(saleUnit) =>
                  updateDraft({
                    saleUnit: saleUnit as HospitalOrderDraft["saleUnit"],
                  })
                }
              />
              <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">
                {draft.priceMode === "per_quantity" ? "단가" : "판매 금액"}
              </div>
              <Input
                aria-label="판매 금액"
                inputMode="numeric"
                placeholder="판매 금액 입력"
                value={creatingNewOrder && draft.price <= 0 ? "" : draft.price}
                onChange={(event) =>
                  updateDraft({
                    price: Number(event.target.value.replace(/\D/g, "")),
                  })
                }
              />
            </div>
            {dispensingOrder && draft.dispensingPreset ? (
              <p className="mt-2 emr-text-metadata text-muted-foreground">
                {draft.priceMode === "per_quantity"
                  ? draft.dispensingPreset.totalQuantity === undefined
                    ? "처방 총량 미설정 — 금액 계산 불가"
                    : `차트 확정 총량 ${draft.dispensingPreset.totalQuantity}${draft.dispensingPreset.totalQuantityUnit} × ${draft.price.toLocaleString()}원 = ${(draft.dispensingPreset.totalQuantity * draft.price).toLocaleString()}원`
                  : `차트 확정 시 수량과 관계없이 처방 1건당 ${draft.price.toLocaleString()}원`}
                으로 스냅샷을 고정합니다.
              </p>
            ) : null}
            <div className="mt-2 grid gap-2 md:grid-cols-[86px_minmax(100px,1fr)_86px_minmax(100px,1fr)]">
              <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">
                반올림
              </div>
              <DrawerSelect
                ariaLabel="반올림"
                value={draft.roundRule}
                items={Object.entries(roundRuleLabels).map(
                  ([value, label]) => ({ label, value }),
                )}
                onValueChange={(roundRule) =>
                  updateDraft({
                    roundRule: roundRule as HospitalOrderDraft["roundRule"],
                  })
                }
              />
              <label className="flex items-center emr-text-metadata font-semibold text-muted-foreground">
                과세
              </label>
              <label className="flex h-9 items-center gap-2 rounded-lg border px-3 emr-text-dense font-semibold">
                <Checkbox
                  aria-label="과세 여부"
                  checked={draft.isTaxable}
                  onCheckedChange={(checked) =>
                    updateDraft({ isTaxable: Boolean(checked) })
                  }
                />
                과세
              </label>
            </div>
          </DrawerField>
          <DrawerField label="변경 이력">
            <div className="flex h-9 items-center border-b px-3 emr-text-dense">
              {draft.updatedAtLabel} {draft.updatedBy}
            </div>
          </DrawerField>
          <LineTabs
            aria-label="오더 상세 부가 탭"
            value={tab}
            items={[...drawerTabs]}
            size="default"
            onValueChange={setTab}
          />
          {tab === "meta" ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="w-40 text-muted-foreground">
                      업무유형
                    </TableCell>
                    <TableCell className="font-semibold">
                      {serviceItemTypeLabels[draft.serviceItemType]}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">
                      청구 반영
                    </TableCell>
                    <TableCell className="font-semibold">
                      {draft.billable ? "청구 가능" : "비청구"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">
                      판매금액
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatHospitalOrderAmount(draft.price)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableBody>
                  {draft.referenceItems.map((item) => (
                    <TableRow key={item.label}>
                      <TableCell className="w-40 text-muted-foreground">
                        {item.label}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {item.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </FieldGroup>
      </ScrollArea>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-6 py-4 shadow-sm">
        {creatingNewOrder ? (
          <div />
        ) : reviewPending ? (
          <Dialog
            open={confirmReviewOpen}
            onOpenChange={setConfirmReviewOpen}
          >
            <div className="flex gap-2">
              <Button
                size="default"
                variant="outline"
                disabled={
                  mutationInFlight ||
                  !catalogCapabilities.canApproveDispensing
                }
                onClick={() => {
                  setReviewDecision("reject");
                  setConfirmReviewOpen(true);
                }}
              >
                반려
              </Button>
              <Button
                size="default"
                disabled={
                  mutationInFlight ||
                  !catalogCapabilities.canApproveDispensing
                }
                onClick={() => {
                  setReviewDecision("approve");
                  setConfirmReviewOpen(true);
                }}
              >
                수의사 승인
              </Button>
            </div>
            {confirmReviewOpen ? (
              <EmrConfirmDialogContent
                title={
                  reviewDecision === "approve"
                    ? "조제 오더를 승인할까요?"
                    : "조제 오더를 반려할까요?"
                }
                description={
                  reviewDecision === "approve"
                    ? "승인하면 이 워크스페이스의 차트 오더 검색에서 사용할 수 있습니다. 이미 확정된 과거 오더는 바뀌지 않습니다."
                    : "반려하면 신규 차트 선택에서 제외되고, 작성 내용과 감사 이력은 유지됩니다."
                }
                cancelLabel="취소"
                confirmLabel={reviewDecision === "approve" ? "승인" : "반려"}
                confirmButtonVariant={
                  reviewDecision === "reject" ? "destructive" : "default"
                }
                closeAriaLabel="조제 오더 검토 확인 닫기"
                onCancel={() => setConfirmReviewOpen(false)}
                onConfirm={() => void handleReview(reviewDecision)}
              />
            ) : null}
          </Dialog>
        ) : (
          <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <Button
              size="default"
              variant="destructive"
              disabled={mutationInFlight}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              사용 중지
            </Button>
            {confirmDeleteOpen ? (
              <EmrConfirmDialogContent
                title="Order 사용을 중지할까요?"
                description={`${order.standardName} 항목은 차트 신규 선택에서 제외되고, 과거 진료와 청구 기록은 유지됩니다.`}
                cancelLabel="취소"
                confirmLabel="사용 중지"
                confirmButtonVariant="destructive"
                closeAriaLabel="Order 사용 중지 확인 닫기"
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={handleDelete}
              />
            ) : null}
          </Dialog>
        )}
        <div
          className={cn(
            "min-w-0 flex-1 text-right emr-text-metadata",
            mutationStatus === "denied" || mutationStatus === "error"
              ? "text-[var(--emr-text-danger)]"
              : "text-muted-foreground",
          )}
          data-testid="hospital-order-mutation-status"
        >
          {mutationMessage}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            disabled={mutationInFlight}
            onClick={() => setDraft(order)}
          >
            취소
          </Button>
          <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
            <Button
              disabled={saveDisabled}
              title={saveValidationMessage ?? undefined}
              onClick={() => setConfirmSaveOpen(true)}
            >
              {mutationStatus === "saving" ? "저장 중" : "저장"}
            </Button>
            {confirmSaveOpen ? (
              <EmrConfirmDialogContent
                title={
                  creatingNewOrder
                    ? "오더를 등록할까요?"
                    : "Order 변경사항을 저장할까요?"
                }
                description={
                  creatingNewOrder
                    ? hospitalCreatedDispensing
                      ? `${draft.standardName} 항목이 이 워크스페이스 전용 검토 대기 오더로 등록됩니다. 수의사 승인 전에는 차트 검색에 표시되지 않습니다.`
                      : `${draft.standardName} 항목이 이 병원의 Order Catalog에 등록되고, 저장 후 차트의 Order 추가 검색 후보로 표시됩니다.`
                    : hospitalCreatedDispensing
                      ? "변경값은 새 revision과 검토 대기로 저장됩니다. 새 차트 오더부터 적용되고, 미확정 초안·확정·조제·청구 snapshot은 자동으로 바뀌지 않습니다."
                      : "병원관리 Order Catalog와 차트 선택 후보에 변경값이 반영됩니다. 새 차트 오더부터 적용되며 미확정 초안과 이미 확정된 과거 Order snapshot은 유지됩니다."
                }
                cancelLabel="취소"
                confirmLabel={creatingNewOrder ? "등록" : "저장"}
                closeAriaLabel="Order 저장 확인 닫기"
                onCancel={() => setConfirmSaveOpen(false)}
                onConfirm={() => {
                  setConfirmSaveOpen(false);
                  void handleSave();
                }}
              />
            ) : null}
          </Dialog>
        </div>
      </footer>
    </div>
  );
}
