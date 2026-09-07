"use client";

import { readPersistedOrderDefaults } from "@/features/hospital-admin/persisted-order-defaults";
import { LabResultProfileSelection } from "@/features/lab-imaging/components/result-profile-selection";
import { isChartActualType, type ChartActualRecords } from "./chart-actual-contract";
import { buildChartActualRecords, ChartActualConfirmation, type ChartActualDraft, type ChartActualConfirmationRow } from "./chart-actual-confirmation";
import { ChartActualHistory } from "./chart-actual-history";
import { ChartRoutedExecutionActions } from "./chart-routed-execution-actions";
import { InpatientLocationPicker } from "@/features/inpatient/inpatient-location-picker";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CdsActionsCheckIcon,
  CdsActionsRefreshCcwIcon,
  CdsActionsRotateCcwIcon,
  CdsActionsSaveIcon,
  CdsActionsTrash2Icon,
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronDownIcon, CdsNavigationChevronRightIcon } from "@/components/cds-icons/navigation";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsContentEdit2Icon } from "@/components/cds-icons/content-and-editor";
import { CdsMedicalFileSearchIcon } from "@/components/cds-icons/medical-and-domain";
import {
  CdsUtilitiesHistoryIcon,
  CdsUtilitiesSortIcon,
} from "@/components/cds-icons/utilities-and-misc";
import {
  EmrContentAsideHeader,
  EmrContentAsidePanel,
} from "@/components/emr/content-aside-panel";
import {
  EmrContentHistoryGroup,
  EmrContentHistoryItem,
} from "@/components/emr/content-history-list";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrIconButton } from "@/components/emr/icon-button";
import { EmrPopoverHeader, EmrPopoverShell } from "@/components/emr/popover-shell";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrInstructionHistoryToggle } from "@/components/emr/instruction-header-stack";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrListHeaderIconButton } from "@/components/emr/subpanel";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import {
  EmrTableCellText,
  EmrTableFeedbackSurface,
} from "@/components/emr/table-primitives";
import {
  getTaskQueueEventKindFromStatus,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import {
  EmrRowActionMenu,
  type EmrRowActionMenuItem,
} from "@/components/emr/row-action-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupDivider,
  ButtonGroupIconButton,
  ButtonGroupPrimaryButton,
} from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  BuildingIcon,
  ClockIcon,
  StethoscopeIcon,
  UsersIcon,
} from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  createChartEncounterBundleFromLiveHandoff,
  getChartEncounter,
  getChartHistoryRows,
  getChartInvoiceLineByOrderId,
  getChartOrderGroups,
  getChartQueueItems,
  getChartQueueStatuses,
  getChartStaffName,
  getConsultationCallRooms,
  type ChartEncounterBundle,
  type ChartHistoryRow,
  type ChartOrderGroup,
} from "@/features/chart/data";
import { ChartPreconsultationContextPanel } from "@/features/chart/preconsultation-context-panel";
import {
  readChartLiveEncounterHandoff,
  saveChartLiveEncounterHandoff,
} from "@/features/chart/live-encounter-handoff";
import type {
  ChartLiveQueueRecord,
  ChartLiveQueueResponse,
} from "@/features/chart/chart-live-queue";
import { loadChartPatientHistoryPage } from "@/features/chart/chart-patient-history-client";
import type { ChartPatientHistoryRecord } from "@/features/chart/chart-patient-history";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import {
  ChartCollapsiblePanel,
  ChartCollapsiblePanelGroup,
  ChartPanelCollapseButton,
  type ChartCollapsiblePanelId,
} from "@/features/chart/components/chart-collapsible-panel-group";
import {
  ChartActionBar,
  ChartPanelActionGroup,
  ChartPanelActions,
  ChartPanelIconButton,
  ChartPatientContextBar,
  ChartWorkspacePanel,
  chartWorkspacePanelClassName,
} from "@/features/chart/components/chart-figma-workspace";
import { ChartProfilePreviewCard } from "@/features/chart/components/chart-profile-preview-card";
import {
  ChartAssessmentTable,
  type ChartAssessmentDiagnosis,
} from "@/features/chart/components/chart-assessment-table";
import {
  AssessmentClassificationSearchDialog,
  type AssessmentClassificationCatalogItem,
  type AssessmentClassificationCatalogStatus,
  type AssessmentClassificationSelection,
} from "@/features/chart/components/assessment-classification-search-dialog";
import {
  ClassificationExplorerColumn,
  ClassificationExplorerHeading,
  ClassificationExplorerList,
  ClassificationExplorerLoadingState,
  ClassificationExplorerOption,
  ClassificationExplorerReviewHeading,
  ClassificationExplorerSearchHeader,
  ClassificationExplorerSortableRow,
} from "@/features/chart/components/classification-explorer-ui";
import orderCatalogDialogStyles from "@/features/chart/components/chart-order-catalog-dialog.module.css";
import {
  getCachedDiagnosisCatalogPage,
  loadDiagnosisCatalogPage,
  type AssessmentClassificationCatalogPage,
  type DiagnosisCatalogClientQuery,
  type DiagnosisCatalogClientResult,
} from "@/features/chart/diagnosis-catalog-client";
import { ChartVitalDialog } from "@/features/chart/components/chart-vital-dialog";
import {
  ChartOrderBillingDetailAside,
  ChartOrderFinanceFooter,
  type ChartOrderBillingAmountDisplayState,
  type ChartOrderBillingSummaryFreshness,
} from "@/features/chart/components/chart-order-finance-footer";
import type { ChartOrderBillingSummary } from "@/features/chart/chart-order-billing-summary-contract";
import { useChartBillingSummaryRealtime } from "@/features/chart/chart-order-billing-summary-realtime";
import { ChartLineTabGroup } from "@/features/chart/components/chart-line-tab-group";
import { ChartSoapLiveBlockEditor } from "@/features/chart/components/chart-soap-live-block-editor";
import {
  createLegacySoapTemplateBlocks,
  createSystemSoapTemplateBlocks,
} from "@/features/chart/components/chart-soap-block-schema";
import type {
  ChartSoapBlock,
  ChartSoapPartialBlock,
} from "@/features/chart/components/chart-soap-block-schema";
import {
  SOAP_DEFAULT_SCOPE_KEY,
  areSoapBlockDocumentsEqual,
  buildLegacySoapSystemId,
  buildSystemSoapScopeKey,
  createSoapBlockDocumentV2,
  getSoapDocumentScope,
  hasMeaningfulSoapScopeContent,
  replaceSoapDocumentScope,
} from "@/features/chart/chart-soap-document";
import { SoapAutosaveCoordinator } from "@/features/chart/chart-soap-autosave-coordinator";
import { chartOrderExpectedEtagHeader } from "@/features/chart/order-version-contract";
import { useChartStore } from "@/features/chart/store";
import { useChartPatientGuardianProfileActions } from "@/features/chart/use-chart-patient-guardian-profile-actions";
import { useSelectedOperatingDate } from "@/features/work-queue/use-selected-operating-date";
import { useQueueRealtimeRefresh } from "@/features/work-queue/queue-realtime-refresh";
import { usePatientLatestVitalItems } from "@/features/patient-vitals/use-patient-latest-vitals";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import {
  formatCompactKoreanOperatingDateLabel,
  formatOperatingShortTime,
  formatShortOperatingDate,
  getOperatingDateFromIso,
} from "@/lib/emr-domain/demo-date";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";
import {
  emrTableDensityOptions,
  type EmrTableDensity,
} from "@/components/emr/table-density";
import type {
  OrderQueueItem,
  ShellComponentProps,
  WorkspaceSlotAvailabilityProviderProps,
} from "@/types/emr";
import type {
  ChartOrderCatalogSearchRow,
  ChartOrderSetPreview,
  ChartOrderSetPreviewItem,
  ChartOrderSetSelectionIntent,
} from "@/features/hospital-admin/server-order-catalog";
import type {
  ChartOrderDraftRowInput,
  ChartOrderRuntimeRow,
} from "@/features/chart/server-order-draft-persistence-core";
import {
  CLINICAL_ORDER_FIELD_SCHEMAS,
  getClinicalOrderFieldSchema,
  CLINICAL_ORDER_TYPES,
  isClinicalOrderType,
  resolveClinicalOrderMasterContract,
  validateClinicalOrderDetailInputs,
  type ClinicalOrderFieldDefinition,
} from "@/features/chart/order-execution-domain";
import type {
  ChartOrderExecutionMutationAction,
  ChartOrderExecutionMutationResult,
} from "@/features/chart/server-order-execution-mutation-core";
import type {
  ChartOrderExecutionReadModel,
  ChartOrderExecutionRevision,
  ChartOrderExecutionTask,
  ChartOrderExecutionTaskEvent,
} from "@/features/chart/server-order-execution-read-model-core";
import type {
  ChartOrderPrebillingOverride,
  ChartOrderPrebillingOverridePatch,
} from "@/features/chart/server-order-prebilling-override-core";
import type {
  OrderIntendedAssigneeState,
} from "@/features/chart/server-order-intended-assignee-core";
import type {
  OrderActualDispenseState,
} from "@/features/chart/server-order-actual-dispense-core";
import type { FulfillmentEligibleAssignee } from "@/features/fulfillment/server-fulfillment-assignee-core";
import {
  parsePlanOrderAuthority,
  type PlanOrderAuthorityConfig,
} from "@/features/chart/plan-order-authority-domain";
import type {
  ClinicalOrderPriority,
  ClinicalOrderType,
  Diagnosis,
  DiagnosisType,
  EmrOrder,
  EmrOrderStatus,
  EmrOrderType,
  Encounter,
  ServiceItemType,
  SoapNote,
  SoapBlockDocument,
  SoapBlockDocumentV2,
  WaitingQueueEntry,
} from "@/types/emr-domain";

type ChartBundle = ChartEncounterBundle;
type OrderFilter = "all" | ClinicalOrderType;
type SoapSaveState =
  "idle" | "saving" | "saved" | "saved_with_warning" | "error" | "conflict";
type ChartSoapNoteRouteResponse =
  | {
      ok: true;
      status: number;
      soapNote: SoapNote | null;
      auditRecorded?: boolean;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartCompletionSnapshot = {
  encounterId: string;
  workspaceId: string;
  status: Encounter["status"];
  chartCompletedAt?: string;
  chartCompletedByUserId?: string;
  updatedAt: string;
};
type ChartCompletionRouteResponse =
  | {
      ok: true;
      status: number;
      completion: ChartCompletionSnapshot;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ConsultationFlowSnapshot = {
  callEvent?: {
    id: string;
    displayText: string;
    deliveryStatus: "queued";
    roomId: string;
    roomName: string;
  };
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};
type ConsultationFlowRouteResponse =
  | {
      ok: true;
      status: number;
      flow: ConsultationFlowSnapshot;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type EncounterCancelRouteResponse =
  | {
      ok: true;
      status: number;
      cancellation: {
        encounter: Encounter;
        queueEntry: WaitingQueueEntry;
      };
      workspaceId?: string;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
      fieldErrors?: Partial<Record<"cancelReason" | "encounterId", string>>;
    };
type ChartDiagnosisRouteResponse =
  | {
      ok: true;
      status: number;
      diagnoses: Diagnosis[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderDraftRouteResponse =
  | {
      ok: true;
      status: number;
      billingSummary?: ChartOrderBillingSummary;
      etag?: string;
      rows?: ChartOrderRuntimeRow[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderActionKind = "bill" | "confirm";
type ChartOrderActionSnapshot = {
  appliedSnapshot?: {
    billingName: string;
    destinationModule?: string;
    inHospitalOrderName?: string;
    lineTotalSnapshot: number;
    orderType?: EmrOrderType;
    priceKrw: number | null;
    quantity: number;
    sourcePresetId?: string;
    standardOrderName: string;
    workspaceCatalogItemId?: string;
    sourceMasterRecordId?: string;
    sourceMasterRevision?: number;
    workspaceCatalogRevision?: number;
    categoryGroup?: string;
    billingCategory?: string;
  };
  billingCandidateId?: string | null;
  billingCandidateStatus: string;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  encounterId: string;
  orderConfirmationStatus: string;
  orderId: string;
  status: EmrOrderStatus;
  updatedAt: string;
};
type ChartOrderActionRouteResponse =
  | {
      ok: true;
      status: number;
      billingSummary?: ChartOrderBillingSummary;
      etag?: string;
      rows?: ChartOrderRuntimeRow[];
      billingCandidates?: ChartBillingCandidateSnapshot[];
      confirmationCommandId?: string;
      orderActions: ChartOrderActionSnapshot[];
      queueProjectionIds?: string[];
      tasks?: Array<Record<string, unknown>>;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderBillingSummaryRouteResponse =
  | {
      ok: true;
      status: 200;
      summary: ChartOrderBillingSummary;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderPrebillingOverrideRouteResponse =
  | {
      enforcedBy: "chart-order-prebilling-override";
      ok: true;
      override: ChartOrderPrebillingOverride;
      status: 200;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderIntendedAssigneesRouteResponse =
  | {
      assignees: FulfillmentEligibleAssignee[];
      enforcedBy: "order-intended-assignee";
      ok: true;
      status: 200;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderIntendedAssigneeSaveRouteResponse =
  | {
      enforcedBy: "order-intended-assignee";
      ok: true;
      state: OrderIntendedAssigneeState;
      status: 200;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderActualDispenseSaveRouteResponse =
  | {
      enforcedBy: "order-actual-dispense";
      ok: true;
      state: OrderActualDispenseState;
      status: 200;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderSetPreviewRouteResponse =
  | {
      ok: true;
      status: number;
      preview: ChartOrderSetPreview;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
      message?: string;
    };
type ChartOrderLifecycleSnapshot = {
  cancellationReason?: string | null;
  encounterId: string;
  orderId: string;
  status: EmrOrderStatus;
  updatedAt: string;
  updatedByUserId?: string | null;
};
type ChartOrderLifecycleRouteResponse =
  | {
      ok: true;
      status: number;
      lifecycles: ChartOrderLifecycleSnapshot[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };

type ChartOrderExecutionMutationRouteResponse =
  | {
      ok: true;
      status: 200;
      billingSummary: ChartOrderBillingSummary;
      mutation: ChartOrderExecutionMutationResult;
      enforcedBy: "chart-order-execution-mutation";
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
      fieldErrors?: Record<string, string>;
    };
type ChartOrderExecutionReadRouteResponse =
  | {
      ok: true;
      status: 200;
      execution: ChartOrderExecutionReadModel;
      enforcedBy: "chart-order-execution-read-model";
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartBillingCandidateSnapshot = {
  billingCandidateId: string;
  orderId: string;
  status?:
    | "candidate_created"
    | "billing_review_required"
    | "invoice_linked"
    | "cancelled";
};
type ChartBillingCandidateRouteResponse =
  | {
      ok: true;
      status: number;
      candidates: ChartBillingCandidateSnapshot[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderCatalogRouteResponse =
  | {
      ok: true;
      status?: number;
      rows: ChartOrderCatalogSearchRow[];
    }
  | {
      ok: false;
      status?: number;
      denialReason?: string;
      error?: string;
    };

const CHART_TOP_DEFAULT_PERCENT = 50;
const CHART_TOP_MIN_PX = 180;
const CHART_ORDER_MIN_PX = 220;
const CHART_RESIZER_HEIGHT_PX = 8;
const CHART_WORKSPACE_BOTTOM_PADDING_PX = 8;
const CHART_RESIZER_STEP_PERCENT = 5;
const chartDetailPendingDelayMs = 200;
const chartOrderDiscreteSaveDelayMs = 150;
const chartOrderContinuousSaveDelayMs = 700;
const legacySalesDemoDefaultEncounterId = "encounter-coco-260501";

const emptyChartQueueItems: OrderQueueItem[] = [];

const orderTypeMeta: Record<EmrOrderType, { handoff: string; label: string }> =
  {
    dispensing: { label: "조제", handoff: "조제 대기열" },
    imaging: { label: "영상", handoff: "영상 판독" },
    lab: { label: "검사", handoff: "검사 결과" },
    treatment: { label: "처치", handoff: "처치 진행" },
  };

function getChartTaskCardItem(item: OrderQueueItem): EmrTaskQueueCardItem {
  const receptionEventLabel = item.receptionType === "예약" ? "예약" : "접수";

  return {
    actionAriaLabel: `${item.patientName} ${item.orderName} 더보기`,
    actionMenuDensity: "compact",
    actionTestId: `order-queue-item-action-${item.id}`,
    assigneeName: item.assigneeName,
    eventActorName: item.requesterName,
    eventKind: getTaskQueueEventKindFromStatus(item.statusId),
    eventText: `${item.time} ${receptionEventLabel}`,
    eventTime: item.time,
    guardianName: item.guardianName,
    patientName: item.patientName,
    receptionType: item.receptionType,
    secondLineBadgeLabel: "방문목적",
    secondLineText: item.orderType || item.orderName,
    testId: `order-queue-item-${item.id}`,
  };
}

function getChartQueueActionItems({
  item,
  onRequestCall,
  onSelect,
}: {
  item: OrderQueueItem;
  onRequestCall: () => void;
  onSelect: () => void;
}): EmrRowActionMenuItem[] {
  const items: EmrRowActionMenuItem[] = [];

  if (item.statusId === "waiting") {
    items.push({
      key: "call",
      label: "호출하기",
      onSelect: () => {
        onRequestCall();
        onSelect();
      },
      testId: `chart-queue-action-call-${item.id}`,
    });
  }

  items.push(
    {
      key: "open",
      label: "차트 열기",
      onSelect,
      testId: `chart-queue-action-open-${item.id}`,
    },
    {
      key: "assign",
      label: item.assigneeName ? "담당자 보기" : "담당하기",
      onSelect,
      testId: `chart-queue-action-assign-${item.id}`,
    },
    {
      key: "patient",
      label: "환자 정보",
      disabled: true,
      testId: `chart-queue-action-patient-${item.id}`,
    },
    {
      key: "guardian",
      label: "보호자 정보",
      disabled: true,
      testId: `chart-queue-action-guardian-${item.id}`,
    },
  );

  return items;
}

const chartOrderTabs: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "전체오더" },
  { value: "consultation", label: "진료" },
  { value: "clinical_lab", label: "임상" },
  { value: "imaging", label: "영상" },
  { value: "external_lab", label: "원외(검사)" },
  { value: "dispensing", label: "조제" },
  { value: "treatment", label: "처치" },
  { value: "hospitalization", label: "입원" },
  { value: "other", label: "기타" },
];

const getShortDateTime = (dateTime?: string) => {
  if (!dateTime) return "-";

  const operatingDate = getOperatingDateFromIso(dateTime);
  if (!operatingDate) return "-";

  return `${formatShortOperatingDate(operatingDate)} ${formatOperatingShortTime(dateTime)}`;
};

const getShortClockTime = (dateTime?: string) =>
  formatOperatingShortTime(dateTime);

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getSoapSectionStatusText = (
  status?: SoapNote["status"],
  statusAt?: string,
) => {
  if (!status) return "자동저장 대기";
  const statusLabel =
    status === "autosaved"
      ? "자동저장됨"
      : status === "draft"
        ? "작성중"
        : getStatusLabel("soap", status);

  return statusAt
    ? `${statusLabel} · ${getShortClockTime(statusAt)}`
    : statusLabel;
};

const getSoapStatusText = (soapNote?: SoapNote) =>
  soapNote
    ? getSoapSectionStatusText(
        soapNote.status,
        soapNote.signedAt ?? soapNote.autosavedAt ?? soapNote.updatedAt,
      )
    : "차트 대기";

const isChartReadyForBilling = (
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
) =>
  Boolean(encounter.chartCompletedAt) ||
  encounter.status === "ready_for_billing";

const getChartCompletionStatusText = (
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
) => {
  if (isChartReadyForBilling(encounter)) {
    return `작성완료 · ${getShortClockTime(encounter.chartCompletedAt)}`;
  }

  if (encounter.status === "completed") return "수납완료";
  if (encounter.status === "ordered") return "오더 진행중";
  if (encounter.status === "in_consultation") return "진료중";
  if (encounter.status === "waiting") return "차트 대기";

  return getStatusLabel("encounter", encounter.status);
};

function getConsultationWorkflowStatusText(
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
  queueEntry?: Pick<WaitingQueueEntry, "status">,
) {
  if (isChartReadyForBilling(encounter)) return "작성완료 / 수납대기";
  if (encounter.status === "completed") return "수납완료";
  if (encounter.status === "ordered") return "오더 진행중";
  if (
    encounter.status === "in_consultation" ||
    queueEntry?.status === "in_progress" ||
    queueEntry?.status === "called"
  ) {
    return "진료중";
  }
  if (queueEntry?.status === "waiting") return "호출 대기";
  return getChartCompletionStatusText(encounter);
}

function canCompleteChartFromWorkflow(
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
  queueEntry?: Pick<WaitingQueueEntry, "status">,
) {
  if (isChartReadyForBilling(encounter) || encounter.status === "completed")
    return false;
  return (
    encounter.status === "in_consultation" ||
    encounter.status === "ordered" ||
    queueEntry?.status === "in_progress" ||
    queueEntry?.status === "called"
  );
}

const getDiagnosisSystemLabel = (diagnosis: Diagnosis) => {
  const text = diagnosis.diagnosisText;

  if (/(위장|구토|식욕|설사|소화)/.test(text)) return "소화기";
  if (/(피부|가려움|발진|재진)/.test(text)) return "피부";
  if (/(예방|접종|건강검진)/.test(text)) return "예방";
  if (/(탈수|전신|수액)/.test(text)) return "전신";
  if (/(검사|혈액|염증)/.test(text)) return "검사";

  return "기타";
};

const getSoapSystemLabel = (diagnosis: Diagnosis) =>
  "systemLabel" in diagnosis && typeof diagnosis.systemLabel === "string"
    ? diagnosis.systemLabel
    : getDiagnosisSystemLabel(diagnosis);

const SOAP_VISIBLE_SYSTEM_TAB_COUNT = 3;

type DiagnosisCatalogItem = AssessmentClassificationCatalogItem;

type EditableDiagnosis = ChartAssessmentDiagnosis;

const diagnosisTypeLabel: Record<DiagnosisType, string> = {
  confirmed: "확진",
  differential: "감별",
  suspected: "의심",
};

const normalizeDiagnosisQuery = (value: string) =>
  value.trim().toLocaleLowerCase("ko-KR");

const buildDiagnosisSearchText = (item: DiagnosisCatalogItem) =>
  [item.name, item.systemLabel, item.categoryLabel, item.hint, ...item.synonyms]
    .join(" ")
    .toLocaleLowerCase("ko-KR");

const getDiagnosisSearchResults = (
  query: string,
  catalog: DiagnosisCatalogItem[],
  soapNote?: SoapNote,
) => {
  const normalizedQuery = normalizeDiagnosisQuery(query);
  const contextText = [
    soapNote?.subjective,
    soapNote?.objective,
    soapNote?.assessment,
    soapNote?.plan,
  ]
    .filter(Boolean)
    .join(" ");

  if (normalizedQuery) {
    return catalog
      .filter((item) =>
        buildDiagnosisSearchText(item).includes(normalizedQuery),
      )
      .slice(0, 6);
  }

  if (/(구토|위장|식욕|탈수|복부)/.test(contextText)) {
    return catalog.slice(0, 5);
  }

  return catalog.slice(0, 4);
};

const toEditableDiagnosis = (
  diagnosis: Diagnosis,
  index: number,
  catalog: DiagnosisCatalogItem[] = [],
): EditableDiagnosis => ({
  ...diagnosis,
  catalogMatched:
    Boolean(diagnosis.diagnosisCatalogId) ||
    catalog.some((item) => item.name === diagnosis.diagnosisText),
  isPrimary: diagnosis.isPrimary ?? index === 0,
  systemLabel: diagnosis.systemLabel ?? getDiagnosisSystemLabel(diagnosis),
});

function getLiveHandoffBundle(encounterId: string) {
  const handoff = readChartLiveEncounterHandoff(encounterId);

  return handoff
    ? createChartEncounterBundleFromLiveHandoff({
        encounter: handoff.encounter,
        patient: handoff.patient,
        primaryGuardian: handoff.primaryGuardian,
        veterinarianName: handoff.veterinarianName,
      })
    : null;
}

function getLiveQueueBundle(
  selectedEncounterId: string,
  liveQueueRecords: ChartLiveQueueRecord[],
) {
  const record = liveQueueRecords.find(
    (item) => item.encounter.id === selectedEncounterId,
  );

  return record
    ? createChartEncounterBundleFromLiveHandoff({
        encounter: record.encounter,
        patient: record.patient,
        primaryGuardian: record.primaryGuardian,
        veterinarianName: record.veterinarianName,
      })
    : null;
}

function getSelectedBundle(
  selectedEncounterId: string,
  liveQueueRecords: ChartLiveQueueRecord[] = [],
  options: { allowMockFallback?: boolean } = {},
) {
  const liveBundle =
    getLiveQueueBundle(selectedEncounterId, liveQueueRecords) ??
    getLiveHandoffBundle(selectedEncounterId);

  if (liveBundle) return liveBundle;

  if (options.allowMockFallback === false) return null;

  if (!selectedEncounterId)
    return getChartEncounter(legacySalesDemoDefaultEncounterId);

  return (
    getChartEncounter(selectedEncounterId) ??
    getChartEncounter(legacySalesDemoDefaultEncounterId)
  );
}

function useActiveChartBundle(workspaceId: string) {
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const { queueScopeMatches, records } = useScopedChartLiveQueue(workspaceId);
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    getAuthRuntimeMode().authProvider === "mock";

  if (!allowMockFallback && !queueScopeMatches) return null;

  return getSelectedBundle(selectedEncounterId, records, {
    allowMockFallback,
  });
}

function getDisplayedChartBundle({
  activeBundle,
  historyRecords,
  historyViewEncounterId,
}: {
  activeBundle: ChartBundle | null;
  historyRecords: ChartPatientHistoryRecord[];
  historyViewEncounterId: string;
}) {
  if (!activeBundle || !historyViewEncounterId) return activeBundle;

  const record = historyRecords.find(
    (item) => item.encounter.id === historyViewEncounterId,
  );
  if (!record || record.encounter.patientId !== activeBundle.patient.id) {
    return activeBundle;
  }

  return createChartEncounterBundleFromLiveHandoff({
    encounter: record.encounter,
    patient: activeBundle.patient,
    primaryGuardian: record.primaryGuardian,
    veterinarianName: record.veterinarianName,
  });
}

function useDisplayedChartBundle(workspaceId: string) {
  const activeBundle = useActiveChartBundle(workspaceId);
  const chartHistoryRecords = useChartStore(
    (state) => state.chartHistoryRecords,
  );
  const chartHistoryScope = useChartStore((state) => state.chartHistoryScope);
  const historyViewEncounterId = useChartStore(
    (state) => state.historyViewEncounterId,
  );
  const historyRecords =
    activeBundle &&
    chartHistoryScope?.workspaceId === workspaceId &&
    chartHistoryScope.patientId === activeBundle.patient.id
      ? chartHistoryRecords
      : [];

  return getDisplayedChartBundle({
    activeBundle,
    historyRecords,
    historyViewEncounterId,
  });
}

function useChartOperatingDate(workspaceId: string) {
  const { todayDate } = useSelectedOperatingDate(workspaceId);
  const storedSelectedDate = useChartStore(
    (state) => state.selectedOperatingDateByWorkspace[workspaceId],
  );
  const selectOperatingDate = useChartStore(
    (state) => state.selectOperatingDate,
  );

  return {
    selectDate: (date: string) => selectOperatingDate(workspaceId, date),
    selectedDate: storedSelectedDate ?? todayDate,
    todayDate,
  };
}

function useScopedChartLiveQueue(workspaceId: string) {
  const liveQueueError = useChartStore((state) => state.liveQueueError);
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const liveQueueScope = useChartStore((state) => state.liveQueueScope);
  const liveQueueStatus = useChartStore((state) => state.liveQueueStatus);
  const { selectedDate } = useChartOperatingDate(workspaceId);
  const queueScopeMatches =
    liveQueueScope?.workspaceId === workspaceId &&
    liveQueueScope.date === selectedDate;

  return {
    error: queueScopeMatches ? liveQueueError : undefined,
    queueScopeMatches,
    records: queueScopeMatches ? liveQueueRecords : [],
    selectedDate,
    status: queueScopeMatches ? liveQueueStatus : ("loading" as const),
  };
}

function replaceLiveChartSelection({
  encounterId,
  router,
  workspaceId,
}: {
  encounterId: string;
  router: ReturnType<typeof useRouter>;
  workspaceId: string;
}) {
  const currentSearch =
    typeof window === "undefined" ? "" : window.location.search;
  const href = buildWorkspaceSurfaceRoute({
    moduleId: "treatment",
    params: { encounterId },
    removeParams: ["patientId", "scenario"],
    search: currentSearch,
    workspaceId,
  });
  const currentHref =
    typeof window === "undefined"
      ? ""
      : `${window.location.pathname}${window.location.search}`;

  if (currentHref !== href) router.replace(href, { scroll: false });
}

function chooseRecoverableLiveEncounterId({
  currentEncounterId,
  explicitEncounterId,
  records,
}: {
  currentEncounterId: string;
  explicitEncounterId: string | null;
  records: ChartLiveQueueRecord[];
}) {
  const liveEncounterIds = new Set(
    records.map((record) => record.encounter.id),
  );
  if (explicitEncounterId && liveEncounterIds.has(explicitEncounterId)) {
    return explicitEncounterId;
  }
  if (currentEncounterId && liveEncounterIds.has(currentEncounterId)) {
    return currentEncounterId;
  }

  return records[0]?.encounter.id ?? "";
}

function useChartLiveQueueCoordinator(workspaceId: string) {
  const router = useRouter();
  const explicitEncounterId = useExplicitChartEncounterId();
  const demoScenarioEncounterId = useDemoScenarioChartEncounterId();
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueScope = useChartStore((state) => state.liveQueueScope);
  const liveQueueStatus = useChartStore((state) => state.liveQueueStatus);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const setLiveQueueState = useChartStore((state) => state.setLiveQueueState);
  const {
    clearModuleRefreshAction,
    setModuleRefreshAction,
    setSelectedQueueItem,
  } = useLayoutStore();
  const {
    hydrated: authHydrated,
    session: authSession,
    hydrate: hydrateAuthSession,
  } = useAuthClient();
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const { selectedDate } = useChartOperatingDate(workspaceId);
  const automaticRefreshKeyRef = useRef("");
  const requestSeqRef = useRef(0);
  const selectedEncounterIdRef = useRef(selectedEncounterId);
  const explicitEncounterIdRef = useRef(explicitEncounterId);
  const demoScenarioEncounterIdRef = useRef(demoScenarioEncounterId);
  const legacySalesDemo =
    isLegacySalesDemoWorkspace(workspaceId) &&
    getAuthRuntimeMode().authProvider === "mock";
  const scopeMatches =
    liveQueueScope?.workspaceId === workspaceId &&
    liveQueueScope.date === selectedDate;

  useEffect(() => {
    hydrateAuthSession();
  }, [hydrateAuthSession]);

  useEffect(() => {
    selectedEncounterIdRef.current = selectedEncounterId;
  }, [selectedEncounterId]);

  useEffect(() => {
    explicitEncounterIdRef.current = explicitEncounterId;
  }, [explicitEncounterId]);

  useEffect(() => {
    demoScenarioEncounterIdRef.current = demoScenarioEncounterId;
  }, [demoScenarioEncounterId]);

  useEffect(() => {
    if (scopeMatches) return;

    setLiveQueueState({
      records: [],
      scope: { date: selectedDate, workspaceId },
      status: "idle",
    });
    if (legacySalesDemo) return;

    setSelectedQueueItem("treatment", "");
    selectedEncounterIdRef.current = "";
    selectEncounter("");
  }, [
    scopeMatches,
    legacySalesDemo,
    selectEncounter,
    selectedDate,
    setLiveQueueState,
    setSelectedQueueItem,
    workspaceId,
  ]);

  const refreshLiveQueue = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    const requestedScope = { date: selectedDate, workspaceId };
    const currentScope = useChartStore.getState().liveQueueScope;
    const isDateTransition =
      currentScope?.workspaceId !== workspaceId ||
      currentScope.date !== selectedDate ||
      currentScope.ignoreExplicitEncounter === true;

    requestSeqRef.current = requestSeq;
    setLiveQueueState({
      records: isDateTransition ? [] : undefined,
      scope: {
        ...requestedScope,
        ignoreExplicitEncounter: isDateTransition,
      },
      status: "loading",
    });

    const result = await loadChartLiveQueue({
      actorHeaders,
      date: selectedDate,
      workspaceId,
    });
    const latestScope = useChartStore.getState().liveQueueScope;

    if (
      requestSeqRef.current !== requestSeq ||
      latestScope?.workspaceId !== requestedScope.workspaceId ||
      latestScope.date !== requestedScope.date
    ) {
      return;
    }

    if (!result.ok) {
      if (legacySalesDemo) {
        setLiveQueueState({
          error: result.denialReason ?? result.error ?? "db_read_failed",
          records: [],
          scope: requestedScope,
          status: "error",
        });
        return;
      }

      setSelectedQueueItem("treatment", "");
      selectedEncounterIdRef.current = "";
      selectEncounter("");
      setLiveQueueState({
        error: result.denialReason ?? result.error ?? "db_read_failed",
        records: [],
        scope: requestedScope,
        status: "error",
      });
      replaceLiveChartSelection({ encounterId: "", router, workspaceId });
      return;
    }

    result.queue.forEach((record) => {
      saveChartLiveEncounterHandoff({
        encounter: record.encounter,
        patient: record.patient,
        primaryGuardian: record.primaryGuardian,
        veterinarianName: record.veterinarianName,
      });
    });

    const queryEncounterId = isDateTransition
      ? null
      : new URLSearchParams(
          typeof window === "undefined" ? "" : window.location.search,
        ).get("encounterId");
    const recoveredLiveEncounterId = chooseRecoverableLiveEncounterId({
      currentEncounterId: isDateTransition
        ? ""
        : selectedEncounterIdRef.current,
      explicitEncounterId: queryEncounterId,
      records: result.queue,
    });
    const legacyExplicitEncounterId = explicitEncounterIdRef.current;
    const legacyCurrentEncounterId = selectedEncounterIdRef.current;
    const liveEncounterIds = new Set(
      result.queue.map((record) => record.encounter.id),
    );
    const validLegacyExplicitEncounterId =
      legacyExplicitEncounterId &&
      (demoScenarioEncounterIdRef.current === legacyExplicitEncounterId ||
        liveEncounterIds.has(legacyExplicitEncounterId))
        ? legacyExplicitEncounterId
        : "";
    const validLegacyCurrentEncounterId =
      legacyCurrentEncounterId &&
      (getChartEncounter(legacyCurrentEncounterId) ||
        liveEncounterIds.has(legacyCurrentEncounterId))
        ? legacyCurrentEncounterId
        : "";
    const nextSelectedEncounterId = legacySalesDemo
      ? validLegacyExplicitEncounterId ||
        validLegacyCurrentEncounterId ||
        (legacyExplicitEncounterId ? recoveredLiveEncounterId : "") ||
        legacySalesDemoDefaultEncounterId
      : recoveredLiveEncounterId;

    setLiveQueueState({
      records: result.queue,
      scope: requestedScope,
      status: "ready",
    });
    setSelectedQueueItem("treatment", nextSelectedEncounterId);
    selectedEncounterIdRef.current = nextSelectedEncounterId;
    selectEncounter(nextSelectedEncounterId);
    if (
      !legacySalesDemo ||
      (legacyExplicitEncounterId && !validLegacyExplicitEncounterId)
    ) {
      replaceLiveChartSelection({
        encounterId: nextSelectedEncounterId,
        router,
        workspaceId,
      });
    }
  }, [
    actorHeaders,
    legacySalesDemo,
    router,
    selectEncounter,
    selectedDate,
    setLiveQueueState,
    setSelectedQueueItem,
    workspaceId,
  ]);

  useEffect(() => {
    if (!authHydrated) return;
    const automaticRefreshKey = `${workspaceId}:${selectedDate}:${authSession?.id ?? "anonymous"}`;
    const queueState = useChartStore.getState();
    const hasStartedCurrentScope =
      queueState.liveQueueScope?.workspaceId === workspaceId &&
      queueState.liveQueueScope.date === selectedDate &&
      queueState.liveQueueStatus !== "idle";
    if (
      automaticRefreshKeyRef.current === automaticRefreshKey ||
      hasStartedCurrentScope
    ) {
      return;
    }

    automaticRefreshKeyRef.current = automaticRefreshKey;
    void refreshLiveQueue();
  }, [
    authHydrated,
    authSession?.id,
    refreshLiveQueue,
    selectedDate,
    workspaceId,
  ]);

  useQueueRealtimeRefresh({
    enabled: authHydrated,
    onQueueChange: refreshLiveQueue,
    scopeKey: `chart:${selectedDate}`,
    workspaceId,
  });

  useEffect(() => {
    setModuleRefreshAction("treatment", {
      isRefreshing: liveQueueStatus === "loading",
      label: "진료 대기열 새로고침",
      onRefresh: refreshLiveQueue,
    });

    return () => clearModuleRefreshAction("treatment");
  }, [
    clearModuleRefreshAction,
    liveQueueStatus,
    refreshLiveQueue,
    setModuleRefreshAction,
  ]);
}

export function ChartSlotAvailabilityProvider({
  children,
  workspaceId,
}: WorkspaceSlotAvailabilityProviderProps) {
  useChartLiveQueueCoordinator(workspaceId);
  const bundle = useActiveChartBundle(workspaceId);

  return children({
    hasContentAside: Boolean(bundle),
  });
}

function resolveChartBundleVeterinarianName(bundle: ChartBundle) {
  return (
    bundle.veterinarianName ??
    getChartStaffName(bundle.encounter.primaryVeterinarianId)
  );
}

function getChartBundleVeterinarianName(bundle: ChartBundle) {
  return resolveChartBundleVeterinarianName(bundle) ?? "담당 미정";
}

function getChartHistoryVeterinarianName(
  row: ChartHistoryRow,
  bundle: ChartBundle,
) {
  if (row.veterinarianName) return row.veterinarianName;

  if (row.encounter.id === bundle.encounter.id) {
    return resolveChartBundleVeterinarianName(bundle) ?? "미정";
  }

  return getChartStaffName(row.encounter.primaryVeterinarianId) ?? "미정";
}

function getChartHistoryRowsForBundle(
  bundle: ChartBundle,
  liveRows?: ChartPatientHistoryRecord[],
): ChartHistoryRow[] {
  if (liveRows) return liveRows;

  const rows = getChartHistoryRows(bundle.patient.id);

  if (rows.some((row) => row.encounter.id === bundle.encounter.id)) {
    return rows;
  }

  const currentRow: ChartHistoryRow = {
    diagnoses: bundle.diagnoses.filter(
      (diagnosis) => diagnosis.encounterId === bundle.encounter.id,
    ),
    encounter: bundle.encounter,
    primaryGuardian: bundle.primaryGuardian,
    soapNote: bundle.soapNotes.find(
      (soapNote) => soapNote.encounterId === bundle.encounter.id,
    ),
    veterinarianName: bundle.veterinarianName,
  };

  return [currentRow, ...rows].sort((a, b) =>
    (b.encounter.checkedInAt ?? b.encounter.createdAt).localeCompare(
      a.encounter.checkedInAt ?? a.encounter.createdAt,
    ),
  );
}

function mapLiveChartQueueRecordToItem(
  record: ChartLiveQueueRecord,
): OrderQueueItem {
  return {
    id: record.encounter.id,
    instructionId: record.encounter.encounterNo,
    patientName: record.patient.name,
    guardianName: record.primaryGuardian?.name ?? "보호자 미지정",
    patientAge: getPatientDisplayAge(record.patient),
    patientBreed: record.patient.breed,
    patientSex: getPatientSexLabel(record.patient),
    receptionType: record.encounter.appointmentId ? "예약" : "외래",
    orderName:
      record.encounter.chiefComplaint ??
      record.encounter.visitPurpose ??
      "진료 대기",
    orderType: record.encounter.visitPurpose ?? "진료",
    orderTypeCategory: "treatment",
    requesterName: record.veterinarianName ?? "담당 미정",
    assigneeName: record.veterinarianName,
    startedAt: getShortClockTime(record.encounter.startedAt),
    statusId:
      record.queueEntry.status === "called"
        ? "in_progress"
        : record.queueEntry.status,
    time: getShortClockTime(record.queueEntry.enteredAt),
  };
}

function getChartVitals(bundle: ChartBundle) {
  if (bundle.patient.id === "patient-kong") {
    return [
      { label: "체중", value: "2.3kg" },
      { label: "체온", value: "39.1℃" },
      { label: "호흡", value: "24rpm" },
      { label: "혈압", value: "130bpm" },
    ];
  }

  return [
    { label: "체중", value: "5.96kg" },
    { label: "체온", value: "39.3℃" },
    { label: "호흡", value: "20rpm" },
    { label: "혈압", value: "170bpm" },
  ];
}

function useScenarioEncounterSync(workspaceId: string) {
  const searchParams = useSearchParams();
  const lastAppliedQueryEncounterId = useRef<string | null>(null);
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const { records: liveQueueRecords, status: liveQueueStatus } =
    useScopedChartLiveQueue(workspaceId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryEncounterId = scenario?.encounterId ?? null;
  const queryEncounterBundle = queryEncounterId
    ? (getChartEncounter(queryEncounterId) ??
      getLiveQueueBundle(queryEncounterId, liveQueueRecords) ??
      getLiveHandoffBundle(queryEncounterId))
    : null;
  const hasValidQueryEncounter =
    queryEncounterId !== null && queryEncounterBundle !== null;

  useEffect(() => {
    if (
      !isLegacySalesDemoWorkspace(workspaceId) ||
      getAuthRuntimeMode().authProvider !== "mock"
    ) return;
    if (liveQueueStatus === "ready" && liveQueueRecords.length === 0) return;
    if (!queryEncounterId || !hasValidQueryEncounter) return;
    if (lastAppliedQueryEncounterId.current === queryEncounterId) return;

    lastAppliedQueryEncounterId.current = queryEncounterId;
    if (selectedEncounterId !== queryEncounterId) {
      selectEncounter(queryEncounterId);
    }
  }, [
    hasValidQueryEncounter,
    liveQueueRecords,
    liveQueueStatus,
    queryEncounterId,
    selectEncounter,
    selectedEncounterId,
    workspaceId,
  ]);
}

function useExplicitChartEncounterId() {
  const searchParams = useSearchParams();
  const scenario = getDemoScenarioFromParams(searchParams);

  return searchParams.get("encounterId") ?? scenario?.encounterId ?? null;
}

function useDemoScenarioChartEncounterId() {
  const searchParams = useSearchParams();
  const scenario = getDemoScenarioFromParams(searchParams);

  return scenario?.encounterId ?? null;
}

export function ChartSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const liveQueueStatus = useChartStore((state) => state.liveQueueStatus);
  const requestConsultationCall = useChartStore(
    (state) => state.requestConsultationCall,
  );
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const setLiveQueueState = useChartStore((state) => state.setLiveQueueState);
  const { setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const legacySalesDemo =
    isLegacySalesDemoWorkspace(workspaceId) &&
    getAuthRuntimeMode().authProvider === "mock";
  const { selectDate, selectedDate, todayDate } =
    useChartOperatingDate(workspaceId);
  const mockItems = useMemo(
    () => (legacySalesDemo ? getChartQueueItems() : emptyChartQueueItems),
    [legacySalesDemo],
  );
  const liveItems = useMemo(
    () => liveQueueRecords.map(mapLiveChartQueueRecordToItem),
    [liveQueueRecords],
  );
  const liveMode = liveQueueStatus === "ready" || liveQueueRecords.length > 0;
  const items = useMemo(
    () => (liveMode ? liveItems : mockItems),
    [liveItems, liveMode, mockItems],
  );
  const explicitQueryEncounterId = useExplicitChartEncounterId();
  const selectWorkspaceEncounter = (itemId: string) => {
    const href = buildWorkspaceSurfaceRoute({
      moduleId: "treatment",
      params: { encounterId: itemId },
      search: searchParams,
      workspaceId,
    });

    selectEncounter(itemId);
    setSelectedQueueItem("treatment", itemId);

    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(href, "treatment");
      return;
    }
  };

  useEffect(() => {
    if (liveMode || items.length === 0) return;
    if (items.some((item) => item.id === selectedEncounterId)) return;
    if (explicitQueryEncounterId) return;
    selectEncounter(
      items.find((item) => item.id === legacySalesDemoDefaultEncounterId)?.id ??
        items[0].id,
    );
  }, [
    items,
    explicitQueryEncounterId,
    liveMode,
    selectEncounter,
    selectedEncounterId,
  ]);

  return (
    <EmrOrderQueueSidePanel
      emptyObjectLabel="진료 업무"
      getActionItems={(item, onSelect) =>
        getChartQueueActionItems({
          item,
          onRequestCall: () => requestConsultationCall(item.id),
          onSelect,
        })
      }
      getTaskCardItem={getChartTaskCardItem}
      items={items}
      listLabel="진료 대기열"
      loading={liveQueueStatus === "loading"}
      loadingTitle="진료차트 정보를 불러오는 중입니다"
      selectedDate={selectedDate}
      selectedItemId={selectedEncounterId}
      statuses={getChartQueueStatuses()}
      title="진료/차트"
      todayDate={todayDate}
      typeFilterVisible={false}
      onCollapse={() => setModulePanelOpen(false)}
      onDateChange={(date) => {
        selectDate(date);
        setLiveQueueState({
          records: [],
          scope: {
            date,
            ignoreExplicitEncounter: true,
            workspaceId,
          },
          status: "idle",
        });
        setSelectedQueueItem("treatment", "");
        selectEncounter("");
        if (!legacySalesDemo) {
          replaceLiveChartSelection({ encounterId: "", router, workspaceId });
        }
      }}
      onSelectItem={selectWorkspaceEncounter}
    />
  );
}

export function ChartHeader({ workspaceId }: ShellComponentProps) {
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const historyViewEncounterId = useChartStore(
    (state) => state.historyViewEncounterId,
  );
  const chartHistoryRecords = useChartStore(
    (state) => state.chartHistoryRecords,
  );
  const chartHistoryScope = useChartStore((state) => state.chartHistoryScope);
  const { session: authSession } = useAuthClient();
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const [vitalDialogEncounterId, setVitalDialogEncounterId] = useState<
    string | null
  >(null);
  const { queueScopeMatches, records: liveQueueRecords } =
    useScopedChartLiveQueue(workspaceId);
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    getAuthRuntimeMode().authProvider === "mock";
  const activeBundle = getSelectedBundle(
    queueScopeMatches || allowMockFallback ? selectedEncounterId : "",
    liveQueueRecords,
    { allowMockFallback },
  );
  const chartHistoryScopeMatches = Boolean(
    activeBundle &&
    chartHistoryScope?.workspaceId === workspaceId &&
    chartHistoryScope.patientId === activeBundle.patient.id,
  );
  const scopedChartHistoryRecords = useMemo(
    () => (chartHistoryScopeMatches ? chartHistoryRecords : []),
    [chartHistoryRecords, chartHistoryScopeMatches],
  );
  const bundle = getDisplayedChartBundle({
    activeBundle,
    historyRecords: scopedChartHistoryRecords,
    historyViewEncounterId,
  });
  const isHistoricalView = Boolean(
    bundle && activeBundle && bundle.encounter.id !== activeBundle.encounter.id,
  );

  const selectedLiveQueueRecord = liveQueueRecords.find(
    (record) => record.encounter.id === selectedEncounterId,
  );
  const { openGuardianProfile, openPatientProfile } =
    useChartPatientGuardianProfileActions({
      patient: bundle?.patient,
      primaryGuardian: bundle?.primaryGuardian,
    });
  const chartStartLocked =
    !isHistoricalView &&
    bundle?.encounter.status === "waiting" &&
    selectedLiveQueueRecord?.queueEntry.status === "waiting";
  const latestVitals = usePatientLatestVitalItems({
    actorHeaders,
    encounterId: bundle?.encounter.id,
    fallbackItems:
      bundle && allowMockFallback ? getChartVitals(bundle) : undefined,
    workspaceId,
  });

  if (!bundle) {
    return <EmrMainContentHeader aria-hidden="true" heightMode="fixed" />;
  }

  if (chartStartLocked) return null;

  const veterinarianName = getChartBundleVeterinarianName(bundle);
  const queueStatus = isHistoricalView
    ? undefined
    : selectedLiveQueueRecord?.queueEntry.status;
  const vitalWriteStateAllowed =
    bundle.encounter.status === "in_consultation" &&
    queueStatus === "in_progress";
  const vitalActionDisabled =
    isHistoricalView || !vitalWriteStateAllowed || !latestVitals.canWriteVitals;
  const vitalActionDisabledReason = isHistoricalView
    ? "과거 차트 보기에서는 바이탈을 수정할 수 없어요."
    : !vitalWriteStateAllowed
      ? "진료 중인 접수에서만 바이탈을 입력할 수 있어요."
      : latestVitals.status === "loading"
        ? "바이탈 입력 권한을 확인하고 있어요."
        : latestVitals.status === "error"
          ? "바이탈 입력 권한을 확인하지 못했어요."
          : "바이탈을 입력할 권한이 없어요.";
  const currentEncounterVital =
    latestVitals.vital?.encounterId === bundle.encounter.id
      ? latestVitals.vital
      : undefined;
  const patientNotes = [
    bundle.patient.allergyNote,
    bundle.patient.handlingCautionNote,
    bundle.patient.specialNote,
  ].filter((note): note is string => Boolean(note));

  return (
    <>
      <EmrMainContentHeader heightMode="fixed">
        <ChartPatientContextBar
          patientName={bundle.patient.name}
          patientMeta={[
            bundle.patient.breed ?? getSpeciesLabel(bundle.patient),
            getPatientSexLabel(bundle.patient),
            getPatientDisplayAge(bundle.patient),
          ].join(" · ")}
          patientInteraction={{
            ariaLabel: `${bundle.patient.name} 환자 프로필 열기`,
            onActivate: openPatientProfile,
            preview: (
              <ChartProfilePreviewCard
                badge={getPatientStatusLabel(bundle.patient.status)}
                kind="patient"
                title={bundle.patient.name}
                items={[
                  { label: "환자번호", value: bundle.patient.patientNo },
                  {
                    label: "축종·품종",
                    value: `${getSpeciesLabel(bundle.patient)} · ${bundle.patient.breed ?? "품종 미입력"}`,
                  },
                  {
                    label: "나이",
                    value: getPatientDisplayAge(bundle.patient),
                  },
                  { label: "성별", value: getPatientSexLabel(bundle.patient) },
                ]}
                notes={patientNotes}
              />
            ),
          }}
          guardianName={`${bundle.primaryGuardian?.name ?? "보호자 미지정"}${bundle.primaryGuardian ? "(주보호자)" : ""}`}
          guardianPhone={
            bundle.primaryGuardian?.mobilePhone ??
            bundle.primaryGuardian?.phone ??
            "연락처 미입력"
          }
          guardianInteraction={
            bundle.primaryGuardian
              ? {
                  ariaLabel: `${bundle.primaryGuardian.name} 보호자 프로필 열기`,
                  onActivate: openGuardianProfile,
                  preview: (
                    <ChartProfilePreviewCard
                      badge="주보호자"
                      kind="guardian"
                      title={bundle.primaryGuardian.name}
                      items={[
                        {
                          label: "대표 연락처",
                          value:
                            bundle.primaryGuardian.mobilePhone ??
                            bundle.primaryGuardian.phone,
                        },
                        {
                          label: "이메일",
                          value: bundle.primaryGuardian.email,
                        },
                        {
                          label: "환자 관계",
                          value: `${bundle.patient.name}의 주보호자`,
                        },
                      ]}
                    />
                  ),
                }
              : undefined
          }
          vitalItems={latestVitals.items}
          vitalAction={{
            ariaLabel: currentEncounterVital
              ? "오늘 바이탈 수정"
              : "오늘 바이탈 입력",
            disabled: vitalActionDisabled,
            disabledReason: vitalActionDisabledReason,
            onActivate: () => setVitalDialogEncounterId(bundle.encounter.id),
          }}
          doctorName={veterinarianName}
          memoItems={[
            {
              label: "방문목적",
              summary:
                bundle.encounter.visitPurpose ??
                bundle.encounter.chiefComplaint ??
                "방문 목적 기록 없음",
            },
            {
              label: "보호자메모",
              summary: bundle.primaryGuardian?.memo ?? "보호자 메모 없음",
            },
            {
              label: "환자메모",
              summary: patientNotes.join(" · ") || "환자 특이 메모 없음",
            },
            {
              label: "수납메모",
              disabled: true,
              summary: "수납 화면 연동 후 사용할 수 있습니다.",
            },
          ]}
        />
      </EmrMainContentHeader>
      <ChartVitalDialog
        actorHeaders={actorHeaders}
        encounterId={bundle.encounter.id}
        measurement={currentEncounterVital}
        mode="in_consultation"
        open={vitalDialogEncounterId === bundle.encounter.id}
        onOpenChange={(open) =>
          setVitalDialogEncounterId(open ? bundle.encounter.id : null)
        }
        onSaved={(vital) => {
          latestVitals.replaceVital(vital);
          toast.success("오늘 바이탈을 저장했어요.");
        }}
        vitalSettings={latestVitals.vitalSettings}
        workspaceId={workspaceId}
      />
    </>
  );
}

function getPatientStatusLabel(status: "active" | "inactive" | "deceased") {
  if (status === "active") return "진료 가능";
  if (status === "deceased") return "사망";
  return "비활성";
}

export function ChartContentAside({ workspaceId }: ShellComponentProps) {
  const bundle = useDisplayedChartBundle(workspaceId);
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const historyViewEncounterId = useChartStore(
    (state) => state.historyViewEncounterId,
  );
  const chartHistoryError = useChartStore((state) => state.chartHistoryError);
  const chartHistoryRecords = useChartStore(
    (state) => state.chartHistoryRecords,
  );
  const chartHistoryScope = useChartStore((state) => state.chartHistoryScope);
  const chartHistoryStatus = useChartStore((state) => state.chartHistoryStatus);
  const chartHistoryTotalCount = useChartStore(
    (state) => state.chartHistoryTotalCount,
  );
  const requestChartHistoryRefresh = useChartStore(
    (state) => state.requestChartHistoryRefresh,
  );
  const selectHistoryEncounter = useChartStore(
    (state) => state.selectHistoryEncounter,
  );
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<
    Set<string>
  >(() => new Set());
  const liveHistoryScopeMatches = Boolean(
    bundle &&
    chartHistoryScope?.workspaceId === workspaceId &&
    chartHistoryScope.patientId === bundle.patient.id,
  );
  const liveHistoryRows =
    (!isLegacySalesDemoWorkspace(workspaceId) ||
      getAuthRuntimeMode().authProvider === "supabase") &&
    liveHistoryScopeMatches &&
    chartHistoryStatus === "ready"
      ? chartHistoryRecords
      : undefined;
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRowsForBundle(bundle, liveHistoryRows) : []),
    [bundle, liveHistoryRows],
  );
  const effectiveSelectedEncounterId =
    historyViewEncounterId || selectedEncounterId;
  const historyCount =
    liveHistoryScopeMatches && chartHistoryStatus === "ready"
      ? chartHistoryTotalCount
      : historyRows.length;
  const historyGroups = useMemo(
    () =>
      historyRows.reduce<Array<{ date: string; rows: ChartHistoryRow[] }>>(
        (groups, row) => {
          const date = getShortDateTime(
            row.encounter.checkedInAt ?? row.encounter.createdAt,
          ).slice(0, 8);
          const group = groups.find((item) => item.date === date);

          if (group) {
            group.rows.push(row);
          } else {
            groups.push({ date, rows: [row] });
          }

          return groups;
        },
        [],
      ),
    [historyRows],
  );
  const toggleHistoryGroup = (date: string) => {
    setCollapsedHistoryGroups((current) => {
      const next = new Set(current);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
  };

  if (!bundle) return null;

  return (
    <EmrContentAsidePanel id="chart-content-aside">
      <EmrContentAsideHeader
        count={historyCount}
        label="차트이력"
        collapseAriaLabel="차트 이력 목록 접기"
        onCollapse={() => setContentAsideOpen(false)}
        actions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="검색">
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-border-default)]" />
      <ScrollArea
        className="min-h-0 flex-1"
        style={{
          marginInline: "calc(var(--emr-content-aside-padding-x) * -1)",
          width: "calc(100% + (var(--emr-content-aside-padding-x) * 2))",
        }}
      >
        <div className="flex flex-col gap-1 px-[var(--emr-content-aside-padding-x)] pb-3">
          {liveHistoryScopeMatches && chartHistoryStatus === "loading" ? (
            <div
              className="flex items-center gap-2 px-2 py-3 emr-text-metadata text-[var(--emr-text-secondary)]"
              data-testid="chart-history-loading-state"
              role="status"
            >
              <Skeleton className="h-3 w-20 motion-reduce:animate-none" />
              <span className="sr-only">차트 이력을 불러오는 중입니다</span>
            </div>
          ) : null}
          {liveHistoryScopeMatches && chartHistoryStatus === "error" ? (
            <EmrInlineAlert
              severity="error"
              title="차트 이력을 불러오지 못했습니다"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestChartHistoryRefresh}
                >
                  다시 시도
                </Button>
              }
              testId="chart-history-error-alert"
            >
              {chartHistoryError === "permission_missing"
                ? "현재 계정의 차트 조회 권한을 확인해 주세요."
                : "연결 상태를 확인한 뒤 다시 시도해 주세요."}
            </EmrInlineAlert>
          ) : null}
          {historyGroups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              count={group.rows.length}
              dataTestId={`chart-history-group-${group.date}`}
              label={group.date}
              onToggle={() => toggleHistoryGroup(group.date)}
            >
              {group.rows.map((row) => (
                <ChartHistoryItem
                  key={row.encounter.id}
                  bundle={bundle}
                  mode="visit"
                  row={row}
                  selected={row.encounter.id === effectiveSelectedEncounterId}
                  onSelect={() =>
                    selectHistoryEncounter(
                      row.encounter.id === selectedEncounterId
                        ? ""
                        : row.encounter.id,
                    )
                  }
                />
              ))}
            </EmrContentHistoryGroup>
          ))}
        </div>
      </ScrollArea>
      <div
        className="flex shrink-0 justify-end gap-2 border-t border-[var(--emr-border-default)] bg-[var(--emr-surface-workspace)] py-3"
        data-testid="chart-history-footer-actions"
      >
        <span className="inline-flex" title="수술 차트는 기능 구현 중입니다.">
          <Button variant="outline" size="default" className="bg-card" disabled>
            수술 차트
            <span className="sr-only">기능 구현 중입니다.</span>
          </Button>
        </span>
        <Button size="default">외래 차트 추가</Button>
      </div>
    </EmrContentAsidePanel>
  );
}

function ChartInlineHistoryPanel({
  activeEncounterId,
  bundle,
  collapseContentId,
  historyError,
  historyRows,
  historyStatus,
  onCollapse,
  onRetry,
  onSelectEncounter,
  selectedEncounterId,
}: {
  activeEncounterId: string;
  bundle: ChartBundle;
  collapseContentId: string;
  historyError?: string;
  historyRows: ChartHistoryRow[];
  historyStatus: "idle" | "loading" | "ready" | "error";
  onCollapse: () => void;
  onRetry: () => void;
  onSelectEncounter: (encounterId: string) => void;
  selectedEncounterId: string;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const priorDiagnosisRows = useMemo(
    () => historyRows.filter((row) => row.encounter.id !== activeEncounterId),
    [activeEncounterId, historyRows],
  );
  const visibleRows = useMemo(
    () =>
      normalizedQuery
        ? priorDiagnosisRows.filter((row) => {
            const diagnosisText = row.diagnoses
              .map((diagnosis) => diagnosis.diagnosisText)
              .join(" ");
            return [diagnosisText, getChartHistoryVeterinarianName(row, bundle)]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase("ko-KR")
              .includes(normalizedQuery);
          })
        : priorDiagnosisRows,
    [bundle, normalizedQuery, priorDiagnosisRows],
  );
  const historyGroups = useMemo(
    () =>
      visibleRows.reduce<Array<{ date: string; rows: ChartHistoryRow[] }>>(
        (groups, row) => {
          const date = getShortDateTime(
            row.encounter.checkedInAt ?? row.encounter.createdAt,
          ).slice(0, 8);
          const currentGroup = groups.at(-1);
          if (currentGroup?.date === date) currentGroup.rows.push(row);
          else groups.push({ date, rows: [row] });
          return groups;
        },
        [],
      ),
    [visibleRows],
  );

  return (
    <ChartWorkspacePanel
      title="History"
      actions={
        <>
          <ChartPanelCollapseButton
            contentId={collapseContentId}
            label="History"
            onCollapse={onCollapse}
            panelId="history"
          />
          <ChartPanelActions />
        </>
      }
      toolbar={
        <div className="flex w-full min-w-0 items-center gap-2">
          <Select defaultValue="diagnosis">
            <SelectTrigger
              aria-label="차트 이력 종류"
              size="sm"
              className="w-[92px] shrink-0 rounded-lg bg-card px-2 emr-control-text-compact"
            >
              진단이력
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diagnosis">진단이력</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1">
            <CdsActionsSearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="진단 이력 검색"
              placeholder="키워드를 입력해주세요"
              value={query}
              className="h-7 rounded-lg bg-card px-2 pr-8 emr-control-text-compact"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-7 rounded-lg bg-card px-2 text-xs"
            disabled
            title="준비 중"
          >
            <CdsActionsListFilterIcon data-icon="inline-start" />
            필터
          </Button>
        </div>
      }
    >
      <ScrollArea className="h-full bg-[var(--emr-surface-panel)]">
        <div className="flex min-h-full flex-col gap-1 p-3">
          {historyStatus === "loading" ? (
            <div
              className="flex items-center gap-2 px-2 py-3 emr-text-metadata text-[var(--emr-text-secondary)]"
              data-testid="chart-inline-history-loading-state"
              role="status"
            >
              <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              <span className="sr-only">차트 이력을 불러오는 중입니다</span>
            </div>
          ) : null}
          {historyStatus === "error" ? (
            <EmrInlineAlert
              severity="error"
              title="차트 이력을 불러오지 못했습니다"
              action={
                <Button size="sm" variant="outline" onClick={onRetry}>
                  다시 시도
                </Button>
              }
              testId="chart-inline-history-error-alert"
            >
              {historyError === "permission_missing"
                ? "현재 계정의 차트 조회 권한을 확인해 주세요."
                : "연결 상태를 확인한 뒤 다시 시도해 주세요."}
            </EmrInlineAlert>
          ) : null}
          {historyGroups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={false}
              count={group.rows.length}
              dataTestId={`chart-inline-history-group-${group.date}`}
              label={group.date}
              onToggle={() => undefined}
            >
              {group.rows.map((row) => (
                <ChartHistoryItem
                  key={row.encounter.id}
                  bundle={bundle}
                  mode="diagnosis"
                  row={row}
                  selected={row.encounter.id === selectedEncounterId}
                  onSelect={() => onSelectEncounter(row.encounter.id)}
                />
              ))}
            </EmrContentHistoryGroup>
          ))}
          {!visibleRows.length &&
          historyStatus !== "loading" &&
          historyStatus !== "error" ? (
            <div className="flex min-h-52 flex-1 items-center justify-center">
              <EmrEmptyState
                kind={
                  priorDiagnosisRows.length ? "no-filter-results" : "no-data"
                }
                priority={
                  priorDiagnosisRows.length ? "local-recovery" : "supporting"
                }
                surface="content"
                title={
                  priorDiagnosisRows.length
                    ? "검색 결과가 없습니다"
                    : "과거 진단 이력이 없습니다"
                }
                description={
                  priorDiagnosisRows.length
                    ? "다른 키워드로 진단 이력을 찾아보세요."
                    : "이 환자의 이전 진단이 기록되면 여기에 표시됩니다."
                }
                testId="chart-history-empty-state"
              />
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </ChartWorkspacePanel>
  );
}

type ChartHistoryItemMode = "diagnosis" | "visit";

function getChartHistoryDiagnosisLabel(row: ChartHistoryRow) {
  const diagnosisLabels = row.diagnoses
    .map((diagnosis) => diagnosis.diagnosisText.trim())
    .filter(Boolean);

  if (!diagnosisLabels.length) return "진단 기록 없음";
  if (diagnosisLabels.length === 1) return diagnosisLabels[0];

  return `${diagnosisLabels[0]} 외 ${diagnosisLabels.length - 1}건`;
}

function ChartHistoryItem({
  bundle,
  mode,
  onSelect,
  row,
  selected,
}: {
  bundle: ChartBundle;
  mode: ChartHistoryItemMode;
  onSelect: () => void;
  row: ChartHistoryRow;
  selected: boolean;
}) {
  const eventAt = row.encounter.checkedInAt ?? row.encounter.createdAt;
  const diagnosisLabel = getChartHistoryDiagnosisLabel(row);
  const visitPurpose = row.encounter.visitPurpose?.trim() || "방문 목적 미입력";
  const statusLabel = getStatusLabel("encounter", row.encounter.status);
  const isDiagnosisHistory = mode === "diagnosis";

  return (
    <EmrContentHistoryItem
      selected={selected}
      testId={`${isDiagnosisHistory ? "chart-diagnosis-history-item" : "chart-history-item"}-${row.encounter.id}`}
      title={isDiagnosisHistory ? diagnosisLabel : visitPurpose}
      badge={
        isDiagnosisHistory ? undefined : (
          <Badge
            variant="outline"
            className="h-5 shrink-0 rounded-md px-1.5 emr-text-micro"
          >
            {statusLabel}
          </Badge>
        )
      }
      subtitle={getShortClockTime(eventAt)}
      meta={
        <span className="truncate">
          담당 {getChartHistoryVeterinarianName(row, bundle)}
        </span>
      }
      onSelect={onSelect}
    />
  );
}

const hasSavedSoapContent = (soapNote?: SoapNote | null) =>
  Boolean(
    soapNote &&
    [
      soapNote.subjective,
      soapNote.objective,
      soapNote.assessment,
      soapNote.plan,
    ].some((value) => Boolean(value?.trim())),
  );

function getSoapSystemIdentities(diagnoses: Diagnosis[]) {
  const identities = new Map<string, { systemId: string; systemLabel: string }>();
  for (const diagnosis of diagnoses) {
    const systemLabel = getSoapSystemLabel(diagnosis);
    if (!systemLabel) continue;
    const systemId = diagnosis.systemId ?? buildLegacySoapSystemId(systemLabel);
    identities.set(systemId, { systemId, systemLabel });
  }
  return Array.from(identities.values());
}

function getSoapInitialDocument(
  soapNote: SoapNote | undefined,
  diagnoses: Diagnosis[],
): SoapBlockDocumentV2 {
  return createSoapBlockDocumentV2({
    defaultBlocks: createLegacySoapTemplateBlocks(soapNote),
    document: soapNote?.blockDocument,
    systemIdentities: getSoapSystemIdentities(diagnoses),
  });
}

function snapshotSoapBlocks(blocks: readonly ChartSoapBlock[]) {
  return JSON.parse(JSON.stringify(blocks)) as unknown[];
}

function getDemoActorHeader(session: AuthSession | null) {
  return getDemoActorHeaders(session);
}

async function loadChartSoapNote({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartSoapNoteRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/soap-notes?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartSoapNoteRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartSoapNote({
  actorHeaders,
  blockDocument,
  encounterId,
  expectedUpdatedAt,
  mode,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  blockDocument: SoapBlockDocument;
  encounterId: string;
  expectedUpdatedAt?: string | null;
  mode: "autosave" | "manual_save";
  workspaceId: string;
}): Promise<ChartSoapNoteRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/soap-notes`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": createChartSoapRequestId(),
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          encounterId,
          expectedUpdatedAt,
          mode,
          blockDocument,
        }),
      },
    );
    const body = (await response.json()) as ChartSoapNoteRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function createChartSoapRequestId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `chart-soap-${randomId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

async function loadChartCompletion({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartCompletionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/completion?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartCompletionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartDiagnoses({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartDiagnosisRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/diagnoses?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartDiagnosisRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartDiagnosesRoute({
  actorHeaders,
  diagnoses,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  diagnoses: EditableDiagnosis[];
  encounterId: string;
  workspaceId: string;
}): Promise<ChartDiagnosisRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/diagnoses`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          encounterId,
          diagnoses: diagnoses.map((diagnosis, index) => ({
            id: diagnosis.id,
            diagnosisCatalogId: diagnosis.diagnosisCatalogId,
            diagnosisText: diagnosis.diagnosisText,
            diagnosisType: diagnosis.diagnosisType,
            isClosed: Boolean(diagnosis.closedAt),
            isPrimary: diagnosis.isPrimary,
            sortOrder: index,
          })),
        }),
      },
    );
    const body = (await response.json()) as ChartDiagnosisRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadChartOrderDraft({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderDraftRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-drafts?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderDraftRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return {
      ...body,
      etag: body.etag ?? response.headers.get("etag") ?? undefined,
    };
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartLiveQueue({
  actorHeaders,
  date,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  date: string;
  workspaceId: string;
}): Promise<ChartLiveQueueResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/live-queue?date=${encodeURIComponent(date)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartLiveQueueResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartOrderCatalog({
  actorHeaders,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  workspaceId: string;
}): Promise<ChartOrderCatalogRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog?mode=chart-search`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderCatalogRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartOrderSetPreview({
  actorHeaders,
  encounterId,
  orderSetId,
  revisionId,
  selectionIntent,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  orderSetId: string;
  revisionId: string;
  selectionIntent: ChartOrderSetSelectionIntent;
  workspaceId: string;
}): Promise<ChartOrderSetPreviewRouteResponse> {
  try {
    const params = new URLSearchParams({
      encounterId,
      revisionId,
      selectionIntent: JSON.stringify(selectionIntent),
    });
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets/${encodeURIComponent(orderSetId)}/expand?${params.toString()}`,
      { cache: "no-store", headers: actorHeaders },
    );
    const body = (await response.json()) as ChartOrderSetPreviewRouteResponse;
    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "preview_failed" };
    }
    return body;
  } catch {
    return { ok: false, status: 500, error: "preview_failed" };
  }
}

function getChartOrderSetSelectionIntentForDraftRow(
  row: ChartOrderDraftRow,
): ChartOrderSetSelectionIntent | undefined {
  if (row.setSelectionIntent) return row.setSelectionIntent;

  const runtime = row.runtimeRow;
  const runtimeIntent = runtime
    ? readChartOrderSetSelectionIntent(
        runtime.appliedSnapshot.selectionIntent ??
          runtime.calculationInputs.selectionIntent,
      )
    : undefined;
  if (runtimeIntent) return runtimeIntent;

  const preview = row.setPreview;
  if (!preview) return undefined;

  return {
    items: preview.items.map((item) => ({
      revisionItemId: item.revisionItemId,
      selected: item.selected,
      quantity: item.quantity,
    })),
    ...(preview.pricing.rangeInput === null
      ? {}
      : { rangeInput: preview.pricing.rangeInput }),
  };
}

async function saveChartOrderDraftRoute({
  actorHeaders,
  encounterId,
  expectedEtag,
  primaryVeterinarianId,
  removedOrderIds = [],
  rows,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  expectedEtag: string;
  primaryVeterinarianId?: string;
  removedOrderIds?: string[];
  rows: ChartOrderDraftRow[];
  workspaceId: string;
}): Promise<ChartOrderDraftRouteResponse> {
  if (!/^"[0-9a-f]{64}"$/.test(expectedEtag)) {
    return { ok: false, status: 428, error: "if_match_required" };
  }
  let draftRows: ChartOrderDraftRowInput[];
  try {
    draftRows = rows.flatMap<ChartOrderDraftRowInput>((row) => {
      if (isChartOrderConfirmedRow(row)) return [];
      // Children are server-expanded rows. Sending them back as individual
      // draft inputs would lose the set parent/child discriminator on retry.
      if (row.runtimeRow?.rowType === "set_child") return [];

      // RPC rows are upserts, not a replacement list. Re-submitting an
      // untouched row would rebase its pinned snapshot (or reject a paused
      // source). Keep it locally and submit only new/edited roots; a changed
      // set child still requires its parent and the complete child inputs.
      if (
        row.runtimeRow &&
        !isChartOrderDraftRowDirty(row) &&
        !rows.some(
          (child) =>
            child.runtimeRow?.rowType === "set_child" &&
            child.runtimeRow.parentOrderId === row.order.id &&
            isChartOrderDraftRowDirty(child),
        )
      ) return [];

      const isSet =
        row.runtimeRow?.rowType === "set" ||
        row.catalogSearchRow?.rowType === "set" ||
        Boolean(row.setPreview);
      if (isSet) {
        const selectionIntent = getChartOrderSetSelectionIntentForDraftRow(row);
        const sourceSetId =
          row.runtimeRow?.sourceSetId ??
          row.catalogSearchRow?.sourceSetId ??
          row.catalogSearchRow?.sourcePresetId;
        const sourceSetRevisionId =
          row.runtimeRow?.sourceSetRevisionId ??
          row.catalogSearchRow?.sourceSetRevisionId;
        const sourceSetRevisionNo =
          row.runtimeRow?.sourceSetRevisionNo ??
          row.catalogSearchRow?.sourceSetRevisionNo;
        if (
          !selectionIntent ||
          !sourceSetId ||
          !sourceSetRevisionId ||
          typeof sourceSetRevisionNo !== "number"
        ) {
          throw new Error("order_set_preview_required");
        }
        const persistedChildInputs = rows
          .filter(
            (candidate) =>
              candidate.runtimeRow?.rowType === "set_child" &&
              candidate.runtimeRow.parentOrderId === row.order.id &&
              Boolean(candidate.runtimeRow.sourceSetRevisionItemId),
          )
          .map((candidate) => ({
            revisionItemId: candidate.runtimeRow?.sourceSetRevisionItemId ?? "",
            detailInputs: mergeChartOrderRuntimeDetailInputs({
              clinicalOrderType: candidate.runtimeRow?.clinicalOrderType,
              detailInputs: candidate.detailInputs,
              primaryVeterinarianId,
            }),
            detailSchemaVersion: candidate.detailSchemaVersion,
            priority: candidate.priority,
          }));
        const childInputs =
          persistedChildInputs.length > 0
            ? persistedChildInputs
            : (row.setPreview?.items ?? [])
                .filter((item) => item.selected)
                .map((item) => ({
                  revisionItemId: item.revisionItemId,
                  detailInputs: mergeChartOrderRuntimeDetailInputs({
                    clinicalOrderType: isClinicalOrderType(
                      item.appliedSnapshot?.clinicalOrderType,
                    )
                      ? item.appliedSnapshot.clinicalOrderType
                      : undefined,
                    detailInputs: readCatalogDefaultDetailInputs(item),
                    primaryVeterinarianId,
                  }),
                  detailSchemaVersion: 1,
                  priority: "normal" as const,
                }));
        return [
          {
            rowType: "set" as const,
            orderId: row.order.id,
            sourceSetId,
            sourceSetRevisionId,
            sourceSetRevisionNo,
            selectionIntent,
            childInputs,
            detailInputs: row.detailInputs,
            detailSchemaVersion: row.detailSchemaVersion,
            priority: row.priority,
          },
        ];
      }

      return [
        {
          rowType: "individual" as const,
          orderId: row.order.id,
          workspaceCatalogItemId: getChartOrderDraftCatalogItemId(row),
          quantity: getDraftQuantity(row.quantityInput) ?? 0,
          detailInputs: mergeChartOrderRuntimeDetailInputs({
            clinicalOrderType:
              row.runtimeRow?.clinicalOrderType ??
              row.catalogSearchRow?.clinicalOrderType,
            detailInputs: row.detailInputs,
            primaryVeterinarianId,
          }),
          detailSchemaVersion: row.detailSchemaVersion,
          priority: row.priority,
        },
      ];
    });
  } catch {
    return { ok: false, status: 422, error: "order_set_preview_required" };
  }

  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-drafts`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [chartOrderExpectedEtagHeader]: expectedEtag,
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          encounterId,
          expectedEtag,
          removedOrderIds,
          rows: draftRows,
        }),
      },
    );
    const body = (await response.json()) as ChartOrderDraftRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function getChartOrderDraftCatalogItemId(row: ChartOrderDraftRow) {
  return (
    row.catalogSearchRow?.workspaceCatalogItemId ??
    row.catalogSearchRow?.appliedSnapshot.workspaceCatalogItemId ??
    row.order.workspaceCatalogItemId ??
    row.order.serviceItemId ??
    row.order.id
  );
}

function matchesPersistedConfirmationDraft({
  desiredRows,
  orderIds,
  persistedRows,
}: {
  desiredRows: ChartOrderDraftRow[];
  orderIds: string[];
  persistedRows: ChartOrderRuntimeRow[];
}) {
  const desiredDraftRows = desiredRows.filter(
    (row) =>
      !isChartOrderConfirmedRow(row) && row.runtimeRow?.rowType !== "set_child",
  );
  if (
    desiredDraftRows.some(
      (row) =>
        row.runtimeRow?.rowType === "set" ||
        row.catalogSearchRow?.rowType === "set" ||
        Boolean(row.setPreview),
    )
  ) {
    return false;
  }
  const persistedDraftRows = persistedRows.filter(
    (row) =>
      row.rowType !== "set_child" &&
      (row.orderConfirmationStatus === undefined ||
        row.orderConfirmationStatus === "draft" ||
        row.orderConfirmationStatus === "pending"),
  );
  if (desiredDraftRows.length !== persistedDraftRows.length) return false;

  const desiredById = new Map(
    desiredDraftRows.map((row) => [row.order.id, row]),
  );
  const persistedById = new Map(
    persistedDraftRows.map((row) => [row.orderId, row]),
  );
  if (orderIds.some((orderId) => !desiredById.has(orderId))) return false;

  return desiredDraftRows.every((desired) => {
    const orderId = desired.order.id;
    const persisted = persistedById.get(orderId);
    if (
      !persisted ||
      persisted.rowType !== "individual" ||
      (persisted.orderConfirmationStatus !== undefined &&
        persisted.orderConfirmationStatus !== "draft" &&
        persisted.orderConfirmationStatus !== "pending")
    ) {
      return false;
    }

    return (
      persisted.workspaceCatalogItemId ===
        getChartOrderDraftCatalogItemId(desired) &&
      persisted.quantity === (getDraftQuantity(desired.quantityInput) ?? 0) &&
      persisted.detailSchemaVersion === desired.detailSchemaVersion &&
      persisted.priority === desired.priority &&
      JSON.stringify(persisted.detailInputs) ===
        JSON.stringify(desired.detailInputs)
    );
  });
}

function matchesPersistedConfirmationResult({
  orderIds,
  result,
}: {
  orderIds: string[];
  result: ChartOrderActionRouteResponse;
}) {
  if (!result.ok || orderIds.length === 0) return false;

  const confirmedOrderIds = new Set(
    (result.rows ?? [])
      .filter(
        (row) =>
          row.orderConfirmationStatus === "confirmed" ||
          row.status === "confirmed",
      )
      .map((row) => row.orderId),
  );

  return orderIds.every((orderId) => confirmedOrderIds.has(orderId));
}

async function loadChartOrderActions({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderActionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-actions?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderActionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return {
      ...body,
      etag: body.etag ?? response.headers.get("etag") ?? undefined,
    };
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartOrderLifecycles({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderLifecycleRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-lifecycle?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderLifecycleRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartOrderExecution({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderExecutionReadRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-execution?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body =
      (await response.json()) as ChartOrderExecutionReadRouteResponse;
    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }
    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartBillingCandidates({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartBillingCandidateRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/invoice-candidates?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartBillingCandidateRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartOrderActionRoute({
  actualRecords,
  action,
  actorHeaders,
  encounterId,
  expectedEtag,
  idempotencyKey,
  orderIds,
  workspaceId,
}: {
  actualRecords?: ChartActualRecords;
  action: ChartOrderActionKind;
  actorHeaders?: Record<string, string>;
  encounterId: string;
  expectedEtag?: string;
  idempotencyKey?: string;
  orderIds: string[];
  workspaceId: string;
}): Promise<ChartOrderActionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-actions`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [chartOrderExpectedEtagHeader]: expectedEtag ?? "",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          actualRecords,
          action,
          encounterId,
          expectedEtag: expectedEtag ?? "",
          idempotencyKey,
          orderIds,
        }),
      },
    );
    const body = (await response.json()) as ChartOrderActionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadChartOrderBillingSummaryRoute({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderBillingSummaryRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-billing-summary?encounterId=${encodeURIComponent(encounterId)}`,
      { cache: "no-store", headers: actorHeaders },
    );
    const body =
      (await response.json()) as ChartOrderBillingSummaryRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function saveChartOrderPrebillingOverrideRoute({
  actorHeaders,
  encounterId,
  expectedVersion,
  idempotencyKey,
  orderId,
  override,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  expectedVersion: number;
  idempotencyKey: string;
  orderId: string;
  override: ChartOrderPrebillingOverridePatch;
  workspaceId: string;
}): Promise<ChartOrderPrebillingOverrideRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-prebilling-overrides`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          encounterId,
          expectedVersion,
          idempotencyKey,
          orderId,
          override,
        }),
      },
    );
    const body =
      (await response.json()) as ChartOrderPrebillingOverrideRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function loadChartOrderIntendedAssigneesRoute({
  actorHeaders,
  orderId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  orderId: string;
  workspaceId: string;
}): Promise<ChartOrderIntendedAssigneesRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/orders/${encodeURIComponent(orderId)}/intended-assignee`,
      { cache: "no-store", headers: actorHeaders },
    );
    const body =
      (await response.json()) as ChartOrderIntendedAssigneesRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function saveChartOrderIntendedAssigneeRoute({
  actorHeaders,
  expectedOrderUpdatedAt,
  idempotencyKey,
  intendedAssigneeUserId,
  orderId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  expectedOrderUpdatedAt: string;
  idempotencyKey: string;
  intendedAssigneeUserId: string | null;
  orderId: string;
  workspaceId: string;
}): Promise<ChartOrderIntendedAssigneeSaveRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/orders/${encodeURIComponent(orderId)}/intended-assignee`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          expectedOrderUpdatedAt,
          idempotencyKey,
          intendedAssigneeUserId,
        }),
      },
    );
    const body =
      (await response.json()) as ChartOrderIntendedAssigneeSaveRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function saveChartOrderActualDispenseRoute({
  actorHeaders,
  actualQuantity,
  expectedOrderUpdatedAt,
  idempotencyKey,
  orderId,
  reason,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  actualQuantity: number;
  expectedOrderUpdatedAt: string;
  idempotencyKey: string;
  orderId: string;
  reason: string | null;
  workspaceId: string;
}): Promise<ChartOrderActualDispenseSaveRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/orders/${encodeURIComponent(orderId)}/actual-dispense`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          actualQuantity,
          expectedOrderUpdatedAt,
          idempotencyKey,
          reason,
        }),
      },
    );
    const body =
      (await response.json()) as ChartOrderActualDispenseSaveRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function requestChartOrderBillingRoute({
  acknowledgeUnfinished,
  actorHeaders,
  encounterId,
  expectedEtag,
  idempotencyKey,
  workspaceId,
}: {
  acknowledgeUnfinished: boolean;
  actorHeaders?: Record<string, string>;
  encounterId: string;
  expectedEtag: string;
  idempotencyKey: string;
  workspaceId: string;
}): Promise<ChartOrderBillingSummaryRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-billing-summary`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "if-match": expectedEtag,
          ...actorHeaders,
        },
        body: JSON.stringify({
          acknowledgeUnfinished,
          encounterId,
          expectedEtag,
          idempotencyKey,
        }),
      },
    );
    const body =
      (await response.json()) as ChartOrderBillingSummaryRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function saveChartOrderExecutionMutationRoute({
  action,
  actorHeaders,
  changes,
  expectedRevisionNo,
  idempotencyKey,
  orderId,
  reason,
  workspaceId,
}: {
  action: ChartOrderExecutionMutationAction;
  actorHeaders?: Record<string, string>;
  changes: Record<string, unknown>;
  expectedRevisionNo: number;
  idempotencyKey: string;
  orderId: string;
  reason: string;
  workspaceId: string;
}): Promise<ChartOrderExecutionMutationRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-execution-mutations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          action,
          changes,
          expectedRevisionNo,
          idempotencyKey,
          orderId,
          reason,
        }),
      },
    );
    const body =
      (await response.json()) as ChartOrderExecutionMutationRouteResponse;
    return body.ok
      ? { ...body, status: 200 }
      : { ...body, status: response.status };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

async function completeChartRoute({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartCompletionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/completion`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({ encounterId }),
      },
    );
    const body = (await response.json()) as ChartCompletionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function mutateConsultationFlowRoute({
  action,
  actorHeaders,
  encounterId,
  roomId,
  workspaceId,
}: {
  action: "call" | "start" | "return_to_waiting";
  actorHeaders?: Record<string, string>;
  encounterId: string;
  roomId?: string;
  workspaceId: string;
}): Promise<ConsultationFlowRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/consultation-flow`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          action,
          encounterId,
          ...(roomId ? { roomId } : {}),
        }),
      },
    );
    const body = (await response.json()) as ConsultationFlowRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function cancelEncounterRoute({
  actorHeaders,
  cancelReason,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  cancelReason: string;
  encounterId: string;
  workspaceId: string;
}): Promise<EncounterCancelRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}/cancel`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({ cancelReason }),
      },
    );
    const body = (await response.json()) as EncounterCancelRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function SoapPanel({
  actorHeaders,
  collapseContentId,
  diagnoses,
  encounterId,
  loading,
  onCollapse,
  onPersistedSoapNote,
  soapNote,
  writeDisabled,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  collapseContentId: string;
  diagnoses: Diagnosis[];
  encounterId: string;
  loading: boolean;
  onCollapse: () => void;
  onPersistedSoapNote: (soapNote: SoapNote) => void;
  soapNote?: SoapNote;
  writeDisabled: boolean;
  workspaceId: string;
}) {
  const [soapDocument, setSoapDocument] = useState<SoapBlockDocumentV2>(() =>
    getSoapInitialDocument(soapNote, diagnoses),
  );
  const soapDocumentRef = useRef(soapDocument);
  const [editorVersion, setEditorVersion] = useState(0);
  const [activeSoapId, setActiveSoapId] = useState<string>(
    SOAP_DEFAULT_SCOPE_KEY,
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [saveState, setSaveState] = useState<SoapSaveState>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const locallyEditedRef = useRef(false);
  const saveAfterEditorReadyRef = useRef(false);
  const lastSavedUpdatedAtRef = useRef<string | null>(null);
  const lastHydratedUpdatedAtRef = useRef<string | null>(
    soapNote?.updatedAt ?? null,
  );
  const diagnosisSystemIdentities = useMemo(
    () => getSoapSystemIdentities(diagnoses),
    [diagnoses],
  );
  const diagnosisSystemTabs = useMemo(() => {
    const tabs = new Map<
      string,
      { id: string; label: string; systemId: string }
    >();
    for (const identity of diagnosisSystemIdentities) {
      const id = buildSystemSoapScopeKey(identity.systemId);
      tabs.set(id, { id, label: identity.systemLabel, systemId: identity.systemId });
    }
    for (const scope of soapDocument.scopes) {
      if (
        scope.scope !== "system" ||
        !scope.systemId ||
        !hasMeaningfulSoapScopeContent(scope)
      ) {
        continue;
      }
      tabs.set(scope.scopeKey, {
        id: scope.scopeKey,
        label: scope.systemLabel,
        systemId: scope.systemId,
      });
    }
    return Array.from(tabs.values());
  }, [diagnosisSystemIdentities, soapDocument.scopes]);
  const visibleSystemTabs = diagnosisSystemTabs.slice(
    0,
    SOAP_VISIBLE_SYSTEM_TAB_COUNT,
  );
  const overflowSystemTabs = diagnosisSystemTabs.slice(
    SOAP_VISIBLE_SYSTEM_TAB_COUNT,
  );
  const resolvedActiveSoapId =
    activeSoapId === SOAP_DEFAULT_SCOPE_KEY ||
    diagnosisSystemTabs.some((tab) => tab.id === activeSoapId)
      ? activeSoapId
      : SOAP_DEFAULT_SCOPE_KEY;
  const activeInOverflow = overflowSystemTabs.some(
    (tab) => tab.id === resolvedActiveSoapId,
  );
  const soapTabItems = [
    { value: SOAP_DEFAULT_SCOPE_KEY, label: "기본 S/O" },
    ...visibleSystemTabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
    })),
  ];
  const activeSystemTab = diagnosisSystemTabs.find(
    (tab) => tab.id === resolvedActiveSoapId,
  );
  const activeScope = getSoapDocumentScope(soapDocument, resolvedActiveSoapId);
  const editorContent = (activeScope?.blocks ??
    (activeSystemTab
      ? createSystemSoapTemplateBlocks(activeSystemTab.label)
      : createLegacySoapTemplateBlocks(soapNote))) as ChartSoapPartialBlock[];

  const coordinator = useMemo(
    () =>
      new SoapAutosaveCoordinator({
        expectedUpdatedAt: null,
        request: async ({ document, expectedUpdatedAt, mode }) => {
          const result = await saveChartSoapNote({
            actorHeaders,
            blockDocument: document,
            encounterId,
            expectedUpdatedAt,
            mode,
            workspaceId,
          });

          if (!result.ok || !result.soapNote) {
            return result.ok
              ? { ok: false, status: 500, error: "db_write_failed" }
              : result;
          }

          return {
            ok: true,
            soapNote: result.soapNote,
            auditRecorded: result.auditRecorded ?? true,
          };
        },
        reconcileConflict: async ({ document }) => {
          const latest = await loadChartSoapNote({
            actorHeaders,
            encounterId,
            workspaceId,
          });
          if (
            !latest.ok ||
            !latest.soapNote?.blockDocument ||
            !areSoapBlockDocumentsEqual(latest.soapNote.blockDocument, document)
          ) {
            return null;
          }

          return {
            ok: true,
            soapNote: latest.soapNote,
            auditRecorded: false,
          };
        },
        onPersisted: () => undefined,
        onStateChange: () => undefined,
      }),
    [actorHeaders, encounterId, workspaceId],
  );

  useEffect(() => {
    coordinator.setCallbacks(
      (savedSoapNote) => {
        lastSavedUpdatedAtRef.current = savedSoapNote.updatedAt;
        onPersistedSoapNote(savedSoapNote);
      },
      (state, result) => {
        setSaveState(state);
        if (state === "error") {
          const failedResult = result && !result.ok ? result : undefined;
          setSaveErrorMessage(
            failedResult?.denialReason === "permission_missing"
              ? "SOAP 저장 권한이 없어 서버에 반영하지 못했습니다."
              : "입력한 내용은 화면에 남아 있지만 서버에 저장되지 않았습니다.",
          );
        } else {
          setSaveErrorMessage(null);
        }
      },
    );
  }, [coordinator, onPersistedSoapNote]);

  useEffect(() => () => coordinator.dispose(), [coordinator]);

  useEffect(() => {
    coordinator.setExpectedUpdatedAt(soapNote?.updatedAt ?? null);

    if (
      !soapNote?.updatedAt ||
      soapNote.updatedAt === lastHydratedUpdatedAtRef.current ||
      soapNote.updatedAt === lastSavedUpdatedAtRef.current ||
      locallyEditedRef.current
    ) {
      return;
    }

    lastHydratedUpdatedAtRef.current = soapNote.updatedAt;
    const nextDocument = getSoapInitialDocument(soapNote, diagnoses);
    soapDocumentRef.current = nextDocument;
    setSoapDocument(nextDocument);
    setEditorVersion((current) => current + 1);
  }, [coordinator, diagnoses, soapNote]);

  useEffect(() => {
    const reconciled = createSoapBlockDocumentV2({
      defaultBlocks: createLegacySoapTemplateBlocks(soapNote),
      document: soapDocumentRef.current,
      systemIdentities: diagnosisSystemIdentities,
    });
    if (areSoapBlockDocumentsEqual(reconciled, soapDocumentRef.current)) return;
    soapDocumentRef.current = reconciled;
    setSoapDocument(reconciled);
    setEditorVersion((current) => current + 1);
  }, [diagnosisSystemIdentities, soapNote]);

  const mergeActiveScope = useCallback(
    (blocks: readonly ChartSoapBlock[]) => {
      const nextDocument = replaceSoapDocumentScope({
        blocks: snapshotSoapBlocks(blocks),
        document: soapDocumentRef.current,
        scopeKey: resolvedActiveSoapId,
        systemId: activeSystemTab?.systemId,
        systemLabel: activeSystemTab?.label ?? "기본 SOAP",
      });
      soapDocumentRef.current = nextDocument;
      setSoapDocument(nextDocument);
      return nextDocument;
    },
    [activeSystemTab?.label, activeSystemTab?.systemId, resolvedActiveSoapId],
  );

  const handleEditorReady = useCallback(
    (blocks: readonly ChartSoapBlock[]) => {
      if (saveAfterEditorReadyRef.current) {
        saveAfterEditorReadyRef.current = false;
        locallyEditedRef.current = true;
        coordinator.change(mergeActiveScope(blocks));
      } else {
        coordinator.hydrate(soapDocumentRef.current);
      }
    },
    [coordinator, mergeActiveScope],
  );

  const handleDocumentChange = useCallback(
    (blocks: readonly ChartSoapBlock[]) => {
      if (writeDisabled) return;
      locallyEditedRef.current = true;
      coordinator.change(mergeActiveScope(blocks));
    },
    [coordinator, mergeActiveScope, writeDisabled],
  );

  const confirmReset = () => {
    if (writeDisabled) return;
    const resetBlocks = activeSystemTab
      ? createSystemSoapTemplateBlocks(activeSystemTab.label)
      : createLegacySoapTemplateBlocks(null);
    const nextDocument = replaceSoapDocumentScope({
      blocks: resetBlocks,
      document: soapDocumentRef.current,
      scopeKey: resolvedActiveSoapId,
      systemId: activeSystemTab?.systemId,
      systemLabel: activeSystemTab?.label ?? "기본 SOAP",
    });
    soapDocumentRef.current = nextDocument;
    setSoapDocument(nextDocument);
    saveAfterEditorReadyRef.current = true;
    setEditorVersion((current) => current + 1);
    setResetDialogOpen(false);
    toast.success(
      `${activeSystemTab?.label ?? "기본 SOAP"} 템플릿으로 초기화했습니다.`,
    );
  };

  const activeStatusText = loading
    ? "SOAP 정보를 불러오는 중"
    : saveState === "saving"
      ? "자동저장 중"
      : saveState === "saved"
        ? "저장됨"
        : saveState === "saved_with_warning"
          ? "SOAP 저장됨 · 변경 이력 기록 확인 필요"
          : saveState === "conflict"
            ? "저장 충돌"
            : saveState === "error"
              ? "저장 실패"
              : getSoapSectionStatusText(
                  soapNote?.status,
                  soapNote?.signedAt ??
                    soapNote?.autosavedAt ??
                    soapNote?.updatedAt,
                );

  return (
    <section
      data-slot="chart-workspace-panel"
      className={chartWorkspacePanelClassName}
    >
      <div className="relative z-30 flex h-[38px] min-h-[38px] shrink-0 items-center justify-between gap-3 px-3 pt-2 pb-0.5">
        <h2
          aria-label="Subject/Object"
          className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold leading-5 text-foreground"
        >
          <span>Subject/Object</span>
          <span
            aria-hidden="true"
            className="truncate emr-text-micro font-normal text-muted-foreground"
          >
            {activeStatusText}
          </span>
        </h2>
        <ChartPanelActionGroup>
          <ChartPanelCollapseButton
            contentId={collapseContentId}
            label="S/O"
            onCollapse={onCollapse}
            panelId="soap"
          />
          <ChartPanelIconButton label="패널 확대 준비 중" disabled />
          <ChartPanelIconButton
            label="SOAP 저장"
            disabled={writeDisabled}
            onClick={() => coordinator.saveNow()}
          >
            <CdsActionsSaveIcon />
          </ChartPanelIconButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="SOAP 작업"
                  className="size-7 rounded-lg text-muted-foreground"
                >
                  <CdsFilesMoreHorizontalIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="h-8 cursor-pointer"
                disabled={writeDisabled}
                onClick={() => setResetDialogOpen(true)}
              >
                <CdsActionsRotateCcwIcon data-icon="inline-start" />
                기본 템플릿으로 초기화
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="h-8" disabled>
                이미지 · 동영상 연동 준비 중
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ChartPanelActionGroup>
      </div>

      <div
        data-slot="chart-soap-toolbar"
        className="relative z-20 flex h-11 min-h-11 shrink-0 items-stretch border-b border-[var(--emr-border-default)] px-3"
      >
        <div className="relative z-20 flex min-w-0 flex-1 items-stretch gap-2.5">
          <ChartLineTabGroup
            aria-label="SOAP 분류"
            items={soapTabItems}
            value={resolvedActiveSoapId}
            onValueChange={setActiveSoapId}
          />
          {overflowSystemTabs.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="SOAP 더보기"
                aria-pressed={activeInOverflow}
                className={cn(
                  "inline-flex h-full shrink-0 items-center gap-1 px-2 emr-text-body font-semibold outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
                  activeInOverflow
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                더보기
                <Badge variant="outline" className="ml-1 px-1.5 text-[10px]">
                  {overflowSystemTabs.length}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {overflowSystemTabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    className="h-8 cursor-pointer"
                    onClick={() => setActiveSoapId(tab.id)}
                  >
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {soapNote?.blockDocumentError === "invalid_stored_document" ? (
        <EmrInlineAlert
          severity="warning"
          title="저장된 블록 문서를 열 수 없어 기존 SOAP 내용으로 복원했습니다"
          className="mx-3 my-2 w-auto shrink-0 emr-text-metadata"
          testId="chart-soap-document-recovery-warning"
        >
          현재 화면의 내용을 확인한 뒤 저장하면 지원되는 문서 형식으로 다시
          기록됩니다.
        </EmrInlineAlert>
      ) : null}

      {saveState === "conflict" ? (
        <div
          role="alert"
          className="border-b border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-4 py-2 text-sm text-[var(--emr-status-warning-text)]"
        >
          다른 탭이나 사용자가 먼저 SOAP를 저장했습니다. 현재 입력은 이 화면에
          유지됩니다. 서버 최신본을 확인하기 전에는 자동으로 덮어쓰지 않습니다.
        </div>
      ) : null}

      {saveState === "saved_with_warning" ? (
        <EmrInlineAlert
          severity="warning"
          title="SOAP는 저장되었지만 변경 이력 기록을 확인해야 합니다"
          className="mx-3 my-2 w-auto shrink-0 emr-text-metadata"
          testId="chart-soap-audit-warning"
        >
          임상 기록은 서버에 반영되었습니다. 중복 저장하지 말고 관리자에게 변경
          이력 상태를 확인해 주세요.
        </EmrInlineAlert>
      ) : null}

      {saveState === "error" ? (
        <EmrInlineAlert
          severity="error"
          title="SOAP를 저장하지 못했습니다"
          className="mx-3 my-2 w-auto shrink-0 emr-text-metadata"
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={writeDisabled}
              onClick={() => coordinator.retry()}
            >
              다시 저장
            </Button>
          }
          testId="chart-soap-save-error"
        >
          {saveErrorMessage ??
            "입력한 내용은 화면에 남아 있지만 서버에 저장되지 않았습니다."}
        </EmrInlineAlert>
      ) : null}

      {loading ? (
        <div className="border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] px-4 py-2">
          <ChartPanelPendingState
            title="SOAP 정보를 불러오는 중"
            description="기록 영역은 유지하면서 최신 SOAP 내용을 확인하고 있습니다."
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--emr-surface-panel)]">
        <span className="sr-only" aria-live="polite">
          {activeStatusText}
        </span>
        <ChartSoapLiveBlockEditor
          key={`${encounterId}-${resolvedActiveSoapId}-${editorVersion}`}
          allowSoapTemplateCommands={false}
          disabled={writeDisabled}
          initialContent={editorContent}
          onDocumentChange={handleDocumentChange}
          onNotice={(message) => toast.info(message)}
          onReady={handleEditorReady}
        />
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <EmrConfirmDialogContent
          title={`${activeSystemTab?.label ?? "기본 SOAP"} 템플릿으로 초기화`}
          description="현재 탭의 주관적, 객관적, 평가, 계획 내용을 빈 템플릿으로 바꾸고 자동저장합니다. 다른 탭의 내용은 유지됩니다."
          cancelLabel="취소"
          confirmLabel="초기화"
          confirmDisabled={writeDisabled}
          onCancel={() => setResetDialogOpen(false)}
          onConfirm={confirmReset}
        />
      </Dialog>
    </section>
  );
}
function AssessmentPanel({
  classificationCatalog,
  classificationCatalogDiseaseGroups,
  classificationCatalogError,
  classificationCatalogNextCursor,
  classificationCatalogStatus,
  classificationCatalogSystems,
  collapseContentId,
  diagnosisRows,
  loading,
  onCollapse,
  onDiagnosisRowsChange,
  saveStatusText,
  searchClassificationCatalog,
  setDiagnosisRows,
  soapNote,
  writeDisabled,
}: {
  classificationCatalog: DiagnosisCatalogItem[];
  classificationCatalogDiseaseGroups: AssessmentClassificationCatalogPage["diseaseGroups"];
  classificationCatalogError?: string;
  classificationCatalogNextCursor: string | null;
  classificationCatalogStatus: AssessmentClassificationCatalogStatus;
  classificationCatalogSystems: AssessmentClassificationCatalogPage["systems"];
  collapseContentId: string;
  diagnosisRows: EditableDiagnosis[];
  loading: boolean;
  onCollapse: () => void;
  onDiagnosisRowsChange: (rows: EditableDiagnosis[]) => void;
  saveStatusText: string;
  searchClassificationCatalog: (
    query: DiagnosisCatalogClientQuery,
    signal: AbortSignal,
  ) => Promise<DiagnosisCatalogClientResult>;
  setDiagnosisRows: Dispatch<SetStateAction<EditableDiagnosis[]>>;
  soapNote?: SoapNote;
  writeDisabled: boolean;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [classificationSearchOpen, setClassificationSearchOpen] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const diagnosisSystems = useMemo(
    () =>
      Array.from(
        new Set([
          ...classificationCatalog.map((item) => item.systemLabel),
          ...diagnosisRows.map((diagnosis) => diagnosis.systemLabel),
        ]),
      ),
    [classificationCatalog, diagnosisRows],
  );
  const searchResults = useMemo(
    () =>
      getDiagnosisSearchResults(
        searchQuery,
        classificationCatalog,
        soapNote,
      ).filter(
        (item) =>
          selectedSystem === "all" || item.systemLabel === selectedSystem,
      ),
    [classificationCatalog, searchQuery, selectedSystem, soapNote],
  );
  const visibleDiagnosisRows = useMemo(
    () =>
      diagnosisRows.filter(
        (diagnosis) =>
          selectedSystem === "all" || diagnosis.systemLabel === selectedSystem,
      ),
    [diagnosisRows, selectedSystem],
  );
  const normalizedSearchQuery = normalizeDiagnosisQuery(searchQuery);
  const canAddFreeText =
    normalizedSearchQuery.length > 0 &&
    !classificationCatalog.some(
      (item) => normalizeDiagnosisQuery(item.name) === normalizedSearchQuery,
    );
  const resultModeLabel = normalizedSearchQuery
    ? "검색 결과"
    : "SOAP/주호소 기반 추천";
  const commitDiagnosisRows = (nextRows: EditableDiagnosis[]) => {
    if (writeDisabled) return;
    setDiagnosisRows(nextRows);
    onDiagnosisRowsChange(nextRows);
  };

  const addDiagnosisFromCatalog = (item: DiagnosisCatalogItem) => {
    if (diagnosisRows.some((row) => row.diagnosisText === item.name)) return;

    commitDiagnosisRows([
      ...diagnosisRows,
      {
        catalogMatched: true,
        createdAt: new Date().toISOString(),
        createdByUserId: "user-vet-suji",
        diagnosisCatalogId: item.id,
        diagnosisText: item.name,
        diagnosisType: item.defaultType,
        encounterId: soapNote?.encounterId ?? "session-only-encounter",
        id: `diagnosis-session-${item.id}`,
        isPrimary: diagnosisRows.length === 0,
        sortOrder: diagnosisRows.length,
        systemLabel: item.systemLabel,
      },
    ]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const addFreeTextDiagnosis = () => {
    const diagnosisText = searchQuery.trim();
    if (!diagnosisText) return;

    if (
      diagnosisRows.some(
        (row) =>
          normalizeDiagnosisQuery(row.diagnosisText) === normalizedSearchQuery,
      )
    ) {
      return;
    }

    commitDiagnosisRows([
      ...diagnosisRows,
      {
        catalogMatched: false,
        createdAt: new Date().toISOString(),
        createdByUserId: "user-vet-suji",
        diagnosisText,
        diagnosisType: "suspected",
        encounterId: soapNote?.encounterId ?? "session-only-encounter",
        id: `diagnosis-session-free-${normalizedSearchQuery.replace(/\s+/g, "-")}`,
        isPrimary: diagnosisRows.length === 0,
        sortOrder: diagnosisRows.length,
        systemLabel: getDiagnosisSystemLabel({
          createdAt: "",
          createdByUserId: "",
          diagnosisText,
          diagnosisType: "suspected",
          encounterId: "",
          id: "",
        }),
      },
    ]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const setConfirmedDiagnosis = (diagnosisId: string, checked: boolean) => {
    commitDiagnosisRows(
      diagnosisRows.map((row) =>
        row.id === diagnosisId
          ? {
              ...row,
              diagnosisType: checked
                ? "confirmed"
                : row.diagnosisType === "confirmed"
                  ? "suspected"
                  : row.diagnosisType,
            }
          : row,
      ),
    );
  };

  const setPrimaryDiagnosis = (diagnosisId: string, checked: boolean) => {
    commitDiagnosisRows(
      diagnosisRows.map((row) =>
        row.id === diagnosisId ? { ...row, isPrimary: checked } : row,
      ),
    );
  };

  const setClosedDiagnosis = (diagnosisId: string, checked: boolean) => {
    commitDiagnosisRows(
      diagnosisRows.map((row) =>
        row.id === diagnosisId
          ? {
              ...row,
              closedAt: checked
                ? (row.closedAt ?? new Date().toISOString())
                : undefined,
              closedByUserId: checked
                ? (row.closedByUserId ?? row.createdByUserId)
                : undefined,
            }
          : row,
      ),
    );
  };

  const removeDiagnosis = (diagnosisId: string) => {
    commitDiagnosisRows(diagnosisRows.filter((row) => row.id !== diagnosisId));
  };

  const classificationInitialSelection = useMemo(() => {
    const catalogById = new Map(
      classificationCatalog.map((item) => [item.id, item]),
    );

    return diagnosisRows.flatMap<AssessmentClassificationSelection>((row) => {
      if (!row.diagnosisCatalogId) return [];
      const catalogItem = catalogById.get(row.diagnosisCatalogId) ?? {
        id: row.diagnosisCatalogId,
        name: row.diagnosisText,
        systemLabel: row.systemLabel,
        categoryLabel: row.diseaseGroupLabel ?? "",
        synonyms: [],
        defaultType: row.diagnosisType,
      };

      return [
        {
          ...catalogItem,
          diagnosisType: row.diagnosisType,
          isPrimary: row.isPrimary,
        },
      ];
    });
  }, [classificationCatalog, diagnosisRows]);

  const applyDiagnosesFromClassification = (
    selections: AssessmentClassificationSelection[],
  ) => {
    const existingByCatalogId = new Map(
      diagnosisRows.flatMap((row) =>
        row.diagnosisCatalogId ? [[row.diagnosisCatalogId, row] as const] : [],
      ),
    );
    const toDiagnosisRow = (
      item: AssessmentClassificationSelection,
    ): EditableDiagnosis => {
      const existing = existingByCatalogId.get(item.id);
      if (existing) {
        return {
          ...existing,
          diagnosisType: item.diagnosisType,
          isPrimary: item.isPrimary,
        };
      }

      return {
        catalogMatched: true,
        createdAt: new Date().toISOString(),
        createdByUserId: "user-vet-suji",
        diagnosisCatalogId: item.id,
        diagnosisText: item.name,
        diagnosisType: item.diagnosisType,
        diseaseGroupLabel: item.categoryLabel,
        encounterId: soapNote?.encounterId ?? "session-only-encounter",
        id: `diagnosis-session-${item.id}`,
        isPrimary: item.isPrimary,
        sortOrder: 0,
        systemLabel: item.systemLabel,
      };
    };
    let selectionIndex = 0;
    const nextRows: EditableDiagnosis[] = [];

    diagnosisRows.forEach((row) => {
      if (!row.diagnosisCatalogId) {
        nextRows.push(row);
        return;
      }
      const selection = selections[selectionIndex];
      selectionIndex += 1;
      if (selection) nextRows.push(toDiagnosisRow(selection));
    });
    selections
      .slice(selectionIndex)
      .forEach((selection) => nextRows.push(toDiagnosisRow(selection)));

    const orderedRows = nextRows.map((row, index) => ({
      ...row,
      sortOrder: index,
    }));
    const currentFingerprint = diagnosisRows.map((row) => [
      row.id,
      row.diagnosisCatalogId,
      row.diagnosisType,
      row.isPrimary,
      row.sortOrder,
    ]);
    const nextFingerprint = orderedRows.map((row) => [
      row.id,
      row.diagnosisCatalogId,
      row.diagnosisType,
      row.isPrimary,
      row.sortOrder,
    ]);
    if (JSON.stringify(currentFingerprint) !== JSON.stringify(nextFingerprint))
      commitDiagnosisRows(orderedRows);
  };

  return (
    <section
      aria-label="진단명 관리"
      data-slot="chart-workspace-panel"
      className={chartWorkspacePanelClassName}
    >
      <div className="flex h-[38px] min-h-[38px] shrink-0 items-center justify-between gap-3 px-3 pt-2 pb-0.5">
        <h2 className="truncate text-sm font-semibold leading-5 text-foreground">
          Assessment
        </h2>
        <span className="sr-only" aria-live="polite">
          <span data-testid="chart-diagnosis-save-status">
            {saveStatusText}
          </span>
        </span>
        <ChartPanelActionGroup>
          <ChartPanelCollapseButton
            contentId={collapseContentId}
            label="Assessment"
            onCollapse={onCollapse}
            panelId="assessment"
          />
          <ChartPanelActions />
        </ChartPanelActionGroup>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--emr-surface-panel)]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            data-slot="chart-assessment-toolbar"
            className="grid h-11 shrink-0 grid-cols-[auto_minmax(0,1fr)_1px_66px] items-center gap-2.5 border-b border-[var(--emr-border-default)] px-3 py-2"
          >
            <Select
              value={selectedSystem}
              onValueChange={(value) => value && setSelectedSystem(value)}
            >
              <SelectTrigger
                aria-label="진단계통 필터"
                size="sm"
                className="w-fit min-w-24 rounded-lg bg-card px-2 emr-control-text-compact"
              >
                <SelectValue>
                  {selectedSystem === "all" ? "계통 전체" : selectedSystem}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value="all">계통 전체</SelectItem>
                  {diagnosisSystems.map((systemLabel) => (
                    <SelectItem key={systemLabel} value={systemLabel}>
                      {systemLabel}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Popover
              open={searchOpen}
              onOpenChange={(open) => !writeDisabled && setSearchOpen(open)}
            >
              <PopoverTrigger
                nativeButton={false}
                render={<div className="relative min-w-0 w-full" />}
              >
                <CdsActionsSearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={searchInputRef}
                  aria-label="진단명 검색"
                  autoComplete="off"
                  disabled={writeDisabled}
                  placeholder="키워드를 입력해주세요"
                  value={searchQuery}
                  className="h-7 rounded-lg bg-card px-2 pr-8 emr-control-text-compact"
                  onFocus={() => setSearchOpen(true)}
                  onValueChange={(value) => {
                    setSearchQuery(value);
                    setSearchOpen(true);
                  }}
                />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-72 w-[var(--anchor-width)] gap-1 overflow-y-auto p-1.5"
                initialFocus={false}
              >
                <div className="px-2 py-1 emr-text-micro font-semibold text-muted-foreground">
                  {resultModeLabel}
                </div>
                <div
                  role="listbox"
                  aria-label="진단명 검색 결과"
                  className="grid gap-1"
                >
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={diagnosisRows.some(
                        (row) => row.diagnosisText === item.name,
                      )}
                      disabled={writeDisabled}
                      className="grid gap-1 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)] aria-selected:bg-[var(--emr-state-selected)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addDiagnosisFromCatalog(item)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {item.systemLabel}
                        </Badge>
                        <span className="truncate emr-text-dense font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="shrink-0 emr-text-micro text-muted-foreground">
                          {diagnosisTypeLabel[item.defaultType]}
                        </span>
                      </span>
                      <span className="truncate emr-text-micro text-muted-foreground">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                  {canAddFreeText ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      disabled={writeDisabled}
                      className="rounded-md border border-dashed border-[var(--emr-border-default)] px-2.5 py-2 text-left emr-text-dense transition-colors hover:bg-[var(--emr-state-hover)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={addFreeTextDiagnosis}
                    >
                      <span className="font-semibold">
                        ‘{searchQuery.trim()}’ 직접 추가
                      </span>
                      <span className="mt-0.5 block emr-text-micro text-muted-foreground">
                        카탈로그 미연결 진단명으로 이 차트에만 표시
                      </span>
                    </button>
                  ) : null}
                  {!searchResults.length && !canAddFreeText ? (
                    <div className="px-2.5 py-3 emr-text-metadata text-muted-foreground">
                      표시할 추천 진단명이 없습니다.
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
            <Separator
              orientation="vertical"
              className="h-[18px] self-center"
              style={{ alignSelf: "center" }}
            />
            <Button
              variant="outline"
              size="xs"
              className="h-7 rounded-lg bg-card px-2 text-xs"
              disabled={writeDisabled}
              onClick={() => {
                setSearchOpen(false);
                setClassificationSearchOpen(true);
              }}
            >
              분류 검색
            </Button>
          </div>
          {saveStatusText === "저장 실패" ? (
            <EmrInlineAlert
              severity="error"
              title="진단명을 저장하지 못했습니다"
              className="mx-3 mt-2 w-auto shrink-0 emr-text-metadata"
              testId="chart-diagnosis-save-error"
            >
              변경 내용은 화면에 남아 있지만 서버에는 반영되지 않았습니다.
              권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.
            </EmrInlineAlert>
          ) : null}
          <div className="min-h-0 min-w-0 flex-1 bg-[var(--emr-surface-panel)]">
            <ChartAssessmentTable
              diagnoses={visibleDiagnosisRows}
              loading={loading}
              writeDisabled={writeDisabled}
              getVeterinarianName={(userId) =>
                getChartStaffName(userId) ?? "미정"
              }
              onConfirmedChange={setConfirmedDiagnosis}
              onPrimaryChange={setPrimaryDiagnosis}
              onClosedChange={setClosedDiagnosis}
              onRemove={removeDiagnosis}
              loadingState={
                <ChartPanelPendingState
                  title="진단명 정보를 불러오는 중"
                  description="진단 목록과 확정 상태를 확인하고 있습니다."
                />
              }
              emptyState={
                <EmrEmptyState
                  kind="no-data"
                  priority="supporting"
                  surface="table"
                  title={
                    diagnosisRows.length
                      ? "선택한 진단계통에 등록된 진단이 없습니다"
                      : "진단 입력 전입니다"
                  }
                  description={
                    diagnosisRows.length
                      ? "다른 진단계통을 선택하거나 진단명을 추가해 주세요."
                      : "검색창에서 현재 차트에 필요한 진단명을 추가해 주세요."
                  }
                  testId="chart-assessment-empty-state"
                />
              }
            />
          </div>
        </div>
      </div>
      <AssessmentClassificationSearchDialog
        catalog={classificationCatalog}
        catalogErrorMessage={classificationCatalogError}
        catalogStatus={classificationCatalogStatus}
        diseaseGroups={classificationCatalogDiseaseGroups}
        initialSelection={classificationInitialSelection}
        nextCursor={classificationCatalogNextCursor}
        open={classificationSearchOpen}
        systems={classificationCatalogSystems}
        writeDisabled={writeDisabled}
        onComplete={applyDiagnosesFromClassification}
        onOpenChange={setClassificationSearchOpen}
        onSearchCatalog={searchClassificationCatalog}
      />
    </section>
  );
}

type ChartOrderTableRow = {
  groupTitle: string;
  order: EmrOrder;
};

type ChartOrderDraftRow = ChartOrderTableRow & {
  billingCandidateId?: string | null;
  billingCandidateStatus?:
    | "candidate_created"
    | "billing_review_required"
    | "invoice_linked"
    | "cancelled";
  billingName: string;
  committedBillingName: string;
  committedQuantityInput: string;
  catalogSearchRow?: ChartOrderCatalogSearchRow;
  detailInputs: Record<string, unknown>;
  detailSchemaVersion: number;
  executionTask?: ChartOrderExecutionTask;
  priority: ClinicalOrderPriority;
  runtimeRow?: ChartOrderRuntimeRow;
  setChildIncluded?: boolean;
  setSelectionIntent?: ChartOrderSetSelectionIntent;
  setPreview?: ChartOrderSetPreview;
  quantityInput: string;
  unitPrice?: number | null;
};

type ChartOrderSelectionCohort = "draft" | "confirmed";

type ChartOrderInlineFieldColumn = {
  displayOrder: number;
  key: string;
  label: string;
};

const chartOrderInlineFieldColumns = (() => {
  const columns = new Map<string, ChartOrderInlineFieldColumn>();
  for (const clinicalOrderType of CLINICAL_ORDER_TYPES) {
    for (const definition of [...CLINICAL_ORDER_FIELD_SCHEMAS[clinicalOrderType].fields,
      ...(getClinicalOrderFieldSchema(clinicalOrderType, 2)?.fields ?? [])]) {
      if (definition.placement !== "inline") continue;
      const current = columns.get(definition.key);
      if (current) {
        current.displayOrder = Math.min(
          current.displayOrder,
          definition.displayOrder,
        );
        continue;
      }
      columns.set(definition.key, {
        displayOrder: definition.displayOrder,
        key: definition.key,
        label: definition.label,
      });
    }
  }
  return Array.from(columns.values()).sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      left.label.localeCompare(right.label, "ko-KR"),
  );
})();

const chartOrderFieldOptionLabels: Record<string, string> = {
  blood: "혈액",
  serum: "혈청",
  plasma: "혈장",
  urine: "소변",
  feces: "분변",
  swab: "면봉",
  tissue: "조직",
  patient: "환자 기준",
  kg: "체중 기준",
  body_surface_area: "체표면적 기준",
  tablet: "정",
  capsule: "캡슐",
  drop: "방울",
  pipette: "피펫",
  application: "회분",
  spray: "회 분사",
  before_meal: "식전",
  after_meal: "식후",
  with_meal: "식사와 함께",
  any_time: "시간 무관",
  room_temp: "실온",
  room_temp_light_protected: "실온·차광",
  refrigerated: "냉장",
  refrigerated_light_protected: "냉장·차광",
  transdermal: "경피",
  oromucosal: "구강점막",
  inhalation: "흡입",
  nasal: "비강",
  once: "1회",
  sid: "SID",
  bid: "BID",
  tid: "TID",
  qid: "QID",
  prn: "필요 시",
  custom: "직접 입력",
  now: "즉시",
  scheduled: "예약",
  standard: "표준",
  enhanced: "강화",
  intensive: "집중",
  isolation: "격리",
  other: "기타",
  preparation: "준비",
  procedure: "처치·시술",
  surgery: "수술",
  dental: "치과 처치",
  administration: "투여",
  device_session: "장비 세션",
  measurement: "측정",
  monitoring: "관찰·모니터링",
  session: "회",
  load: "적재 회차",
  not_applicable: "해당 없음",
  separate_medication_order: "별도 약품 오더 연결",
  direct_quantity: "재료·용액 사용량 직접 계획",
};

function getChartOrderClinicalType(row: ChartOrderDraftRow) {
  return (
    row.runtimeRow?.clinicalOrderType ??
    getChartOrderCanonicalDefaults(row.order).clinicalOrderType
  );
}

function isChartOrderConfirmedRow(row: ChartOrderDraftRow) {
  const confirmationStatus = row.runtimeRow?.orderConfirmationStatus;
  if (confirmationStatus) return confirmationStatus !== "draft";
  return [
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "re_requested",
  ].includes(row.order.status);
}

function getChartOrderSelectionCohort(
  row: ChartOrderDraftRow,
): ChartOrderSelectionCohort {
  return isChartOrderConfirmedRow(row) ? "confirmed" : "draft";
}

function isChartOrderTopLevelRow(row: ChartOrderDraftRow) {
  return row.runtimeRow?.rowType !== "set_child";
}

function getChartOrderFieldValue(
  row: ChartOrderDraftRow,
  definition: ClinicalOrderFieldDefinition,
) {
  return row.detailInputs[definition.key];
}

function formatChartOrderFieldValue(
  value: unknown,
  definition: ClinicalOrderFieldDefinition,
) {
  if (value === null || value === undefined || value === "") return "미설정";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) return value.length ? `${value.length}개` : "—";
  const formatted = chartOrderFieldOptionLabels[String(value)] ?? String(value);
  return definition.unit ? `${formatted}${definition.unit}` : formatted;
}

function getChartOrderSetPreviewItemDisplayName(
  item: ChartOrderSetPreviewItem,
) {
  const snapshot = item.appliedSnapshot;
  if (!snapshot) return item.workspaceCatalogItemId;
  const displayName = [
    snapshot.appliedDisplayName,
    snapshot.inHospitalOrderName,
    snapshot.standardOrderName,
    snapshot.displayName,
  ].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return displayName ?? item.workspaceCatalogItemId;
}

function isChartOrderSetChildIncluded(child: ChartOrderDraftRow) {
  if (child.runtimeRow?.rowType !== "set_child") return true;
  if (child.setChildIncluded !== undefined) return child.setChildIncluded;
  return child.runtimeRow.appliedSnapshot.selected !== false;
}

type ChartOrderSortKey =
  | "groupTitle"
  | "orderType"
  | "status"
  | "displayName"
  | "billingName"
  | "chargeAmount"
  | "quantity"
  | "unitPrice"
  | "lineTotal"
  | "requestedBy";

type ChartOrderSortState = {
  direction: "asc" | "desc";
  key: ChartOrderSortKey;
} | null;

const chartOrderSortLabels: Record<ChartOrderSortKey, string> = {
  billingName: "청구서명",
  chargeAmount: "청구금액",
  displayName: "Order 명",
  groupTitle: "그룹",
  lineTotal: "합계",
  orderType: "분류",
  quantity: "수량",
  requestedBy: "수의사",
  status: "상태",
  unitPrice: "단가",
};

const chartOrderStatusOrder: EmrOrderStatus[] = [
  "requested",
  "re_requested",
  "in_progress",
  "confirmed",
  "completed",
  "cancelled",
];

const CHART_ORDER_SCROLL_COLUMN_WIDTH_PX = 137.25;
const chartOrderColumnOrder: ColumnOrderState = [
  "select",
  "orderType",
  "status",
  "displayName",
  "billingName",
  "billingReflection",
  "durationDays",
  "frequency",
  "totalOccurrences",
  "doseBasis",
  "dosePerAdministration",
  "ingredientStrength",
  "calculatedDispenseQuantity",
  "actualDispenseQuantity",
  "storageMethod",
  "administration",
  "assignee",
  "unitPrice",
  "quantity",
  "lineTotal",
  "adjustmentAmount",
  "adjustmentPercent",
  "chargeAmount",
  "adjustmentReason",
  "taxClass",
  "requestedBy",
];
const chartOrderColumnPinning: ColumnPinningState = {
  left: ["select", "orderType", "status", "displayName"],
  right: [],
};
const chartOrderColumnVisibility = {
  groupTitle: false,
  instruction: false,
  priority: false,
  ...Object.fromEntries(
    chartOrderInlineFieldColumns.map((field) => [`detail-${field.key}`, false]),
  ),
};

function getChartOrderCanonicalDefaults(order: EmrOrder) {
  const categoryGroup: ServiceItemType =
    order.categoryGroup ??
    (order.orderType === "dispensing" ? "medication" : order.orderType);
  const immediateComplete =
    categoryGroup === "consultation" || categoryGroup === "misc";
  return resolveClinicalOrderMasterContract({
    categoryGroup,
    defaultDestinationModule: immediateComplete ? null : order.orderType,
    defaultTaskRequired: !immediateComplete,
    billingReflectionEnabled: true,
  });
}

const getChartOrderDraftRows = (
  orderGroups: ChartOrderGroup[],
): ChartOrderDraftRow[] =>
  orderGroups.flatMap(({ group, orders }) =>
    orders.map((order) => {
      const invoiceLine = getChartInvoiceLineByOrderId(order.id);
      const quantityInput = String(invoiceLine?.quantity ?? 1);
      const billingName = invoiceLine?.description ?? order.displayName;
      const canonical = getChartOrderCanonicalDefaults(order);

      return {
        billingName,
        committedBillingName: billingName,
        committedQuantityInput: quantityInput,
        detailInputs: {},
        detailSchemaVersion: canonical.detailSchemaVersion,
        groupTitle: group?.title ?? "개별 오더",
        order,
        priority: order.priority === "urgent" ? "urgent" : "normal",
        quantityInput,
        unitPrice: invoiceLine?.unitPrice,
      };
    }),
  );

const applyPersistedOrderDrafts = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderRuntimeRow[],
  workspaceId: string,
  options: { preserveMissingRows?: boolean } = {},
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(
    snapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );
  const snapshotRows = snapshots.map((snapshot, index) => {
    const fallback = rows.find((row) => row.order.id === snapshot.orderId);
    return buildChartOrderDraftRowFromRuntime(
      snapshot,
      workspaceId,
      fallback,
      rows.length + index + 1,
    );
  });
  const restoredOrderIds = new Set(snapshotRows.map((row) => row.order.id));
  const preservedRows = options.preserveMissingRows
    ? rows.filter((row) => !restoredOrderIds.has(row.order.id))
    : [];

  // Keep the server's discriminated runtime rows as the source of truth. A
  // set parent and its selected children therefore remain separate rows after
  // reload, while a legacy/individual row keeps the existing chart shape.
  return [...preservedRows, ...snapshotRows].filter(
    (row) => options.preserveMissingRows || snapshotByOrderId.has(row.order.id),
  );
};

function buildChartOrderDraftRowFromRuntime(
  snapshot: ChartOrderRuntimeRow,
  workspaceId: string,
  fallback: ChartOrderDraftRow | undefined,
  sortOrder: number,
): ChartOrderDraftRow {
  const applied = snapshot.appliedSnapshot ?? {};
  const getString = (...keys: string[]) =>
    keys
      .map((key) => applied[key])
      .find((value): value is string => typeof value === "string");
  const getNumber = (...keys: string[]) =>
    keys
      .map((key) => applied[key])
      .find((value): value is number => typeof value === "number");
  const rowType = snapshot.rowType;
  const displayName =
    getString(
      "displayName",
      "appliedDisplayName",
      "inHospitalOrderName",
      "standardOrderName",
      "appliedStandardOrderName",
    ) ??
    fallback?.order.displayName ??
    snapshot.orderId;
  const billingName =
    getString("billingName", "appliedBillingName") ??
    fallback?.billingName ??
    displayName;
  const orderType =
    snapshot.orderType === "set"
      ? "treatment"
      : (snapshot.orderType as EmrOrderType);
  const status = chartOrderStatusOrder.includes(
    snapshot.status as EmrOrderStatus,
  )
    ? (snapshot.status as EmrOrderStatus)
    : (fallback?.order.status ?? "requested");
  const setPreview =
    rowType === "set"
      ? (fallback?.setPreview ?? buildChartOrderSetPreviewFromRuntime(snapshot))
      : undefined;
  const setSelectionIntent =
    rowType === "set"
      ? (readChartOrderSetSelectionIntent(
          applied.selectionIntent ?? snapshot.calculationInputs.selectionIntent,
        ) ??
        (setPreview
          ? {
              items: setPreview.items.map((item) => ({
                revisionItemId: item.revisionItemId,
                selected: item.selected,
                quantity: item.quantity,
              })),
              ...(setPreview.pricing.rangeInput === null
                ? {}
                : { rangeInput: setPreview.pricing.rangeInput }),
            }
          : undefined))
      : undefined;
  const order: EmrOrder = {
    ...(fallback?.order ?? {}),
    id: snapshot.orderId,
    workspaceId,
    encounterId: snapshot.encounterId,
    serviceItemId:
      rowType === "individual" ? fallback?.order.serviceItemId : undefined,
    workspaceCatalogItemId: snapshot.workspaceCatalogItemId ?? undefined,
    sourceMasterRecordId:
      getString("sourceMasterRecordId") ?? fallback?.order.sourceMasterRecordId,
    sourceMasterRevision:
      getNumber("sourceMasterRevision") ?? fallback?.order.sourceMasterRevision,
    workspaceCatalogRevision:
      snapshot.workspaceCatalogRevision ??
      fallback?.order.workspaceCatalogRevision,
    categoryGroup:
      (getString("categoryGroup") as EmrOrder["categoryGroup"] | undefined) ??
      fallback?.order.categoryGroup,
    billingCategory:
      (getString("billingCategory") as
        EmrOrder["billingCategory"] | undefined) ??
      fallback?.order.billingCategory,
    unitPriceSnapshot: snapshot.unitPriceSnapshot,
    appliedSnapshot: applied,
    orderType,
    displayName,
    status,
    workStatus: status === "completed" ? "completed" : "pending",
    priority: snapshot.priority,
    requestedByUserId: fallback?.order.requestedByUserId ?? "",
    requestedAt: fallback?.order.requestedAt ?? snapshot.updatedAt,
    instruction:
      getString("internalInstruction", "appliedInternalInstruction") ??
      fallback?.order.instruction,
    sortOrder,
    createdAt: fallback?.order.createdAt ?? snapshot.updatedAt,
    updatedAt: snapshot.updatedAt,
  };
  const quantityInput = String(snapshot.quantity);

  return {
    ...(fallback ?? {}),
    billingCandidateId: fallback?.billingCandidateId,
    billingCandidateStatus: fallback?.billingCandidateStatus,
    billingName,
    committedBillingName: billingName,
    committedQuantityInput: quantityInput,
    detailInputs: snapshot.detailInputs,
    detailSchemaVersion: snapshot.detailSchemaVersion,
    groupTitle:
      rowType === "set"
        ? "Order 세트"
        : rowType === "set_child"
          ? "Order 세트 구성"
          : (fallback?.groupTitle ?? "개별 오더"),
    order,
    priority: snapshot.priority,
    quantityInput,
    runtimeRow: snapshot,
    setChildIncluded:
      rowType === "set_child" ? applied.selected !== false : undefined,
    setPreview,
    setSelectionIntent,
    unitPrice: snapshot.unitPriceSnapshot ?? getNumber("priceKrw") ?? null,
  };
}

function readChartOrderSetSelectionIntent(
  value: unknown,
): ChartOrderSetSelectionIntent | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.items)) return undefined;
  const items = input.items
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => ({
      revisionItemId:
        typeof item.revisionItemId === "string" ? item.revisionItemId : "",
      selected: item.selected === true,
      quantity:
        typeof item.quantity === "number"
          ? item.quantity
          : Number(item.quantity),
    }))
    .filter((item) => item.revisionItemId && Number.isFinite(item.quantity));
  if (items.length !== input.items.length) return undefined;
  return typeof input.rangeInput === "number"
    ? { items, rangeInput: input.rangeInput }
    : { items };
}

function buildChartOrderSetPreviewFromRuntime(
  snapshot: ChartOrderRuntimeRow,
): ChartOrderSetPreview | undefined {
  const applied = snapshot.appliedSnapshot ?? {};
  if (
    snapshot.rowType !== "set" ||
    !snapshot.sourceSetId ||
    !snapshot.sourceSetRevisionId ||
    !Array.isArray(applied.items)
  ) {
    return undefined;
  }
  const items = applied.items as ChartOrderSetPreview["items"];
  const amountBasis = applied.amountBasis;
  if (
    amountBasis !== "included_order_sum" &&
    amountBasis !== "set_fixed_price" &&
    amountBasis !== "range_price"
  ) {
    return undefined;
  }
  const rangeBasis =
    applied.rangeBasis === "patient_weight_kg" ||
    applied.rangeBasis === "manual_value"
      ? applied.rangeBasis
      : null;
  return {
    schemaVersion: 1,
    operation: "draft",
    set: {
      sourceSetId: snapshot.sourceSetId,
      sourceSetRevisionId: snapshot.sourceSetRevisionId,
      sourceSetRevisionNo: snapshot.sourceSetRevisionNo ?? 1,
      sourceSetVersion:
        snapshot.sourceSetVersion ??
        `order-set-revision-${snapshot.sourceSetRevisionNo ?? 1}`,
      amountBasis,
      setPriceKrw: snapshot.unitPriceSnapshot,
      rangeBasis,
      taxType: applied.taxType === "non_taxable" ? "non_taxable" : "taxable",
      priceRanges: Array.isArray(applied.priceRanges)
        ? (applied.priceRanges as ChartOrderSetPreview["set"]["priceRanges"])
        : [],
      billingReflectionEnabled: snapshot.billingReflectionEnabled,
      displayName:
        typeof applied.displayName === "string"
          ? applied.displayName
          : undefined,
      billingName:
        typeof applied.billingName === "string"
          ? applied.billingName
          : undefined,
    },
    items,
    pricing: {
      selectedSetInput:
        typeof applied.rangeInput === "number" ? applied.rangeInput : null,
      selectedRangeId:
        typeof applied.selectedRangeId === "string"
          ? applied.selectedRangeId
          : null,
      rangeInput:
        typeof applied.rangeInput === "number" ? applied.rangeInput : null,
      childSubtotalKrw:
        typeof snapshot.calculationOutputs.childSubtotalKrw === "number"
          ? snapshot.calculationOutputs.childSubtotalKrw
          : 0,
      explicitExtraSubtotalKrw:
        typeof snapshot.calculationOutputs.explicitExtraSubtotalKrw === "number"
          ? snapshot.calculationOutputs.explicitExtraSubtotalKrw
          : 0,
      finalTotalKrw: snapshot.lineTotalSnapshot,
    },
    selectionFingerprint:
      typeof applied.selectionFingerprint === "string"
        ? applied.selectionFingerprint
        : "",
    calculationInputs: snapshot.calculationInputs,
    calculationOutputs: snapshot.calculationOutputs,
  };
}

const getChartCatalogSourceKey = (row: ChartOrderCatalogSearchRow) =>
  row.workspaceCatalogItemId ??
  row.appliedSnapshot.workspaceCatalogItemId ??
  row.sourcePresetId;

const getChartDraftRowCatalogSourceKey = (row: ChartOrderDraftRow) => {
  if (row.catalogSearchRow)
    return getChartCatalogSourceKey(row.catalogSearchRow);
  if (row.runtimeRow?.rowType === "set" && row.runtimeRow.sourceSetId)
    return row.runtimeRow.sourceSetId;

  const legacyCatalogId = row.order.id.match(
    /^catalog-(?:individual|set)-(.+)$/,
  );
  if (legacyCatalogId?.[1]) return legacyCatalogId[1];

  return row.order.workspaceCatalogItemId ?? row.order.serviceItemId;
};

const hasChartCatalogDraftIdentity = (row: ChartOrderDraftRow) =>
  Boolean(row.catalogSearchRow) ||
  /^catalog-(?:individual|set)-/.test(row.order.id);

const chartOrderDraftUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isChartOrderDraftUuid(value: string) {
  return chartOrderDraftUuidPattern.test(value);
}

function prepareChartOrderDraftRowsForPersistence(rows: ChartOrderDraftRow[]) {
  const orderIdMap = new Map<string, string>();
  const nextRows = rows.map((row) => {
    if (
      isChartOrderDraftUuid(row.order.id) ||
      !hasChartCatalogDraftIdentity(row)
    ) {
      return row;
    }

    const nextOrderId = createChartOrderDraftId();
    orderIdMap.set(row.order.id, nextOrderId);

    return {
      ...row,
      order: {
        ...row.order,
        id: nextOrderId,
      },
    };
  });

  return { orderIdMap, rows: nextRows };
}

function remapChartOrderIdSet(
  orderIds: Set<string>,
  orderIdMap: Map<string, string>,
) {
  if (orderIdMap.size === 0) return orderIds;

  return new Set(
    Array.from(orderIds).map((orderId) => orderIdMap.get(orderId) ?? orderId),
  );
}

const applyPersistedOrderActions = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderRuntimeRow[],
  workspaceId: string,
  legacySnapshots: ChartOrderActionSnapshot[] = [],
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(
    snapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );
  const legacySnapshotByOrderId = new Map(
    legacySnapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );

  const nextRows = rows.map((row) => {
    const candidateRuntimeSnapshot = snapshotByOrderId.get(row.order.id);
    const runtimeSnapshot =
      candidateRuntimeSnapshot?.orderConfirmationStatus === "draft"
        ? undefined
        : candidateRuntimeSnapshot;
    const legacySnapshot = legacySnapshotByOrderId.get(row.order.id);
    if (!runtimeSnapshot && !legacySnapshot) return row;

    if (runtimeSnapshot) {
      const nextRow = buildChartOrderDraftRowFromRuntime(
        runtimeSnapshot,
        workspaceId,
        row,
        rows.indexOf(row) + 1,
      );
      return {
        ...nextRow,
        order: {
          ...nextRow.order,
          requestedByUserId:
            row.order.requestedByUserId ||
            legacySnapshot?.confirmedByUserId ||
            "",
        },
        billingCandidateId:
          legacySnapshot?.billingCandidateId ?? row.billingCandidateId,
        billingCandidateStatus:
          legacySnapshot?.billingCandidateStatus === "candidate_created" ||
          legacySnapshot?.billingCandidateStatus === "invoice_linked" ||
          legacySnapshot?.billingCandidateStatus === "cancelled"
            ? legacySnapshot.billingCandidateStatus
            : row.billingCandidateStatus,
      };
    }

    return {
      ...row,
      billingCandidateId:
        legacySnapshot?.billingCandidateId === undefined
          ? row.billingCandidateId
          : legacySnapshot.billingCandidateId,
      billingCandidateStatus:
        legacySnapshot?.billingCandidateStatus === "candidate_created" ||
        legacySnapshot?.billingCandidateStatus === "invoice_linked" ||
        legacySnapshot?.billingCandidateStatus === "cancelled"
          ? legacySnapshot.billingCandidateStatus
          : row.billingCandidateStatus,
      order: {
        ...row.order,
        status: legacySnapshot?.status ?? row.order.status,
        updatedAt: legacySnapshot?.updatedAt ?? row.order.updatedAt,
      },
    };
  });

  const existingOrderIds = new Set(nextRows.map((row) => row.order.id));
  const restoredRows = snapshots
    .filter(
      (snapshot) =>
        snapshot.orderConfirmationStatus !== "draft" &&
        !existingOrderIds.has(snapshot.orderId),
    )
    .map((snapshot, index) => {
      const restoredRow = buildChartOrderDraftRowFromRuntime(
        snapshot,
        workspaceId,
        undefined,
        rows.length + index + 1,
      );
      return {
        ...restoredRow,
        order: {
          ...restoredRow.order,
          requestedByUserId:
            legacySnapshotByOrderId.get(snapshot.orderId)
              ?.confirmedByUserId || "",
        },
      };
    });

  return [...nextRows, ...restoredRows];
};

const applyPersistedOrderLifecycles = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderLifecycleSnapshot[],
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(
    snapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );

  return rows.map((row) => {
    const snapshot = snapshotByOrderId.get(row.order.id);
    if (!snapshot) return row;
    const currentStatusIndex = chartOrderStatusOrder.indexOf(row.order.status);
    const nextStatusIndex = chartOrderStatusOrder.indexOf(snapshot.status);
    if (
      currentStatusIndex >= 0 &&
      nextStatusIndex >= 0 &&
      nextStatusIndex < currentStatusIndex
    ) {
      return row;
    }

    return {
      ...row,
      order: {
        ...row.order,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
      },
    };
  });
};

const applyOrderExecutionTasks = (
  rows: ChartOrderDraftRow[],
  tasks: ChartOrderExecutionTask[],
): ChartOrderDraftRow[] => {
  const latestTaskByOrderId = new Map<string, ChartOrderExecutionTask>();
  tasks.forEach((task) => {
    const current = latestTaskByOrderId.get(task.orderId);
    if (
      !current ||
      task.attemptNo > current.attemptNo ||
      (task.attemptNo === current.attemptNo &&
        task.updatedAt > current.updatedAt)
    ) {
      latestTaskByOrderId.set(task.orderId, task);
    }
  });

  return rows.map((row) => {
    const task = latestTaskByOrderId.get(row.order.id);
    if (!task) return row;
    const status: EmrOrderStatus =
      task.status === "returned"
        ? "re_requested"
        : task.status === "complete"
        ? "completed"
        : task.status === "cancelled"
          ? "cancelled"
          : task.attemptNo > 1 && task.status === "pending"
            ? "re_requested"
            : task.status === "in_progress" ||
                task.status === "paused" ||
                task.status === "partial_complete"
              ? "in_progress"
              : "confirmed";
    return {
      ...row,
      executionTask: task,
      order: {
        ...row.order,
        priority: task.priority,
        status,
        updatedAt: task.updatedAt,
      },
      priority: task.priority,
    };
  });
};

const applyBillingCandidatesToOrderRows = (
  rows: ChartOrderDraftRow[],
  candidates: ChartBillingCandidateSnapshot[],
): ChartOrderDraftRow[] => {
  const candidateByOrderId = new Map(
    candidates.map((candidate) => [candidate.orderId, candidate]),
  );

  return rows.map((row) => {
    const candidate = candidateByOrderId.get(row.order.id);
    if (!candidate) return row;

    return {
      ...row,
      billingCandidateId: candidate.billingCandidateId,
      billingCandidateStatus: candidate.status ?? "invoice_linked",
    };
  });
};

const getChartOrderStatusLabel = (row: ChartOrderDraftRow) => {
  const task = row.executionTask;
  if (!task) return "";
  if (task.status === "returned") return "반려";
  if (task.status === "cancelled") return "취소";
  if (task.status === "paused") return "일시중지";
  if (task.status === "complete") {
    return task.clinicalOrderType === "imaging" ? "판독완" : "완료";
  }
  if (task.status === "partial_complete") return "부분완";
  if (task.status === "pending") {
    return (task.requestCycle ?? task.attemptNo) > 1 ? "재요청" : "대기";
  }
  const detailedPhaseLabels: Record<string, string> = {
    acquisition_preparing: "촬영준비",
    acquisition_completed: "촬영종료",
    interpretation_in_progress: "판독중",
    interpretation_completed: "판독완",
    inputting: "입력중",
    partial_complete: "부분완",
    dispensing: "조제중",
    treatment: "처치중",
    surgery: "수술중",
    surgery_completed: "수술완",
  };
  if (task.detailedPhase && detailedPhaseLabels[task.detailedPhase]) {
    return detailedPhaseLabels[task.detailedPhase];
  }
  if (task.clinicalOrderType === "dispensing") return "조제중";
  if (task.clinicalOrderType === "treatment") return "처치중";
  return "진행중";
};

function getChartOrderAppliedSnapshot(row: ChartOrderDraftRow) {
  return (
    row.runtimeRow?.appliedSnapshot ??
    row.catalogSearchRow?.appliedSnapshot ??
    row.order.appliedSnapshot ??
    {}
  ) as Record<string, unknown>;
}

function getChartOrderAuthority(
  row: ChartOrderDraftRow,
): PlanOrderAuthorityConfig | null {
  const parsed = parsePlanOrderAuthority(
    getChartOrderAppliedSnapshot(row).planOrderAuthority,
  );
  return parsed.valid ? parsed.value : null;
}

function getChartOrderDetailNumber(row: ChartOrderDraftRow, key: string) {
  const value = row.detailInputs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getChartOrderDetailString(row: ChartOrderDraftRow, key: string) {
  const value = row.detailInputs[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getChartOrderFrequencyCount(frequency: string | null) {
  if (frequency === "once" || frequency === "sid") return 1;
  if (frequency === "bid") return 2;
  if (frequency === "tid") return 3;
  if (frequency === "qid") return 4;
  return null;
}

function getChartOrderTotalOccurrences(row: ChartOrderDraftRow) {
  const explicit =
    getChartOrderDetailNumber(row, "totalOccurrences") ??
    getChartOrderDetailNumber(row, "maximumAuthorizedCount");
  if (explicit !== null) return explicit;
  const days = getChartOrderDetailNumber(row, "durationDays");
  const frequency = getChartOrderFrequencyCount(
    getChartOrderDetailString(row, "frequency"),
  );
  return days !== null && frequency !== null ? days * frequency : null;
}

function getChartOrderIngredientStrength(row: ChartOrderDraftRow) {
  const strength = getChartOrderAuthority(row)?.productStrength;
  return strength
    ? `${strength.numeratorValue} ${strength.numeratorUnit}/${strength.denominatorValue === 1 ? "" : `${strength.denominatorValue} `}${strength.denominatorUnit}`
    : "";
}

function getChartOrderCalculatedDispense(row: ChartOrderDraftRow) {
  const outputs = row.runtimeRow?.calculationOutputs ?? {};
  const quantity = [
    outputs.calculatedDispenseQuantity,
    outputs.theoreticalDispenseQuantity,
  ].find((value): value is number => typeof value === "number");
  const authority = getChartOrderAuthority(row);
  if (quantity !== undefined && authority?.dispenseUnit) {
    return `${quantity} ${authority.dispenseUnit}`;
  }
  return authority?.calculationMode === "not_applicable" ? "" : "계산 불가";
}

function getChartOrderActualDispense(row: ChartOrderDraftRow) {
  const outputs = row.runtimeRow?.calculationOutputs ?? {};
  const quantity = outputs.preparationSchemaVersion === 2
    ? outputs.plannedPracticalDispenseQuantity : outputs.actualDispenseQuantity;
  const unit = outputs.actualDispenseUnit;
  const precision = getChartOrderAuthority(row)?.preparationPolicy
    ?.displayPrecision;
  if (typeof quantity === "number" && Number.isFinite(quantity)) {
    const formatted = quantity.toLocaleString("ko-KR", {
      maximumFractionDigits:
        typeof precision === "number" ? precision : 6,
      minimumFractionDigits:
        typeof precision === "number" ? precision : 0,
      useGrouping: false,
    });
    const scope = outputs.preparationSchemaVersion === 2
      ? outputs.preparationQuantityScope === "course_total" ? " (전체)" : " (1회)" : "";
    return `${formatted}${typeof unit === "string" && unit ? ` ${unit}` : ""}${scope}`;
  }
  if (isChartOrderConfirmedRow(row)) return "미기록";
  if (outputs.dispenseApplicability === false) return "";
  return getChartOrderClinicalType(row) === "dispensing" ||
    outputs.dispenseApplicability === true
    ? "계산 필요"
    : "";
}

function isChartOrderActualDispenseConfirmationValid(row: ChartOrderDraftRow) {
  if (isChartOrderConfirmedRow(row) || row.runtimeRow?.rowType === "set") {
    return true;
  }
  const outputs = row.runtimeRow?.calculationOutputs ?? {};
  const applies = outputs.dispenseApplicability === true;
  if (!applies) return getChartOrderClinicalType(row) !== "dispensing";
  return (
    outputs.calculationStatus === "ready" &&
    typeof outputs.actualDispenseQuantity === "number" &&
    Number.isFinite(outputs.actualDispenseQuantity) &&
    outputs.actualDispenseQuantity > 0 &&
    outputs.requiresReconfirmation !== true
  );
}

function getChartOrderBillingReflection(row: ChartOrderDraftRow) {
  const applied = getChartOrderAppliedSnapshot(row);
  const value =
    row.runtimeRow?.billingReflectionEnabled ??
    applied.billingReflectionEnabled;
  return value === false ? "미반영" : value === true ? "반영" : "미설정";
}

function getChartOrderAdministration(row: ChartOrderDraftRow) {
  const route = getChartOrderDetailString(row, "route");
  const timing = getChartOrderDetailString(row, "medicationInstruction");
  return [route, timing ? chartOrderFieldOptionLabels[timing] ?? timing : null]
    .filter(Boolean)
    .join(" · ");
}

function getChartOrderTaxClass(row: ChartOrderDraftRow) {
  const authority = getChartOrderAuthority(row);
  if (authority?.taxClass === "taxable") return "과세";
  if (authority?.taxClass === "non_taxable") return "면세";
  const legacy = getChartOrderAppliedSnapshot(row).taxIncluded;
  if (legacy === true) return "과세";
  if (legacy === false) return "면세";
  return "미설정";
}

function getChartOrderDestinationModule(row: ChartOrderDraftRow) {
  const destination =
    row.executionTask?.destinationModule ??
    getChartOrderAppliedSnapshot(row).destinationModule;
  return typeof destination === "string" && destination.trim()
    ? destination
    : null;
}

function getChartOrderAssignee(
  row: ChartOrderDraftRow,
  eligibleAssignees: FulfillmentEligibleAssignee[] = [],
) {
  const assigneeId =
    row.executionTask?.assignedToUserId ??
    row.runtimeRow?.intendedAssigneeUserId;
  if (!getChartOrderDestinationModule(row)) return null;
  if (!assigneeId) return { id: null, name: "미지정" };
  return {
    id: assigneeId,
    name:
      row.executionTask?.assignedToDisplayName ??
      eligibleAssignees.find((candidate) => candidate.userId === assigneeId)
        ?.displayName ??
      getChartStaffName(assigneeId) ??
      "미기록",
  };
}

function getChartOrderBillingOverride(row: ChartOrderDraftRow) {
  const value =
    row.runtimeRow?.preBillingOverride ??
    getChartOrderAppliedSnapshot(row).preBillingOverride;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getChartOrderPrebillingVersion(row: ChartOrderDraftRow) {
  const value = getChartOrderBillingOverride(row).versionNo;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function isChartOrderPrebillingEditable(row: ChartOrderDraftRow) {
  return (
    isChartOrderConfirmedRow(row) &&
    row.order.status !== "cancelled" &&
    row.runtimeRow?.orderConfirmationStatus !== "billed" &&
    row.billingCandidateStatus === "candidate_created"
  );
}

function applyChartOrderPrebillingOverride(
  rows: ChartOrderDraftRow[],
  override: ChartOrderPrebillingOverride,
) {
  return rows.map((row) => {
    if (row.order.id !== override.orderId) return row;
    return {
      ...row,
      billingName: override.billingName,
      committedBillingName: override.billingName,
      committedQuantityInput: String(override.billingQuantity),
      quantityInput: String(override.billingQuantity),
      runtimeRow: row.runtimeRow
        ? {
            ...row.runtimeRow,
            billingReflectionEnabled: override.billingReflectionEnabled,
            preBillingOverride: { ...override },
          }
        : row.runtimeRow,
    };
  });
}

function applyChartOrderIntendedAssignee(
  rows: ChartOrderDraftRow[],
  state: OrderIntendedAssigneeState,
) {
  return rows.map((row) => {
    if (row.order.id !== state.orderId || !row.runtimeRow) return row;
    return {
      ...row,
      order: { ...row.order, updatedAt: state.updatedAt },
      runtimeRow: {
        ...row.runtimeRow,
        intendedAssigneeUserId: state.intendedAssigneeUserId,
        updatedAt: state.updatedAt,
      },
    };
  });
}

function applyChartOrderActualDispense(
  rows: ChartOrderDraftRow[],
  state: OrderActualDispenseState,
) {
  return rows.map((row) => {
    if (row.order.id !== state.orderId || !row.runtimeRow) return row;
    return {
      ...row,
      order: { ...row.order, updatedAt: state.updatedAt },
      runtimeRow: {
        ...row.runtimeRow,
        calculationOutputs: {
          ...row.runtimeRow.calculationOutputs,
          actualDispenseOverride: state.actualDispenseOverride,
          actualDispenseQuantity: state.actualDispenseQuantity,
          actualDispenseSource: state.actualDispenseSource,
          actualDispenseUnit: state.actualDispenseUnit,
          ...(state.preparationSchemaVersion === 2 ? {
            preparationSchemaVersion: 2,
            preparationQuantityScope: state.preparationQuantityScope,
            plannedPracticalDispenseQuantity: state.plannedPracticalDispenseQuantity,
            plannedPracticalDispenseUnit: state.actualDispenseUnit,
            plannedPracticalDispenseSource: state.actualDispenseSource,
            plannedPracticalTotalQuantity: state.plannedPracticalTotalQuantity,
            totalRequiredDispenseQuantity: state.plannedPracticalTotalQuantity,
          } : {}),
          requiresReconfirmation: state.requiresReconfirmation,
        },
        updatedAt: state.updatedAt,
      },
    };
  });
}

function getChartOrderAdjustmentAmount(row: ChartOrderDraftRow) {
  const value = getChartOrderBillingOverride(row).adjustmentAmountKrw;
  return typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
}

function getChartOrderAdjustmentPercent(row: ChartOrderDraftRow) {
  const value = getChartOrderBillingOverride(row).adjustmentPercent;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const base = getDraftLineTotal(row) ?? 0;
  return base > 0 ? (getChartOrderAdjustmentAmount(row) / base) * 100 : 0;
}

function getChartOrderChargeAmount(row: ChartOrderDraftRow) {
  if (getChartOrderBillingReflection(row) !== "반영") return 0;
  return Math.max(
    0,
    Math.round(getDraftLineTotal(row) ?? 0) + getChartOrderAdjustmentAmount(row),
  );
}

function createPlanOrderDisplayColumn({
  align = "left",
  id,
  label,
  sortableKey,
  value,
}: {
  align?: "left" | "right";
  id: string;
  label: string;
  sortableKey?: ChartOrderSortKey;
  value: (row: ChartOrderDraftRow) => string | number | null | undefined;
}): ColumnDef<ChartOrderDraftRow, unknown> {
  return {
    id,
    accessorFn: value,
    size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
    minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
    enableSorting: Boolean(sortableKey),
    header: label,
    sortingFn: sortableKey
      ? (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, sortableKey)
      : undefined,
    cell: ({ row }) => {
      const displayed = value(row.original);
      return (
        <EmrTableCellText
          mode="one-line"
          className={align === "right" ? "text-right tabular-nums" : undefined}
          fullText={displayed === null || displayed === undefined || displayed === "" ? "" : String(displayed)}
        >
          {displayed === null || displayed === undefined || displayed === ""
            ? "—"
            : typeof displayed === "number"
              ? displayed.toLocaleString("ko-KR", { maximumFractionDigits: 3 })
              : displayed}
        </EmrTableCellText>
      );
    },
    meta: {
      align,
      label,
      headerInteraction: sortableKey ? "sortable" : undefined,
      resize: "data-column",
      textMode: "one-line",
    },
  };
}

const chartOrderLegacyProjectionColumns: ColumnDef<
  ChartOrderDraftRow,
  unknown
>[] = [
  createPlanOrderDisplayColumn({
    align: "right",
    id: "durationDays",
    label: "일수",
    value: (row) => getChartOrderDetailNumber(row, "durationDays"),
  }),
  createPlanOrderDisplayColumn({
    id: "frequency",
    label: "횟수",
    value: (row) => {
      const frequency = getChartOrderDetailString(row, "frequency");
      return frequency
        ? chartOrderFieldOptionLabels[frequency] ?? frequency
        : getChartOrderDetailNumber(row, "occurrenceCount");
    },
  }),
  createPlanOrderDisplayColumn({
    align: "right",
    id: "totalOccurrences",
    label: "총횟수",
    value: getChartOrderTotalOccurrences,
  }),
  createPlanOrderDisplayColumn({
    id: "doseBasis",
    label: "head/kg당",
    value: (row) => {
      const basis = getChartOrderDetailString(row, "doseBasis");
      return basis === "patient" ? "head" : basis;
    },
  }),
  createPlanOrderDisplayColumn({
    align: "right",
    id: "dosePerAdministration",
    label: "1회당",
    value: (row) => {
      const dose = getChartOrderDetailNumber(row, "dose");
      const unit = getChartOrderDetailString(row, "doseUnit");
      return dose === null ? null : `${dose}${unit ? ` ${unit}` : ""}`;
    },
  }),
  createPlanOrderDisplayColumn({
    id: "ingredientStrength",
    label: "성분량",
    value: getChartOrderIngredientStrength,
  }),
  createPlanOrderDisplayColumn({
    align: "right",
    id: "calculatedDispenseQuantity",
    label: "조제량",
    value: getChartOrderCalculatedDispense,
  }),
  createPlanOrderDisplayColumn({
    id: "storageMethod",
    label: "보관",
    value: (row) => {
      const storage = getChartOrderDetailString(row, "storageMethod");
      return storage ? chartOrderFieldOptionLabels[storage] ?? storage : null;
    },
  }),
  createPlanOrderDisplayColumn({
    id: "administration",
    label: "투여/복약",
    value: getChartOrderAdministration,
  }),
  createPlanOrderDisplayColumn({
    align: "right",
    id: "chargeAmount",
    label: "청구금액",
    sortableKey: "chargeAmount",
    value: getChartOrderChargeAmount,
  }),
  createPlanOrderDisplayColumn({
    id: "taxClass",
    label: "과세",
    value: getChartOrderTaxClass,
  }),
];

const getDraftQuantity = (quantityInput: string) => {
  const quantity = Number(quantityInput);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
};

const getDraftLineTotal = (row: ChartOrderDraftRow) => {
  const quantity = getDraftQuantity(row.quantityInput);

  if (
    quantity === null ||
    row.unitPrice === undefined ||
    row.unitPrice === null
  )
    return undefined;

  return getChartOrderDraftAmountBasis(row) === "fixed_order_price"
    ? row.unitPrice
    : quantity * row.unitPrice;
};

const getChartOrderDraftAmountBasis = (row: ChartOrderDraftRow) => {
  const catalogBasis = row.catalogSearchRow?.appliedSnapshot.appliedAmountBasis;
  if (catalogBasis) return catalogBasis;
  const runtimeSnapshot = row.runtimeRow?.appliedSnapshot;
  const runtimeBasis =
    runtimeSnapshot?.amountBasis ?? runtimeSnapshot?.appliedAmountBasis;
  return typeof runtimeBasis === "string" ? runtimeBasis : "unit_price";
};

function getChartOrderDraftBillingProjection(rows: ChartOrderDraftRow[]) {
  const activeDraftRows = rows.filter(
    (row) => !isChartOrderConfirmedRow(row) && row.order.status !== "cancelled",
  );
  return {
    amount: activeDraftRows.reduce(
      (sum, row) => sum + getChartOrderDraftBillableAmount(row),
      0,
    ),
    rootCount: activeDraftRows.filter(isChartOrderTopLevelRow).length,
  };
}

function getChartOrderDraftBillableAmount(row: ChartOrderDraftRow) {
  if (
    row.order.status === "cancelled" ||
    row.runtimeRow?.billingEligible === false ||
    row.runtimeRow?.billingReflectionEnabled === false ||
    row.catalogSearchRow?.billingEligible === false ||
    row.catalogSearchRow?.appliedSnapshot.billingReflectionEnabled === false
  ) {
    return 0;
  }

  const rowType =
    row.runtimeRow?.rowType ?? row.catalogSearchRow?.rowType ?? "individual";
  if (rowType === "set_child") {
    return isChartOrderSetChildIncluded(row)
      ? (getDraftLineTotal(row) ?? 0)
      : 0;
  }
  if (rowType !== "set") return getDraftLineTotal(row) ?? 0;

  const amountBasis =
    row.setPreview?.set.amountBasis ??
    row.runtimeRow?.appliedSnapshot.amountBasis;
  if (amountBasis !== "included_order_sum") {
    return getDraftLineTotal(row) ?? row.setPreview?.pricing.finalTotalKrw ?? 0;
  }

  // Persisted included-order-sum sets expose their reflecting child rows.
  // Before the first save, use the preview leaves because no child rows exist.
  if (row.runtimeRow) return 0;
  return (row.setPreview?.items ?? []).reduce((sum, item) => {
    if (
      !item.selected ||
      !item.billingReflectionEnabled ||
      typeof item.priceKrw !== "number"
    ) {
      return sum;
    }
    return sum + item.priceKrw * item.quantity;
  }, 0);
}

function buildChartOrderBillingPreview({
  authoritative,
  committedRows,
  draftRows,
}: {
  authoritative: ChartOrderBillingSummary;
  committedRows: ChartOrderDraftRow[];
  draftRows: ChartOrderDraftRow[];
}) {
  const committed = getChartOrderDraftBillingProjection(committedRows);
  const current = getChartOrderDraftBillingProjection(draftRows);
  const amountDelta = current.amount - committed.amount;
  const rootCountDelta = current.rootCount - committed.rootCount;
  return {
    ...authoritative,
    amounts: {
      ...authoritative.amounts,
      draft: Math.max(0, authoritative.amounts.draft + amountDelta),
      estimatedTotal: Math.max(
        0,
        authoritative.amounts.estimatedTotal + amountDelta,
      ),
      gross: Math.max(0, authoritative.amounts.gross + amountDelta),
    },
    orderCounts: {
      ...authoritative.orderCounts,
      draft: Math.max(0, authoritative.orderCounts.draft + rootCountDelta),
      total: Math.max(0, authoritative.orderCounts.total + rootCountDelta),
    },
  } satisfies ChartOrderBillingSummary;
}

const isChartOrderDraftRowDirty = (row: ChartOrderDraftRow) =>
  row.billingName !== row.committedBillingName ||
  row.quantityInput !== row.committedQuantityInput ||
  (row.runtimeRow !== undefined &&
    (JSON.stringify(row.detailInputs) !==
      JSON.stringify(row.runtimeRow.detailInputs) ||
      row.detailSchemaVersion !== row.runtimeRow.detailSchemaVersion ||
      row.priority !== row.runtimeRow.priority)) ||
  (row.runtimeRow?.rowType === "set" &&
    JSON.stringify(row.setSelectionIntent) !==
      JSON.stringify(
        readChartOrderSetSelectionIntent(
          row.runtimeRow.appliedSnapshot.selectionIntent ??
            row.runtimeRow.calculationInputs.selectionIntent,
        ) ??
          (row.setPreview
            ? {
                items: row.setPreview.items.map((item) => ({
                  revisionItemId: item.revisionItemId,
                  selected: item.selected,
                  quantity: item.quantity,
                })),
                ...(row.setPreview.pricing.rangeInput === null
                  ? {}
                  : { rangeInput: row.setPreview.pricing.rangeInput }),
              }
            : undefined),
      ));

function getChartOrderNumericValue(
  row: ChartOrderDraftRow,
  key: "chargeAmount" | "quantity" | "unitPrice" | "lineTotal",
) {
  if (key === "chargeAmount") return getChartOrderChargeAmount(row);
  if (key === "quantity") return getDraftQuantity(row.quantityInput);
  if (key === "unitPrice") return row.unitPrice ?? null;

  return getDraftLineTotal(row) ?? null;
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  return a - b;
}

function compareChartOrderValues(
  a: ChartOrderDraftRow,
  b: ChartOrderDraftRow,
  key: ChartOrderSortKey,
) {
  if (key === "groupTitle") {
    return a.groupTitle.localeCompare(b.groupTitle, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (key === "orderType") {
    return (
      chartOrderTabs.findIndex(
        (tab) => tab.value === getChartOrderClinicalType(a),
      ) -
      chartOrderTabs.findIndex(
        (tab) => tab.value === getChartOrderClinicalType(b),
      )
    );
  }

  if (key === "status") {
    return (
      chartOrderStatusOrder.indexOf(a.order.status) -
      chartOrderStatusOrder.indexOf(b.order.status)
    );
  }

  if (key === "displayName") {
    return a.order.displayName.localeCompare(b.order.displayName, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (key === "billingName") {
    return a.billingName.localeCompare(b.billingName, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (key === "requestedBy") {
    return (
      getChartStaffName(a.order.requestedByUserId) ?? "미기록"
    ).localeCompare(
      getChartStaffName(b.order.requestedByUserId) ?? "미기록",
      "ko-KR",
      { numeric: true, sensitivity: "base" },
    );
  }

  return compareNullableNumbers(
    getChartOrderNumericValue(a, key),
    getChartOrderNumericValue(b, key),
  );
}

function ChartOrderInlineFieldCell({
  definition,
  onFlushDraft,
  onUpdateDetailInput,
  row,
  writeDisabled,
}: {
  definition?: ClinicalOrderFieldDefinition;
  onFlushDraft: () => void;
  onUpdateDetailInput: (
    orderId: string,
    fieldKey: string,
    value: unknown | undefined,
  ) => void;
  row: ChartOrderDraftRow;
  writeDisabled: boolean;
}) {
  if (!definition || row.runtimeRow?.rowType === "set") {
    return <span aria-label="해당 없음">—</span>;
  }
  const value = getChartOrderFieldValue(row, definition);
  if (definition.key === "responsibleClinicianId") {
    const clinicianId = typeof value === "string" ? value.trim() : "";
    return (
      <EmrTableCellText
        mode="one-line"
        fullText={clinicianId
          ? `${clinicianId} · 진료 담당 수의사에서 자동 결정돼요.`
          : "진료 담당 수의사가 미배정되어 있어요. 접수에서 지정한 뒤 다시 불러와 주세요."}
      >
        {clinicianId || "담당 수의사 미배정"}
      </EmrTableCellText>
    );
  }
  const editable =
    !writeDisabled &&
    !isChartOrderConfirmedRow(row) &&
    definition.preConfirmEditable;
  const ariaLabel = `${row.order.displayName} ${definition.label}`;
  if (!editable) {
    return (
      <EmrTableCellText
        mode="one-line"
        fullText={formatChartOrderFieldValue(value, definition)}
      >
        {formatChartOrderFieldValue(value, definition)}
      </EmrTableCellText>
    );
  }

  if (definition.control === "switch") {
    if (typeof value !== "boolean") return (
      <Select value={null} onValueChange={(next) => onUpdateDetailInput(row.order.id, definition.key, next === null ? undefined : next === "true")}>
        <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder="미설정" /></SelectTrigger>
        <SelectContent><SelectItem value="true">예</SelectItem><SelectItem value="false">아니오</SelectItem></SelectContent>
      </Select>
    );
    return (
      <span
        className="inline-flex min-h-7 items-center gap-2"
        data-row-interactive="true"
      >
        <Switch
          aria-label={ariaLabel}
          checked={value === true}
          size="xs"
          onCheckedChange={(checked) => {
            onUpdateDetailInput(row.order.id, definition.key, checked);
          }}
        />
        <span className="emr-text-micro text-[var(--emr-text-secondary)]">
          {value === true ? "예" : "아니오"}
        </span>
      </span>
    );
  }

  if (definition.control === "select" && definition.options.length > 0) {
    return (
      <Select
        value={typeof value === "string" && value ? value : null}
        onValueChange={(nextValue) => {
          onUpdateDetailInput(row.order.id, definition.key, nextValue);
          queueMicrotask(onFlushDraft);
        }}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          className="h-7 min-w-[112px] bg-[var(--emr-surface-panel)] px-2 emr-text-metadata"
          data-row-interactive="true"
        >
          <SelectValue placeholder="선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {definition.options.map((option) => (
              <SelectItem key={option} value={option}>
                {chartOrderFieldOptionLabels[option] ?? option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  const stringValue =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const invalid = definition.required && stringValue.trim() === "";
  return (
    <Input
      aria-label={ariaLabel}
      aria-invalid={invalid}
      className={cn(
        "h-7 min-w-[112px] bg-[var(--emr-surface-panel)] px-2 emr-text-metadata",
        definition.valueType === "number" && "text-right tabular-nums",
        invalid && "border-[var(--emr-status-danger-border)]",
      )}
      data-row-interactive="true"
      inputMode={definition.valueType === "number" ? "decimal" : undefined}
      max={definition.validation.max}
      maxLength={definition.validation.maxLength}
      min={definition.validation.min}
      step={
        definition.valueType === "number"
          ? definition.validation.precision === 0
            ? 1
            : "any"
          : undefined
      }
      type={definition.valueType === "number" ? "number" : "text"}
      value={stringValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        onUpdateDetailInput(
          row.order.id,
          definition.key,
          definition.valueType === "number"
            ? nextValue === ""
              ? undefined
              : Number(nextValue)
            : nextValue,
        );
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

const actualDispenseSuggestedReasons = [
  "계량 단위 보정",
  "제형·분할 제한",
  "희석 또는 조제 편의",
  "환자 상태에 따른 조정",
] as const;

function ChartOrderActualDispenseCell({
  disabled,
  onSave,
  row,
  saving,
}: {
  disabled: boolean;
  onSave: (actualQuantity: number, reason: string | null) => void;
  row: ChartOrderDraftRow;
  saving: boolean;
}) {
  const outputs = row.runtimeRow?.calculationOutputs ?? {};
  const authority = getChartOrderAuthority(row);
  const policy = authority?.preparationPolicy;
  const actualQuantity =
    typeof outputs.actualDispenseQuantity === "number" &&
    Number.isFinite(outputs.actualDispenseQuantity)
      ? outputs.actualDispenseQuantity
      : null;
  const proposedQuantity =
    typeof outputs.proposedActualDispenseQuantity === "number" &&
    Number.isFinite(outputs.proposedActualDispenseQuantity)
      ? outputs.proposedActualDispenseQuantity
      : null;
  const override =
    outputs.actualDispenseOverride &&
    typeof outputs.actualDispenseOverride === "object" &&
    !Array.isArray(outputs.actualDispenseOverride)
      ? (outputs.actualDispenseOverride as Record<string, unknown>)
      : null;
  const inputSource = `${actualQuantity ?? ""}:${row.runtimeRow?.updatedAt ?? ""}`;
  const canonicalInput = actualQuantity === null ? "" : String(actualQuantity);
  const [inputState, setInputState] = useState({
    source: inputSource,
    value: canonicalInput,
  });
  const input = inputState.source === inputSource ? inputState.value : canonicalInput;
  const setInput = (value: string) =>
    setInputState({ source: inputSource, value });
  const [reasonOpen, setReasonOpen] = useState(false);
  const [customReason, setCustomReason] = useState("");

  const nextQuantity = Number(input);
  const incrementValid =
    policy && Number.isFinite(nextQuantity)
      ? Math.abs(nextQuantity / policy.increment - Math.round(nextQuantity / policy.increment)) <=
        0.000000001
      : false;
  const inputValid = Boolean(
    policy &&
      nextQuantity > 0 &&
      incrementValid &&
      (policy.minimum === undefined ||
        policy.minimum === null ||
        nextQuantity >= policy.minimum) &&
      (policy.maximum === undefined ||
        policy.maximum === null ||
        nextQuantity <= policy.maximum),
  );
  const changed =
    inputValid && actualQuantity !== null && nextQuantity !== actualQuantity;
  const differsFromProposal =
    inputValid &&
    proposedQuantity !== null &&
    nextQuantity !== proposedQuantity;
  const reasonRequired = Boolean(
    differsFromProposal &&
      (policy?.noReasonTolerance === undefined ||
        policy.noReasonTolerance === null ||
        Math.abs(nextQuantity - proposedQuantity!) - policy.noReasonTolerance >
          0.000000001),
  );
  const editable = Boolean(
    !disabled &&
      !isChartOrderConfirmedRow(row) &&
      row.runtimeRow?.rowType !== "set" &&
      outputs.calculationStatus === "ready" &&
      outputs.dispenseApplicability === true &&
      policy &&
      actualQuantity !== null &&
      proposedQuantity !== null,
  );

  if (!editable) {
    const displayed = getChartOrderActualDispense(row);
    if (!override) {
      return (
        <EmrTableCellText
          mode="one-line"
          className={cn(
            "text-right tabular-nums",
            outputs.requiresReconfirmation === true &&
              "text-[var(--emr-status-warning-text)]",
          )}
          fullText={displayed}
        >
          {displayed || "—"}
        </EmrTableCellText>
      );
    }
    const reason =
      typeof override.reason === "string" && override.reason.trim()
        ? override.reason
        : "사유 없이 허용 범위 안에서 조정";
    return (
      <span className="flex min-w-0 items-center justify-end gap-1">
        <EmrTableCellText
          mode="one-line"
          className="min-w-0 text-right tabular-nums"
          fullText={displayed}
        >
          {displayed || "—"}
        </EmrTableCellText>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                aria-label={`${row.order.displayName} 준비 예정량 변경 사유`}
                size="tiny"
                type="button"
                variant="ghost"
              />
            }
          >
            <CdsContentEdit2Icon aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="emr-text-metadata font-semibold">준비 예정량 변경</p>
            <p className="emr-text-metadata text-[var(--emr-text-secondary)]">
              {reason}
            </p>
          </PopoverContent>
        </Popover>
      </span>
    );
  }

  const precision = policy?.displayPrecision ?? 6;
  const validationTitle = !inputValid
    ? `${policy!.increment} ${authority?.dispenseUnit ?? ""} 단위${
        policy!.minimum !== undefined && policy!.minimum !== null
          ? `, 최소 ${policy!.minimum}`
          : ""
      }${
        policy!.maximum !== undefined && policy!.maximum !== null
          ? `, 최대 ${policy!.maximum}`
          : ""
      } 범위로 입력해 주세요.`
    : undefined;
  return (
    <span className="flex min-w-0 items-center gap-1" data-row-interactive="true">
      <Input
        aria-label={`${row.order.displayName} 준비 예정량`}
        aria-invalid={!inputValid}
        className={cn(
          "h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right emr-text-metadata tabular-nums",
          outputs.requiresReconfirmation === true &&
            "border-[var(--emr-status-warning-border)]",
        )}
        disabled={saving}
        inputMode="decimal"
        max={policy!.maximum ?? undefined}
        min={policy!.minimum ?? policy!.increment}
        onChange={(event) => setInput(event.target.value)}
        step={policy!.increment}
        title={validationTitle ?? (outputs.preparationSchemaVersion === 2
          ? outputs.preparationQuantityScope === "course_total"
            ? "처방 전체의 준비 예정량 · 실제 조제 결과가 아님"
            : "1회 준비 예정량 · 실제 조제 결과가 아님"
          : "준비 예정량 · 실제 조제 결과가 아님")}
        type="number"
        value={input}
      />
      <Popover
        open={reasonOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReasonOpen(false);
            return;
          }
          if (!inputValid || !changed) return;
          if (!reasonRequired) {
            onSave(nextQuantity, null);
            return;
          }
          setReasonOpen(true);
        }}
      >
        <PopoverTrigger
          render={
            <Button
              aria-label={`${row.order.displayName} 준비 예정량 저장`}
              disabled={!inputValid || !changed || saving}
              size="icon-xs"
              type="button"
              variant="outline"
            />
          }
        >
          <CdsActionsCheckIcon aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <p className="emr-text-metadata font-semibold">
            준비 예정량 변경 사유가 필요해요
          </p>
          <p className="emr-text-micro text-[var(--emr-text-secondary)]">
            기준값 {proposedQuantity!.toFixed(precision)} {authority?.dispenseUnit}
          </p>
          <div className="grid gap-1">
            {actualDispenseSuggestedReasons.map((reason) => (
              <Button
                key={reason}
                className="justify-start"
                onClick={() => {
                  onSave(nextQuantity, reason);
                  setReasonOpen(false);
                }}
                size="xs"
                type="button"
                variant="ghost"
              >
                {reason}
              </Button>
            ))}
          </div>
          <Textarea
            aria-label={`${row.order.displayName} 기타 준비 예정량 변경 사유`}
            maxLength={500}
            onChange={(event) => setCustomReason(event.target.value)}
            placeholder="기타 사유를 3자 이상 입력해 주세요"
            value={customReason}
          />
          <Button
            disabled={customReason.trim().length < 3}
            onClick={() => {
              onSave(nextQuantity, customReason.trim());
              setReasonOpen(false);
            }}
            size="sm"
            type="button"
          >
            기타 사유로 저장
          </Button>
        </PopoverContent>
      </Popover>
      {override ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                aria-label={`${row.order.displayName} 준비 예정량 변경 사유`}
                size="tiny"
                type="button"
                variant="ghost"
              />
            }
          >
            <CdsContentEdit2Icon aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="emr-text-metadata font-semibold">준비 예정량 변경</p>
            <p className="emr-text-metadata text-[var(--emr-text-secondary)]">
              {typeof override.reason === "string" && override.reason.trim()
                ? override.reason
                : "사유 없이 허용 범위 안에서 조정"}
            </p>
          </PopoverContent>
        </Popover>
      ) : null}
      {outputs.requiresReconfirmation === true && proposedQuantity !== null ? (
        <Button
          aria-label={`${row.order.displayName} 자동 계산값으로 되돌리기`}
          disabled={saving}
          onClick={() => onSave(proposedQuantity, null)}
          size="tiny"
          title="자동 계산값으로 되돌리기"
          type="button"
          variant="ghost"
        >
          <CdsActionsRotateCcwIcon aria-hidden="true" />
        </Button>
      ) : null}
    </span>
  );
}

function ChartOrderTable({
  quickAdd,
  revealOrderId,
  highlightedOrderId,
  selectionActionsHidden,
  actualDispenseSavingOrderIds,
  intendedAssigneeLoadingOrderIds,
  intendedAssigneeOptionsByOrderId,
  intendedAssigneeSavingOrderIds,
  confirmationDisabled,
  density,
  executionTasks,
  hasAnyRows,
  invalidOrderIds,
  loading,
  onDeleteOrder,
  onFlushDraft,
  onAddOrder,
  onConfirmOrder,
  onConfirmSelected,
  onDeleteSelected,
  onOpenDetail,
  onOpenHistory,
  onOpenMutation,
  onLoadIntendedAssignees,
  onSaveActualDispense,
  onSavePrebillingOverride,
  onSaveIntendedAssignee,
  onSelectionChange,
  onSort,
  onToggleSetChild,
  onUpdateBillingName,
  onUpdateDetailInput,
  onUpdatePriority,
  onUpdateQuantity,
  prebillingSavingOrderIds,
  pendingRemovalOrderIds,
  rows,
  selectedOrderIds,
  sortState,
  writeDisabled,
}: {
  quickAdd?: ReactNode;
  revealOrderId?: string;
  highlightedOrderId?: string;
  selectionActionsHidden: boolean;
  actualDispenseSavingOrderIds: Set<string>;
  intendedAssigneeLoadingOrderIds: Set<string>;
  intendedAssigneeOptionsByOrderId: Record<
    string,
    FulfillmentEligibleAssignee[]
  >;
  intendedAssigneeSavingOrderIds: Set<string>;
  confirmationDisabled: boolean;
  density: EmrTableDensity;
  executionTasks: ChartOrderExecutionTask[];
  hasAnyRows: boolean;
  invalidOrderIds: Set<string>;
  loading: boolean;
  onAddOrder: () => void;
  onConfirmOrder: (orderId: string) => void;
  onConfirmSelected: () => void;
  onDeleteOrder: (orderId: string) => void;
  onDeleteSelected: (orderIds: string[]) => void;
  onFlushDraft: () => void;
  onOpenDetail: (orderId: string) => void;
  onOpenHistory: (orderId: string) => void;
  onOpenMutation: (
    orderId: string,
    action: ChartOrderExecutionMutationAction,
  ) => void;
  onLoadIntendedAssignees: (orderId: string) => void;
  onSaveActualDispense: (
    orderId: string,
    actualQuantity: number,
    reason: string | null,
  ) => void;
  onSavePrebillingOverride: (
    orderId: string,
    override: ChartOrderPrebillingOverridePatch,
  ) => void;
  onSaveIntendedAssignee: (
    orderId: string,
    intendedAssigneeUserId: string | null,
  ) => void;
  onSelectionChange: (orderIds: Set<string>) => void;
  onSort: (key: ChartOrderSortKey) => void;
  onToggleSetChild: (orderId: string) => void;
  onUpdateBillingName: (orderId: string, billingName: string) => void;
  onUpdateDetailInput: (
    orderId: string,
    fieldKey: string,
    value: unknown | undefined,
  ) => void;
  onUpdatePriority: (orderId: string, priority: ClinicalOrderPriority) => void;
  onUpdateQuantity: (orderId: string, quantityInput: string) => void;
  prebillingSavingOrderIds: Set<string>;
  pendingRemovalOrderIds: Set<string>;
  rows: ChartOrderDraftRow[];
  selectedOrderIds: Set<string>;
  sortState: ChartOrderSortState;
  writeDisabled: boolean;
}) {
  const tableHeaderHeight =
    emrTableDensityOptions.find((option) => option.value === density)
      ?.headerHeight ?? 36;
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const quickAddSurfaceRef = useRef<HTMLDivElement>(null);
  const quickAddComposerRef = useRef<HTMLDivElement>(null);
  const revealedOrderIdRef = useRef<string | undefined>(undefined);
  const showQuickAdd = hasAnyRows && !loading && Boolean(quickAdd);
  const editableCallbacksRef = useRef({
    onFlushDraft,
    onLoadIntendedAssignees,
    onSaveActualDispense,
    onSaveIntendedAssignee,
    onSavePrebillingOverride,
    onToggleSetChild,
    onUpdateBillingName,
    onUpdateDetailInput,
    onUpdatePriority,
    onUpdateQuantity,
  });
  editableCallbacksRef.current = {
    onFlushDraft,
    onLoadIntendedAssignees,
    onSaveActualDispense,
    onSaveIntendedAssignee,
    onSavePrebillingOverride,
    onToggleSetChild,
    onUpdateBillingName,
    onUpdateDetailInput,
    onUpdatePriority,
    onUpdateQuantity,
  };
  const pendingRemovalOrderIdsRef = useRef(pendingRemovalOrderIds);
  pendingRemovalOrderIdsRef.current = pendingRemovalOrderIds;
  const latestTaskByOrderId = useMemo(() => {
    const latest = new Map<string, ChartOrderExecutionTask>();
    executionTasks.forEach((task) => {
      const current = latest.get(task.orderId);
      if (!current || task.attemptNo > current.attemptNo) {
        latest.set(task.orderId, task);
      }
    });
    return latest;
  }, [executionTasks]);
  const sorting = useMemo<SortingState>(
    () =>
      sortState
        ? [{ desc: sortState.direction === "desc", id: sortState.key }]
        : [],
    [sortState],
  );
  const rowSelection = useMemo<RowSelectionState>(
    () =>
      Object.fromEntries(
        Array.from(selectedOrderIds).map((orderId) => [orderId, true]),
      ),
    [selectedOrderIds],
  );
  const handleRowSelectionChange = (updater: Updater<RowSelectionState>) => {
    const nextSelection =
      typeof updater === "function" ? updater(rowSelection) : updater;
    const eligibleRows = rows.filter(isChartOrderTopLevelRow);
    const requestedRows = eligibleRows.filter(
      (row) => nextSelection[row.order.id],
    );
    if (requestedRows.length === 0) {
      onSelectionChange(new Set());
      return;
    }
    const newlySelected = requestedRows.find(
      (row) => !selectedOrderIds.has(row.order.id),
    );
    const currentSelected = eligibleRows.find((row) =>
      selectedOrderIds.has(row.order.id),
    );
    const cohort = getChartOrderSelectionCohort(
      newlySelected ?? currentSelected ?? requestedRows[0]!,
    );
    onSelectionChange(
      new Set(
        requestedRows
          .filter((row) => getChartOrderSelectionCohort(row) === cohort)
          .map((row) => row.order.id),
      ),
    );
  };
  const handleSortingChange = (updater: Updater<SortingState>) => {
    const nextSorting =
      typeof updater === "function" ? updater(sorting) : updater;
    const nextSort = nextSorting[0];

    if (!nextSort) {
      if (sortState) onSort(sortState.key);
      return;
    }

    onSort(nextSort.id as ChartOrderSortKey);
  };
  const columns = useMemo<ColumnDef<ChartOrderDraftRow, unknown>[]>(
    () => [
      {
        id: "select",
        size: 32,
        minSize: 32,
        maxSize: 32,
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => (
          <EmrTableCheckbox
            aria-label="오더 전체 선택"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            disabled={writeDisabled || !table.getRowModel().rows.length}
            onCheckedChange={(checked) =>
              table.toggleAllRowsSelected(Boolean(checked))
            }
          />
        ),
        cell: ({ row }) => (
          <EmrTableCheckbox
            aria-label={`${row.original.order.displayName} 선택`}
            checked={row.getIsSelected()}
            disabled={
              writeDisabled ||
              pendingRemovalOrderIdsRef.current.has(row.original.order.id) ||
              !row.getCanSelect() ||
              row.original.runtimeRow?.rowType === "set_child"
            }
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
          />
        ),
        meta: {
          label: "선택",
          role: "selection",
          resize: "none",
        },
      },
      {
        id: "groupTitle",
        accessorKey: "groupTitle",
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        header: chartOrderSortLabels.groupTitle,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "groupTitle"),
        meta: {
          label: chartOrderSortLabels.groupTitle,
          headerInteraction: "sortable",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "orderType",
        accessorFn: (row) => row.order.orderType,
        size: 80,
        minSize: 80,
        maxSize: 80,
        enableResizing: false,
        header: chartOrderSortLabels.orderType,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "orderType"),
        cell: ({ row }) => {
          const clinicalOrderType = getChartOrderClinicalType(row.original);
          const label =
            row.original.runtimeRow?.rowType === "set" ||
            row.original.catalogSearchRow?.rowType === "set" ||
            Boolean(row.original.setPreview)
              ? "Order 세트"
              : row.original.runtimeRow?.rowType === "set_child"
                ? CLINICAL_ORDER_FIELD_SCHEMAS[clinicalOrderType].label
                : CLINICAL_ORDER_FIELD_SCHEMAS[clinicalOrderType].label;

          return (
            <Badge variant="outline" className="max-w-full truncate">
              {label}
            </Badge>
          );
        },
        meta: {
          label: chartOrderSortLabels.orderType,
          align: "left",
          headerInteraction: "sortable",
          resize: "none",
        },
      },
      {
        id: "status",
        accessorFn: (row) => row.order.status,
        size: 84,
        minSize: 84,
        maxSize: 84,
        enableResizing: false,
        header: chartOrderSortLabels.status,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "status"),
        cell: ({ row }) => {
          const pendingRemoval = pendingRemovalOrderIdsRef.current.has(
            row.original.order.id,
          );
          const statusLabel = pendingRemoval
            ? "삭제 중"
            : getChartOrderStatusLabel(row.original);
          if (!statusLabel) return <span aria-hidden="true" />;
          return (
            <EmrStatusBadge
              label={statusLabel}
              marker={pendingRemoval ? "icon" : "none"}
            />
          );
        },
        meta: {
          label: chartOrderSortLabels.status,
          headerInteraction: "sortable",
          resize: "none",
        },
      },
      {
        id: "displayName",
        accessorFn: (row) => row.order.displayName,
        size: 198,
        minSize: 198,
        maxSize: 198,
        enableResizing: false,
        header: chartOrderSortLabels.displayName,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "displayName"),
        cell: ({ row }) => {
          const { order } = row.original;
          const isSetChild = row.original.runtimeRow?.rowType === "set_child";
          const isSetParent = row.original.runtimeRow?.rowType === "set";
          const included = isChartOrderSetChildIncluded(row.original);
          const confirmed = isChartOrderConfirmedRow(row.original);

          return (
            <div
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                isSetChild &&
                  "pl-4 before:h-5 before:w-px before:bg-[var(--emr-border-default)]",
              )}
            >
              <EmrTableCellText
                mode="one-line"
                fullText={order.displayName}
                className={cn(
                  "font-medium",
                  isSetParent && "font-semibold",
                  isSetChild &&
                    !included &&
                    "text-[var(--emr-text-disabled)] line-through",
                )}
              >
                {order.displayName}
              </EmrTableCellText>
              {isSetChild && !confirmed ? (
                <Button
                  aria-label={`${order.displayName} 세트 ${included ? "제외" : "포함"}`}
                  aria-pressed={included}
                  className="h-5 shrink-0 rounded-full px-1.5 emr-text-micro"
                  data-row-interactive="true"
                  disabled={
                    writeDisabled ||
                    pendingRemovalOrderIdsRef.current.has(row.original.order.id)
                  }
                  size="xs"
                  variant={included ? "outline" : "ghost"}
                  onClick={() =>
                    editableCallbacksRef.current.onToggleSetChild(order.id)
                  }
                >
                  {included ? "포함" : "제외"}
                </Button>
              ) : null}
            </div>
          );
        },
        meta: {
          label: chartOrderSortLabels.displayName,
          headerInteraction: "sortable",
          resize: "none",
          textMode: "one-line",
        },
      },
      {
        id: "priority",
        accessorFn: (row) => row.priority,
        size: 92,
        minSize: 92,
        maxSize: 92,
        enableResizing: false,
        enableSorting: false,
        header: "긴급",
        cell: ({ row }) => {
          const confirmed = isChartOrderConfirmedRow(row.original);
          return (
            <span
              className="inline-flex min-h-7 items-center gap-2"
              data-row-interactive="true"
            >
              <Switch
                aria-label={`${row.original.order.displayName} 긴급`}
                checked={row.original.priority === "urgent"}
                disabled={
                  writeDisabled ||
                  confirmed ||
                  pendingRemovalOrderIdsRef.current.has(row.original.order.id)
                }
                size="xs"
                onCheckedChange={(checked) =>
                  editableCallbacksRef.current.onUpdatePriority(
                    row.original.order.id,
                    checked ? "urgent" : "normal",
                  )
                }
              />
              <span className="emr-text-micro text-[var(--emr-text-secondary)]">
                {row.original.priority === "urgent" ? "긴급" : "일반"}
              </span>
            </span>
          );
        },
        meta: {
          label: "긴급",
          resize: "none",
        },
      },
      {
        id: "instruction",
        accessorFn: (row) =>
          row.order.instruction ?? orderTypeMeta[row.order.orderType].handoff,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "지시사항",
        cell: ({ row }) => {
          const instruction =
            row.original.order.instruction ??
            orderTypeMeta[row.original.order.orderType].handoff;

          return (
            <EmrTableCellText mode="one-line" fullText={instruction}>
              {instruction}
            </EmrTableCellText>
          );
        },
        meta: {
          label: "지시사항",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      ...chartOrderInlineFieldColumns.map(
        (field): ColumnDef<ChartOrderDraftRow, unknown> => ({
          id: `detail-${field.key}`,
          accessorFn: (row) => {
            const definition =
              getClinicalOrderFieldSchema(getChartOrderClinicalType(row), row.detailSchemaVersion)?.fields.find(definition => definition.key === field.key);
            return definition ? getChartOrderFieldValue(row, definition) : null;
          },
          size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
          minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
          enableSorting: false,
          header: field.label,
          cell: ({ row }) => (
            field.key === "wardOrCage" && getChartOrderClinicalType(row.original) === "hospitalization"
              ? <Button size="tiny" variant="outline" onClick={() => onOpenDetail(row.original.order.id)}>병동·케이지 선택/보기</Button>
              : <ChartOrderInlineFieldCell
              definition={
                getClinicalOrderFieldSchema(getChartOrderClinicalType(row.original), row.original.detailSchemaVersion)?.fields.find(definition => definition.key === field.key)
              }
              onFlushDraft={() => editableCallbacksRef.current.onFlushDraft()}
              onUpdateDetailInput={(orderId, fieldKey, value) =>
                editableCallbacksRef.current.onUpdateDetailInput(
                  orderId,
                  fieldKey,
                  value,
                )
              }
              row={row.original}
              writeDisabled={
                writeDisabled ||
                pendingRemovalOrderIdsRef.current.has(row.original.order.id)
              }
            />
          ),
          meta: {
            align:
              CLINICAL_ORDER_FIELD_SCHEMAS.dispensing.fields.find(definition => definition.key === field.key)?.valueType === "number"
                ? "right"
                : "left",
            label: field.label,
            resize: "data-column",
            textMode: "one-line",
          },
        }),
      ),
      {
        id: "billingName",
        accessorKey: "billingName",
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        header: chartOrderSortLabels.billingName,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "billingName"),
        cell: ({ row }) => {
          const confirmed = isChartOrderConfirmedRow(row.original);
          const prebillingEditable = isChartOrderPrebillingEditable(row.original);
          const isSetRow =
            row.original.runtimeRow?.rowType === "set" ||
            row.original.runtimeRow?.rowType === "set_child" ||
            row.original.catalogSearchRow?.rowType === "set" ||
            Boolean(row.original.setPreview);
          if (confirmed && prebillingEditable) {
            return (
              <Input
                key={`${row.original.order.id}-billing-name-${getChartOrderPrebillingVersion(row.original)}-${prebillingSavingOrderIds.has(row.original.order.id)}`}
                aria-label={`${row.original.order.displayName} 확정 청구서명 수정`}
                className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 emr-text-metadata"
                data-row-interactive="true"
                defaultValue={row.original.billingName}
                disabled={
                  writeDisabled ||
                  prebillingSavingOrderIds.has(row.original.order.id)
                }
                onBlur={(event) => {
                  const nextValue = event.currentTarget.value.trim();
                  if (nextValue && nextValue !== row.original.billingName) {
                    editableCallbacksRef.current.onSavePrebillingOverride(
                      row.original.order.id,
                      { billingName: nextValue },
                    );
                  } else {
                    event.currentTarget.value = row.original.billingName;
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            );
          }
          if (isSetRow || confirmed) {
            return (
              <EmrTableCellText
                mode="one-line"
                fullText={row.original.billingName}
              >
                {row.original.billingName}
              </EmrTableCellText>
            );
          }

          return (
            <Input
              aria-label={`${row.original.order.displayName} 청구서명 수정`}
              data-row-interactive="true"
              disabled={
                writeDisabled ||
                pendingRemovalOrderIdsRef.current.has(row.original.order.id)
              }
              value={row.original.billingName}
              className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 emr-text-metadata"
              onChange={(event) =>
                editableCallbacksRef.current.onUpdateBillingName(
                  row.original.order.id,
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          );
        },
        meta: {
          label: chartOrderSortLabels.billingName,
          headerInteraction: "sortable",
          resize: "data-column",
        },
      },
      {
        id: "quantity",
        accessorFn: (row) => getDraftQuantity(row.quantityInput),
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        header: chartOrderSortLabels.quantity,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "quantity"),
        cell: ({ row }) => {
          const invalidQuantity =
            getDraftQuantity(row.original.quantityInput) === null;
          const prebillingEditable = isChartOrderPrebillingEditable(row.original);
          const quantityEditable =
            !isChartOrderConfirmedRow(row.original) &&
            row.original.runtimeRow?.rowType !== "set" &&
            row.original.runtimeRow?.quantitySource !== "fixed_one" &&
            row.original.catalogSearchRow?.rowType !== "set" &&
            !row.original.setPreview;

          if (prebillingEditable) {
            return (
              <Input
                key={`${row.original.order.id}-billing-quantity-${getChartOrderPrebillingVersion(row.original)}-${prebillingSavingOrderIds.has(row.original.order.id)}`}
                aria-label={`${row.original.order.displayName} 확정 청구 수량 수정`}
                className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right emr-text-metadata tabular-nums"
                data-row-interactive="true"
                defaultValue={row.original.quantityInput}
                disabled={
                  writeDisabled ||
                  prebillingSavingOrderIds.has(row.original.order.id)
                }
                inputMode="decimal"
                onBlur={(event) => {
                  const billingQuantity = Number(event.currentTarget.value);
                  if (
                    Number.isFinite(billingQuantity) &&
                    billingQuantity > 0 &&
                    billingQuantity !== getDraftQuantity(row.original.quantityInput)
                  ) {
                    editableCallbacksRef.current.onSavePrebillingOverride(
                      row.original.order.id,
                      { billingQuantity },
                    );
                  } else {
                    event.currentTarget.value = row.original.quantityInput;
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            );
          }

          if (!quantityEditable) {
            return (
              <EmrTableCellText
                mode="one-line"
                className="text-right tabular-nums"
              >
                {row.original.quantityInput}
              </EmrTableCellText>
            );
          }

          return (
            <Input
              aria-label={`${row.original.order.displayName} 수량 수정`}
              aria-invalid={invalidQuantity}
              data-row-interactive="true"
              disabled={
                writeDisabled ||
                pendingRemovalOrderIdsRef.current.has(row.original.order.id)
              }
              inputMode="decimal"
              title={
                invalidQuantity ? "수량은 숫자로 입력해 주세요." : undefined
              }
              value={row.original.quantityInput}
              className={cn(
                "h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right emr-text-metadata tabular-nums",
                invalidQuantity && "border-[var(--emr-status-danger-border)]",
              )}
              onChange={(event) =>
                editableCallbacksRef.current.onUpdateQuantity(
                  row.original.order.id,
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          );
        },
        meta: {
          align: "right",
          label: chartOrderSortLabels.quantity,
          headerInteraction: "sortable",
          resize: "data-column",
        },
      },
      {
        id: "unitPrice",
        accessorFn: (row) => row.unitPrice ?? null,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        header: chartOrderSortLabels.unitPrice,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "unitPrice"),
        cell: ({ row }) => (
          <EmrTableCellText mode="one-line">
            {row.original.unitPrice !== undefined &&
            row.original.unitPrice !== null
              ? row.original.unitPrice.toLocaleString()
              : "-"}
          </EmrTableCellText>
        ),
        meta: {
          align: "right",
          label: chartOrderSortLabels.unitPrice,
          headerInteraction: "sortable",
          resize: "data-column",
        },
      },
      {
        id: "lineTotal",
        accessorFn: (row) => getDraftLineTotal(row) ?? null,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        header: chartOrderSortLabels.lineTotal,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "lineTotal"),
        cell: ({ row }) => (
          <EmrTableCellText mode="one-line">
            {getDraftLineTotal(row.original)?.toLocaleString() ?? "-"}
          </EmrTableCellText>
        ),
        meta: {
          align: "right",
          label: chartOrderSortLabels.lineTotal,
          headerInteraction: "sortable",
          resize: "data-column",
        },
      },
      ...chartOrderLegacyProjectionColumns,
      {
        id: "actualDispenseQuantity",
        accessorFn: getChartOrderActualDispense,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "준비 예정량",
        cell: ({ row }) => (
          <ChartOrderActualDispenseCell
            disabled={writeDisabled}
            onSave={(actualQuantity, reason) =>
              editableCallbacksRef.current.onSaveActualDispense(
                row.original.order.id,
                actualQuantity,
                reason,
              )
            }
            row={row.original}
            saving={actualDispenseSavingOrderIds.has(
              row.original.order.id,
            )}
          />
        ),
        meta: {
          align: "right",
          label: "준비 예정량",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "billingReflection",
        accessorFn: getChartOrderBillingReflection,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "청구반영",
        cell: ({ row }) => {
          if (!isChartOrderPrebillingEditable(row.original)) {
            return (
              <EmrTableCellText mode="one-line">
                {getChartOrderBillingReflection(row.original)}
              </EmrTableCellText>
            );
          }
          const enabled =
            getChartOrderBillingReflection(row.original) === "반영";
          return (
            <span className="flex items-center gap-2">
              <Switch
                aria-label={`${row.original.order.displayName} 청구반영`}
                checked={enabled}
                data-row-interactive="true"
                disabled={
                  writeDisabled ||
                  prebillingSavingOrderIds.has(row.original.order.id)
                }
                onCheckedChange={(billingReflectionEnabled) =>
                  editableCallbacksRef.current.onSavePrebillingOverride(
                    row.original.order.id,
                    { billingReflectionEnabled },
                  )
                }
              />
              <span className="emr-text-metadata">
                {enabled ? "반영" : "미반영"}
              </span>
            </span>
          );
        },
        meta: {
          label: "청구반영",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "adjustmentAmount",
        accessorFn: getChartOrderAdjustmentAmount,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "할인할증(금액)",
        cell: ({ row }) => {
          const amount = getChartOrderAdjustmentAmount(row.original);
          if (!isChartOrderPrebillingEditable(row.original)) {
            return (
              <EmrTableCellText
                mode="one-line"
                className="text-right tabular-nums"
              >
                {amount.toLocaleString("ko-KR")}
              </EmrTableCellText>
            );
          }
          const override = getChartOrderBillingOverride(row.original);
          return (
            <Input
              key={`${row.original.order.id}-adjustment-amount-${getChartOrderPrebillingVersion(row.original)}-${prebillingSavingOrderIds.has(row.original.order.id)}`}
              aria-label={`${row.original.order.displayName} 할인할증 금액`}
              className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right emr-text-metadata tabular-nums"
              data-row-interactive="true"
              defaultValue={String(amount)}
              disabled={
                writeDisabled ||
                prebillingSavingOrderIds.has(row.original.order.id)
              }
              inputMode="numeric"
              onBlur={(event) => {
                const adjustmentAmountKrw = Number(event.currentTarget.value);
                if (
                  Number.isSafeInteger(adjustmentAmountKrw) &&
                  adjustmentAmountKrw !== amount
                ) {
                  editableCallbacksRef.current.onSavePrebillingOverride(
                    row.original.order.id,
                    {
                      adjustmentAmountKrw,
                      adjustmentReason:
                        adjustmentAmountKrw === 0
                          ? null
                          : typeof override.adjustmentReason === "string"
                            ? override.adjustmentReason
                            : null,
                      adjustmentSource: "amount",
                    },
                  );
                } else {
                  event.currentTarget.value = String(amount);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          );
        },
        meta: {
          align: "right",
          label: "할인할증(금액)",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "adjustmentPercent",
        accessorFn: getChartOrderAdjustmentPercent,
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "(%)",
        cell: ({ row }) => {
          const percent = getChartOrderAdjustmentPercent(row.original);
          if (!isChartOrderPrebillingEditable(row.original)) {
            return (
              <EmrTableCellText
                mode="one-line"
                className="text-right tabular-nums"
              >
                {percent.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                %
              </EmrTableCellText>
            );
          }
          const override = getChartOrderBillingOverride(row.original);
          return (
            <Input
              key={`${row.original.order.id}-adjustment-percent-${getChartOrderPrebillingVersion(row.original)}-${prebillingSavingOrderIds.has(row.original.order.id)}`}
              aria-label={`${row.original.order.displayName} 할인할증 퍼센트`}
              className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right emr-text-metadata tabular-nums"
              data-row-interactive="true"
              defaultValue={String(Number(percent.toFixed(2)))}
              disabled={
                writeDisabled ||
                prebillingSavingOrderIds.has(row.original.order.id)
              }
              inputMode="decimal"
              onBlur={(event) => {
                const adjustmentPercent = Number(event.currentTarget.value);
                if (
                  Number.isFinite(adjustmentPercent) &&
                  adjustmentPercent !== percent
                ) {
                  editableCallbacksRef.current.onSavePrebillingOverride(
                    row.original.order.id,
                    {
                      adjustmentPercent,
                      adjustmentReason:
                        adjustmentPercent === 0
                          ? null
                          : typeof override.adjustmentReason === "string"
                            ? override.adjustmentReason
                            : null,
                      adjustmentSource: "percent",
                    },
                  );
                } else {
                  event.currentTarget.value = String(Number(percent.toFixed(2)));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          );
        },
        meta: {
          align: "right",
          label: "(%)",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "adjustmentReason",
        accessorFn: (row) => {
          const value = getChartOrderBillingOverride(row).adjustmentReason;
          return typeof value === "string" ? value : "";
        },
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "사유",
        cell: ({ row }) => {
          const override = getChartOrderBillingOverride(row.original);
          const reason =
            typeof override.adjustmentReason === "string"
              ? override.adjustmentReason
              : "";
          const reasons = row.original.runtimeRow?.billingAdjustmentReasons ?? [];
          if (!isChartOrderPrebillingEditable(row.original) || reasons.length === 0) {
            return (
              <EmrTableCellText mode="one-line" fullText={reason}>
                {reason || (reasons.length === 0 ? "미설정" : "—")}
              </EmrTableCellText>
            );
          }
          return (
            <Select
              key={`${row.original.order.id}-adjustment-reason-${getChartOrderPrebillingVersion(row.original)}-${prebillingSavingOrderIds.has(row.original.order.id)}`}
              defaultValue={reason || undefined}
              disabled={
                writeDisabled ||
                prebillingSavingOrderIds.has(row.original.order.id)
              }
              onValueChange={(adjustmentReason) =>
                editableCallbacksRef.current.onSavePrebillingOverride(
                  row.original.order.id,
                  { adjustmentReason },
                )
              }
            >
              <SelectTrigger
                aria-label={`${row.original.order.displayName} 할인할증 사유`}
                className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 emr-text-metadata"
                data-row-interactive="true"
              >
                <SelectValue placeholder="사유 선택" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((adjustmentReason) => (
                  <SelectItem key={adjustmentReason} value={adjustmentReason}>
                    {adjustmentReason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
        meta: {
          label: "사유",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "assignee",
        accessorFn: (row) =>
          getChartOrderAssignee(
            row,
            intendedAssigneeOptionsByOrderId[row.order.id] ?? [],
          )?.name ?? "",
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        enableSorting: false,
        header: "담당자",
        cell: ({ row }) => {
          const orderId = row.original.order.id;
          const options = intendedAssigneeOptionsByOrderId[orderId] ?? [];
          const assignee = getChartOrderAssignee(row.original, options);
          if (!assignee) return <span aria-hidden="true">—</span>;
          const confirmed = isChartOrderConfirmedRow(row.original);
          if (!confirmed) {
            const loadingAssignees =
              intendedAssigneeLoadingOrderIds.has(orderId);
            const savingAssignee = intendedAssigneeSavingOrderIds.has(orderId);
            const persisted = Boolean(row.original.runtimeRow);
            return (
              <Select
                value={assignee.id ?? "__unassigned__"}
                disabled={writeDisabled || !persisted || savingAssignee}
                onOpenChange={(open) => {
                  if (open && persisted) {
                    editableCallbacksRef.current.onLoadIntendedAssignees(
                      orderId,
                    );
                  }
                }}
                onValueChange={(value) => {
                  const nextAssignee =
                    value === "__unassigned__" ? null : value;
                  if (nextAssignee !== assignee.id) {
                    editableCallbacksRef.current.onSaveIntendedAssignee(
                      orderId,
                      nextAssignee,
                    );
                  }
                }}
              >
                <SelectTrigger
                  aria-label={`${row.original.order.displayName} 담당자`}
                  className="h-7 min-w-[118px] bg-[var(--emr-surface-panel)] px-2 emr-text-metadata"
                  data-row-interactive="true"
                  title={persisted ? undefined : "오더 저장 후 지정할 수 있어요."}
                >
                  <SelectValue>
                    {savingAssignee
                      ? "저장 중"
                      : persisted
                        ? assignee.name
                        : "저장 후 지정"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">미지정</SelectItem>
                  {options.map((candidate) => (
                    <SelectItem key={candidate.userId} value={candidate.userId}>
                      {candidate.displayName}
                      {candidate.title ? ` · ${candidate.title}` : ""}
                    </SelectItem>
                  ))}
                  {loadingAssignees ? (
                    <SelectItem value="__loading__" disabled>
                      담당자 불러오는 중
                    </SelectItem>
                  ) : options.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      선택 가능한 담당자 없음
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            );
          }
          return (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar size="sm">
                <AvatarFallback>
                  {assignee.name === "미지정" || assignee.name === "미기록"
                    ? "—"
                    : assignee.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <EmrTableCellText mode="one-line" fullText={assignee.name}>
                {assignee.name}
              </EmrTableCellText>
            </span>
          );
        },
        meta: {
          label: "담당자",
          resize: "data-column",
          textMode: "one-line",
        },
      },
      {
        id: "requestedBy",
        accessorFn: (row) =>
          getChartStaffName(row.order.requestedByUserId) ?? "미기록",
        size: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        minSize: CHART_ORDER_SCROLL_COLUMN_WIDTH_PX,
        header: chartOrderSortLabels.requestedBy,
        sortingFn: (rowA, rowB) =>
          compareChartOrderValues(rowA.original, rowB.original, "requestedBy"),
        cell: ({ row }) => {
          const requestedBy =
            getChartStaffName(row.original.order.requestedByUserId) ??
            "미기록";

          return (
            <EmrTableCellText mode="one-line" fullText={requestedBy}>
              {requestedBy}
            </EmrTableCellText>
          );
        },
        meta: {
          label: chartOrderSortLabels.requestedBy,
          headerInteraction: "sortable",
          resize: "data-column",
        },
      },
    ],
    [
      actualDispenseSavingOrderIds,
      onOpenDetail,
      intendedAssigneeLoadingOrderIds,
      intendedAssigneeOptionsByOrderId,
      intendedAssigneeSavingOrderIds,
      prebillingSavingOrderIds,
      writeDisabled,
    ],
  );
  // TanStack Table owns the controller lifecycle; React Compiler cannot safely memoize it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: rows,
    enableColumnPinning: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enableRowSelection: (row) =>
      !writeDisabled &&
      !pendingRemovalOrderIds.has(row.original.order.id) &&
      isChartOrderTopLevelRow(row.original),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.order.id,
    getSortedRowModel: getSortedRowModel(),
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    state: {
      columnOrder: chartOrderColumnOrder,
      columnPinning: chartOrderColumnPinning,
      columnSizing,
      columnVisibility: chartOrderColumnVisibility,
      rowSelection,
      sorting,
    },
  });

  // Measure the live table and control, including resized columns and density.
  // The composer is outside the horizontal scroll canvas and never becomes a row.
  useLayoutEffect(() => {
    const surface = quickAddSurfaceRef.current;
    const composer = quickAddComposerRef.current;
    if (!surface) return;
    if (!showQuickAdd || !composer) {
      surface.style.removeProperty("--chart-order-quick-add-space");
      return;
    }
    const scrollOwner = surface.querySelector<HTMLElement>(
      '[data-emr-pinned-table-scroll-owner="true"]',
    );
    const categoryHeader = surface.querySelector<HTMLElement>('thead [data-column-id="orderType"]');
    const nameHeader = surface.querySelector<HTMLElement>('thead [data-column-id="displayName"]');
    const body = surface.querySelector("tbody");
    const updatePosition = () => {
      if (!categoryHeader || !nameHeader) return;
      const bounds = surface.getBoundingClientRect();
      const categoryBounds = categoryHeader.getBoundingClientRect();
      const left = categoryBounds.left - bounds.left;
      composer.style.left = `${left}px`;
      composer.style.width = `${Math.max(0, Math.min(nameHeader.getBoundingClientRect().right - categoryBounds.left, bounds.width - left))}px`;
      const height = composer.getBoundingClientRect().height;
      surface.style.setProperty("--chart-order-quick-add-space", `${height}px`);
      const dockTop = Math.max(0, surface.clientHeight - height);
      const lastRow = body?.querySelector<HTMLElement>('tr[data-testid^="chart-order-row-"]:last-child');
      const rowBottom = lastRow?.getBoundingClientRect().bottom;
      const headerBottom = categoryBounds.bottom - bounds.top;
      const naturalTop = rowBottom === undefined ? dockTop : rowBottom - bounds.top;
      composer.style.top = `${Math.min(dockTop, Math.max(headerBottom, naturalTop))}px`;
    };
    if (revealOrderId && revealOrderId !== revealedOrderIdRef.current && !sortState) {
      const addedRow = Array.from(body?.querySelectorAll<HTMLElement>('tr[data-testid]') ?? [])
        .find((row) => row.dataset.testid === `chart-order-row-${revealOrderId}`);
      if (addedRow && scrollOwner) {
        const overflow = addedRow.getBoundingClientRect().bottom - scrollOwner.getBoundingClientRect().bottom;
        if (overflow > 0) scrollOwner.scrollTop += overflow;
        revealedOrderIdRef.current = revealOrderId;
      }
    }
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    [surface, composer, categoryHeader, nameHeader, body].forEach((node) => {
      if (node) observer.observe(node);
    });
    surface.addEventListener("scroll", updatePosition, true);
    return () => {
      observer.disconnect();
      surface.removeEventListener("scroll", updatePosition, true);
    };
  }, [columnSizing, density, revealOrderId, rows, showQuickAdd, sortState]);

  return (
    <div
      data-slot="chart-order-table-surface"
      className="h-full overflow-hidden bg-[var(--emr-surface-panel)]"
    >
      <div ref={quickAddSurfaceRef} className="relative h-full min-h-0 min-w-0">
        <div className="flex h-full min-h-0" style={{ paddingBottom: "var(--chart-order-quick-add-space, 0px)" }}>
        <EmrDataTable
          aria-label="처방/오더 테이블"
          className="bg-[var(--emr-surface-panel)] [--emr-table-row-height-compact:40px]"
          density={density}
          initialLoading={loading && rows.length === 0}
          overscrollAxes="horizontal"
          renderAfterRows={({ visibleColumnCount }) =>
            loading && rows.length > 0 ? (
              <TableRow className="border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] hover:bg-[var(--emr-surface-muted)]">
                <TableCell colSpan={visibleColumnCount} className="h-16">
                  <ChartPanelPendingState
                    title="오더 정보를 불러오는 중"
                    description="이전 차트 오더와 청구 후보 상태를 확인하고 있습니다."
                    className="justify-center"
                  />
                </TableCell>
              </TableRow>
            ) : null
          }
          skeletonRowCount={5}
          table={table}
          viewportMode="fill"
          getRowState={(row) => {
            if (invalidOrderIds.has(row.original.order.id)) return "error";
            if (
              writeDisabled ||
              pendingRemovalOrderIds.has(row.original.order.id)
            )
              return "disabled";
            return isChartOrderConfirmedRow(row.original)
              ? "confirmed"
              : "draft";
          }}
          getRowOverlayAriaLabel={(row) =>
            `${row.original.order.displayName} 행 작업`
          }
          rowOverlayWidth={174}
          renderRowOverlay={({ row }) => {
            const orderRow = row.original;
            const { order } = orderRow;
            const pendingRemoval = pendingRemovalOrderIds.has(order.id);
            const confirmed = isChartOrderConfirmedRow(orderRow);
            const setChild = orderRow.runtimeRow?.rowType === "set_child";
            const setParent = orderRow.runtimeRow?.rowType === "set";
            const included = isChartOrderSetChildIncluded(orderRow);
            const currentTask = latestTaskByOrderId.get(order.id);
            const canAmend = currentTask
              ? currentTask.taskRole === "execution" &&
                currentTask.status === "pending"
              : order.status === "confirmed";
            const canReRequest = currentTask
              ? currentTask.taskRole ===
                  (setParent ? "aggregate" : "execution") &&
                (setParent
                  ? [
                      "in_progress",
                      "paused",
                      "partial_complete",
                      "complete",
                      "returned",
                    ].includes(currentTask.status)
                  : ["in_progress", "paused", "complete", "returned"].includes(
                      currentTask.status,
                    ))
              : ["in_progress", "completed", "re_requested"].includes(
                  order.status,
                );
            const iconClassName =
              "size-7 border border-[var(--emr-border-default)] bg-[var(--emr-surface-floating)] shadow-[var(--clair-shadow-xs)]";

            if (!confirmed) {
              if (pendingRemoval) return null;
              return (
                <>
                  {!setChild ? (
                    <EmrIconButton
                      aria-label={`${order.displayName} 확정`}
                      className={iconClassName}
                      disabled={
                        confirmationDisabled ||
                        writeDisabled ||
                        invalidOrderIds.has(order.id)
                      }
                      onClick={() => onConfirmOrder(order.id)}
                      type="button"
                    >
                      <CdsActionsCheckIcon aria-hidden="true" />
                    </EmrIconButton>
                  ) : null}
                  <EmrIconButton
                    aria-label={`${order.displayName} 상세`}
                    className={iconClassName}
                    onClick={() => onOpenDetail(order.id)}
                    type="button"
                  >
                    <CdsMedicalFileSearchIcon aria-hidden="true" />
                  </EmrIconButton>
                  {!setChild ? (
                    <EmrIconButton
                      aria-label={`${order.displayName} 후보 삭제`}
                      className={cn(iconClassName, "text-destructive")}
                      disabled={writeDisabled}
                      onClick={() => onDeleteOrder(order.id)}
                      type="button"
                    >
                      <CdsActionsTrash2Icon aria-hidden="true" />
                    </EmrIconButton>
                  ) : null}
                  <EmrRowActionMenu
                    ariaLabel={`${order.displayName} 더보기`}
                    density="compact"
                    items={[
                      ...(setChild
                        ? [
                            {
                              key: "set-membership",
                              label: included ? "세트에서 제외" : "세트에 포함",
                              disabled: writeDisabled,
                              onSelect: () => onToggleSetChild(order.id),
                            },
                          ]
                        : []),
                      {
                        key: "detail",
                        label: setParent ? "세트 상세" : "마스터·세부값 보기",
                        onSelect: () => onOpenDetail(order.id),
                      },
                    ]}
                    testId={`chart-order-more-${order.id}`}
                    triggerClassName={iconClassName}
                  />
                </>
              );
            }

            return (
              <>
                <EmrIconButton
                  aria-label={`${order.displayName} 상세`}
                  className={iconClassName}
                  onClick={() => onOpenDetail(order.id)}
                  type="button"
                >
                  <CdsMedicalFileSearchIcon aria-hidden="true" />
                </EmrIconButton>
                <EmrIconButton
                  aria-label={`${order.displayName} 이력`}
                  className={iconClassName}
                  onClick={() => onOpenHistory(order.id)}
                  type="button"
                >
                  <CdsUtilitiesHistoryIcon aria-hidden="true" />
                </EmrIconButton>
                {!setParent && !setChild ? (
                  <EmrIconButton
                    aria-label={`${order.displayName} 정정`}
                    className={iconClassName}
                    disabled={writeDisabled || !canAmend}
                    onClick={() => onOpenMutation(order.id, "amend")}
                    type="button"
                  >
                    <CdsContentEdit2Icon aria-hidden="true" />
                  </EmrIconButton>
                ) : null}
                <EmrRowActionMenu
                  ariaLabel={`${order.displayName} 더보기`}
                  density="compact"
                  items={[
                    {
                      key: "history",
                      label: "이력",
                      onSelect: () => onOpenHistory(order.id),
                    },
                    {
                      key: "priority",
                      label: "긴급 변경",
                      disabled: writeDisabled || setParent || setChild,
                      onSelect: () =>
                        onOpenMutation(order.id, "priority_change"),
                    },
                    {
                      key: "re-request",
                      label: "수정·재확정",
                      disabled: writeDisabled || setChild || !canReRequest,
                      onSelect: () => onOpenMutation(order.id, "re_request"),
                    },
                    {
                      key: "cancel",
                      label: "취소",
                      disabled: writeDisabled || setChild,
                      onSelect: () => onOpenMutation(order.id, "cancel"),
                      variant: "destructive",
                    },
                  ]}
                  testId={`chart-order-more-${order.id}`}
                  triggerClassName={iconClassName}
                />
              </>
            );
          }}
          renderSelectionActionBar={({ selectedRows: selected }) => {
            if (selectionActionsHidden) return null;
            const selectedOriginalRows = selected.map((row) => row.original);
            const cohort = getChartOrderSelectionCohort(
              selectedOriginalRows[0]!,
            );
            const singleRow =
              selectedOriginalRows.length === 1
                ? selectedOriginalRows[0]
                : undefined;
            return (
              <>
                <span className="grid min-w-[112px] border-r border-[var(--emr-border-default)] pr-3">
                  <strong className="text-xs">
                    {selectedOriginalRows.length}개 선택
                  </strong>
                  <span className="emr-text-micro text-[var(--emr-text-secondary)]">
                    {cohort === "draft" ? "확정 전 후보" : "확정 후 이력"}
                  </span>
                </span>
                {cohort === "draft" ? (
                  <>
                    <Button
                      disabled={
                        confirmationDisabled ||
                        writeDisabled ||
                        selectedOriginalRows.some((selectedRow) =>
                          invalidOrderIds.has(selectedRow.order.id),
                        )
                      }
                      size="sm"
                      onClick={onConfirmSelected}
                    >
                      선택 확정
                    </Button>
                    <Button
                      disabled={writeDisabled}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onDeleteSelected(
                          selectedOriginalRows.map(
                            (selectedRow) => selectedRow.order.id,
                          ),
                        )
                      }
                    >
                      후보 삭제
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      disabled={!singleRow}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        singleRow && onOpenHistory(singleRow.order.id)
                      }
                    >
                      이력
                    </Button>
                    <Button
                      disabled={writeDisabled || !singleRow}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        singleRow && onOpenMutation(singleRow.order.id, "amend")
                      }
                    >
                      정정
                    </Button>
                    <Button
                      disabled={writeDisabled || !singleRow}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        singleRow &&
                        onOpenMutation(singleRow.order.id, "re_request")
                      }
                    >
                      수정·재확정
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectionChange(new Set())}
                >
                  선택 해제
                </Button>
              </>
            );
          }}
          getRowProps={(row) => ({
            className: cn("text-[var(--emr-text-secondary)]"),
            style: row.original.order.id === highlightedOrderId && !invalidOrderIds.has(row.original.order.id)
              ? { "--emr-table-row-state-surface": "var(--emr-status-info-bg)" } as CSSProperties
              : undefined,
            "data-dirty": isChartOrderDraftRowDirty(row.original)
              ? "true"
              : undefined,
            "data-pending-removal": pendingRemovalOrderIds.has(
              row.original.order.id,
            )
              ? "true"
              : undefined,
            "data-testid": `chart-order-row-${row.original.order.id}`,
          })}
        />
        {!loading && !rows.length ? (
          <EmrTableFeedbackSurface
            className="absolute inset-x-0 bottom-0 z-20 overflow-auto"
            data-testid="chart-order-empty-body"
            style={{ top: tableHeaderHeight, bottom: "var(--chart-order-quick-add-space, 0px)" }}
          >
            <EmrEmptyState
              description={
                hasAnyRows
                  ? "분류나 필터를 바꾸면 오더가 다시 보입니다."
                  : "+ Order에서 현재 차트에 필요한 오더를 추가해 주세요."
              }
              icon={hasAnyRows ? undefined : false}
              kind={hasAnyRows ? "no-filter-results" : "no-data"}
              primaryAction={
                hasAnyRows ? undefined : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={writeDisabled}
                    onClick={onAddOrder}
                  >
                    + Order
                  </Button>
                )
              }
              priority={hasAnyRows ? "local-recovery" : "supporting"}
              surface="table"
              testId="chart-order-empty-state"
              title={
                hasAnyRows ? "표시할 오더가 없습니다" : "등록된 오더가 없습니다"
              }
            />
          </EmrTableFeedbackSurface>
        ) : null}
        </div>
        {showQuickAdd ? (
          <div
            ref={quickAddComposerRef}
            data-testid="chart-order-quick-add"
            className="absolute z-30 min-h-[calc(var(--clair-control-height-xl)+var(--spacing)*3)] py-1.5"
          >
            {quickAdd}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChartOrderFieldControl({
  definition,
  disabled,
  medicationOrders,
  onChange,
  orderName,
  value,
}: {
  definition: ClinicalOrderFieldDefinition;
  disabled: boolean;
  medicationOrders?: Array<{ id: string; name: string }>;
  onChange: (value: unknown | undefined) => void;
  orderName: string;
  value: unknown;
}) {
  const ariaLabel = `${orderName} ${definition.label}`;
  if (definition.key === "responsibleClinicianId") {
    const clinicianId = typeof value === "string" ? value.trim() : "";
    return (
      <div className="space-y-1">
        <Input
          aria-label={ariaLabel}
          disabled={disabled}
          readOnly
          value={clinicianId}
          placeholder="담당 수의사 미배정"
        />
        <p className="emr-text-metadata text-[var(--emr-text-secondary)]">
          {clinicianId
            ? "진료 담당 수의사에서 자동 결정돼요."
            : "진료 담당 수의사가 미배정되어 있어요. 접수에서 지정한 뒤 다시 불러와 주세요."}
        </p>
      </div>
    );
  }
  if (definition.key === "linkedMedicationOrderId" && medicationOrders) {
    const selected = typeof value === "string" && value ? value : null;
    return <Select disabled={disabled} value={selected} onValueChange={next => onChange(next === "__clear__" ? undefined : next)}>
      <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder="같은 진료의 약품 오더 선택" /></SelectTrigger>
      <SelectContent><SelectItem value="__clear__">연결 해제</SelectItem>
        {selected && !medicationOrders.some(order => order.id === selected) ? <SelectItem value={selected} disabled>현재 선택할 수 없는 오더 · {selected}</SelectItem> : null}
        {medicationOrders.map(order => <SelectItem key={order.id} value={order.id}>{order.name} · {order.id.slice(-8)}</SelectItem>)}
      </SelectContent>
    </Select>;
  }
  if (definition.control === "switch") {
    if (typeof value !== "boolean") return (
      <Select disabled={disabled} value={null} onValueChange={(next) => onChange(next === null ? undefined : next === "true")}>
        <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder="미설정" /></SelectTrigger>
        <SelectContent><SelectItem value="true">예</SelectItem><SelectItem value="false">아니오</SelectItem></SelectContent>
      </Select>
    );
    return (
      <span className="inline-flex min-h-9 items-center gap-2">
        <Switch
          aria-label={ariaLabel}
          checked={value === true}
          disabled={disabled}
          size="sm"
          onCheckedChange={onChange}
        />
        <span className="emr-text-metadata text-[var(--emr-text-secondary)]">
          {value === true ? "예" : "아니오"}
        </span>
      </span>
    );
  }
  if (definition.control === "select" && definition.options.length > 0) {
    return (
      <Select
        disabled={disabled}
        value={typeof value === "string" && value ? value : null}
        onValueChange={onChange}
      >
        <SelectTrigger aria-label={ariaLabel} className="w-full">
          <SelectValue placeholder="선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {definition.options.map((option) => (
              <SelectItem key={option} value={option}>
                {chartOrderFieldOptionLabels[option] ?? option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  if (definition.control === "textarea" || definition.control === "schedule") {
    return (
      <Textarea
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={definition.validation.maxLength}
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (
    definition.valueType === "attachment_array" ||
    definition.valueType === "string_array"
  ) {
    return (
      <Input
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder="참조를 쉼표로 구분"
        value={Array.isArray(value) ? value.join(", ") : ""}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }
  const stringValue =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  return (
    <Input
      aria-label={ariaLabel}
      disabled={disabled}
      inputMode={definition.valueType === "number" ? "decimal" : undefined}
      max={definition.validation.max}
      maxLength={definition.validation.maxLength}
      min={definition.validation.min}
      step={
        definition.valueType === "number"
          ? definition.validation.precision === 0
            ? 1
            : "any"
          : undefined
      }
      type={definition.valueType === "number" ? "number" : "text"}
      value={stringValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChange(
          definition.valueType === "number"
            ? nextValue === ""
              ? undefined
              : Number(nextValue)
            : nextValue,
        );
      }}
    />
  );
}

function ChartOrderDetailSheet({
  medicationOrders,
  workspaceId,
  onBeforeProfileSelect,
  onProfileSelected,
  onFlushDraft,
  onOpenChange,
  onUpdateDetailInput,
  onUpdatePriority,
  open,
  row,
  writeDisabled,
}: {
  medicationOrders: Array<{ id: string; name: string }>;
  workspaceId: string;
  onBeforeProfileSelect: () => Promise<boolean>;
  onProfileSelected: () => void;
  onFlushDraft: () => void;
  onOpenChange: (open: boolean) => void;
  onUpdateDetailInput: (
    orderId: string,
    fieldKey: string,
    value: unknown | undefined,
  ) => void;
  onUpdatePriority: (
    orderId: string,
    priority: ClinicalOrderPriority,
  ) => void;
  open: boolean;
  row?: ChartOrderDraftRow;
  writeDisabled: boolean;
}) {
  if (!row) return null;
  const confirmed = isChartOrderConfirmedRow(row);
  const clinicalOrderType = getChartOrderClinicalType(row);
  const contract = getClinicalOrderFieldSchema(clinicalOrderType, row.detailSchemaVersion);
  if (!contract) return null;
  const orderFields = contract.fields;
  const setParent = row.runtimeRow?.rowType === "set";
  const setChild = row.runtimeRow?.rowType === "set_child";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="border-b border-[var(--emr-border-default)] pr-12">
          <SheetTitle>{row.order.displayName} 상세</SheetTitle>
          <SheetDescription>
            {setParent
              ? "세트 구성과 snapshot"
              : `${contract.label} 임상 입력과 master snapshot`}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-3 emr-text-metadata">
              <span>상태</span>
              <strong>{confirmed ? "확정 snapshot" : "공유 Draft"}</strong>
              <span>분류</span>
              <strong>{setParent ? "Order 세트" : contract.label}</strong>
              <span>실행</span>
              <strong>
                {row.runtimeRow?.executionMode ??
                  getChartOrderCanonicalDefaults(row.order).executionMode}
              </strong>
              <span>Revision</span>
              <strong>{row.runtimeRow?.revisionNo ?? 0}</strong>
              <span>그룹</span>
              <strong>{row.groupTitle}</strong>
            </div>
            {row.order.instruction ? (
              <div className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] p-3">
                <strong className="text-sm">지시/메모</strong>
                <p className="text-sm text-[var(--emr-text-secondary)]">
                  {row.order.instruction}
                </p>
              </div>
            ) : null}
            {setParent ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">세트 구성</h3>
                {(row.setPreview?.items ?? []).map((item) => (
                  <div
                    key={item.revisionItemId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--emr-border-default)] px-3 py-2 emr-text-metadata"
                  >
                    <span className="min-w-0 truncate">
                      {getChartOrderSetPreviewItemDisplayName(item)}
                    </span>
                    <span className="shrink-0">
                      {item.selected ? "포함" : "제외"} · {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <label className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--emr-border-default)] px-3">
                <span className="text-sm font-medium">긴급</span>
                <Switch
                  aria-label={`${row.order.displayName} 긴급`}
                  checked={row.priority === "urgent"}
                  disabled={writeDisabled || confirmed || setChild}
                  onCheckedChange={(checked) =>
                    onUpdatePriority(
                      row.order.id,
                      checked ? "urgent" : "normal",
                    )
                  }
                />
              </label>
            )}
            {!setParent && ["clinical_lab", "external_lab"].includes(clinicalOrderType) && row.order.id ? <LabResultProfileSelection
              workspaceId={workspaceId} orderId={row.order.id} disabled={writeDisabled || confirmed}
              onBeforeSelect={onBeforeProfileSelect} onSelected={onProfileSelected} /> : null}
            {!setParent && orderFields.length ? (
              orderFields.map((definition) => (
                <label key={definition.key} className="grid gap-1.5">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {definition.label}
                    {definition.required ? (
                      <span className="text-destructive">*</span>
                    ) : null}
                  </span>
                  {clinicalOrderType === "hospitalization" && definition.key === "wardOrCage" ? <InpatientLocationPicker
                    workspaceId={workspaceId} value={String(getChartOrderFieldValue(row, definition) ?? "")}
                    disabled={writeDisabled || confirmed} onChange={value => onUpdateDetailInput(row.order.id, definition.key, value)} /> : <ChartOrderFieldControl
                    definition={definition}
                    disabled={writeDisabled || confirmed}
                    medicationOrders={medicationOrders}
                    onChange={(value) =>
                      onUpdateDetailInput(row.order.id, definition.key, value)
                    }
                    orderName={row.order.displayName}
                    value={getChartOrderFieldValue(row, definition)}
                  />}
                </label>
              ))
            ) : !setParent ? (
              <p className="rounded-lg border border-dashed border-[var(--emr-border-default)] p-4 text-sm text-[var(--emr-text-secondary)]">
                이 타입에는 상세 패널 전용 필드가 없습니다.
              </p>
            ) : null}
          </div>
        </ScrollArea>
        <SheetFooter className="border-t border-[var(--emr-border-default)]">
          <Button
            variant="outline"
            onClick={() => {
              if (!confirmed) onFlushDraft();
              onOpenChange(false);
            }}
          >
            {confirmed ? "닫기" : "저장하고 닫기"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ChartOrderHistorySheet({
  workspaceId,
  onExecutionSaved,
  execution,
  onOpenChange,
  open,
  row,
}: {
  workspaceId: string;
  onExecutionSaved: () => Promise<void>;
  execution?: ChartOrderExecutionReadModel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  row?: ChartOrderDraftRow;
}) {
  if (!row) return null;
  const scopedExecution =
    execution?.workspaceId === workspaceId &&
    execution.encounterId === row.order.encounterId
      ? execution
      : undefined;
  const tasks =
    scopedExecution?.tasks
      .filter((task) => task.orderId === row.order.id)
      .sort((left, right) => right.attemptNo - left.attemptNo) ?? [];
  const planTask = tasks.find((task) =>
    task.effectiveSnapshot.snapshotSchemaVersion === 1 &&
    task.effectiveSnapshot.workspaceId === workspaceId &&
    task.effectiveSnapshot.encounterId === row.order.encounterId &&
    task.effectiveSnapshot.orderId === row.order.id,
  );
  const taskIds = new Set(tasks.map((task) => task.taskId));
  const events =
    scopedExecution?.events
      .filter((event) => taskIds.has(event.taskId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)) ??
    [];
  const revisions =
    scopedExecution?.revisions
      .filter((revision) => revision.orderId === row.order.id)
      .sort((left, right) => right.revisionNo - left.revisionNo) ?? [];
  const queues =
    scopedExecution?.queues.filter((queue) => taskIds.has(queue.taskId)) ?? [];
  const billingCandidates =
    scopedExecution?.billingCandidates.filter(
      (candidate) => candidate.orderId === row.order.id,
    ) ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="border-b border-[var(--emr-border-default)] pr-12">
          <SheetTitle>{row.order.displayName} 이력</SheetTitle>
          <SheetDescription>
            Task 수행 계획과 revision/attempt 연결은 원본을 덮어쓰지 않습니다.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 overflow-y-auto p-4">
          <div className="rounded-lg border border-[var(--emr-border-default)] p-3">
            <strong className="text-sm">
              현재 revision {row.runtimeRow?.revisionNo ?? 0}
            </strong>
            <p className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
              {getChartOrderStatusLabel(row)} ·{" "}
              {getShortDateTime(row.order.updatedAt)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--emr-border-default)] p-3">
            <strong className="text-sm">수행 계획 snapshot</strong>
            <p className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
              {planTask
                ? `Task 계획 보관됨 · attempt ${planTask.attemptNo}`
                : "수행 계획 snapshot을 확인하지 못했어요. 확정 전 후보 또는 이전 형식의 이력일 수 있어요."}
            </p>
            {row.runtimeRow?.snapshotHash ? (
              <p className="mt-1 break-all emr-text-metadata text-[var(--emr-text-secondary)]">
                {`세트 적용 hash ${row.runtimeRow.snapshotHash}`}
              </p>
            ) : null}
          </div>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                className="rounded-lg border border-[var(--emr-border-default)] p-3"
                key={task.taskId}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm">
                    {task.taskRole === "aggregate" ? "세트 집계" : "실행"} Task
                    · attempt {task.attemptNo}
                  </strong>
                  <Badge variant="outline">
                    {getUniversalTaskStatusLabel(task.status)}
                  </Badge>
                </div>
                <p className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
                  {task.destinationModule
                    ? `${task.destinationModule} Queue 투영`
                    : "차트 소유 · Queue 없음"}
                  {task.reRequestedFromTaskId ? " · 이전 attempt 연결" : ""}
                </p>
                <p className="mt-1 break-all emr-text-micro text-[var(--emr-text-tertiary)]">
                  Task {task.taskId} · {getShortDateTime(task.updatedAt)}
                </p>
                {isRecordValue(task.effectiveSnapshot.inpatientLocation) && typeof task.effectiveSnapshot.inpatientLocation.label === "string"
                  ? <p className="mt-1 text-sm">확정 입원 위치: {task.effectiveSnapshot.inpatientLocation.label}</p> : null}
                {open && task.taskRole === "execution" && !task.destinationModule && isChartActualType(task.clinicalOrderType)
                  ? <ChartActualHistory key={`${workspaceId}:${task.taskId}`} workspaceId={workspaceId} taskId={task.taskId} /> : null}
                {open && ["hospitalization", "other"].includes(task.clinicalOrderType) && task.destinationModule
                  ? queues.filter(queue => queue.taskId === task.taskId).map(queue => <ChartRoutedExecutionActions
                    key={`${workspaceId}:${queue.workItemId}:${task.taskId}`} workspaceId={workspaceId} queue={queue} taskId={task.taskId} onSaved={onExecutionSaved} />) : null}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--emr-border-default)] p-3 emr-text-metadata text-[var(--emr-text-secondary)]">
              확정 전 후보이거나 아직 universal Task read model에 연결되지
              않았습니다.
            </div>
          )}
          {(queues.length > 0 || billingCandidates.length > 0) && (
            <div className="rounded-lg border border-[var(--emr-border-default)] p-3">
              <strong className="text-sm">Downstream 연결</strong>
              <p className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
                Queue {queues.length}건 · 수납 후보 {billingCandidates.length}건
              </p>
            </div>
          )}
          {revisions.map((revision) => (
            <ChartOrderRevisionHistoryItem
              key={revision.revisionId}
              revision={revision}
            />
          ))}
          {events.map((event) => (
            <ChartOrderTaskEventHistoryItem event={event} key={event.eventId} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ChartOrderRevisionHistoryItem({
  revision,
}: {
  revision: ChartOrderExecutionRevision;
}) {
  return (
    <div className="rounded-lg border border-[var(--emr-border-default)] p-3">
      <strong className="text-sm">
        revision {revision.revisionNo} ·{" "}
        {getOrderRevisionChangeLabel(revision.changeType)}
      </strong>
      <p className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
        {revision.reason ?? "기존 이력"} ·{" "}
        {getShortDateTime(revision.createdAt)}
      </p>
    </div>
  );
}

function ChartOrderTaskEventHistoryItem({
  event,
}: {
  event: ChartOrderExecutionTaskEvent;
}) {
  return (
    <div className="rounded-lg border border-[var(--emr-border-default)] p-3">
      <strong className="text-sm">
        {getOrderTaskEventLabel(event.eventType)}
      </strong>
      <p className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
        attempt {event.taskAttemptNo} · {event.reason ?? "시스템 기록"} ·{" "}
        {getShortDateTime(event.createdAt)}
      </p>
    </div>
  );
}

function getUniversalTaskStatusLabel(
  status: ChartOrderExecutionTask["status"],
) {
  return {
    pending: "대기",
    in_progress: "진행 중",
    paused: "일시 중지",
    partial_complete: "일부 완료",
    complete: "완료",
    returned: "반려",
    cancelled: "취소",
  }[status];
}

function getOrderRevisionChangeLabel(
  changeType: ChartOrderExecutionRevision["changeType"],
) {
  return {
    legacy: "기존 이력",
    amendment: "정정",
    cancellation: "취소",
    priority_change: "긴급 변경",
    billing_correction: "수납 정정",
    re_request: "재요청",
  }[changeType];
}

function getOrderTaskEventLabel(
  eventType: ChartOrderExecutionTaskEvent["eventType"],
) {
  return {
    created: "Task 생성",
    assigned: "담당자 변경",
    started: "실행 시작",
    phase_changed: "상세 단계 변경",
    paused: "실행 일시 중지",
    resumed: "실행 재개",
    handed_off: "담당자 인계",
    completed: "실행 완료",
    returned: "실행 반려",
    cancelled: "실행 취소",
    amended: "실행 snapshot 정정",
    re_requested: "linked attempt 재요청",
    priority_changed: "긴급 변경",
    legacy_accepted_migrated: "이전 접수 상태 이관",
  }[eventType];
}

type ChartOrderMutationDraft = {
  action: ChartOrderExecutionMutationAction;
  actualDispenseInput: string;
  detailInputs: Record<string, unknown>;
  error?: string;
  orderId: string;
  priority: ClinicalOrderPriority;
  reason: string;
  saving: boolean;
};

const chartOrderMutationLabels: Record<
  ChartOrderExecutionMutationAction,
  string
> = {
  amend: "오더 정정",
  cancel: "오더 취소",
  priority_change: "긴급 변경",
  re_request: "오더 수정·재확정",
};

function ChartOrderMutationDialog({
  draft,
  medicationOrders,
  onChange,
  onConfirm,
  onOpenChange,
  row,
}: {
  draft: ChartOrderMutationDraft | null;
  medicationOrders: Array<{ id: string; name: string }>;
  onChange: (draft: ChartOrderMutationDraft) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  row?: ChartOrderDraftRow;
}) {
  if (!draft || !row) return null;
  const contract = getClinicalOrderFieldSchema(getChartOrderClinicalType(row), row.detailSchemaVersion);
  if (!contract) return null;
  const editsClinicalSnapshot =
    draft.action === "amend" || draft.action === "re_request";
  const canSubmit = draft.reason.trim().length >= 3 && !draft.saving;
  const outputs = row.runtimeRow?.calculationOutputs ?? {};
  const authority = getChartOrderAuthority(row);
  const correctionUsesActualDispense =
    draft.action === "re_request" &&
    (outputs.dispenseApplicability === true ||
      getChartOrderClinicalType(row) === "dispensing");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88vh,760px)] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--emr-border-default)] px-5 py-4 pr-12">
          <DialogTitle>
            {row.order.displayName} · {chartOrderMutationLabels[draft.action]}
          </DialogTitle>
          <DialogDescription>
            {draft.action === "re_request"
              ? "이전 확정값과 완료 결과는 이력으로 보존하고, 수정한 값은 새 revision과 linked attempt의 최신 확정 snapshot으로 기록합니다."
              : "확정 snapshot과 완료 결과는 유지하고 actor, 사유, before/after를 새 revision과 event로 기록합니다."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-4">
          {editsClinicalSnapshot ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {contract.fields.map((definition) => (
                <label
                  key={definition.key}
                  className={cn(
                    "grid gap-1.5",
                    (definition.control === "textarea" ||
                      definition.control === "schedule") &&
                      "sm:col-span-2",
                  )}
                >
                  <span className="text-sm font-medium">
                    {definition.label}
                    {definition.required ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </span>
                  <ChartOrderFieldControl
                    definition={definition}
                    disabled={draft.saving}
                    medicationOrders={medicationOrders}
                    onChange={(value) => {
                      const detailInputs = { ...draft.detailInputs };
                      if (value === undefined || value === "") {
                        delete detailInputs[definition.key];
                      } else {
                        detailInputs[definition.key] = value;
                      }
                      onChange({ ...draft, detailInputs, error: undefined });
                    }}
                    orderName={row.order.displayName}
                    value={
                      draft.detailInputs[definition.key]
                    }
                  />
                </label>
              ))}
              {draft.action === "re_request" ? (
                <>
                  {correctionUsesActualDispense ? (
                    authority?.preparationPolicy ? (
                      <label className="grid gap-1.5">
                        <span className="text-sm font-medium">
                          재확정 준비 예정량
                        </span>
                        <Input
                          aria-label={`${row.order.displayName} 재확정 준비 예정량`}
                          disabled={draft.saving}
                          inputMode="decimal"
                          max={
                            authority.preparationPolicy.maximum ?? undefined
                          }
                          min={
                            authority.preparationPolicy.minimum ??
                            authority.preparationPolicy.increment
                          }
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              actualDispenseInput: event.target.value,
                              error: undefined,
                            })
                          }
                          step={authority.preparationPolicy.increment}
                          type="number"
                          value={draft.actualDispenseInput}
                        />
                        <span className="emr-text-micro text-[var(--emr-text-secondary)]">
                          서버가 변경된 처방값으로 다시 계산한 뒤 이 값을 검증해요.
                        </span>
                      </label>
                    ) : (
                      <EmrInlineAlert
                        className="sm:col-span-2"
                        severity="info"
                        title="서버 계산값으로 재확정"
                      >
                        마스터에 수동 조정 규칙이 없어서 재확정 시 서버 계산값을
                        그대로 적용해요.
                      </EmrInlineAlert>
                    )
                  ) : null}
                  <label className="flex min-h-9 items-center justify-between gap-3 rounded-lg border border-[var(--emr-border-default)] px-3 sm:col-span-2">
                    <span className="text-sm font-medium">새 attempt 긴급</span>
                    <Switch
                      checked={draft.priority === "urgent"}
                      disabled={draft.saving}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...draft,
                          error: undefined,
                          priority: checked ? "urgent" : "normal",
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
          {draft.action === "priority_change" ? (
            <label className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--emr-border-default)] px-3">
              <span className="text-sm font-medium">긴급</span>
              <Switch
                checked={draft.priority === "urgent"}
                disabled={draft.saving}
                onCheckedChange={(checked) =>
                  onChange({
                    ...draft,
                    error: undefined,
                    priority: checked ? "urgent" : "normal",
                  })
                }
              />
            </label>
          ) : null}
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">사유 *</span>
            <Textarea
              aria-invalid={
                draft.reason.length > 0 && draft.reason.trim().length < 3
              }
              disabled={draft.saving}
              maxLength={500}
              placeholder="사유를 3자 이상 입력해 주세요."
              rows={3}
              value={draft.reason}
              onChange={(event) =>
                onChange({
                  ...draft,
                  error: undefined,
                  reason: event.target.value,
                })
              }
            />
          </label>
          {draft.error ? (
            <EmrInlineAlert severity="error" title="변경을 반영하지 못했습니다">
              {draft.error}
            </EmrInlineAlert>
          ) : null}
        </div>
        <DialogFooter className="border-t border-[var(--emr-border-default)] px-5 py-4">
          <Button
            disabled={draft.saving}
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            disabled={!canSubmit}
            variant={draft.action === "cancel" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {draft.saving ? "반영 중" : chartOrderMutationLabels[draft.action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OrderActionDialogType = "confirm";
type ChartUnavailableAction = "order-history" | "order-print" | "order-request";

const chartUnavailableActionCopy = {
  "order-history": {
    title: "Order 이력 상세는 아직 연결되지 않았습니다",
    body: "선택 오더의 상세 이력 화면은 후속 상세 화면 범위에 포함됩니다. 현재 테이블의 상태와 갱신 시간을 기준으로 확인해 주세요.",
  },
  "order-print": {
    title: "Order 출력은 아직 연결되지 않았습니다",
    body: "실제 문서 생성, 프린트, PDF 출력 연동은 이번 MVP 범위에 포함되지 않습니다. 화면의 오더 목록을 기준으로 데모를 진행해 주세요.",
  },
  "order-request": {
    title: "Order 요청 흐름은 아직 연결되지 않았습니다",
    body: "검사실, 영상실, 처치실 같은 외부/부서 요청 전송은 후속 연동 범위입니다. 현재는 차트 내부 상태만 저장합니다.",
  },
} as const satisfies Record<
  ChartUnavailableAction,
  { body: string; title: string }
>;

function ChartUnavailableAlert({
  action,
  className,
  targetName,
  onDismiss,
}: {
  action: ChartUnavailableAction;
  className?: string;
  onDismiss: () => void;
  targetName?: string;
}) {
  const copy = chartUnavailableActionCopy[action];

  return (
    <EmrInlineAlert
      severity="info"
      title={copy.title}
      className={cn("emr-text-metadata", className)}
      dismissAction={
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="안내 닫기"
          onClick={onDismiss}
        >
          <CdsActionsXIcon data-icon="inline-start" />
        </Button>
      }
      testId="chart-unavailable-action-alert"
    >
      {targetName ? `${targetName}: ` : null}
      {copy.body}
    </EmrInlineAlert>
  );
}

function mapCatalogCategoryToOrderType(
  row: ChartOrderCatalogSearchRow,
): EmrOrderType {
  const type = row.clinicalOrderType ?? row.appliedSnapshot.clinicalOrderType;
  if (type === "clinical_lab" || type === "external_lab") return "lab";
  if (type === "imaging") return "imaging";
  if (type === "dispensing") return "dispensing";
  // Compatibility bucket only: canonical type/routing remains in appliedSnapshot.
  // EmrOrderType has four historical values, unlike the nine clinical order types.
  return "treatment";
}

function getCatalogCandidateInstruction(row: ChartOrderCatalogSearchRow) {
  if (row.rowType === "set")
    return "Order 세트 구성은 서버 preview에서 확인합니다.";

  const type = row.clinicalOrderType ?? row.appliedSnapshot.clinicalOrderType;
  if (!type) return "업무유형 미설정";
  return `${CLINICAL_ORDER_FIELD_SCHEMAS[type].label} · ${row.executionMode === "immediate_complete" ? "차트 기록" : "업무 전달"}`;
}

function getCatalogCandidatePriceLabel(row: ChartOrderCatalogSearchRow) {
  if (row.rowType === "set") {
    if (row.sourceSetAmountBasis === "included_order_sum") {
      return "구성 항목 합계";
    }
    if (row.sourceSetAmountBasis === "range_price") {
      return "가격 범위";
    }
    if (row.sourceSetPriceKrw === 0) return "무료";
    if (typeof row.sourceSetPriceKrw === "number") {
      return `${row.sourceSetPriceKrw.toLocaleString()}원`;
    }
    return "가격 미설정";
  }

  return row.appliedSnapshot.appliedPriceKrw === null
    ? "가격 미설정"
    : `${row.appliedSnapshot.appliedPriceKrw.toLocaleString()}원`;
}

function getChartOrderPersistenceErrorMessage(error?: string) {
  switch (error) {
    case "invalid_chart_actual":
    case "chart_actual_record_required":
    case "invalid_performed_at":
      return "차트 내 완료 항목의 실제 수행 시각·본인 확인·결과를 입력해 주세요.";
    case "chart_actual_finding_mismatch":
    case "chart_actual_scope_mismatch":
      return "실제 기록과 확정할 오더가 일치하지 않아요. 최신 후보와 소견을 다시 확인해 주세요.";
    case "inpatient_location_required":
    case "inpatient_location_unavailable":
      return "이 병원에 등록된 사용 가능한 병동·케이지를 선택해 주세요.";
    case "confirmed_inpatient_location_immutable":
      return "이미 확정된 입원 위치는 직접 변경할 수 없어요. 재요청 흐름을 이용해 주세요.";
    case "etag_header_body_mismatch":
    case "revision_conflict":
      return "다른 사용자가 오더를 변경했어요. 다시 불러온 뒤 저장해 주세요.";
    case "stale_status":
      return "차트 상태가 변경되어 오더를 저장할 수 없어요.";
    case "invalid_removed_order_ids":
    case "order_removal_unavailable":
      return "삭제할 수 없는 오더 후보가 포함되어 있어요. 최신 상태를 다시 확인해 주세요.";
    case "order_removal_has_downstream_artifacts":
      return "이미 확정·수행·청구에 연결된 오더는 후보 삭제로 제거할 수 없어요.";
    case "order_set_empty_selection":
      return "하나 이상의 구성 항목을 선택해 주세요.";
    case "order_set_quantity_invalid":
      return "수량을 확인해 주세요.";
    case "order_set_range_input_required":
    case "order_set_range_input_invalid":
    case "order_set_range_no_match":
      return "가격 범위를 확인해 주세요.";
    case "order_set_price_unset":
      return "가격이 설정되지 않은 오더는 저장할 수 없어요.";
    case "order_set_member_unavailable":
    case "order_set_composition_review_required":
    case "catalog_revision_requires_refresh":
    case "child_revision_requires_refresh":
      return "Order 세트 구성이 변경되어 다시 확인해 주세요.";
    case "if_match_required":
      return "오더 버전 확인이 필요합니다. 다시 불러온 뒤 저장해 주세요.";
    case "idempotency_conflict":
      return "같은 확정 요청의 내용이 달라 처리하지 않았어요. 다시 확인해 주세요.";
    case "confirmation_in_progress":
      return "같은 확정 요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.";
    case "master_revision_requires_refresh":
      return "Order 마스터가 변경되어 최신 내용을 다시 확인해 주세요.";
    case "confirmation_detail_inputs_incomplete":
      return "확정에 필요한 세부값을 모두 입력해 주세요.";
    default:
      return "오더 작업 상태를 저장하지 못했어요.";
  }
}

function createChartOrderConfirmationIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `chart-confirm-${crypto.randomUUID()}`;
  }
  return `chart-confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createChartOrderBillingIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `chart-billing-${crypto.randomUUID()}`;
  }
  return `chart-billing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createChartOrderPrebillingIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `chart-prebilling-${crypto.randomUUID()}`;
  }
  return `chart-prebilling-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createChartOrderIntendedAssigneeIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `chart-assignee-${crypto.randomUUID()}`;
  }
  return `chart-assignee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createChartOrderActualDispenseIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `chart-actual-dispense-${crypto.randomUUID()}`;
  }
  return `chart-actual-dispense-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasSameChartOrderSelection(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((orderId, index) => orderId === right[index])
  );
}

function isCatalogCandidateTargetingPatient(
  row: ChartOrderCatalogSearchRow,
  patientSpecies: ChartBundle["patient"]["species"],
) {
  const normalizedSpecies =
    patientSpecies === "dog" || patientSpecies === "cat"
      ? patientSpecies
      : "other";

  return row.targetSpecies.includes(normalizedSpecies);
}

function buildChartOrderDraftRowFromCatalog({
  bundle,
  row,
  setSelectionIntent,
  setPreview,
  sortOrder,
}: {
  bundle: ChartBundle;
  row: ChartOrderCatalogSearchRow;
  setSelectionIntent?: ChartOrderSetSelectionIntent;
  setPreview?: ChartOrderSetPreview;
  sortOrder: number;
}): ChartOrderDraftRow {
  const orderType = mapCatalogCategoryToOrderType(row);
  const now = new Date().toISOString();
  const order: EmrOrder = {
    id: createChartOrderDraftId(),
    workspaceId: bundle.encounter.workspaceId,
    encounterId: bundle.encounter.id,
    serviceItemId:
      row.rowType === "individual" ? undefined : row.sourcePresetId,
    workspaceCatalogItemId:
      row.rowType === "individual"
        ? (row.workspaceCatalogItemId ??
          row.appliedSnapshot.workspaceCatalogItemId)
        : undefined,
    sourceMasterRecordId: row.sourceMasterRecordId,
    sourceMasterRevision: row.sourceMasterRevision,
    workspaceCatalogRevision: row.workspaceCatalogRevision,
    categoryGroup: row.categoryGroup === "set" ? undefined : row.categoryGroup,
    appliedSnapshot: row.appliedSnapshot as Record<string, unknown>,
    orderType,
    displayName: row.displayName,
    status: "requested",
    workStatus: "pending",
    priority: "normal",
    requestedByUserId: bundle.encounter.primaryVeterinarianId ?? "user-vet",
    requestedAt: now,
    instruction: getCatalogCandidateInstruction(row),
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
  const defaultDetailInputs = mergeChartOrderRuntimeDetailInputs({
    clinicalOrderType: row.clinicalOrderType ?? row.appliedSnapshot.clinicalOrderType,
    detailInputs: readCatalogDefaultDetailInputs(row),
    primaryVeterinarianId: bundle.encounter.primaryVeterinarianId,
  });
  const defaultTotalQuantity = defaultDetailInputs.totalQuantity;
  const quantityInput =
    row.rowType === "individual" &&
    row.appliedSnapshot.appliedAmountBasis === "unit_price" &&
    typeof defaultTotalQuantity === "number" &&
    Number.isFinite(defaultTotalQuantity) &&
    defaultTotalQuantity >= 0
      ? String(defaultTotalQuantity)
      : row.rowType === "individual" && row.appliedSnapshot.appliedAmountBasis === "unit_price"
        ? ""
        : "1"; // One fixed-price/set billing instance, not an invented clinical quantity.

  return {
    billingName: row.billingName,
    catalogSearchRow: row,
    committedBillingName: "",
    committedQuantityInput: "",
    detailInputs: defaultDetailInputs,
    detailSchemaVersion: row.detailSchemaVersion ?? 1,
    groupTitle: row.rowType === "set" ? "Order 세트" : "Workspace catalog",
    order,
    priority: "normal",
    quantityInput,
    setSelectionIntent,
    setPreview,
    unitPrice:
      row.rowType === "set"
        ? (setPreview?.pricing.finalTotalKrw ??
          row.appliedSnapshot.appliedPriceKrw)
        : row.appliedSnapshot.appliedPriceKrw,
  };
}

function readCatalogDefaultDetailInputs(
  row: { appliedSnapshot?: unknown },
): Record<string, unknown> {
  const snapshot = isRecordValue(row.appliedSnapshot)
    ? row.appliedSnapshot
    : {};
  return readPersistedOrderDefaults(snapshot).values ?? {};
}

function mergeChartOrderRuntimeDetailInputs({
  clinicalOrderType,
  detailInputs,
  primaryVeterinarianId,
}: {
  clinicalOrderType?: ClinicalOrderType;
  detailInputs: Record<string, unknown>;
  primaryVeterinarianId?: string;
}): Record<string, unknown> {
  const normalizedPrimaryVeterinarianId = primaryVeterinarianId?.trim();
  if (clinicalOrderType !== "consultation") {
    return detailInputs;
  }
  const nextDetailInputs = { ...detailInputs };
  if (!normalizedPrimaryVeterinarianId) {
    delete nextDetailInputs.responsibleClinicianId;
    return nextDetailInputs;
  }
  return {
    ...nextDetailInputs,
    responsibleClinicianId: normalizedPrimaryVeterinarianId,
  };
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createChartOrderDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-0000-4000-8000-".concat(
    Math.random().toString(16).slice(2, 14).padEnd(12, "0"),
  );
}

type ChartOrderCatalogCategory =
  "all" | ChartOrderCatalogSearchRow["categoryGroup"];
type ChartOrderCatalogStatus =
  "idle" | "loading" | "ready" | "denied" | "error";

const chartOrderCatalogCategories: ReadonlyArray<{
  label: string;
  value: ChartOrderCatalogCategory;
}> = [
  { label: "전체", value: "all" },
  { label: "진료", value: "consultation" },
  { label: "검사", value: "lab" },
  { label: "영상", value: "imaging" },
  { label: "조제", value: "medication" },
  { label: "처치", value: "treatment" },
  { label: "입원", value: "hospitalization" },
  { label: "기타", value: "misc" },
  { label: "세트", value: "set" },
];

function getChartOrderCatalogCategoryLabel(
  category: ChartOrderCatalogCategory,
) {
  return (
    chartOrderCatalogCategories.find((item) => item.value === category)
      ?.label ?? "전체"
  );
}

function ChartOrderCatalogDialog({
  initialQuery = "",
  onReturnFocus,
  bundle,
  candidates,
  initialSelectedCatalogSourceKeys,
  lockedCatalogSourceKeys,
  open,
  status,
  onApply,
  onOpenChange,
  onRetry,
}: {
  initialQuery?: string;
  onReturnFocus?: () => HTMLElement | false;
  bundle: ChartBundle;
  candidates: ChartOrderCatalogSearchRow[];
  initialSelectedCatalogSourceKeys: readonly string[];
  lockedCatalogSourceKeys: Set<string>;
  open: boolean;
  status: ChartOrderCatalogStatus;
  onApply: (
    rows: ChartOrderCatalogSearchRow[],
    selectedSourceKeys: Set<string>,
  ) => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [category, setCategory] = useState<ChartOrderCatalogCategory>("all");
  const [query, setQuery] = useState(initialQuery);
  const [searchOpen, setSearchOpen] = useState(Boolean(initialQuery));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery(initialQuery);
      setSearchOpen(Boolean(initialQuery));
    }
  }
  const [selectedRows, setSelectedRows] = useState<
    ChartOrderCatalogSearchRow[]
  >([]);
  const [deselectedInitialSourceKeys, setDeselectedInitialSourceKeys] =
    useState<Set<string>>(() => new Set());
  const categoryTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const candidateScrollRef = useRef<HTMLDivElement>(null);
  const initializedSelectionRef = useRef(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const patientCandidates = useMemo(
    () =>
      candidates.filter((row) =>
        isCatalogCandidateTargetingPatient(row, bundle.patient.species),
      ),
    [bundle.patient.species, candidates],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<ChartOrderCatalogCategory, number>(
      chartOrderCatalogCategories.map((item) => [item.value, 0]),
    );
    counts.set("all", patientCandidates.length);
    patientCandidates.forEach((row) => {
      counts.set(row.categoryGroup, (counts.get(row.categoryGroup) ?? 0) + 1);
    });

    return counts;
  }, [patientCandidates]);
  const categoryCandidates = useMemo(
    () =>
      category === "all"
        ? patientCandidates
        : patientCandidates.filter((row) => row.categoryGroup === category),
    [category, patientCandidates],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCandidates = useMemo(
    () =>
      categoryCandidates.filter((row) => {
        if (!normalizedQuery) return true;

        return [
          row.displayName,
          row.billingName,
          row.appliedSnapshot.appliedStandardOrderName ?? "",
          row.sourcePresetId,
          row.categoryGroup,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    [categoryCandidates, normalizedQuery],
  );
  const initialSelectedSourceKeySet = useMemo(
    () => new Set(initialSelectedCatalogSourceKeys),
    [initialSelectedCatalogSourceKeys],
  );
  const selectedSourceKeys = useMemo(() => {
    const keys = new Set(
      initialSelectedCatalogSourceKeys.filter(
        (sourceKey) => !deselectedInitialSourceKeys.has(sourceKey),
      ),
    );
    selectedRows.forEach((row) => keys.add(getChartCatalogSourceKey(row)));
    return keys;
  }, [
    deselectedInitialSourceKeys,
    initialSelectedCatalogSourceKeys,
    selectedRows,
  ]);
  // The catalog can contain hundreds of rows; keep rendering bounded inside the dialog.
  // eslint-disable-next-line react-hooks/incompatible-library
  const candidateVirtualizer = useVirtualizer({
    count: visibleCandidates.length,
    estimateSize: () => 42,
    getScrollElement: () => candidateScrollRef.current,
    overscan: 6,
  });
  const categoryLabel = getChartOrderCatalogCategoryLabel(category);
  const liveStatusText =
    status === "loading"
      ? "오더를 불러오는 중입니다."
      : status === "denied"
        ? "오더 검색 권한이 없습니다."
        : status === "error"
          ? "오더를 불러오지 못했습니다."
          : `${categoryLabel} 오더 ${visibleCandidates.length}개, 선택한 오더 ${selectedRows.length}개`;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!open) {
      initializedSelectionRef.current = false;
      return;
    }
    if (status !== "ready" || initializedSelectionRef.current) return;

    const candidateBySourceKey = new Map(
      candidates.map((row) => [getChartCatalogSourceKey(row), row]),
    );
    setSelectedRows(
      initialSelectedCatalogSourceKeys.flatMap((sourceKey) => {
        const row = candidateBySourceKey.get(sourceKey);
        return row ? [row] : [];
      }),
    );
    setDeselectedInitialSourceKeys(new Set());
    initializedSelectionRef.current = true;
  }, [candidates, initialSelectedCatalogSourceKeys, open, status]);

  useEffect(() => {
    if (!open || status !== "ready") return;
    const frame = requestAnimationFrame(() => candidateVirtualizer.measure());
    return () => cancelAnimationFrame(frame);
  }, [candidateVirtualizer, open, status, visibleCandidates.length]);

  const resetDialogState = () => {
    setActiveCandidateIndex(0);
    setCategory("all");
    setQuery("");
    setSearchOpen(false);
    setSelectedRows([]);
    setDeselectedInitialSourceKeys(new Set());
    initializedSelectionRef.current = false;
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDialogState();
    onOpenChange(nextOpen);
  };
  const closeSearch = () => {
    setActiveCandidateIndex(0);
    setQuery("");
    setSearchOpen(false);
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };
  const selectCategory = (nextCategory: ChartOrderCatalogCategory) => {
    setActiveCandidateIndex(0);
    setCategory(nextCategory);
    setQuery("");
    setSearchOpen(false);
    candidateVirtualizer.scrollToOffset(0);
  };
  const handleCategoryKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === "ArrowDown")
      nextIndex = (index + 1) % chartOrderCatalogCategories.length;
    else if (event.key === "ArrowUp")
      nextIndex =
        (index - 1 + chartOrderCatalogCategories.length) %
        chartOrderCatalogCategories.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End")
      nextIndex = chartOrderCatalogCategories.length - 1;
    else return;

    event.preventDefault();
    selectCategory(chartOrderCatalogCategories[nextIndex].value);
    requestAnimationFrame(() => categoryTabRefs.current[nextIndex]?.focus());
  };
  const toggleSelectedRow = (row: ChartOrderCatalogSearchRow) => {
    const sourceKey = getChartCatalogSourceKey(row);
    if (lockedCatalogSourceKeys.has(sourceKey)) return;
    if (selectedSourceKeys.has(sourceKey)) {
      setSelectedRows((currentRows) =>
        currentRows.filter(
          (currentRow) => getChartCatalogSourceKey(currentRow) !== sourceKey,
        ),
      );
      if (initialSelectedSourceKeySet.has(sourceKey)) {
        setDeselectedInitialSourceKeys((currentKeys) =>
          new Set(currentKeys).add(sourceKey),
        );
      }
      return;
    }

    setSelectedRows((currentRows) => [...currentRows, row]);
    setDeselectedInitialSourceKeys((currentKeys) => {
      if (!currentKeys.has(sourceKey)) return currentKeys;
      const nextKeys = new Set(currentKeys);
      nextKeys.delete(sourceKey);
      return nextKeys;
    });
  };
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Enter"
    )
      return;
    if (!visibleCandidates.length) return;

    event.preventDefault();
    if (event.key === "Enter") {
      toggleSelectedRow(visibleCandidates[activeCandidateIndex]);
      return;
    }
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(activeCandidateIndex + 1, visibleCandidates.length - 1)
        : Math.max(activeCandidateIndex - 1, 0);
    setActiveCandidateIndex(nextIndex);
    candidateVirtualizer.scrollToIndex(nextIndex, { align: "auto" });
  };
  const handleSelectionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setSelectedRows((currentRows) => {
      const oldIndex = currentRows.findIndex(
        (row) => getChartCatalogSourceKey(row) === active.id,
      );
      const newIndex = currentRows.findIndex(
        (row) => getChartCatalogSourceKey(row) === over.id,
      );
      if (oldIndex < 0 || newIndex < 0) return currentRows;

      return arrayMove(currentRows, oldIndex, newIndex);
    });
  };
  const moveSelectedRow = (sourceKey: string, direction: -1 | 1) => {
    setSelectedRows((currentRows) => {
      const oldIndex = currentRows.findIndex(
        (row) => getChartCatalogSourceKey(row) === sourceKey,
      );
      const newIndex = oldIndex + direction;
      if (oldIndex < 0 || newIndex < 0 || newIndex >= currentRows.length)
        return currentRows;
      return arrayMove(currentRows, oldIndex, newIndex);
    });
  };
  const confirmSelection = () => {
    onApply(selectedRows, selectedSourceKeys);
    resetDialogState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <EmrDialogShell
        variant="wide-form"
        title="오더 추가"
        closeAriaLabel="오더 추가 닫기"
        className={orderCatalogDialogStyles.dialog}
        bodyClassName={orderCatalogDialogStyles.body}
        headerClassName={orderCatalogDialogStyles.header}
        footerClassName={orderCatalogDialogStyles.footer}
        initialFocus={() => initialQuery ? searchInputRef.current : categoryTabRefs.current[0]}
        finalFocus={onReturnFocus}
        footerMeta={
          <strong aria-live="polite">
            선택한 오더 {selectedRows.length}개
          </strong>
        }
        secondaryAction={
          <Button
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            취소
          </Button>
        }
        primaryAction={
          <Button
            disabled={status !== "ready"}
            onClick={confirmSelection}
            type="button"
          >
            선택 완료
          </Button>
        }
      >
        <ClassificationExplorerColumn
          label="오더 분류"
          header={<ClassificationExplorerHeading label="오더 분류" />}
        >
          <ClassificationExplorerList ariaLabel="오더 카테고리">
            {chartOrderCatalogCategories.map((item, index) => {
              const selected = category === item.value;
              return (
                <ClassificationExplorerOption
                  aria-controls="chart-order-catalog-results"
                  count={categoryCounts.get(item.value) ?? 0}
                  countLoading={status === "loading" || status === "idle"}
                  disabled={status === "loading" || status === "idle"}
                  key={item.value}
                  label={item.label}
                  onClick={() => selectCategory(item.value)}
                  onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                  ref={(node) => {
                    categoryTabRefs.current[index] = node;
                  }}
                  selected={selected}
                  tabIndex={selected ? 0 : -1}
                />
              );
            })}
          </ClassificationExplorerList>
        </ClassificationExplorerColumn>

        <ClassificationExplorerColumn
          className={orderCatalogDialogStyles.candidateColumn}
          label={`${categoryLabel} 오더`}
          scroll={false}
          header={
            <ClassificationExplorerSearchHeader
              buttonRef={searchButtonRef}
              count={categoryCounts.get(category) ?? 0}
              countLoading={status === "loading" || status === "idle"}
              countSuffix="개"
              disabled={status !== "ready"}
              inputProps={{
                "aria-activedescendant": visibleCandidates[activeCandidateIndex]
                  ? `chart-order-catalog-option-${getChartCatalogSourceKey(
                      visibleCandidates[activeCandidateIndex],
                    )}`
                  : undefined,
                "aria-controls": "chart-order-catalog-list",
                "aria-expanded": true,
                role: "combobox",
              }}
              inputRef={searchInputRef}
              label={`${categoryLabel} 오더`}
              placeholder={`${categoryLabel} 오더에서 오더명, 청구명 검색`}
              query={query}
              searchOpen={searchOpen}
              onCloseSearch={closeSearch}
              onKeyDown={handleSearchKeyDown}
              onOpenSearch={() => setSearchOpen(true)}
              openSearchAriaLabel={`${categoryLabel} 오더 검색 열기`}
              onQueryChange={(value) => {
                setActiveCandidateIndex(0);
                setQuery(value);
                candidateVirtualizer.scrollToOffset(0);
              }}
            />
          }
        >
          <ScrollArea
            className={orderCatalogDialogStyles.candidateBody}
            data-testid="chart-order-catalog-scroll"
            viewportRef={candidateScrollRef}
          >
            {status === "loading" || status === "idle" ? (
              <ClassificationExplorerLoadingState
                label="오더"
                message="오더를 불러오는 중입니다"
              />
            ) : status === "error" || status === "denied" ? (
              <div className={orderCatalogDialogStyles.feedback}>
                <EmrInlineAlert
                  action={
                    status === "error" ? (
                      <Button onClick={onRetry} size="sm" type="button">
                        다시 시도
                      </Button>
                    ) : undefined
                  }
                  severity={status === "error" ? "error" : "warning"}
                  title={
                    status === "error"
                      ? "오더를 불러오지 못했습니다"
                      : "오더 검색 권한이 없습니다"
                  }
                >
                  {status === "error"
                    ? "잠시 후 다시 시도해 주세요."
                    : "워크스페이스 관리자에게 권한을 확인해 주세요."}
                </EmrInlineAlert>
              </div>
            ) : visibleCandidates.length ? (
              <div
                aria-label={`${categoryLabel} 오더 검색 결과`}
                aria-multiselectable="true"
                className={orderCatalogDialogStyles.candidateList}
                id="chart-order-catalog-list"
                role="listbox"
                style={{ height: `${candidateVirtualizer.getTotalSize()}px` }}
              >
                {candidateVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = visibleCandidates[virtualRow.index];
                  const sourceKey = getChartCatalogSourceKey(row);
                  const locked = lockedCatalogSourceKeys.has(sourceKey);
                  const selected = selectedSourceKeys.has(sourceKey);
                  return (
                    <ClassificationExplorerOption
                      aria-label={`${row.displayName} ${
                        locked ? "이미 확정됨" : selected ? "선택 해제" : "선택"
                      }`}
                      className={orderCatalogDialogStyles.candidateOption}
                      data-active={
                        virtualRow.index === activeCandidateIndex && searchOpen
                          ? "true"
                          : undefined
                      }
                      data-testid={`chart-order-catalog-candidate-${row.sourcePresetId}`}
                      disabled={locked}
                      id={`chart-order-catalog-option-${sourceKey}`}
                      key={sourceKey}
                      label={row.displayName}
                      onClick={() => toggleSelectedRow(row)}
                      onMouseEnter={() =>
                        setActiveCandidateIndex(virtualRow.index)
                      }
                      selected={selected}
                      selectedIndicator
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      trailing={
                        <span
                          className={orderCatalogDialogStyles.candidatePrice}
                        >
                          {getCatalogCandidatePriceLabel(row)}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmrEmptyState
                kind={query ? "no-search-results" : "no-data"}
                surface="content"
                priority="supporting"
                title="조건에 맞는 오더가 없습니다"
                description="검색어를 지우거나 다른 분류를 선택해 주세요."
                className={orderCatalogDialogStyles.emptyState}
                primaryAction={
                  query ? (
                    <Button onClick={closeSearch} size="sm" type="button">
                      검색 초기화
                    </Button>
                  ) : undefined
                }
              />
            )}
          </ScrollArea>
        </ClassificationExplorerColumn>

        <ClassificationExplorerColumn
          className={orderCatalogDialogStyles.selectedColumn}
          label="선택한 오더"
          tone="muted"
          header={
            <ClassificationExplorerReviewHeading
              count={selectedRows.length}
              label="선택한 오더"
              onClear={() => {
                setSelectedRows([]);
                setDeselectedInitialSourceKeys(
                  new Set(initialSelectedCatalogSourceKeys),
                );
              }}
            />
          }
        >
          {selectedRows.length ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleSelectionDragEnd}
              sensors={sensors}
            >
              <SortableContext
                items={selectedRows.map(getChartCatalogSourceKey)}
                strategy={verticalListSortingStrategy}
              >
                <ClassificationExplorerList
                  ariaLabel="선택한 오더 순서"
                  selected
                >
                  {selectedRows.map((row) => {
                    const sourceKey = getChartCatalogSourceKey(row);
                    return (
                      <div
                        data-testid={`chart-order-catalog-selection-${row.sourcePresetId}`}
                        key={sourceKey}
                      >
                        <ClassificationExplorerSortableRow
                          id={sourceKey}
                          label={row.displayName}
                          onMove={(direction) =>
                            moveSelectedRow(sourceKey, direction)
                          }
                          onRemove={() => toggleSelectedRow(row)}
                          removeAriaLabel={`${row.displayName} 선택 해제`}
                          trailing={
                            <span
                              className={orderCatalogDialogStyles.selectedMeta}
                            >
                              {getChartOrderCatalogCategoryLabel(
                                row.categoryGroup,
                              )}{" "}
                              · {getCatalogCandidatePriceLabel(row)}
                            </span>
                          }
                        />
                      </div>
                    );
                  })}
                </ClassificationExplorerList>
              </SortableContext>
            </DndContext>
          ) : (
            <EmrEmptyState
              kind="no-data"
              surface="content"
              priority="supporting"
              title="선택한 오더가 없습니다"
              description="오더 목록에서 추가할 항목을 선택해 주세요."
              className={orderCatalogDialogStyles.emptyState}
            />
          )}
        </ClassificationExplorerColumn>

        <span aria-live="polite" className="sr-only">
          {liveStatusText}
        </span>
      </EmrDialogShell>
    </Dialog>
  );
}
function ChartOrderSetConfigurationDialog({
  onReturnFocus,
  candidate,
  error,
  loading,
  open,
  preview,
  rangeInput,
  onApply,
  onOpenChange,
  onPreview,
  onRangeInputChange,
}: {
  onReturnFocus?: () => HTMLElement | false;
  candidate: ChartOrderCatalogSearchRow | null;
  error?: string;
  loading: boolean;
  open: boolean;
  preview: ChartOrderSetPreview | null;
  rangeInput: string;
  onApply: (intent: ChartOrderSetSelectionIntent) => void;
  onOpenChange: (open: boolean) => void;
  onPreview: (rangeInput?: number) => void;
  onRangeInputChange: (value: string) => void;
}) {
  const [items, setItems] = useState<ChartOrderSetPreviewItemState[]>(
    () =>
      preview?.items.map((item) => ({
        revisionItemId: item.revisionItemId,
        selected: item.selected,
        quantity: String(item.quantity),
        quantitySource: item.quantitySource,
        displayName:
          typeof item.appliedSnapshot?.appliedDisplayName === "string"
            ? item.appliedSnapshot.appliedDisplayName
            : typeof item.appliedSnapshot?.inHospitalOrderName === "string"
              ? item.appliedSnapshot.inHospitalOrderName
              : typeof item.appliedSnapshot?.standardOrderName === "string"
                ? item.appliedSnapshot.standardOrderName
                : typeof item.appliedSnapshot?.displayName === "string"
                  ? item.appliedSnapshot.displayName
                  : item.workspaceCatalogItemId,
      })) ?? [],
  );

  const isRangePrice =
    (preview?.set.rangeBasis ?? candidate?.sourceSetRangeBasis) !== null &&
    (preview?.set.amountBasis ?? candidate?.sourceSetAmountBasis) ===
      "range_price";
  const hasRangeInput =
    isRangePrice &&
    rangeInput.trim() !== "" &&
    Number.isFinite(Number(rangeInput));
  const hasSelectedItem = items.some((item) => item.selected);
  const hasInvalidQuantity = items.some(
    (item) =>
      !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0,
  );
  const title =
    preview?.set.displayName ?? candidate?.displayName ?? "Order 세트";
  const disabled =
    loading ||
    !hasSelectedItem ||
    hasInvalidQuantity ||
    (isRangePrice && !hasRangeInput);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0" finalFocus={onReturnFocus}>
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{title} 구성 선택</DialogTitle>
          <DialogDescription>
            구성 항목을 선택하고 적용 수량을 입력해 주세요. 고정 1회 수량은
            변경할 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 p-5">
          {isRangePrice ? (
            <label className="grid gap-1 emr-text-metadata">
              <span className="font-medium">가격 범위 입력</span>
              <Input
                aria-label="Order 세트 가격 범위 입력"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={rangeInput}
                onChange={(event) => onRangeInputChange(event.target.value)}
                placeholder={
                  preview?.set.rangeBasis === "patient_weight_kg"
                    ? "환자 체중(kg)"
                    : "범위 값"
                }
              />
              <span className="text-muted-foreground">
                {preview?.set.rangeBasis === "patient_weight_kg"
                  ? "환자 체중(kg)을 입력해 주세요."
                  : "적용할 수치 범위를 입력해 주세요."}
              </span>
            </label>
          ) : null}

          {preview ? (
            <div className="grid max-h-[360px] gap-2 overflow-y-auto rounded-[var(--emr-radius-control)] border p-2">
              {preview.items.map((previewItem) => {
                const item = items.find(
                  (candidateItem) =>
                    candidateItem.revisionItemId === previewItem.revisionItemId,
                );
                if (!item) return null;
                const quantityDisabled = item.quantitySource === "fixed_one";

                return (
                  <div
                    key={previewItem.revisionItemId}
                    className="grid grid-cols-[auto_minmax(0,1fr)_7rem] items-center gap-2 rounded-md border bg-card px-3 py-2"
                  >
                    <EmrTableCheckbox
                      aria-label={`${item.displayName} 구성 선택`}
                      checked={item.selected}
                      disabled={loading}
                      onCheckedChange={(checked) =>
                        setItems((current) =>
                          current.map((currentItem) =>
                            currentItem.revisionItemId === item.revisionItemId
                              ? { ...currentItem, selected: Boolean(checked) }
                              : currentItem,
                          ),
                        )
                      }
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.displayName}
                      </div>
                      <div className="emr-text-metadata text-muted-foreground">
                        {quantityDisabled ? "고정 1회" : "적용 수량 입력 가능"}
                      </div>
                    </div>
                    <Input
                      aria-label={`${item.displayName} 구성 수량`}
                      data-row-interactive="true"
                      disabled={loading || quantityDisabled}
                      inputMode="decimal"
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((currentItem) =>
                            currentItem.revisionItemId === item.revisionItemId
                              ? { ...currentItem, quantity: event.target.value }
                              : currentItem,
                          ),
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/20 p-3 emr-text-metadata text-muted-foreground">
              {isRangePrice
                ? "범위 값을 입력한 뒤 미리보기를 불러와 주세요."
                : "구성 미리보기를 불러오는 중입니다."}
            </div>
          )}

          {error ? (
            <EmrInlineAlert
              severity="error"
              title="Order 세트를 적용할 수 없습니다"
            >
              {error}
            </EmrInlineAlert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            {!preview ? (
              <Button
                disabled={loading || (isRangePrice && !hasRangeInput)}
                onClick={() =>
                  onPreview(
                    isRangePrice && hasRangeInput
                      ? Number(rangeInput)
                      : undefined,
                  )
                }
              >
                {loading ? "불러오는 중" : "구성 미리보기"}
              </Button>
            ) : (
              <Button
                disabled={disabled}
                onClick={() => {
                  const selectionIntent = {
                    items: items.map((item) => ({
                      revisionItemId: item.revisionItemId,
                      selected: item.selected,
                      quantity: Number(item.quantity),
                    })),
                    ...(isRangePrice ? { rangeInput: Number(rangeInput) } : {}),
                  } satisfies ChartOrderSetSelectionIntent;
                  onApply(selectionIntent);
                }}
              >
                구성 적용
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ChartOrderSetPreviewItemState = {
  displayName: string;
  quantity: string;
  quantitySource: ChartOrderSetPreviewItem["quantitySource"];
  revisionItemId: string;
  selected: boolean;
};

function OrderArea({
  actorHeaders,
  bundle,
  collapseContentId,
  collapsed,
  loading,
  onCollapsedChange,
  onNavigateToBilling,
  onNavigateToDispensing,
  orderGroups,
  writeDisabled,
}: {
  actorHeaders?: Record<string, string>;
  bundle: ChartBundle;
  collapseContentId: string;
  collapsed: boolean;
  loading: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onNavigateToBilling?: (invoiceId: string) => void;
  onNavigateToDispensing?: () => void;
  orderGroups: ChartOrderGroup[];
  writeDisabled: boolean;
}) {
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const initialDraftRows = useMemo(
    () => getChartOrderDraftRows(orderGroups),
    [orderGroups],
  );
  const [committedRows, setCommittedRows] =
    useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [draftRows, setDraftRowsState] =
    useState<ChartOrderDraftRow[]>(initialDraftRows);
  const draftRowsRef = useRef(draftRows);
  const setDraftRows = useCallback(
    (nextRows: SetStateAction<ChartOrderDraftRow[]>) => {
      setDraftRowsState((currentRows) => {
        const resolvedRows =
          typeof nextRows === "function" ? nextRows(currentRows) : nextRows;
        draftRowsRef.current = resolvedRows;
        return resolvedRows;
      });
    },
    [],
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [orderActionDialog, setOrderActionDialog] =
    useState<OrderActionDialogType | null>(null);
  const [deleteOrderIds, setDeleteOrderIds] = useState<string[]>([]);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [orderExecution, setOrderExecution] =
    useState<ChartOrderExecutionReadModel>();
  const [billingSummary, setBillingSummary] =
    useState<ChartOrderBillingSummary>();
  const billingSummaryRef = useRef<ChartOrderBillingSummary | undefined>(
    undefined,
  );
  const billingSummaryRequestSequenceRef = useRef(0);
  const [billingSummaryFreshness, setBillingSummaryFreshness] =
    useState<ChartOrderBillingSummaryFreshness>("loading");
  const [billingDrawerOpen, setBillingDrawerOpen] = useState(false);
  const [billingRequesting, setBillingRequesting] = useState(false);
  const [billingSummaryError, setBillingSummaryError] = useState<string>();
  const [billingRequestError, setBillingRequestError] = useState<string>();
  const [prebillingSavingOrderIds, setPrebillingSavingOrderIds] = useState<
    Set<string>
  >(() => new Set());
  const prebillingSavingOrderIdsRef = useRef<Set<string>>(new Set());
  const [actualDispenseSavingOrderIds, setActualDispenseSavingOrderIds] =
    useState<Set<string>>(() => new Set());
  const actualDispenseSavingOrderIdsRef = useRef<Set<string>>(new Set());
  const [intendedAssigneeOptionsByOrderId, setIntendedAssigneeOptionsByOrderId] =
    useState<Record<string, FulfillmentEligibleAssignee[]>>({});
  const [intendedAssigneeLoadingOrderIds, setIntendedAssigneeLoadingOrderIds] =
    useState<Set<string>>(() => new Set());
  const intendedAssigneeLoadingOrderIdsRef = useRef<Set<string>>(new Set());
  const [intendedAssigneeSavingOrderIds, setIntendedAssigneeSavingOrderIds] =
    useState<Set<string>>(() => new Set());
  const intendedAssigneeSavingOrderIdsRef = useRef<Set<string>>(new Set());
  const [orderMutationDraft, setOrderMutationDraft] =
    useState<ChartOrderMutationDraft | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogInitialQuery, setCatalogInitialQuery] = useState("");
  const [quickAddRequested, setQuickAddOpen] = useState(false);
  const quickAddOpen = quickAddRequested && draftRows.length > 0 && !writeDisabled;
  const [quickAddQuery, setQuickAddQuery] = useState("");
  const [quickAddActiveIndex, setQuickAddActiveIndex] = useState(-1);
  const [quickAddedSourceKey, setQuickAddedSourceKey] = useState<string>();
  const [quickAddHighlightedKey, setQuickAddHighlightedKey] = useState<string>();
  const quickAddResultsRef = useRef<HTMLDivElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const quickAddTriggerRef = useRef<HTMLButtonElement>(null);
  const [quickAddReturn, setQuickAddReturn] = useState(false);
  const quickAddPendingSourceKeysRef = useRef(new Set<string>());
  const quickAddListId = useId();
  const setPreviewRequestSequenceRef = useRef(0);
  useEffect(() => () => { setPreviewRequestSequenceRef.current += 1; }, []);
  const catalogRequestSequenceRef = useRef(0);
  useEffect(() => () => { catalogRequestSequenceRef.current += 1; }, []);
  const [catalogRows, setCatalogRows] = useState<ChartOrderCatalogSearchRow[]>(
    [],
  );
  const [catalogSearchStatus, setCatalogSearchStatus] =
    useState<ChartOrderCatalogStatus>("idle");
  const [catalogSelectionQueue, setCatalogSelectionQueue] = useState<
    ChartOrderCatalogSearchRow[]
  >([]);
  const [setCandidate, setSetCandidate] =
    useState<ChartOrderCatalogSearchRow | null>(null);
  const [setPreview, setSetPreview] = useState<ChartOrderSetPreview | null>(
    null,
  );
  const [setRangeInput, setSetRangeInput] = useState("");
  const [setPreviewError, setSetPreviewError] = useState<string | undefined>();
  const [setPreviewLoading, setSetPreviewLoading] = useState(false);
  const [unavailableAction, setUnavailableAction] = useState<{
    action: ChartUnavailableAction;
    targetName?: string;
  } | null>(null);
  const [orderSortState, setOrderSortState] =
    useState<ChartOrderSortState>(null);
  const [orderDraftSaveState, setOrderDraftSaveState] = useState<
    "idle" | "loading" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const [orderDraftEtag, setOrderDraftEtag] = useState<string | undefined>();
  const orderDraftEtagRef = useRef(orderDraftEtag);
  const [orderDraftReloadKey, setOrderDraftReloadKey] = useState(0);
  const draftTouchedRef = useRef(false);
  const draftEditVersionRef = useRef(0);
  const draftSaveDelayMsRef = useRef(chartOrderContinuousSaveDelayMs);
  const orderDraftFailedAutoSaveVersionRef = useRef<number | null>(null);
  const orderDraftConflictRef = useRef(false);
  const orderDraftSaveInFlightRef = useRef(false);
  const orderDraftSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const autoSaveDraftRef = useRef<() => Promise<boolean>>(async () => false);
  const inFlightDraftOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingAddedOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingRemovedRootOrderIdsRef = useRef<Set<string>>(new Set());
  const [pendingRemovedRootOrderIds, setPendingRemovedRootOrderIds] = useState<
    Set<string>
  >(() => new Set());
  const markDraftTouched = (
    saveTiming: "continuous" | "discrete" = "continuous",
  ) => {
    draftTouchedRef.current = true;
    draftEditVersionRef.current += 1;
    draftSaveDelayMsRef.current =
      saveTiming === "discrete"
        ? chartOrderDiscreteSaveDelayMs
        : chartOrderContinuousSaveDelayMs;
    orderDraftFailedAutoSaveVersionRef.current = null;
  };
  const pendingConfirmationRef = useRef<{
    actualRecords: ChartActualRecords;
    expectedEtag: string;
    idempotencyKey: string;
    orderIds: string[];
  } | null>(null);
  const pendingBillingRequestRef = useRef<{
    expectedEtag: string;
    idempotencyKey: string;
  } | null>(null);
  const orderLoading = loading || orderDraftSaveState === "loading";
  const pendingRemovalOrderIds = useMemo(
    () =>
      new Set(
        draftRows
          .filter(
            (row) =>
              pendingRemovedRootOrderIds.has(row.order.id) ||
              Boolean(
                row.runtimeRow?.parentOrderId &&
                pendingRemovedRootOrderIds.has(row.runtimeRow.parentOrderId),
              ),
          )
          .map((row) => row.order.id),
      ),
    [draftRows, pendingRemovedRootOrderIds],
  );
  const allOrders = useMemo(
    () => draftRows.map(({ order }) => order),
    [draftRows],
  );
  const catalogDialogSelection = useMemo(() => {
    const initialSelectedSourceKeys: string[] = [];
    const lockedSourceKeys = new Set<string>();

    draftRows.forEach((row) => {
      const sourceKey = getChartDraftRowCatalogSourceKey(row);
      if (!sourceKey) return;
      if (isChartOrderConfirmedRow(row) || !isChartOrderTopLevelRow(row)) {
        lockedSourceKeys.add(sourceKey);
        return;
      }
      if (!initialSelectedSourceKeys.includes(sourceKey)) {
        initialSelectedSourceKeys.push(sourceKey);
      }
    });

    return {
      initialSelectedSourceKeys: initialSelectedSourceKeys.filter(
        (sourceKey) => !lockedSourceKeys.has(sourceKey),
      ),
      lockedSourceKeys,
    };
  }, [draftRows]);
  const orderCountByType = draftRows.reduce<Record<ClinicalOrderType, number>>(
    (counts, row) => ({
      ...counts,
      [getChartOrderClinicalType(row)]:
        counts[getChartOrderClinicalType(row)] + 1,
    }),
    {
      clinical_lab: 0,
      consultation: 0,
      dispensing: 0,
      external_lab: 0,
      hospitalization: 0,
      imaging: 0,
      other: 0,
      system_exam: 0,
      treatment: 0,
    },
  );
  const orderTabItems = chartOrderTabs.map((tab) => ({
    ...tab,
    count: tab.value === "all" ? allOrders.length : orderCountByType[tab.value],
  }));
  const filteredOrderRows = draftRows.filter(
    (row) =>
      orderFilter === "all" || getChartOrderClinicalType(row) === orderFilter,
  );
  const visibleOrderRows = filteredOrderRows;
  const quickAddedRow = draftRows.find((row) => getChartDraftRowCatalogSourceKey(row) === quickAddedSourceKey);
  const quickAddedHidden = quickAddedRow && !visibleOrderRows.includes(quickAddedRow);
  const quickAddExistingKeys = useMemo(() => new Set(draftRows.map(getChartDraftRowCatalogSourceKey)), [draftRows]);
  const quickAddConfirmedKeys = useMemo(() => new Set(draftRows.filter(isChartOrderConfirmedRow).map(getChartDraftRowCatalogSourceKey)), [draftRows]);
  const quickAddCandidates = useMemo(() => {
    const query = quickAddQuery.trim().toLocaleLowerCase();
    if (!query || catalogSearchStatus !== "ready") return [];
    const rank = (row: ChartOrderCatalogSearchRow) => {
      const name = row.displayName.toLocaleLowerCase();
      return name === query ? 0 : name.startsWith(query) ? 1 : 2;
    };
    return catalogRows.filter((row) =>
      isCatalogCandidateTargetingPatient(row, bundle.patient.species) &&
      [row.displayName, row.billingName].some((name) => name.toLocaleLowerCase().includes(query)),
    ).sort((left, right) => rank(left) - rank(right));
  }, [bundle.patient.species, catalogRows, catalogSearchStatus, quickAddQuery]);
  const quickAddEligibleIndexes = quickAddCandidates.flatMap((row, index) =>
    quickAddExistingKeys.has(getChartCatalogSourceKey(row)) ? [] : [index],
  );
  const quickAddActive = quickAddEligibleIndexes.includes(quickAddActiveIndex)
    ? quickAddActiveIndex : (quickAddEligibleIndexes[0] ?? -1);
  useEffect(() => {
    quickAddPendingSourceKeysRef.current.clear();
  }, [draftRows]);
  useEffect(() => {
    if (quickAddOpen) quickAddInputRef.current?.focus();
  }, [quickAddOpen]);
  useEffect(() => {
    const results = quickAddResultsRef.current;
    const active = document.getElementById(`${quickAddListId}-${quickAddActive}`);
    if (!quickAddOpen || !results || !active) return;
    const viewport = results.getBoundingClientRect();
    const option = active.getBoundingClientRect();
    if (option.top < viewport.top) results.scrollTop -= viewport.top - option.top;
    else if (option.bottom > viewport.bottom) results.scrollTop += option.bottom - viewport.bottom;
  }, [quickAddActive, quickAddListId, quickAddOpen, quickAddQuery]);
  useEffect(() => {
    if (!quickAddHighlightedKey) return;
    const timer = window.setTimeout(() => setQuickAddHighlightedKey(undefined), 1500);
    return () => window.clearTimeout(timer);
  }, [quickAddHighlightedKey]);
  const selectedAmount = draftRows.reduce((sum, row) => {
    if (!selectedOrderIds.has(row.order.id)) return sum;

    return sum + (getDraftLineTotal(row) ?? 0);
  }, 0);
  const localBillingSummary = useMemo<ChartOrderBillingSummary>(() => {
    const activeRows = draftRows.filter(
      (row) => row.order.status !== "cancelled",
    );
    const activeTopLevelRows = activeRows.filter(isChartOrderTopLevelRow);
    const confirmedRows = activeRows.filter(isChartOrderConfirmedRow);
    const confirmedTopLevelRows = activeTopLevelRows.filter(
      isChartOrderConfirmedRow,
    );
    const draftOnlyRows = activeRows.filter(
      (row) => !isChartOrderConfirmedRow(row),
    );
    const draftTopLevelRows = activeTopLevelRows.filter(
      (row) => !isChartOrderConfirmedRow(row),
    );
    const confirmedAmount = confirmedRows.reduce(
      (sum, row) => sum + getChartOrderDraftBillableAmount(row),
      0,
    );
    const draftAmount = draftOnlyRows.reduce(
      (sum, row) => sum + getChartOrderDraftBillableAmount(row),
      0,
    );
    const requestableRows = confirmedRows.filter(
      (row) => row.billingCandidateStatus === "candidate_created",
    );
    const requestedRows = confirmedRows.filter(
      (row) => row.billingCandidateStatus === "invoice_linked",
    );
    return {
      workspaceId: bundle.encounter.workspaceId,
      encounterId: bundle.encounter.id,
      etag: '"local-summary"',
      generatedAt: new Date(0).toISOString(),
      currency: "KRW",
      context: null,
      invoiceId: null,
      orderCounts: {
        total: activeTopLevelRows.length,
        confirmed: confirmedTopLevelRows.length,
        draft: draftTopLevelRows.length,
        recheck: activeTopLevelRows.filter(
          (row) => row.order.status === "re_requested",
        ).length,
        requested: requestedRows.length,
        requestable: requestableRows.length,
        cancelled: draftRows.filter(
          (row) =>
            row.order.status === "cancelled" && isChartOrderTopLevelRow(row),
        ).length,
      },
      amounts: {
        gross: confirmedAmount + draftAmount,
        confirmed: confirmedAmount,
        draft: draftAmount,
        discount: 0,
        surcharge: 0,
        tax: 0,
        paid: 0,
        outstanding: 0,
        estimatedTotal: confirmedAmount + draftAmount,
        requestableTotal: requestableRows.reduce(
          (sum, row) => sum + getChartOrderDraftBillableAmount(row),
          0,
        ),
      },
      requestableOrderIds: requestableRows.map((row) => row.order.id),
      unfinishedOrders: [],
    };
  }, [bundle.encounter.id, bundle.encounter.workspaceId, draftRows]);
  const selectedOrderRows = draftRows.filter(({ order }) =>
    selectedOrderIds.has(order.id),
  );
  const [chartActualDrafts, setChartActualDrafts] = useState<Record<string, ChartActualDraft>>({});
  const chartActualRows: ChartActualConfirmationRow[] = draftRows.flatMap(row => {
    const type = getChartOrderClinicalType(row);
    const selected = selectedOrderIds.has(row.order.id) || (row.runtimeRow?.parentOrderId && selectedOrderIds.has(row.runtimeRow.parentOrderId));
    const destination = row.runtimeRow ? row.runtimeRow.destinationModule : getChartOrderCanonicalDefaults(row.order).destinationModule;
    return selected && row.runtimeRow?.rowType !== "set" && !isChartOrderConfirmedRow(row) && !destination && isChartActualType(type)
      ? [{ orderId: row.order.id, name: row.order.displayName, type, findingSummary: typeof row.detailInputs.findingSummary === "string" ? row.detailInputs.findingSummary : undefined }] : [];
  });
  const chartActualRecords = buildChartActualRecords(chartActualRows, chartActualDrafts);
  const selectedOrders = selectedOrderRows.map(({ order }) => order);
  const selectedRecheckOrderCount = selectedOrders.filter(
    (order) => order.status === "re_requested",
  ).length;
  const deletedDraftOrderCount = committedRows.filter(
    (row) =>
      !isChartOrderConfirmedRow(row) &&
      (pendingRemovedRootOrderIds.has(row.order.id) ||
        draftRows.every((draftRow) => draftRow.order.id !== row.order.id)),
  ).length;
  const changedDraftOrderCount =
    draftRows.filter((row) => {
      if (isChartOrderConfirmedRow(row)) return false;
      const committedRow = committedRows.find(
        ({ order }) => order.id === row.order.id,
      );

      return committedRow ? isChartOrderDraftRowDirty(row) : true;
    }).length + deletedDraftOrderCount;
  const draftSaveInvalidOrderIds = new Set<string>();
  const confirmationInvalidOrderIds = new Set<string>();
  for (const row of draftRows) {
    if (pendingRemovalOrderIds.has(row.order.id)) continue;
    if (getDraftQuantity(row.quantityInput) === null) {
      draftSaveInvalidOrderIds.add(row.order.id);
      confirmationInvalidOrderIds.add(row.order.id);
    }
    if (
      isChartOrderConfirmedRow(row) ||
      row.runtimeRow?.rowType === "set" ||
      !isChartOrderSetChildIncluded(row)
    ) {
      continue;
    }
    const partialValidation = validateClinicalOrderDetailInputs({
      clinicalOrderType: getChartOrderClinicalType(row),
      detailInputs: row.detailInputs,
      requireComplete: false,
      schemaVersion: row.detailSchemaVersion,
    });
    if (!partialValidation.valid) {
      draftSaveInvalidOrderIds.add(row.order.id);
      confirmationInvalidOrderIds.add(row.order.id);
    }
    const confirmationValidation = validateClinicalOrderDetailInputs({
      clinicalOrderType: getChartOrderClinicalType(row),
      detailInputs: row.detailInputs,
      requireComplete: true,
      schemaVersion: row.detailSchemaVersion,
    });
    if (!confirmationValidation.valid) {
      confirmationInvalidOrderIds.add(row.order.id);
      if (row.runtimeRow?.parentOrderId) {
        confirmationInvalidOrderIds.add(row.runtimeRow.parentOrderId);
      }
    }
    if (!isChartOrderActualDispenseConfirmationValid(row)) {
      confirmationInvalidOrderIds.add(row.order.id);
      if (row.runtimeRow?.parentOrderId) {
        confirmationInvalidOrderIds.add(row.runtimeRow.parentOrderId);
      }
    }
  }
  const hasDraftChanges = changedDraftOrderCount > 0;
  const canUpdateOrders =
    hasDraftChanges &&
    draftSaveInvalidOrderIds.size === 0 &&
    orderDraftSaveState !== "conflict";
  const deleteTargetRows = draftRows.filter(({ order }) =>
    deleteOrderIds.includes(order.id),
  );
  const detailOrderRow = draftRows.find(
    ({ order }) => order.id === detailOrderId,
  );
  const historyOrderRow = draftRows.find(
    ({ order }) => order.id === historyOrderId,
  );
  const mutationOrderRow = draftRows.find(
    ({ order }) => order.id === orderMutationDraft?.orderId,
  );
  const [orderTableDensity, setOrderTableDensity] =
    useState<EmrTableDensity>("compact");
  const handleOrderSort = (key: ChartOrderSortKey) => {
    setOrderSortState((current) => {
      if (current?.key !== key) return { direction: "asc", key };
      if (current.direction === "asc") return { direction: "desc", key };

      return null;
    });
  };
  const updateDraftRow = (
    orderId: string,
    nextFields: Partial<
      Pick<ChartOrderDraftRow, "billingName" | "quantityInput">
    >,
  ) => {
    if (writeDisabled) return;
    markDraftTouched();
    setDraftRows((currentRows) => {
      const target = currentRows.find((row) => row.order.id === orderId);
      const nextRows = currentRows.map((row) =>
        row.order.id === orderId
          ? {
              ...row,
              ...nextFields,
            }
          : row,
      );
      if (
        target?.runtimeRow?.rowType !== "set_child" ||
        nextFields.quantityInput === undefined
      ) {
        return nextRows;
      }

      const quantity = getDraftQuantity(nextFields.quantityInput);
      if (quantity === null || !target.runtimeRow.parentOrderId) {
        return nextRows;
      }
      return nextRows.map((row) => {
        if (row.order.id !== target.runtimeRow?.parentOrderId) return row;
        const currentIntent =
          row.setSelectionIntent ??
          getChartOrderSetSelectionIntentForDraftRow(row);
        if (!currentIntent) return row;
        return {
          ...row,
          setSelectionIntent: {
            ...currentIntent,
            items: currentIntent.items.map((item) =>
              item.revisionItemId === target.runtimeRow?.sourceSetRevisionItemId
                ? { ...item, quantity }
                : item,
            ),
          },
        };
      });
    });
  };
  const updateDraftDetailInput = (
    orderId: string,
    fieldKey: string,
    value: unknown | undefined,
  ) => {
    if (writeDisabled) return;
    markDraftTouched();
    setDraftRows((currentRows) =>
      currentRows.map((row) => {
        if (row.order.id !== orderId || isChartOrderConfirmedRow(row)) {
          return row;
        }
        const detailInputs = { ...row.detailInputs };
        if (value === undefined || value === "") {
          delete detailInputs[fieldKey];
        } else {
          detailInputs[fieldKey] = value;
        }
        return { ...row, detailInputs };
      }),
    );
  };
  const updateDraftPriority = (
    orderId: string,
    priority: ClinicalOrderPriority,
  ) => {
    if (writeDisabled) return;
    markDraftTouched("discrete");
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        row.order.id === orderId && !isChartOrderConfirmedRow(row)
          ? {
              ...row,
              order: { ...row.order, priority },
              priority,
            }
          : row,
      ),
    );
  };
  const toggleSetChild = (orderId: string) => {
    if (writeDisabled) return;
    markDraftTouched("discrete");
    setDraftRows((currentRows) => {
      const child = currentRows.find((row) => row.order.id === orderId);
      const parentId = child?.runtimeRow?.parentOrderId;
      const revisionItemId = child?.runtimeRow?.sourceSetRevisionItemId;
      if (!child || !parentId || !revisionItemId) return currentRows;
      const included = isChartOrderSetChildIncluded(child);
      return currentRows.map((row) => {
        if (row.order.id === orderId) {
          return { ...row, setChildIncluded: !included };
        }
        if (row.order.id !== parentId || isChartOrderConfirmedRow(row)) {
          return row;
        }
        const currentIntent =
          row.setSelectionIntent ??
          getChartOrderSetSelectionIntentForDraftRow(row);
        if (!currentIntent) return row;
        return {
          ...row,
          setPreview: row.setPreview
            ? {
                ...row.setPreview,
                items: row.setPreview.items.map((item) =>
                  item.revisionItemId === revisionItemId
                    ? { ...item, selected: !included }
                    : item,
                ),
              }
            : row.setPreview,
          setSelectionIntent: {
            ...currentIntent,
            items: currentIntent.items.map((item) =>
              item.revisionItemId === revisionItemId
                ? { ...item, selected: !included }
                : item,
            ),
          },
        };
      });
    });
  };
  const loadCatalogRows = async () => {
    const sequence = ++catalogRequestSequenceRef.current;
    setCatalogRows([]);
    setCatalogSearchStatus("loading");
    const result = await loadChartOrderCatalog({
      actorHeaders,
      workspaceId: bundle.encounter.workspaceId,
    });
    if (sequence !== catalogRequestSequenceRef.current) return;

    if (!result.ok) {
      setCatalogSearchStatus(
        result.status === 401 || result.status === 403 ? "denied" : "error",
      );
      return;
    }

    setCatalogRows(result.rows);
    setCatalogSearchStatus("ready");
  };
  const openCatalogDialog = () => {
    if (writeDisabled) return;
    setCatalogInitialQuery("");
    setQuickAddReturn(false);
    setQuickAddOpen(false);
    if (collapsed) onCollapsedChange(false);
    setCatalogDialogOpen(true);
    void loadCatalogRows();
  };
  const openQuickAdd = () => {
    if (writeDisabled || !draftRowsRef.current.length || orderDraftSaveState === "loading" || orderDraftSaveState === "conflict") return;
    setQuickAddReturn(false);
    setQuickAddOpen(true);
    setQuickAddActiveIndex(-1);
    void loadCatalogRows();
  };
  const closeQuickAdd = (restoreFocus = false) => {
    setQuickAddOpen(false);
    if (restoreFocus) requestAnimationFrame(() => quickAddTriggerRef.current?.focus());
  };
  const returnToQuickAdd = () => {
    if (!quickAddReturn || setCandidate || catalogDialogOpen || writeDisabled || !draftRowsRef.current.length) return false;
    setQuickAddOpen(true);
    requestAnimationFrame(() => quickAddInputRef.current?.focus());
    return quickAddInputRef.current ?? false;
  };
  const openDetailedOrderSearch = () => {
    setQuickAddReturn(true);
    setCatalogInitialQuery(quickAddQuery);
    closeQuickAdd();
    setCatalogDialogOpen(true);
    void loadCatalogRows();
  };
  const resetSetConfiguration = () => {
    setPreviewRequestSequenceRef.current += 1;
    setSetCandidate(null);
    setSetPreview(null);
    setSetRangeInput("");
    setSetPreviewError(undefined);
    setSetPreviewLoading(false);
  };
  const closeSetConfiguration = () => {
    if (quickAddReturn) setQuickAddOpen(true);
    quickAddPendingSourceKeysRef.current.clear();
    setCatalogSelectionQueue([]);
    resetSetConfiguration();
  };
  const requestSetPreview = async (
    row: ChartOrderCatalogSearchRow,
    selectionIntent: ChartOrderSetSelectionIntent,
  ) => {
    const requestSequence = ++setPreviewRequestSequenceRef.current;
    setSetPreviewLoading(true);
    setSetPreviewError(undefined);
    const result = await loadChartOrderSetPreview({
      actorHeaders,
      encounterId: bundle.encounter.id,
      orderSetId: row.sourceSetId ?? row.sourcePresetId,
      revisionId: row.sourceSetRevisionId ?? "",
      selectionIntent,
      workspaceId: bundle.encounter.workspaceId,
    });
    if (requestSequence !== setPreviewRequestSequenceRef.current) return undefined;
    setSetPreviewLoading(false);
    if (!result.ok) {
      setSetPreviewError(
        result.denialReason === "permission_missing" ||
          result.denialReason === "workspace_membership_missing"
          ? "오더 수정 권한이 없어 Order 세트를 확인하지 못했어요."
          : result.denialReason === "unauthenticated"
            ? "로그인 후 Order 세트를 확인해 주세요."
            : result.error === "order_set_range_input_required"
              ? "가격 범위 값을 입력해 주세요."
              : result.error === "order_set_range_no_match"
                ? "입력한 범위에 맞는 가격 구간이 없습니다."
                : result.error === "order_set_empty_selection"
                  ? "Order 세트에 선택된 구성 항목이 없어요."
                  : getChartOrderPersistenceErrorMessage(result.error),
      );
      return undefined;
    }
    setSetPreview(result.preview);
    return result.preview;
  };
  const appendCatalogRowsToDraft = (rows: ChartOrderCatalogSearchRow[]) => {
    if (!rows.length) return;
    const firstSortOrder = draftRowsRef.current.length + 1;
    const appendedRows = rows.map((row, index) =>
      buildChartOrderDraftRowFromCatalog({
        bundle,
        row,
        sortOrder: (firstSortOrder + index) * 10,
      }),
    );
    appendedRows.forEach((row) =>
      pendingAddedOrderIdsRef.current.add(row.order.id),
    );
    markDraftTouched("discrete");
    setDraftRows((currentRows) => [...currentRows, ...appendedRows]);
    toast.info(`선택한 Order ${appendedRows.length}개를 추가했어요 · 저장 중`);
  };
  const processCatalogSelection = (rows: ChartOrderCatalogSearchRow[]) => {
    const nextSetIndex = rows.findIndex((row) => row.rowType === "set");
    const immediateRows =
      nextSetIndex === -1 ? rows : rows.slice(0, nextSetIndex);
    appendCatalogRowsToDraft(immediateRows);

    if (nextSetIndex === -1) {
      return;
    }

    const row = rows[nextSetIndex];
    setCatalogSelectionQueue(rows.slice(nextSetIndex + 1));
    setSetCandidate(row);
    setSetPreview(null);
    setSetPreviewError(undefined);
    setSetRangeInput("");
    setCatalogDialogOpen(false);
    if (collapsed) onCollapsedChange(false);
    if (row.sourceSetAmountBasis !== "range_price") {
      void requestSetPreview(row, { items: [] });
    }
  };
  const addQuickCandidate = (candidate: ChartOrderCatalogSearchRow) => {
    if (writeDisabled || catalogSearchStatus !== "ready" || orderDraftSaveState === "loading" || orderDraftSaveState === "conflict") return;
    const key = getChartCatalogSourceKey(candidate);
    if (quickAddPendingSourceKeysRef.current.has(key) || draftRowsRef.current.some((row) => getChartDraftRowCatalogSourceKey(row) === key)) return;
    quickAddPendingSourceKeysRef.current.add(key);
    if (candidate.rowType === "set") {
      setQuickAddReturn(true);
      closeQuickAdd();
    } else {
      setQuickAddQuery("");
      setQuickAddActiveIndex(-1);
      setQuickAddedSourceKey(key);
      setQuickAddHighlightedKey(key);
    }
    processCatalogSelection([candidate]);
  };
  const handleQuickAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeQuickAdd(true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (quickAddActive >= 0) addQuickCandidate(quickAddCandidates[quickAddActive]);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!quickAddEligibleIndexes.length) return;
      const current = quickAddEligibleIndexes.indexOf(quickAddActive);
      const offset = event.key === "ArrowDown" ? 1 : -1;
      setQuickAddActiveIndex(quickAddEligibleIndexes[(current + offset + quickAddEligibleIndexes.length) % quickAddEligibleIndexes.length]);
    }
  };
  const applyCatalogSelection = (
    rows: ChartOrderCatalogSearchRow[],
    selectedSourceKeys: Set<string>,
  ) => {
    if (writeDisabled) return;
    const currentRows = draftRowsRef.current;
    const childRowsByParentId = new Map<string, ChartOrderDraftRow[]>();
    currentRows.forEach((row) => {
      const parentOrderId = row.runtimeRow?.parentOrderId;
      if (!parentOrderId) return;
      childRowsByParentId.set(parentOrderId, [
        ...(childRowsByParentId.get(parentOrderId) ?? []),
        row,
      ]);
    });
    const knownParentIds = new Set(
      currentRows.filter(isChartOrderTopLevelRow).map((row) => row.order.id),
    );
    const groups = currentRows.flatMap((row) => {
      if (
        row.runtimeRow?.parentOrderId &&
        knownParentIds.has(row.runtimeRow.parentOrderId)
      ) {
        return [];
      }
      return [[row, ...(childRowsByParentId.get(row.order.id) ?? [])]];
    });
    const isSelectableCatalogGroup = (group: ChartOrderDraftRow[]) => {
      const root = group[0];
      const sourceKey = getChartDraftRowCatalogSourceKey(root);
      return (
        isChartOrderTopLevelRow(root) &&
        !isChartOrderConfirmedRow(root) &&
        sourceKey !== undefined &&
        !catalogDialogSelection.lockedSourceKeys.has(sourceKey)
      );
    };
    const selectableGroups = groups.filter(isSelectableCatalogGroup);
    const existingGroupBySourceKey = new Map(
      selectableGroups.flatMap((group) => {
        const sourceKey = getChartDraftRowCatalogSourceKey(group[0]);
        return sourceKey ? [[sourceKey, group] as const] : [];
      }),
    );
    const orderedExistingSourceKeys = rows
      .map(getChartCatalogSourceKey)
      .filter(
        (sourceKey) =>
          selectedSourceKeys.has(sourceKey) &&
          existingGroupBySourceKey.has(sourceKey),
      );
    existingGroupBySourceKey.forEach((_group, sourceKey) => {
      if (
        selectedSourceKeys.has(sourceKey) &&
        !orderedExistingSourceKeys.includes(sourceKey)
      ) {
        orderedExistingSourceKeys.push(sourceKey);
      }
    });
    const orderedExistingGroups = orderedExistingSourceKeys.flatMap(
      (sourceKey) => {
        const group = existingGroupBySourceKey.get(sourceKey);
        return group ? [group] : [];
      },
    );
    const firstSelectableGroupIndex = groups.findIndex(
      isSelectableCatalogGroup,
    );
    const fixedGroups = groups.filter(
      (group) => !isSelectableCatalogGroup(group),
    );
    const insertionIndex =
      firstSelectableGroupIndex < 0
        ? fixedGroups.length
        : groups
            .slice(0, firstSelectableGroupIndex)
            .filter((group) => !isSelectableCatalogGroup(group)).length;
    const nextGroups = [
      ...fixedGroups.slice(0, insertionIndex),
      ...orderedExistingGroups,
      ...fixedGroups.slice(insertionIndex),
    ];
    const reconciledRows = nextGroups.flat().map((row, index) =>
      isChartOrderConfirmedRow(row)
        ? row
        : {
            ...row,
            order: { ...row.order, sortOrder: (index + 1) * 10 },
          },
    );
    const existingOrderIds = currentRows.map((row) => row.order.id);
    const reconciledOrderIds = reconciledRows.map((row) => row.order.id);
    const existingSelectionChanged = !hasSameChartOrderSelection(
      existingOrderIds,
      reconciledOrderIds,
    );
    if (existingSelectionChanged) {
      markDraftTouched("discrete");
      setDraftRows(reconciledRows);
      const reconciledOrderIdSet = new Set(reconciledOrderIds);
      setSelectedOrderIds((current) => {
        const next = new Set(current);
        next.forEach((orderId) => {
          if (!reconciledOrderIdSet.has(orderId)) next.delete(orderId);
        });
        return next;
      });
    }

    const existingSourceKeys = new Set(
      currentRows
        .map((draftRow) => getChartDraftRowCatalogSourceKey(draftRow))
        .filter((sourceKey): sourceKey is string => Boolean(sourceKey)),
    );
    const nextSourceKeys = new Set<string>();
    const nextRows = rows.filter((row) => {
      const sourceKey = getChartCatalogSourceKey(row);
      if (existingSourceKeys.has(sourceKey) || nextSourceKeys.has(sourceKey)) {
        return false;
      }
      nextSourceKeys.add(sourceKey);
      return true;
    });
    if (nextRows.length) processCatalogSelection(nextRows);
  };
  const applySetConfiguration = async (
    selectionIntent: ChartOrderSetSelectionIntent,
  ) => {
    if (writeDisabled || !setCandidate) return;
    const preview = await requestSetPreview(setCandidate, selectionIntent);
    if (!preview) return;

    const appendedSetRow = buildChartOrderDraftRowFromCatalog({
      bundle,
      row: setCandidate,
      setPreview: preview,
      setSelectionIntent: selectionIntent,
      sortOrder: (draftRowsRef.current.length + 1) * 10,
    });
    pendingAddedOrderIdsRef.current.add(appendedSetRow.order.id);
    markDraftTouched("discrete");
    setDraftRows((currentRows) => [...currentRows, appendedSetRow]);
    toast.info(`${setCandidate.displayName} Order 세트를 추가했어요 · 저장 중`);
    if (quickAddReturn) {
      setQuickAddQuery("");
      setQuickAddedSourceKey(getChartCatalogSourceKey(setCandidate));
      setQuickAddHighlightedKey(getChartCatalogSourceKey(setCandidate));
    }
    const remainingRows = catalogSelectionQueue;
    if (quickAddReturn && !remainingRows.length) setQuickAddOpen(true);
    setCatalogSelectionQueue([]);
    resetSetConfiguration();
    if (remainingRows.length) {
      window.setTimeout(() => processCatalogSelection(remainingRows), 0);
    }
  };
  const resetDraftRows = () => {
    if (writeDisabled) return;
    draftTouchedRef.current = false;
    draftSaveDelayMsRef.current = chartOrderContinuousSaveDelayMs;
    orderDraftFailedAutoSaveVersionRef.current = null;
    pendingAddedOrderIdsRef.current.clear();
    inFlightDraftOrderIdsRef.current.clear();
    pendingRemovedRootOrderIdsRef.current.clear();
    setPendingRemovedRootOrderIds(new Set());
    setDraftRows(committedRows);
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      const committedOrderIds = new Set(
        committedRows.map(({ order }) => order.id),
      );

      next.forEach((orderId) => {
        if (!committedOrderIds.has(orderId)) {
          next.delete(orderId);
        }
      });

      return next;
    });
  };
  useEffect(() => {
    let cancelled = false;

    async function loadPersistedOrderDrafts() {
      draftTouchedRef.current = false;
      draftEditVersionRef.current = 0;
      draftSaveDelayMsRef.current = chartOrderContinuousSaveDelayMs;
      orderDraftFailedAutoSaveVersionRef.current = null;
      orderDraftConflictRef.current = false;
      pendingAddedOrderIdsRef.current.clear();
      inFlightDraftOrderIdsRef.current.clear();
      pendingRemovedRootOrderIdsRef.current.clear();
      setPendingRemovedRootOrderIds(new Set());
      setOrderDraftSaveState("loading");

      const result = await loadChartOrderDraft({
        actorHeaders,
        encounterId: bundle.encounter.id,
        workspaceId: bundle.encounter.workspaceId,
      });

      if (cancelled) return;

      if (result.ok) {
        orderDraftEtagRef.current = result.etag;
        setOrderDraftEtag(result.etag);
        let nextRows = applyPersistedOrderDrafts(
          initialDraftRows,
          result.rows ?? [],
          bundle.encounter.workspaceId,
        );
        const actionResult = await loadChartOrderActions({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (actionResult.ok) {
          if (!result.etag && actionResult.etag) {
            orderDraftEtagRef.current = actionResult.etag;
            setOrderDraftEtag(actionResult.etag);
          }
          nextRows = applyPersistedOrderActions(
            nextRows,
            actionResult.rows ?? [],
            bundle.encounter.workspaceId,
            actionResult.orderActions,
          );
        }
        const lifecycleResult = await loadChartOrderLifecycles({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (lifecycleResult.ok) {
          nextRows = applyPersistedOrderLifecycles(
            nextRows,
            lifecycleResult.lifecycles,
          );
        }
        const executionResult = await loadChartOrderExecution({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (executionResult.ok) {
          setOrderExecution(executionResult.execution);
          nextRows = applyOrderExecutionTasks(
            nextRows,
            executionResult.execution.tasks,
          );
          nextRows = applyBillingCandidatesToOrderRows(
            nextRows,
            executionResult.execution.billingCandidates,
          );
        }
        const billingCandidateResult = await loadChartBillingCandidates({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (billingCandidateResult.ok) {
          nextRows = applyBillingCandidatesToOrderRows(
            nextRows,
            billingCandidateResult.candidates,
          );
        }

        if (cancelled) return;

        setCommittedRows(nextRows);
        if (!draftTouchedRef.current) {
          setDraftRows(nextRows);
        }
        setOrderDraftSaveState("idle");
        return;
      }

      setOrderDraftSaveState("error");
    }

    void loadPersistedOrderDrafts();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    bundle.encounter.id,
    bundle.encounter.workspaceId,
    initialDraftRows,
    orderDraftReloadKey,
    setDraftRows,
  ]);
  const acceptAuthoritativeBillingSummary = useCallback(
    (summary: ChartOrderBillingSummary) => {
      if (
        summary.workspaceId !== bundle.encounter.workspaceId ||
        summary.encounterId !== bundle.encounter.id
      ) {
        return false;
      }
      billingSummaryRequestSequenceRef.current += 1;
      billingSummaryRef.current = summary;
      setBillingSummary(summary);
      setBillingSummaryFreshness("fresh");
      setBillingSummaryError(undefined);
      return true;
    },
    [bundle.encounter.id, bundle.encounter.workspaceId],
  );
  const refreshBillingSummary = useCallback(async () => {
    const requestSequence = billingSummaryRequestSequenceRef.current + 1;
    billingSummaryRequestSequenceRef.current = requestSequence;
    setBillingSummaryFreshness(
      billingSummaryRef.current ? "refreshing" : "loading",
    );
    setBillingSummaryError(undefined);
    const result = await loadChartOrderBillingSummaryRoute({
      actorHeaders,
      encounterId: bundle.encounter.id,
      workspaceId: bundle.encounter.workspaceId,
    });
    if (billingSummaryRequestSequenceRef.current !== requestSequence) {
      return false;
    }
    if (result.ok) {
      return acceptAuthoritativeBillingSummary(result.summary);
    }
    setBillingSummaryFreshness(billingSummaryRef.current ? "stale" : "error");
    setBillingSummaryError(
      result.denialReason === "permission_missing"
        ? "금액 정보를 확인할 권한이 없습니다."
        : "최신 금액을 불러오지 못했어요. 다시 확인해 주세요.",
    );
    return false;
  }, [
    acceptAuthoritativeBillingSummary,
    actorHeaders,
    bundle.encounter.id,
    bundle.encounter.workspaceId,
  ]);
  useChartBillingSummaryRealtime({
    currentEtag: billingSummary?.etag,
    encounterId: bundle.encounter.id,
    hasUnsavedEdits: hasDraftChanges,
    mutationInFlight:
      orderDraftSaveState === "saving" ||
      billingRequesting ||
      Boolean(orderMutationDraft?.saving),
    onInvalidated: refreshBillingSummary,
    workspaceId: bundle.encounter.workspaceId,
  });
  useEffect(() => {
    void refreshBillingSummary();
    return () => {
      billingSummaryRequestSequenceRef.current += 1;
    };
  }, [refreshBillingSummary]);
  useEffect(() => {
    const refreshIfSafe = () => {
      if (
        draftTouchedRef.current ||
        orderDraftSaveInFlightRef.current ||
        orderDraftSavePromiseRef.current
      ) {
        return;
      }
      void refreshBillingSummary();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshIfSafe();
    };
    window.addEventListener("focus", refreshIfSafe);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshIfSafe);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshBillingSummary]);
  const savePrebillingOverride = async (
    orderId: string,
    override: ChartOrderPrebillingOverridePatch,
  ) => {
    if (writeDisabled || prebillingSavingOrderIdsRef.current.has(orderId)) {
      return;
    }
    const row = draftRowsRef.current.find(
      (candidate) => candidate.order.id === orderId,
    );
    if (!row || !isChartOrderPrebillingEditable(row)) {
      toast.error("청구 전 수정이 가능한 확정 오더가 아니에요.");
      return;
    }

    prebillingSavingOrderIdsRef.current.add(orderId);
    setPrebillingSavingOrderIds(
      new Set(prebillingSavingOrderIdsRef.current),
    );
    const result = await saveChartOrderPrebillingOverrideRoute({
      actorHeaders,
      encounterId: bundle.encounter.id,
      expectedVersion: getChartOrderPrebillingVersion(row),
      idempotencyKey: createChartOrderPrebillingIdempotencyKey(),
      orderId,
      override,
      workspaceId: bundle.encounter.workspaceId,
    });
    prebillingSavingOrderIdsRef.current.delete(orderId);
    setPrebillingSavingOrderIds(
      new Set(prebillingSavingOrderIdsRef.current),
    );

    if (!result.ok) {
      const message =
        result.error === "revision_conflict"
          ? "다른 사용자가 청구 전 값을 변경했어요. 최신 값을 다시 불러옵니다."
          : result.error === "adjustment_reason_required"
            ? "할인·할증 사유를 먼저 선택해 주세요."
            : result.error === "adjustment_reason_not_allowed"
              ? "병원 정책에 등록된 할인·할증 사유만 사용할 수 있어요."
              : result.error === "negative_charge"
                ? "청구금액은 0원보다 작을 수 없어요."
                : result.error === "billing_candidate_unavailable" ||
                    result.error === "order_unavailable"
                  ? "이미 청구됐거나 검토 보류된 오더는 수정할 수 없어요."
                  : result.denialReason === "permission_missing"
                    ? "청구 전 값을 수정할 권한이 없습니다."
                    : "청구 전 값을 저장하지 못했어요.";
      toast.error(message);
      if (result.error === "revision_conflict") {
        setOrderDraftReloadKey((key) => key + 1);
        void refreshBillingSummary();
      }
      return;
    }

    setCommittedRows((currentRows) =>
      applyChartOrderPrebillingOverride(currentRows, result.override),
    );
    setDraftRows((currentRows) =>
      applyChartOrderPrebillingOverride(currentRows, result.override),
    );
    setBillingSummaryFreshness("stale");
    void refreshBillingSummary();
    toast.success("청구 전 값을 저장했어요.");
  };
  const refreshOrderExecution = async () => {
    const result = await loadChartOrderExecution({
      actorHeaders,
      encounterId: bundle.encounter.id,
      workspaceId: bundle.encounter.workspaceId,
    });
    if (!result.ok) return;
    setOrderExecution(result.execution);
    setCommittedRows((currentRows) =>
      applyOrderExecutionTasks(currentRows, result.execution.tasks),
    );
    setDraftRows((currentRows) =>
      applyBillingCandidatesToOrderRows(
        applyOrderExecutionTasks(currentRows, result.execution.tasks),
        result.execution.billingCandidates,
      ),
    );
  };
  const commitDraftRows = ({ silent = false } = {}): Promise<boolean> => {
    const inFlightSave = orderDraftSavePromiseRef.current;
    if (inFlightSave) return inFlightSave;
    if (orderDraftSaveInFlightRef.current) return Promise.resolve(false);
    if (
      writeDisabled ||
      orderDraftSaveState === "loading" ||
      orderDraftSaveState === "saving" ||
      orderDraftSaveState === "conflict"
    )
      return Promise.resolve(false);

    const operation = (async () => {
      orderDraftSaveInFlightRef.current = true;
      while (draftTouchedRef.current) {
        const attemptedDraftEditVersion = draftEditVersionRef.current;
        const attemptedRemovedRootOrderIds = new Set(
          pendingRemovedRootOrderIdsRef.current,
        );
        const attemptedAddedOrderIds = new Set(pendingAddedOrderIdsRef.current);
        const isAttemptedRemovalRow = (row: ChartOrderDraftRow) =>
          attemptedRemovedRootOrderIds.has(row.order.id) ||
          Boolean(
            row.runtimeRow?.parentOrderId &&
            attemptedRemovedRootOrderIds.has(row.runtimeRow.parentOrderId),
          );
        const persistenceSourceRows = draftRowsRef.current.filter(
          (row) => !isAttemptedRemovalRow(row),
        );
        const preparedDraft = prepareChartOrderDraftRowsForPersistence(
          persistenceSourceRows,
        );
        if (preparedDraft.orderIdMap.size > 0) {
          const preparedById = new Map(
            preparedDraft.rows.map((row) => [row.order.id, row]),
          );
          setDraftRows((currentRows) =>
            currentRows.map((row) => {
              if (isAttemptedRemovalRow(row)) return row;
              const preparedId =
                preparedDraft.orderIdMap.get(row.order.id) ?? row.order.id;
              return preparedById.get(preparedId) ?? row;
            }),
          );
          setSelectedOrderIds((current) =>
            remapChartOrderIdSet(current, preparedDraft.orderIdMap),
          );
        }

        const expectedEtag = orderDraftEtagRef.current;
        if (!expectedEtag) {
          setOrderDraftSaveState("error");
          if (!silent) toast.error("오더 버전을 먼저 불러와 주세요.");
          return false;
        }

        draftTouchedRef.current = false;
        setOrderDraftSaveState("saving");
        inFlightDraftOrderIdsRef.current = new Set(
          preparedDraft.rows.map((row) => row.order.id),
        );
        const result = await saveChartOrderDraftRoute({
          actorHeaders,
          encounterId: bundle.encounter.id,
          expectedEtag,
          primaryVeterinarianId: bundle.encounter.primaryVeterinarianId,
          removedOrderIds: Array.from(attemptedRemovedRootOrderIds),
          rows: preparedDraft.rows,
          workspaceId: bundle.encounter.workspaceId,
        });
        inFlightDraftOrderIdsRef.current.clear();

        if (!result.ok) {
          const failedInFlightAddRemovals = new Set(
            Array.from(attemptedAddedOrderIds).filter((orderId) =>
              pendingRemovedRootOrderIdsRef.current.has(orderId),
            ),
          );
          failedInFlightAddRemovals.forEach((orderId) =>
            pendingRemovedRootOrderIdsRef.current.delete(orderId),
          );
          if (failedInFlightAddRemovals.size > 0) {
            setPendingRemovedRootOrderIds(
              new Set(pendingRemovedRootOrderIdsRef.current),
            );
            setDraftRows((currentRows) =>
              currentRows.filter(
                (row) =>
                  !failedInFlightAddRemovals.has(row.order.id) &&
                  !(
                    row.runtimeRow?.parentOrderId &&
                    failedInFlightAddRemovals.has(row.runtimeRow.parentOrderId)
                  ),
              ),
            );
          }
          const conflict =
            result.denialReason === "revision_conflict" ||
            result.error === "revision_conflict";
          if (conflict) void refreshBillingSummary();
          orderDraftConflictRef.current = conflict;
          setOrderDraftSaveState(conflict ? "conflict" : "error");
          draftTouchedRef.current = true;
          orderDraftFailedAutoSaveVersionRef.current =
            attemptedDraftEditVersion;
          if (
            !silent ||
            conflict ||
            attemptedRemovedRootOrderIds.size > 0 ||
            attemptedAddedOrderIds.size > 0
          ) {
            toast.error(
              conflict
                ? "다른 기기에서 오더가 변경됐어요. 현재 편집값을 유지한 채 충돌을 해결해 주세요."
                : result.denialReason === "permission_missing"
                  ? "오더 수정 권한이 없어 저장하지 못했어요."
                  : getChartOrderPersistenceErrorMessage(
                      result.denialReason ?? result.error,
                    ),
            );
          }
          return false;
        }

        if (
          !result.billingSummary ||
          !acceptAuthoritativeBillingSummary(result.billingSummary)
        ) {
          draftTouchedRef.current = true;
          setOrderDraftSaveState("error");
          orderDraftFailedAutoSaveVersionRef.current =
            attemptedDraftEditVersion;
          toast.error("저장 응답의 금액 범위를 확인하지 못했어요.");
          return false;
        }

        const nextCommittedRows = applyPersistedOrderDrafts(
          preparedDraft.rows,
          result.rows ?? [],
          bundle.encounter.workspaceId,
          { preserveMissingRows: true },
        );
        setCommittedRows(nextCommittedRows);
        attemptedRemovedRootOrderIds.forEach((orderId) =>
          pendingRemovedRootOrderIdsRef.current.delete(orderId),
        );
        setPendingRemovedRootOrderIds(
          new Set(pendingRemovedRootOrderIdsRef.current),
        );
        attemptedAddedOrderIds.forEach((orderId) =>
          pendingAddedOrderIdsRef.current.delete(orderId),
        );
        if (!draftTouchedRef.current) {
          setDraftRows(nextCommittedRows);
        } else {
          const committedById = new Map(
            nextCommittedRows.map((row) => [row.order.id, row]),
          );
          setDraftRows((currentRows) =>
            currentRows
              .filter((currentRow) => !isAttemptedRemovalRow(currentRow))
              .map((currentRow) => {
                const committedRow = committedById.get(currentRow.order.id);
                if (!committedRow) return currentRow;
                return {
                  ...committedRow,
                  billingName: currentRow.billingName,
                  detailInputs: currentRow.detailInputs,
                  detailSchemaVersion: currentRow.detailSchemaVersion,
                  priority: currentRow.priority,
                  quantityInput: currentRow.quantityInput,
                  setSelectionIntent: currentRow.setSelectionIntent,
                };
              }),
          );
        }
        if (result.etag) {
          orderDraftEtagRef.current = result.etag;
          setOrderDraftEtag(result.etag);
        }
        orderDraftFailedAutoSaveVersionRef.current = null;
        orderDraftConflictRef.current = false;
        draftSaveDelayMsRef.current = chartOrderContinuousSaveDelayMs;
        if (attemptedRemovedRootOrderIds.size > 0) {
          toast.success(
            `${attemptedRemovedRootOrderIds.size}개 후보를 삭제하고 저장했어요.`,
          );
        }
        const acknowledgedAdditionCount = Array.from(
          attemptedAddedOrderIds,
        ).filter(
          (orderId) => !pendingRemovedRootOrderIdsRef.current.has(orderId),
        ).length;
        if (acknowledgedAdditionCount > 0) {
          toast.success(
            `${acknowledgedAdditionCount}개 Order 후보를 추가하고 저장했어요.`,
          );
        }
      }

      setOrderDraftSaveState("saved");
      if (!silent) toast.success("Order 업데이트를 저장했어요.");
      return true;
    })();

    orderDraftSavePromiseRef.current = operation;
    const clearInFlightSave = () => {
      if (orderDraftSavePromiseRef.current === operation) {
        orderDraftSavePromiseRef.current = null;
      }
      orderDraftSaveInFlightRef.current = false;
    };
    void operation.then(clearInFlightSave, clearInFlightSave);
    return operation;
  };
  useEffect(() => {
    autoSaveDraftRef.current = () => commitDraftRows({ silent: true });
  });
  const loadIntendedAssignees = async (orderId: string) => {
    const row = draftRowsRef.current.find(
      (candidate) => candidate.order.id === orderId,
    );
    if (
      !row?.runtimeRow ||
      isChartOrderConfirmedRow(row) ||
      intendedAssigneeLoadingOrderIdsRef.current.has(orderId) ||
      Object.prototype.hasOwnProperty.call(
        intendedAssigneeOptionsByOrderId,
        orderId,
      )
    ) {
      return;
    }
    intendedAssigneeLoadingOrderIdsRef.current.add(orderId);
    setIntendedAssigneeLoadingOrderIds(
      new Set(intendedAssigneeLoadingOrderIdsRef.current),
    );
    const result = await loadChartOrderIntendedAssigneesRoute({
      actorHeaders,
      orderId,
      workspaceId: bundle.encounter.workspaceId,
    });
    intendedAssigneeLoadingOrderIdsRef.current.delete(orderId);
    setIntendedAssigneeLoadingOrderIds(
      new Set(intendedAssigneeLoadingOrderIdsRef.current),
    );
    if (!result.ok) {
      toast.error(
        result.denialReason === "permission_missing"
          ? "담당자를 지정할 권한이 없습니다."
          : result.error === "order_unavailable"
            ? "현재 오더에는 담당자를 지정할 수 없습니다."
            : "선택 가능한 담당자를 불러오지 못했어요.",
      );
      return;
    }
    setIntendedAssigneeOptionsByOrderId((current) => ({
      ...current,
      [orderId]: result.assignees,
    }));
  };
  const saveIntendedAssignee = async (
    orderId: string,
    intendedAssigneeUserId: string | null,
  ) => {
    if (
      writeDisabled ||
      intendedAssigneeSavingOrderIdsRef.current.has(orderId)
    ) {
      return;
    }
    const pendingSave = orderDraftSavePromiseRef.current;
    if (pendingSave && !(await pendingSave)) return;
    if (draftTouchedRef.current && !(await commitDraftRows({ silent: true }))) {
      toast.error("오더를 먼저 저장한 뒤 담당자를 지정해 주세요.");
      return;
    }
    const row = draftRowsRef.current.find(
      (candidate) => candidate.order.id === orderId,
    );
    if (!row?.runtimeRow || isChartOrderConfirmedRow(row)) {
      toast.error("확정 전 저장된 오더에만 담당자를 지정할 수 있어요.");
      return;
    }
    intendedAssigneeSavingOrderIdsRef.current.add(orderId);
    setIntendedAssigneeSavingOrderIds(
      new Set(intendedAssigneeSavingOrderIdsRef.current),
    );
    const result = await saveChartOrderIntendedAssigneeRoute({
      actorHeaders,
      expectedOrderUpdatedAt: row.runtimeRow.updatedAt,
      idempotencyKey: createChartOrderIntendedAssigneeIdempotencyKey(),
      intendedAssigneeUserId,
      orderId,
      workspaceId: bundle.encounter.workspaceId,
    });
    if (!result.ok) {
      intendedAssigneeSavingOrderIdsRef.current.delete(orderId);
      setIntendedAssigneeSavingOrderIds(
        new Set(intendedAssigneeSavingOrderIdsRef.current),
      );
      const conflict = result.error === "revision_conflict";
      if (conflict) {
        orderDraftConflictRef.current = true;
        setOrderDraftSaveState("conflict");
      }
      toast.error(
        conflict
          ? "다른 사용자가 오더를 변경했어요. 서버 값을 다시 불러와 주세요."
          : result.error === "assignee_ineligible"
            ? "대상 부서에서 이 업무를 맡을 수 있는 사용자만 지정할 수 있어요."
            : result.denialReason === "permission_missing"
              ? "담당자를 지정할 권한이 없습니다."
              : result.error === "order_unavailable"
                ? "확정됐거나 청구에 연결된 오더에는 예정 담당자를 바꿀 수 없어요."
                : "담당자를 저장하지 못했어요.",
      );
      return;
    }

    const readback = await loadChartOrderDraft({
      actorHeaders,
      encounterId: bundle.encounter.id,
      workspaceId: bundle.encounter.workspaceId,
    });
    intendedAssigneeSavingOrderIdsRef.current.delete(orderId);
    setIntendedAssigneeSavingOrderIds(
      new Set(intendedAssigneeSavingOrderIdsRef.current),
    );
    if (!readback.ok || !readback.etag) {
      setCommittedRows((current) =>
        applyChartOrderIntendedAssignee(current, result.state),
      );
      setDraftRows((current) =>
        applyChartOrderIntendedAssignee(current, result.state),
      );
      orderDraftConflictRef.current = true;
      setOrderDraftSaveState("conflict");
      toast.error(
        "담당자는 저장됐지만 최신 오더 버전을 확인하지 못했어요. 서버 값을 다시 불러와 주세요.",
      );
      return;
    }
    const hasAuthoritativeAssignee = readback.rows?.some(
      (runtimeRow) =>
        runtimeRow.orderId === orderId &&
        runtimeRow.intendedAssigneeUserId ===
          result.state.intendedAssigneeUserId,
    );
    const reconcile = (currentRows: ChartOrderDraftRow[]) => {
      const refreshedRows = applyPersistedOrderDrafts(
        currentRows,
        readback.rows ?? [],
        bundle.encounter.workspaceId,
        { preserveMissingRows: true },
      );
      return hasAuthoritativeAssignee
        ? refreshedRows
        : applyChartOrderIntendedAssignee(refreshedRows, result.state);
    };
    setCommittedRows(reconcile);
    setDraftRows(reconcile);
    orderDraftEtagRef.current = readback.etag;
    setOrderDraftEtag(readback.etag);
    orderDraftConflictRef.current = false;
    setOrderDraftSaveState("saved");
    toast.success(
      intendedAssigneeUserId ? "예정 담당자를 저장했어요." : "예정 담당자를 해제했어요.",
    );
  };
  const saveActualDispense = async (
    orderId: string,
    actualQuantity: number,
    reason: string | null,
  ) => {
    if (
      writeDisabled ||
      actualDispenseSavingOrderIdsRef.current.has(orderId)
    ) {
      return;
    }
    const pendingSave = orderDraftSavePromiseRef.current;
    if (pendingSave && !(await pendingSave)) return;
    if (draftTouchedRef.current && !(await commitDraftRows({ silent: true }))) {
      toast.error("오더를 먼저 저장한 뒤 준비 예정량을 조정해 주세요.");
      return;
    }
    const row = draftRowsRef.current.find(
      (candidate) => candidate.order.id === orderId,
    );
    if (
      !row?.runtimeRow ||
      isChartOrderConfirmedRow(row) ||
      row.runtimeRow.calculationOutputs.calculationStatus !== "ready" ||
      row.runtimeRow.calculationOutputs.dispenseApplicability !== true
    ) {
      toast.error("계산이 완료된 확정 전 오더에서만 준비 예정량을 조정할 수 있어요.");
      return;
    }

    actualDispenseSavingOrderIdsRef.current.add(orderId);
    setActualDispenseSavingOrderIds(
      new Set(actualDispenseSavingOrderIdsRef.current),
    );
    const result = await saveChartOrderActualDispenseRoute({
      actorHeaders,
      actualQuantity,
      expectedOrderUpdatedAt: row.runtimeRow.updatedAt,
      idempotencyKey: createChartOrderActualDispenseIdempotencyKey(),
      orderId,
      reason,
      workspaceId: bundle.encounter.workspaceId,
    });
    if (!result.ok) {
      actualDispenseSavingOrderIdsRef.current.delete(orderId);
      setActualDispenseSavingOrderIds(
        new Set(actualDispenseSavingOrderIdsRef.current),
      );
      const conflict = result.error === "revision_conflict";
      if (conflict) {
        orderDraftConflictRef.current = true;
        setOrderDraftSaveState("conflict");
      }
      toast.error(
        conflict
          ? "다른 사용자가 오더를 변경했어요. 서버 값을 다시 불러와 주세요."
          : result.error === "actual_dispense_reason_required"
            ? "이 변경에는 준비 예정량 조정 사유가 필요해요."
            : result.error === "actual_dispense_out_of_policy"
              ? "이 오더의 계량 단위와 허용 범위에 맞게 입력해 주세요."
              : result.error === "actual_dispense_override_disabled"
                ? "이 오더는 마스터에 수동 조정 규칙이 없어 계산값을 그대로 사용해야 해요."
                : result.error === "actual_dispense_calculation_unavailable"
                  ? "준비 예정량 계산 입력이 완전하지 않아요. 오더 세부값을 확인해 주세요."
                  : result.denialReason === "permission_missing"
                    ? "이 오더의 준비 예정량을 조정할 권한이 없습니다."
                    : result.error === "order_unavailable"
                      ? "확정되었거나 취소된 오더는 표에서 준비 예정량을 바꿀 수 없어요."
                      : "준비 예정량을 저장하지 못했어요.",
      );
      return;
    }

    const readback = await loadChartOrderDraft({
      actorHeaders,
      encounterId: bundle.encounter.id,
      workspaceId: bundle.encounter.workspaceId,
    });
    actualDispenseSavingOrderIdsRef.current.delete(orderId);
    setActualDispenseSavingOrderIds(
      new Set(actualDispenseSavingOrderIdsRef.current),
    );
    if (!readback.ok || !readback.etag) {
      setCommittedRows((current) =>
        applyChartOrderActualDispense(current, result.state),
      );
      setDraftRows((current) =>
        applyChartOrderActualDispense(current, result.state),
      );
      orderDraftConflictRef.current = true;
      setOrderDraftSaveState("conflict");
      toast.error(
        "준비 예정량은 저장됐지만 최신 오더 버전을 확인하지 못했어요. 서버 값을 다시 불러와 주세요.",
      );
      return;
    }
    const hasAuthoritativeValue = readback.rows?.some(
      (runtimeRow) =>
        runtimeRow.orderId === orderId &&
        runtimeRow.calculationOutputs.actualDispenseQuantity ===
          result.state.actualDispenseQuantity &&
        runtimeRow.updatedAt === result.state.updatedAt,
    );
    const reconcile = (currentRows: ChartOrderDraftRow[]) => {
      const refreshedRows = applyPersistedOrderDrafts(
        currentRows,
        readback.rows ?? [],
        bundle.encounter.workspaceId,
        { preserveMissingRows: true },
      );
      return hasAuthoritativeValue
        ? refreshedRows
        : applyChartOrderActualDispense(refreshedRows, result.state);
    };
    setCommittedRows(reconcile);
    setDraftRows(reconcile);
    orderDraftEtagRef.current = readback.etag;
    setOrderDraftEtag(readback.etag);
    orderDraftConflictRef.current = false;
    setOrderDraftSaveState("saved");
    toast.success(
      result.state.actualDispenseSource === "manual_override"
        ? "준비 예정량과 변경 사유를 저장했어요."
        : "준비 예정량을 자동 계산값으로 되돌렸어요.",
    );
  };
  useEffect(() => {
    if (
      writeDisabled ||
      !canUpdateOrders ||
      !orderDraftEtag ||
      orderDraftSaveState === "loading" ||
      orderDraftSaveState === "saving" ||
      orderDraftSaveInFlightRef.current ||
      orderDraftFailedAutoSaveVersionRef.current ===
        draftEditVersionRef.current ||
      !draftTouchedRef.current
    )
      return;

    const timer = window.setTimeout(() => {
      if (
        !draftTouchedRef.current ||
        orderDraftSaveInFlightRef.current ||
        orderDraftFailedAutoSaveVersionRef.current ===
          draftEditVersionRef.current
      )
        return;
      void autoSaveDraftRef.current();
    }, draftSaveDelayMsRef.current);
    return () => window.clearTimeout(timer);
  }, [
    canUpdateOrders,
    draftRows,
    orderDraftEtag,
    orderDraftSaveState,
    writeDisabled,
  ]);
  const recoverPersistedConfirmation = async (orderIds: string[]) => {
    const readback = await loadChartOrderActions({
      actorHeaders,
      encounterId: bundle.encounter.id,
      workspaceId: bundle.encounter.workspaceId,
    });

    return matchesPersistedConfirmationResult({ orderIds, result: readback })
      ? readback
      : null;
  };
  const commitOrderConfirmation = async () => {
    if (
      writeDisabled ||
      pendingRemovedRootOrderIdsRef.current.size > 0 ||
      orderDraftSaveState === "conflict"
    ) {
      if (orderDraftSaveState === "conflict") {
        toast.error("오더 draft 충돌을 해결한 뒤 확정해 주세요.");
      }
      return;
    }
    const invalidSelectedOrder = Array.from(selectedOrderIds).find((orderId) =>
      confirmationInvalidOrderIds.has(orderId),
    );
    if (invalidSelectedOrder) {
      toast.error("확정에 필요한 수량과 세부값을 모두 입력해 주세요.");
      setOrderActionDialog(null);
      return;
    }
    if (
      selectedOrderRows.some(
        (row) => getChartOrderSelectionCohort(row) !== "draft",
      )
    ) {
      toast.error("확정 전 후보만 같은 확정 요청에 포함할 수 있어요.");
      setOrderActionDialog(null);
      return;
    }
    const pendingDraftSave = orderDraftSavePromiseRef.current;
    if (pendingDraftSave && !(await pendingDraftSave)) {
      if (orderDraftConflictRef.current) {
        toast.error("오더 draft 충돌을 해결한 뒤 확정해 주세요.");
        return;
      }
    }

    const applyConfirmedResult = async (
      result: Extract<ChartOrderActionRouteResponse, { ok: true }>,
      confirmedRootOrderIds: string[],
      allowSummaryRecovery = false,
    ) => {
      const summaryAccepted = result.billingSummary
        ? acceptAuthoritativeBillingSummary(result.billingSummary)
        : allowSummaryRecovery
          ? await refreshBillingSummary()
          : false;
      if (!summaryAccepted) {
        setOrderDraftSaveState("error");
        toast.error("확정 결과의 최신 금액을 확인하지 못했어요.");
        return false;
      }
      // The atomic command can return rows captured before its final revision
      // update. Refresh only these confirmed roots/children, never other local
      // drafts. A failed read must not turn a successful command into a retry.
      let confirmedRows = result.rows ?? [];
      const readback = await loadChartOrderActions({
        actorHeaders,
        encounterId: bundle.encounter.id,
        workspaceId: bundle.encounter.workspaceId,
      });
      if (readback.ok) {
        const freshById = new Map(
          (readback.rows ?? [])
            .filter((row) =>
              row.workspaceId === bundle.encounter.workspaceId &&
              row.encounterId === bundle.encounter.id &&
              (row.orderConfirmationStatus === "confirmed" ||
                row.orderConfirmationStatus === "billed") &&
              (confirmedRootOrderIds.includes(row.orderId) ||
                Boolean(row.parentOrderId && confirmedRootOrderIds.includes(row.parentOrderId))),
            )
            .map((row) => [row.orderId, row]),
        );
        confirmedRows = confirmedRows.map((row) => freshById.get(row.orderId) ?? row);
      }
      const applyResult = (currentRows: ChartOrderDraftRow[]) =>
        applyBillingCandidatesToOrderRows(
          applyPersistedOrderActions(
            currentRows,
            confirmedRows,
            bundle.encounter.workspaceId,
            result.orderActions,
          ),
          result.billingCandidates ?? [],
        );
      setCommittedRows(applyResult);
      setDraftRows(applyResult);
      if (result.etag) {
        orderDraftEtagRef.current = result.etag;
        setOrderDraftEtag(result.etag);
      }
      pendingConfirmationRef.current = null;
      setSelectedOrderIds(new Set());
      setOrderActionDialog(null);
      setOrderDraftSaveState("saved");
      void refreshOrderExecution();
      toast.success("Order 확정 상태를 저장했어요.");
      const confirmedOrderIds = new Set([
        ...confirmedRootOrderIds,
        ...result.orderActions.map((action) => action.orderId),
      ]);
      const hasDispensingTask =
        result.tasks?.some(
          (task) =>
            task.destinationModule === "dispensing" &&
            typeof task.orderId === "string" &&
            confirmedOrderIds.has(task.orderId),
        ) ??
        false;
      const hasDispensingOrder =
        result.rows?.some(
          (row) =>
            confirmedOrderIds.has(row.orderId) &&
            (row.destinationModule === "dispensing" ||
              row.appliedSnapshot?.destinationModule === "dispensing"),
        ) ?? false;
      if (hasDispensingTask || hasDispensingOrder) {
        onNavigateToDispensing?.();
      }
      return true;
    };

    const selectedRootOrderIds = Array.from(selectedOrderIds).sort();
    const pendingConfirmation = pendingConfirmationRef.current;
    if (
      pendingConfirmation &&
      !draftTouchedRef.current &&
      orderDraftEtagRef.current === pendingConfirmation.expectedEtag &&
      hasSameChartOrderSelection(
        selectedRootOrderIds,
        pendingConfirmation.orderIds,
      )
    ) {
      setOrderDraftSaveState("saving");
      let retryResult = await saveChartOrderActionRoute({
        action: "confirm",
        actorHeaders,
        encounterId: bundle.encounter.id,
        expectedEtag: pendingConfirmation.expectedEtag,
        idempotencyKey: pendingConfirmation.idempotencyKey,
        actualRecords: pendingConfirmation.actualRecords,
        orderIds: pendingConfirmation.orderIds,
        workspaceId: bundle.encounter.workspaceId,
      });
      let recoveredConfirmation = false;
      if (!retryResult.ok && retryResult.status >= 500) {
        const recovered = await recoverPersistedConfirmation(
          pendingConfirmation.orderIds,
        );
        if (recovered) {
          retryResult = recovered;
          recoveredConfirmation = true;
        }
      }
      if (retryResult.ok) {
        await applyConfirmedResult(
          retryResult,
          pendingConfirmation.orderIds,
          recoveredConfirmation,
        );
        return;
      }
      const conflict =
        retryResult.denialReason === "revision_conflict" ||
        retryResult.error === "revision_conflict";
      if (conflict) void refreshBillingSummary();
      const retryable =
        retryResult.status >= 500 ||
        retryResult.denialReason === "confirmation_in_progress" ||
        retryResult.error === "confirmation_in_progress";
      if (!retryable) pendingConfirmationRef.current = null;
      setOrderDraftSaveState(conflict ? "conflict" : "error");
      toast.error(
        getChartOrderPersistenceErrorMessage(
          retryResult.denialReason ?? retryResult.error,
        ),
      );
      return;
    }
    pendingConfirmationRef.current = null;

    const preparedDraft = prepareChartOrderDraftRowsForPersistence(
      draftRowsRef.current,
    );
    const attemptedDraftEditVersion = draftEditVersionRef.current;
    const nextSelectedOrderIds = remapChartOrderIdSet(
      selectedOrderIds,
      preparedDraft.orderIdMap,
    );
    if (preparedDraft.orderIdMap.size > 0) {
      setDraftRows(preparedDraft.rows);
      setSelectedOrderIds(nextSelectedOrderIds);
    }
    const orderIds = Array.from(nextSelectedOrderIds);

    const expectedDraftEtag = orderDraftEtagRef.current;
    if (!expectedDraftEtag) {
      setOrderDraftSaveState("error");
      toast.error("오더 버전을 먼저 불러와 주세요.");
      return;
    }

    orderDraftSaveInFlightRef.current = true;
    setOrderDraftSaveState("saving");
    let actionExpectedEtag = expectedDraftEtag;
    let actionOrderIds = orderIds.filter((orderId) =>
      preparedDraft.rows.some(
        (row) => row.order.id === orderId && isChartOrderTopLevelRow(row),
      ),
    );

    if (draftTouchedRef.current) {
      const draftResult = await saveChartOrderDraftRoute({
        actorHeaders,
        encounterId: bundle.encounter.id,
        expectedEtag: expectedDraftEtag,
        primaryVeterinarianId: bundle.encounter.primaryVeterinarianId,
        rows: preparedDraft.rows,
        workspaceId: bundle.encounter.workspaceId,
      });
      let effectiveDraftResult = draftResult;
      let recoveredDraftSave = false;
      if (
        !draftResult.ok &&
        draftResult.status >= 500 &&
        draftResult.error === "db_write_failed"
      ) {
        const readback = await loadChartOrderDraft({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });
        if (
          readback.ok &&
          readback.etag &&
          matchesPersistedConfirmationDraft({
            desiredRows: preparedDraft.rows,
            orderIds,
            persistedRows: readback.rows ?? [],
          })
        ) {
          effectiveDraftResult = readback;
          recoveredDraftSave = true;
        }
      }

      if (!effectiveDraftResult.ok) {
        orderDraftSaveInFlightRef.current = false;
        const conflict =
          effectiveDraftResult.denialReason === "revision_conflict" ||
          effectiveDraftResult.error === "revision_conflict";
        if (conflict) void refreshBillingSummary();
        orderDraftConflictRef.current = conflict;
        setOrderDraftSaveState(conflict ? "conflict" : "error");
        orderDraftFailedAutoSaveVersionRef.current = attemptedDraftEditVersion;
        toast.error(
          conflict
            ? "다른 기기의 변경과 충돌했어요. 충돌을 해결한 뒤 확정해 주세요."
            : effectiveDraftResult.denialReason === "permission_missing"
              ? "오더 수정 권한이 없어 저장하지 못했어요."
              : getChartOrderPersistenceErrorMessage(
                  effectiveDraftResult.denialReason ??
                    effectiveDraftResult.error,
                ),
        );
        return;
      }

      const draftSummaryAccepted = effectiveDraftResult.billingSummary
        ? acceptAuthoritativeBillingSummary(effectiveDraftResult.billingSummary)
        : recoveredDraftSave
          ? await refreshBillingSummary()
          : false;
      if (!draftSummaryAccepted) {
        orderDraftSaveInFlightRef.current = false;
        setOrderDraftSaveState("error");
        toast.error("저장 결과의 최신 금액을 확인하지 못했어요.");
        return;
      }

      const savedDraftRows = applyPersistedOrderDrafts(
        preparedDraft.rows,
        effectiveDraftResult.rows ?? [],
        bundle.encounter.workspaceId,
        { preserveMissingRows: true },
      );
      const persistedOrderIds = new Set(
        (effectiveDraftResult.rows ?? [])
          .filter((row) => row.rowType !== "set_child")
          .map((row) => row.orderId),
      );
      actionOrderIds = orderIds.filter((orderId) =>
        persistedOrderIds.has(orderId),
      );

      if (actionOrderIds.length !== orderIds.length) {
        orderDraftSaveInFlightRef.current = false;
        setOrderDraftSaveState("error");
        setCommittedRows(savedDraftRows);
        setDraftRows(savedDraftRows);
        setSelectedOrderIds(new Set(actionOrderIds));
        toast.error("선택한 오더를 서버 draft에 저장하지 못했어요.");
        return;
      }

      draftTouchedRef.current = false;
      orderDraftFailedAutoSaveVersionRef.current = null;
      setCommittedRows(savedDraftRows);
      setDraftRows(savedDraftRows);
      if (effectiveDraftResult.etag) {
        actionExpectedEtag = effectiveDraftResult.etag;
        orderDraftEtagRef.current = effectiveDraftResult.etag;
        setOrderDraftEtag(effectiveDraftResult.etag);
      }
      orderDraftConflictRef.current = false;
    }

    if (actionOrderIds.length !== orderIds.length) {
      orderDraftSaveInFlightRef.current = false;
      setOrderDraftSaveState("error");
      setSelectedOrderIds(new Set(actionOrderIds));
      toast.error("선택한 오더를 서버 draft에서 확인하지 못했어요.");
      return;
    }
    const idempotencyKey = createChartOrderConfirmationIdempotencyKey();
    if (!chartActualRecords) {
      orderDraftSaveInFlightRef.current = false;
      setOrderDraftSaveState("error");
      toast.error("실제 수행 시각·본인 확인·결과를 입력해 주세요.");
      return;
    }
    pendingConfirmationRef.current = {
      actualRecords: chartActualRecords,
      expectedEtag: actionExpectedEtag,
      idempotencyKey,
      orderIds: [...actionOrderIds].sort(),
    };
    let result = await saveChartOrderActionRoute({
      action: "confirm",
      actorHeaders,
      encounterId: bundle.encounter.id,
      expectedEtag: actionExpectedEtag,
      idempotencyKey,
      orderIds: pendingConfirmationRef.current.orderIds,
      actualRecords: pendingConfirmationRef.current.actualRecords,
      workspaceId: bundle.encounter.workspaceId,
    });
    let recoveredConfirmation = false;

    if (!result.ok && result.status >= 500) {
      const recovered = await recoverPersistedConfirmation(
        pendingConfirmationRef.current.orderIds,
      );
      if (recovered) {
        result = recovered;
        recoveredConfirmation = true;
      }
    }

    if (!result.ok) {
      const conflict =
        result.denialReason === "revision_conflict" ||
        result.error === "revision_conflict";
      if (conflict) void refreshBillingSummary();
      const retryable =
        result.status >= 500 ||
        result.denialReason === "confirmation_in_progress" ||
        result.error === "confirmation_in_progress";
      if (!retryable) pendingConfirmationRef.current = null;
      orderDraftSaveInFlightRef.current = false;
      setOrderDraftSaveState(conflict ? "conflict" : "error");
      toast.error(
        result.denialReason === "permission_missing"
          ? "오더 작업 권한이 없어 저장하지 못했어요."
          : getChartOrderPersistenceErrorMessage(
              result.denialReason ?? result.error,
            ),
      );
      return;
    }
    orderDraftSaveInFlightRef.current = false;
    await applyConfirmedResult(
      result,
      pendingConfirmationRef.current.orderIds,
      recoveredConfirmation,
    );
  };
  const requestDraftRootRemoval = (orderIds: string[]) => {
    if (writeDisabled || orderIds.length === 0) return;
    const requestedRootIds = draftRowsRef.current
      .filter(
        (row) =>
          orderIds.includes(row.order.id) &&
          isChartOrderTopLevelRow(row) &&
          !isChartOrderConfirmedRow(row) &&
          !pendingRemovedRootOrderIdsRef.current.has(row.order.id),
      )
      .map((row) => row.order.id);
    if (requestedRootIds.length === 0) return;
    setDeleteOrderIds(requestedRootIds);
  };
  const confirmDeleteOrder = () => {
    if (writeDisabled || deleteOrderIds.length === 0) return;
    const orderIds = [...deleteOrderIds];
    const rootIds = new Set(orderIds);
    const persistedRootIds = new Set(
      draftRowsRef.current
        .filter(
          (row) =>
            rootIds.has(row.order.id) &&
            isChartOrderTopLevelRow(row) &&
            !isChartOrderConfirmedRow(row) &&
            (committedRows.some(
              (committedRow) => committedRow.order.id === row.order.id,
            ) ||
              inFlightDraftOrderIdsRef.current.has(row.order.id)),
        )
        .map((row) => row.order.id),
    );
    const localOnlyRootIds = new Set(
      orderIds.filter((orderId) => !persistedRootIds.has(orderId)),
    );
    const removableIds = new Set(
      draftRowsRef.current
        .filter(
          (row) =>
            !isChartOrderConfirmedRow(row) &&
            (rootIds.has(row.order.id) ||
              (row.runtimeRow?.parentOrderId
                ? rootIds.has(row.runtimeRow.parentOrderId)
                : false)),
        )
        .map((row) => row.order.id),
    );
    if (removableIds.size === 0) {
      setDeleteOrderIds([]);
      return;
    }
    const nextRows = draftRowsRef.current.filter(
      (row) =>
        !localOnlyRootIds.has(row.order.id) &&
        !(
          row.runtimeRow?.parentOrderId &&
          localOnlyRootIds.has(row.runtimeRow.parentOrderId)
        ),
    );
    draftRowsRef.current = nextRows;
    setDraftRows(nextRows);
    removableIds.forEach((orderId) =>
      pendingAddedOrderIdsRef.current.delete(orderId),
    );
    persistedRootIds.forEach((orderId) =>
      pendingRemovedRootOrderIdsRef.current.add(orderId),
    );
    setPendingRemovedRootOrderIds(
      new Set(pendingRemovedRootOrderIdsRef.current),
    );
    const nextRowById = new Map(nextRows.map((row) => [row.order.id, row]));
    const hasRemainingChanges =
      pendingRemovedRootOrderIdsRef.current.size > 0 ||
      nextRows.some((row) => {
        if (isChartOrderConfirmedRow(row)) return false;
        const committedRow = committedRows.find(
          (candidate) => candidate.order.id === row.order.id,
        );
        return committedRow ? isChartOrderDraftRowDirty(row) : true;
      }) ||
      committedRows.some(
        (row) =>
          !isChartOrderConfirmedRow(row) && !nextRowById.has(row.order.id),
      );
    if (hasRemainingChanges) {
      markDraftTouched("discrete");
    } else {
      draftTouchedRef.current = false;
      orderDraftFailedAutoSaveVersionRef.current = null;
      setOrderDraftSaveState("saved");
    }
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      removableIds.forEach((orderId) => next.delete(orderId));
      return next;
    });
    setDeleteOrderIds([]);
  };
  const confirmSingleOrder = (orderId: string) => {
    const row = draftRows.find((candidate) => candidate.order.id === orderId);
    if (
      !row ||
      !isChartOrderTopLevelRow(row) ||
      isChartOrderConfirmedRow(row) ||
      pendingRemovedRootOrderIdsRef.current.has(orderId)
    ) {
      return;
    }
    setSelectedOrderIds(new Set([orderId]));
    setChartActualDrafts({});
    setOrderActionDialog("confirm");
  };
  const confirmSelectedOrders = () => {
    if (
      selectedOrderRows.length === 0 ||
      selectedOrderRows.some(
        (row) => getChartOrderSelectionCohort(row) !== "draft",
      )
    ) {
      return;
    }
    setChartActualDrafts({});
    setOrderActionDialog("confirm");
  };
  const openOrderMutation = (
    orderId: string,
    action: ChartOrderExecutionMutationAction,
  ) => {
    const row = draftRows.find((candidate) => candidate.order.id === orderId);
    if (!row || !isChartOrderConfirmedRow(row)) return;
    const currentActual = row.runtimeRow?.calculationOutputs
      .actualDispenseQuantity;
    setOrderMutationDraft({
      action,
      actualDispenseInput:
        action === "re_request" &&
        getChartOrderAuthority(row)?.preparationPolicy &&
        typeof currentActual === "number"
          ? String(currentActual)
          : "",
      detailInputs: { ...row.detailInputs },
      orderId,
      priority: row.priority,
      reason: "",
      saving: false,
    });
  };
  const commitOrderMutation = async () => {
    const draft = orderMutationDraft;
    const row = mutationOrderRow;
    if (!draft || !row || draft.saving) return;
    if (draft.reason.trim().length < 3) {
      setOrderMutationDraft({
        ...draft,
        error: "사유를 3자 이상 입력해 주세요.",
      });
      return;
    }

    let changes: Record<string, unknown> = {};
    if (draft.action === "amend" || draft.action === "re_request") {
      const validation = validateClinicalOrderDetailInputs({
        clinicalOrderType: getChartOrderClinicalType(row),
        detailInputs: draft.detailInputs,
        requireComplete: true,
        schemaVersion: row.detailSchemaVersion,
      });
      if (!validation.valid) {
        setOrderMutationDraft({
          ...draft,
          error: "필수 세부값과 입력 형식을 확인해 주세요.",
        });
        return;
      }
      changes = {
        detailInputs: validation.normalized,
        detailSchemaVersion: row.detailSchemaVersion,
        ...(draft.action === "re_request"
          ? {
              priority: draft.priority,
              ...(draft.actualDispenseInput.trim()
                ? {
                    actualDispenseQuantity: Number(
                      draft.actualDispenseInput,
                    ),
                  }
                : {}),
            }
          : {}),
      };
      if (
        draft.action === "re_request" &&
        draft.actualDispenseInput.trim() &&
        (!Number.isFinite(changes.actualDispenseQuantity) ||
          Number(changes.actualDispenseQuantity) <= 0)
      ) {
        setOrderMutationDraft({
          ...draft,
          error: "재확정 준비 예정량은 0보다 큰 숫자여야 해요.",
        });
        return;
      }
    } else if (draft.action === "priority_change") {
      changes = { priority: draft.priority };
    }

    setOrderMutationDraft({ ...draft, error: undefined, saving: true });
    const result = await saveChartOrderExecutionMutationRoute({
      action: draft.action,
      actorHeaders,
      changes,
      expectedRevisionNo: row.runtimeRow?.revisionNo ?? 0,
      idempotencyKey: `chart-mutation-${createChartOrderDraftId()}`,
      orderId: row.order.id,
      reason: draft.reason.trim(),
      workspaceId: bundle.encounter.workspaceId,
    });
    if (!result.ok) {
      if (result.denialReason === "revision_conflict") {
        pendingBillingRequestRef.current = null;
        setBillingSummaryFreshness("stale");
        setBillingSummaryError(
          "다른 사용자가 오더를 변경했어요. 최신 금액을 다시 확인해 주세요.",
        );
        void refreshBillingSummary();
      }
      const error =
        result.denialReason === "amendment_requires_pending"
          ? "진행을 시작한 오더는 같은 attempt에서 정정할 수 없습니다. 재요청을 사용해 주세요."
          : result.denialReason === "revision_conflict"
            ? "다른 사용자가 먼저 변경했습니다. 최신 이력을 불러온 뒤 다시 시도해 주세요."
            : result.denialReason === "re_request_transition_invalid"
              ? "현재 Task 상태에서는 재요청할 수 없습니다. 진행 또는 완료 상태를 확인해 주세요."
              : result.denialReason === "actual_dispense_reconfirmation_required"
                ? "변경된 처방값으로 준비 예정량을 다시 확인해 주세요."
                : result.denialReason === "actual_dispense_reconfirmation_invalid"
                  ? "재확정 준비 예정량과 계산 입력을 확인해 주세요."
                  : result.denialReason === "actual_dispense_out_of_policy"
                    ? "재확정 준비 예정량이 마스터의 계량 단위 또는 허용 범위를 벗어났어요."
                    : result.denialReason === "actual_dispense_override_disabled"
                      ? "이 오더는 수동 준비 예정량 조정을 허용하지 않아요."
                      : result.denialReason === "billing_quantity_calculation_incomplete"
                        ? "변경된 처방값으로 청구 수량을 계산할 수 없어요."
              : result.denialReason === "billing_review_required"
                ? "연결된 청구서의 검토 보류를 먼저 정정하거나 반전해 주세요."
                : result.denialReason === "billing_reversal_required"
                  ? "청구서에 연결된 오더는 차트에서 취소할 수 없습니다. 수납에서 정정·반전해 주세요."
              : result.denialReason === "billing_candidate_locked"
                ? "이미 결제 처리 중인 수납 후보는 여기서 정정할 수 없습니다."
                : result.denialReason === "permission_missing"
                  ? "이 변경을 수행할 권한이 없습니다."
                  : "변경을 저장하지 못했습니다. 상태와 연결을 확인해 주세요.";
      setOrderMutationDraft({ ...draft, error, saving: false });
      return;
    }

    if (!acceptAuthoritativeBillingSummary(result.billingSummary)) {
      setOrderMutationDraft({
        ...draft,
        error: "변경 결과의 최신 금액 범위를 확인하지 못했어요.",
        saving: false,
      });
      return;
    }

    const payload = result.mutation.order;
    const nextDetailInputs =
      payload.detailInputs &&
      typeof payload.detailInputs === "object" &&
      !Array.isArray(payload.detailInputs)
        ? (payload.detailInputs as Record<string, unknown>)
        : draft.detailInputs;
    const nextCalculationOutputs =
      payload.calculationOutputs &&
      typeof payload.calculationOutputs === "object" &&
      !Array.isArray(payload.calculationOutputs)
        ? (payload.calculationOutputs as Record<string, unknown>)
        : row.runtimeRow?.calculationOutputs;
    const nextPriority =
      payload.priority === "urgent"
        ? "urgent"
        : payload.priority === "normal"
          ? "normal"
          : draft.priority;
    const nextStatus: EmrOrderStatus =
      payload.orderStatus === "cancelled" ? "cancelled" : "confirmed";
    const applyMutation = (rows: ChartOrderDraftRow[]) =>
      rows.map((currentRow) => {
        if (currentRow.order.id !== row.order.id) return currentRow;
        return {
          ...currentRow,
          detailInputs: nextDetailInputs,
          order: {
            ...currentRow.order,
            priority: nextPriority,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          },
          priority: nextPriority,
          runtimeRow: currentRow.runtimeRow
            ? {
                ...currentRow.runtimeRow,
                calculationOutputs:
                  nextCalculationOutputs ??
                  currentRow.runtimeRow.calculationOutputs,
                detailInputs: nextDetailInputs,
                orderConfirmationStatus:
                  payload.confirmationStatus === "cancelled"
                    ? "cancelled"
                    : currentRow.runtimeRow.orderConfirmationStatus,
                priority: nextPriority,
                revisionNo: result.mutation.revisionNo,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : currentRow.runtimeRow,
        };
      });
    setCommittedRows(applyMutation);
    setDraftRows(applyMutation);
    setSelectedOrderIds(new Set());
    setOrderMutationDraft(null);
    void refreshOrderExecution();
    toast.success(`${chartOrderMutationLabels[draft.action]}을 기록했어요.`);
  };
  const orderActionLabel = "Order 확정";
  const guardianName = bundle.primaryGuardian?.name ?? "보호자 미지정";
  const draftStatusText = orderLoading
    ? "오더 정보를 불러오는 중"
    : orderDraftSaveState === "saving"
      ? "저장 중"
      : orderDraftSaveState === "error"
        ? "저장 실패"
        : orderDraftSaveState === "conflict"
          ? "충돌 해결 필요"
          : hasDraftChanges
            ? `변경 대기 ${changedDraftOrderCount}건${draftSaveInvalidOrderIds.size ? ` · 입력 확인 필요 ${draftSaveInvalidOrderIds.size}건` : ""}`
            : orderDraftSaveState === "saved"
              ? "저장됨"
              : "변경 없음";
  const hasAuthoritativeBillingSummary = Boolean(billingSummary);
  const billingAmountDisplayState: ChartOrderBillingAmountDisplayState =
    hasDraftChanges && draftSaveInvalidOrderIds.size > 0
      ? "invalid"
      : orderDraftSaveState === "error" || orderDraftSaveState === "conflict"
        ? "save_error"
        : hasDraftChanges
          ? "preview"
          : "authoritative";
  const effectiveBillingSummary =
    billingSummary && billingAmountDisplayState === "preview"
      ? buildChartOrderBillingPreview({
          authoritative: billingSummary,
          committedRows,
          draftRows,
        })
      : (billingSummary ?? localBillingSummary);
  const billingError = billingRequestError ?? billingSummaryError;
  const canRequestBilling =
    billingAmountDisplayState === "authoritative" &&
    billingSummaryFreshness === "fresh" &&
    hasAuthoritativeBillingSummary &&
    !hasDraftChanges &&
    !billingRequesting &&
    effectiveBillingSummary.orderCounts.requestable > 0;
  const orderFooterAccessibilitySummary = [
    `선택 오더 ${selectedOrderIds.size}건`,
    `선택 오더 합계 ${selectedAmount.toLocaleString()}원`,
    draftStatusText,
  ]
    .filter(Boolean)
    .join(" · ");
  const requestEncounterBilling = async (acknowledgeUnfinished: boolean) => {
    if (hasDraftChanges) {
      setBillingRequestError("변경한 오더를 먼저 업데이트한 뒤 청구해 주세요.");
      setBillingDrawerOpen(true);
      return;
    }
    const authoritativeSummary = billingSummaryRef.current;
    if (billingSummaryFreshness !== "fresh" || !authoritativeSummary) {
      setBillingRequestError("최신 금액을 확인한 뒤 다시 청구해 주세요.");
      setBillingDrawerOpen(true);
      if (
        billingSummaryFreshness !== "loading" &&
        billingSummaryFreshness !== "refreshing"
      ) {
        void refreshBillingSummary();
      }
      return;
    }
    if (
      authoritativeSummary.unfinishedOrders.length > 0 &&
      !acknowledgeUnfinished
    ) {
      setBillingDrawerOpen(true);
      setBillingRequestError(
        "진행 중 오더를 확인한 뒤 중간 정산으로 청구해 주세요.",
      );
      return;
    }
    setBillingRequesting(true);
    setBillingRequestError(undefined);
    const pendingRequest =
      pendingBillingRequestRef.current?.expectedEtag ===
      authoritativeSummary.etag
        ? pendingBillingRequestRef.current
        : {
            expectedEtag: authoritativeSummary.etag,
            idempotencyKey: createChartOrderBillingIdempotencyKey(),
          };
    pendingBillingRequestRef.current = pendingRequest;
    const result = await requestChartOrderBillingRoute({
      acknowledgeUnfinished,
      actorHeaders,
      encounterId: bundle.encounter.id,
      expectedEtag: authoritativeSummary.etag,
      idempotencyKey: pendingRequest.idempotencyKey,
      workspaceId: bundle.encounter.workspaceId,
    });
    setBillingRequesting(false);
    if (!result.ok) {
      setBillingDrawerOpen(true);
      setBillingRequestError(
        result.error === "revision_conflict"
          ? "금액이 변경됐어요. 최신 금액을 다시 확인해 주세요."
          : result.error === "unfinished_ack_required"
            ? "진행 중 오더를 확인한 뒤 다시 청구해 주세요."
            : result.error === "no_billable_orders"
              ? "현재 청구할 수 있는 확정 오더가 없습니다."
              : result.error === "billing_authority_incomplete"
                ? "가격 기준·청구 단위·과세 설정이 완전한 오더만 청구할 수 있어요."
                : result.error === "vat_calculation_policy_missing"
                  ? "병원 청구 설정에서 VAT 계산 방식을 먼저 정해 주세요."
                  : result.error === "returned_work_blocks_billing"
                    ? "반려된 업무를 수정·재확정하거나 취소한 뒤 청구해 주세요."
              : result.denialReason === "permission_missing"
                ? "Order 청구 권한이 없습니다."
                : "Order 청구를 완료하지 못했어요.",
      );
      if (result.error === "revision_conflict") {
        pendingBillingRequestRef.current = null;
        setBillingSummaryFreshness("stale");
        setBillingSummaryError(
          "최신 금액을 불러오지 못했어요. 다시 확인해 주세요.",
        );
        setOrderDraftReloadKey((key) => key + 1);
        void refreshBillingSummary();
      }
      return;
    }
    pendingBillingRequestRef.current = null;
    if (!acceptAuthoritativeBillingSummary(result.summary)) {
      setBillingRequestError("청구 결과의 금액 범위를 확인하지 못했어요.");
      setBillingDrawerOpen(true);
      return;
    }
    setBillingRequestError(undefined);
    toast.success("확정된 오더를 청구 화면으로 보냈어요.");
    if (result.summary.invoiceId)
      onNavigateToBilling?.(result.summary.invoiceId);
  };
  useEffect(() => {
    if (!billingDrawerOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setBillingDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [billingDrawerOpen]);
  return (
    <section
      data-slot="chart-workspace-panel"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        chartWorkspacePanelClassName,
        "group/chart-collapsible-panel relative",
      )}
    >
      <div className="flex h-[38px] min-h-[38px] shrink-0 items-center justify-between gap-3 px-3 pt-2 pb-0.5">
        <h2 className="truncate text-sm font-semibold leading-5 text-foreground">
          Plan/Order
        </h2>
        <ChartPanelActionGroup>
          <ChartPanelCollapseButton
            collapsed={collapsed}
            contentId={collapseContentId}
            label="Plan/Order"
            onCollapse={() => onCollapsedChange(!collapsed)}
            panelId="order"
          />
          <ChartPanelIconButton label="패널 확대 준비 중" disabled />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-lg text-[var(--emr-text-secondary)]"
            aria-label="Order 추가"
            disabled={writeDisabled}
            onClick={openCatalogDialog}
          >
            <CdsActionsPlusIcon className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 rounded-lg text-muted-foreground"
                  aria-label="Plan/Order 작업"
                  onClick={() => {
                    if (collapsed) onCollapsedChange(false);
                  }}
                >
                  <CdsFilesMoreHorizontalIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setUnavailableAction({ action: "order-print" })}
              >
                Order 출력 · 준비 중
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={writeDisabled || !hasDraftChanges}
                onClick={resetDraftRows}
              >
                변경 취소
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={writeDisabled || !canUpdateOrders}
                onClick={() => void commitDraftRows()}
              >
                Order 업데이트
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ChartPanelActionGroup>
      </div>
      <div
        id={collapseContentId}
        aria-hidden={collapsed || undefined}
        inert={collapsed ? true : undefined}
        className={collapsed ? "hidden" : "contents"}
      >
        <div className="flex h-11 min-h-11 shrink-0 items-center justify-between gap-3 overflow-x-auto border-b border-[var(--emr-border-default)] px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="flex min-w-max shrink-0 items-center rounded-lg bg-[var(--clair-color-atomic-black-alpha-4)] p-[3px]"
            role="tablist"
            aria-label="처방/오더 분류"
          >
            {orderTabItems.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-label={`${tab.label} ${tab.count}`}
                aria-selected={orderFilter === tab.value}
                className={cn(
                  "inline-flex h-6 min-w-12 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors",
                  orderFilter === tab.value &&
                    "bg-[var(--emr-surface-panel)] text-foreground shadow-[var(--clair-shadow-xs)]",
                )}
                onClick={() => setOrderFilter(tab.value)}
              >
                {tab.label === "전체오더" ? "전체" : tab.label}
                <span className="tabular-nums">{tab.count}</span>
              </button>
            ))}
          </div>
          <div
            data-slot="chart-order-toolbar-actions"
            className="flex shrink-0 items-center gap-2"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-card px-2 text-xs"
              title="준비 중"
              disabled
            >
              <CdsActionsSearchIcon data-icon="inline-start" />
              검색
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-card px-2 text-xs"
              title="준비 중"
              disabled
            >
              <CdsActionsListFilterIcon data-icon="inline-start" />
              필터
            </Button>
            <EmrTableDensitySelector
              className="h-[var(--clair-control-height-sm)] min-h-[var(--clair-control-height-sm)] px-2 py-0 text-xs"
              value={orderTableDensity}
              onValueChange={setOrderTableDensity}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-card px-2 text-xs"
              title="준비 중"
              disabled
            >
              총괄지시사항
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-card px-2 text-xs"
              title="준비 중"
              disabled
            >
              검사결과 분석
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-card px-2 text-xs"
              title="준비 중"
              disabled
            >
              PACS
            </Button>
            <div className="h-5 w-px bg-[var(--emr-border-subtle)]" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-card px-2 text-xs"
              disabled={writeDisabled}
              onClick={openCatalogDialog}
            >
              + Order
            </Button>
          </div>
        </div>
        {unavailableAction ? (
          <ChartUnavailableAlert
            action={unavailableAction.action}
            targetName={unavailableAction.targetName}
            className="mx-3 mt-2 w-auto shrink-0"
            onDismiss={() => setUnavailableAction(null)}
          />
        ) : null}
        {orderDraftSaveState === "error" ? (
          <EmrInlineAlert
            severity="error"
            title="오더 정보를 반영하지 못했습니다"
            className="mx-3 mt-2 w-auto shrink-0 emr-text-metadata"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void commitDraftRows()}
              >
                다시 저장
              </Button>
            }
            testId="chart-order-state-error"
          >
            현재 표의 내용은 유지됩니다. 권한과 연결 상태를 확인한 뒤 변경사항을
            다시 저장해 주세요.
          </EmrInlineAlert>
        ) : null}
        {orderDraftSaveState === "conflict" ? (
          <EmrInlineAlert
            severity="error"
            title="다른 기기의 오더 변경과 충돌했습니다"
            className="mx-3 mt-2 w-auto shrink-0 emr-text-metadata"
            testId="chart-order-draft-conflict"
          >
            <span className="grid gap-2">
              <span>
                현재 편집값은 덮어쓰지 않았습니다. 서버 값을 다시 불러오기
                전에는 확정과 수납 후보 생성을 진행할 수 없습니다.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  draftTouchedRef.current = false;
                  draftEditVersionRef.current = 0;
                  orderDraftFailedAutoSaveVersionRef.current = null;
                  orderDraftConflictRef.current = false;
                  setOrderDraftSaveState("loading");
                  setOrderDraftReloadKey((current) => current + 1);
                }}
              >
                서버 값 다시 불러오기
              </Button>
            </span>
          </EmrInlineAlert>
        ) : null}
        {quickAddedHidden ? (
          <EmrInlineAlert severity="info" title="다른 분류에 오더를 추가했어요." action={<Button size="sm" variant="ghost" onClick={() => setOrderFilter("all")}>전체에서 보기</Button>} />
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--emr-surface-panel)]">
          <ChartOrderTable
            revealOrderId={quickAddedRow?.order.id}
            highlightedOrderId={quickAddedSourceKey === quickAddHighlightedKey ? quickAddedRow?.order.id : undefined}
            quickAdd={
              <Popover
                open={quickAddOpen}
                onOpenChange={(open, details) => {
                  if (!open && details.reason === "trigger-press") return;
                  if (open) {
                    if (!quickAddOpen) openQuickAdd();
                  } else closeQuickAdd();
                }}
              >
                <PopoverTrigger nativeButton={false} role="presentation" tabIndex={-1} render={<div className="relative w-full" />}>
                  {quickAddOpen ? (
                    <>
                      <Input
                        ref={quickAddInputRef}
                        role="combobox"
                        aria-label="오더 빠른 검색"
                        aria-autocomplete="list"
                        aria-expanded={quickAddOpen}
                        aria-controls={quickAddCandidates.length ? quickAddListId : undefined}
                        aria-activedescendant={quickAddActive >= 0 ? `${quickAddListId}-${quickAddActive}` : undefined}
                        autoComplete="off"
                        placeholder="오더명·청구명 검색"
                        value={quickAddQuery}
                        className="h-[var(--clair-control-height-lg)] bg-[var(--emr-surface-panel)] pr-9"
                        onKeyDown={handleQuickAddKeyDown}
                        onValueChange={(value) => {
                          setQuickAddQuery(value);
                          setQuickAddActiveIndex(-1);
                        }}
                      />
                      <EmrIconButton
                        aria-label="빠른 검색 닫기"
                        iconSize="md"
                        className="absolute right-1 top-1/2 size-[var(--clair-control-height-sm)] -translate-y-1/2"
                        onClick={(event) => { event.stopPropagation(); closeQuickAdd(true); }}
                      >
                        <CdsActionsXIcon />
                      </EmrIconButton>
                    </>
                  ) : (
                    <Button
                      ref={quickAddTriggerRef}
                      disabled={writeDisabled || orderDraftSaveState === "loading" || orderDraftSaveState === "conflict"}
                      className="h-[var(--clair-control-height-xl)] w-full justify-start gap-1.5 px-2.5 text-[var(--emr-text-secondary)]"
                      variant="ghost"
                    >
                      <CdsActionsPlusIcon aria-hidden="true" className="size-4" />
                      Order 추가
                    </Button>
                  )}
                </PopoverTrigger>
                <EmrPopoverShell
                  width="anchor"
                  align="start"
                  initialFocus={false}
                  finalFocus={false}
                  className="max-h-[var(--available-height)]"
                  aria-label="오더 빠른 추가"
                  bodyClassName="flex min-h-0 flex-col gap-0 overflow-hidden p-0"
                  footer={
                    <Button className="w-full justify-between" variant="ghost" size="sm" onClick={openDetailedOrderSearch}>
                      상세 오더 검색<CdsNavigationChevronRightIcon aria-hidden="true" className="size-4" />
                    </Button>
                  }
                >
                  {quickAddQuery.trim() && catalogSearchStatus === "ready" ? (
                    <EmrPopoverHeader className="px-3 py-2" title={
                      <span className="flex items-center gap-1.5 text-xs"><span>검색 결과</span><span className="font-normal text-[var(--emr-text-tertiary)]">{quickAddCandidates.length}건</span></span>
                    } />
                  ) : null}
                  {catalogSearchStatus === "loading" || catalogSearchStatus === "idle" ? (
                    <div className="p-3"><ClassificationExplorerLoadingState label="오더" message="오더를 불러오는 중입니다" /></div>
                  ) : catalogSearchStatus === "error" || catalogSearchStatus === "denied" ? (
                    <EmrInlineAlert
                      className="m-3"
                      severity={catalogSearchStatus === "denied" ? "warning" : "error"}
                      title={catalogSearchStatus === "denied" ? "오더 검색 권한이 없습니다." : "오더를 불러오지 못했습니다."}
                      action={catalogSearchStatus === "error" ? <Button size="sm" variant="outline" onClick={() => void loadCatalogRows()}>다시 시도</Button> : undefined}
                    />
                  ) : !quickAddQuery.trim() ? (
                    <p className="px-3 py-5 text-xs text-[var(--emr-text-tertiary)]">오더명 또는 청구명을 입력해 주세요.</p>
                  ) : !quickAddCandidates.length ? (
                    <EmrEmptyState kind="no-search-results" surface="widget" icon={false} reserveActionSpace={false} size="sm" title="검색 결과가 없습니다" description="다른 이름이나 청구명으로 검색해 주세요." />
                  ) : (
                    <div ref={quickAddResultsRef} id={quickAddListId} role="listbox" aria-label="오더 빠른 검색 결과" className="min-h-0 max-h-72 overflow-y-auto overscroll-contain">
                      {quickAddCandidates.map((candidate, index) => {
                        const sourceKey = getChartCatalogSourceKey(candidate);
                        const present = quickAddExistingKeys.has(sourceKey);
                        return (
                          <ClassificationExplorerOption
                            key={sourceKey}
                            id={`${quickAddListId}-${index}`}
                            disabled={present}
                            aria-disabled={present}
                            tabIndex={-1}
                            selected={quickAddActive === index}
                            className="h-12 min-h-12 px-3 text-xs"
                            label={<span className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-[var(--emr-text-tertiary)]">{getChartOrderCatalogCategoryLabel(candidate.categoryGroup)}</span><span className="truncate">{candidate.displayName}</span></span>}
                            trailing={present ? (quickAddConfirmedKeys.has(sourceKey) ? "이미 확정됨" : "이미 추가됨") : candidate.rowType === "set" ? "구성 확인" : candidate.appliedSnapshot.appliedPriceKrw === null ? "가격 확인 필요" : getCatalogCandidatePriceLabel(candidate)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => addQuickCandidate(candidate)}
                            onPointerMove={() => { if (!present) setQuickAddActiveIndex(index); }}
                          />
                        );
                      })}
                    </div>
                  )}
                </EmrPopoverShell>
              </Popover>
            }
            selectionActionsHidden={orderActionDialog !== null || historyOrderId !== null || detailOrderId !== null}
            actualDispenseSavingOrderIds={actualDispenseSavingOrderIds}
            confirmationDisabled={
              orderDraftSaveState === "conflict" ||
              pendingRemovedRootOrderIds.size > 0
            }
            density={orderTableDensity}
            executionTasks={orderExecution?.tasks ?? []}
            hasAnyRows={draftRows.length > 0}
            intendedAssigneeLoadingOrderIds={
              intendedAssigneeLoadingOrderIds
            }
            intendedAssigneeOptionsByOrderId={
              intendedAssigneeOptionsByOrderId
            }
            intendedAssigneeSavingOrderIds={intendedAssigneeSavingOrderIds}
            invalidOrderIds={confirmationInvalidOrderIds}
            loading={orderLoading}
            onAddOrder={openCatalogDialog}
            onConfirmOrder={confirmSingleOrder}
            onConfirmSelected={confirmSelectedOrders}
            onDeleteOrder={(orderId) => requestDraftRootRemoval([orderId])}
            onDeleteSelected={requestDraftRootRemoval}
            onFlushDraft={() => {
              if (canUpdateOrders) void autoSaveDraftRef.current();
            }}
            onOpenDetail={setDetailOrderId}
            onOpenHistory={setHistoryOrderId}
            onOpenMutation={openOrderMutation}
            onLoadIntendedAssignees={(orderId) =>
              void loadIntendedAssignees(orderId)
            }
            onSaveIntendedAssignee={(orderId, intendedAssigneeUserId) =>
              void saveIntendedAssignee(orderId, intendedAssigneeUserId)
            }
            onSaveActualDispense={(orderId, actualQuantity, reason) =>
              void saveActualDispense(orderId, actualQuantity, reason)
            }
            onSavePrebillingOverride={(orderId, override) =>
              void savePrebillingOverride(orderId, override)
            }
            onSelectionChange={setSelectedOrderIds}
            onSort={handleOrderSort}
            onToggleSetChild={toggleSetChild}
            onUpdateBillingName={(orderId, billingName) =>
              updateDraftRow(orderId, { billingName })
            }
            onUpdateDetailInput={updateDraftDetailInput}
            onUpdatePriority={updateDraftPriority}
            onUpdateQuantity={(orderId, quantityInput) =>
              updateDraftRow(orderId, { quantityInput })
            }
            prebillingSavingOrderIds={prebillingSavingOrderIds}
            rows={visibleOrderRows}
            pendingRemovalOrderIds={pendingRemovalOrderIds}
            selectedOrderIds={selectedOrderIds}
            sortState={orderSortState}
            writeDisabled={writeDisabled}
          />
        </div>
        <ChartOrderDetailSheet
          workspaceId={bundle.encounter.workspaceId}
          onBeforeProfileSelect={() => commitDraftRows({ silent: true })}
          onProfileSelected={() => setOrderDraftReloadKey(key => key + 1)}
          medicationOrders={draftRows.filter(row => getChartOrderClinicalType(row) === "dispensing" && row.order.status !== "cancelled")
            .map(row => ({ id: row.order.id, name: row.order.displayName }))}
          onFlushDraft={() => {
            if (canUpdateOrders) void autoSaveDraftRef.current();
          }}
          onOpenChange={(open) => {
            if (!open) {
              if (canUpdateOrders) void autoSaveDraftRef.current();
              setDetailOrderId(null);
            }
          }}
          onUpdateDetailInput={updateDraftDetailInput}
          onUpdatePriority={updateDraftPriority}
          open={detailOrderId !== null}
          row={detailOrderRow}
          writeDisabled={writeDisabled}
        />
        <ChartOrderHistorySheet
          workspaceId={bundle.encounter.workspaceId}
          onExecutionSaved={async () => { await refreshOrderExecution(); }}
          execution={orderExecution}
          onOpenChange={(open) => !open && setHistoryOrderId(null)}
          open={historyOrderId !== null}
          row={historyOrderRow}
        />
        <ChartOrderMutationDialog
          medicationOrders={draftRows.filter(row => getChartOrderClinicalType(row) === "dispensing" && row.order.status !== "cancelled")
            .map(row => ({ id: row.order.id, name: row.order.displayName }))}
          draft={orderMutationDraft}
          onChange={setOrderMutationDraft}
          onConfirm={() => void commitOrderMutation()}
          onOpenChange={(open) => !open && setOrderMutationDraft(null)}
          row={mutationOrderRow}
        />
        <ChartOrderCatalogDialog
          initialQuery={catalogInitialQuery}
          onReturnFocus={quickAddReturn ? returnToQuickAdd : undefined}
          bundle={bundle}
          candidates={catalogRows}
          initialSelectedCatalogSourceKeys={
            catalogDialogSelection.initialSelectedSourceKeys
          }
          lockedCatalogSourceKeys={catalogDialogSelection.lockedSourceKeys}
          open={catalogDialogOpen}
          status={catalogSearchStatus}
          onApply={applyCatalogSelection}
          onOpenChange={setCatalogDialogOpen}
          onRetry={() => void loadCatalogRows()}
        />
        <ChartOrderSetConfigurationDialog
          onReturnFocus={quickAddReturn ? returnToQuickAdd : undefined}
          key={`${setCandidate?.sourceSetId ?? setCandidate?.sourcePresetId ?? "none"}-${setPreview?.selectionFingerprint ?? "empty"}`}
          candidate={setCandidate}
          error={setPreviewError}
          loading={setPreviewLoading}
          open={setCandidate !== null}
          preview={setPreview}
          rangeInput={setRangeInput}
          onApply={(selectionIntent) =>
            void applySetConfiguration(selectionIntent)
          }
          onOpenChange={(open) => {
            if (!open) closeSetConfiguration();
          }}
          onPreview={(rangeInput) => {
            if (!setCandidate) return;
            const selectionIntent =
              rangeInput === undefined
                ? { items: [] }
                : { items: [], rangeInput };
            void requestSetPreview(setCandidate, selectionIntent);
          }}
          onRangeInputChange={setSetRangeInput}
        />
        <ChartOrderFinanceFooter
          accessibilitySummary={orderFooterAccessibilitySummary}
          canRequestBilling={canRequestBilling}
          drawerOpen={billingDrawerOpen}
          displayState={billingAmountDisplayState}
          error={billingError}
          freshness={billingSummaryFreshness}
          hasAuthoritativeSummary={hasAuthoritativeBillingSummary}
          requesting={billingRequesting}
          saveStatusText={draftStatusText}
          summary={effectiveBillingSummary}
          onOpenDetails={() => {
            setBillingDrawerOpen((open) => !open);
            setBillingRequestError(undefined);
          }}
          onRequestBilling={() => void requestEncounterBilling(false)}
        />
        <ChartOrderBillingDetailAside
          canRequestBilling={canRequestBilling}
          displayState={billingAmountDisplayState}
          error={billingError}
          freshness={billingSummaryFreshness}
          hasAuthoritativeSummary={hasAuthoritativeBillingSummary}
          open={billingDrawerOpen}
          requesting={billingRequesting}
          summary={effectiveBillingSummary}
          onClose={() => setBillingDrawerOpen(false)}
          onRetry={() => void refreshBillingSummary()}
          onRequestBilling={() => void requestEncounterBilling(true)}
        />
        <Dialog
          open={orderActionDialog !== null}
          onOpenChange={(open) => !open && setOrderActionDialog(null)}
        >
          <EmrConfirmDialogContent
            title={`${orderActionLabel} 확인`}
            description={
              <span className="grid gap-3">
                <span>
                  선택한 확정 전 후보만 원자적으로 확정합니다. 선택하지 않은
                  후보는 공유 Draft에 남고, 비용이 있는 오더의 수납 후보는 같은
                  transaction에서 생성됩니다.
                </span>
                <ChartActualConfirmation rows={chartActualRows} drafts={chartActualDrafts}
                  disabled={writeDisabled || orderDraftSaveState === "saving"}
                  onChange={(id, value) => setChartActualDrafts(current => ({ ...current, [id]: value }))} />
                <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
                  <span>
                    환자: {bundle.patient.name} · 보호자 {guardianName}
                  </span>
                  <span>차트번호: {bundle.encounter.encounterNo}</span>
                  <span>
                    선택 오더: {selectedOrderIds.size}건 · 선택 금액{" "}
                    {selectedAmount.toLocaleString()}
                  </span>
                  <span>
                    재요청 포함:{" "}
                    {selectedRecheckOrderCount
                      ? `${selectedRecheckOrderCount}건`
                      : "없음"}
                  </span>
                </span>
              </span>
            }
            cancelLabel="다시 확인"
            confirmLabel={orderActionLabel}
            confirmDisabled={
              chartActualRecords === null ||
              writeDisabled ||
              pendingRemovedRootOrderIds.size > 0 ||
              orderDraftSaveState === "conflict" ||
              orderDraftSaveState === "saving"
            }
            onCancel={() => setOrderActionDialog(null)}
            onConfirm={() => void commitOrderConfirmation()}
          />
        </Dialog>
        <Dialog
          open={deleteOrderIds.length > 0}
          onOpenChange={(open) => !open && setDeleteOrderIds([])}
        >
          {deleteTargetRows.length > 0 ? (
            <EmrConfirmDialogContent
              title="오더를 삭제할까요?"
              description={
                <span className="grid gap-3">
                  <span>
                    {deleteTargetRows.length === 1
                      ? `${deleteTargetRows[0]?.order.displayName} 오더를`
                      : `${deleteTargetRows.length}개 오더를`}{" "}
                    현재 차트의 확정 전 후보에서 제외합니다.
                  </span>
                  <span className="rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
                    삭제하면 즉시 저장합니다. 확정·수행·청구된 오더는 이
                    작업으로 변경되지 않습니다.
                  </span>
                </span>
              }
              cancelLabel="취소"
              confirmLabel="삭제"
              confirmButtonVariant="destructive"
              closeAriaLabel="오더 삭제 확인 닫기"
              confirmDisabled={writeDisabled}
              onCancel={() => setDeleteOrderIds([])}
              onConfirm={confirmDeleteOrder}
            />
          ) : null}
        </Dialog>
      </div>
    </section>
  );
}

function ChartPreflightLine({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 emr-text-metadata">
      <span className="text-[var(--emr-text-tertiary)]">{label}</span>
      <span
        className={cn("text-right font-medium", emphasis && "text-primary")}
      >
        {value}
      </span>
    </div>
  );
}

function ChartPreflightField({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="grid min-h-9 min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-x-2 sm:gap-x-3 [&>*]:min-w-0">
      <label className="emr-control-text flex h-9 min-w-0 items-center gap-2 font-medium text-muted-foreground">
        <span className="flex size-4 shrink-0 items-center justify-center text-[var(--emr-text-tertiary)] [&_svg]:size-4">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </label>
      {children}
    </div>
  );
}

function ChartReadonlyField({ value }: { value: string }) {
  return (
    <div className="emr-control-text flex h-9 w-full items-center rounded-[var(--emr-radius-control)] border border-input bg-card px-3 text-left text-foreground">
      <span className="w-full truncate text-left font-medium">{value}</span>
    </div>
  );
}

const callRoomPreferenceStoragePrefix = "clair.chart.callRoomPreference.v1";

function getCallRoomPreferenceStorageKey({
  actorUserId,
  workspaceId,
}: {
  actorUserId?: string;
  workspaceId?: string;
}) {
  if (!actorUserId || !workspaceId) return null;
  return `${callRoomPreferenceStoragePrefix}:${workspaceId}:${actorUserId}`;
}

function readCallRoomPreference({
  actorUserId,
  roomIds,
  workspaceId,
}: {
  actorUserId?: string;
  roomIds: Set<string>;
  workspaceId?: string;
}) {
  if (typeof window === "undefined") return "";
  const key = getCallRoomPreferenceStorageKey({ actorUserId, workspaceId });
  if (!key) return "";

  const storedRoomId = window.localStorage.getItem(key);
  return storedRoomId && roomIds.has(storedRoomId) ? storedRoomId : "";
}

function writeCallRoomPreference({
  actorUserId,
  roomId,
  shouldSave,
  workspaceId,
}: {
  actorUserId?: string;
  roomId: string;
  shouldSave: boolean;
  workspaceId?: string;
}) {
  if (typeof window === "undefined") return;
  const key = getCallRoomPreferenceStorageKey({ actorUserId, workspaceId });
  if (!key) return;

  if (shouldSave) {
    window.localStorage.setItem(key, roomId);
    return;
  }

  window.localStorage.removeItem(key);
}

function EmptyChartState({
  onOpenQueue,
  onRefresh,
  permissionDenied = false,
  queueEmpty = false,
  readError = false,
  refreshing = false,
  selectedDate,
}: {
  onOpenQueue?: () => void;
  onRefresh?: () => void | Promise<void>;
  permissionDenied?: boolean;
  queueEmpty?: boolean;
  readError?: boolean;
  refreshing?: boolean;
  selectedDate: string;
}) {
  const kind = permissionDenied
    ? "no-permission"
    : readError
      ? "read-error"
      : queueEmpty
        ? "upstream-pending"
        : "no-scope-result";
  const title = permissionDenied
    ? "진료 차트 조회 권한이 없습니다"
    : readError
      ? "진료 업무를 불러오지 못했습니다"
      : queueEmpty
        ? "진료 업무가 없습니다"
        : "환자를 선택해 주세요";
  const description = permissionDenied
    ? "현재 계정의 병원·역할 권한을 확인해 주세요."
    : readError
      ? "연결 상태를 확인한 뒤 다시 시도해 주세요."
      : queueEmpty
        ? `${formatCompactKoreanOperatingDateLabel(selectedDate)}에 표시할 진료 업무가 없습니다.`
        : "대기열에서 환자를 선택하면 차트가 표시됩니다.";
  const canRefresh =
    (queueEmpty || readError || permissionDenied) && Boolean(onRefresh);
  const canOpenQueue = Boolean(onOpenQueue) && !readError && !permissionDenied;
  const hasTwoActions = canRefresh && canOpenQueue;
  const refreshAction = canRefresh ? (
    <Button
      size="default"
      variant="outline"
      roundness="round"
      className="border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-white-alpha-8)] text-[var(--clair-color-atomic-neutral-900)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-white-alpha-8)] hover:text-[var(--clair-color-atomic-neutral-900)]"
      disabled={refreshing}
      onClick={() => void onRefresh?.()}
    >
      <CdsActionsRefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
      {readError || permissionDenied ? "다시 시도" : "새로고침"}
    </Button>
  ) : undefined;
  const openQueueAction = canOpenQueue ? (
    <Button
      type="button"
      size="default"
      variant={hasTwoActions ? "default" : "outline"}
      roundness="round"
      className={cn(
        "hidden md:inline-flex",
        hasTwoActions
          ? "bg-[var(--clair-color-atomic-neutral-900)] text-[var(--clair-color-atomic-common-100)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-neutral-900)] hover:text-[var(--clair-color-atomic-common-100)]"
          : "border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-white-alpha-8)] text-[var(--clair-color-atomic-neutral-900)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-white-alpha-8)] hover:text-[var(--clair-color-atomic-neutral-900)]",
      )}
      onClick={onOpenQueue}
    >
      진료 대기열 열기
    </Button>
  ) : undefined;

  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <EmrEmptyState
        kind={kind}
        priority="supporting"
        surface="content"
        title={title}
        description={description}
        primaryAction={hasTwoActions ? openQueueAction : undefined}
        secondaryAction={
          hasTwoActions ? refreshAction : (openQueueAction ?? refreshAction)
        }
        size="xl"
        testId="chart-content-empty-state"
      />
    </div>
  );
}

function ChartContentLoadingState() {
  return (
    <div
      aria-live="polite"
      className="flex h-full items-center justify-center px-6 py-10"
      data-testid="chart-content-loading-state"
      role="status"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <span className="sr-only">진료 업무를 불러오는 중입니다</span>
        <Skeleton
          aria-hidden="true"
          className="h-10 w-10 rounded-xl motion-reduce:animate-none"
        />
        <Skeleton
          aria-hidden="true"
          className="h-4 w-44 motion-reduce:animate-none"
        />
        <Skeleton
          aria-hidden="true"
          className="h-3 w-64 motion-reduce:animate-none"
        />
      </div>
    </div>
  );
}

function useDelayedBoolean(value: boolean, delayMs: number) {
  const [delayedValue, setDelayedValue] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(
      () => {
        setDelayedValue(value);
      },
      value ? delayMs : 0,
    );

    return () => window.clearTimeout(timerId);
  }, [delayMs, value]);

  return value && delayedValue;
}

function ChartDetailPendingIndicator() {
  return (
    <span
      aria-label="진료 차트 상세 정보를 불러오는 중입니다"
      aria-live="polite"
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--emr-radius-control)] border border-[var(--emr-status-neutral-border)] bg-[var(--emr-surface-muted)] px-2 emr-text-metadata font-medium text-[var(--emr-text-secondary)]"
      data-testid="chart-detail-pending-indicator"
      role="status"
    >
      <span className="sr-only">상세 정보 불러오는 중</span>
      <Skeleton
        aria-hidden="true"
        className="h-3 w-28 motion-reduce:animate-none"
      />
    </span>
  );
}

function ChartPanelPendingState({
  className,
  description,
  title,
}: {
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="chart-panel-skeleton"
      data-loading-label={title}
      className={cn("grid min-w-0 flex-1 gap-2", className)}
    >
      <span className="sr-only">
        {title}
        {description ? `. ${description}` : ""}
      </span>
      <div aria-hidden="true" className="flex min-w-0 items-center gap-2">
        <Skeleton className="h-3 w-20 shrink-0 motion-reduce:animate-none" />
        <Skeleton className="h-3 min-w-16 max-w-72 flex-1 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function ChartContent({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  useScenarioEncounterSync(workspaceId);

  const searchParams = useSearchParams();
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const historyViewEncounterId = useChartStore(
    (state) => state.historyViewEncounterId,
  );
  const chartHistoryError = useChartStore((state) => state.chartHistoryError);
  const chartHistoryRecords = useChartStore(
    (state) => state.chartHistoryRecords,
  );
  const chartHistoryRefreshNonce = useChartStore(
    (state) => state.chartHistoryRefreshNonce,
  );
  const chartHistoryScope = useChartStore((state) => state.chartHistoryScope);
  const chartHistoryStatus = useChartStore((state) => state.chartHistoryStatus);
  const chartHistoryTotalCount = useChartStore(
    (state) => state.chartHistoryTotalCount,
  );
  const pendingConsultationCallEncounterId = useChartStore(
    (state) => state.pendingConsultationCallEncounterId,
  );
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const selectHistoryEncounter = useChartStore(
    (state) => state.selectHistoryEncounter,
  );
  const requestChartHistoryRefresh = useChartStore(
    (state) => state.requestChartHistoryRefresh,
  );
  const setChartHistoryState = useChartStore(
    (state) => state.setChartHistoryState,
  );
  const clearPendingConsultationCall = useChartStore(
    (state) => state.clearPendingConsultationCall,
  );
  const {
    error: liveQueueError,
    queueScopeMatches,
    records: liveQueueRecords,
    selectedDate,
    status: liveQueueStatus,
  } = useScopedChartLiveQueue(workspaceId);
  const updateLiveQueueRecord = useChartStore(
    (state) => state.updateLiveQueueRecord,
  );
  // A live session must never resolve a sample alias to a real order writer.
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    getAuthRuntimeMode().authProvider === "mock";
  const {
    contentAsideOpen,
    modulePanelOpen,
    moduleRefreshActions,
    setContentAsideOpen,
    setModulePanelOpen,
    setSelectedQueueItem,
  } = useLayoutStore();
  const [collapsedClinicalPanels, setCollapsedClinicalPanels] = useState<
    Set<ChartCollapsiblePanelId>
  >(() => new Set());
  const [orderPanelCollapsed, setOrderPanelCollapsedState] = useState(false);
  const setClinicalPanelCollapsed = useCallback(
    (panelId: ChartCollapsiblePanelId, collapsed: boolean) => {
      setCollapsedClinicalPanels((current) => {
        const next = new Set(current);
        if (collapsed) next.add(panelId);
        else next.delete(panelId);
        return next;
      });

      window.requestAnimationFrame(() => {
        const targetAttribute = collapsed
          ? "data-chart-panel-expand"
          : "data-chart-panel-collapse";
        document
          .querySelector<HTMLElement>(`[${targetAttribute}="${panelId}"]`)
          ?.focus();
      });
    },
    [],
  );
  const setOrderPanelCollapsed = useCallback((collapsed: boolean) => {
    setOrderPanelCollapsedState(collapsed);

    window.requestAnimationFrame(() => {
      const targetAttribute = collapsed
        ? "data-chart-panel-expand"
        : "data-chart-panel-collapse";
      document
        .querySelector<HTMLElement>(`[${targetAttribute}="order"]`)
        ?.focus();
    });
  }, []);
  const {
    hydrated: authHydrated,
    session: authSession,
    hydrate: hydrateAuthSession,
  } = useAuthClient();
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const resizingPointerIdRef = useRef<number | null>(null);
  const activeBundle = getSelectedBundle(
    queueScopeMatches || allowMockFallback ? selectedEncounterId : "",
    liveQueueRecords,
    { allowMockFallback },
  );
  const chartHistoryScopeMatches = Boolean(
    activeBundle &&
    chartHistoryScope?.workspaceId === workspaceId &&
    chartHistoryScope.patientId === activeBundle.patient.id,
  );
  const scopedChartHistoryRecords = useMemo(
    () => (chartHistoryScopeMatches ? chartHistoryRecords : []),
    [chartHistoryRecords, chartHistoryScopeMatches],
  );
  const bundle = getDisplayedChartBundle({
    activeBundle,
    historyRecords: scopedChartHistoryRecords,
    historyViewEncounterId,
  });
  const isHistoricalView = Boolean(
    bundle && activeBundle && bundle.encounter.id !== activeBundle.encounter.id,
  );
  const { openGuardianProfile, openPatientProfile } =
    useChartPatientGuardianProfileActions({
      patient: bundle?.patient,
      primaryGuardian: bundle?.primaryGuardian,
    });
  const selectedLiveQueueRecord = liveQueueRecords.find(
    (record) => record.encounter.id === selectedEncounterId,
  );
  const latestSoap = bundle?.soapNotes.at(-1);
  const activeEncounterId = bundle?.encounter.id;
  const activeWorkspaceId = bundle?.encounter.workspaceId;
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const diagnosisCatalogActorKey = authSession?.id ?? "signed-out";
  const [persistedSoapState, setPersistedSoapState] = useState<{
    encounterId?: string;
    soapNote?: SoapNote | null;
    status: "idle" | "loading" | "error";
  }>({ status: "idle" });
  const [chartCompletionState, setChartCompletionState] = useState<{
    completion?: ChartCompletionSnapshot | null;
    encounterId?: string;
    status: "idle" | "loading" | "saving" | "saved" | "error";
  }>({ status: "idle" });
  const effectiveLatestSoap =
    persistedSoapState.encounterId === activeEncounterId &&
    persistedSoapState.soapNote
      ? persistedSoapState.soapNote
      : latestSoap;
  const effectiveEncounter =
    bundle &&
    chartCompletionState.encounterId === activeEncounterId &&
    chartCompletionState.completion
      ? {
          ...bundle.encounter,
          status: chartCompletionState.completion.status,
          chartCompletedAt: chartCompletionState.completion.chartCompletedAt,
          chartCompletedByUserId:
            chartCompletionState.completion.chartCompletedByUserId,
          updatedAt: chartCompletionState.completion.updatedAt,
        }
      : bundle?.encounter;
  const effectiveBundle =
    bundle && effectiveEncounter
      ? { ...bundle, encounter: effectiveEncounter }
      : bundle;
  const [chartTopPercent, setChartTopPercent] = useState(
    CHART_TOP_DEFAULT_PERCENT,
  );
  const [isChartResizing, setIsChartResizing] = useState(false);
  const [chartCompleteDialogOpen, setChartCompleteDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [selectedCallRoomId, setSelectedCallRoomId] = useState("");
  const [saveCallRoomPreference, setSaveCallRoomPreference] = useState(false);
  const [preferredCallRoomId, setPreferredCallRoomId] = useState("");
  const [returnToWaitingDialogOpen, setReturnToWaitingDialogOpen] =
    useState(false);
  const [cancelEncounterDialogOpen, setCancelEncounterDialogOpen] =
    useState(false);
  const [cancelEncounterReason, setCancelEncounterReason] = useState("");
  const [consultationFlowState, setConsultationFlowState] = useState<{
    action?: "call" | "start" | "return_to_waiting";
    status: "idle" | "saving" | "error";
  }>({ status: "idle" });
  const [encounterCancelState, setEncounterCancelState] = useState<{
    status: "idle" | "saving" | "error";
    message?: string;
  }>({ status: "idle" });
  const [diagnosisState, setDiagnosisState] = useState<{
    encounterId?: string;
    rows: EditableDiagnosis[];
  }>(() => ({
    encounterId: bundle?.encounter.id,
    rows: bundle
      ? bundle.diagnoses.map((diagnosis, index) =>
          toEditableDiagnosis(diagnosis, index),
        )
      : [],
  }));
  const [diagnosisPersistenceState, setDiagnosisPersistenceState] = useState<{
    encounterId?: string;
    status: "idle" | "loading" | "saving" | "saved" | "error";
  }>({ status: "idle" });
  const [diagnosisCatalogState, setDiagnosisCatalogState] = useState<{
    workspaceId?: string;
    page: AssessmentClassificationCatalogPage;
    status: AssessmentClassificationCatalogStatus;
    error?: string;
  }>({
    page: {
      catalog: [],
      systems: [],
      diseaseGroups: [],
      nextCursor: null,
    },
    status: "loading",
  });

  if (diagnosisState.encounterId !== activeEncounterId) {
    setDiagnosisState({
      encounterId: activeEncounterId,
      rows: bundle
        ? bundle.diagnoses.map((diagnosis, index) =>
            toEditableDiagnosis(diagnosis, index),
          )
        : [],
    });
  }

  const rawDiagnosisRows = diagnosisState.rows;
  const diagnosisRows =
    diagnosisState.encounterId === activeEncounterId
      ? rawDiagnosisRows
      : bundle
        ? bundle.diagnoses.map((diagnosis, index) =>
            toEditableDiagnosis(diagnosis, index),
          )
        : [];
  const setDiagnosisRows: Dispatch<SetStateAction<EditableDiagnosis[]>> = (
    nextRows,
  ) => {
    setDiagnosisState((current) => {
      const rows =
        typeof nextRows === "function"
          ? (
              nextRows as (
                currentRows: EditableDiagnosis[],
              ) => EditableDiagnosis[]
            )(current.rows)
          : nextRows;

      return {
        ...current,
        rows,
      };
    });
  };
  const bundleEncounterId = bundle?.encounter.id;
  const orderGroups = useMemo(
    () => (bundleEncounterId ? getChartOrderGroups(bundleEncounterId) : []),
    [bundleEncounterId],
  );
  const allOrders = useMemo(
    () => orderGroups.flatMap(({ orders }) => orders),
    [orderGroups],
  );
  const effectiveQueueEntry = isHistoricalView
    ? undefined
    : selectedLiveQueueRecord?.queueEntry;
  const soapLoading =
    Boolean(activeEncounterId && activeWorkspaceId) &&
    !allowMockFallback &&
    (!authHydrated ||
      persistedSoapState.encounterId !== activeEncounterId ||
      persistedSoapState.status === "loading");
  const diagnosisLoading =
    Boolean(activeEncounterId && activeWorkspaceId) &&
    !allowMockFallback &&
    (!authHydrated ||
      diagnosisPersistenceState.encounterId !== activeEncounterId ||
      diagnosisPersistenceState.status === "loading");
  const chartCompletionLoading =
    Boolean(activeEncounterId && activeWorkspaceId) &&
    !allowMockFallback &&
    (!authHydrated ||
      chartCompletionState.encounterId !== activeEncounterId ||
      chartCompletionState.status === "loading");
  const detailLoading =
    soapLoading || diagnosisLoading || chartCompletionLoading;
  const detailHydrationPending = detailLoading;
  const chartWriteDisabled = detailHydrationPending || isHistoricalView;
  const orderLoading = detailHydrationPending;
  const showDetailPendingIndicator = useDelayedBoolean(
    detailHydrationPending,
    chartDetailPendingDelayMs,
  );
  const getChartSplitBounds = () => {
    const workspace = chartWorkspaceRef.current;
    const availableHeight = workspace
      ? workspace.getBoundingClientRect().height -
        CHART_RESIZER_HEIGHT_PX -
        CHART_WORKSPACE_BOTTOM_PADDING_PX
      : 0;

    if (availableHeight <= CHART_TOP_MIN_PX + CHART_ORDER_MIN_PX) {
      return { min: 35, max: 65 };
    }

    return {
      min: (CHART_TOP_MIN_PX / availableHeight) * 100,
      max: ((availableHeight - CHART_ORDER_MIN_PX) / availableHeight) * 100,
    };
  };
  const setClampedChartTopPercent = (nextPercent: number) => {
    const { min, max } = getChartSplitBounds();

    setChartTopPercent(clampNumber(nextPercent, min, max));
  };
  const resizeChartWorkspace = (clientY: number) => {
    const workspace = chartWorkspaceRef.current;

    if (!workspace) return;

    const rect = workspace.getBoundingClientRect();
    const availableHeight =
      rect.height - CHART_RESIZER_HEIGHT_PX - CHART_WORKSPACE_BOTTOM_PADDING_PX;

    if (availableHeight <= 0) return;

    const topHeight = clientY - rect.top;

    setClampedChartTopPercent((topHeight / availableHeight) * 100);
  };
  const handleChartResizePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    resizingPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsChartResizing(true);
    resizeChartWorkspace(event.clientY);
  };
  const handleChartResizePointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!isChartResizing || resizingPointerIdRef.current !== event.pointerId)
      return;

    if (event.buttons !== 1) {
      resizingPointerIdRef.current = null;
      setIsChartResizing(false);
      return;
    }

    resizeChartWorkspace(event.clientY);
  };
  const stopChartResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      resizingPointerIdRef.current !== null &&
      resizingPointerIdRef.current !== event.pointerId
    )
      return;

    resizingPointerIdRef.current = null;
    setIsChartResizing(false);
  };
  const handleChartResizeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setClampedChartTopPercent(chartTopPercent - CHART_RESIZER_STEP_PERCENT);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setClampedChartTopPercent(chartTopPercent + CHART_RESIZER_STEP_PERCENT);
    } else if (event.key === "Home") {
      event.preventDefault();
      setClampedChartTopPercent(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setClampedChartTopPercent(100);
    }
  };
  const handleChartCompletionConfirm = async () => {
    if (chartCompletionState.status === "saving") return;
    if (detailHydrationPending) return;
    if (isHistoricalView) {
      toast.error("과거 차트는 읽기 전용으로 열려 있어요.");
      return;
    }
    if (!activeEncounterId || !activeWorkspaceId) {
      toast.error("진료 차트를 먼저 선택해 주세요.");
      return;
    }

    setChartCompletionState((current) => ({
      completion:
        current.encounterId === activeEncounterId ? current.completion : null,
      encounterId: activeEncounterId,
      status: "saving",
    }));

    const result = await completeChartRoute({
      actorHeaders,
      encounterId: activeEncounterId,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setChartCompletionState((current) => ({
        completion:
          current.encounterId === activeEncounterId ? current.completion : null,
        encounterId: activeEncounterId,
        status: "error",
      }));
      toast.error(
        result.denialReason === "permission_missing"
          ? "진료 완료 권한이 없어 저장하지 못했어요."
          : "진료 완료 상태를 저장하지 못했어요.",
      );
      return;
    }

    setChartCompletionState({
      completion: result.completion,
      encounterId: activeEncounterId,
      status: "saved",
    });
    setChartCompleteDialogOpen(false);
    requestChartHistoryRefresh();
    toast.success("진료 완료 상태를 저장했어요.");
  };
  const handleConsultationFlowMutation = async (
    action: "call" | "start" | "return_to_waiting",
  ) => {
    if (consultationFlowState.status === "saving") return;
    if (detailHydrationPending) return;
    if (isHistoricalView) {
      toast.error("과거 차트는 읽기 전용으로 열려 있어요.");
      return;
    }
    if (!activeEncounterId || !activeWorkspaceId || !selectedLiveQueueRecord) {
      toast.error("진료 대기열에서 환자를 먼저 선택해 주세요.");
      return;
    }
    if (action === "call" && !selectedCallRoomId) {
      toast.error("진료실을 선택해 주세요.");
      return;
    }

    setConsultationFlowState({ action, status: "saving" });
    const result = await mutateConsultationFlowRoute({
      action,
      actorHeaders,
      encounterId: activeEncounterId,
      roomId: action === "call" ? selectedCallRoomId : undefined,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setConsultationFlowState({ action, status: "error" });
      toast.error(
        result.denialReason === "permission_missing"
          ? "진료 흐름 변경 권한이 없어 저장하지 못했어요."
          : action === "call"
            ? "호출과 진료 시작 상태를 저장하지 못했어요."
            : action === "return_to_waiting"
              ? "대기 상태로 변경하지 못했어요."
              : "진료 시작 상태를 저장하지 못했어요.",
      );
      return;
    }

    updateLiveQueueRecord({
      ...selectedLiveQueueRecord,
      encounter: result.flow.encounter,
      queueEntry: result.flow.queueEntry,
    });
    saveChartLiveEncounterHandoff({
      encounter: result.flow.encounter,
      patient: selectedLiveQueueRecord.patient,
      primaryGuardian: selectedLiveQueueRecord.primaryGuardian,
      veterinarianName: selectedLiveQueueRecord.veterinarianName,
    });
    if (action === "call") {
      writeCallRoomPreference({
        actorUserId: authSession?.id,
        roomId: selectedCallRoomId,
        shouldSave: saveCallRoomPreference,
        workspaceId: activeWorkspaceId,
      });
      setPreferredCallRoomId(saveCallRoomPreference ? selectedCallRoomId : "");
    }
    setConsultationFlowState({ action, status: "idle" });
    setCallDialogOpen(false);
    setReturnToWaitingDialogOpen(false);
    setSelectedCallRoomId("");
    setSaveCallRoomPreference(false);
    requestChartHistoryRefresh();
    toast.success(
      action === "call"
        ? "환자를 호출하고 진료를 시작했어요."
        : action === "return_to_waiting"
          ? "대기 상태로 변경했어요."
          : "진료를 시작했어요.",
    );
  };
  const handleCancelEncounterConfirm = async () => {
    if (encounterCancelState.status === "saving") return;
    if (detailHydrationPending) return;
    if (isHistoricalView) {
      toast.error("과거 차트는 읽기 전용으로 열려 있어요.");
      return;
    }
    if (!activeEncounterId || !activeWorkspaceId || !selectedLiveQueueRecord) {
      toast.error("진료 대기열에서 환자를 먼저 선택해 주세요.");
      return;
    }

    const reason = cancelEncounterReason.trim();
    if (!reason) {
      setEncounterCancelState({
        status: "error",
        message: "진료 취소 사유를 입력해 주세요.",
      });
      return;
    }

    setEncounterCancelState({ status: "saving" });
    const result = await cancelEncounterRoute({
      actorHeaders,
      cancelReason: reason,
      encounterId: activeEncounterId,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setEncounterCancelState({
        status: "error",
        message:
          result.fieldErrors?.cancelReason ??
          (result.denialReason === "permission_missing"
            ? "진료 취소 권한이 없어 저장하지 못했어요."
            : "진료 취소 상태를 저장하지 못했어요."),
      });
      return;
    }

    updateLiveQueueRecord({
      ...selectedLiveQueueRecord,
      encounter: result.cancellation.encounter,
      queueEntry: result.cancellation.queueEntry,
    });
    setEncounterCancelState({ status: "idle" });
    setCancelEncounterDialogOpen(false);
    setCancelEncounterReason("");
    requestChartHistoryRefresh();
    toast.success("진료를 취소했어요.");
  };
  const handleDiagnosisRowsChange = async (nextRows: EditableDiagnosis[]) => {
    if (detailHydrationPending) return;
    if (isHistoricalView) {
      toast.error("과거 차트는 읽기 전용으로 열려 있어요.");
      return;
    }
    if (!activeEncounterId || !activeWorkspaceId) {
      toast.error("진료 차트를 먼저 선택해 주세요.");
      return;
    }

    setDiagnosisPersistenceState({
      encounterId: activeEncounterId,
      status: "saving",
    });

    const result = await saveChartDiagnosesRoute({
      actorHeaders,
      diagnoses: nextRows,
      encounterId: activeEncounterId,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setDiagnosisPersistenceState({
        encounterId: activeEncounterId,
        status: "error",
      });
      toast.error(
        result.denialReason === "permission_missing"
          ? "진단명 저장 권한이 없어 저장하지 못했어요."
          : "진단명을 저장하지 못했어요.",
      );
      return;
    }

    setDiagnosisState({
      encounterId: activeEncounterId,
      rows: result.diagnoses.map((diagnosis, index) =>
        toEditableDiagnosis(diagnosis, index),
      ),
    });
    setDiagnosisPersistenceState({
      encounterId: activeEncounterId,
      status: "saved",
    });
    requestChartHistoryRefresh();
  };
  const handleReturnToQueue = useCallback(() => {
    setSelectedQueueItem("treatment", "");
    selectEncounter("");

    const href = buildWorkspaceSurfaceRoute({
      moduleId: "treatment",
      removeParams: ["encounterId", "patientId", "scenario"],
      search: searchParams,
      workspaceId,
    });

    onNavigateWorkspaceSurface?.(href, "treatment");
  }, [
    onNavigateWorkspaceSurface,
    searchParams,
    selectEncounter,
    setSelectedQueueItem,
    workspaceId,
  ]);

  useEffect(() => {
    hydrateAuthSession();
  }, [hydrateAuthSession]);

  useEffect(() => {
    const patientId = activeBundle?.patient.id;
    if (allowMockFallback || !authHydrated || !patientId) return;

    let cancelled = false;

    async function loadHistory() {
      setChartHistoryState({
        records: [],
        scope: { patientId: patientId!, workspaceId },
        status: "loading",
        totalCount: 0,
      });

      const records: ChartPatientHistoryRecord[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | undefined;
      let totalCount = 0;

      while (true) {
        const result = await loadChartPatientHistoryPage({
          actorHeaders,
          cursor,
          patientId: patientId!,
          workspaceId,
        });
        if (cancelled) return;

        if (!result.ok) {
          setChartHistoryState({
            error: result.denialReason ?? result.error ?? "db_read_failed",
            records: [],
            scope: { patientId: patientId!, workspaceId },
            status: "error",
            totalCount: 0,
          });
          return;
        }

        records.push(...result.items);
        totalCount = result.totalCount;
        if (!result.nextCursor || records.length >= totalCount) break;
        if (seenCursors.has(result.nextCursor)) {
          setChartHistoryState({
            error: "db_read_failed",
            records: [],
            scope: { patientId: patientId!, workspaceId },
            status: "error",
            totalCount: 0,
          });
          return;
        }
        seenCursors.add(result.nextCursor);
        cursor = result.nextCursor;
      }

      setChartHistoryState({
        records,
        scope: { patientId: patientId!, workspaceId },
        status: "ready",
        totalCount,
      });
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [
    activeBundle?.patient.id,
    actorHeaders,
    allowMockFallback,
    authHydrated,
    chartHistoryRefreshNonce,
    setChartHistoryState,
    workspaceId,
  ]);

  useEffect(() => {
    if (
      !historyViewEncounterId ||
      !chartHistoryScopeMatches ||
      chartHistoryStatus !== "ready"
    ) {
      return;
    }

    if (
      !scopedChartHistoryRecords.some(
        (record) => record.encounter.id === historyViewEncounterId,
      )
    ) {
      selectHistoryEncounter("");
    }
  }, [
    chartHistoryScopeMatches,
    chartHistoryStatus,
    historyViewEncounterId,
    scopedChartHistoryRecords,
    selectHistoryEncounter,
  ]);

  const handleOpenCallDialog = () => {
    const roomIds = new Set(getConsultationCallRooms().map((room) => room.id));
    const storedRoomId = readCallRoomPreference({
      actorUserId: authSession?.id,
      roomIds,
      workspaceId: activeWorkspaceId,
    });

    setPreferredCallRoomId(storedRoomId);
    setSaveCallRoomPreference(Boolean(storedRoomId));
    setSelectedCallRoomId(storedRoomId);
    setCallDialogOpen(true);
  };

  useEffect(() => {
    if (
      !pendingConsultationCallEncounterId ||
      pendingConsultationCallEncounterId !== activeEncounterId ||
      !bundle?.encounter.status
    ) {
      return;
    }

    if (
      bundle.encounter.status !== "waiting" ||
      effectiveQueueEntry?.status !== "waiting"
    ) {
      clearPendingConsultationCall();
      return;
    }

    const timer = window.setTimeout(() => {
      const roomIds = new Set(
        getConsultationCallRooms().map((room) => room.id),
      );
      const storedRoomId = readCallRoomPreference({
        actorUserId: authSession?.id,
        roomIds,
        workspaceId: activeWorkspaceId,
      });

      setPreferredCallRoomId(storedRoomId);
      setSaveCallRoomPreference(Boolean(storedRoomId));
      setSelectedCallRoomId(storedRoomId);
      setCallDialogOpen(true);
      clearPendingConsultationCall();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    activeEncounterId,
    activeWorkspaceId,
    authSession?.id,
    bundle?.encounter.status,
    clearPendingConsultationCall,
    effectiveQueueEntry?.status,
    pendingConsultationCallEncounterId,
  ]);

  useEffect(() => {
    if (!authHydrated || !activeEncounterId || !activeWorkspaceId) return;

    let cancelled = false;

    async function loadPersistedSoap() {
      setPersistedSoapState((current) => ({
        encounterId: activeEncounterId,
        soapNote:
          current.encounterId === activeEncounterId ? current.soapNote : null,
        status: "loading",
      }));

      const result = await loadChartSoapNote({
        actorHeaders,
        encounterId: activeEncounterId!,
        workspaceId: activeWorkspaceId!,
      });

      if (cancelled) return;

      setPersistedSoapState({
        encounterId: activeEncounterId,
        soapNote: result.ok ? result.soapNote : null,
        status: result.ok ? "idle" : "error",
      });
    }

    void loadPersistedSoap();

    return () => {
      cancelled = true;
    };
  }, [activeEncounterId, activeWorkspaceId, actorHeaders, authHydrated]);

  useEffect(() => {
    if (!authHydrated || !activeWorkspaceId) return;

    const workspaceId = activeWorkspaceId;
    const cachedPage = getCachedDiagnosisCatalogPage({
      actorKey: diagnosisCatalogActorKey,
      workspaceId,
    });

    let cancelled = false;

    async function loadClassificationCatalog() {
      setDiagnosisCatalogState({
        page: cachedPage ?? {
          catalog: [],
          systems: [],
          diseaseGroups: [],
          nextCursor: null,
        },
        status: cachedPage ? "ready" : "loading",
        workspaceId,
      });

      const result = await loadDiagnosisCatalogPage({
        actorKey: diagnosisCatalogActorKey,
        actorHeaders,
        force: true,
        workspaceId,
      });

      if (cancelled) return;

      if (result.ok) {
        setDiagnosisCatalogState({
          page: result.page,
          status: "ready",
          workspaceId,
        });
        return;
      }

      if (cachedPage && result.catalogStatus !== "permission") {
        setDiagnosisCatalogState({
          page: cachedPage,
          error: result.error,
          status: "ready",
          workspaceId,
        });
        return;
      }

      setDiagnosisCatalogState({
        page: {
          catalog: [],
          systems: [],
          diseaseGroups: [],
          nextCursor: null,
        },
        error: result.error,
        status: result.catalogStatus,
        workspaceId,
      });
    }

    void loadClassificationCatalog();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, actorHeaders, authHydrated, diagnosisCatalogActorKey]);

  const searchDiagnosisCatalogPage = useCallback(
    (query: DiagnosisCatalogClientQuery, signal: AbortSignal) => {
      if (!activeWorkspaceId) {
        return Promise.resolve({
          ok: false as const,
          status: 400,
          catalogStatus: "error" as const,
          error: "workspace_missing",
        });
      }
      return loadDiagnosisCatalogPage({
        ...query,
        actorHeaders,
        actorKey: diagnosisCatalogActorKey,
        force: true,
        signal,
        workspaceId: activeWorkspaceId,
      });
    },
    [activeWorkspaceId, actorHeaders, diagnosisCatalogActorKey],
  );

  useEffect(() => {
    if (!authHydrated || !activeEncounterId || !activeWorkspaceId) return;

    let cancelled = false;

    async function loadPersistedDiagnoses() {
      setDiagnosisPersistenceState({
        encounterId: activeEncounterId!,
        status: "loading",
      });

      const result = await loadChartDiagnoses({
        actorHeaders,
        encounterId: activeEncounterId!,
        workspaceId: activeWorkspaceId!,
      });

      if (cancelled) return;

      if (result.ok) {
        setDiagnosisState({
          encounterId: activeEncounterId,
          rows: result.diagnoses.map((diagnosis, index) =>
            toEditableDiagnosis(diagnosis, index),
          ),
        });
        setDiagnosisPersistenceState({
          encounterId: activeEncounterId,
          status: "idle",
        });
        return;
      }

      setDiagnosisPersistenceState({
        encounterId: activeEncounterId,
        status: "error",
      });
    }

    void loadPersistedDiagnoses();

    return () => {
      cancelled = true;
    };
  }, [activeEncounterId, activeWorkspaceId, actorHeaders, authHydrated]);

  useEffect(() => {
    if (!authHydrated || !activeEncounterId || !activeWorkspaceId) return;

    let cancelled = false;

    async function loadPersistedCompletion() {
      setChartCompletionState((current) => ({
        completion:
          current.encounterId === activeEncounterId ? current.completion : null,
        encounterId: activeEncounterId!,
        status: "loading",
      }));

      const result = await loadChartCompletion({
        actorHeaders,
        encounterId: activeEncounterId!,
        workspaceId: activeWorkspaceId!,
      });

      if (cancelled) return;

      setChartCompletionState({
        completion: result.ok ? result.completion : null,
        encounterId: activeEncounterId,
        status: result.ok ? "idle" : "error",
      });
    }

    void loadPersistedCompletion();

    return () => {
      cancelled = true;
    };
  }, [activeEncounterId, activeWorkspaceId, actorHeaders, authHydrated]);

  useEffect(() => {
    if (!isChartResizing) return;

    const stopResize = () => {
      resizingPointerIdRef.current = null;
      setIsChartResizing(false);
    };
    const stopPointerResize = (event: globalThis.PointerEvent) => {
      if (
        resizingPointerIdRef.current !== null &&
        resizingPointerIdRef.current !== event.pointerId
      )
        return;

      stopResize();
    };

    window.addEventListener("pointerup", stopPointerResize);
    window.addEventListener("pointercancel", stopPointerResize);
    window.addEventListener("blur", stopResize);

    return () => {
      window.removeEventListener("pointerup", stopPointerResize);
      window.removeEventListener("pointercancel", stopPointerResize);
      window.removeEventListener("blur", stopResize);
    };
  }, [isChartResizing]);

  if (!bundle || !effectiveBundle) {
    const refreshAction = moduleRefreshActions.treatment;
    const queueEmpty =
      liveQueueStatus === "ready" && liveQueueRecords.length === 0;

    if (liveQueueStatus === "idle" || liveQueueStatus === "loading") {
      return <ChartContentLoadingState />;
    }

    return (
      <EmptyChartState
        onOpenQueue={
          liveQueueStatus === "ready" && !modulePanelOpen
            ? () => setModulePanelOpen(true)
            : undefined
        }
        permissionDenied={
          liveQueueStatus === "error" && liveQueueError === "permission_missing"
        }
        queueEmpty={queueEmpty}
        readError={liveQueueStatus === "error"}
        refreshing={refreshAction?.isRefreshing ?? false}
        selectedDate={selectedDate}
        onRefresh={refreshAction?.onRefresh}
      />
    );
  }

  const currentBundle = effectiveBundle;
  const navigateToDispensing = () => {
    const href = buildWorkspaceSurfaceRoute({
      moduleId: "dispensing",
      params: { encounterId: currentBundle.encounter.id },
      search: searchParams,
      workspaceId,
    });

    onNavigateWorkspaceSurface?.(href, "dispensing");
  };
  const navigateToBilling = (invoiceId: string) => {
    const href = buildWorkspaceSurfaceRoute({
      moduleId: "billing",
      params: {
        encounterId: currentBundle.encounter.id,
        invoiceId,
      },
      removeParams: ["orderId", "taskId", "historyEncounterId"],
      search: searchParams,
      workspaceId,
    });
    onNavigateWorkspaceSurface?.(href, "billing");
  };
  const consultationCallRooms = getConsultationCallRooms();
  const selectedCallRoom = consultationCallRooms.find(
    (room) => room.id === selectedCallRoomId,
  );
  const chartCompletionStatusText = getConsultationWorkflowStatusText(
    currentBundle.encounter,
    effectiveQueueEntry,
  );
  const canCompleteCurrentChart = canCompleteChartFromWorkflow(
    currentBundle.encounter,
    effectiveQueueEntry,
  );
  const primaryAction =
    !isHistoricalView &&
    currentBundle.encounter.status === "waiting" &&
    effectiveQueueEntry?.status === "waiting"
      ? "call"
      : !isHistoricalView && canCompleteCurrentChart
        ? "complete"
        : null;
  const canUseConsultationSecondaryActions =
    !isHistoricalView &&
    (currentBundle.encounter.status === "in_consultation" ||
      effectiveQueueEntry?.status === "in_progress" ||
      effectiveQueueEntry?.status === "called");
  const hasChartWorkContent =
    hasSavedSoapContent(effectiveLatestSoap) ||
    diagnosisRows.length > 0 ||
    allOrders.length > 0;
  const primaryActionBusy =
    chartWriteDisabled ||
    consultationFlowState.status === "saving" ||
    chartCompletionState.status === "saving" ||
    encounterCancelState.status === "saving";
  const chartStartLocked =
    !isHistoricalView &&
    currentBundle.encounter.status === "waiting" &&
    effectiveQueueEntry?.status === "waiting";
  const callDialogTitle = `${currentBundle.patient.name}/${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}을 호출하시겠습니까?`;
  const diagnosisSaveStatusText = diagnosisLoading
    ? "불러오는 중"
    : diagnosisPersistenceState.encounterId === activeEncounterId
      ? diagnosisPersistenceState.status === "saving"
        ? "저장 중"
        : diagnosisPersistenceState.status === "saved"
          ? "저장됨"
          : diagnosisPersistenceState.status === "error"
            ? "저장 실패"
            : "저장 대기"
      : "저장 대기";

  const chartCheckedInAt =
    currentBundle.encounter.checkedInAt ?? currentBundle.encounter.createdAt;
  const chartDate = getShortDateTime(chartCheckedInAt).split(" ")[0] ?? "-";
  const chartStartTime = getShortClockTime(chartCheckedInAt);
  const liveHistoryRows =
    !allowMockFallback &&
    chartHistoryScopeMatches &&
    chartHistoryStatus === "ready"
      ? scopedChartHistoryRecords
      : undefined;
  const chartHistoryRows = getChartHistoryRowsForBundle(
    currentBundle,
    liveHistoryRows,
  );
  const chartHistoryCount =
    chartHistoryScopeMatches && chartHistoryStatus === "ready"
      ? chartHistoryTotalCount
      : chartHistoryRows.length;
  const visibleHistoryStatus = allowMockFallback
    ? ("ready" as const)
    : chartHistoryScopeMatches
      ? chartHistoryStatus
      : ("loading" as const);
  const effectiveSelectedEncounterId =
    historyViewEncounterId || selectedEncounterId;
  const handleSelectHistoryEncounter = (encounterId: string) => {
    selectHistoryEncounter(
      encounterId === selectedEncounterId ? "" : encounterId,
    );
  };

  return (
    <div
      data-slot="chart-content"
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
    >
      {!chartStartLocked ? (
        <>
          <ChartActionBar
            chartDate={chartDate}
            doctorName={getChartBundleVeterinarianName(currentBundle)}
            encounterNo={currentBundle.encounter.encounterNo}
            historyAction={
              <span className="inline-flex [&_button]:size-6">
                <EmrInstructionHistoryToggle
                  ariaLabelPrefix="차트 이력"
                  controls="chart-content-aside"
                  expanded={contentAsideOpen}
                  tooltipLabel="과거 이력 보기"
                  onClick={() => setContentAsideOpen(!contentAsideOpen)}
                />
              </span>
            }
            startTime={chartStartTime}
            visitLabel={chartHistoryCount > 1 ? "재진" : "초진"}
            pendingIndicator={
              isHistoricalView ? (
                <Badge
                  variant="outline"
                  className="h-7 rounded-lg px-2 emr-text-metadata"
                  data-testid="chart-historical-readonly-badge"
                >
                  과거 차트 · 읽기 전용
                </Badge>
              ) : showDetailPendingIndicator ? (
                <ChartDetailPendingIndicator />
              ) : null
            }
            completionAction={
              primaryAction === "call" ? (
                <Button
                  size="xs"
                  disabled={primaryActionBusy}
                  onClick={handleOpenCallDialog}
                >
                  호출하기
                </Button>
              ) : primaryAction === "complete" ? (
                <ButtonGroup aria-label="진료 완료 보조 액션">
                  <ButtonGroupPrimaryButton
                    aria-label="진료 완료"
                    className="h-7 rounded-l-lg px-3 text-xs"
                    disabled={primaryActionBusy}
                    onClick={() => setChartCompleteDialogOpen(true)}
                  >
                    차트 작성 완료
                  </ButtonGroupPrimaryButton>
                  {canUseConsultationSecondaryActions ? (
                    <>
                      <ButtonGroupDivider />
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <ButtonGroupIconButton
                              aria-label="진료 보조 액션 열기"
                              className="h-7 w-7 rounded-r-lg"
                              disabled={primaryActionBusy}
                            />
                          }
                        >
                          <CdsNavigationChevronDownIcon aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => {
                              if (hasChartWorkContent) {
                                setReturnToWaitingDialogOpen(true);
                                return;
                              }
                              void handleConsultationFlowMutation(
                                "return_to_waiting",
                              );
                            }}
                          >
                            대기로 변경
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-[var(--emr-status-danger-text)]"
                            onClick={() => {
                              setCancelEncounterReason("");
                              setEncounterCancelState({ status: "idle" });
                              setCancelEncounterDialogOpen(true);
                            }}
                          >
                            진료 취소
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : null}
                </ButtonGroup>
              ) : null
            }
          />
          <span className="sr-only" data-testid="chart-completion-status">
            {chartCompletionStatusText}
          </span>
          <span className="sr-only" data-testid="chart-soap-status">
            {getSoapStatusText(effectiveLatestSoap)}
          </span>
        </>
      ) : null}
      <Dialog
        open={callDialogOpen}
        onOpenChange={(open) => {
          setCallDialogOpen(open);
          if (!open) {
            setSelectedCallRoomId("");
            setSaveCallRoomPreference(false);
          }
        }}
      >
        <EmrDialogShell
          variant="confirm"
          title={callDialogTitle}
          description="진료실을 선택해 환자를 호출하면 즉시 진료가 시작됩니다."
          primaryAction={
            <Button
              size="sm"
              disabled={
                consultationFlowState.status === "saving" ||
                detailHydrationPending ||
                !selectedCallRoomId
              }
              onClick={() => void handleConsultationFlowMutation("call")}
            >
              {consultationFlowState.status === "saving" &&
              consultationFlowState.action === "call"
                ? "호출 중"
                : "호출하기"}
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              disabled={consultationFlowState.status === "saving"}
              onClick={() => setCallDialogOpen(false)}
            >
              취소
            </Button>
          }
        >
          <div className="grid gap-2 emr-text-dense text-foreground">
            <ChartPreflightField
              icon={<UsersIcon aria-hidden="true" />}
              label="환자 / 보호자"
            >
              <ChartReadonlyField
                value={`${currentBundle.patient.name} / ${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}`}
              />
            </ChartPreflightField>
            <ChartPreflightField
              icon={<ClockIcon aria-hidden="true" />}
              label="접수 시각"
            >
              <ChartReadonlyField
                value={getShortDateTime(
                  currentBundle.encounter.checkedInAt ??
                    currentBundle.encounter.createdAt,
                )}
              />
            </ChartPreflightField>
            <ChartPreflightField
              icon={<StethoscopeIcon aria-hidden="true" />}
              label="담당 수의사"
            >
              <ChartReadonlyField
                value={getChartBundleVeterinarianName(currentBundle)}
              />
            </ChartPreflightField>
            <ChartPreflightField
              icon={<BuildingIcon aria-hidden="true" />}
              label="진료실"
            >
              <Select
                value={selectedCallRoomId}
                onValueChange={(value) => {
                  const nextRoomId = value ?? "";
                  setSelectedCallRoomId(nextRoomId);
                  if (
                    preferredCallRoomId &&
                    nextRoomId === preferredCallRoomId
                  ) {
                    setSaveCallRoomPreference(true);
                  }
                }}
                disabled={
                  consultationFlowState.status === "saving" ||
                  detailHydrationPending
                }
              >
                <SelectTrigger
                  aria-label="호출 진료실"
                  className="h-9 w-full bg-card"
                >
                  <span className="flex flex-1 truncate text-left">
                    {selectedCallRoom?.name ?? "진료실 선택"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {consultationCallRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChartPreflightField>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-2 emr-text-metadata sm:gap-x-3 [&>*]:min-w-0">
              <span aria-hidden="true" />
              <label className="flex min-h-7 items-center gap-2 text-[var(--emr-text-secondary)]">
                <EmrTableCheckbox
                  aria-label="이 진료실을 내 기본 진료실로 저장"
                  checked={saveCallRoomPreference}
                  disabled={
                    consultationFlowState.status === "saving" ||
                    detailHydrationPending ||
                    !selectedCallRoomId
                  }
                  onCheckedChange={(checked) =>
                    setSaveCallRoomPreference(Boolean(checked))
                  }
                />
                <span>이 진료실을 내 기본 진료실로 저장</span>
              </label>
            </div>
          </div>
          {consultationFlowState.status === "error" &&
          consultationFlowState.action === "call" ? (
            <EmrInlineAlert
              severity="error"
              title="호출과 진료 시작 상태가 저장되지 않았습니다"
              className="mt-3 emr-text-metadata"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleConsultationFlowMutation("call")}
                >
                  다시 시도
                </Button>
              }
            >
              호출과 진료 시작 상태를 저장하지 못했어요. 잠시 후 다시 시도해
              주세요.
            </EmrInlineAlert>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      <Dialog
        open={returnToWaitingDialogOpen}
        onOpenChange={setReturnToWaitingDialogOpen}
      >
        <EmrDialogShell
          variant="confirm"
          title="대기로 변경할까요?"
          description="작성된 차트, 진단명, 오더가 있어요. 대기로 변경하면 진료 시작 전 상태로 돌아갑니다."
          primaryAction={
            <Button
              size="sm"
              disabled={
                consultationFlowState.status === "saving" ||
                detailHydrationPending
              }
              onClick={() =>
                void handleConsultationFlowMutation("return_to_waiting")
              }
            >
              {consultationFlowState.status === "saving" &&
              consultationFlowState.action === "return_to_waiting"
                ? "변경 중"
                : "대기로 변경"}
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              disabled={consultationFlowState.status === "saving"}
              onClick={() => setReturnToWaitingDialogOpen(false)}
            >
              계속 진료
            </Button>
          }
        >
          <div className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
            <ChartPreflightLine
              label="환자 / 보호자"
              value={`${currentBundle.patient.name} / ${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}`}
            />
            <ChartPreflightLine
              label="차트번호"
              value={currentBundle.encounter.encounterNo}
            />
            <ChartPreflightLine
              label="작성물"
              value={`${hasSavedSoapContent(effectiveLatestSoap) ? "SOAP 있음" : "SOAP 없음"} · 진단 ${diagnosisRows.length}건 · 오더 ${allOrders.length}건`}
            />
          </div>
          {consultationFlowState.status === "error" &&
          consultationFlowState.action === "return_to_waiting" ? (
            <EmrInlineAlert
              severity="error"
              title="대기 상태로 변경하지 못했습니다"
              className="mt-3 emr-text-metadata"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleConsultationFlowMutation("return_to_waiting")
                  }
                >
                  다시 시도
                </Button>
              }
            >
              현재 진료 상태는 화면에 남아 있지만 대기 상태 변경은 저장되지
              않았습니다. 권한 또는 서버 저장 상태를 확인한 뒤 다시 시도해
              주세요.
            </EmrInlineAlert>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      <Dialog
        open={cancelEncounterDialogOpen}
        onOpenChange={(open) => {
          setCancelEncounterDialogOpen(open);
          if (!open) {
            setCancelEncounterReason("");
            setEncounterCancelState({ status: "idle" });
          }
        }}
      >
        <EmrDialogShell
          variant="confirm"
          title="진료 취소"
          description="진료 업무를 종료합니다. 복구하면 다시 대기 상태로 돌아갑니다."
          primaryAction={
            <Button
              size="sm"
              variant="destructive"
              disabled={
                encounterCancelState.status === "saving" ||
                detailHydrationPending ||
                !cancelEncounterReason.trim()
              }
              onClick={() => void handleCancelEncounterConfirm()}
            >
              {encounterCancelState.status === "saving"
                ? "취소 중"
                : "진료 취소"}
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              disabled={encounterCancelState.status === "saving"}
              onClick={() => setCancelEncounterDialogOpen(false)}
            >
              닫기
            </Button>
          }
        >
          <div className="grid gap-2">
            <label
              className="emr-text-metadata font-medium text-foreground"
              htmlFor="chart-encounter-cancel-reason"
            >
              진료 취소 사유
            </label>
            <Textarea
              id="chart-encounter-cancel-reason"
              maxLength={500}
              value={cancelEncounterReason}
              onChange={(event) => {
                setCancelEncounterReason(event.target.value);
                if (encounterCancelState.status === "error") {
                  setEncounterCancelState({ status: "idle" });
                }
              }}
              placeholder="예: 보호자 요청으로 진료를 취소합니다."
            />
          </div>
          {encounterCancelState.status === "error" ? (
            <EmrInlineAlert
              severity="error"
              title="진료 취소가 저장되지 않았습니다"
              className="mt-3 emr-text-metadata"
            >
              {encounterCancelState.message ??
                "진료 취소 상태를 저장하지 못했어요."}
            </EmrInlineAlert>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      <Dialog
        open={chartCompleteDialogOpen}
        onOpenChange={setChartCompleteDialogOpen}
      >
        <EmrDialogShell
          variant="confirm"
          title="진료 완료 확인"
          description="진료 기록, 진단명, 오더를 같은 환자 차트 기준으로 확인하고 진료 완료 상태를 저장해 주세요."
          footerMeta="진료 완료는 local-first/server route 저장 상태만 바꾸며 외부 전송이나 청구 확정은 별도 흐름입니다."
          primaryAction={
            <Button
              size="sm"
              disabled={
                chartCompletionState.status === "saving" ||
                detailHydrationPending
              }
              onClick={() => void handleChartCompletionConfirm()}
            >
              {chartCompletionState.status === "saving"
                ? "저장 중"
                : "진료 완료 저장"}
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              disabled={chartCompletionState.status === "saving"}
              onClick={() => setChartCompleteDialogOpen(false)}
            >
              계속 작성
            </Button>
          }
        >
          <div className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
            <ChartPreflightLine
              label="환자 / 보호자"
              value={`${currentBundle.patient.name} / ${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}`}
            />
            <ChartPreflightLine
              label="차트번호"
              value={currentBundle.encounter.encounterNo}
            />
            <ChartPreflightLine
              label="진단명 / 오더"
              value={`${diagnosisRows.length}건 / ${allOrders.length}건`}
            />
            <ChartPreflightLine
              label="차트 상태"
              value={chartCompletionStatusText}
              emphasis
            />
            <ChartPreflightLine
              label="SOAP 상태"
              value={getSoapStatusText(effectiveLatestSoap)}
            />
          </div>
          {chartCompletionState.status === "error" ? (
            <EmrInlineAlert
              severity="error"
              title="진료 완료가 저장되지 않았습니다"
              className="mt-3 emr-text-metadata"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleChartCompletionConfirm()}
                >
                  진료 완료 다시 시도
                </Button>
              }
              testId="chart-completion-error-alert"
            >
              현재 차트 내용은 화면에 남아 있지만 작성완료 상태는 확정되지
              않았습니다. 권한 또는 서버 저장 상태를 확인한 뒤 다시 시도해
              주세요.
            </EmrInlineAlert>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      {chartStartLocked ? (
        <div className="flex min-h-0 flex-1 flex-col py-3">
          <ChartPreconsultationContextPanel
            key={currentBundle.encounter.id}
            actorHeaders={actorHeaders}
            encounterId={currentBundle.encounter.id}
            onOpenGuardianProfile={openGuardianProfile}
            onOpenPatientProfile={openPatientProfile}
            onRequestCall={handleOpenCallDialog}
            onReturnToQueue={handleReturnToQueue}
            primaryActionBusy={primaryActionBusy}
            workspaceId={activeWorkspaceId ?? workspaceId}
          />
        </div>
      ) : (
        <div
          ref={chartWorkspaceRef}
          data-slot="chart-workspace"
          className={cn(
            "grid min-h-0 flex-1 bg-[var(--emr-surface-workspace)] px-2 pb-2",
            isChartResizing && "select-none",
          )}
          style={{
            gridTemplateRows: orderPanelCollapsed
              ? `minmax(${CHART_TOP_MIN_PX}px, 1fr) 8px 38px`
              : `minmax(${CHART_TOP_MIN_PX}px, ${chartTopPercent}fr) ${CHART_RESIZER_HEIGHT_PX}px minmax(${CHART_ORDER_MIN_PX}px, ${100 - chartTopPercent}fr)`,
          }}
        >
          <ChartCollapsiblePanelGroup collapsedPanels={collapsedClinicalPanels}>
            <ChartCollapsiblePanel
              panelId="soap"
              label="S/O"
              contentId="chart-soap-panel-content"
              onCollapsedChange={(collapsed) =>
                setClinicalPanelCollapsed("soap", collapsed)
              }
            >
              <SoapPanel
                key={`chart-soap-${bundle.encounter.id}`}
                actorHeaders={actorHeaders}
                collapseContentId="chart-soap-panel-content"
                diagnoses={diagnosisRows}
                encounterId={bundle.encounter.id}
                loading={soapLoading}
                onCollapse={() => setClinicalPanelCollapsed("soap", true)}
                onPersistedSoapNote={(soapNote) => {
                  setPersistedSoapState({
                    encounterId: bundle.encounter.id,
                    soapNote,
                    status: "idle",
                  });
                  requestChartHistoryRefresh();
                }}
                soapNote={effectiveLatestSoap}
                writeDisabled={chartWriteDisabled}
                workspaceId={bundle.encounter.workspaceId}
              />
            </ChartCollapsiblePanel>
            <ChartCollapsiblePanel
              panelId="assessment"
              label="Assessment"
              contentId="chart-assessment-panel-content"
              onCollapsedChange={(collapsed) =>
                setClinicalPanelCollapsed("assessment", collapsed)
              }
            >
              <AssessmentPanel
                key={`chart-assessment-${bundle.encounter.id}`}
                classificationCatalog={diagnosisCatalogState.page.catalog}
                classificationCatalogDiseaseGroups={
                  diagnosisCatalogState.page.diseaseGroups
                }
                classificationCatalogError={diagnosisCatalogState.error}
                classificationCatalogNextCursor={
                  diagnosisCatalogState.page.nextCursor
                }
                classificationCatalogStatus={diagnosisCatalogState.status}
                classificationCatalogSystems={
                  diagnosisCatalogState.page.systems
                }
                collapseContentId="chart-assessment-panel-content"
                diagnosisRows={diagnosisRows}
                loading={diagnosisLoading}
                onCollapse={() => setClinicalPanelCollapsed("assessment", true)}
                onDiagnosisRowsChange={handleDiagnosisRowsChange}
                saveStatusText={diagnosisSaveStatusText}
                searchClassificationCatalog={searchDiagnosisCatalogPage}
                setDiagnosisRows={setDiagnosisRows}
                soapNote={effectiveLatestSoap}
                writeDisabled={chartWriteDisabled}
              />
            </ChartCollapsiblePanel>
            <ChartCollapsiblePanel
              panelId="history"
              label="History"
              contentId="chart-history-panel-content"
              onCollapsedChange={(collapsed) =>
                setClinicalPanelCollapsed("history", collapsed)
              }
            >
              <ChartInlineHistoryPanel
                activeEncounterId={
                  activeBundle?.encounter.id ?? currentBundle.encounter.id
                }
                bundle={currentBundle}
                collapseContentId="chart-history-panel-content"
                historyError={chartHistoryError}
                historyRows={chartHistoryRows}
                historyStatus={visibleHistoryStatus}
                onCollapse={() => setClinicalPanelCollapsed("history", true)}
                onRetry={requestChartHistoryRefresh}
                selectedEncounterId={effectiveSelectedEncounterId}
                onSelectEncounter={handleSelectHistoryEncounter}
              />
            </ChartCollapsiblePanel>
          </ChartCollapsiblePanelGroup>
          <button
            type="button"
            role="separator"
            aria-orientation="horizontal"
            aria-label="진료 기록과 처방/오더 영역 높이 조절"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(chartTopPercent)}
            className={cn(
              "group relative flex cursor-row-resize items-center justify-center rounded-md opacity-0 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              orderPanelCollapsed && "pointer-events-none invisible",
              isChartResizing && "bg-[var(--emr-state-hover)]",
            )}
            aria-hidden={orderPanelCollapsed || undefined}
            tabIndex={orderPanelCollapsed ? -1 : 0}
            onKeyDown={handleChartResizeKeyDown}
            onLostPointerCapture={stopChartResize}
            onPointerCancel={stopChartResize}
            onPointerDown={handleChartResizePointerDown}
            onPointerMove={handleChartResizePointerMove}
            onPointerUp={stopChartResize}
          >
            <span className="relative h-1 w-10 rounded-full bg-[var(--clair-color-atomic-neutral-300)] transition-colors group-hover:bg-[var(--emr-state-drag)]" />
          </button>
          <div className="min-h-0 min-w-0">
            <OrderArea
              key={`${authSession?.role ?? "signed-out"}:${authSession?.id ?? "signed-out"}:${bundle.encounter.workspaceId}:${bundle.encounter.id}`}
              actorHeaders={actorHeaders}
              bundle={bundle}
              collapseContentId="chart-order-panel-content"
              collapsed={orderPanelCollapsed}
              loading={orderLoading}
              onCollapsedChange={setOrderPanelCollapsed}
              onNavigateToBilling={navigateToBilling}
              onNavigateToDispensing={navigateToDispensing}
              orderGroups={orderGroups}
              writeDisabled={chartWriteDisabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}
