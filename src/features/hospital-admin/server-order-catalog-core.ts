import { readPersistedOrderDefaults, type PersistedOrderDefaultsSource } from "./persisted-order-defaults";
import { copyOrderTaxonomy, isOrderTaxonomyValid, parseOrderTaxonomyMergeConflict, type OrderTaxonomyFields, type OrderTaxonomyMergeConflict } from "./order-taxonomy";
import {
  parseExecutionSourceBaseline, parseExecutionMergeConflicts, parseExecutionCustomizedFields,
  type ExecutionSourceBaseline, type ExecutionMergeConflicts,
} from "./order-execution-lineage";
import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emitLiveMutationAuditEvent,
  type LiveMutationAuditOptions,
} from "@/features/audit/server-mutation-audit-core";
import type {
  ClinicalOrderDestinationModule,
  ClinicalOrderExecutionMode,
  ClinicalOrderType,
  PermissionId,
  ServiceItemType,
  Species,
} from "@/types/emr-domain";
import {
  isClinicalOrderType,
  resolveClinicalOrderMasterContract,
  type ClinicalOrderFieldSchema,
} from "@/features/chart/order-execution-domain";
import {
  parsePlanOrderAuthority,
  type PlanOrderAuthorityConfig,
} from "@/features/chart/plan-order-authority-domain";

export type OrderCatalogAvailability =
  | "pending_activation"
  | "active"
  | "paused"
  | "inactive";
export type OrderCatalogDestination =
  | "lab"
  | "imaging"
  | "dispensing"
  | "treatment"
  | "billing_only"
  | "chart_only";
export type OrderCatalogSalesUnit =
  | "per_order"
  | "per_each"
  | "per_day"
  | "per_frequency"
  | "per_ml"
  | "per_kg";
export type OrderCatalogPriceBasis =
  | "unit_price"
  | "fixed_order_price"
  | "set_fixed_price"
  | "included_order_sum"
  | "range_price";
export type SystemOrderPresetStatus = "active" | "deprecated" | "hidden";
export type OrderCatalogCustomizationState =
  | "unmodified"
  | "customized"
  | "detached";
export type OrderCatalogPresetMergeStatus =
  | "current"
  | "update_available"
  | "conflict"
  | "deprecated_source"
  | "detached";

export type WorkspaceDispensingReviewStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export type WorkspaceDispensingReview = {
  status: WorkspaceDispensingReviewStatus;
  revision: number;
  authoredByUserId?: string;
  authoredAt?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type ExecutionPresetLineageSnapshot = {
  sourceExecutionPresetId: string;
  sourceExecutionPresetRevision: number;
  sourceExecutionPresetSha256: string;
};

export type OrderCatalogItem = OrderTaxonomyFields & {
  taxonomyMergeConflict?: OrderTaxonomyMergeConflict;
  executionSourceBaseline?: ExecutionSourceBaseline;
  executionMergeConflicts?: ExecutionMergeConflicts;
  id: string;
  workspaceId: string;
  standardOrderId: string;
  sourcePresetVersion: string;
  initialImportedPresetVersion?: string;
  lastAutoMergedPresetVersion?: string;
  customizationState?: OrderCatalogCustomizationState;
  customizedFields?: string[];
  lastCustomizedAt?: string;
  lastCustomizedByUserId?: string;
  presetMergeStatus?: OrderCatalogPresetMergeStatus;
  categoryGroup: ServiceItemType;
  categoryLabel: string;
  tCode?: string;
  tCodeLabel?: string;
  standardOrderName: string;
  inHospitalOrderName: string;
  billingName: string;
  aliases: string[];
  availabilityStatus: OrderCatalogAvailability;
  priceKrw: number | null;
  salesUnit: OrderCatalogSalesUnit;
  targetSpecies: Species[];
  defaultDestinationModule: OrderCatalogDestination;
  defaultTaskRequired: boolean;
  billingReflectionEnabled: boolean;
  careGuide?: string;
  careGuideDeliveryEnabled?: boolean;
  internalInstruction?: string;
  internalInstructionDeliveryEnabled?: boolean;
  taxIncluded: boolean;
  roundingRule: "as_is" | "ceil" | "floor" | "round";
  linkedLabItemIds: string[];
  linkedLabCategoryIds: string[];
  defaultDetailInputs?: Record<string, unknown>;
  defaultDetailInputPolicies?: Record<string, unknown>;
  planOrderAuthority?: PlanOrderAuthorityConfig | null;
  executionPresetLineage?: ExecutionPresetLineageSnapshot;
  medicationMetadata?: MedicationOrderMetadata;
  vaccineMetadata?: VaccineOrderMetadata;
  pricingRule: OrderPricingRule;
  originType?: "clair_master" | "workspace_custom";
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  initialImportedRevision?: number;
  lastAutoMergedRevision?: number;
  classificationPathId?: string;
  /** Joined from this workspace row's exact persisted path, never authoring fixtures. */
  classificationPath?: OrderCatalogClassificationPath;
  /** Mutation committed, but its authoritative catalog readback failed. */
  classificationPathReadFailed?: boolean;
  /** Read provenance only; derived execution contracts are not saved taxonomy. */
  clinicalOrderTypeSource?: "persisted" | "derived";
  catalogRevision?: number;
  sourceProjectionFingerprint?: string;
  dispensingLineage?: DispensingOrderLineageSnapshot;
  clinicalOrderType?: ClinicalOrderType;
  isExternalLab?: boolean;
  destinationModule?: ClinicalOrderDestinationModule | null;
  executionMode?: Exclude<ClinicalOrderExecutionMode, "aggregate">;
  detailSchemaVersion?: number;
  detailFieldSchema?: ClinicalOrderFieldSchema;
  billingEligible?: boolean;
  workspaceDispensingReview?: WorkspaceDispensingReview;
  updatedAt: string;
};

export type SystemOrderPreset = {
  presetId: string;
  presetVersion: string;
  presetStatus: SystemOrderPresetStatus;
  defaultCatalogItemId?: string;
  categoryGroup: ServiceItemType;
  categoryLabel: string;
  tCode?: string;
  tCodeLabel?: string;
  standardOrderName: string;
  defaultInHospitalOrderName: string;
  defaultBillingName: string;
  aliases: string[];
  defaultAvailabilityStatus: OrderCatalogAvailability;
  defaultPriceKrw: number;
  salesUnit: OrderCatalogSalesUnit;
  targetSpecies: Species[];
  defaultDestinationModule: OrderCatalogDestination;
  defaultTaskRequired: boolean;
  billingReflectionEnabled: boolean;
  careGuide?: string;
  careGuideDeliveryEnabled?: boolean;
  internalInstruction?: string;
  internalInstructionDeliveryEnabled?: boolean;
  taxIncluded: boolean;
  roundingRule: "as_is" | "ceil" | "floor" | "round";
  linkedLabItemIds: string[];
  linkedLabCategoryIds: string[];
  defaultDetailInputs?: Record<string, unknown>;
  planOrderAuthority?: PlanOrderAuthorityConfig | null;
  medicationMetadata?: MedicationOrderMetadata;
  vaccineMetadata?: VaccineOrderMetadata;
  pricingRule: OrderPricingRule;
};

export type WorkspaceCatalogPresetMergeResult = {
  items: OrderCatalogItem[];
  createdCount: number;
  updatedCount: number;
  preservedCount: number;
};

export type OrderSet = {
  id: string;
  workspaceId: string;
  sourceSetVersion: string;
  setCategory: string;
  setName: string;
  billingName: string;
  availabilityStatus: OrderCatalogAvailability;
  amountBasis: Extract<
    OrderCatalogPriceBasis,
    "set_fixed_price" | "included_order_sum" | "range_price"
  >;
  setPriceKrw: number;
  rangeBasis?: OrderSetRangeBasis | null;
  taxType?: Exclude<OrderSetTaxType, "derived">;
  priceRanges?: OrderSetRevisionPriceRange[];
  salesUnit: OrderCatalogSalesUnit;
  billingReflectionEnabled: boolean;
  targetSpecies: Species[];
  careGuide?: string;
  internalInstruction?: string;
  includedOrders: OrderSetItem[];
};

export type OrderSetItem = {
  id: string;
  childOrderId: string;
  sortOrder: number;
  defaultSelected: boolean;
  billingReflectionDefault: boolean;
  defaultQuantity: number;
  quantitySource: "fixed_one" | "preset_quantity" | "manual_at_apply";
  unitPriceSnapshotKrw: number;
};

export type OrderSetAmountBasis =
  | "set_fixed_price"
  | "included_order_sum"
  | "range_price";
export type OrderSetRangeBasis = "patient_weight_kg" | "manual_value";
export type OrderSetTaxType = "taxable" | "non_taxable" | "derived";
export type OrderSetRevisionStatus = "valid" | "invalid";
export type OrderSetReviewStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "superseded";

export type OrderSetDefinitionItem = {
  childKind: "atomic" | "order_set";
  childOrderCatalogItemId: string | null;
  childOrderCatalogRevision: number | null;
  childOrderSetId: string | null;
  childSetRevisionId: string | null;
  sortOrder: number;
  defaultSelected: boolean;
  billingReflectionDefault: boolean;
  defaultQuantity: number;
  quantitySource: "fixed_one" | "preset_quantity" | "manual_at_apply";
};

export type OrderSetRevisionPriceRange = {
  id: string;
  sortOrder: number;
  lowerBound: number;
  upperBound: number | null;
  priceKrw: number;
};

export type OrderSetDefinition = {
  setCategory: string | null;
  setName: string;
  billingName: string;
  amountBasis: OrderSetAmountBasis;
  setPriceKrw: number | null;
  rangeBasis: OrderSetRangeBasis | null;
  salesUnit: OrderCatalogSalesUnit;
  billingReflectionEnabled: boolean;
  taxType: OrderSetTaxType;
  targetSpecies: Species[];
  careGuide: string | null;
  internalInstruction: string | null;
  items: OrderSetDefinitionItem[];
  priceRanges: Array<{
    sortOrder: number;
    lowerBound: number;
    upperBound: number | null;
    priceKrw: number;
  }>;
};

export type OrderSetRevisionItem = OrderSetDefinitionItem & {
  id: string;
};

export type OrderSetRevision = {
  id: string;
  workspaceId: string;
  orderSetId: string;
  revisionNo: number;
  validationStatus: OrderSetRevisionStatus;
  validationErrors: unknown[];
  setCategory: string | null;
  setName: string;
  billingName: string;
  amountBasis: OrderSetAmountBasis;
  setPriceKrw: number | null;
  rangeBasis: OrderSetRangeBasis | null;
  salesUnit: OrderCatalogSalesUnit;
  billingReflectionEnabled: boolean;
  taxType: OrderSetTaxType;
  targetSpecies: Species[];
  careGuide: string | null;
  internalInstruction: string | null;
  createdByUserId: string | null;
  createdAt: string;
  items: OrderSetRevisionItem[];
  priceRanges: OrderSetRevisionPriceRange[];
  currentEtag: string;
};

export type OrderSetSummary = {
  orderSetId: string;
  currentRevisionId: string | null;
  currentRevisionNo: number | null;
  availabilityStatus: Exclude<OrderCatalogAvailability, "pending_activation">;
  currentEtag: string | null;
  needsCompositionReview: boolean;
  setName: string;
  billingName: string;
  salesUnit: OrderCatalogSalesUnit;
  targetSpecies: Species[];
  amountBasis: OrderSetAmountBasis;
  setPriceKrw: number | null;
  rangeBasis: OrderSetRangeBasis | null;
  taxType: OrderSetTaxType;
  rangePriceRanges: OrderSetRevisionPriceRange[];
  pendingReviewCount: number;
};

export type OrderSetDetail = OrderSetSummary & {
  workspaceId: string;
  sourceSetVersion: string;
  currentRevision: OrderSetRevision | null;
};

export type OrderSetUpdateReview = {
  id: string;
  workspaceId: string;
  parentOrderSetId: string;
  parentRevisionId: string;
  childOrderSetId: string;
  pinnedChildRevisionId: string;
  availableChildRevisionId: string;
  status: OrderSetReviewStatus;
  resultParentRevisionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
};

export type OrderSetSuccessOutcome = "created" | "applied" | "accepted" | "dismissed";
export type OrderSetFailureOutcome = "rejected" | "conflict" | "obsolete" | "superseded";
export type OrderSetErrorCode =
  | "authentication_required"
  | "workspace_membership_missing"
  | "permission_missing"
  | "order_set_not_found"
  | "order_set_review_not_found"
  | "revision_conflict"
  | "idempotency_conflict"
  | "invalid_order_set_definition"
  | "order_set_member_unavailable"
  | "child_revision_requires_refresh"
  | "order_set_review_obsolete"
  | "if_none_match_required"
  | "if_match_required";
export type OrderSetMutationResult = {
  orderSet: OrderSetDetail | null;
  revision: OrderSetRevision | null;
  review: OrderSetUpdateReview | null;
  current: { revisionId: string; etag: string } | null;
};
export type OrderSetMutationResponse =
  | {
      ok: true;
      outcome: OrderSetSuccessOutcome;
      requestId: string;
      error: null;
      result: OrderSetMutationResult;
    }
  | {
      ok: false;
      outcome: OrderSetFailureOutcome;
      requestId: string;
      error: { code: OrderSetErrorCode; field: string | null; message: string };
      result: null;
    };

function mockOrderSetMutationError(requestId: string): OrderSetMutationResponse {
  return {
    ok: false,
    outcome: "rejected",
    requestId,
    error: {
      code: "invalid_order_set_definition",
      field: null,
      message: "Demo Order Set mutation requires the local B2 RPC path.",
    },
    result: null,
  };
}

export type LabTestCategory = {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
};

export type LabTestItem = {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  resultInputType: "number" | "text" | "select" | "positive_negative" | "grade";
  resultValueKind?: "numeric" | "text" | "coded";
  decimalScale?: number;
  resultUnit?: string;
  sortOrder: number;
  availabilityStatus: OrderCatalogAvailability;
  savedResultUsageCount: number;
  definitionOrigin?: "clair_master" | "workspace_custom" | "legacy" | "quarantined";
  workspaceResultRevision?: number;
  localSettingsRevision?: number;
};

export type WorkspaceLabTestItemMutationInput = {
  action: "local_settings" | "customize";
  itemId: string;
  expectedWorkspaceResultRevision?: number;
  expectedLocalSettingsRevision?: number;
  patch: Record<string, unknown>;
  targetLinkIds?: string[];
};

export type LabDefinitionLinkMutationInput = {
  labTestItemId: string;
  expectedLinkRevision?: number;
  expectedWorkspaceResultRevision?: number;
  effectiveSortOrder: number;
  required: boolean;
  displayGroup?: string | null;
};

export type LabDefinitionMutationInput = {
  availabilityStatus: Extract<OrderCatalogAvailability, "active" | "paused" | "inactive">;
  links: LabDefinitionLinkMutationInput[];
};

export type MedicationOrderMetadata = {
  schemaVersion?: 2;
  presetOrigin?: "clair_master" | "workspace";
  presetStatus?: "synthetic_unreviewed" | "clinically_reviewed";
  sourcePrescriptionPresetId?: string;
  sourcePrescriptionPresetRevision?: number;
  defaultDetailInputs?: Record<string, unknown>;
  autoDispenseQuantityEnabled?: boolean;
  administrationDays?: number;
  dailyFrequencyCode?: string;
  frequencyDailyCount?: number;
  doseBasis?:
    | "kg"
    | "head"
    | "ingredient_amount"
    | "total_amount"
    | "prescribed_quantity";
  doseAmount?: number;
  doseAmountUnit?: string;
  administrationRoute?:
    | "PO"
    | "IV"
    | "CRI"
    | "SC"
    | "IM"
    | "topical"
    | "otic"
    | "ophthalmic"
    | "transdermal"
    | "oromucosal"
    | "inhalation"
    | "nasal"
    | "other";
  dispenseUnit?: string;
  dispenseRoundingRule?:
    | "as_is"
    | "ceil"
    | "floor"
    | "round"
    | "ceil_0_25"
    | "floor_0_25"
    | "ceil_0_5"
    | "floor_0_5";
  medicationInstruction?:
    | "after_meal"
    | "before_meal"
    | "with_meal"
    | "any_time";
  storageMethod?:
    | "room_temp"
    | "room_temp_light_protected"
    | "refrigerated"
    | "refrigerated_light_protected";
  ingredientKoreanName?: string;
  ingredientEnglishName?: string;
};

export type OrderCatalogAdminCapabilities = {
  canManageCatalog: boolean;
  canAuthorDispensing: boolean;
  canApproveDispensing: boolean;
};

export type DispensingOrderLineageSnapshot = {
  schemaVersion: 1 | 2;
  sourceDispensingProfileId: string;
  sourceDispensingProfileRevision: number;
  sourceMedicationProductId: string;
  sourceMedicationProductRevision: number;
  sourceClinicalReviewId: string | null;
  sourceEvidenceFingerprint: string;
  clinicalUseAllowed: boolean;
  serviceReviewOnly?: true;
  serviceReviewReleaseId?: string;
  dispensingProfileSnapshot: Record<string, unknown>;
  dispensingProfileSnapshotSha256: string;
};

export type VaccineOrderMetadata = {
  vaccineTarget: Species[];
  vaccineClassification: "core" | "non_core" | "rabies" | "other";
  doseSequenceEnabled: boolean;
  doseSequenceLabel?: string;
  doseSequenceNumber?: number;
};

export type OrderPricingRule = {
  priceBasis: OrderCatalogPriceBasis;
  priceKrw: number | null;
  salesUnit: OrderCatalogSalesUnit;
  taxIncluded: boolean;
  roundingRule: string;
  billingReflectionEnabled: boolean;
};

export type OrderSetPriceRange = {
  id: string;
  sortOrder: number;
  lowerBound: number;
  upperBound: number | null;
  priceKrw: number;
};

export type ChartOrderSetSearchSnapshot = {
  sourceSetId: string;
  sourceSetRevisionId: string;
  sourceSetRevisionNo: number;
  sourceSetVersion: string;
  amountBasis: OrderSetAmountBasis;
  setPriceKrw: number | null;
  rangeBasis: OrderSetRangeBasis | null;
  taxType: OrderSetTaxType;
  priceRanges: OrderSetPriceRange[];
  billingReflectionEnabled: boolean;
};

export type ChartOrderSetLeafIntent = {
  revisionItemId: string;
  selected: boolean;
  quantity: number;
};

export type ChartOrderSetSelectionIntent =
  | {
      items: ChartOrderSetLeafIntent[];
      rangeInput?: never;
    }
  | {
      items: ChartOrderSetLeafIntent[];
      rangeInput: number;
    };

export type ChartOrderSetPreviewItem = {
  revisionItemId: string;
  itemKind: "atomic";
  path: Array<{ setId: string; revisionId: string; revisionItemId: string }>;
  rootRevisionItemId?: string;
  directRevisionItemId?: string;
  nestedRevisionItemId?: string | null;
  leafRevisionItemId?: string;
  workspaceCatalogItemId: string;
  pinnedCompositionCatalogRevision: number;
  appliedCatalogRevision: number;
  defaultSelected: boolean;
  selected: boolean;
  defaultQuantity: number;
  quantity: number;
  quantitySource: "fixed_one" | "preset_quantity" | "manual_at_apply";
  billingReflectionEnabled: boolean;
  priceKrw: number | null;
  taxType: "taxable" | "non_taxable";
  appliedSnapshot?: Record<string, unknown>;
};

export type ChartOrderSetPreview = {
  schemaVersion: 1;
  operation: "preview" | "draft" | "confirm";
  set: ChartOrderSetSearchSnapshot & {
    displayName?: string;
    billingName?: string;
  };
  items: ChartOrderSetPreviewItem[];
  pricing: {
    selectedSetInput: number | null;
    selectedRangeId: string | null;
    rangeInput: number | null;
    childSubtotalKrw: number;
    explicitExtraSubtotalKrw: number;
    finalTotalKrw: number;
  };
  selectionFingerprint: string;
  calculationInputs?: Record<string, unknown>;
  calculationOutputs?: Record<string, unknown>;
};

export type ChartOrderCatalogSearchRow = {
  rowType: "individual" | "set";
  sourcePresetId: string;
  sourcePresetVersion: string;
  displayName: string;
  billingName: string;
  categoryGroup: ServiceItemType | "set";
  targetSpecies: Species[];
  appliedSnapshot: AppliedOrderSnapshot;
  clinicalOrderType?: ClinicalOrderType;
  destinationModule?: ClinicalOrderDestinationModule | null;
  executionMode?: Exclude<ClinicalOrderExecutionMode, "aggregate">;
  detailSchemaVersion?: number;
  billingEligible?: boolean;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  dispensingLineage?: DispensingOrderLineageSnapshot;
  sourceSetId?: string | null;
  sourceSetRevisionId?: string | null;
  sourceSetRevisionNo?: number | null;
  sourceSetAmountBasis?: OrderSetAmountBasis | null;
  sourceSetPriceKrw?: number | null;
  sourceSetRangeBasis?: OrderSetRangeBasis | null;
  sourceSetTaxType?: OrderSetTaxType | null;
  sourceSetAvailabilityStatus?: "active" | null;
  sourceSetNeedsCompositionReview?: false | null;
  sourceSetValidationStatus?: "valid" | null;
  sourceSetPriceRanges?: OrderSetPriceRange[] | null;
  sourceSetPendingReviewCount?: number | null;
};

export type AppliedOrderSnapshot = OrderTaxonomyFields & {
  executionSourceBaseline?: ExecutionSourceBaseline;
  executionCustomizedFields?: string[];
  workspaceId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  defaultDetailInputsSource?: PersistedOrderDefaultsSource;
  sourcePresetId: string;
  sourcePresetVersion: string;
  workspaceCatalogItemId?: string;
  appliedStandardOrderName?: string;
  appliedDisplayName: string;
  appliedBillingName: string;
  appliedPriceKrw: number | null;
  appliedSalesUnit: OrderCatalogSalesUnit;
  appliedTaxIncluded: boolean;
  appliedAmountBasis: OrderCatalogPriceBasis;
  appliedTargetSpecies?: Species[];
  appliedCareGuide?: string;
  appliedInternalInstruction?: string;
  appliedDestinationModule?: OrderCatalogDestination;
  appliedTaskRequired?: boolean;
  billingReflectionEnabled: boolean;
  clinicalOrderType?: ClinicalOrderType;
  destinationModule?: ClinicalOrderDestinationModule | null;
  executionMode?: Exclude<ClinicalOrderExecutionMode, "aggregate">;
  detailSchemaVersion?: number;
  billingEligible?: boolean;
  defaultDetailInputs?: Record<string, unknown>;
  defaultDetailInputPolicies?: Record<string, unknown>;
  planOrderAuthority?: PlanOrderAuthorityConfig | null;
  executionPresetLineage?: ExecutionPresetLineageSnapshot;
  medicationMetadata?: MedicationOrderMetadata;
  dispensingLineage?: DispensingOrderLineageSnapshot;
  workspaceDispensingReview?: WorkspaceDispensingReview;
};

export type ExpandedOrderSetRow = {
  parentSetId: string;
  setItemId: string;
  childOrderId: string;
  sortOrder: number;
  quantity: number;
  billingReflectionEnabled: boolean;
  appliedSnapshot: AppliedOrderSnapshot;
};

export type ChartOrderSetPreviewGatewayResult =
  | { ok: true; preview: ChartOrderSetPreview }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 409 | 422 | 500;
      error: string;
    };

export type LabTestItemDeleteLock = {
  deleteLocked: boolean;
  linkedOrderCount: number;
  savedResultUsageCount: number;
  lockReason?: "linked_order" | "saved_result";
};

export type OrderCatalogMutationInput =
  | {
      action: "create";
      item: Omit<OrderCatalogItem, "id" | "updatedAt"> & { id?: string };
    }
  | {
      action: "update";
      itemId: string;
      expectedCatalogRevision: number;
      patch: Partial<OrderCatalogItem> & {
        labDefinition?: LabDefinitionMutationInput;
        resetTaxonomyFields?: Array<"adminSubcategoryCode" | "labFamilyCode">;
        resetExecutionFields?: string[];
        keepExecutionFields?: string[];
      };
    }
  | {
      action: "review";
      decision: "approve" | "reject";
      itemId: string;
      expectedCatalogRevision: number;
      note?: string;
    }
  | { action: "pause"; itemId: string; expectedCatalogRevision: number };

export type OrderCatalogReadFailure = {
  ok: false;
  status: 401 | 403 | 409 | 500 | 503;
  error:
    | "catalog_auth_required"
    | "catalog_permission_denied"
    | "catalog_revision_conflict"
    | "catalog_read_failed"
    | "catalog_response_invalid"
    | "catalog_gateway_required";
};

export type OrderCatalogGateway = {
  listAdminCatalog(input: {
    workspaceId: string;
  }): Promise<
    { ok: true; items: OrderCatalogItem[] } | OrderCatalogReadFailure
  >;
  listChartSearch(input: {
    workspaceId: string;
  }): Promise<
    { ok: true; rows: ChartOrderCatalogSearchRow[] } | OrderCatalogReadFailure
  >;
  mutateOrder(input: {
    actorUserId: string;
    mutation: OrderCatalogMutationInput;
    workspaceId: string;
  }): Promise<
    | {
        ok: true;
        item: OrderCatalogItem;
        databaseAuditWritten?: true;
      }
    | { ok: false; status: 400; error: "invalid_input" }
    | { ok: false; status: 409; error: "catalog_revision_conflict" }
    | { ok: false; status: 500; error: "db_write_failed" }
    | { ok: false; status: 404; denialReason: "order_not_found" }
  >;
  mutateLabTestItem(input: {
    actorUserId: string;
    input: WorkspaceLabTestItemMutationInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; item: LabTestItem; affectedCatalogItemIds: string[] }
    | { ok: false; status: 400; error: "invalid_input" }
    | { ok: false; status: 403; denialReason: "permission_missing" | "actor_mismatch" }
    | { ok: false; status: 404; denialReason: "lab_test_item_not_found" }
    | { ok: false; status: 409; error: "lab_item_revision_conflict" | "lab_item_local_settings_revision_conflict" }
    | { ok: false; status: 500; error: "db_write_failed" }
  >;
  expandOrderSet(input: { orderSetId: string; workspaceId: string }): Promise<
    | {
        ok: true;
        parentSnapshot: AppliedOrderSnapshot;
        rows: ExpandedOrderSetRow[];
      }
    | { ok: false; status: 404; denialReason: "order_set_not_found" }
  >;
  previewOrderSet?(input: {
    encounterId: string;
    orderSetId: string;
    revisionId: string;
    selectionIntent: ChartOrderSetSelectionIntent;
    workspaceId: string;
  }): Promise<ChartOrderSetPreviewGatewayResult>;
  listOrderSets(input: { workspaceId: string; query?: string }): Promise<
    | { ok: true; summaries: OrderSetSummary[] }
    | { ok: false; status: number; error: OrderSetErrorCode }
  >;
  getOrderSet(input: { orderSetId: string; workspaceId: string }): Promise<
    | { ok: true; detail: OrderSetDetail; history: OrderSetRevision[]; reviews: OrderSetUpdateReview[] }
    | { ok: false; status: number; error: OrderSetErrorCode }
  >;
  createOrderSet(input: {
    availabilityStatus: Exclude<OrderCatalogAvailability, "pending_activation">;
    definition: OrderSetDefinition;
    requestId: string;
    workspaceId: string;
  }): Promise<OrderSetMutationResponse>;
  saveOrderSetRevision(input: {
    availabilityStatus: Exclude<OrderCatalogAvailability, "pending_activation">;
    definition: OrderSetDefinition;
    expectedCurrentRevisionId: string;
    orderSetId: string;
    requestId: string;
    workspaceId: string;
  }): Promise<OrderSetMutationResponse>;
  resolveOrderSetUpdateReview(input: {
    action: "accept" | "dismiss";
    expectedParentRevisionId: string;
    requestId: string;
    reviewId: string;
    workspaceId: string;
  }): Promise<OrderSetMutationResponse>;
  getLabTestItemDeleteLock(input: {
    testItemId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; lock: LabTestItemDeleteLock }
    | { ok: false; status: 404; denialReason: "lab_test_item_not_found" }
  >;
};

export type SupabaseOrderCatalogRpcClient = {
  rpc(
    functionName:
      | "clair_list_order_catalog_chart_search"
      | "clair_list_order_catalog_chart_search_v2"
      | "clair_list_order_catalog_admin_v2"
      | "clair_preview_chart_order_set"
      | "clair_update_order_catalog_item"
      | "clair_create_order_catalog_item"
      | "clair_create_workspace_dispensing_order"
      | "clair_review_workspace_dispensing_order"
      | "clair_update_workspace_lab_test_item"
      | "clair_list_order_sets"
      | "clair_get_order_set"
      | "clair_create_order_set"
      | "clair_save_order_set_revision"
      | "clair_resolve_order_set_update_review",
    args:
      | { p_workspace_id: string }
      | {
          workspace_id: string;
          encounter_id: string;
          set_id: string;
          revision_id: string;
          selection_intent: ChartOrderSetSelectionIntent;
        }
      | {
          p_expected_catalog_revision: number;
          p_item_id: string;
          p_patch: Record<string, unknown>;
          p_workspace_id: string;
        }
      | {
          p_action: string;
          p_actor_user_id: string;
          p_expected_local_settings_revision: number | null;
          p_expected_workspace_result_revision: number | null;
          p_item_id: string;
          p_patch: Record<string, unknown>;
          p_target_link_ids: string[];
          p_workspace_id: string;
        }
      | { p_item: Record<string, unknown>; p_workspace_id: string }
      | {
          p_action: "approve" | "reject";
          p_expected_catalog_revision: number;
          p_item_id: string;
          p_note: string | null;
          p_workspace_id: string;
        }
      | { p_query: string | null; p_workspace_id: string }
      | { p_order_set_id: string; p_workspace_id: string }
      | {
          p_availability_status: string;
          p_definition: Record<string, unknown>;
          p_request_id: string;
          p_workspace_id: string;
        }
      | {
          p_availability_status: string;
          p_definition: Record<string, unknown>;
          p_expected_current_revision_id: string;
          p_order_set_id: string;
          p_request_id: string;
          p_workspace_id: string;
        }
      | {
          p_action: string;
          p_expected_parent_revision_id: string;
          p_request_id: string;
          p_review_id: string;
          p_workspace_id: string;
        },
  ): Promise<{
    data: unknown;
    error: { message?: string; code?: string } | null;
  }>;
  from?: (
    table: "order_catalog_items",
  ) => SupabaseOrderCatalogItemsQueryBuilder;
};

export type OrderCatalogResult<T> =
  | ({ ok: true; status: 200; enforcedBy: string } & T)
  | OrderCatalogReadFailure
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 409; error: "catalog_revision_conflict" }
  | { ok: false; status: 409; error: string }
  | { ok: false; status: 422; error: string }
  | { ok: false; status: 500; error: "db_write_failed" }
  | {
      ok: false;
      status: 404;
      denialReason:
        "order_not_found" | "order_set_not_found" | "lab_test_item_not_found";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export async function listOrderCatalogForAdmin({
  actorUserId,
  gateway,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<
  OrderCatalogResult<{
    items: OrderCatalogItem[];
    capabilities: OrderCatalogAdminCapabilities;
  }>
> {
  if (!gateway || !permissionAdapter)
    return { ok: false, status: 503, error: "catalog_gateway_required" };
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:view",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.listAdminCatalog({ workspaceId });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    items: result.items,
    capabilities: resolveOrderCatalogAdminCapabilities(
      permissionAdapter,
      actorUserId,
      workspaceId,
    ),
    enforcedBy: "order-catalog-admin-read",
  };
}

export async function searchOrderCatalogForChart({
  actorUserId,
  gateway,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ rows: ChartOrderCatalogSearchRow[] }>> {
  if (!gateway || !permissionAdapter)
    return { ok: false, status: 503, error: "catalog_gateway_required" };
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:view",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.listChartSearch({ workspaceId });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    rows: result.rows,
    enforcedBy: "order-catalog-chart-search",
  };
}

export async function mutateOrderCatalogItem({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway,
  input,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: OrderCatalogGateway;
  input: OrderCatalogMutationInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ item: OrderCatalogItem }>> {
  if (!gateway || !permissionAdapter)
    return { ok: false, status: 503, error: "catalog_gateway_required" };
  if (!isValidOrderCatalogMutationInput(input)) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  const viewPermission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:view",
  );
  if (!viewPermission.allowed) return viewPermission.denied;
  const beforeRead = await readCatalogItemBeforeMutation({
    gateway,
    input,
    workspaceId,
  });
  if (!beforeRead.ok) return beforeRead;
  const beforeItem = beforeRead.item;
  const capabilities = resolveOrderCatalogAdminCapabilities(
    permissionAdapter,
    actorUserId,
    workspaceId,
  );
  const dispensingMutation = isDispensingCatalogMutation(input, beforeItem);
  const allowed =
    input.action === "review"
      ? capabilities.canApproveDispensing &&
        beforeItem?.originType === "workspace_custom"
      : input.action === "update" && (input.patch.resetExecutionFields || input.patch.keepExecutionFields)
        ? capabilities.canManageCatalog
      : dispensingMutation
        ? capabilities.canAuthorDispensing
        : capabilities.canManageCatalog;
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      denialReason: "permission_missing",
    };
  }
  if (input.action === "update" && beforeItem &&
      (Object.hasOwn(input.patch, "adminSubcategoryCode") || Object.hasOwn(input.patch, "labFamilyCode")) &&
      !input.patch.resetTaxonomyFields?.length &&
      !isOrderTaxonomyValid(beforeItem.clinicalOrderType,
        Object.hasOwn(input.patch, "adminSubcategoryCode") ? input.patch.adminSubcategoryCode : beforeItem.adminSubcategoryCode ?? null,
        Object.hasOwn(input.patch, "labFamilyCode") ? input.patch.labFamilyCode : beforeItem.labFamilyCode ?? null)) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  const result = await gateway.mutateOrder({
    actorUserId: actorUserId ?? "",
    mutation: input,
    workspaceId,
  });
  if (!result.ok) return result;
  if (!result.databaseAuditWritten) {
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType: orderCatalogAuditEventType(input),
        targetType: "order_catalog_item",
        targetId: result.item.id,
        requestId: auditRequestId,
        before: beforeItem ? summarizeCatalogAuditItem(beforeItem) : {},
        after: summarizeCatalogAuditItem(result.item),
        metadata: {
          action: input.action,
          changedFields: orderCatalogChangedFields(input),
          source: "order-catalog-admin-mutation",
        },
      },
    });
    if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };
  }
  return {
    ok: true,
    status: 200,
    item: result.item,
    enforcedBy: "order-catalog-admin-mutation",
  };
}

export type WorkspaceLabTestItemMutationResult =
  | {
      ok: true;
      status: 200;
      item: LabTestItem;
      affectedCatalogItemIds: string[];
      enforcedBy: "workspace-lab-test-item-mutation";
    }
  | { ok: false; status: 400; error: "invalid_input" }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 403; denialReason: "actor_mismatch" }
  | { ok: false; status: 404; denialReason: "lab_test_item_not_found" }
  | {
      ok: false;
      status: 409;
      error:
        | "lab_item_revision_conflict"
        | "lab_item_local_settings_revision_conflict";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export async function mutateWorkspaceLabTestItem({
  actorUserId,
  gateway,
  input,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  input: WorkspaceLabTestItemMutationInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<WorkspaceLabTestItemMutationResult | OrderCatalogReadFailure> {
  if (!gateway || !permissionAdapter)
    return { ok: false, status: 503, error: "catalog_gateway_required" };
  if (!isValidWorkspaceLabTestItemMutationInput(input)) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:manage",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.mutateLabTestItem({
    actorUserId: actorUserId ?? "",
    input,
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 403) {
      return {
        ok: false,
        status: 403,
        denialReason: result.denialReason,
      };
    }
    if (result.status === 404) {
      return { ok: false, status: 404, denialReason: result.denialReason };
    }
    if (result.status === 409) {
      return { ok: false, status: 409, error: result.error };
    }
    if (result.status === 400) {
      return { ok: false, status: 400, error: "invalid_input" };
    }
    return { ok: false, status: 500, error: "db_write_failed" };
  }
  return {
    ok: true,
    status: 200,
    item: result.item,
    affectedCatalogItemIds: result.affectedCatalogItemIds,
    enforcedBy: "workspace-lab-test-item-mutation",
  };
}

function isValidOrderCatalogMutationInput(
  input: OrderCatalogMutationInput,
): input is OrderCatalogMutationInput {
  if (!isRecord(input)) return false;
  const validRevision = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value > 0;
  if (input.action === "create") return isRecord(input.item) &&
    isOrderTaxonomyValid(input.item.clinicalOrderType, input.item.adminSubcategoryCode, input.item.labFamilyCode);
  if (input.action === "update") {
    if (isRecord(input.patch)) {
      const resolutions = [input.patch.resetExecutionFields, input.patch.keepExecutionFields];
      for (const fields of resolutions) {
        if (fields !== undefined && (!Array.isArray(fields) || fields.length === 0 || fields.length > 100 ||
          fields.some(field => typeof field !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(field)) ||
          new Set(fields).size !== fields.length)) return false;
      }
      if (resolutions[0]?.some(field => resolutions[1]?.includes(field))) return false;
    }
    return typeof input.itemId === "string" && input.itemId.trim().length > 0
      && validRevision(input.expectedCatalogRevision)
      && isRecord(input.patch);
  }
  if (input.action === "review") {
    return typeof input.itemId === "string" && input.itemId.trim().length > 0
      && validRevision(input.expectedCatalogRevision)
      && (input.decision === "approve" || input.decision === "reject")
      && (input.note === undefined || typeof input.note === "string");
  }
  return input.action === "pause"
    && typeof input.itemId === "string"
    && input.itemId.trim().length > 0
    && validRevision(input.expectedCatalogRevision);
}

function isValidWorkspaceLabTestItemMutationInput(
  input: WorkspaceLabTestItemMutationInput,
): input is WorkspaceLabTestItemMutationInput {
  if (!isRecord(input) || (input.action !== "local_settings" && input.action !== "customize")) {
    return false;
  }
  if (typeof input.itemId !== "string" || !input.itemId.trim() || !isRecord(input.patch)) {
    return false;
  }
  const revision = (value: unknown) =>
    value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 0);
  if (!revision(input.expectedWorkspaceResultRevision) || !revision(input.expectedLocalSettingsRevision)) {
    return false;
  }
  return (
    input.targetLinkIds === undefined ||
    (Array.isArray(input.targetLinkIds) &&
      input.targetLinkIds.every((id) => typeof id === "string" && id.trim()))
  );
}

export async function expandOrderSetForChart({
  actorUserId,
  gateway,
  encounterId,
  orderSetId,
  permissionAdapter,
  revisionId,
  selectionIntent,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  encounterId?: string;
  orderSetId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  revisionId?: string;
  selectionIntent?: ChartOrderSetSelectionIntent;
  workspaceId: string;
}): Promise<
  OrderCatalogResult<{
    parentSnapshot: AppliedOrderSnapshot;
    rows: ExpandedOrderSetRow[];
    preview?: ChartOrderSetPreview;
  }>
> {
  if (!gateway || !permissionAdapter)
    return { ok: false, status: 503, error: "catalog_gateway_required" };
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    encounterId && revisionId ? "chart:update" : "service_catalog:view",
  );
  if (!permission.allowed) return permission.denied;
  if (encounterId && revisionId && selectionIntent && gateway.previewOrderSet) {
    const preview = await gateway.previewOrderSet({
      encounterId,
      orderSetId,
      revisionId,
      selectionIntent,
      workspaceId,
    });
    if (!preview.ok) {
      if (preview.status === 401) {
        return { ok: false, status: 401, denialReason: "unauthenticated" };
      }
      if (preview.status === 403) {
        return {
          ok: false,
          status: 403,
          denialReason: preview.error === "workspace_membership_missing"
            ? "workspace_membership_missing"
            : "permission_missing",
        };
      }
      return {
        ok: false,
        status: preview.status,
        error: preview.error,
      } as OrderCatalogResult<{
        parentSnapshot: AppliedOrderSnapshot;
        rows: ExpandedOrderSetRow[];
        preview?: ChartOrderSetPreview;
      }>;
    }
    return {
      ok: true,
      status: 200,
      preview: preview.preview,
      parentSnapshot: previewToParentSnapshot(preview.preview),
      rows: preview.preview.items.map((item, index) =>
        previewItemToExpandedRow(preview.preview, item, index),
      ),
      enforcedBy: "order-set-expansion-preview",
    };
  }
  const result = await gateway.expandOrderSet({ orderSetId, workspaceId });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    parentSnapshot: result.parentSnapshot,
    rows: result.rows,
    enforcedBy: "order-set-expansion",
  };
}

function previewToParentSnapshot(preview: ChartOrderSetPreview): AppliedOrderSnapshot {
  return {
    sourcePresetId: preview.set.sourceSetId,
    sourcePresetVersion: preview.set.sourceSetVersion,
    appliedDisplayName: preview.set.displayName ?? preview.set.sourceSetId,
    appliedBillingName: preview.set.billingName ?? preview.set.sourceSetId,
    appliedPriceKrw: preview.set.setPriceKrw,
    appliedSalesUnit: "per_each",
    appliedTaxIncluded: preview.set.taxType === "taxable",
    appliedAmountBasis: preview.set.amountBasis,
    billingReflectionEnabled: preview.set.billingReflectionEnabled,
  };
}

function previewItemToExpandedRow(
  preview: ChartOrderSetPreview,
  item: ChartOrderSetPreviewItem,
  sortOrder: number,
): ExpandedOrderSetRow {
  const snapshot = item.appliedSnapshot ?? {
    sourcePresetId: item.workspaceCatalogItemId,
    sourcePresetVersion: preview.set.sourceSetVersion,
    workspaceCatalogItemId: item.workspaceCatalogItemId,
    appliedDisplayName: item.workspaceCatalogItemId,
    appliedBillingName: item.workspaceCatalogItemId,
    appliedPriceKrw: item.priceKrw,
    appliedSalesUnit: "per_each",
    appliedTaxIncluded: item.taxType === "taxable",
    appliedAmountBasis: "unit_price",
    billingReflectionEnabled: item.billingReflectionEnabled,
  } as AppliedOrderSnapshot;
  return {
    parentSetId: preview.set.sourceSetId,
    setItemId: item.revisionItemId,
    childOrderId: item.workspaceCatalogItemId,
    sortOrder: sortOrder + 1,
    quantity: item.quantity,
    billingReflectionEnabled: item.billingReflectionEnabled,
    appliedSnapshot: snapshot as AppliedOrderSnapshot,
  };
}

export async function readLabTestItemDeleteLock({
  actorUserId,
  gateway,
  permissionAdapter,
  testItemId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  testItemId: string;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ lock: LabTestItemDeleteLock }>> {
  if (!gateway || !permissionAdapter)
    return { ok: false, status: 503, error: "catalog_gateway_required" };
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:manage",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.getLabTestItemDeleteLock({
    testItemId,
    workspaceId,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    lock: result.lock,
    enforcedBy: "lab-test-item-delete-lock",
  };
}

export function createOrderPricingSnapshot(
  item: OrderCatalogItem,
): AppliedOrderSnapshot {
  if (item.billingReflectionEnabled && item.pricingRule.priceKrw === null) {
    throw new Error("active_billable_order_requires_price");
  }
  const appliedPriceKrw = item.pricingRule.priceKrw ?? item.priceKrw ?? null;
  const executionContract = resolveClinicalOrderMasterContract({
    billingEligible: item.billingEligible,
    billingReflectionEnabled: item.billingReflectionEnabled,
    categoryGroup: item.categoryGroup,
    clinicalOrderType: item.clinicalOrderType,
    defaultDestinationModule: item.defaultDestinationModule,
    defaultTaskRequired: item.defaultTaskRequired,
    destinationModule: item.destinationModule,
    detailFieldSchema: item.detailFieldSchema,
    detailSchemaVersion: item.detailSchemaVersion,
    executionMode: item.executionMode,
    isExternalLab: item.isExternalLab,
  });
  const planOrderAuthority = resolvePlanOrderAuthority(item);
  return {
    ...copyOrderTaxonomy(item),
    executionSourceBaseline: item.executionSourceBaseline ? structuredClone(item.executionSourceBaseline) : undefined,
    executionCustomizedFields: item.customizedFields?.filter(field =>
      field.startsWith("defaultDetailInputs.") || ["*", "defaultDetailInputs", "default_detail_inputs"].includes(field)),
    workspaceId: item.workspaceId,
    sourceMasterRecordId: item.sourceMasterRecordId,
    sourceMasterRevision: item.sourceMasterRevision,
    workspaceCatalogRevision: item.catalogRevision,
    sourcePresetId: item.standardOrderId,
    sourcePresetVersion: item.sourcePresetVersion,
    workspaceCatalogItemId: item.id,
    appliedStandardOrderName: item.standardOrderName,
    appliedDisplayName: item.inHospitalOrderName,
    appliedBillingName: item.billingName,
    appliedPriceKrw,
    appliedSalesUnit: item.pricingRule.salesUnit,
    appliedTaxIncluded: item.pricingRule.taxIncluded,
    appliedAmountBasis: item.pricingRule.priceBasis,
    appliedTargetSpecies: [...item.targetSpecies],
    appliedCareGuide: item.careGuide,
    appliedInternalInstruction: item.internalInstruction,
    appliedDestinationModule: item.defaultDestinationModule,
    appliedTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.pricingRule.billingReflectionEnabled,
    clinicalOrderType: executionContract.clinicalOrderType,
    destinationModule: executionContract.destinationModule,
    executionMode: executionContract.executionMode,
    detailSchemaVersion: executionContract.detailSchemaVersion,
    billingEligible: executionContract.billingEligible,
    defaultDetailInputs: resolveDefaultDetailInputs(item),
    defaultDetailInputsSource: readPersistedOrderDefaults(item).source,
    defaultDetailInputPolicies: item.defaultDetailInputPolicies
      ? structuredClone(item.defaultDetailInputPolicies)
      : undefined,
    planOrderAuthority: planOrderAuthority
      ? structuredClone(planOrderAuthority)
      : null,
    executionPresetLineage: item.executionPresetLineage
      ? { ...item.executionPresetLineage }
      : undefined,
    medicationMetadata: item.medicationMetadata
      ? structuredClone(item.medicationMetadata)
      : undefined,
    dispensingLineage: item.dispensingLineage
      ? structuredClone(item.dispensingLineage)
      : undefined,
    workspaceDispensingReview: item.workspaceDispensingReview
      ? { ...item.workspaceDispensingReview }
      : undefined,
  };
}

export function createWorkspaceOrderCatalogItemFromPreset({
  createId = createCatalogItemId,
  now,
  preset,
  workspaceId,
}: {
  createId?: (input: {
    preset: SystemOrderPreset;
    workspaceId: string;
  }) => string;
  now: string;
  preset: SystemOrderPreset;
  workspaceId: string;
}): OrderCatalogItem {
  return {
    id: createId({ preset, workspaceId }),
    workspaceId,
    standardOrderId: preset.presetId,
    sourcePresetVersion: preset.presetVersion,
    initialImportedPresetVersion: preset.presetVersion,
    lastAutoMergedPresetVersion: preset.presetVersion,
    customizationState: "unmodified",
    customizedFields: [],
    presetMergeStatus: "current",
    ...copyPresetFields(preset),
    updatedAt: now,
  };
}

export function initializeWorkspaceOrderCatalogFromPresets({
  createId = createCatalogItemId,
  existingItems = [],
  now,
  presets,
  workspaceId,
}: {
  createId?: (input: {
    preset: SystemOrderPreset;
    workspaceId: string;
  }) => string;
  existingItems?: OrderCatalogItem[];
  now: string;
  presets: SystemOrderPreset[];
  workspaceId: string;
}): WorkspaceCatalogPresetMergeResult {
  const workspaceItems = existingItems
    .filter((item) => item.workspaceId === workspaceId)
    .map(cloneItem);
  const outOfWorkspaceItems = existingItems
    .filter((item) => item.workspaceId !== workspaceId)
    .map(cloneItem);
  const itemsByPresetId = new Map(
    workspaceItems.map((item) => [item.standardOrderId, item]),
  );
  let createdCount = 0;
  let updatedCount = 0;
  let preservedCount = 0;

  for (const preset of presets) {
    const current = itemsByPresetId.get(preset.presetId);
    if (!current) {
      if (preset.presetStatus !== "active") continue;
      const created = createWorkspaceOrderCatalogItemFromPreset({
        createId,
        now,
        preset,
        workspaceId,
      });
      itemsByPresetId.set(preset.presetId, created);
      createdCount += 1;
      continue;
    }

    if (preset.presetStatus === "hidden") {
      preservedCount += 1;
      continue;
    }

    const customizationState = getCustomizationState(current);
    if (preset.presetStatus === "deprecated") {
      itemsByPresetId.set(preset.presetId, {
        ...current,
        presetMergeStatus:
          customizationState === "detached" ? "detached" : "deprecated_source",
      });
      preservedCount += 1;
      continue;
    }

    if (customizationState === "detached") {
      itemsByPresetId.set(preset.presetId, {
        ...current,
        presetMergeStatus: "detached",
      });
      preservedCount += 1;
      continue;
    }

    if (
      current.sourcePresetVersion === preset.presetVersion &&
      current.lastAutoMergedPresetVersion === preset.presetVersion
    ) {
      preservedCount += 1;
      continue;
    }

    if (customizationState === "customized") {
      const presetFields = copyPresetFields(preset);
      const customizedFields = new Set(current.customizedFields ?? []);
      const merged = { ...current } as Record<string, unknown>;
      let conflict = false;

      for (const [fieldName, presetValue] of Object.entries(presetFields)) {
        if (customizedFields.has(fieldName)) {
          if (!hasSameCatalogFieldValue(merged[fieldName], presetValue)) {
            conflict = true;
          }
          continue;
        }
        merged[fieldName] = structuredClone(presetValue);
      }

      itemsByPresetId.set(preset.presetId, {
        ...(merged as OrderCatalogItem),
        sourcePresetVersion: preset.presetVersion,
        initialImportedPresetVersion:
          current.initialImportedPresetVersion ?? current.sourcePresetVersion,
        lastAutoMergedPresetVersion: preset.presetVersion,
        customizationState: "customized",
        customizedFields: [...customizedFields],
        presetMergeStatus: conflict ? "conflict" : "current",
        updatedAt: now,
      });
      updatedCount += 1;
      continue;
    }

    itemsByPresetId.set(preset.presetId, {
      ...current,
      ...copyPresetFields(preset),
      sourcePresetVersion: preset.presetVersion,
      initialImportedPresetVersion:
        current.initialImportedPresetVersion ?? current.sourcePresetVersion,
      lastAutoMergedPresetVersion: preset.presetVersion,
      customizationState: "unmodified",
      customizedFields: [],
      presetMergeStatus: "current",
      updatedAt: now,
    });
    updatedCount += 1;
  }

  return {
    items: [...outOfWorkspaceItems, ...itemsByPresetId.values()].map(cloneItem),
    createdCount,
    updatedCount,
    preservedCount,
  };
}

export function createMockOrderCatalogGateway(
  dataset: {
    items?: OrderCatalogItem[];
    labItems?: LabTestItem[];
    orderSets?: OrderSet[];
    systemPresets?: SystemOrderPreset[];
    workspaceId?: string;
  } = {},
  now = new Date().toISOString(),
): OrderCatalogGateway {
  const seedItems =
    dataset.items ??
    (dataset.systemPresets
      ? initializeWorkspaceOrderCatalogFromPresets({
          existingItems: [],
          now,
          presets: dataset.systemPresets,
          workspaceId: dataset.workspaceId ?? "clair-demo",
        }).items
      : defaultOrderCatalogItems);
  const items = new Map(seedItems.map((item) => [item.id, cloneItem(item)]));
  const labItems = dataset.labItems ?? defaultLabTestItems;
  const orderSets = dataset.orderSets ?? defaultOrderSets;

  return {
    async listAdminCatalog({ workspaceId }) {
      return {
        ok: true,
        items: [...items.values()]
          .filter((item) => item.workspaceId === workspaceId)
          .map(cloneItem),
      };
    },
    async listChartSearch({ workspaceId }) {
      const activeItems = [...items.values()]
        .filter(
          (item) =>
            item.workspaceId === workspaceId &&
            (item.availabilityStatus === "active" ||
              (item.availabilityStatus === "pending_activation" &&
                item.dispensingLineage?.serviceReviewOnly)) &&
            (!item.dispensingLineage ||
              item.dispensingLineage.clinicalUseAllowed ||
              item.dispensingLineage.serviceReviewOnly),
        )
        .map((item): ChartOrderCatalogSearchRow => {
          const appliedSnapshot = createOrderPricingSnapshot(item);
          return {
            rowType: "individual",
            sourcePresetId: item.standardOrderId,
            sourcePresetVersion: item.sourcePresetVersion,
            displayName: item.inHospitalOrderName,
            billingName: item.billingName,
            categoryGroup: item.categoryGroup,
            targetSpecies: item.targetSpecies,
            appliedSnapshot,
            clinicalOrderType: appliedSnapshot.clinicalOrderType,
            destinationModule: appliedSnapshot.destinationModule,
            executionMode: appliedSnapshot.executionMode,
            detailSchemaVersion: appliedSnapshot.detailSchemaVersion,
            billingEligible: appliedSnapshot.billingEligible,
            workspaceCatalogItemId: item.id,
            sourceMasterRecordId: item.sourceMasterRecordId,
            sourceMasterRevision: item.sourceMasterRevision,
            workspaceCatalogRevision: item.catalogRevision,
            dispensingLineage: appliedSnapshot.dispensingLineage,
            sourceSetId: null,
            sourceSetRevisionId: null,
            sourceSetRevisionNo: null,
            sourceSetAmountBasis: null,
            sourceSetPriceKrw: null,
            sourceSetRangeBasis: null,
            sourceSetTaxType: null,
            sourceSetAvailabilityStatus: null,
            sourceSetNeedsCompositionReview: null,
            sourceSetValidationStatus: null,
            sourceSetPriceRanges: null,
            sourceSetPendingReviewCount: null,
          };
        });
      const activeSets = orderSets
        .filter(
          (set) =>
            set.workspaceId === workspaceId &&
            set.availabilityStatus === "active",
        )
        .map(
          (set): ChartOrderCatalogSearchRow => ({
            rowType: "set",
            sourcePresetId: set.id,
            sourcePresetVersion: `order-set-revision-1`,
            displayName: set.setName,
            billingName: set.billingName,
            categoryGroup: "set",
            targetSpecies: set.targetSpecies,
            appliedSnapshot: createSetSnapshot(set),
            sourceSetId: set.id,
            sourceSetRevisionId: mockOrderSetRevisionId(set.id),
            sourceSetRevisionNo: 1,
            sourceSetAmountBasis: set.amountBasis,
            sourceSetPriceKrw:
              set.amountBasis === "set_fixed_price" ? set.setPriceKrw : null,
            sourceSetRangeBasis:
              set.amountBasis === "range_price"
                ? set.rangeBasis ?? "patient_weight_kg"
                : null,
            sourceSetTaxType:
              set.amountBasis === "included_order_sum"
                ? "derived"
                : set.taxType ?? "taxable",
            sourceSetAvailabilityStatus: "active",
            sourceSetNeedsCompositionReview: false,
            sourceSetValidationStatus: "valid",
            sourceSetPriceRanges: set.priceRanges ?? [],
            sourceSetPendingReviewCount: 0,
          }),
        );
      return { ok: true, rows: [...activeItems, ...activeSets] };
    },
    async mutateOrder({ actorUserId, mutation, workspaceId }) {
      if (mutation.action === "create") {
        const validation = validateOrderItem(mutation.item);
        if (!validation.valid)
          return { ok: false, status: 400, error: "invalid_input" };
        const workspaceDispensing =
          mutation.item.categoryGroup === "medication" &&
          mutation.item.defaultDestinationModule === "dispensing";
        const id = workspaceDispensing
          ? `ord-workspace-dispensing-${items.size + 1}`
          : (mutation.item.id ?? `ord-${items.size + 1}`);
        const next = markCatalogItemCustomized(
          {
            ...mutation.item,
            id,
            workspaceId,
            standardOrderId: workspaceDispensing
              ? `workspace-custom-${id}`
              : mutation.item.standardOrderId,
            availabilityStatus: workspaceDispensing
              ? "pending_activation"
              : mutation.item.availabilityStatus,
            catalogRevision: mutation.item.catalogRevision ?? 1,
            customizationState: mutation.item.customizationState ?? "detached",
            customizedFields: mutation.item.customizedFields ?? ["*"],
            presetMergeStatus: mutation.item.presetMergeStatus ?? "detached",
            workspaceDispensingReview: workspaceDispensing
              ? {
                  status: "pending",
                  revision: 1,
                  authoredByUserId: actorUserId,
                  authoredAt: now,
                }
              : { status: "not_required", revision: 0 },
            updatedAt: now,
          },
          ["*"],
          now,
          actorUserId,
        );
        items.set(id, next);
        return { ok: true, item: cloneItem(next) };
      }

      const current = items.get(mutation.itemId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "order_not_found" };
      }
      if (
        mutation.expectedCatalogRevision !== (current.catalogRevision ?? 1)
      ) {
        return { ok: false, status: 409, error: "catalog_revision_conflict" };
      }

      if (mutation.action === "review") {
        if (
          current.originType !== "workspace_custom" ||
          current.categoryGroup !== "medication" ||
          current.defaultDestinationModule !== "dispensing" ||
          current.workspaceDispensingReview?.status !== "pending"
        ) {
          return { ok: false, status: 400, error: "invalid_input" };
        }
        const approved = mutation.decision === "approve";
        const reviewed: OrderCatalogItem = {
          ...current,
          availabilityStatus: approved ? "active" : "paused",
          catalogRevision: (current.catalogRevision ?? 1) + 1,
          workspaceDispensingReview: {
            ...current.workspaceDispensingReview,
            status: approved ? "approved" : "rejected",
            revision: current.workspaceDispensingReview.revision + 1,
            reviewedByUserId: actorUserId,
            reviewedAt: now,
            reviewNote: mutation.note?.trim() || undefined,
          },
          updatedAt: now,
        };
        items.set(reviewed.id, reviewed);
        return { ok: true, item: cloneItem(reviewed) };
      }

      const next =
        mutation.action === "pause"
          ? markCatalogItemCustomized(
              {
                ...current,
                availabilityStatus: "paused" as const,
                catalogRevision: (current.catalogRevision ?? 1) + 1,
                updatedAt: now,
              },
              ["availabilityStatus"],
              now,
              actorUserId,
            )
          : markCatalogItemCustomized(
              (() => {
                const updated = {
                  ...current,
                  ...mutation.patch,
                  catalogRevision: (current.catalogRevision ?? 1) + 1,
                  updatedAt: now,
                };
                if (
                  current.originType === "workspace_custom" &&
                  current.categoryGroup === "medication" &&
                  current.defaultDestinationModule === "dispensing"
                ) {
                  return {
                    ...updated,
                    availabilityStatus: "pending_activation" as const,
                    workspaceDispensingReview: {
                      status: "pending" as const,
                      revision:
                        (current.workspaceDispensingReview?.revision ?? 0) + 1,
                      authoredByUserId: actorUserId,
                      authoredAt: now,
                    },
                  };
                }
                return updated;
              })(),
              Object.keys(mutation.patch),
              now,
              actorUserId,
            );
      if (!validateOrderItem(next).valid)
        return { ok: false, status: 400, error: "invalid_input" };
      items.set(next.id, next);
      return { ok: true, item: cloneItem(next) };
    },
    async mutateLabTestItem({ input, workspaceId }) {
      const item = labItems.find(
        (candidate) => candidate.id === input.itemId && candidate.workspaceId === workspaceId,
      );
      if (!item) {
        return { ok: false, status: 404, denialReason: "lab_test_item_not_found" };
      }
      const patch = input.patch;
      if (input.action === "local_settings") {
        if (
          input.expectedLocalSettingsRevision !== (item.localSettingsRevision ?? 1) ||
          input.expectedWorkspaceResultRevision !== undefined ||
          (input.targetLinkIds?.length ?? 0) > 0 ||
          Object.keys(patch).sort().join(",") !== "categoryId,isActive,localSortOrder"
        ) {
          return { ok: false, status: 409, error: "lab_item_local_settings_revision_conflict" };
        }
        if (
          typeof patch.categoryId !== "string" ||
          typeof patch.localSortOrder !== "number" ||
          !Number.isInteger(patch.localSortOrder) ||
          patch.localSortOrder < 0 ||
          typeof patch.isActive !== "boolean"
        ) {
          return { ok: false, status: 400, error: "invalid_input" };
        }
        item.categoryId = patch.categoryId;
        item.sortOrder = patch.localSortOrder;
        item.availabilityStatus = patch.isActive ? "active" : "inactive";
        item.localSettingsRevision = (item.localSettingsRevision ?? 1) + 1;
      } else {
        if (
          input.expectedWorkspaceResultRevision !== (item.workspaceResultRevision ?? 1) ||
          input.expectedLocalSettingsRevision !== undefined ||
          Object.keys(patch).sort().join(",") !== "decimalScale,displayName,inputType,resultValueKind,unit"
        ) {
          return { ok: false, status: 409, error: "lab_item_revision_conflict" };
        }
        if (
          typeof patch.displayName !== "string" ||
          typeof patch.inputType !== "string" ||
          typeof patch.resultValueKind !== "string" ||
          (patch.unit !== null && typeof patch.unit !== "string") ||
          (patch.decimalScale !== null &&
            (typeof patch.decimalScale !== "number" || !Number.isInteger(patch.decimalScale) || patch.decimalScale < 0))
        ) {
          return { ok: false, status: 400, error: "invalid_input" };
        }
        item.name = patch.displayName;
        item.resultInputType = patch.inputType as LabTestItem["resultInputType"];
        item.resultValueKind = patch.resultValueKind as LabTestItem["resultValueKind"];
        item.resultUnit = patch.unit ?? undefined;
        item.decimalScale = patch.decimalScale ?? undefined;
        item.workspaceResultRevision = (item.workspaceResultRevision ?? 1) + 1;
      }
      return {
        ok: true,
        item: { ...item },
        affectedCatalogItemIds: [],
      };
    },
    async expandOrderSet({ orderSetId, workspaceId }) {
      const orderSet = orderSets.find(
        (set) => set.id === orderSetId && set.workspaceId === workspaceId,
      );
      if (!orderSet || orderSet.availabilityStatus !== "active") {
        return { ok: false, status: 404, denialReason: "order_set_not_found" };
      }
      const rows = orderSet.includedOrders
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((setItem) => {
          const child = items.get(setItem.childOrderId);
          if (!child) return null;
          return {
            parentSetId: orderSet.id,
            setItemId: setItem.id,
            childOrderId: child.id,
            sortOrder: setItem.sortOrder,
            quantity: setItem.defaultQuantity,
            billingReflectionEnabled: setItem.billingReflectionDefault,
            appliedSnapshot: createOrderPricingSnapshot(child),
          };
        })
        .filter((row): row is ExpandedOrderSetRow => Boolean(row));
      return { ok: true, parentSnapshot: createSetSnapshot(orderSet), rows };
    },
    async previewOrderSet({
      encounterId,
      orderSetId,
      revisionId,
      selectionIntent,
      workspaceId,
    }) {
      const orderSet = orderSets.find(
        (set) => set.id === orderSetId && set.workspaceId === workspaceId,
      );
      if (!orderSet || orderSet.availabilityStatus !== "active") {
        return { ok: false, status: 404, error: "order_set_not_found" };
      }
      if (!encounterId.trim() || !revisionId.trim()) {
        return { ok: false, status: 400, error: "invalid_order_set_selection" };
      }
      const rangeInput = selectionIntent.rangeInput;
      if (orderSet.amountBasis === "range_price") {
        if (rangeInput === undefined) {
          return { ok: false, status: 422, error: "order_set_range_input_required" };
        }
        if (!Number.isFinite(rangeInput) || rangeInput < 0 || rangeInput > 999999999.999 || rangeInput !== Math.round(rangeInput * 1000) / 1000) {
          return { ok: false, status: 422, error: "order_set_range_input_invalid" };
        }
      } else if (rangeInput !== undefined) {
        return { ok: false, status: 400, error: "invalid_order_set_selection" };
      }
      const explicit = new Map(
        selectionIntent.items.map((item) => [item.revisionItemId, item]),
      );
      if (explicit.size !== selectionIntent.items.length || selectionIntent.items.some((item) => !orderSet.includedOrders.some((candidate) => candidate.id === item.revisionItemId))) {
        return { ok: false, status: 422, error: "order_set_member_unavailable" };
      }
      const ranges = (orderSet.priceRanges ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      const matchedRange = orderSet.amountBasis === "range_price"
        ? ranges.find((range) => range.lowerBound <= (rangeInput as number) && (range.upperBound === null || (rangeInput as number) < range.upperBound))
        : undefined;
      if (orderSet.amountBasis === "range_price" && !matchedRange) {
        return { ok: false, status: 422, error: "order_set_range_no_match" };
      }
      if (
        orderSet.includedOrders.some((setItem) => {
          const intent = explicit.get(setItem.id);
          return (
            setItem.quantitySource === "fixed_one" &&
            intent !== undefined &&
            intent.quantity !== 1
          );
        })
      ) {
        return { ok: false, status: 422, error: "order_set_quantity_invalid" };
      }
      const previewItems = orderSet.includedOrders
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((setItem) => {
          const child = items.get(setItem.childOrderId);
          if (!child) return null;
          const intent = explicit.get(setItem.id);
          const selected = intent?.selected ?? setItem.defaultSelected;
          const quantity = intent?.quantity ?? setItem.defaultQuantity;
          if (setItem.quantitySource === "fixed_one" && quantity !== 1) {
            return null;
          }
          if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999999999.999 || quantity !== Math.round(quantity * 1000) / 1000) {
            return null;
          }
          const quantitySource =
            setItem.quantitySource === "fixed_one"
              ? "fixed_one"
              : intent
                ? "manual_at_apply"
                : setItem.quantitySource;
          const taxType = child.taxIncluded ? "taxable" : "non_taxable";
          const billing = orderSet.amountBasis === "included_order_sum"
            ? setItem.billingReflectionDefault
            : false;
          return {
            revisionItemId: setItem.id,
            itemKind: "atomic" as const,
            path: [{ setId: orderSet.id, revisionId, revisionItemId: setItem.id }],
            rootRevisionItemId: setItem.id,
            directRevisionItemId: setItem.id,
            nestedRevisionItemId: null,
            leafRevisionItemId: setItem.id,
            workspaceCatalogItemId: child.id,
            pinnedCompositionCatalogRevision: child.catalogRevision ?? 1,
            appliedCatalogRevision: child.catalogRevision ?? 1,
            defaultSelected: setItem.defaultSelected,
            selected,
            defaultQuantity: setItem.defaultQuantity,
            quantity,
            quantitySource,
            billingReflectionEnabled: billing,
            priceKrw: child.pricingRule.priceKrw ?? child.priceKrw,
            taxType,
            appliedSnapshot: createOrderPricingSnapshot(child) as unknown as Record<string, unknown>,
          } satisfies ChartOrderSetPreviewItem;
        })
        .filter((item) => item !== null) as ChartOrderSetPreviewItem[];
      if (!previewItems.some((item) => item.selected)) {
        return { ok: false, status: 422, error: "order_set_empty_selection" };
      }
      const childSubtotalKrw = previewItems.reduce(
        (sum, item) => sum + (item.selected && item.billingReflectionEnabled ? (item.priceKrw ?? 0) * item.quantity : 0),
        0,
      );
      const setPriceKrw = orderSet.amountBasis === "set_fixed_price" ? orderSet.setPriceKrw : null;
      const effectiveSetPriceKrw =
        orderSet.amountBasis === "range_price" ? matchedRange?.priceKrw ?? null : setPriceKrw;
      const fingerprint = mockChartOrderFingerprint({ orderSetId, revisionId, items: previewItems });
      return {
        ok: true,
        preview: {
          schemaVersion: 1,
          operation: "preview",
          set: {
            sourceSetId: orderSet.id,
            sourceSetRevisionId: revisionId,
            sourceSetRevisionNo: 1,
            sourceSetVersion: `order-set-revision-1`,
            amountBasis: orderSet.amountBasis,
            setPriceKrw: effectiveSetPriceKrw,
            rangeBasis: orderSet.amountBasis === "range_price" ? orderSet.rangeBasis ?? "patient_weight_kg" : null,
            taxType: orderSet.amountBasis === "included_order_sum" ? "derived" : orderSet.taxType ?? "taxable",
            priceRanges: ranges,
            billingReflectionEnabled: orderSet.billingReflectionEnabled,
            displayName: orderSet.setName,
            billingName: orderSet.billingName,
          },
          items: previewItems,
          pricing: {
            selectedSetInput: orderSet.amountBasis === "range_price" ? rangeInput ?? null : null,
            selectedRangeId: matchedRange?.id ?? null,
            rangeInput: orderSet.amountBasis === "range_price" ? rangeInput ?? null : null,
            childSubtotalKrw: childSubtotalKrw,
            explicitExtraSubtotalKrw: 0,
            finalTotalKrw: (effectiveSetPriceKrw ?? 0) + childSubtotalKrw,
          },
          selectionFingerprint: fingerprint,
        },
      };
    },
    async listOrderSets({ workspaceId, query }) {
      const normalizedQuery = query?.trim().toLowerCase();
      const summaries = orderSets
        .filter(
          (set) =>
            set.workspaceId === workspaceId &&
            (!normalizedQuery ||
              set.setName.toLowerCase().includes(normalizedQuery) ||
              set.billingName.toLowerCase().includes(normalizedQuery)),
        )
        .map((set): OrderSetSummary => ({
          orderSetId: set.id,
          currentRevisionId: null,
          currentRevisionNo: null,
          availabilityStatus:
            set.availabilityStatus === "pending_activation"
              ? "inactive"
              : set.availabilityStatus,
          currentEtag: null,
          needsCompositionReview: false,
          setName: set.setName,
          billingName: set.billingName,
          salesUnit: set.salesUnit,
          targetSpecies: set.targetSpecies,
          amountBasis: set.amountBasis,
          setPriceKrw:
            set.amountBasis === "set_fixed_price" ? set.setPriceKrw : null,
          rangeBasis: null,
          taxType: "derived",
          rangePriceRanges: [],
          pendingReviewCount: 0,
        }));
      return { ok: true, summaries };
    },
    async getOrderSet({ orderSetId, workspaceId }) {
      const set = orderSets.find(
        (candidate) => candidate.id === orderSetId && candidate.workspaceId === workspaceId,
      );
      if (!set) return { ok: false, status: 404, error: "order_set_not_found" };
      const listResult = await this.listOrderSets({ workspaceId, query: set.setName });
      if (!listResult.ok || !listResult.summaries[0]) {
        return { ok: false, status: 404, error: "order_set_not_found" };
      }
      return {
        ok: true,
        detail: {
          ...listResult.summaries[0],
          workspaceId,
          sourceSetVersion: set.sourceSetVersion,
          currentRevision: null,
        },
        history: [],
        reviews: [],
      };
    },
    async createOrderSet({ requestId }) {
      return mockOrderSetMutationError(requestId);
    },
    async saveOrderSetRevision({ requestId }) {
      return mockOrderSetMutationError(requestId);
    },
    async resolveOrderSetUpdateReview({ requestId, action }) {
      void action;
      return mockOrderSetMutationError(requestId);
    },
    async getLabTestItemDeleteLock({ testItemId, workspaceId }) {
      const item = labItems.find(
        (labItem) =>
          labItem.id === testItemId && labItem.workspaceId === workspaceId,
      );
      if (!item)
        return {
          ok: false,
          status: 404,
          denialReason: "lab_test_item_not_found",
        };
      const linkedOrderCount = [...items.values()].filter((order) =>
        order.linkedLabItemIds.includes(testItemId),
      ).length;
      const deleteLocked =
        linkedOrderCount > 0 || item.savedResultUsageCount > 0;
      return {
        ok: true,
        lock: {
          deleteLocked,
          linkedOrderCount,
          savedResultUsageCount: item.savedResultUsageCount,
          lockReason:
            linkedOrderCount > 0
              ? "linked_order"
              : item.savedResultUsageCount > 0
                ? "saved_result"
                : undefined,
        },
      };
    },
  };
}

const demoOrderCatalogGateways = new Map<string, OrderCatalogGateway>();

export function getDemoOrderCatalogGateway(sessionId = "shared") {
  const key = sessionId.trim() || "shared";
  const current = demoOrderCatalogGateways.get(key);
  if (current) return current;

  const next = createMockOrderCatalogGateway();
  demoOrderCatalogGateways.set(key, next);
  return next;
}

type SupabaseOrderCatalogQueryResult<Row> = PromiseLike<{
  data: Row[] | Row | null;
  error: { message?: string } | null;
}>;

type SupabaseOrderCatalogItemsQueryBuilder = {
  eq(column: string, value: string): SupabaseOrderCatalogItemsQueryBuilder;
  insert(value: Record<string, unknown>): SupabaseOrderCatalogItemsQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SupabaseOrderCatalogItemsQueryBuilder;
  select(columns: string): SupabaseOrderCatalogItemsQueryBuilder;
  single(): SupabaseOrderCatalogQueryResult<OrderCatalogItemDbRow>;
  update(value: Record<string, unknown>): SupabaseOrderCatalogItemsQueryBuilder;
  then<
    TResult1 = {
      data: OrderCatalogItemDbRow[] | null;
      error: { message?: string } | null;
    },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: {
            data: OrderCatalogItemDbRow[] | null;
            error: { message?: string } | null;
          },
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type OrderCatalogClassificationPath = {
  id: string;
  key: string;
  actionCode: string;
  actionName: string | null;
  itemType: ServiceItemType;
  tCategoryCode: string;
  chartGroupCode: string;
  taskRouteCode: string;
  isUnclassified: boolean;
  retired: boolean;
};

type OrderCatalogItemDbRow = {
  execution_source_baseline?: unknown;
  execution_merge_conflicts?: unknown;
  taxonomy_merge_conflict?: unknown;
  admin_subcategory_code?: string | null;
  lab_family_code?: string | null;
  id: string;
  workspace_id: string;
  standard_order_id: string;
  source_preset_version: string;
  initial_imported_preset_version?: string | null;
  last_auto_merged_preset_version?: string | null;
  customization_state?: string | null;
  customized_fields?: string[] | null;
  last_customized_at?: string | null;
  last_customized_by_user_id?: string | null;
  preset_merge_status?: string | null;
  origin_type?: string | null;
  source_master_record_id?: string | null;
  source_master_revision?: number | null;
  initial_imported_revision?: number | null;
  last_auto_merged_revision?: number | null;
  classification_path_id?: string | null;
  classification_path?: unknown;
  catalog_revision?: number | null;
  source_projection_snapshot?: Record<string, unknown> | null;
  source_projection_fingerprint?: string | null;
  source_dispensing_profile_id?: string | null;
  source_dispensing_profile_revision?: number | null;
  source_medication_product_id?: string | null;
  source_medication_product_revision?: number | null;
  source_clinical_review_id?: string | null;
  source_evidence_fingerprint?: string | null;
  clinical_use_allowed?: boolean | null;
  dispensing_profile_snapshot?: Record<string, unknown> | null;
  dispensing_profile_snapshot_sha256?: string | null;
  service_review_only?: boolean | null;
  service_review_release_id?: string | null;
  clinical_order_type?: string | null;
  is_external_lab?: boolean | null;
  destination_module?: string | null;
  execution_mode?: string | null;
  detail_schema_version?: number | null;
  detail_field_schema?: Record<string, unknown> | null;
  billing_eligible?: boolean | null;
  workspace_dispensing_review_status?: string | null;
  workspace_dispensing_review_revision?: number | null;
  workspace_dispensing_authored_by_user_id?: string | null;
  workspace_dispensing_authored_at?: string | null;
  workspace_dispensing_reviewed_by_user_id?: string | null;
  workspace_dispensing_reviewed_at?: string | null;
  workspace_dispensing_review_note?: string | null;
  category_group: string;
  category_label: string;
  t_code?: string | null;
  t_code_label?: string | null;
  standard_order_name: string;
  in_hospital_order_name: string;
  billing_name: string;
  aliases?: string[] | null;
  availability_status: string;
  price_krw: number | null;
  sales_unit: string;
  target_species?: string[] | null;
  default_destination_module: string;
  default_task_required: boolean;
  billing_reflection_enabled: boolean;
  care_guide?: string | null;
  care_guide_delivery_enabled?: boolean | null;
  internal_instruction?: string | null;
  internal_instruction_delivery_enabled?: boolean | null;
  tax_included: boolean;
  rounding_rule: string;
  default_detail_inputs?: Record<string, unknown> | null;
  default_detail_input_policies?: Record<string, unknown> | null;
  source_execution_preset_id?: string | null;
  source_execution_preset_revision?: number | null;
  source_execution_preset_sha256?: string | null;
  pricing_rule?: Record<string, unknown> | null;
  medication_metadata?: Record<string, unknown> | null;
  vaccine_metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at: string;
};

export function createSupabaseOrderCatalogGateway(
  client: SupabaseOrderCatalogRpcClient,
): OrderCatalogGateway {
  async function readBackMutation(data: unknown, workspaceId: string) {
    const normalized = normalizeCatalogRpcItem(data);
    if (!normalized.ok) return normalized;
    if (normalized.item.workspaceId !== workspaceId) {
      return { ok: false as const, status: 500 as const, error: "db_write_failed" as const };
    }
    try {
      const response = await client.rpc("clair_list_order_catalog_admin_v2", { p_workspace_id: workspaceId });
      const items = response.error ? null : mapOrderCatalogDbRows(response.data);
      const item = items?.every((entry) => entry.workspaceId === workspaceId)
        ? items.find((entry) => entry.id === normalized.item.id &&
          entry.catalogRevision === normalized.item.catalogRevision &&
          entry.classificationPathId === normalized.item.classificationPathId &&
          entry.adminSubcategoryCode === normalized.item.adminSubcategoryCode &&
          entry.labFamilyCode === normalized.item.labFamilyCode)
        : undefined;
      if (item) return { ...normalized, item };
    } catch {
      // Do not turn a committed write into a retryable save failure.
    }
    return { ...normalized, item: { ...normalized.item, classificationPath: undefined, classificationPathReadFailed: true } };
  }
  return {
    async listAdminCatalog({ workspaceId }) {
      try {
        const { data, error } = await client.rpc(
          "clair_list_order_catalog_admin_v2",
          { p_workspace_id: workspaceId },
        );
        if (error) return mapCatalogReadError(error);
        const items = mapOrderCatalogDbRows(data);
        if (!items || items.some((item) => item.workspaceId !== workspaceId)) {
          return { ok: false, status: 500, error: "catalog_response_invalid" };
        }
        return { ok: true, items };
      } catch {
        return { ok: false, status: 503, error: "catalog_read_failed" };
      }
    },
    async listChartSearch({ workspaceId }) {
      try {
      const { data, error } = await client.rpc(
        "clair_list_order_catalog_chart_search_v2",
        { p_workspace_id: workspaceId },
      );
        if (error) return mapCatalogReadError(error);
        const rows = mapChartSearchRows(data, workspaceId);
        if (!rows)
          return { ok: false, status: 500, error: "catalog_response_invalid" };
        return { ok: true, rows };
      } catch {
        return { ok: false, status: 503, error: "catalog_read_failed" };
      }
    },
    async mutateOrder({ actorUserId, mutation, workspaceId }) {
      if (mutation.action === "create") {
        const validation = validateOrderItem(mutation.item);
        if (!validation.valid)
          return { ok: false, status: 400, error: "invalid_input" };
        const now = new Date().toISOString();
        const id = mutation.item.id ?? `ord-${crypto.randomUUID()}`;
        const next = markCatalogItemCustomized(
          {
            ...mutation.item,
            id,
            customizationState: mutation.item.customizationState ?? "detached",
            customizedFields: mutation.item.customizedFields ?? ["*"],
            presetMergeStatus: mutation.item.presetMergeStatus ?? "detached",
            updatedAt: now,
          },
          ["*"],
          now,
          actorUserId,
        );
        const { data, error } = await client.rpc(
          "clair_create_order_catalog_item",
          { p_workspace_id: workspaceId, p_item: orderCatalogItemToRpcInput(next) },
        );
        if (error) return mapCatalogRpcError(error.message);
        return readBackMutation(data, workspaceId);
      }

      if (mutation.action === "review") {
        const { data, error } = await client.rpc(
          "clair_review_workspace_dispensing_order",
          {
            p_workspace_id: workspaceId,
            p_item_id: mutation.itemId,
            p_expected_catalog_revision: mutation.expectedCatalogRevision,
            p_action: mutation.decision,
            p_note: mutation.note?.trim() || null,
          },
        );
        if (error) return mapCatalogRpcError(error.message);
        return readBackMutation(data, workspaceId);
      }

      const patch = mutation.action === "pause"
        ? { availabilityStatus: "paused" as const }
        : mutation.patch;
      const { data, error } = await client.rpc(
        "clair_update_order_catalog_item",
        {
          p_workspace_id: workspaceId,
          p_item_id: mutation.itemId,
          p_expected_catalog_revision: mutation.expectedCatalogRevision,
          p_patch: orderCatalogPatchToRpcInput(patch),
        },
      );
      if (error) return mapCatalogRpcError(error.message);
      return readBackMutation(data, workspaceId);
    },
    async mutateLabTestItem({ actorUserId, input, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_update_workspace_lab_test_item",
        {
          p_workspace_id: workspaceId,
          p_item_id: input.itemId,
          p_actor_user_id: actorUserId,
          p_expected_workspace_result_revision:
            input.expectedWorkspaceResultRevision ?? null,
          p_expected_local_settings_revision:
            input.expectedLocalSettingsRevision ?? null,
          p_action: input.action,
          p_patch: input.patch,
          p_target_link_ids: input.targetLinkIds ?? [],
        },
      );
      if (error) return mapLabTestItemRpcError(error.message);
      return normalizeLabTestItemRpcResult(data);
    },
    async listOrderSets({ workspaceId, query }) {
      const { data, error } = await client.rpc("clair_list_order_sets", {
        p_workspace_id: workspaceId,
        p_query: query?.trim() || null,
      });
      if (error) return mapOrderSetListRpcError(error.message);
      return { ok: true, summaries: mapOrderSetSummaries(data) };
    },
    async getOrderSet({ orderSetId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_order_set", {
        p_workspace_id: workspaceId,
        p_order_set_id: orderSetId,
      });
      if (error) return mapOrderSetReadRpcError(error.message);
      const response = isRecord(data) ? data : {};
      const detail = mapOrderSetDetail(response.orderSet);
      if (!detail) return { ok: false, status: 500, error: "invalid_order_set_definition" };
      return {
        ok: true,
        detail,
        history: mapOrderSetRevisions(response.history),
        reviews: mapOrderSetReviews(response.reviews),
      };
    },
    async createOrderSet({ availabilityStatus, definition, requestId, workspaceId }) {
      const { data, error } = await client.rpc("clair_create_order_set", {
        p_workspace_id: workspaceId,
        p_definition: definition as unknown as Record<string, unknown>,
        p_availability_status: availabilityStatus,
        p_request_id: requestId,
      });
      return mapOrderSetMutationRpcResult(data, error, requestId);
    },
    async saveOrderSetRevision({
      availabilityStatus,
      definition,
      expectedCurrentRevisionId,
      orderSetId,
      requestId,
      workspaceId,
    }) {
      const { data, error } = await client.rpc("clair_save_order_set_revision", {
        p_workspace_id: workspaceId,
        p_order_set_id: orderSetId,
        p_expected_current_revision_id: expectedCurrentRevisionId,
        p_definition: definition as unknown as Record<string, unknown>,
        p_availability_status: availabilityStatus,
        p_request_id: requestId,
      });
      return mapOrderSetMutationRpcResult(data, error, requestId);
    },
    async resolveOrderSetUpdateReview({
      action,
      expectedParentRevisionId,
      requestId,
      reviewId,
      workspaceId,
    }) {
      const { data, error } = await client.rpc("clair_resolve_order_set_update_review", {
        p_workspace_id: workspaceId,
        p_review_id: reviewId,
        p_expected_parent_revision_id: expectedParentRevisionId,
        p_action: action,
        p_request_id: requestId,
      });
      return mapOrderSetMutationRpcResult(data, error, requestId);
    },
    async expandOrderSet() {
      return { ok: false, status: 404, denialReason: "order_set_not_found" };
    },
    async previewOrderSet({
      encounterId,
      orderSetId,
      revisionId,
      selectionIntent,
      workspaceId,
    }) {
      const { data, error } = await client.rpc(
        "clair_preview_chart_order_set",
        {
          workspace_id: workspaceId,
          encounter_id: encounterId,
          set_id: orderSetId,
          revision_id: revisionId,
          selection_intent: selectionIntent,
        },
      );
      if (error) return mapChartOrderSetPreviewRpcError(error.message);
      const preview = mapChartOrderSetPreview(data);
      return preview
        ? { ok: true, preview }
        : { ok: false, status: 500, error: "invalid_preview_response" };
    },
    async getLabTestItemDeleteLock() {
      return {
        ok: false,
        status: 404,
        denialReason: "lab_test_item_not_found",
      };
    },
  };
}

function mapOrderSetListRpcError(message?: string): {
  ok: false;
  status: number;
  error: OrderSetErrorCode;
} {
  return { ok: false, ...mapOrderSetRpcError(message) };
}

function mapOrderSetReadRpcError(message?: string): {
  ok: false;
  status: number;
  error: OrderSetErrorCode;
} {
  return { ok: false, ...mapOrderSetRpcError(message) };
}

function mapOrderSetRpcError(message?: string): {
  status: number;
  error: OrderSetErrorCode;
} {
  const text = message ?? "";
  if (text.includes("authentication_required")) {
    return { status: 401, error: "authentication_required" };
  }
  if (text.includes("permission_missing") || text.includes("membership")) {
    return { status: 403, error: text.includes("membership") ? "workspace_membership_missing" : "permission_missing" };
  }
  if (text.includes("order_set_not_found")) {
    return { status: 404, error: "order_set_not_found" };
  }
  if (text.includes("review_not_found")) {
    return { status: 404, error: "order_set_review_not_found" };
  }
  if (
    text.includes("revision_conflict") ||
    text.includes("idempotency_conflict") ||
    text.includes("obsolete") ||
    text.includes("requires_refresh")
  ) {
    return {
      status: 409,
      error: text.includes("idempotency_conflict")
        ? "idempotency_conflict"
        : text.includes("requires_refresh")
          ? "child_revision_requires_refresh"
          : text.includes("obsolete")
            ? "order_set_review_obsolete"
            : "revision_conflict",
    };
  }
  if (text.includes("member_unavailable") || text.includes("invalid_order_set")) {
    return {
      status: 422,
      error: text.includes("member_unavailable")
        ? "order_set_member_unavailable"
        : "invalid_order_set_definition",
    };
  }
  return { status: 500, error: "invalid_order_set_definition" };
}

function mapOrderSetSummaries(value: unknown): OrderSetSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(mapOrderSetSummary)
    .filter((summary): summary is OrderSetSummary => Boolean(summary));
}

function mapOrderSetSummary(value: unknown): OrderSetSummary | null {
  if (!isRecord(value)) return null;
  const orderSetId =
    b2ReadString(value, "order_set_id", "orderSetId") ??
    b2ReadString(value, "id");
  const availabilityStatus = b2ReadString(value, "availability_status", "availabilityStatus");
  const setName = b2ReadString(value, "set_name", "setName");
  const billingName = b2ReadString(value, "billing_name", "billingName");
  const salesUnit = b2ReadString(value, "sales_unit", "salesUnit");
  const amountBasis = b2ReadString(value, "amount_basis", "amountBasis");
  if (!orderSetId || !availabilityStatus || !setName || !billingName || !salesUnit || !amountBasis) return null;
  return {
    orderSetId,
    currentRevisionId: b2ReadString(value, "current_revision_id", "currentRevisionId"),
    currentRevisionNo: b2ReadNumber(value, "current_revision_no", "currentRevisionNo"),
    availabilityStatus: availabilityStatus as OrderSetSummary["availabilityStatus"],
    currentEtag: b2ReadString(value, "current_etag", "currentEtag"),
    needsCompositionReview: b2ReadBoolean(value, "needs_composition_review", "needsCompositionReview"),
    setName,
    billingName,
    salesUnit: salesUnit as OrderCatalogSalesUnit,
    targetSpecies: readSpeciesList(value.target_species ?? value.targetSpecies),
    amountBasis: amountBasis as OrderSetAmountBasis,
    setPriceKrw: b2ReadNullableNumber(value, "set_price_krw", "setPriceKrw"),
    rangeBasis: (b2ReadString(value, "range_basis", "rangeBasis") as OrderSetRangeBasis | null),
    taxType: (b2ReadString(value, "tax_type", "taxType") ?? "derived") as OrderSetTaxType,
    rangePriceRanges: mapOrderSetRanges(value.range_price_ranges ?? value.rangePriceRanges),
    pendingReviewCount: b2ReadNumber(value, "pending_review_count", "pendingReviewCount") ?? 0,
  };
}

function mapOrderSetDetail(value: unknown): OrderSetDetail | null {
  if (!isRecord(value)) return null;
  const summary = mapOrderSetSummary(value);
  const workspaceId = b2ReadString(value, "workspace_id", "workspaceId");
  const sourceSetVersion = b2ReadString(value, "source_set_version", "sourceSetVersion");
  if (!summary || !workspaceId || !sourceSetVersion) return null;
  return {
    ...summary,
    workspaceId,
    sourceSetVersion,
    currentRevision: mapOrderSetRevision(value.currentRevision ?? value.current_revision),
  };
}

function mapOrderSetRevisions(value: unknown): OrderSetRevision[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(mapOrderSetRevision)
    .filter((revision): revision is OrderSetRevision => Boolean(revision));
}

function mapOrderSetRevision(value: unknown): OrderSetRevision | null {
  if (!isRecord(value)) return null;
  const workspaceId = b2ReadString(value, "workspace_id", "workspaceId");
  const orderSetId = b2ReadString(value, "order_set_id", "orderSetId");
  const id = b2ReadString(value, "id");
  const setName = b2ReadString(value, "set_name", "setName");
  const billingName = b2ReadString(value, "billing_name", "billingName");
  const amountBasis = b2ReadString(value, "amount_basis", "amountBasis");
  const salesUnit = b2ReadString(value, "sales_unit", "salesUnit");
  const taxType = b2ReadString(value, "tax_type", "taxType");
  if (!workspaceId || !orderSetId || !id || !setName || !billingName || !amountBasis || !salesUnit || !taxType) return null;
  return {
    id,
    workspaceId,
    orderSetId,
    revisionNo: b2ReadNumber(value, "revision_no", "revisionNo") ?? 0,
    validationStatus: (b2ReadString(value, "validation_status", "validationStatus") ?? "valid") as OrderSetRevisionStatus,
    validationErrors: Array.isArray(value.validation_errors ?? value.validationErrors)
      ? (value.validation_errors ?? value.validationErrors) as unknown[]
      : [],
    setCategory: b2ReadNullableString(value, "set_category", "setCategory"),
    setName,
    billingName,
    amountBasis: amountBasis as OrderSetAmountBasis,
    setPriceKrw: b2ReadNullableNumber(value, "set_price_krw", "setPriceKrw"),
    rangeBasis: b2ReadNullableString(value, "range_basis", "rangeBasis") as OrderSetRangeBasis | null,
    salesUnit: salesUnit as OrderCatalogSalesUnit,
    billingReflectionEnabled: b2ReadBoolean(value, "billing_reflection_enabled", "billingReflectionEnabled"),
    taxType: taxType as OrderSetTaxType,
    targetSpecies: readSpeciesList(value.target_species ?? value.targetSpecies),
    careGuide: b2ReadNullableString(value, "care_guide", "careGuide"),
    internalInstruction: b2ReadNullableString(value, "internal_instruction", "internalInstruction"),
    createdByUserId: b2ReadNullableString(value, "created_by_user_id", "createdByUserId"),
    createdAt: b2ReadString(value, "created_at", "createdAt") ?? "",
    items: mapOrderSetRevisionItems(value.items),
    priceRanges: mapOrderSetRanges(value.priceRanges),
    currentEtag: b2ReadString(value, "currentEtag", "current_etag") ?? `order-set-revision-${id}`,
  };
}

function mapOrderSetRevisionItems(value: unknown): OrderSetRevisionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      id: b2ReadString(row, "id") ?? "",
      childKind: (b2ReadString(row, "child_kind", "childKind") ?? "atomic") as OrderSetDefinitionItem["childKind"],
      childOrderCatalogItemId: b2ReadNullableString(row, "child_order_catalog_item_id", "childOrderCatalogItemId"),
      childOrderCatalogRevision: b2ReadNullableNumber(row, "child_order_catalog_revision", "childOrderCatalogRevision"),
      childOrderSetId: b2ReadNullableString(row, "child_order_set_id", "childOrderSetId"),
      childSetRevisionId: b2ReadNullableString(row, "child_set_revision_id", "childSetRevisionId"),
      sortOrder: b2ReadNumber(row, "sort_order", "sortOrder") ?? 0,
      defaultSelected: b2ReadBoolean(row, "default_selected", "defaultSelected"),
      billingReflectionDefault: b2ReadBoolean(row, "billing_reflection_default", "billingReflectionDefault"),
      defaultQuantity: b2ReadNumber(row, "default_quantity", "defaultQuantity") ?? 1,
      quantitySource: (b2ReadString(row, "quantity_source", "quantitySource") ?? "fixed_one") as OrderSetDefinitionItem["quantitySource"],
    }))
    .filter((item) => item.id.length > 0);
}

function mapOrderSetRanges(value: unknown): OrderSetRevisionPriceRange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      id: b2ReadString(row, "id") ?? "",
      sortOrder: b2ReadNumber(row, "sort_order", "sortOrder") ?? 0,
      lowerBound: b2ReadNumber(row, "lower_bound", "lowerBound") ?? 0,
      upperBound: b2ReadNullableNumber(row, "upper_bound", "upperBound"),
      priceKrw: b2ReadNumber(row, "price_krw", "priceKrw") ?? 0,
    }))
    .filter((range) => range.id.length > 0);
}

function mapOrderSetReviews(value: unknown): OrderSetUpdateReview[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      id: b2ReadString(row, "id") ?? "",
      workspaceId: b2ReadString(row, "workspace_id", "workspaceId") ?? "",
      parentOrderSetId: b2ReadString(row, "parent_order_set_id", "parentOrderSetId") ?? "",
      parentRevisionId: b2ReadString(row, "parent_revision_id", "parentRevisionId") ?? "",
      childOrderSetId: b2ReadString(row, "child_order_set_id", "childOrderSetId") ?? "",
      pinnedChildRevisionId: b2ReadString(row, "pinned_child_revision_id", "pinnedChildRevisionId") ?? "",
      availableChildRevisionId: b2ReadString(row, "available_child_revision_id", "availableChildRevisionId") ?? "",
      status: (b2ReadString(row, "status") ?? "pending") as OrderSetReviewStatus,
      resultParentRevisionId: b2ReadNullableString(row, "result_parent_revision_id", "resultParentRevisionId"),
      createdAt: b2ReadString(row, "created_at", "createdAt") ?? "",
      resolvedAt: b2ReadNullableString(row, "resolved_at", "resolvedAt"),
      resolvedByUserId: b2ReadNullableString(row, "resolved_by_user_id", "resolvedByUserId"),
    }))
    .filter((review) => review.id.length > 0 && review.workspaceId.length > 0);
}

function mapOrderSetMutationRpcResult(
  value: unknown,
  error: { message?: string } | null,
  requestId: string,
): OrderSetMutationResponse {
  if (error) {
    const mapped = mapOrderSetRpcError(error.message);
    const failureOutcome: OrderSetFailureOutcome =
      mapped.error === "revision_conflict" || mapped.error === "idempotency_conflict"
        ? "conflict"
        : mapped.error === "order_set_review_obsolete"
          ? "obsolete"
          : "rejected";
    return {
      ok: false,
      outcome: failureOutcome,
      requestId,
      error: { code: mapped.error, field: null, message: error.message ?? mapped.error },
      result: null,
    };
  }
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return {
      ok: false,
      outcome: "rejected",
      requestId,
      error: { code: "invalid_order_set_definition", field: null, message: "invalid RPC response" },
      result: null,
    };
  }
  const rpcRequestId = typeof value.requestId === "string" ? value.requestId : requestId;
  if (!value.ok) {
    const errorValue = isRecord(value.error) ? value.error : {};
    const code = typeof errorValue.code === "string" && isOrderSetErrorCode(errorValue.code)
      ? errorValue.code
      : "invalid_order_set_definition";
    const outcome = isOrderSetFailureOutcome(value.outcome) ? value.outcome : "rejected";
    return {
      ok: false,
      outcome,
      requestId: rpcRequestId,
      error: {
        code,
        field: typeof errorValue.field === "string" ? errorValue.field : null,
        message: typeof errorValue.message === "string" ? errorValue.message : code,
      },
      result: null,
    };
  }
  const resultValue = isRecord(value.result) ? value.result : {};
  const successOutcome = isOrderSetSuccessOutcome(value.outcome) ? value.outcome : null;
  if (!successOutcome) {
    return {
      ok: false,
      outcome: "rejected",
      requestId: rpcRequestId,
      error: { code: "invalid_order_set_definition", field: null, message: "invalid RPC outcome" },
      result: null,
    };
  }
  return {
    ok: true,
    outcome: successOutcome,
    requestId: rpcRequestId,
    error: null,
    result: {
      orderSet: mapOrderSetDetail(resultValue.orderSet),
      revision: mapOrderSetRevision(resultValue.revision),
      review: mapOrderSetReviews([resultValue.review])[0] ?? null,
      current: isRecord(resultValue.current) && typeof resultValue.current.revisionId === "string" && typeof resultValue.current.etag === "string"
        ? { revisionId: resultValue.current.revisionId, etag: resultValue.current.etag }
        : null,
    },
  };
}

function isOrderSetErrorCode(value: string): value is OrderSetErrorCode {
  return [
    "authentication_required", "workspace_membership_missing", "permission_missing",
    "order_set_not_found", "order_set_review_not_found", "revision_conflict",
    "idempotency_conflict", "invalid_order_set_definition", "order_set_member_unavailable",
    "child_revision_requires_refresh", "order_set_review_obsolete", "if_none_match_required",
    "if_match_required",
  ].includes(value);
}

function isOrderSetSuccessOutcome(value: unknown): value is OrderSetSuccessOutcome {
  return value === "created" || value === "applied" || value === "accepted" || value === "dismissed";
}

function isOrderSetFailureOutcome(value: unknown): value is OrderSetFailureOutcome {
  return value === "rejected" || value === "conflict" || value === "obsolete" || value === "superseded";
}

function b2ReadString(row: Record<string, unknown>, snake: string, camel = snake): string | null {
  const value = row[snake] ?? row[camel];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function b2ReadNullableString(row: Record<string, unknown>, snake: string, camel = snake): string | null {
  const value = row[snake] ?? row[camel];
  return value === null || value === undefined ? null : typeof value === "string" ? value : null;
}

function b2ReadNumber(row: Record<string, unknown>, snake: string, camel = snake): number | null {
  const value = row[snake] ?? row[camel];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function b2ReadNullableNumber(row: Record<string, unknown>, snake: string, camel = snake): number | null {
  const value = row[snake] ?? row[camel];
  return value === null || value === undefined ? null : b2ReadNumber({ value }, "value");
}

function b2ReadBoolean(row: Record<string, unknown>, snake: string, camel = snake): boolean {
  const value = row[snake] ?? row[camel];
  return value === true || value === "true";
}

function normalizeCatalogRpcItem(value: unknown):
  | {
      ok: true;
      item: OrderCatalogItem;
      databaseAuditWritten?: true;
    }
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 500; error: "db_write_failed" } {
  const itemValue =
    isRecord(value) && isRecord(value.item) ? value.item : value;
  const item = mapOrderCatalogDbRow(itemValue);
  return item
    ? {
        ok: true,
        item,
        ...(isRecord(value) && value.databaseAuditWritten === true
          ? { databaseAuditWritten: true as const }
          : {}),
      }
    : { ok: false, status: 500, error: "db_write_failed" };
}

function mapCatalogRpcError(
  message?: string,
):
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 404; denialReason: "order_not_found" }
  | { ok: false; status: 409; error: "catalog_revision_conflict" }
  | { ok: false; status: 500; error: "db_write_failed" } {
  if (message?.includes("catalog_revision_conflict")) {
    return { ok: false, status: 409, error: "catalog_revision_conflict" };
  }
  if (message?.includes("order_catalog_item_not_found")) {
    return { ok: false, status: 404, denialReason: "order_not_found" };
  }
  if (
    message?.includes("catalog_") ||
    message?.includes("dispensing_review") ||
    message?.includes("pending_activation") ||
    message?.includes("active_billable") ||
    message?.includes("workspace_admin_required") ||
    message?.includes("veterinarian_required")
  ) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  return { ok: false, status: 500, error: "db_write_failed" };
}

function mapLabTestItemRpcError(
  message?: string,
):
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 403; denialReason: "permission_missing" | "actor_mismatch" }
  | { ok: false; status: 404; denialReason: "lab_test_item_not_found" }
  | { ok: false; status: 409; error: "lab_item_revision_conflict" | "lab_item_local_settings_revision_conflict" }
  | { ok: false; status: 500; error: "db_write_failed" } {
  if (message?.includes("permission_missing")) {
    return { ok: false, status: 403, denialReason: "permission_missing" };
  }
  if (message?.includes("actor_mismatch")) {
    return { ok: false, status: 403, denialReason: "actor_mismatch" };
  }
  if (message?.includes("lab_test_item_not_found")) {
    return { ok: false, status: 404, denialReason: "lab_test_item_not_found" };
  }
  if (message?.includes("lab_item_local_settings_revision_conflict")) {
    return {
      ok: false,
      status: 409,
      error: "lab_item_local_settings_revision_conflict",
    };
  }
  if (message?.includes("lab_item_revision_conflict")) {
    return { ok: false, status: 409, error: "lab_item_revision_conflict" };
  }
  if (message?.includes("lab_") || message?.includes("revision")) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  return { ok: false, status: 500, error: "db_write_failed" };
}

function normalizeLabTestItemRpcResult(value: unknown):
  | { ok: true; item: LabTestItem; affectedCatalogItemIds: string[] }
  | { ok: false; status: 500; error: "db_write_failed" } {
  if (!value || typeof value !== "object") {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
  const response = value as Record<string, unknown>;
  const item = mapLabTestItemDbRow(response.item);
  if (!item) return { ok: false, status: 500, error: "db_write_failed" };
  const affectedCatalogItemIds = Array.isArray(response.affectedCatalogItemIds)
    ? response.affectedCatalogItemIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  return { ok: true, item, affectedCatalogItemIds };
}

function mapLabTestItemDbRow(value: unknown): LabTestItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspace_id !== "string" ||
    typeof row.category_id !== "string" ||
    typeof row.test_item_name !== "string" ||
    typeof row.result_input_type !== "string" ||
    typeof row.availability_status !== "string"
  ) {
    return null;
  }
  const usage = row.saved_result_usage_count;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    categoryId: row.category_id,
    name: row.test_item_name,
    resultInputType: row.result_input_type as LabTestItem["resultInputType"],
    resultValueKind:
      row.result_value_kind === "numeric" ||
      row.result_value_kind === "text" ||
      row.result_value_kind === "coded"
        ? row.result_value_kind
        : undefined,
    decimalScale:
      typeof row.decimal_scale === "number" ? row.decimal_scale : undefined,
    resultUnit: typeof row.result_unit === "string" ? row.result_unit : undefined,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    availabilityStatus: row.availability_status as OrderCatalogAvailability,
    savedResultUsageCount: typeof usage === "number" ? usage : 0,
    definitionOrigin:
      row.definition_origin === "clair_master" ||
      row.definition_origin === "workspace_custom" ||
      row.definition_origin === "legacy" ||
      row.definition_origin === "quarantined"
        ? row.definition_origin
        : undefined,
    workspaceResultRevision:
      typeof row.workspace_result_revision === "number"
        ? row.workspace_result_revision
        : undefined,
    localSettingsRevision:
      typeof row.local_settings_revision === "number"
        ? row.local_settings_revision
        : undefined,
  };
}

function orderCatalogItemToRpcInput(item: OrderCatalogItem) {
  return {
    ...copyOrderTaxonomy(item),
    id: item.id,
    standardOrderId: item.standardOrderId,
    sourcePresetVersion: item.sourcePresetVersion,
    classificationPathId: item.classificationPathId ?? null,
    categoryGroup: item.categoryGroup,
    categoryLabel: item.categoryLabel,
    tCode: item.tCode ?? null,
    tCodeLabel: item.tCodeLabel ?? null,
    standardOrderName: item.standardOrderName,
    inHospitalOrderName: item.inHospitalOrderName,
    billingName: item.billingName,
    aliases: item.aliases,
    availabilityStatus: item.availabilityStatus,
    priceKrw: item.priceKrw,
    salesUnit: item.salesUnit,
    targetSpecies: item.targetSpecies,
    defaultDestinationModule: item.defaultDestinationModule,
    defaultTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.billingReflectionEnabled,
    careGuide: item.careGuide ?? null,
    careGuideDeliveryEnabled: item.careGuideDeliveryEnabled ?? false,
    internalInstruction: item.internalInstruction ?? null,
    internalInstructionDeliveryEnabled:
      item.internalInstructionDeliveryEnabled ?? false,
    taxIncluded: item.taxIncluded,
    roundingRule: item.roundingRule,
    ...(item.defaultDetailInputs !== undefined
      ? { defaultDetailInputs: structuredClone(item.defaultDetailInputs) }
      : {}),
    pricingRule: item.pricingRule,
    medicationMetadata: item.medicationMetadata ?? {},
    vaccineMetadata: item.vaccineMetadata ?? {},
  };
}

function orderCatalogPatchToRpcInput(patch: Partial<OrderCatalogItem>) {
  // Preserve every client-supplied key so the fixed-search-path RPC can
  // reject protected lineage/revision fields instead of silently dropping
  // an attempted write at this adapter boundary.
  return Object.fromEntries(Object.entries(patch));
}

function mapOrderCatalogDbRows(value: unknown): OrderCatalogItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(mapOrderCatalogDbRow);
  if (items.some((item) => item === null)) return null;
  return items as OrderCatalogItem[];
}

function parseCatalogClassificationPath(
  value: unknown, pathId: unknown,
): OrderCatalogClassificationPath | undefined | null {
  // Older RPCs omit metadata; a failed join returns null. Neither creates taxonomy.
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || typeof pathId !== "string" || value.id !== pathId) return null;
  const strings = [value.id, value.key, value.actionCode, value.tCategoryCode,
    value.chartGroupCode, value.taskRouteCode];
  if (strings.some((entry) => typeof entry !== "string" || !entry.trim())) return null;
  if (value.actionName !== null && (typeof value.actionName !== "string" || !value.actionName.trim())) return null;
  if (typeof value.isUnclassified !== "boolean" || typeof value.retired !== "boolean") return null;
  if (!["consultation", "medication", "treatment", "lab", "imaging", "hospitalization", "misc"].includes(value.itemType as string)) return null;
  return {
    id: value.id as string, key: value.key as string,
    actionCode: value.actionCode as string, actionName: value.actionName as string | null,
    itemType: value.itemType as ServiceItemType, tCategoryCode: value.tCategoryCode as string,
    chartGroupCode: value.chartGroupCode as string, taskRouteCode: value.taskRouteCode as string,
    isUnclassified: value.isUnclassified, retired: value.retired,
  };
}

function mapOrderCatalogDbRow(value: unknown): OrderCatalogItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OrderCatalogItemDbRow>;
  const taxonomyMergeConflict = parseOrderTaxonomyMergeConflict(row.taxonomy_merge_conflict);
  if (taxonomyMergeConflict === null) return null;
  const executionSourceBaseline = parseExecutionSourceBaseline(row.execution_source_baseline);
  const executionMergeConflicts = parseExecutionMergeConflicts(row.execution_merge_conflicts);
  if (executionSourceBaseline === null || executionMergeConflicts === null) return null;
  if (!isOrderTaxonomyValid(row.clinical_order_type, row.admin_subcategory_code, row.lab_family_code)) return null;
  const classificationPath = parseCatalogClassificationPath(row.classification_path, row.classification_path_id);
  if (classificationPath === null) return null;
  if (row.clinical_order_type !== null && row.clinical_order_type !== undefined &&
    !isClinicalOrderType(row.clinical_order_type)) return null;
  const requiredStrings = [
    row.id, row.workspace_id, row.standard_order_id, row.source_preset_version,
    row.category_group, row.category_label, row.standard_order_name,
    row.in_hospital_order_name, row.billing_name, row.availability_status,
    row.sales_unit, row.default_destination_module, row.rounding_rule, row.updated_at,
  ];
  if (requiredStrings.some((field) => typeof field !== "string" || !field.trim())) return null;
  if (
    !row.id ||
    !row.workspace_id ||
    !row.standard_order_id ||
    !row.source_preset_version ||
    !row.category_group ||
    !row.category_label ||
    !row.standard_order_name ||
    !row.in_hospital_order_name ||
    !row.billing_name ||
    !row.availability_status ||
    (row.price_krw !== null && (typeof row.price_krw !== "number" || !Number.isFinite(row.price_krw))) ||
    !row.sales_unit ||
    !row.default_destination_module ||
    typeof row.default_task_required !== "boolean" ||
    typeof row.billing_reflection_enabled !== "boolean" ||
    typeof row.tax_included !== "boolean" ||
    !row.rounding_rule ||
    !row.updated_at
  ) {
    return null;
  }

  const pricingRule = mapOrderPricingRule(row);
  const planOrderAuthority = parsePlanOrderAuthority(
    isRecord(row.default_detail_inputs)
      ? row.default_detail_inputs.planOrderAuthority
      : undefined,
  );
  if (!planOrderAuthority.valid) return null;
  const executionContract = resolveClinicalOrderMasterContract({
    categoryGroup: row.category_group as ServiceItemType,
    clinicalOrderType: row.clinical_order_type,
    isExternalLab: row.is_external_lab,
    destinationModule: row.destination_module,
    defaultDestinationModule: row.default_destination_module,
    executionMode: row.execution_mode,
    defaultTaskRequired: row.default_task_required,
    detailSchemaVersion: row.detail_schema_version,
    detailFieldSchema: row.detail_field_schema,
    billingEligible: row.billing_eligible,
    billingReflectionEnabled: row.billing_reflection_enabled,
  });
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    taxonomyMergeConflict,
    executionSourceBaseline,
    executionMergeConflicts,
    standardOrderId: row.standard_order_id,
    sourcePresetVersion: row.source_preset_version,
    initialImportedPresetVersion:
      row.initial_imported_preset_version ?? undefined,
    lastAutoMergedPresetVersion:
      row.last_auto_merged_preset_version ?? undefined,
    customizationState: isCustomizationState(row.customization_state)
      ? row.customization_state
      : "detached",
    customizedFields: row.customized_fields ?? [],
    lastCustomizedAt: row.last_customized_at ?? undefined,
    lastCustomizedByUserId: row.last_customized_by_user_id ?? undefined,
    presetMergeStatus: isPresetMergeStatus(row.preset_merge_status)
      ? row.preset_merge_status
      : "detached",
    originType:
      row.origin_type === "clair_master" || row.origin_type === "workspace_custom"
        ? row.origin_type
        : "workspace_custom",
    sourceMasterRecordId: row.source_master_record_id ?? undefined,
    sourceMasterRevision: row.source_master_revision ?? undefined,
    initialImportedRevision: row.initial_imported_revision ?? undefined,
    lastAutoMergedRevision: row.last_auto_merged_revision ?? undefined,
    classificationPathId: row.classification_path_id ?? undefined,
    classificationPath,
    clinicalOrderTypeSource: row.clinical_order_type ? "persisted" : "derived",
    catalogRevision: row.catalog_revision ?? 1,
    sourceProjectionFingerprint: row.source_projection_fingerprint ?? undefined,
    dispensingLineage: mapDispensingOrderLineageSnapshot({
      schemaVersion: 1,
      sourceDispensingProfileId: row.source_dispensing_profile_id,
      sourceDispensingProfileRevision: row.source_dispensing_profile_revision,
      sourceMedicationProductId: row.source_medication_product_id,
      sourceMedicationProductRevision: row.source_medication_product_revision,
      sourceClinicalReviewId: row.source_clinical_review_id,
      sourceEvidenceFingerprint: row.source_evidence_fingerprint,
      clinicalUseAllowed: row.clinical_use_allowed,
      serviceReviewOnly: row.service_review_only,
      serviceReviewReleaseId: row.service_review_release_id,
      dispensingProfileSnapshot: row.dispensing_profile_snapshot,
      dispensingProfileSnapshotSha256: row.dispensing_profile_snapshot_sha256,
    }),
    ...copyOrderTaxonomy({ adminSubcategoryCode: row.admin_subcategory_code, labFamilyCode: row.lab_family_code }),
    clinicalOrderType: executionContract.clinicalOrderType,
    isExternalLab: executionContract.isExternalLab,
    destinationModule: executionContract.destinationModule,
    executionMode: executionContract.executionMode,
    detailSchemaVersion: executionContract.detailSchemaVersion,
    detailFieldSchema: executionContract.detailFieldSchema,
    billingEligible: executionContract.billingEligible,
    workspaceDispensingReview: mapWorkspaceDispensingReview(row),
    categoryGroup: row.category_group as ServiceItemType,
    categoryLabel: row.category_label,
    tCode: row.t_code ?? undefined,
    tCodeLabel: row.t_code_label ?? undefined,
    standardOrderName: row.standard_order_name,
    inHospitalOrderName: row.in_hospital_order_name,
    billingName: row.billing_name,
    aliases: row.aliases ?? [],
    availabilityStatus: row.availability_status as OrderCatalogAvailability,
    priceKrw: row.price_krw,
    salesUnit: row.sales_unit as OrderCatalogSalesUnit,
    targetSpecies: readSpeciesList(row.target_species),
    defaultDestinationModule:
      row.default_destination_module as OrderCatalogDestination,
    defaultTaskRequired: row.default_task_required,
    billingReflectionEnabled: row.billing_reflection_enabled,
    careGuide: row.care_guide ?? undefined,
    careGuideDeliveryEnabled: row.care_guide_delivery_enabled ?? false,
    internalInstruction: row.internal_instruction ?? undefined,
    internalInstructionDeliveryEnabled:
      row.internal_instruction_delivery_enabled ?? false,
    taxIncluded: row.tax_included,
    roundingRule: row.rounding_rule as OrderCatalogItem["roundingRule"],
    linkedLabItemIds: [],
    linkedLabCategoryIds: [],
    defaultDetailInputs: isRecord(row.default_detail_inputs)
      ? structuredClone(row.default_detail_inputs)
      : undefined,
    defaultDetailInputPolicies: isRecord(row.default_detail_input_policies)
      ? structuredClone(row.default_detail_input_policies)
      : undefined,
    planOrderAuthority: planOrderAuthority.value,
    executionPresetLineage: mapExecutionPresetLineage({
      sourceExecutionPresetId: row.source_execution_preset_id,
      sourceExecutionPresetRevision: row.source_execution_preset_revision,
      sourceExecutionPresetSha256: row.source_execution_preset_sha256,
    }),
    medicationMetadata: hasObjectKeys(row.medication_metadata)
      ? (row.medication_metadata as MedicationOrderMetadata)
      : undefined,
    vaccineMetadata: hasObjectKeys(row.vaccine_metadata)
      ? (row.vaccine_metadata as VaccineOrderMetadata)
      : undefined,
    pricingRule,
    updatedAt: row.updated_at,
  };
}

function mapOrderPricingRule(row: Partial<OrderCatalogItemDbRow>) {
  const raw =
    row.pricing_rule && typeof row.pricing_rule === "object"
      ? row.pricing_rule
      : {};
  return {
    priceBasis:
      readString(raw.priceBasis ?? raw.price_basis) ??
      ("fixed_order_price" as const),
    priceKrw:
      readNumber(raw.priceKrw ?? raw.price_krw) ??
      (row.price_krw === null ? null : row.price_krw ?? 0),
    salesUnit:
      readString(raw.salesUnit ?? raw.sales_unit) ??
      row.sales_unit ??
      "per_each",
    taxIncluded:
      readBoolean(raw.taxIncluded ?? raw.tax_included) ??
      row.tax_included ??
      true,
    roundingRule:
      readString(raw.roundingRule ?? raw.rounding_rule) ??
      row.rounding_rule ??
      "as_is",
    billingReflectionEnabled:
      readBoolean(
        raw.billingReflectionEnabled ?? raw.billing_reflection_enabled,
      ) ??
      row.billing_reflection_enabled ??
      true,
  } as OrderPricingRule;
}

function mapWorkspaceDispensingReview(
  row: Partial<OrderCatalogItemDbRow>,
): WorkspaceDispensingReview | undefined {
  const status = row.workspace_dispensing_review_status;
  if (
    status !== "not_required" &&
    status !== "pending" &&
    status !== "approved" &&
    status !== "rejected"
  ) {
    return undefined;
  }
  return {
    status,
    revision: row.workspace_dispensing_review_revision ?? 0,
    authoredByUserId:
      row.workspace_dispensing_authored_by_user_id ?? undefined,
    authoredAt: row.workspace_dispensing_authored_at ?? undefined,
    reviewedByUserId:
      row.workspace_dispensing_reviewed_by_user_id ?? undefined,
    reviewedAt: row.workspace_dispensing_reviewed_at ?? undefined,
    reviewNote: row.workspace_dispensing_review_note ?? undefined,
  };
}

function hasObjectKeys(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length > 0,
  );
}

function resolveDefaultDetailInputs(
  item: Pick<OrderCatalogItem, "defaultDetailInputs" | "medicationMetadata">,
) {
  return readPersistedOrderDefaults(item).values;
}

function resolvePlanOrderAuthority(
  item: Pick<OrderCatalogItem, "defaultDetailInputs" | "planOrderAuthority">,
) {
  const source =
    item.planOrderAuthority !== undefined
      ? item.planOrderAuthority
      : isRecord(item.defaultDetailInputs)
        ? item.defaultDetailInputs.planOrderAuthority
        : undefined;
  const parsed = parsePlanOrderAuthority(source);
  if (!parsed.valid) throw new Error("plan_order_authority_invalid");
  return parsed.value;
}

function isCustomizationState(
  value: unknown,
): value is OrderCatalogCustomizationState {
  return (
    value === "unmodified" ||
    value === "customized" ||
    value === "detached"
  );
}

function isPresetMergeStatus(
  value: unknown,
): value is OrderCatalogPresetMergeStatus {
  return (
    value === "current" ||
    value === "update_available" ||
    value === "conflict" ||
    value === "deprecated_source" ||
    value === "detached"
  );
}

export function createDemoOrderCatalogPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

export function resolveOrderCatalogAdminCapabilities(
  permissionAdapter: WorkspacePermissionAdapter,
  actorUserId: string | null,
  workspaceId: string,
): OrderCatalogAdminCapabilities {
  const context = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });
  if (!context.allowed) {
    return {
      canManageCatalog: false,
      canAuthorDispensing: false,
      canApproveDispensing: false,
    };
  }
  const canManageCatalog = context.effectivePermissionIds.includes(
    "service_catalog:manage",
  );
  const veterinarian =
    context.assignedRoles.includes("vet") ||
    context.jobPosition?.key === "veterinarian";
  return {
    canManageCatalog,
    canAuthorDispensing: canManageCatalog || veterinarian,
    canApproveDispensing: veterinarian,
  };
}

function requirePermission(
  permissionAdapter: WorkspacePermissionAdapter,
  actorUserId: string | null,
  workspaceId: string,
  requiredPermission: PermissionId,
) {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission,
  });
  if (permission.allowed) return { allowed: true as const };
  return {
    allowed: false as const,
    denied: {
      ok: false as const,
      status:
        permission.denialReason === "unauthenticated"
          ? (401 as const)
          : (403 as const),
      denialReason: permission.denialReason ?? "permission_missing",
    },
  };
}

async function readCatalogItemBeforeMutation({
  gateway,
  input,
  workspaceId,
}: {
  gateway: OrderCatalogGateway;
  input: OrderCatalogMutationInput;
  workspaceId: string;
}) {
  if (input.action === "create") return { ok: true as const, item: null };
  const current = await gateway.listAdminCatalog({ workspaceId });
  if (!current.ok) return current;
  return {
    ok: true as const,
    item: current.items.find((item) => item.id === input.itemId) ?? null,
  };
}

function isDispensingCatalogMutation(
  input: OrderCatalogMutationInput,
  current: OrderCatalogItem | null,
) {
  const item = input.action === "create" ? input.item : current;
  return (
    item?.categoryGroup === "medication" &&
    (item.defaultDestinationModule === "dispensing" ||
      item.destinationModule === "dispensing")
  );
}

function orderCatalogAuditEventType(input: OrderCatalogMutationInput) {
  if (input.action === "create") return "order_catalog.created" as const;
  if (input.action === "pause") return "order_catalog.paused" as const;
  if (input.action === "review") {
    return input.decision === "approve"
      ? ("order_catalog.review_approved" as const)
      : ("order_catalog.review_rejected" as const);
  }
  return "order_catalog.updated" as const;
}

function orderCatalogChangedFields(input: OrderCatalogMutationInput) {
  if (input.action === "create") return ["*"];
  if (input.action === "pause") return ["availabilityStatus"];
  if (input.action === "review") {
    return ["workspaceDispensingReview", "availabilityStatus"];
  }
  return Object.keys(input.patch).sort();
}

function summarizeCatalogAuditItem(item: OrderCatalogItem) {
  return {
    executionSourceBaseline: item.executionSourceBaseline,
    executionMergeConflicts: item.executionMergeConflicts,
    id: item.id,
    standardOrderId: item.standardOrderId,
    categoryGroup: item.categoryGroup,
    categoryLabel: item.categoryLabel,
    standardOrderName: item.standardOrderName,
    inHospitalOrderName: item.inHospitalOrderName,
    billingName: item.billingName,
    availabilityStatus: item.availabilityStatus,
    priceKrw: item.priceKrw,
    salesUnit: item.salesUnit,
    defaultDestinationModule: item.defaultDestinationModule,
    defaultTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.billingReflectionEnabled,
    defaultDetailInputs: resolveDefaultDetailInputs(item),
    defaultDetailInputPolicies: item.defaultDetailInputPolicies
      ? structuredClone(item.defaultDetailInputPolicies)
      : undefined,
    executionPresetLineage: item.executionPresetLineage
      ? { ...item.executionPresetLineage }
      : undefined,
    workspaceDispensingReview: item.workspaceDispensingReview,
    pricingRule: {
      priceBasis: item.pricingRule.priceBasis,
      priceKrw: item.pricingRule.priceKrw,
      salesUnit: item.pricingRule.salesUnit,
      taxIncluded: item.pricingRule.taxIncluded,
      billingReflectionEnabled: item.pricingRule.billingReflectionEnabled,
    },
    updatedAt: item.updatedAt,
  };
}

function validateOrderItem(item: Partial<OrderCatalogItem>) {
  const valid =
    Boolean(item.standardOrderName?.trim()) &&
    Boolean(item.inHospitalOrderName?.trim()) &&
    Boolean(item.billingName?.trim()) &&
    (typeof item.priceKrw === "number"
      ? item.priceKrw >= 0
      : item.priceKrw === null && item.availabilityStatus === "pending_activation") &&
    item.pricingRule !== undefined &&
    (typeof item.pricingRule.priceKrw === "number"
      ? item.pricingRule.priceKrw >= 0
      : item.pricingRule.priceKrw === null && item.availabilityStatus === "pending_activation");
  return { valid };
}

function copyPresetFields(
  preset: SystemOrderPreset,
): Omit<
  OrderCatalogItem,
  | "id"
  | "workspaceId"
  | "standardOrderId"
  | "sourcePresetVersion"
  | "initialImportedPresetVersion"
  | "lastAutoMergedPresetVersion"
  | "customizationState"
  | "customizedFields"
  | "lastCustomizedAt"
  | "lastCustomizedByUserId"
  | "presetMergeStatus"
  | "updatedAt"
> {
  return {
    categoryGroup: preset.categoryGroup,
    categoryLabel: preset.categoryLabel,
    tCode: preset.tCode,
    tCodeLabel: preset.tCodeLabel,
    standardOrderName: preset.standardOrderName,
    inHospitalOrderName: preset.defaultInHospitalOrderName,
    billingName: preset.defaultBillingName,
    aliases: [...preset.aliases],
    availabilityStatus: preset.defaultAvailabilityStatus,
    priceKrw: preset.defaultPriceKrw,
    salesUnit: preset.salesUnit,
    targetSpecies: [...preset.targetSpecies],
    defaultDestinationModule: preset.defaultDestinationModule,
    defaultTaskRequired: preset.defaultTaskRequired,
    billingReflectionEnabled: preset.billingReflectionEnabled,
    careGuide: preset.careGuide,
    careGuideDeliveryEnabled: preset.careGuideDeliveryEnabled,
    internalInstruction: preset.internalInstruction,
    internalInstructionDeliveryEnabled:
      preset.internalInstructionDeliveryEnabled,
    taxIncluded: preset.taxIncluded,
    roundingRule: preset.roundingRule,
    linkedLabItemIds: [...preset.linkedLabItemIds],
    linkedLabCategoryIds: [...preset.linkedLabCategoryIds],
    defaultDetailInputs:
      preset.defaultDetailInputs !== undefined
        ? structuredClone(preset.defaultDetailInputs)
        : undefined,
    planOrderAuthority:
      preset.planOrderAuthority !== undefined
        ? structuredClone(preset.planOrderAuthority)
        : undefined,
    medicationMetadata: preset.medicationMetadata
      ? { ...preset.medicationMetadata }
      : undefined,
    vaccineMetadata: preset.vaccineMetadata
      ? {
          ...preset.vaccineMetadata,
          vaccineTarget: [...preset.vaccineMetadata.vaccineTarget],
        }
      : undefined,
    pricingRule: { ...preset.pricingRule },
  };
}

function createCatalogItemId({
  preset,
  workspaceId,
}: {
  preset: SystemOrderPreset;
  workspaceId: string;
}) {
  if (workspaceId === "clair-demo" && preset.defaultCatalogItemId)
    return preset.defaultCatalogItemId;
  return `ord-${workspaceId}-${preset.presetId}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
}

function hasSameCatalogFieldValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getCustomizationState(
  item: OrderCatalogItem,
): OrderCatalogCustomizationState {
  if (item.customizationState) return item.customizationState;
  return item.customizedFields && item.customizedFields.length > 0
    ? "customized"
    : "unmodified";
}

function markCatalogItemCustomized(
  item: OrderCatalogItem,
  fieldNames: string[],
  now: string,
  actorUserId?: string,
): OrderCatalogItem {
  const customizedFields = Array.from(
    new Set([...(item.customizedFields ?? []), ...fieldNames]),
  ).filter(Boolean);
  const detached =
    item.customizationState === "detached" ||
    item.presetMergeStatus === "detached";
  return {
    ...item,
    customizationState: detached ? "detached" : "customized",
    customizedFields,
    lastCustomizedAt: now,
    lastCustomizedByUserId: actorUserId,
    presetMergeStatus: detached
      ? "detached"
      : item.presetMergeStatus === "update_available"
        ? "update_available"
        : "current",
  };
}

function cloneItem(item: OrderCatalogItem): OrderCatalogItem {
  return {
    ...item,
    executionSourceBaseline: item.executionSourceBaseline ? structuredClone(item.executionSourceBaseline) : undefined,
    executionMergeConflicts: item.executionMergeConflicts ? structuredClone(item.executionMergeConflicts) : undefined,
    aliases: [...item.aliases],
    targetSpecies: [...item.targetSpecies],
    linkedLabItemIds: [...item.linkedLabItemIds],
    linkedLabCategoryIds: [...item.linkedLabCategoryIds],
    defaultDetailInputs:
      item.defaultDetailInputs !== undefined
        ? structuredClone(item.defaultDetailInputs)
        : undefined,
    defaultDetailInputPolicies: item.defaultDetailInputPolicies
      ? structuredClone(item.defaultDetailInputPolicies)
      : undefined,
    planOrderAuthority:
      item.planOrderAuthority !== undefined
        ? structuredClone(item.planOrderAuthority)
        : undefined,
    executionPresetLineage: item.executionPresetLineage
      ? { ...item.executionPresetLineage }
      : undefined,
    customizedFields: item.customizedFields
      ? [...item.customizedFields]
      : undefined,
    medicationMetadata: item.medicationMetadata
      ? {
          ...item.medicationMetadata,
          defaultDetailInputs: item.medicationMetadata.defaultDetailInputs
            ? structuredClone(item.medicationMetadata.defaultDetailInputs)
            : undefined,
        }
      : undefined,
    workspaceDispensingReview: item.workspaceDispensingReview
      ? { ...item.workspaceDispensingReview }
      : undefined,
    dispensingLineage: item.dispensingLineage
      ? structuredClone(item.dispensingLineage)
      : undefined,
    vaccineMetadata: item.vaccineMetadata
      ? {
          ...item.vaccineMetadata,
          vaccineTarget: [...item.vaccineMetadata.vaccineTarget],
        }
      : undefined,
    pricingRule: { ...item.pricingRule },
  };
}

function createSetSnapshot(set: OrderSet): AppliedOrderSnapshot {
  return {
    sourcePresetId: set.id,
    sourcePresetVersion: set.sourceSetVersion,
    appliedStandardOrderName: set.setName,
    appliedDisplayName: set.setName,
    appliedBillingName: set.billingName,
    appliedPriceKrw:
      set.amountBasis === "set_fixed_price" ? set.setPriceKrw : null,
    appliedSalesUnit: set.salesUnit,
    appliedTaxIncluded: set.amountBasis === "included_order_sum"
      ? true
      : (set.taxType ?? "taxable") === "taxable",
    appliedAmountBasis: set.amountBasis,
    appliedTargetSpecies: [...set.targetSpecies],
    appliedCareGuide: set.careGuide,
    appliedInternalInstruction: set.internalInstruction,
    appliedDestinationModule: "chart_only",
    appliedTaskRequired: false,
    billingReflectionEnabled: set.billingReflectionEnabled,
  };
}

function mockOrderSetRevisionId(orderSetId: string) {
  const hex = Array.from(orderSetId).reduce(
    (hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0),
    0,
  ).toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
}

function mockChartOrderFingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
}

function mapChartSearchRows(
  value: unknown,
  workspaceId: string,
): ChartOrderCatalogSearchRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(mapChartSearchRow);
  if (rows.some((row) => row === null)) return null;
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row || (row.appliedSnapshot.workspaceId !== undefined && row.appliedSnapshot.workspaceId !== workspaceId)) return null;
    const key = `${row.rowType}:${row.rowType === "individual" ? row.workspaceCatalogItemId : row.sourceSetId}`;
    if (keys.has(key)) return null;
    keys.add(key);
  }
  return rows as ChartOrderCatalogSearchRow[];
}

function mapCatalogReadError(error: {
  message?: string;
  code?: string;
}): OrderCatalogReadFailure {
  if (
    error.code === "PGRST301" ||
    error.message === "authentication_required"
  ) {
    return { ok: false, status: 401, error: "catalog_auth_required" };
  }
  if (error.code === "42501" || error.message === "permission_missing") {
    return { ok: false, status: 403, error: "catalog_permission_denied" };
  }
  if (error.message === "catalog_revision_conflict") {
    return { ok: false, status: 409, error: "catalog_revision_conflict" };
  }
  return { ok: false, status: 503, error: "catalog_read_failed" };
}

function mapChartSearchRow(value: unknown): ChartOrderCatalogSearchRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const rowType = readString(row.rowType ?? row.row_type);
  const sourcePresetId = readString(row.sourcePresetId ?? row.source_preset_id);
  const sourcePresetVersion = readString(
    row.sourcePresetVersion ?? row.source_preset_version,
  );
  const displayName = readString(row.displayName ?? row.display_name);
  const billingName = readString(row.billingName ?? row.billing_name);
  const categoryGroup = readString(row.categoryGroup ?? row.category_group);
  const targetSpecies = row.targetSpecies ?? row.target_species;
  if (
    (rowType !== "individual" && rowType !== "set") ||
    !sourcePresetId || !sourcePresetVersion || !displayName ||
    !billingName || !categoryGroup ||
    (rowType === "set" ? categoryGroup !== "set" : !["consultation", "medication", "treatment", "lab", "imaging", "hospitalization", "misc"].includes(categoryGroup)) ||
    !Array.isArray(targetSpecies) || targetSpecies.some(value => typeof value !== "string" || !["dog", "cat", "other"].includes(value)) ||
    new Set(targetSpecies).size !== targetSpecies.length
  ) {
    return null;
  }
  const common = {
    rowType,
    sourcePresetId,
    sourcePresetVersion,
    displayName,
    billingName,
    categoryGroup: categoryGroup as ServiceItemType | "set",
    targetSpecies: targetSpecies as Species[],
  } as const;
  if (rowType === "set") {
    const sourceSetId = readString(row.sourceSetId ?? row.source_set_id);
    const sourceSetRevisionId = readString(
      row.sourceSetRevisionId ?? row.source_set_revision_id,
    );
    const sourceSetRevisionNo = readNumber(
      row.sourceSetRevisionNo ?? row.source_set_revision_no,
    );
    const amountBasis = readString(
      row.sourceSetAmountBasis ?? row.source_set_amount_basis,
    );
    const taxType = readString(row.sourceSetTaxType ?? row.source_set_tax_type);
    const ranges = mapOrderSetRanges(
      row.sourceSetPriceRanges ?? row.source_set_price_ranges,
    );
    const rawRangeBasis = row.sourceSetRangeBasis !== undefined
      ? row.sourceSetRangeBasis
      : row.source_set_range_basis;
    // SQL null means this set has no range pricing; missing/malformed values
    // must not be normalized to that valid, explicit non-range contract.
    const rangeBasis = rawRangeBasis === null ? null : readString(rawRangeBasis);
    const sourceSetAvailabilityStatus = readString(
      row.sourceSetAvailabilityStatus ?? row.source_set_availability_status,
    );
    const sourceSetValidationStatus = readString(
      row.sourceSetValidationStatus ?? row.source_set_validation_status,
    );
    const sourceSetNeedsCompositionReview =
      row.sourceSetNeedsCompositionReview ?? row.source_set_needs_composition_review;
    const sourceSetPriceKrw = readNullableNumber(
      row.sourceSetPriceKrw ?? row.source_set_price_krw,
    );
    const rawPriceRanges = row.sourceSetPriceRanges ?? row.source_set_price_ranges;
    const pendingReviewCount = readNumber(
      row.sourceSetPendingReviewCount ?? row.source_set_pending_review_count,
    ) ?? 0;
    if (
      !sourceSetId || !sourceSetRevisionId || !Number.isInteger(sourceSetRevisionNo) ||
      !isOrderSetAmountBasis(amountBasis) || !isOrderSetTaxType(taxType) ||
      !isOrderSetRangeBasisOrNull(rangeBasis) ||
      sourceSetId !== sourcePresetId ||
      sourceSetAvailabilityStatus !== "active" ||
      sourceSetValidationStatus !== "valid" ||
      sourceSetNeedsCompositionReview !== false ||
      !Array.isArray(rawPriceRanges) ||
      ranges.length !== rawPriceRanges.length ||
      !Number.isInteger(pendingReviewCount) || pendingReviewCount < 0 ||
      (amountBasis === "set_fixed_price" && sourceSetPriceKrw === null) ||
      (amountBasis === "included_order_sum" && sourceSetPriceKrw !== null) ||
      (amountBasis === "included_order_sum" && (taxType !== "derived" || rangeBasis !== null || ranges.length !== 0)) ||
      (amountBasis === "set_fixed_price" && (taxType === "derived" || rangeBasis !== null || ranges.length !== 0)) ||
      (amountBasis === "range_price" && (!isOrderSetRangeBasis(rangeBasis) || taxType === "derived" || sourceSetPriceKrw !== null || ranges.length === 0))
    ) return null;
    const appliedSnapshot: AppliedOrderSnapshot = {
      sourcePresetId,
      sourcePresetVersion,
      appliedDisplayName: displayName,
      appliedBillingName: billingName,
      appliedPriceKrw: sourceSetPriceKrw,
      appliedSalesUnit: "per_each",
      appliedTaxIncluded: taxType === "taxable",
      appliedAmountBasis: amountBasis,
      billingReflectionEnabled: Boolean(
        readBoolean(
          isRecord(row.appliedSnapshot)
            ? row.appliedSnapshot.billingReflectionEnabled
            : isRecord(row.applied_snapshot)
              ? row.applied_snapshot.billingReflectionEnabled
              : undefined,
        ),
      ),
    };
    return {
      ...common,
      appliedSnapshot,
      sourceSetId,
      sourceSetRevisionId,
      sourceSetRevisionNo,
      sourceSetAmountBasis: amountBasis,
      sourceSetPriceKrw,
      sourceSetRangeBasis: rangeBasis,
      sourceSetTaxType: taxType,
      sourceSetAvailabilityStatus,
      sourceSetNeedsCompositionReview: false,
      sourceSetValidationStatus: "valid",
      sourceSetPriceRanges: ranges,
      sourceSetPendingReviewCount: pendingReviewCount,
    };
  }
  const appliedSnapshot = mapAppliedSnapshot(row.appliedSnapshot ?? row.applied_snapshot);
  if (!appliedSnapshot) return null;
  const rawSnapshot = (row.appliedSnapshot ?? row.applied_snapshot) as Record<string, unknown>;
  const snapshotSpecies = rawSnapshot.appliedTargetSpecies ?? rawSnapshot.applied_target_species;
  if (snapshotSpecies !== undefined && (!Array.isArray(snapshotSpecies) ||
    snapshotSpecies.length !== targetSpecies.length ||
    snapshotSpecies.some(value => !targetSpecies.includes(value)) || new Set(snapshotSpecies).size !== snapshotSpecies.length)) return null;
  for (const [camel, snake] of [["sourceMasterRecordId", "source_master_record_id"], ["sourceMasterRevision", "source_master_revision"], ["workspaceCatalogRevision", "workspace_catalog_revision"]] as const) {
    const outer = row[camel] ?? row[snake];
    const inner = rawSnapshot[camel] ?? rawSnapshot[snake];
    if ((outer != null && inner != null && outer !== inner) ||
      [outer, inner].some(value => value != null && (camel === "sourceMasterRecordId" ? !readString(value) : typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0))) return null;
  }
  const rawCatalogItemId = row.workspaceCatalogItemId ?? row.workspace_catalog_item_id;
  const rowCatalogItemId = readString(rawCatalogItemId);
  const workspaceCatalogItemId =
    rowCatalogItemId ?? appliedSnapshot.workspaceCatalogItemId;
  if (
    !workspaceCatalogItemId?.trim() ||
    (rawCatalogItemId != null && !rowCatalogItemId) ||
    (rowCatalogItemId !== undefined &&
      appliedSnapshot.workspaceCatalogItemId !== undefined &&
      rowCatalogItemId !== appliedSnapshot.workspaceCatalogItemId) ||
    sourcePresetId !== appliedSnapshot.sourcePresetId ||
    sourcePresetVersion !== appliedSnapshot.sourcePresetVersion
  )
    return null;
  return {
    ...common,
    appliedSnapshot,
    workspaceCatalogItemId,
    sourceMasterRecordId: readString(
      row.sourceMasterRecordId ?? row.source_master_record_id ?? appliedSnapshot.sourceMasterRecordId,
    ),
    sourceMasterRevision: readNumber(
      row.sourceMasterRevision ?? row.source_master_revision ?? appliedSnapshot.sourceMasterRevision,
    ),
    workspaceCatalogRevision: readNumber(
      row.workspaceCatalogRevision ?? row.workspace_catalog_revision ?? appliedSnapshot.workspaceCatalogRevision,
    ),
    dispensingLineage: appliedSnapshot.dispensingLineage,
    clinicalOrderType: appliedSnapshot.clinicalOrderType,
    destinationModule: appliedSnapshot.destinationModule,
    executionMode: appliedSnapshot.executionMode,
    detailSchemaVersion: appliedSnapshot.detailSchemaVersion,
    billingEligible: appliedSnapshot.billingEligible,
    sourceSetId: null,
    sourceSetRevisionId: null,
    sourceSetRevisionNo: null,
    sourceSetAmountBasis: null,
    sourceSetPriceKrw: null,
    sourceSetRangeBasis: null,
    sourceSetTaxType: null,
    sourceSetAvailabilityStatus: null,
    sourceSetNeedsCompositionReview: null,
    sourceSetValidationStatus: null,
    sourceSetPriceRanges: null,
    sourceSetPendingReviewCount: null,
  };
}

function mapChartOrderSetPreviewRpcError(
  message?: string,
): ChartOrderSetPreviewGatewayResult {
  const error = message ?? "preview_failed";
  if (error.includes("authentication_required")) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  if (error.includes("not_found")) return { ok: false, status: 404, error: "order_set_not_found" };
  if (error.includes("encounter_unavailable")) {
    return { ok: false, status: 409, error: "encounter_unavailable" };
  }
  if (error.includes("revision_conflict") || error.includes("requires_refresh")) {
    return { ok: false, status: 409, error: error.includes("requires_refresh") ? "catalog_revision_requires_refresh" : "revision_conflict" };
  }
  const setErrors = [
    "order_set_composition_review_required",
    "order_set_member_unavailable",
    "order_set_price_unset",
    "order_set_empty_selection",
    "order_set_quantity_invalid",
    "order_set_duplicate_atomic",
    "order_set_depth_exceeded",
    "order_set_cycle_detected",
    "order_set_range_input_required",
    "order_set_range_input_invalid",
    "order_set_range_no_match",
  ];
  const setError = setErrors.find((code) => error.includes(code));
  if (setError) {
    return { ok: false, status: 422, error: setError };
  }
  if (error.includes("permission") || error.includes("membership")) {
    return { ok: false, status: 403, error: error.includes("membership") ? "workspace_membership_missing" : "permission_missing" };
  }
  return { ok: false, status: 500, error: "preview_failed" };
}

function mapChartOrderSetPreview(value: unknown): ChartOrderSetPreview | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.selectionFingerprint !== "string") return null;
  const set = isRecord(value.set) ? value.set : null;
  const pricing = isRecord(value.pricing) ? value.pricing : null;
  if (!set || !pricing || !Array.isArray(value.items)) return null;
  const sourceSetId = readString(set.sourceSetId);
  const sourceSetRevisionId = readString(set.sourceSetRevisionId);
  const sourceSetVersion = readString(set.sourceSetVersion);
  const sourceSetRevisionNo = readNumber(set.sourceSetRevisionNo);
  const amountBasis = readString(set.amountBasis);
  const taxType = readString(set.taxType);
  const priceRanges = set.priceRanges === undefined && amountBasis === "set_fixed_price"
    ? [] : set.priceRanges;
  if (!sourceSetId || !sourceSetRevisionId || !sourceSetVersion ||
      sourceSetRevisionNo === undefined || !isOrderSetAmountBasis(amountBasis) ||
      !isOrderSetTaxType(taxType) || !Array.isArray(priceRanges)) return null;
  const items = value.items.map(mapChartOrderSetPreviewItem).filter(
    (item): item is ChartOrderSetPreviewItem => Boolean(item),
  );
  if (items.length !== value.items.length) return null;
  return {
    schemaVersion: 1,
    operation: value.operation === "draft" || value.operation === "confirm" ? value.operation : "preview",
    set: {
      sourceSetId,
      sourceSetRevisionId,
      sourceSetRevisionNo,
      sourceSetVersion,
      amountBasis,
      setPriceKrw: readNullableNumber(set.setPriceKrw),
      rangeBasis: isOrderSetRangeBasis(set.rangeBasis) ? set.rangeBasis : null,
      taxType,
      priceRanges: mapOrderSetRanges(priceRanges),
      billingReflectionEnabled: readBoolean(set.billingReflectionEnabled) ?? false,
      displayName: readString(set.displayName),
      billingName: readString(set.billingName),
    },
    items,
    pricing: {
      selectedSetInput: readNullableNumber(pricing.selectedSetInput),
      selectedRangeId: readString(pricing.selectedRangeId) ?? null,
      rangeInput: readNullableNumber(pricing.rangeInput),
      childSubtotalKrw: readNumber(pricing.childSubtotalKrw) ?? 0,
      explicitExtraSubtotalKrw: readNumber(pricing.explicitExtraSubtotalKrw) ?? 0,
      finalTotalKrw: readNumber(pricing.finalTotalKrw) ?? 0,
    },
    selectionFingerprint: value.selectionFingerprint,
    calculationInputs: isRecord(value.calculationInputs) ? value.calculationInputs : undefined,
    calculationOutputs: isRecord(value.calculationOutputs) ? value.calculationOutputs : undefined,
  };
}

function mapChartOrderSetPreviewItem(value: unknown): ChartOrderSetPreviewItem | null {
  if (!isRecord(value)) return null;
  const path = Array.isArray(value.path) ? value.path.filter(isRecord).map((entry) => ({
    setId: readString(entry.setId) ?? "",
    revisionId: readString(entry.revisionId) ?? "",
    revisionItemId: readString(entry.revisionItemId) ?? "",
  })) : [];
  const revisionItemId = readString(value.revisionItemId);
  const workspaceCatalogItemId = readString(value.workspaceCatalogItemId);
  const quantitySource = readString(value.quantitySource);
  const taxType = readString(value.taxType);
  if (!revisionItemId || !workspaceCatalogItemId || path.some((entry) => !entry.setId || !entry.revisionId || !entry.revisionItemId) ||
      (value.itemKind !== undefined && value.itemKind !== "atomic") ||
      !isOrderSetQuantitySource(quantitySource) || (taxType !== "taxable" && taxType !== "non_taxable")) return null;
  const quantity = readNumber(value.quantity);
  const defaultQuantity = readNumber(value.defaultQuantity);
  const pinned = readNumber(value.pinnedCompositionCatalogRevision);
  const applied = readNumber(value.appliedCatalogRevision);
  if (quantity === undefined || defaultQuantity === undefined || pinned === undefined || applied === undefined) return null;
  return {
    revisionItemId,
    itemKind: "atomic",
    path,
    rootRevisionItemId: readString(value.rootRevisionItemId),
    directRevisionItemId: readString(value.directRevisionItemId),
    nestedRevisionItemId: value.nestedRevisionItemId === null ? null : readString(value.nestedRevisionItemId),
    leafRevisionItemId: readString(value.leafRevisionItemId),
    workspaceCatalogItemId,
    pinnedCompositionCatalogRevision: pinned,
    appliedCatalogRevision: applied,
    defaultSelected: readBoolean(value.defaultSelected) ?? false,
    selected: readBoolean(value.selected) ?? false,
    defaultQuantity,
    quantity,
    quantitySource,
    billingReflectionEnabled: readBoolean(value.billingReflectionEnabled) ?? false,
    priceKrw: readNullableNumber(value.priceKrw),
    taxType,
    appliedSnapshot: isRecord(value.appliedSnapshot) ? value.appliedSnapshot : undefined,
  };
}

function isOrderSetAmountBasis(value: unknown): value is OrderSetAmountBasis {
  return value === "included_order_sum" || value === "set_fixed_price" || value === "range_price";
}

function isOrderSetRangeBasis(value: unknown): value is OrderSetRangeBasis {
  return value === "patient_weight_kg" || value === "manual_value";
}

function isOrderSetRangeBasisOrNull(value: unknown): value is OrderSetRangeBasis | null {
  return value === null || value === undefined || isOrderSetRangeBasis(value);
}

function isOrderSetTaxType(value: unknown): value is OrderSetTaxType {
  return value === "taxable" || value === "non_taxable" || value === "derived";
}

function isOrderSetQuantitySource(value: unknown): value is ChartOrderSetPreviewItem["quantitySource"] {
  return value === "fixed_one" || value === "preset_quantity" || value === "manual_at_apply";
}

function mapAppliedSnapshot(value: unknown): AppliedOrderSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const executionSourceBaseline = parseExecutionSourceBaseline(row.executionSourceBaseline);
  const executionCustomizedFields = parseExecutionCustomizedFields(row.executionCustomizedFields);
  if (executionSourceBaseline === null || executionCustomizedFields === null) return null;
  if (!isOrderTaxonomyValid(row.clinicalOrderType, row.adminSubcategoryCode, row.labFamilyCode)) return null;
  const sourcePresetId = readString(row.sourcePresetId ?? row.source_preset_id);
  const sourcePresetVersion = readString(
    row.sourcePresetVersion ?? row.source_preset_version,
  );
  const appliedDisplayName = readString(
    row.appliedDisplayName ?? row.applied_display_name,
  );
  const appliedBillingName = readString(
    row.appliedBillingName ?? row.applied_billing_name,
  );
  const appliedPriceKrw = readNumber(
    row.appliedPriceKrw ?? row.applied_price_krw,
  );
  const nullableAppliedPriceKrw =
    row.appliedPriceKrw === null || row.applied_price_krw === null
      ? null
      : appliedPriceKrw;
  const appliedSalesUnit = readString(
    row.appliedSalesUnit ?? row.applied_sales_unit,
  );
  const appliedTaxIncluded = readBoolean(
    row.appliedTaxIncluded ?? row.applied_tax_included,
  );
  const appliedAmountBasis = readString(
    row.appliedAmountBasis ?? row.applied_amount_basis,
  );
  const billingReflectionEnabled = readBoolean(
    row.billingReflectionEnabled ?? row.billing_reflection_enabled,
  );
  const defaultDetailInputs =
    row.defaultDetailInputs ?? row.default_detail_inputs;
  const defaultDetailInputPolicies =
    row.defaultDetailInputPolicies ?? row.default_detail_input_policies;
  const executionPresetLineage =
    row.executionPresetLineage ?? row.execution_preset_lineage;
  const medicationMetadata =
    row.medicationMetadata ?? row.medication_metadata;
  const parsedMedicationMetadata = isRecord(medicationMetadata)
    ? (structuredClone(medicationMetadata) as MedicationOrderMetadata)
    : undefined;
  const parsedDefaults = readPersistedOrderDefaults({
    defaultDetailInputs,
    medicationMetadata: parsedMedicationMetadata,
    defaultDetailInputsSource: row.defaultDetailInputsSource,
  });
  const parsedPlanOrderAuthority = parsePlanOrderAuthority(
    row.planOrderAuthority ??
      row.plan_order_authority ??
      (isRecord(defaultDetailInputs)
        ? defaultDetailInputs.planOrderAuthority
        : undefined),
  );
  if (
    !sourcePresetId ||
    !sourcePresetVersion ||
    !appliedDisplayName ||
    !appliedBillingName ||
    nullableAppliedPriceKrw === undefined ||
    !appliedSalesUnit ||
    typeof appliedTaxIncluded !== "boolean" ||
    !appliedAmountBasis ||
    typeof billingReflectionEnabled !== "boolean" ||
    !parsedPlanOrderAuthority.valid
  ) {
    return null;
  }
  return {
    sourcePresetId,
    sourcePresetVersion,
    ...copyOrderTaxonomy(row as OrderTaxonomyFields),
    workspaceId: readString(row.workspaceId ?? row.workspace_id),
    sourceMasterRecordId: readString(row.sourceMasterRecordId ?? row.source_master_record_id),
    sourceMasterRevision: readNumber(row.sourceMasterRevision ?? row.source_master_revision),
    workspaceCatalogRevision: readNumber(row.workspaceCatalogRevision ?? row.workspace_catalog_revision),
    workspaceCatalogItemId: readString(
      row.workspaceCatalogItemId ?? row.workspace_catalog_item_id,
    ),
    appliedStandardOrderName: readString(
      row.appliedStandardOrderName ?? row.applied_standard_order_name,
    ),
    appliedDisplayName,
    appliedBillingName,
    appliedPriceKrw: nullableAppliedPriceKrw,
    appliedSalesUnit: appliedSalesUnit as OrderCatalogSalesUnit,
    appliedTaxIncluded,
    appliedAmountBasis: appliedAmountBasis as OrderCatalogPriceBasis,
    appliedTargetSpecies: readSpeciesList(
      row.appliedTargetSpecies ?? row.applied_target_species,
    ),
    appliedCareGuide: readString(row.appliedCareGuide ?? row.applied_care_guide),
    appliedInternalInstruction: readString(
      row.appliedInternalInstruction ?? row.applied_internal_instruction,
    ),
    appliedDestinationModule: readString(
      row.appliedDestinationModule ?? row.applied_destination_module,
    ) as OrderCatalogDestination | undefined,
    appliedTaskRequired: readBoolean(
      row.appliedTaskRequired ?? row.applied_task_required,
    ),
    billingReflectionEnabled,
    clinicalOrderType: isClinicalOrderType(
      row.clinicalOrderType ?? row.clinical_order_type,
    )
      ? (row.clinicalOrderType ?? row.clinical_order_type) as ClinicalOrderType
      : undefined,
    destinationModule:
      row.destinationModule === null || row.destination_module === null
        ? null
        : readString(row.destinationModule ?? row.destination_module) as
            ClinicalOrderDestinationModule | undefined,
    executionMode:
      row.executionMode === "routed" || row.execution_mode === "routed"
        ? "routed"
        : row.executionMode === "immediate_complete" ||
            row.execution_mode === "immediate_complete"
          ? "immediate_complete"
          : undefined,
    detailSchemaVersion: readNumber(
      row.detailSchemaVersion ?? row.detail_schema_version,
    ),
    billingEligible: readBoolean(
      row.billingEligible ?? row.billing_eligible,
    ),
    defaultDetailInputs: parsedDefaults.values,
    defaultDetailInputsSource: row.defaultDetailInputsSource === "legacy_medication_metadata"
      ? "legacy_medication_metadata"
      : parsedDefaults.source,
    defaultDetailInputPolicies: isRecord(defaultDetailInputPolicies)
      ? structuredClone(defaultDetailInputPolicies)
      : undefined,
    planOrderAuthority: parsedPlanOrderAuthority.value,
    executionPresetLineage: mapExecutionPresetLineage(executionPresetLineage),
    executionSourceBaseline,
    executionCustomizedFields,
    medicationMetadata: parsedMedicationMetadata,
    dispensingLineage: mapDispensingOrderLineageSnapshot(
      row.dispensingLineage ?? row.dispensing_lineage,
    ),
    workspaceDispensingReview: mapWorkspaceDispensingReviewValue(
      row.workspaceDispensingReview ?? row.workspace_dispensing_review,
    ),
  };
}

function mapExecutionPresetLineage(
  value: unknown,
): ExecutionPresetLineageSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const sourceExecutionPresetId = readString(
    value.sourceExecutionPresetId ?? value.source_execution_preset_id,
  );
  const sourceExecutionPresetRevision = readNumber(
    value.sourceExecutionPresetRevision ??
      value.source_execution_preset_revision,
  );
  const sourceExecutionPresetSha256 = readString(
    value.sourceExecutionPresetSha256 ?? value.source_execution_preset_sha256,
  );
  if (
    !sourceExecutionPresetId ||
    !sourceExecutionPresetRevision ||
    !sourceExecutionPresetSha256
  ) {
    return undefined;
  }
  return {
    sourceExecutionPresetId,
    sourceExecutionPresetRevision,
    sourceExecutionPresetSha256,
  };
}

function mapWorkspaceDispensingReviewValue(
  value: unknown,
): WorkspaceDispensingReview | undefined {
  if (!isRecord(value)) return undefined;
  const status = readString(value.status);
  if (
    status !== "not_required" &&
    status !== "pending" &&
    status !== "approved" &&
    status !== "rejected"
  ) {
    return undefined;
  }
  return {
    status,
    revision: readNumber(value.revision) ?? 0,
    authoredByUserId: readString(
      value.authoredByUserId ?? value.authored_by_user_id,
    ),
    authoredAt: readString(value.authoredAt ?? value.authored_at),
    reviewedByUserId: readString(
      value.reviewedByUserId ?? value.reviewed_by_user_id,
    ),
    reviewedAt: readString(value.reviewedAt ?? value.reviewed_at),
    reviewNote: readString(value.reviewNote ?? value.review_note),
  };
}

export function mapDispensingOrderLineageSnapshot(
  value: unknown,
): DispensingOrderLineageSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const schemaVersion = readNumber(row.schemaVersion ?? row.schema_version);
  const sourceDispensingProfileId = readString(
    row.sourceDispensingProfileId ?? row.source_dispensing_profile_id,
  );
  const sourceDispensingProfileRevision = readNumber(
    row.sourceDispensingProfileRevision ?? row.source_dispensing_profile_revision,
  );
  const sourceMedicationProductId = readString(
    row.sourceMedicationProductId ?? row.source_medication_product_id,
  );
  const sourceMedicationProductRevision = readNumber(
    row.sourceMedicationProductRevision ?? row.source_medication_product_revision,
  );
  const sourceClinicalReviewId = readString(
    row.sourceClinicalReviewId ?? row.source_clinical_review_id,
  ) ?? null;
  const sourceEvidenceFingerprint = readString(
    row.sourceEvidenceFingerprint ?? row.source_evidence_fingerprint,
  );
  const clinicalUseAllowed = readBoolean(
    row.clinicalUseAllowed ?? row.clinical_use_allowed,
  );
  const serviceReviewOnly = readBoolean(
    row.serviceReviewOnly ?? row.service_review_only,
  );
  const serviceReviewReleaseId = readString(
    row.serviceReviewReleaseId ?? row.service_review_release_id,
  );
  const dispensingProfileSnapshot =
    row.dispensingProfileSnapshot ?? row.dispensing_profile_snapshot;
  const dispensingProfileSnapshotSha256 = readString(
    row.dispensingProfileSnapshotSha256 ?? row.dispensing_profile_snapshot_sha256,
  );
  if (
    schemaVersion !== 1 ||
    !sourceDispensingProfileId ||
    !Number.isInteger(sourceDispensingProfileRevision) ||
    Number(sourceDispensingProfileRevision) <= 0 ||
    !sourceMedicationProductId ||
    !Number.isInteger(sourceMedicationProductRevision) ||
    Number(sourceMedicationProductRevision) <= 0 ||
    !sourceEvidenceFingerprint ||
    !/^[0-9a-f]{64}$/.test(sourceEvidenceFingerprint) ||
    typeof clinicalUseAllowed !== "boolean" ||
    (clinicalUseAllowed && !sourceClinicalReviewId) ||
    (serviceReviewOnly === true &&
      (clinicalUseAllowed || !serviceReviewReleaseId)) ||
    (serviceReviewOnly !== true && serviceReviewReleaseId !== undefined) ||
    !dispensingProfileSnapshot ||
    typeof dispensingProfileSnapshot !== "object" ||
    Array.isArray(dispensingProfileSnapshot) ||
    !dispensingProfileSnapshotSha256 ||
    !/^[0-9a-f]{64}$/.test(dispensingProfileSnapshotSha256)
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    sourceDispensingProfileId,
    sourceDispensingProfileRevision: Number(sourceDispensingProfileRevision),
    sourceMedicationProductId,
    sourceMedicationProductRevision: Number(sourceMedicationProductRevision),
    sourceClinicalReviewId,
    sourceEvidenceFingerprint,
    clinicalUseAllowed,
    ...(serviceReviewOnly === true
      ? { serviceReviewOnly: true as const, serviceReviewReleaseId }
      : {}),
    dispensingProfileSnapshot: structuredClone(
      dispensingProfileSnapshot as Record<string, unknown>,
    ),
    dispensingProfileSnapshotSha256,
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return readNumber(value) ?? null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readSpeciesList(value: unknown): Species[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Species =>
    ["dog", "cat", "other"].includes(String(item)),
  );
}

function orderCatalogItemToSystemPreset(
  item: OrderCatalogItem,
): SystemOrderPreset {
  return {
    presetId: item.standardOrderId,
    presetVersion: item.sourcePresetVersion,
    presetStatus: "active",
    defaultCatalogItemId: item.id,
    categoryGroup: item.categoryGroup,
    categoryLabel: item.categoryLabel,
    tCode: item.tCode,
    tCodeLabel: item.tCodeLabel,
    standardOrderName: item.standardOrderName,
    defaultInHospitalOrderName: item.inHospitalOrderName,
    defaultBillingName: item.billingName,
    aliases: [...item.aliases],
    defaultAvailabilityStatus: item.availabilityStatus,
    defaultPriceKrw: item.priceKrw ?? 0,
    salesUnit: item.salesUnit,
    targetSpecies: [...item.targetSpecies],
    defaultDestinationModule: item.defaultDestinationModule,
    defaultTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.billingReflectionEnabled,
    careGuide: item.careGuide,
    careGuideDeliveryEnabled: item.careGuideDeliveryEnabled,
    internalInstruction: item.internalInstruction,
    internalInstructionDeliveryEnabled: item.internalInstructionDeliveryEnabled,
    taxIncluded: item.taxIncluded,
    roundingRule: item.roundingRule,
    linkedLabItemIds: [...item.linkedLabItemIds],
    linkedLabCategoryIds: [...item.linkedLabCategoryIds],
    defaultDetailInputs:
      item.defaultDetailInputs !== undefined
        ? structuredClone(item.defaultDetailInputs)
        : undefined,
    medicationMetadata: item.medicationMetadata
      ? { ...item.medicationMetadata }
      : undefined,
    vaccineMetadata: item.vaccineMetadata
      ? {
          ...item.vaccineMetadata,
          vaccineTarget: [...item.vaccineMetadata.vaccineTarget],
        }
      : undefined,
    pricingRule: { ...item.pricingRule },
  };
}

const baseOrder: Omit<
  OrderCatalogItem,
  | "id"
  | "standardOrderId"
  | "categoryGroup"
  | "categoryLabel"
  | "standardOrderName"
  | "inHospitalOrderName"
  | "billingName"
  | "priceKrw"
  | "defaultDestinationModule"
  | "pricingRule"
> = {
  workspaceId: "clair-demo",
  sourcePresetVersion: "v3",
  aliases: [],
  availabilityStatus: "active",
  salesUnit: "per_each",
  targetSpecies: ["dog", "cat", "other"],
  defaultTaskRequired: true,
  billingReflectionEnabled: true,
  taxIncluded: true,
  roundingRule: "as_is",
  linkedLabItemIds: [],
  linkedLabCategoryIds: [],
  updatedAt: "2026-05-20T00:00:00.000Z",
};

const defaultOrderCatalogItems: OrderCatalogItem[] = [
  {
    ...baseOrder,
    id: "ord-lab-cbc-baso",
    standardOrderId: "std-ord-lab-cbc-baso",
    categoryGroup: "lab",
    categoryLabel: "CBC검사",
    tCode: "T04",
    tCodeLabel: "임상",
    standardOrderName: "[CBC 검사] #BASO",
    inHospitalOrderName: "[CBC 검사] #BASO",
    billingName: "CBC 검사 BASO",
    aliases: ["BASO", "CBC"],
    priceKrw: 12000,
    defaultDestinationModule: "lab",
    linkedLabItemIds: ["labitem-cbc-baso"],
    linkedLabCategoryIds: ["labcat-cbc"],
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 12000,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
  },
  {
    ...baseOrder,
    id: "ord-med-maropitant",
    standardOrderId: "std-ord-med-maropitant",
    categoryGroup: "medication",
    categoryLabel: "처방",
    standardOrderName: "Maropitant 16mg T",
    inHospitalOrderName: "Maropitant 16mg T",
    billingName: "항구토제",
    aliases: ["세레니아", "구토억제"],
    priceKrw: 4500,
    defaultDestinationModule: "dispensing",
    medicationMetadata: {
      schemaVersion: 2,
      presetOrigin: "clair_master",
      presetStatus: "synthetic_unreviewed",
      sourcePrescriptionPresetId: "preset-maropitant-default",
      sourcePrescriptionPresetRevision: 1,
      defaultDetailInputs: {
        doseBasis: "patient",
        dose: 1,
        doseUnit: "tablet",
        route: "PO",
        frequency: "sid",
        durationDays: 3,
        totalQuantity: 3,
        totalQuantityUnit: "tablet",
        medicationInstruction: "after_meal",
        storageMethod: "room_temp",
        compoundNote: "제품명과 함량을 확인한 뒤 총 정수를 계수해 주세요.",
        guardianNote: "식후에 1회 1정씩 하루 1회, 3일간 투여하세요.",
        extraLabelSpeciesConfirmed: false,
      },
      autoDispenseQuantityEnabled: true,
      administrationDays: 3,
      dailyFrequencyCode: "sid",
      frequencyDailyCount: 1,
      doseBasis: "prescribed_quantity",
      doseAmount: 1,
      doseAmountUnit: "T",
      administrationRoute: "PO",
      dispenseUnit: "T",
      dispenseRoundingRule: "ceil_0_5",
      medicationInstruction: "after_meal",
      storageMethod: "room_temp",
      ingredientEnglishName: "Maropitant",
    },
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 4500,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
  },
  {
    ...baseOrder,
    id: "ord-vaccine-cat-core",
    standardOrderId: "std-ord-vaccine-cat-core",
    categoryGroup: "treatment",
    categoryLabel: "예방",
    standardOrderName: "고양이 종합백신",
    inHospitalOrderName: "고양이 종합백신",
    billingName: "고양이 종합백신",
    priceKrw: 45000,
    targetSpecies: ["cat"],
    defaultDestinationModule: "treatment",
    vaccineMetadata: {
      vaccineTarget: ["cat"],
      vaccineClassification: "core",
      doseSequenceEnabled: true,
      doseSequenceLabel: "1차",
      doseSequenceNumber: 1,
    },
    pricingRule: {
      priceBasis: "fixed_order_price",
      priceKrw: 45000,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
  },
  {
    ...baseOrder,
    id: "ord-paused-example",
    standardOrderId: "std-ord-paused-example",
    categoryGroup: "lab",
    categoryLabel: "미사용",
    standardOrderName: "일시중지 예시",
    inHospitalOrderName: "일시중지 예시",
    billingName: "일시중지 예시",
    availabilityStatus: "paused",
    priceKrw: 0,
    defaultDestinationModule: "lab",
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 0,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: false,
    },
  },
];

export const defaultSystemOrderPresets: SystemOrderPreset[] =
  defaultOrderCatalogItems.map(orderCatalogItemToSystemPreset);

const defaultOrderSets: OrderSet[] = [
  {
    id: "set-vomit-basic",
    workspaceId: "clair-demo",
    sourceSetVersion: "v1",
    setCategory: "내복약 조제 세트",
    setName: "구토 기본 세트",
    billingName: "구토 기본 세트",
    availabilityStatus: "active",
    amountBasis: "included_order_sum",
    setPriceKrw: 0,
    salesUnit: "per_each",
    billingReflectionEnabled: true,
    targetSpecies: ["dog", "cat", "other"],
    includedOrders: [
      {
        id: "setitem-vomit-baso",
        childOrderId: "ord-lab-cbc-baso",
        sortOrder: 10,
        defaultSelected: true,
        billingReflectionDefault: true,
        defaultQuantity: 1,
        quantitySource: "fixed_one",
        unitPriceSnapshotKrw: 12000,
      },
      {
        id: "setitem-vomit-maropitant",
        childOrderId: "ord-med-maropitant",
        sortOrder: 20,
        defaultSelected: true,
        billingReflectionDefault: true,
        defaultQuantity: 3,
        quantitySource: "preset_quantity",
        unitPriceSnapshotKrw: 4500,
      },
    ],
  },
];

const defaultLabTestItems: LabTestItem[] = [
  {
    id: "labitem-cbc-baso",
    workspaceId: "clair-demo",
    categoryId: "labcat-cbc",
    name: "BASO",
    resultInputType: "number",
    resultUnit: "%",
    sortOrder: 60,
    availabilityStatus: "active",
    savedResultUsageCount: 2,
  },
];
