export type TenantApplicationStatus =
  | "pending_review"
  | "on_hold"
  | "approved"
  | "rejected";

export type TenantWorkspaceGateReason =
  | "tenant_not_approved"
  | "tenant_workspace_exists"
  | "tenant_rejected";

export type TenantApplication = {
  id: string;
  hospitalName: string;
  representativeName: string;
  contactEmail: string;
  status: TenantApplicationStatus;
  workspaceId: string | null;
  firstAdminInvitationId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type TenantApplicationAuditEventType =
  | "ops.tenant_application_approved"
  | "ops.tenant_application_rejected"
  | "ops.tenant_application_held"
  | "ops.workspace_created_for_tenant"
  | "ops.first_admin_invitation_created";

export type TenantApplicationAuditHook = {
  type: TenantApplicationAuditEventType;
  tenantApplicationId: string;
  operatorUserId: string;
  previousStatus?: TenantApplicationStatus;
  nextStatus?: TenantApplicationStatus;
  reason: string;
  workspaceId?: string;
  firstAdminInvitationId?: string;
  at: string;
};

export const opsWorkspaceCreatedAuditEventType = "ops.workspace_created_for_tenant";
export const tenantFirstAdminInvitationCreatedAuditEventType =
  "ops.first_admin_invitation_created";

export type TenantApplicationWorkspaceGate =
  | {
      canCreateWorkspace: true;
      reason: null;
      label: "워크스페이스 생성 가능";
    }
  | {
      canCreateWorkspace: false;
      reason: TenantWorkspaceGateReason;
      label: "승인 후 생성 가능" | "워크스페이스 연결됨" | "반려됨";
    };

export const tenantApplicationStatusLabels: Record<TenantApplicationStatus, string> = {
  pending_review: "승인 대기",
  on_hold: "보류",
  approved: "승인됨",
  rejected: "반려됨",
};

const reviewableStatuses = new Set<TenantApplicationStatus>(["pending_review", "on_hold"]);

export function getTenantApplicationWorkspaceGate(
  application: TenantApplication
): TenantApplicationWorkspaceGate {
  if (application.workspaceId) {
    return {
      canCreateWorkspace: false,
      reason: "tenant_workspace_exists",
      label: "워크스페이스 연결됨",
    };
  }

  if (application.status === "rejected") {
    return {
      canCreateWorkspace: false,
      reason: "tenant_rejected",
      label: "반려됨",
    };
  }

  if (application.status !== "approved") {
    return {
      canCreateWorkspace: false,
      reason: "tenant_not_approved",
      label: "승인 후 생성 가능",
    };
  }

  return {
    canCreateWorkspace: true,
    reason: null,
    label: "워크스페이스 생성 가능",
  };
}

export function transitionTenantApplicationStatus(
  application: TenantApplication,
  nextStatus: Extract<TenantApplicationStatus, "approved" | "rejected" | "on_hold">,
  options: {
    operatorUserId: string;
    reason: string;
    at: string;
  }
) {
  if (!reviewableStatuses.has(application.status)) {
    return {
      application,
      auditEvent: createTenantApplicationAuditEvent({
        application,
        nextStatus: application.status,
        type: getAuditEventType(application.status),
        ...options,
      }),
    };
  }

  const nextApplication: TenantApplication = {
    ...application,
    status: nextStatus,
    reviewedAt: options.at,
    reviewNote: options.reason,
  };

  return {
    application: nextApplication,
    auditEvent: createTenantApplicationAuditEvent({
      application,
      nextStatus,
      type: getAuditEventType(nextStatus),
      ...options,
    }),
  };
}

export function markTenantWorkspaceCreated(
  application: TenantApplication,
  input: {
    workspaceId: string;
    firstAdminInvitationId: string;
    operatorUserId?: string;
    at?: string;
  }
) {
  return {
    ...application,
    workspaceId: input.workspaceId,
    firstAdminInvitationId: input.firstAdminInvitationId,
  };
}

export const tenantApplicationAuditHookTypes: TenantApplicationAuditEventType[] = [
  "ops.tenant_application_approved",
  "ops.tenant_application_rejected",
  "ops.tenant_application_held",
  opsWorkspaceCreatedAuditEventType,
  tenantFirstAdminInvitationCreatedAuditEventType,
];

function createTenantApplicationAuditEvent({
  application,
  nextStatus,
  type,
  operatorUserId,
  reason,
  at,
}: {
  application: TenantApplication;
  nextStatus: TenantApplicationStatus;
  type: TenantApplicationAuditEventType;
  operatorUserId: string;
  reason: string;
  at: string;
}): TenantApplicationAuditHook {
  return {
    type,
    tenantApplicationId: application.id,
    operatorUserId,
    previousStatus: application.status,
    nextStatus,
    reason,
    at,
  };
}

function getAuditEventType(status: TenantApplicationStatus): TenantApplicationAuditEventType {
  if (status === "approved") return "ops.tenant_application_approved";
  if (status === "rejected") return "ops.tenant_application_rejected";
  return "ops.tenant_application_held";
}
