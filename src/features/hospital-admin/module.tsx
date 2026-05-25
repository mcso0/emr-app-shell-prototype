"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CdsActionsCopyIcon,
  CdsActionsSettingsIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesCalendarIcon,
  CdsFilesFileTextIcon,
  CdsFilesGridIcon,
  CdsFilesLayersIcon,
} from "@/components/cds-icons/files-and-layout";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrSubpanelTitle } from "@/components/emr/subpanel";
import {
  EmrTableCellText,
  EmrTableHeaderCell,
} from "@/components/emr/table-primitives";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import {
  EmrTextSideNavButton,
  EmrTextSideNavSection,
} from "@/components/emr/text-side-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
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
import { SearchIcon, SlidersIcon } from "@/components/icons";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import {
  deliveryLabels,
  formatHospitalOrderAmount,
  getHospitalOrderCategory,
  getHospitalOrderSubcategory,
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
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableDensity,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import type { ShellComponentProps } from "@/types/emr";

const orderSetPlaceholderId = "order-set-placeholder";

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
  { label: "검사", value: "lab" },
  { label: "의약품", value: "medication" },
  { label: "처치", value: "treatment" },
  { label: "영상", value: "imaging" },
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

type HospitalOrderTableHeaderColumn = {
  align?: "left" | "right";
  className?: string;
  interaction: EmrTableHeaderInteraction;
  key: HospitalOrderTableColumnKey;
  label: string;
  resize: EmrColumnResize;
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
  },
  {
    key: "inHospitalName",
    label: "원내 Order명",
    interaction: "sortable",
    resize: "data-column",
  },
  {
    key: "billingName",
    label: "청구서명",
    interaction: "sortable",
    resize: "data-column",
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
  },
  {
    key: "target",
    label: "대상",
    interaction: "filterable",
    resize: "data-column",
  },
];

const hospitalOrderNameTextMode: EmrTableCellTextMode = "two-line-if-long";

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

const hospitalAdminMenuItems = [
  { label: "병원기본설정", icon: CdsActionsSettingsIcon },
  { label: "병원구성원 관리", icon: CdsFilesFileTextIcon },
  { label: "감사 로그", icon: CdsFilesFileTextIcon },
  { label: "근무표", icon: CdsFilesCalendarIcon },
  { label: "역할별 업무 관리", icon: CdsFilesGridIcon },
  { label: "공간/시간 관리", icon: CdsFilesGridIcon },
  { label: "진료과 분리운영", icon: CdsFilesLayersIcon },
  { label: "바이탈 관리", icon: CdsFilesFileTextIcon },
  { label: "차트 템플릿", icon: CdsFilesFileTextIcon },
  { label: "장비 관리", icon: CdsFilesGridIcon },
  { label: "마약류 관리", icon: CdsFilesFileTextIcon },
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
    children: [{ label: "기본 진료비", disabled: true }, { label: "기타 진료비", disabled: true }],
  },
  {
    id: "prevention",
    label: "예방",
    children: [{ label: "예방", disabled: true }],
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
    children: [{ label: "마취", disabled: true }, { label: "수술", disabled: true }],
  },
  {
    id: "inpatient",
    label: "입원",
    children: [{ label: "입원", disabled: true }],
  },
  {
    id: "therapy",
    label: "치료",
    children: [{ label: "치료", disabled: true }],
  },
  {
    id: "inventory",
    label: "처방/조제/의료물품",
    children: [
      { label: "처방", categoryId: "dispensing" as const, subcategoryId: "oral-medication" as const },
      { label: "조제", categoryId: "dispensing" as const, subcategoryId: "injection" as const },
      { label: "의료물품", disabled: true },
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
  "reception.appointment_checked_in": "예약 체크인",
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

function getSubcategoryCount(orders: HospitalOrderCatalogItem[], subcategoryId: string) {
  return orders.filter((order) => order.subcategoryId === subcategoryId).length;
}

export function HospitalAdminSidePanel({ moduleLabel }: ShellComponentProps) {
  const activeSection = useHospitalAdminStore((state) => state.activeSection);
  const orders = useHospitalAdminStore((state) => state.orders);
  const selectedCategoryId = useHospitalAdminStore((state) => state.selectedCategoryId);
  const selectedSubcategoryId = useHospitalAdminStore((state) => state.selectedSubcategoryId);
  const setSelectedCategoryId = useHospitalAdminStore((state) => state.setSelectedCategoryId);
  const setSelectedSubcategoryId = useHospitalAdminStore((state) => state.setSelectedSubcategoryId);
  const setActiveSection = useHospitalAdminStore((state) => state.setActiveSection);
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

  return (
    <aside className="group/emr-subpanel flex h-full min-h-0 w-full min-w-[280px] max-w-[280px] flex-col bg-[var(--emr-surface-sidepanel)]">
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{moduleLabel}</span>}
        collapseLabel="병원관리 사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        <div className="grid gap-1 pt-1">
          {hospitalAdminMenuItems.map((item) => {
            const Icon = item.icon;
            const isMembers = item.label === "병원구성원 관리";
            const isAudit = item.label === "감사 로그";

            return (
              <EmrTextSideNavButton
                key={item.label}
                active={(isMembers && activeSection === "members") || (isAudit && activeSection === "audit")}
                disabled={!isMembers && !isAudit}
                icon={<Icon className="size-4 shrink-0" />}
                onClick={
                  isMembers
                    ? () => setActiveSection("members")
                    : isAudit
                      ? () => setActiveSection("audit")
                      : undefined
                }
              >
                {item.label}
              </EmrTextSideNavButton>
            );
          })}
          <EmrTextSideNavSection
            title="Order 관리"
            icon={<CdsFilesFileTextIcon className="size-4 shrink-0" />}
            open={openSections.has("orders")}
            testId="hospital-admin-menu-order-management"
            onToggle={() => {
              setActiveSection("orders");
              toggleSection("orders");
            }}
          >
            <div className="ml-4 border-l py-1 pl-3">
              {orderMenuGroups.map((group) => (
                <div key={group.id} className="py-1">
                  <div className="flex h-8 items-center rounded-md px-2 emr-text-body font-semibold text-[var(--emr-text-primary)]">
                    {group.label}
                  </div>
                  <div className="grid gap-1">
                    {group.children.map((item) => {
                      const active =
                        item.categoryId === selectedCategoryId &&
                        item.subcategoryId === selectedSubcategoryId;

                      return (
                        <EmrTextSideNavButton
                          key={`${group.id}-${item.label}`}
                          active={active}
                          className="pl-4"
                          count={
                            item.subcategoryId ? (
                              <Badge variant="secondary" className="h-5 min-w-5 rounded-md px-1 emr-text-micro">
                                {getSubcategoryCount(orders, item.subcategoryId)}
                              </Badge>
                            ) : undefined
                          }
                          disabled={item.disabled}
                          onClick={() => {
                            if (!item.categoryId || !item.subcategoryId) return;

                            setActiveSection("orders");
                            setSelectedCategoryId(item.categoryId);
                            setSelectedSubcategoryId(item.subcategoryId);
                          }}
                        >
                          {item.label}
                        </EmrTextSideNavButton>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </EmrTextSideNavSection>
          <EmrTextSideNavButton
            disabled
            count={
              <Badge variant="outline" className="h-5 rounded-md px-1.5 emr-text-micro">
                후속
              </Badge>
            }
            icon={<CdsFilesFileTextIcon className="size-4 shrink-0" />}
            testId={orderSetPlaceholderId}
          >
            Order 세트
          </EmrTextSideNavButton>
          <EmrTextSideNavButton disabled icon={<CdsActionsSettingsIcon className="size-4 shrink-0" />}>
            프린터 설정
          </EmrTextSideNavButton>
          <EmrTextSideNavButton disabled icon={<CdsFilesGridIcon className="size-4 shrink-0" />}>
            데이터랩
          </EmrTextSideNavButton>
        </div>
      </ScrollArea>
    </aside>
  );
}

export function HospitalAdminContent({ workspaceId }: ShellComponentProps) {
  const activeSection = useHospitalAdminStore((state) => state.activeSection);
  const billingFilter = useHospitalAdminStore((state) => state.billingFilter);
  const clearSelectedOrders = useHospitalAdminStore((state) => state.clearSelectedOrders);
  const createOrder = useHospitalAdminStore((state) => state.createOrder);
  const duplicateOrder = useHospitalAdminStore((state) => state.duplicateOrder);
  const orders = useHospitalAdminStore((state) => state.orders);
  const searchQuery = useHospitalAdminStore((state) => state.searchQuery);
  const selectedCategoryId = useHospitalAdminStore((state) => state.selectedCategoryId);
  const selectedOrderIds = useHospitalAdminStore((state) => state.selectedOrderIds);
  const selectedSubcategoryId = useHospitalAdminStore((state) => state.selectedSubcategoryId);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setBillingFilter = useHospitalAdminStore((state) => state.setBillingFilter);
  const setSearchQuery = useHospitalAdminStore((state) => state.setSearchQuery);
  const setStatusFilter = useHospitalAdminStore((state) => state.setStatusFilter);
  const setWorkTypeFilter = useHospitalAdminStore((state) => state.setWorkTypeFilter);
  const statusFilter = useHospitalAdminStore((state) => state.statusFilter);
  const toggleOrderSelection = useHospitalAdminStore((state) => state.toggleOrderSelection);
  const toggleVisibleOrderSelection = useHospitalAdminStore(
    (state) => state.toggleVisibleOrderSelection
  );
  const workTypeFilter = useHospitalAdminStore((state) => state.workTypeFilter);
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("standard");
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
  const visibleOrders = useMemo(
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
  const visibleOrderIds = visibleOrders.map((order) => order.id);
  const selectedVisibleCount = visibleOrderIds.filter((id) => selectedOrderIds.includes(id)).length;
  const allVisibleSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  if (activeSection === "members") {
    return <WorkspaceMembershipManagement workspaceId={workspaceId} />;
  }

  if (activeSection === "audit") {
    return <HospitalAdminAuditReview workspaceId={workspaceId} />;
  }

  const openDrawer = (order: HospitalOrderCatalogItem) => {
    if (selectedOrderIds.length > 0) return;

    setActiveDrawer({
      type: "hospital-order",
      id: order.id,
      subtitle: order.inHospitalName,
    });
  };

  const handleCreateOrder = () => {
    const order = createOrder({
      billingName: `${selectedSubcategory?.label ?? "신규"} Order 청구`,
      inHospitalName: `${selectedSubcategory?.label ?? "신규"} Order`,
      standardName: `${selectedSubcategory?.label ?? "신규"} Order`,
    });

    setActiveDrawer({ type: "hospital-order", id: order.id, subtitle: order.inHospitalName });
  };

  const handleDuplicateFirstSelected = () => {
    const duplicated = selectedOrderIds[0] ? duplicateOrder(selectedOrderIds[0]) : null;
    clearSelectedOrders();

    if (duplicated) {
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
            <LineTabs
              aria-label={`${selectedLeafLabel} 하위 타입`}
              className="mt-3 max-w-full overflow-x-auto"
              value="all"
              items={orderTypeTabs}
              itemClassName="emr-text-body"
              onValueChange={() => undefined}
              size="default"
            />
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
      <section className="flex min-h-[54px] shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-lg border bg-card px-2.5 sm:min-w-[280px]">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            aria-label="오더 검색"
            className="h-8 border-0 bg-transparent px-2 emr-text-dense shadow-none focus-visible:ring-0"
            placeholder="오더명, 별칭, 청구서명 검색"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as HospitalOrderStatusFilter)}>
          <SelectTrigger aria-label="사용여부 필터" size="sm" className="w-[116px] bg-card">
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
          <SelectTrigger aria-label="청구 필터" size="sm" className="w-[128px] bg-card">
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
          <SelectTrigger aria-label="업무유형 필터" size="sm" className="w-[128px] bg-card">
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
        <Button size="icon-sm" variant="outline" aria-label="컬럼 표시 설정">
          <SlidersIcon />
        </Button>
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
                <EmrTableHeaderCell
                  className={hospitalOrderTableColumnClasses.select}
                  interaction="static"
                  resize="none"
                >
                  <Checkbox
                    aria-label="보이는 오더 전체 선택"
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onCheckedChange={(checked) =>
                      toggleVisibleOrderSelection(visibleOrderIds, Boolean(checked))
                    }
                  />
                </EmrTableHeaderCell>
                {hospitalOrderTableHeaderColumns.map((column) => (
                  <EmrTableHeaderCell
                    key={column.key}
                    align={column.align}
                    className={cn(hospitalOrderTableColumnClasses[column.key], column.className)}
                    interaction={column.interaction}
                    resize={column.resize}
                  >
                    {column.label}
                  </EmrTableHeaderCell>
                ))}
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
              {visibleOrders.map((order) => {
                const selected = selectedOrderIds.includes(order.id);

                return (
                  <TableRow
                    key={order.id}
                    data-testid={`hospital-order-row-${order.id}`}
                    data-state={selected ? "selected" : undefined}
                    className="h-11 cursor-pointer bg-card hover:bg-[var(--emr-state-hover)] data-[state=selected]:bg-[var(--emr-state-selected)]"
                    onClick={() => openDrawer(order)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label={`${order.standardName} 선택`}
                        checked={selected}
                        onCheckedChange={(checked) => toggleOrderSelection(order.id, Boolean(checked))}
                      />
                    </TableCell>
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
              })}
              {visibleOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    조건에 맞는 Order가 없습니다.
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
          headers: getAuditActorHeaders(session),
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

function getAuditActorHeaders(session: AuthSession): HeadersInit {
  if (session.role === "supabase") return {};

  const actorByRole: Partial<Record<AuthSession["role"], string>> = {
    hospital_admin: "user-admin",
    vet: "user-vet",
    front_desk: "user-front-desk",
    nurse: "user-tech",
    billing_admin: "user-tech",
  };
  const actorUserId = actorByRole[session.role] ?? session.id;
  return { "x-clair-demo-session-user-id": actorUserId };
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

export function HospitalAdminDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const deleteOrder = useHospitalAdminStore((state) => state.deleteOrder);
  const orders = useHospitalAdminStore((state) => state.orders);
  const updateOrder = useHospitalAdminStore((state) => state.updateOrder);
  const order = orders.find((item) => item.id === activeDrawer?.id);
  const [draftState, setDraftState] = useState<{
    draft: HospitalOrderDraft | null;
    orderId: string | null;
  }>({
    draft: order ?? null,
    orderId: order?.id ?? null,
  });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("meta");
  const draft = draftState.orderId === order?.id ? draftState.draft : order ?? null;
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

  const handleSave = () => {
    updateOrder(order.id, draft);
    setActiveDrawer({
      type: "hospital-order",
      id: order.id,
      subtitle: draft.inHospitalName,
    });
  };

  const handleDelete = () => {
    deleteOrder(order.id);
    setConfirmDeleteOpen(false);
    setActiveDrawer(null);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-card" data-testid="hospital-order-drawer">
      <header className="flex min-h-[72px] shrink-0 items-center gap-3 border-b px-6">
        <Badge className="shrink-0">개별</Badge>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-semibold leading-7">{draft.standardName}</h2>
          <div className="truncate emr-text-metadata text-muted-foreground">
            {category?.label} / {subcategory?.label}
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 emr-text-dense font-semibold">
          사용여부
          <Switch
            aria-label="오더 사용여부"
            checked={draft.isActive}
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
            <Input value={draft.standardName} onChange={(event) => updateDraft({ standardName: event.target.value })} />
          </DrawerField>
          <DrawerField label="원내 Order명" required hint="진료항목을 원내에서 사용하는 국문 이름으로 변경할 수 있습니다.">
            <Input value={draft.inHospitalName} onChange={(event) => updateDraft({ inHospitalName: event.target.value })} />
          </DrawerField>
          <DrawerField label="청구서명" required hint="보호자에게 표시하는 청구서명을 별도로 지정할 수 있습니다.">
            <Input value={draft.billingName} onChange={(event) => updateDraft({ billingName: event.target.value })} />
          </DrawerField>
          <DrawerField label="별칭" hint="진료항목을 검색하기 위한 별칭입니다. 쉼표로 여러 개를 입력할 수 있습니다.">
            <Input value={draft.aliases} onChange={(event) => updateDraft({ aliases: event.target.value })} />
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
                value={draft.price}
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
      <footer className="flex shrink-0 items-center justify-between border-t bg-card px-6 py-4 shadow-sm">
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
            삭제
          </Button>
          {confirmDeleteOpen ? (
            <EmrConfirmDialogContent
              title="Order를 삭제할까요?"
              description={`${order.standardName} 항목은 현재 세션의 병원관리 목록에서 삭제됩니다.`}
              cancelLabel="취소"
              confirmLabel="삭제"
              confirmButtonVariant="destructive"
              closeAriaLabel="Order 삭제 확인 닫기"
              onCancel={() => setConfirmDeleteOpen(false)}
              onConfirm={handleDelete}
            />
          ) : null}
        </Dialog>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDraft(order)}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </footer>
    </div>
  );
}
