"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CdsActionsListFilterIcon,
  CdsActionsCopyIcon,
} from "@/components/cds-icons/actions-and-controls";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrEmptyState } from "@/components/emr/empty-state";
import {
  EmrModuleListSidePanel,
  EmrModuleListSidePanelBadge,
  type EmrModuleListSidePanelItem,
  type EmrModuleListSidePanelSectionChild,
} from "@/components/emr/module-list-side-panel";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import {
  EmrTableCellText,
  EmrTableHeaderCell,
  EmrTableSelectionCell,
  EmrTableSelectionHeaderCell,
} from "@/components/emr/table-primitives";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
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
  getHospitalOrderCategory,
  getHospitalOrderSubcategory,
  mapWorkspaceCatalogItemToHospitalOrder,
  mapWorkspaceCatalogItemsToHospitalOrders,
  roundRuleLabels,
  saleUnitLabels,
  serviceItemTypeLabels,
  targetLabels,
  type HospitalOrderBillingFilter,
  type HospitalOrderCatalogItem,
  type HospitalOrderCategoryId,
  type HospitalOrderDraft,
  type HospitalOrderStatusFilter,
  type HospitalOrderSubcategoryId,
  type HospitalOrderWorkTypeFilter,
} from "@/features/hospital-admin/data";
import { WorkspaceMembershipManagement } from "@/features/auth/workspace-membership-management";
import { HospitalBasicSettingsScreen } from "@/features/hospital-admin/settings/hospital-basic-settings-screen";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { HospitalScheduleScreen } from "@/features/hospital-admin/schedule/hospital-schedule-screen";
import { RolePermissionManagementScreen } from "@/features/hospital-admin/role-permission-management/screen";
import {
  useHospitalAdminStore,
  type HospitalAdminSection,
} from "@/features/hospital-admin/store";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableDensity,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import type { OrderCatalogItem } from "@/features/hospital-admin/server-order-catalog";
import type { OrderCatalogMutationInput } from "@/features/hospital-admin/server-order-catalog";
import type { ShellComponentProps } from "@/types/emr";

const orderSetPlaceholderId = "order-set-placeholder";
const hospitalAdminSections = new Set<HospitalAdminSection>([
  "audit",
  "members",
  "orders",
  "roles",
  "schedule",
  "settings",
  "space-time",
  "vitals",
]);

const statusFilterItems: Array<{ label: string; value: HospitalOrderStatusFilter }> = [
  { label: "전체", value: "all" },
  { label: "사용", value: "active" },
  { label: "중지", value: "inactive" },
];

const billingFilterItems: Array<{ label: string; value: HospitalOrderBillingFilter }> = [
  { label: "청구 전체", value: "all" },
  { label: "청구 가능", value: "billable" },
  { label: "비청구", value: "not-billable" },
];

const workTypeFilterItems: Array<{ label: string; value: HospitalOrderWorkTypeFilter }> = [
  { label: "업무 전체", value: "all" },
  { label: "진료", value: "consultation" },
  { label: "검사", value: "lab" },
  { label: "의약품", value: "medication" },
  { label: "처치", value: "treatment" },
  { label: "영상", value: "imaging" },
  { label: "입원", value: "hospitalization" },
  { label: "기타", value: "misc" },
];

const drawerTabs = [
  { label: "부가정보", value: "meta" },
  { label: "참조값", value: "reference" },
] as const;

type DrawerTab = (typeof drawerTabs)[number]["value"];

const hospitalOrderTableMinWidthClass = "min-w-[1060px]";
const hospitalOrderTableMinWidth = 1060;
const hospitalOrderTableColumnClasses = {
  select: "w-10",
  type: "w-[72px]",
  standardName: "w-[180px]",
  inHospitalName: "w-[170px]",
  billingName: "w-[160px]",
  status: "w-[86px]",
  price: "w-[110px]",
  target: "w-[96px]",
  actions: "w-[80px]",
} as const;

type HospitalOrderTableColumnKey = keyof typeof hospitalOrderTableColumnClasses;
type HospitalOrderTableSortDirection = "asc" | "desc";
type HospitalOrderTableSortKey = "standardName" | "inHospitalName" | "billingName" | "price";
type HospitalOrderTableSortState = {
  direction: HospitalOrderTableSortDirection;
  key: HospitalOrderTableSortKey;
} | null;
type HospitalOrderTableFilterOption = {
  label: string;
  value: string;
};

type HospitalOrderTableHeaderColumn = {
  align?: "left" | "right";
  className?: string;
  interaction: EmrTableHeaderInteraction;
  key: HospitalOrderTableColumnKey;
  label: string;
  resize: EmrColumnResize;
  sortKey?: HospitalOrderTableSortKey;
};

const hospitalOrderTableHeaderColumns: HospitalOrderTableHeaderColumn[] = [
  {
    key: "type",
    label: "유형",
    interaction: "filterable",
    resize: "data-column",
  },
  {
    key: "standardName",
    label: "표준 Order명",
    interaction: "sortable",
    resize: "data-column",
    sortKey: "standardName",
  },
  {
    key: "inHospitalName",
    label: "원내 Order명",
    interaction: "sortable",
    resize: "data-column",
    sortKey: "inHospitalName",
  },
  {
    key: "billingName",
    label: "청구서명",
    interaction: "sortable",
    resize: "data-column",
    sortKey: "billingName",
  },
  {
    key: "status",
    label: "사용여부",
    interaction: "filterable",
    resize: "data-column",
  },
  {
    key: "price",
    label: "판매금액",
    align: "right",
    interaction: "sortable",
    resize: "data-column",
    sortKey: "price",
  },
  {
    key: "target",
    label: "대상",
    interaction: "filterable",
    resize: "data-column",
  },
];

const hospitalOrderNameTextMode: EmrTableCellTextMode = "two-line-if-long";
const hospitalOrderTableSortLabels: Record<HospitalOrderTableSortKey, string> = {
  billingName: "청구서명",
  inHospitalName: "원내 Order명",
  price: "판매금액",
  standardName: "표준 Order명",
};
const hospitalOrderStatusFilterOptions: HospitalOrderTableFilterOption[] = [
  { label: "사용", value: "active" },
  { label: "중지", value: "inactive" },
];
const hospitalOrderBillingFilterOptions: HospitalOrderTableFilterOption[] = [
  { label: "청구 가능", value: "billable" },
  { label: "비청구", value: "not-billable" },
];
type OrderMenuChild = {
  label: string;
  categoryId?: HospitalOrderCategoryId;
  disabled?: boolean;
  subcategoryId?: HospitalOrderSubcategoryId;
};

type OrderMenuGroup = {
  children: OrderMenuChild[];
  id: string;
  label: string;
};

type HospitalAdminMenuItem = {
  icon: typeof SettingsIcon;
  label: string;
  section?: HospitalAdminSection;
  testId?: string;
};

const hospitalAdminMenuItems: HospitalAdminMenuItem[] = [
  { label: "병원기본설정", icon: SettingsIcon, section: "settings", testId: "hospital-admin-menu-settings" },
  { label: "병원구성원 관리", icon: UsersIcon, section: "members", testId: "hospital-admin-menu-members" },
  { label: "감사 로그", icon: DocumentCheckIcon, section: "audit", testId: "hospital-admin-menu-audit" },
  { label: "근무표", icon: CalendarIcon, section: "schedule", testId: "hospital-admin-menu-schedule" },
  { label: "역할 및 권한", icon: GridIcon, section: "roles", testId: "hospital-admin-menu-roles" },
  { label: "공간/시간 관리", icon: BuildingIcon, section: "space-time", testId: "hospital-admin-menu-space-time" },
  { label: "진료과 분리운영", icon: LayersIcon },
  { label: "바이탈 관리", icon: ActivityIcon, section: "vitals", testId: "hospital-admin-menu-vitals" },
  { label: "차트 템플릿", icon: ClipboardListIcon },
  { label: "장비 관리", icon: DatabaseIcon },
  { label: "마약류 관리", icon: ShieldIcon },
];

const orderMenuGroups: OrderMenuGroup[] = [
  {
    id: "general",
    label: "전체",
    children: [{ label: "전체", disabled: true }],
  },
  {
    id: "care",
    label: "진료",
    children: [
      { label: "기본 진료비", categoryId: "consultation" as const, subcategoryId: "basic-consultation" as const },
      { label: "기타 진료비", categoryId: "consultation" as const, subcategoryId: "other-consultation" as const },
    ],
  },
  {
    id: "prevention",
    label: "예방",
    children: [{ label: "예방", categoryId: "prevention" as const, subcategoryId: "prevention" as const }],
  },
  {
    id: "lab",
    label: "검사",
    children: [
      { label: "영상검사", categoryId: "imaging" as const, subcategoryId: "radiography" as const },
      { label: "임상병리 검사", categoryId: "lab" as const, subcategoryId: "clinical-pathology" as const },
      { label: "계통 검사", categoryId: "lab" as const, subcategoryId: "blood-chemistry" as const },
      { label: "의뢰 검사", categoryId: "lab" as const, subcategoryId: "external-lab" as const },
    ],
  },
  {
    id: "procedure",
    label: "처치",
    children: [{ label: "처치", categoryId: "treatment" as const, subcategoryId: "basic-treatment" as const }],
  },
  {
    id: "surgery",
    label: "수술",
    children: [
      { label: "마취", categoryId: "surgery" as const, subcategoryId: "anesthesia" as const },
      { label: "수술", categoryId: "surgery" as const, subcategoryId: "surgery" as const },
    ],
  },
  {
    id: "inpatient",
    label: "입원",
    children: [{ label: "입원", categoryId: "hospitalization" as const, subcategoryId: "hospitalization" as const }],
  },
  {
    id: "therapy",
    label: "치료",
    children: [{ label: "치료", categoryId: "therapy" as const, subcategoryId: "therapy" as const }],
  },
  {
    id: "inventory",
    label: "처방/조제/의료물품",
    children: [
      { label: "처방", categoryId: "dispensing" as const, subcategoryId: "oral-medication" as const },
      { label: "조제", categoryId: "dispensing" as const, subcategoryId: "injection" as const },
      { label: "의료물품", categoryId: "medical-supply" as const, subcategoryId: "medical-supply" as const },
    ],
  },
];

const orderTypeTabsBySubcategory: Partial<Record<HospitalOrderSubcategoryId, Array<{ label: string; value: string }>>> = {
  "clinical-pathology": [
    { label: "전체", value: "all" },
    { label: "원내 혈액 검사", value: "in-house-blood" },
    { label: "임상 미생물 검사", value: "microbiology" },
    { label: "전해질검사/동맥혈", value: "electrolyte-abg" },
    { label: "혈액화학검사", value: "chemistry" },
    { label: "CBC검사", value: "cbc" },
    { label: "CSF검사", value: "csf" },
    { label: "세포 검사", value: "cell" },
    { label: "체액 검사", value: "fluid" },
    { label: "요검사", value: "urinalysis" },
    { label: "기타 병리 검사", value: "etc" },
  ],
};

const defaultOrderTypeTabs = [
  { label: "전체", value: "all" },
  { label: "원내 항목", value: "in-house" },
  { label: "외부 항목", value: "external" },
];

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

type OrderCatalogReadStatus = "idle" | "loading" | "ready" | "fallback" | "denied";

type OrderCatalogAdminReadResponse =
  | { ok: true; items: OrderCatalogItem[] }
  | { ok: false; denialReason?: string; error?: string };

type OrderCatalogAdminMutationResponse =
  | { ok: true; item: OrderCatalogItem }
  | { ok: false; denialReason?: string; error?: string };

type OrderCatalogMutationStatus = "idle" | "saving" | "stopping" | "saved" | "denied" | "error";

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
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog`,
    {
      method,
      headers: {
        ...getDemoActorHeaders(session),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );
  const body = (await response.json()) as OrderCatalogAdminMutationResponse;

  if (!response.ok || !body.ok) {
    return {
      ok: false,
      denialReason: !body.ok ? body.denialReason : undefined,
      error: !body.ok ? body.error : "request_failed",
    };
  }

  return body;
}

function validateHospitalOrderDraft(draft: HospitalOrderDraft, options: { creating: boolean } = { creating: false }) {
  if (!draft.standardName.trim()) return "표준 Order명을 입력해 주세요.";
  if (!draft.inHospitalName.trim()) return "원내 Order명을 입력해 주세요.";
  if (!draft.billingName.trim()) return "청구서명을 입력해 주세요.";
  if (!draft.delivery) return "일감전달여부를 선택해 주세요.";
  if (!draft.target) return "대상을 선택해 주세요.";
  if (!draft.saleUnit) return "판매 단위를 선택해 주세요.";
  if (options.creating && (!Number.isFinite(draft.price) || draft.price <= 0)) {
    return "판매금액을 입력해 주세요.";
  }
  if (!Number.isFinite(draft.price) || draft.price < 0) return "판매금액은 0원 이상이어야 합니다.";

  return null;
}

function getNewOrderDrawerTitle(subcategoryLabel?: string) {
  if (subcategoryLabel === "임상병리 검사") return "임상병리 오더 추가";
  if (!subcategoryLabel) return "오더 추가";

  return `${subcategoryLabel} 오더 추가`;
}

function getOrderCatalogMutationFailureMessage(result: Extract<OrderCatalogAdminMutationResponse, { ok: false }>) {
  if (result.denialReason === "permission_missing") {
    return "병원관리자 권한이 있는 사용자만 Order를 변경할 수 있습니다.";
  }
  if (result.denialReason === "order_not_found") {
    return "변경할 Order를 찾지 못했습니다. 목록을 새로고침해 주세요.";
  }
  if (result.error === "invalid_input") {
    return "필수값이나 금액 형식이 올바르지 않습니다.";
  }

  return "Order 변경을 저장하지 못했습니다.";
}

function getVisibleOrders(
  orders: HospitalOrderCatalogItem[],
  {
    billingFilter,
    searchQuery,
    selectedCategoryId,
    selectedSubcategoryId,
    statusFilter,
    workTypeFilter,
  }: {
    billingFilter: HospitalOrderBillingFilter;
    searchQuery: string;
    selectedCategoryId: string;
    selectedSubcategoryId: string;
    statusFilter: HospitalOrderStatusFilter;
    workTypeFilter: HospitalOrderWorkTypeFilter;
  }
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return orders
    .filter((order) => order.categoryId === selectedCategoryId)
    .filter((order) => order.subcategoryId === selectedSubcategoryId)
    .filter((order) => {
      if (statusFilter === "active") return order.isActive;
      if (statusFilter === "inactive") return !order.isActive;

      return true;
    })
    .filter((order) => {
      if (billingFilter === "billable") return order.billable;
      if (billingFilter === "not-billable") return !order.billable;

      return true;
    })
    .filter((order) => workTypeFilter === "all" || order.serviceItemType === workTypeFilter)
    .filter((order) => {
      if (!normalizedQuery) return true;

      return [
        order.aliases,
        order.billingName,
        order.inHospitalName,
        order.standardName,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((left, right) => left.standardName.localeCompare(right.standardName));
}

function compareHospitalOrderValues(left: string | number | null | undefined, right: string | number | null | undefined) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";

  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;

  return String(left).localeCompare(String(right), "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

function getHospitalOrderSortValue(order: HospitalOrderCatalogItem, key: HospitalOrderTableSortKey) {
  if (key === "price") return order.price;

  return order[key];
}

function sortHospitalOrderTableRows(
  orders: HospitalOrderCatalogItem[],
  sortState: HospitalOrderTableSortState
) {
  if (!sortState) return orders;

  return orders
    .map((order, index) => ({ index, order }))
    .sort((left, right) => {
      const compared = compareHospitalOrderValues(
        getHospitalOrderSortValue(left.order, sortState.key),
        getHospitalOrderSortValue(right.order, sortState.key)
      );
      if (compared === 0) return left.index - right.index;

      return sortState.direction === "asc" ? compared : -compared;
    })
    .map((entry) => entry.order);
}

function getUniqueHospitalOrderFilterOptions(
  orders: HospitalOrderCatalogItem[],
  getValue: (order: HospitalOrderCatalogItem) => string,
  labels: Record<string, string>
): HospitalOrderTableFilterOption[] {
  const values = new Set(orders.map(getValue).filter(Boolean));

  return Array.from(values)
    .map((value) => ({ label: labels[value] ?? value, value }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, "ko-KR", {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function parseHospitalOrderPriceFilterValue(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getHospitalOrderTableFilterFields(
  orders: HospitalOrderCatalogItem[]
): Array<EmrTableFilterBuilderField<HospitalOrderCatalogItem>> {
  return [
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
      options: getUniqueHospitalOrderFilterOptions(orders, (order) => order.target, targetLabels),
      valuePlaceholder: "대상 선택",
    },
    {
      getValue: (order) => order.serviceItemType,
      id: "serviceItemType",
      label: "업무유형",
      operators: [{ id: "is", label: "Is" }],
      options: getUniqueHospitalOrderFilterOptions(
        orders,
        (order) => order.serviceItemType,
        serviceItemTypeLabels
      ),
      valuePlaceholder: "업무유형 선택",
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
            return threshold === null ? true : Number(fieldValue ?? 0) >= threshold;
          },
        },
        {
          id: "lte",
          label: "이하",
          match: (fieldValue, ruleValue) => {
            const threshold = parseHospitalOrderPriceFilterValue(ruleValue);
            return threshold === null ? true : Number(fieldValue ?? 0) <= threshold;
          },
        },
      ],
      valueKind: "text",
      valuePlaceholder: "금액 입력",
    },
  ];
}

function getSubcategoryCount(orders: HospitalOrderCatalogItem[], subcategoryId: string) {
  return orders.filter((order) => order.subcategoryId === subcategoryId).length;
}

function HospitalOrderSortableHeader({
  column,
  onSort,
  sortState,
}: {
  column: HospitalOrderTableHeaderColumn & { sortKey: HospitalOrderTableSortKey };
  onSort: (key: HospitalOrderTableSortKey) => void;
  sortState: HospitalOrderTableSortState;
}) {
  const active = sortState?.key === column.sortKey;
  const label = hospitalOrderTableSortLabels[column.sortKey];
  const nextAction =
    !active || !sortState
      ? `${label} 오름차순 정렬`
      : sortState.direction === "asc"
        ? `${label} 내림차순 정렬`
        : `${label} 정렬 해제`;
  const activeDirectionLabel =
    sortState?.direction === "asc"
      ? "오름차순"
      : sortState?.direction === "desc"
        ? "내림차순"
        : "";
  const ariaLabel = active
    ? `현재 정렬: ${label} ${activeDirectionLabel}. 클릭하면 ${nextAction}.`
    : `정렬 없음. 클릭하면 ${nextAction}.`;

  return (
    <EmrTableHeaderCell
      align={column.align}
      className={cn(hospitalOrderTableColumnClasses[column.key], column.className)}
      interaction={column.interaction}
      resize={column.resize}
      sortDirection={active ? sortState.direction : undefined}
      sortLabel={ariaLabel}
      title={ariaLabel}
      onSort={() => onSort(column.sortKey)}
    >
      {column.label}
    </EmrTableHeaderCell>
  );
}

type HospitalAdminConceptSection = Exclude<
  HospitalAdminSection,
  "audit" | "members" | "orders" | "roles" | "schedule" | "settings"
>;

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
  "space-time": {
    section: "space-time",
    title: "공간/시간 관리",
    badge: "운영 캘린더",
    breadcrumb: "병원관리 / 공간·시간 관리",
    description: "진료 공간, 예약 단위, 운영시간을 한 곳에서 관리",
    highlights: [
      { label: "공간", value: "6개" },
      { label: "기본 예약 간격", value: "15분" },
      { label: "점심 차단", value: "13:00-14:00" },
      { label: "예약 가능일", value: "30일" },
    ],
    fields: [
      { label: "기본 예약 간격", value: "15분", kind: "select", options: ["10분", "15분", "20분", "30분"] },
      { label: "예약 오픈 범위", value: "30일", kind: "select", options: ["14일", "30일", "60일", "90일"] },
      { label: "점심시간 예약 차단", value: "true", kind: "switch" },
      { label: "응급 슬롯 유지", value: "true", kind: "switch" },
      { label: "공휴일 기본 정책", value: "전화 확인", kind: "select", options: ["휴무", "전화 확인", "응급 예약만"] },
    ],
    table: {
      title: "공간 운영 상태",
      columns: ["공간", "유형", "사용", "예약 단위"],
      rows: [
        ["진료실 1", "진료", "사용", "15분"],
        ["진료실 2", "진료", "사용", "15분"],
        ["처치실", "처치", "사용", "20분"],
        ["임상병리실", "검사", "사용", "검사별"],
        ["영상실", "영상", "사용", "30분"],
        ["수술실", "수술", "제한", "수동 배정"],
      ],
    },
    impactItems: ["접수/예약 캘린더", "진료실 배정", "검사실 큐", "Home 운영 상태"],
    modelItems: ["workspace_rooms", "workspace_operating_hours", "appointment_slot_rules"],
  },
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
      { label: "기본 종", value: "개", kind: "select", options: ["개", "고양이"] },
      { label: "차트 입력 시 경고", value: "true", kind: "switch" },
      { label: "입원 보드 색상 강조", value: "true", kind: "switch" },
      { label: "체중 변화 경고", value: "10% 이상", kind: "select", options: ["5% 이상", "10% 이상", "15% 이상"] },
      { label: "통증 점수 기준", value: "5점 이상", kind: "select", options: ["4점 이상", "5점 이상", "6점 이상"] },
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
    impactItems: ["차트 바이탈 입력", "입원 보드 경고", "처치 전 체크", "퇴원 전 확인"],
    modelItems: ["workspace_vital_rules", "species_vital_ranges", "vital_alert_policies"],
  },
};

function HospitalAdminConceptFieldControl({ field }: { field: HospitalAdminConceptField }) {
  if (field.kind === "switch") {
    return (
      <div className="flex h-9 items-center rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-card px-3">
        <Switch defaultChecked={field.value === "true"} aria-label={field.label} />
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

function HospitalAdminConceptTable({ table }: { table: HospitalAdminConceptTable }) {
  return (
    <section className="overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card">
      <div className="border-b border-[var(--emr-line-hairline)] px-4 py-3">
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
                <TableCell key={`${cell}-${index}`} className={index === 0 ? "font-medium" : undefined}>
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

function HospitalAdminConceptScreen({
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
              <h1 className="text-[20px] font-semibold leading-7">{config.title}</h1>
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
                className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card px-4 py-3"
              >
                <div className="emr-text-metadata text-muted-foreground">{item.label}</div>
                <div className="mt-1 truncate text-[16px] font-semibold leading-6">{item.value}</div>
              </div>
            ))}
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-w-0 gap-4">
              <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card">
                <div className="border-b border-[var(--emr-line-hairline)] px-4 py-3">
                  <h2 className="emr-text-panel-title font-semibold">기본값</h2>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {config.fields.map((field) => (
                    <Field key={field.label} className={field.kind === "textarea" ? "md:col-span-2" : undefined}>
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
              <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card">
                <div className="border-b border-[var(--emr-line-hairline)] px-4 py-3">
                  <h2 className="emr-text-panel-title font-semibold">영향 범위</h2>
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

              <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card">
                <div className="border-b border-[var(--emr-line-hairline)] px-4 py-3">
                  <h2 className="emr-text-panel-title font-semibold">향후 데이터</h2>
                </div>
                <div className="grid gap-2 p-3">
                  {config.modelItems.map((item) => (
                    <Badge key={item} variant="outline" className="w-fit rounded-md">
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

export function HospitalAdminSidePanel({ moduleLabel }: ShellComponentProps) {
  const activeSection = useHospitalAdminStore((state) => state.activeSection);
  const cancelPendingSectionChange = useHospitalAdminStore((state) => state.cancelPendingSectionChange);
  const confirmPendingSectionChange = useHospitalAdminStore((state) => state.confirmPendingSectionChange);
  const orders = useHospitalAdminStore((state) => state.orders);
  const pendingSection = useHospitalAdminStore((state) => state.pendingSection);
  const requestSectionChange = useHospitalAdminStore((state) => state.requestSectionChange);
  const selectedCategoryId = useHospitalAdminStore((state) => state.selectedCategoryId);
  const selectedSubcategoryId = useHospitalAdminStore((state) => state.selectedSubcategoryId);
  const settingsDirty = useHospitalAdminStore((state) => state.settingsDirty);
  const setSelectedCategoryId = useHospitalAdminStore((state) => state.setSelectedCategoryId);
  const setSelectedSubcategoryId = useHospitalAdminStore((state) => state.setSelectedSubcategoryId);
  const discardAllSettingsDrafts = useHospitalBasicSettingsStore((state) => state.discardAllDrafts);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["orders"]));
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
  const orderSectionChildren: EmrModuleListSidePanelSectionChild[] = orderMenuGroups.flatMap((group) => [
    {
      type: "groupLabel" as const,
      id: `${group.id}-label`,
      label: group.label,
    },
    ...group.children.filter((item) => item.categoryId && item.subcategoryId).map((item) => {
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
            {getSubcategoryCount(orders, item.subcategoryId)}
          </EmrModuleListSidePanelBadge>
        ) : undefined,
        disabled: item.disabled,
        label: item.label,
        onClick: () => {
          if (!item.categoryId || !item.subcategoryId) return;

          requestSectionChange("orders");
          setSelectedCategoryId(item.categoryId);
          setSelectedSubcategoryId(item.subcategoryId);
        },
      };
    }),
  ]);
  const sidePanelItems: EmrModuleListSidePanelItem[] = [
    ...hospitalAdminMenuItems.map((item) => {
      const Icon = item.icon;
      const nextSection = item.section;

      return {
        type: "button" as const,
        id: item.label,
        active: nextSection ? activeSection === nextSection : false,
        disabled: !nextSection,
        icon: <Icon className="size-4 shrink-0" />,
        label: item.label,
        onClick: nextSection
          ? () => {
              const shouldConfirmNavigation =
                activeSection === "settings" && settingsDirty && nextSection !== "settings";
              requestSectionChange(nextSection);
              if (shouldConfirmNavigation) return;
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                setModulePanelOpen(false);
              }
            }
          : undefined,
        testId: item.testId,
      };
    }),
    {
      type: "section",
      id: "orders",
      label: "Order 관리",
      icon: <DocumentIcon className="size-4 shrink-0" />,
      showGroupLabels: false,
      testId: "hospital-admin-menu-order-management",
      children: orderSectionChildren,
    },
    {
      type: "button",
      id: "order-set",
      count: <EmrModuleListSidePanelBadge variant="outline">후속</EmrModuleListSidePanelBadge>,
      disabled: true,
      icon: <FolderIcon className="size-4 shrink-0" />,
      label: "Order 세트",
      testId: orderSetPlaceholderId,
    },
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
            requestSectionChange("orders");
          }

          toggleSection(sectionId);
        }}
        openSectionIds={openSections}
        testId="hospital-admin-side-panel"
      />
      <Dialog
        open={pendingSection !== null}
        onOpenChange={(open) => {
          if (!open) cancelPendingSectionChange();
        }}
      >
        <EmrConfirmDialogContent
          title="저장하지 않은 변경사항이 있습니다"
          description="이 화면을 나가면 저장하지 않은 변경사항이 사라집니다."
          cancelLabel="계속 편집"
          confirmLabel="변경사항 버리고 이동"
          confirmButtonVariant="destructive"
          onCancel={cancelPendingSectionChange}
          onConfirm={() => {
            discardAllSettingsDrafts();
            confirmPendingSectionChange();
          }}
        />
      </Dialog>
    </>
  );
}

export function HospitalAdminContent({ workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const { hydrated, hydrate, session } = useAuthClient();
  const activeSection = useHospitalAdminStore((state) => state.activeSection);
  const billingFilter = useHospitalAdminStore((state) => state.billingFilter);
  const clearSelectedOrders = useHospitalAdminStore((state) => state.clearSelectedOrders);
  const createOrder = useHospitalAdminStore((state) => state.createOrder);
  const duplicateOrder = useHospitalAdminStore((state) => state.duplicateOrder);
  const focusedOrderId = useHospitalAdminStore((state) => state.focusedOrderId);
  const orders = useHospitalAdminStore((state) => state.orders);
  const searchQuery = useHospitalAdminStore((state) => state.searchQuery);
  const selectedCategoryId = useHospitalAdminStore((state) => state.selectedCategoryId);
  const selectedOrderIds = useHospitalAdminStore((state) => state.selectedOrderIds);
  const selectedSubcategoryId = useHospitalAdminStore((state) => state.selectedSubcategoryId);
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const setActiveSection = useHospitalAdminStore((state) => state.setActiveSection);
  const setBillingFilter = useHospitalAdminStore((state) => state.setBillingFilter);
  const setFocusedOrderId = useHospitalAdminStore((state) => state.setFocusedOrderId);
  const setOrders = useHospitalAdminStore((state) => state.setOrders);
  const setSearchQuery = useHospitalAdminStore((state) => state.setSearchQuery);
  const setStatusFilter = useHospitalAdminStore((state) => state.setStatusFilter);
  const setWorkTypeFilter = useHospitalAdminStore((state) => state.setWorkTypeFilter);
  const statusFilter = useHospitalAdminStore((state) => state.statusFilter);
  const toggleOrderSelection = useHospitalAdminStore((state) => state.toggleOrderSelection);
  const toggleVisibleOrderSelection = useHospitalAdminStore(
    (state) => state.toggleVisibleOrderSelection
  );
  const workTypeFilter = useHospitalAdminStore((state) => state.workTypeFilter);
  const [catalogReadStatus, setCatalogReadStatus] = useState<OrderCatalogReadStatus>("idle");
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("standard");
  const [orderFilterOpen, setOrderFilterOpen] = useState(false);
  const [orderFilterModel, setOrderFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel(
      "hospital-order-catalog-filter",
      "hospital-order-catalog-filter-rule-1"
    )
  );
  const [orderSortState, setOrderSortState] = useState<HospitalOrderTableSortState>(null);
  const selectedSubcategory = getHospitalOrderSubcategory(selectedSubcategoryId);
  const orderTypeTabs = orderTypeTabsBySubcategory[selectedSubcategoryId] ?? defaultOrderTypeTabs;
  const selectedLeafLabel =
    orderMenuGroups
      .flatMap((group) => group.children)
      .find(
        (item) =>
          item.categoryId === selectedCategoryId &&
          item.subcategoryId === selectedSubcategoryId
      )?.label ??
    selectedSubcategory?.label ??
    "Order 관리";
  const requestedSection = searchParams.get("section");

  useEffect(() => {
    if (!requestedSection || !hospitalAdminSections.has(requestedSection as HospitalAdminSection)) {
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
  const baseVisibleOrders = useMemo(
    () =>
      getVisibleOrders(orders, {
        billingFilter,
        searchQuery,
        selectedCategoryId,
        selectedSubcategoryId,
        statusFilter,
        workTypeFilter,
      }),
    [
      billingFilter,
      orders,
      searchQuery,
      selectedCategoryId,
      selectedSubcategoryId,
      statusFilter,
      workTypeFilter,
    ]
  );
  const orderFilterFields = useMemo(
    () => getHospitalOrderTableFilterFields(baseVisibleOrders),
    [baseVisibleOrders]
  );
  const activeOrderFilterCount = getEmrTableFilterBuilderActiveCount(
    orderFilterModel,
    orderFilterFields
  );
  const visibleOrders = useMemo(
    () =>
      sortHospitalOrderTableRows(
        filterRowsByEmrTableFilterBuilder(
          baseVisibleOrders,
          orderFilterModel,
          orderFilterFields
        ),
        orderSortState
      ),
    [baseVisibleOrders, orderFilterFields, orderFilterModel, orderSortState]
  );
  const visibleOrderIds = visibleOrders.map((order) => order.id);
  const selectedVisibleCount = visibleOrderIds.filter((id) => selectedOrderIds.includes(id)).length;
  const allVisibleSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const hasCatalogRows = orders.length > 0;
  const orderEmptyStateKind = hasCatalogRows ? "no-filter-results" : "no-data";
  const orderEmptyStatePriority = hasCatalogRows ? "local-recovery" : "supporting";
  const orderEmptyStateTitle = hasCatalogRows
    ? "조건에 맞는 Order가 없습니다"
    : "등록된 Order가 없습니다";
  const orderEmptyStateDescription = hasCatalogRows
    ? "조건을 초기화하면 숨겨진 Order가 다시 보입니다."
    : "Order가 등록되면 이 표에 표시됩니다.";
  const handleOrderSort = (key: HospitalOrderTableSortKey) => {
    setOrderSortState((current) => {
      if (current?.key !== key) return { direction: "asc", key };
      if (current.direction === "asc") return { direction: "desc", key };

      return null;
    });
  };
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;

    const controller = new AbortController();
    let canceled = false;

    const loadCatalog = async () => {
      await Promise.resolve();
      if (canceled) return;

      if (!session) {
        setCatalogReadStatus("denied");
        return;
      }

      setCatalogReadStatus("loading");

      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog`,
          {
            headers: getDemoActorHeaders(session),
            signal: controller.signal,
          }
        );
        const body = (await response.json()) as OrderCatalogAdminReadResponse;
        if (canceled) return;

        if (!response.ok || !body.ok) {
          setCatalogReadStatus(response.status === 401 || response.status === 403 ? "denied" : "fallback");
          return;
        }

        setOrders(mapWorkspaceCatalogItemsToHospitalOrders(body.items));
        setCatalogReadStatus("ready");
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return;
        setCatalogReadStatus("fallback");
      }
    };

    void loadCatalog();

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [hydrated, session, setOrders, workspaceId]);

  if (activeSection === "members") {
    return (
      <WorkspaceMembershipManagement
        workspaceId={workspaceId}
        onOpenRoleManagement={() => setActiveSection("roles")}
      />
    );
  }

  if (activeSection === "audit") {
    return <HospitalAdminAuditReview workspaceId={workspaceId} />;
  }

  if (activeSection === "settings") {
    return <HospitalBasicSettingsScreen workspaceId={workspaceId} />;
  }

  if (activeSection === "schedule") {
    return <HospitalScheduleScreen workspaceId={workspaceId} />;
  }

  if (activeSection === "roles") {
    return (
      <RolePermissionManagementScreen
        workspaceId={workspaceId}
        onOpenMemberManagement={() => setActiveSection("members")}
      />
    );
  }

  if (
    activeSection === "space-time" ||
    activeSection === "vitals"
  ) {
    return <HospitalAdminConceptScreen section={activeSection} />;
  }

  const openDrawer = (order: HospitalOrderCatalogItem) => {
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
  };

  const handleCreateOrder = () => {
    const order = createOrder();

    setFocusedOrderId(order.id);
    setActiveDrawer({ type: "hospital-order", id: order.id, subtitle: getNewOrderDrawerTitle(selectedSubcategory?.label) });
  };

  const handleDuplicateFirstSelected = () => {
    const duplicated = selectedOrderIds[0] ? duplicateOrder(selectedOrderIds[0]) : null;
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]">
      <section className="border-b bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7">{selectedLeafLabel}</h1>
              <Badge variant="secondary">{visibleOrders.length}</Badge>
            </div>
            <div className="mt-1 max-w-2xl emr-text-dense leading-5 text-muted-foreground">
              병원관리 / Order 관리 / {selectedLeafLabel}
            </div>
            <div
              className="mt-1 emr-text-metadata text-muted-foreground"
              data-testid="hospital-order-catalog-read-status"
            >
              {catalogReadStatus === "loading"
                ? "Workspace catalog 불러오는 중"
                : catalogReadStatus === "ready"
                  ? "Workspace catalog 기준"
                  : catalogReadStatus === "denied"
                    ? "Workspace catalog 접근 제한"
                    : catalogReadStatus === "fallback"
                      ? "세션 seed 기준"
                      : "Workspace catalog 대기"}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={selectedOrderIds.length !== 1} onClick={handleDuplicateFirstSelected}>
              <CdsActionsCopyIcon data-icon="inline-start" />
              복제
            </Button>
            <Button size="sm" onClick={handleCreateOrder}>+ Order</Button>
          </div>
        </div>
      </section>
      <section className="flex min-h-[54px] shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-5 py-2">
        <LineTabs
          aria-label={`${selectedLeafLabel} 하위 타입`}
          className="max-w-full min-w-0 flex-1 overflow-x-auto"
          value="all"
          items={orderTypeTabs}
          itemClassName="emr-text-body"
          onValueChange={() => undefined}
          size="default"
        />
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <div className="flex h-8 w-[180px] min-w-0 items-center rounded-lg border bg-card px-2.5">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              aria-label="오더 검색"
              className="h-8 border-0 bg-transparent px-2 emr-text-dense shadow-none focus-visible:ring-0"
              placeholder="오더 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as HospitalOrderStatusFilter)}>
            <SelectTrigger aria-label="사용여부 필터" size="sm" className="w-[96px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={billingFilter} onValueChange={(value) => setBillingFilter(value as HospitalOrderBillingFilter)}>
            <SelectTrigger aria-label="청구 필터" size="sm" className="w-[104px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {billingFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={workTypeFilter} onValueChange={(value) => setWorkTypeFilter(value as HospitalOrderWorkTypeFilter)}>
            <SelectTrigger aria-label="업무유형 필터" size="sm" className="w-[104px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {workTypeFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <EmrTableDensitySelector value={tableDensity} onValueChange={setTableDensity} />
          <Popover open={orderFilterOpen} onOpenChange={setOrderFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant={activeOrderFilterCount > 0 ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 bg-card px-2",
                    activeOrderFilterCount > 0 &&
                      "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)] text-[var(--emr-text-primary)]"
                  )}
                  aria-label={
                    activeOrderFilterCount > 0
                      ? `오더 필터 ${activeOrderFilterCount}개 설정`
                      : "오더 필터 설정"
                  }
                />
              }
            >
              <CdsActionsListFilterIcon aria-hidden="true" className="size-3.5" />
              필터{activeOrderFilterCount > 0 ? ` ${activeOrderFilterCount}` : ""}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(720px,calc(100vw-32px))] gap-3 p-3"
              initialFocus={false}
            >
              <EmrTableFilterBuilder
                clearAllLabel="초기화"
                description="오더 필터는 현재 검색/상태/청구/업무 조건 안에서 완성된 조건만 AND로 적용됩니다."
                fields={orderFilterFields}
                model={orderFilterModel}
                title="Filters"
                onClose={() => setOrderFilterOpen(false)}
                onModelChange={setOrderFilterModel}
              />
            </PopoverContent>
          </Popover>
          <Button size="icon-sm" variant="outline" aria-label="컬럼 표시 설정">
            <SlidersIcon />
          </Button>
        </div>
      </section>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table
            aria-label="병원관리 Order 관리 테이블"
            data-testid="hospital-order-table"
            density={tableDensity}
            layout="scroll"
            minWidth={hospitalOrderTableMinWidth}
            className={cn(hospitalOrderTableMinWidthClass, "table-fixed")}
          >
            <TableHeader className="sticky top-0 z-10 bg-[var(--emr-surface-muted)]">
              <TableRow className="hover:bg-transparent">
                <EmrTableSelectionHeaderCell
                  className={hospitalOrderTableColumnClasses.select}
                >
                  <EmrTableCheckbox
                    aria-label="보이는 오더 전체 선택"
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onCheckedChange={(checked) =>
                      toggleVisibleOrderSelection(visibleOrderIds, Boolean(checked))
                    }
                  />
                </EmrTableSelectionHeaderCell>
                {hospitalOrderTableHeaderColumns.map((column) =>
                  column.sortKey ? (
                    <HospitalOrderSortableHeader
                      key={column.key}
                      column={column as HospitalOrderTableHeaderColumn & { sortKey: HospitalOrderTableSortKey }}
                      sortState={orderSortState}
                      onSort={handleOrderSort}
                    />
                  ) : (
                    <EmrTableHeaderCell
                      key={column.key}
                      align={column.align}
                      className={cn(hospitalOrderTableColumnClasses[column.key], column.className)}
                      interaction={column.interaction}
                      resize={column.resize}
                    >
                      {column.label}
                    </EmrTableHeaderCell>
                  )
                )}
                <EmrTableHeaderCell
                  align="right"
                  className={hospitalOrderTableColumnClasses.actions}
                  interaction="static"
                  resize="none"
                >
                  작업
                </EmrTableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogReadStatus === "loading" ? (
                <HospitalOrderTableSkeletonRows />
              ) : null}
              {catalogReadStatus !== "loading" ? visibleOrders.map((order) => {
                const selected = selectedOrderIds.includes(order.id);
                const focused = focusedOrderId === order.id;

                return (
                  <TableRow
                    key={order.id}
                    data-testid={`hospital-order-row-${order.id}`}
                    data-focused={focused ? "true" : undefined}
                    data-state={selected ? "selected" : undefined}
                    className={cn(
                      "h-11 cursor-pointer bg-card hover:bg-[var(--emr-state-hover)] data-[state=selected]:bg-[var(--emr-state-selected)]",
                      focused &&
                        "bg-[var(--emr-state-selected)] shadow-[inset_3px_0_0_var(--emr-state-selected-border)]"
                    )}
                    onClick={() => openDrawer(order)}
                  >
                    <EmrTableSelectionCell onClick={(event) => event.stopPropagation()}>
                      <EmrTableCheckbox
                        aria-label={`${order.standardName} 선택`}
                        checked={selected}
                        onCheckedChange={(checked) => toggleOrderSelection(order.id, Boolean(checked))}
                      />
                    </EmrTableSelectionCell>
                    <TableCell><Badge variant="outline">개별</Badge></TableCell>
                    <TableCell className="overflow-hidden font-semibold">
                      <EmrTableCellText mode={hospitalOrderNameTextMode} fullText={order.standardName}>
                        {order.standardName}
                      </EmrTableCellText>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <EmrTableCellText mode={hospitalOrderNameTextMode} fullText={order.inHospitalName}>
                        {order.inHospitalName}
                      </EmrTableCellText>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <EmrTableCellText mode={hospitalOrderNameTextMode} fullText={order.billingName}>
                        {order.billingName}
                      </EmrTableCellText>
                    </TableCell>
                    <TableCell>
                      <EmrTableCellText
                        className={cn(
                          "font-semibold",
                          order.isActive
                            ? "text-[var(--emr-status-success-text)]"
                            : "text-muted-foreground"
                        )}
                        mode="one-line"
                      >
                        {order.isActive ? "사용" : "중지"}
                      </EmrTableCellText>
                    </TableCell>
                    <TableCell className="overflow-hidden text-right font-semibold">
                      <EmrTableCellText mode="one-line">
                        {formatHospitalOrderAmount(order.price)}
                      </EmrTableCellText>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <EmrTableCellText mode="one-line">
                        {targetLabels[order.target]}
                      </EmrTableCellText>
                    </TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <EmrRowActionMenu
                        ariaLabel={`${order.standardName} Order 행 작업`}
                        contentClassName="w-48"
                        items={[
                          {
                            key: "detail",
                            label: "상세 보기",
                            description: "Order drawer 열기",
                            onSelect: () => openDrawer(order),
                          },
                          {
                            key: "duplicate",
                            label: "복제",
                            description: "현재 row 기준으로 복사",
                            onSelect: () => duplicateOrder(order.id),
                          },
                        ]}
                        testId={`hospital-order-action-${order.id}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              }) : null}
              {catalogReadStatus !== "loading" && visibleOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-36">
                    <div className="flex justify-center px-4 py-6">
                      <EmrEmptyState
                        kind={orderEmptyStateKind}
                        priority={orderEmptyStatePriority}
                        surface="table"
                        title={orderEmptyStateTitle}
                        description={orderEmptyStateDescription}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      {selectedOrderIds.length > 0 ? (
        <div className="pointer-events-none sticky bottom-3 z-20 mt-[-52px] flex justify-center">
          <div className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg border bg-card px-3 shadow-lg">
            <span className="emr-text-metadata font-medium text-muted-foreground">
              선택한 오더 {selectedOrderIds.length}개
            </span>
            <Button size="sm" variant="outline" onClick={handleDuplicateFirstSelected}>
              선택 복제
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelectedOrders}>
              선택 해제
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HospitalOrderTableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <TableRow key={`hospital-order-skeleton-${index}`} data-testid="hospital-order-table-skeleton-row">
          <TableCell>
            <div className="h-4 w-4 rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="h-5 w-10 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-36 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-12 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-14 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <div className="ml-auto h-7 w-7 animate-pulse rounded bg-[var(--emr-surface-muted)]" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function HospitalAdminAuditReview({ workspaceId }: { workspaceId: string }) {
  const { hydrated, hydrate, session } = useAuthClient();
  const [eventType, setEventType] = useState("all");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<AuditReviewEventRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "denied" | "error">("idle");
  const canReview = session?.role === "hospital_admin" || session?.role === "supabase";

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
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/audit/events?${params.toString()}`, {
          headers: getDemoActorHeaders(session),
          signal: controller.signal,
        });
        const body = await response.json() as {
          ok: boolean;
          events?: AuditReviewEventRow[];
        };
        if (canceled) return;

        if (!response.ok || !body.ok) {
          setStatus(response.status === 401 || response.status === 403 ? "denied" : "error");
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]" data-testid="hospital-admin-audit-review">
      <section className="border-b bg-card px-5 py-4">
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
      <section className="flex min-h-[54px] shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
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
        <Select value={eventType} onValueChange={(value) => setEventType(value ?? "all")}>
          <SelectTrigger aria-label="감사 이벤트 필터" size="sm" className="w-[188px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {auditEventFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
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
            <h2 className="text-[16px] font-semibold">감사 로그를 불러오지 못했습니다</h2>
            <p className="max-w-md emr-text-dense leading-5 text-muted-foreground">
              서버 audit review reader를 다시 확인해 주세요.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-9 w-[170px] px-4 emr-text-metadata">시간</TableHead>
                  <TableHead className="h-9 w-[180px] px-2 emr-text-metadata">이벤트</TableHead>
                  <TableHead className="h-9 w-[150px] px-2 emr-text-metadata">Actor</TableHead>
                  <TableHead className="h-9 w-[220px] px-2 emr-text-metadata">Target</TableHead>
                  <TableHead className="h-9 px-2 emr-text-metadata">요약</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} data-testid={`audit-review-row-${event.id}`} className="h-12 border-border bg-card emr-text-dense">
                    <TableCell className="px-4 font-medium">{formatAuditTime(event.occurredAt)}</TableCell>
                    <TableCell className="px-2">
                      <Badge variant="outline" className="rounded-md">{auditEventLabels[event.eventType] ?? event.eventType}</Badge>
                    </TableCell>
                    <TableCell className="px-2">{event.actorUserId ?? "system"}</TableCell>
                    <TableCell className="px-2">
                      <span className="font-medium">{event.targetType}</span>
                      <span className="ml-2 text-muted-foreground">{event.targetId}</span>
                    </TableCell>
                    <TableCell className="px-2 text-muted-foreground">{buildAuditSummary(event)}</TableCell>
                  </TableRow>
                ))}
                {status === "loading" ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center emr-text-dense text-muted-foreground">불러오는 중</TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center emr-text-dense text-muted-foreground">표시할 감사 로그가 없습니다.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </ScrollArea>
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
  const paymentState = typeof after.paymentState === "string" ? after.paymentState : undefined;
  const noteStatus = typeof after.noteStatus === "string" ? after.noteStatus : undefined;
  const mode = typeof after.mode === "string" ? after.mode : undefined;
  const confirmation = typeof after.orderConfirmationStatus === "string" ? after.orderConfirmationStatus : undefined;

  return [
    event.encounterId ? `encounter ${event.encounterId}` : null,
    status ? `status ${status}` : null,
    paymentState ? `payment ${paymentState}` : null,
    noteStatus ? `SOAP ${noteStatus}` : null,
    mode ? `mode ${mode}` : null,
    confirmation ? `order ${confirmation}` : null,
  ].filter(Boolean).join(" · ") || "safe audit summary";
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
        {required ? <span className="ml-1 text-[var(--emr-text-danger)]">*</span> : null}
      </FieldLabel>
      <FieldContent className="min-w-0 gap-1.5">
        {children}
        {hint ? <FieldDescription className="emr-text-metadata leading-4">{hint}</FieldDescription> : null}
      </FieldContent>
    </Field>
  );
}

function DrawerSelect({
  ariaLabel,
  items,
  onValueChange,
  value,
}: {
  ariaLabel: string;
  items: Array<{ label: string; value: string }>;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => {
      if (nextValue) onValueChange(nextValue);
    }}>
      <SelectTrigger aria-label={ariaLabel} className="h-9 w-full bg-card">
        <SelectValue />
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

export function HospitalAdminDrawer({ workspaceId }: ShellComponentProps) {
  const { hydrated, hydrate, session } = useAuthClient();
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const clearSelectedOrders = useHospitalAdminStore((state) => state.clearSelectedOrders);
  const orders = useHospitalAdminStore((state) => state.orders);
  const setFocusedOrderId = useHospitalAdminStore((state) => state.setFocusedOrderId);
  const updateOrder = useHospitalAdminStore((state) => state.updateOrder);
  const order = orders.find((item) => item.id === activeDrawer?.id);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [draftState, setDraftState] = useState<{
    draft: HospitalOrderDraft | null;
    orderId: string | null;
  }>({
    draft: order ?? null,
    orderId: order?.id ?? null,
  });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [mutationStatus, setMutationStatus] = useState<OrderCatalogMutationStatus>("idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("meta");
  const draft = draftState.orderId === order?.id ? draftState.draft : order ?? null;
  const mutationInFlight = mutationStatus === "saving" || mutationStatus === "stopping";
  const setDraft = (
    nextDraft:
      | HospitalOrderDraft
      | null
      | ((current: HospitalOrderDraft | null) => HospitalOrderDraft | null)
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
          '[data-slot="dialog-content"], [data-slot="dialog-overlay"], [data-slot="popover-content"], [role="menu"]'
        )
      ) {
        return;
      }

      setActiveDrawer(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [activeDrawer?.type, setActiveDrawer]);

  if (activeDrawer?.type !== "hospital-order" || !order || !draft) {
    return (
      <div className="flex h-full items-center justify-center emr-text-dense text-muted-foreground">
        오더를 선택해 주세요.
      </div>
    );
  }

  const updateDraft = (nextDraft: Partial<HospitalOrderDraft>) =>
    setDraft((current) => current ? { ...current, ...nextDraft } : current);
  const category = getHospitalOrderCategory(draft.categoryId);
  const subcategory = getHospitalOrderSubcategory(draft.subcategoryId);
  const creatingNewOrder = !order.sourceCatalogItem;
  const saveValidationMessage = validateHospitalOrderDraft(draft, { creating: creatingNewOrder });
  const saveDisabled = mutationInFlight || Boolean(saveValidationMessage);
  const drawerTitle = creatingNewOrder
    ? getNewOrderDrawerTitle(subcategory?.label)
    : draft.standardName || "오더 상세";

  const handleSave = async () => {
    const validationMessage = validateHospitalOrderDraft(draft, { creating: creatingNewOrder });
    if (validationMessage) {
      setMutationStatus("error");
      setMutationMessage(validationMessage);
      return;
    }

    if (!hydrated || !session) {
      setMutationStatus("denied");
      setMutationMessage("로그인된 병원관리자 세션을 확인한 뒤 다시 시도해 주세요.");
      return;
    }

    setMutationStatus("saving");
    setMutationMessage("Order 변경사항을 저장하는 중입니다.");

    const input = buildWorkspaceCatalogMutationFromHospitalOrder({
      draft,
      source: order.sourceCatalogItem,
      workspaceId,
    });
    const result = await mutateHospitalAdminOrderCatalog({
      input,
      method: input.action === "create" ? "POST" : "PATCH",
      session,
      workspaceId,
    });

    if (!result.ok) {
      setMutationStatus(result.denialReason === "permission_missing" ? "denied" : "error");
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
    setMutationMessage(creatingNewOrder ? "Order를 등록했습니다." : "Order 변경사항을 저장했습니다.");
    toast.success(creatingNewOrder ? "Order를 등록했어요." : "Order 변경사항을 저장했어요.");
  };

  const handleDelete = async () => {
    if (!hydrated || !session) {
      setMutationStatus("denied");
      setMutationMessage("로그인된 병원관리자 세션을 확인한 뒤 다시 시도해 주세요.");
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
      input: buildWorkspaceCatalogPauseMutation(order.sourceCatalogItem.id),
      method: "PATCH",
      session,
      workspaceId,
    });

    if (!result.ok) {
      setMutationStatus(result.denialReason === "permission_missing" ? "denied" : "error");
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
                {mutationStatus === "stopping" ? "Order 사용을 중지하는 중" : "Order 저장 중"}
              </DialogTitle>
              <DialogDescription>
                {mutationMessage ?? "Workspace catalog 변경사항을 반영하고 있습니다."}
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
          <h2 className="truncate text-[20px] font-semibold leading-7">{drawerTitle}</h2>
        </div>
        <label className="flex shrink-0 items-center gap-2 emr-text-dense font-semibold">
          사용여부
          <Switch
            aria-label="오더 사용여부"
            checked={draft.isActive}
            disabled={mutationInFlight}
            onCheckedChange={(checked) => updateDraft({ isActive: Boolean(checked) })}
          />
        </label>
        <Button variant="ghost" size="icon-sm" aria-label="상세 닫기" onClick={() => setActiveDrawer(null)}>
          ×
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <FieldGroup className="px-8 py-6">
          <DrawerField label="분류">
            <div className="flex h-9 items-center rounded-lg border bg-[var(--emr-surface-muted)] px-3 emr-text-dense font-semibold">
              {category?.label} / {subcategory?.label}
            </div>
          </DrawerField>
          <DrawerField label="표준 Order명">
            <Input
              placeholder="표준 Order명을 입력해 주세요"
              value={draft.standardName}
              onChange={(event) => updateDraft({ standardName: event.target.value })}
            />
          </DrawerField>
          <DrawerField label="원내 Order명" required hint="진료항목을 원내에서 사용하는 국문 이름으로 변경할 수 있습니다.">
            <Input
              placeholder="원내에서 사용할 Order명을 입력해 주세요"
              value={draft.inHospitalName}
              onChange={(event) => updateDraft({ inHospitalName: event.target.value })}
            />
          </DrawerField>
          <DrawerField label="청구서명" required hint="보호자에게 표시하는 청구서명을 별도로 지정할 수 있습니다.">
            <Input
              placeholder="청구서에 표시할 이름을 입력해 주세요"
              value={draft.billingName}
              onChange={(event) => updateDraft({ billingName: event.target.value })}
            />
          </DrawerField>
          <DrawerField label="별칭" hint="진료항목을 검색하기 위한 별칭입니다. 쉼표로 여러 개를 입력할 수 있습니다.">
            <Input
              placeholder="검색 별칭을 입력해 주세요"
              value={draft.aliases}
              onChange={(event) => updateDraft({ aliases: event.target.value })}
            />
          </DrawerField>
          <DrawerField label="일감전달여부" required hint="조제/처치, 임상병리, 영상검사실에 일감을 전달할지 설정합니다.">
            <DrawerSelect
              ariaLabel="일감전달여부"
              value={draft.delivery}
              items={[
                { label: deliveryLabels.deliver, value: "deliver" },
                { label: deliveryLabels["do-not-deliver"], value: "do-not-deliver" },
              ]}
              onValueChange={(delivery) => updateDraft({ delivery: delivery as HospitalOrderDraft["delivery"] })}
            />
          </DrawerField>
          <DrawerField label="대상" required hint="하나 이상의 대상을 선택하는 후속 UX 전까지 대표 대상값으로 표시합니다.">
            <DrawerSelect
              ariaLabel="대상"
              value={draft.target}
              items={Object.entries(targetLabels).map(([value, label]) => ({ label, value }))}
              onValueChange={(target) => updateDraft({ target: target as HospitalOrderDraft["target"] })}
            />
          </DrawerField>
          <DrawerField label="케어가이드">
            <Textarea
              className="min-h-24 resize-none"
              maxLength={500}
              placeholder="내용을 입력해주세요"
              value={draft.careGuide}
              onChange={(event) => updateDraft({ careGuide: event.target.value })}
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
              onChange={(event) => updateDraft({ hospitalInstruction: event.target.value })}
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
            <div className="grid gap-2 md:grid-cols-[86px_minmax(100px,1fr)_86px_minmax(100px,1fr)]">
              <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">판매 단위</div>
              <DrawerSelect
                ariaLabel="판매 단위"
                value={draft.saleUnit}
                items={Object.entries(saleUnitLabels).map(([value, label]) => ({ label, value }))}
                onValueChange={(saleUnit) => updateDraft({ saleUnit: saleUnit as HospitalOrderDraft["saleUnit"] })}
              />
              <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">판매 금액</div>
              <Input
                aria-label="판매 금액"
                inputMode="numeric"
                placeholder="판매 금액 입력"
                value={creatingNewOrder && draft.price <= 0 ? "" : draft.price}
                onChange={(event) => updateDraft({ price: Number(event.target.value.replace(/\D/g, "")) })}
              />
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-[86px_minmax(100px,1fr)_86px_minmax(100px,1fr)]">
              <div className="flex items-center emr-text-metadata font-semibold text-muted-foreground">반올림</div>
              <DrawerSelect
                ariaLabel="반올림"
                value={draft.roundRule}
                items={Object.entries(roundRuleLabels).map(([value, label]) => ({ label, value }))}
                onValueChange={(roundRule) => updateDraft({ roundRule: roundRule as HospitalOrderDraft["roundRule"] })}
              />
              <label className="flex items-center emr-text-metadata font-semibold text-muted-foreground">과세</label>
              <label className="flex h-9 items-center gap-2 rounded-lg border px-3 emr-text-dense font-semibold">
                <Checkbox
                  aria-label="과세 여부"
                  checked={draft.isTaxable}
                  onCheckedChange={(checked) => updateDraft({ isTaxable: Boolean(checked) })}
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
                    <TableCell className="w-40 text-muted-foreground">업무유형</TableCell>
                    <TableCell className="font-semibold">
                      {serviceItemTypeLabels[draft.serviceItemType]}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">청구 반영</TableCell>
                    <TableCell className="font-semibold">{draft.billable ? "청구 가능" : "비청구"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">판매금액</TableCell>
                    <TableCell className="font-semibold">{formatHospitalOrderAmount(draft.price)}</TableCell>
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
                      <TableCell className="w-40 text-muted-foreground">{item.label}</TableCell>
                      <TableCell className="font-semibold">{item.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </FieldGroup>
      </ScrollArea>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-6 py-4 shadow-sm">
        {creatingNewOrder ? <div /> : (
          <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <Button variant="destructive" disabled={mutationInFlight} onClick={() => setConfirmDeleteOpen(true)}>
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
              : "text-muted-foreground"
          )}
          data-testid="hospital-order-mutation-status"
        >
          {mutationMessage}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" disabled={mutationInFlight} onClick={() => setDraft(order)}>
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
                title={creatingNewOrder ? "오더를 등록할까요?" : "Order 변경사항을 저장할까요?"}
                description={
                  creatingNewOrder
                    ? `${draft.standardName} 항목이 이 병원의 Order Catalog에 등록되고, 저장 후 차트의 Order 추가 검색 후보로 표시됩니다.`
                    : "병원관리 Order Catalog와 차트 선택 후보에 변경값이 반영됩니다. 이미 확정된 과거 Order snapshot은 유지됩니다."
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
