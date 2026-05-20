export type TenantOperationalStatus = "trial" | "active" | "suspended" | "archived";

export type TenantOperationalAccessPolicy = {
  workspaceEntry: "allowed" | "blocked";
  firstAdminInvite: "allowed" | "blocked";
  staffInvites: "allowed" | "blocked";
  billingEnforcement: "not_enforced";
};

export type TenantStatusChangedAuditEvent = {
  type: "ops.tenant_status_changed";
  tenantId: string;
  operatorUserId: string;
  previousStatus: TenantOperationalStatus;
  nextStatus: TenantOperationalStatus;
  reason: string;
  at: string;
};

export type TenantOperationalStatusTransitionResult =
  | {
      ok: true;
      tenantStatus: TenantOperationalStatus;
      auditEvent: TenantStatusChangedAuditEvent;
    }
  | {
      ok: false;
      denialReason: "invalid_tenant_status_transition" | "tenant_status_unchanged";
      previousStatus: TenantOperationalStatus;
      nextStatus: TenantOperationalStatus;
    };

const allowedTransitions: Record<TenantOperationalStatus, TenantOperationalStatus[]> = {
  trial: ["active", "suspended", "archived"],
  active: ["suspended", "archived"],
  suspended: ["active", "archived"],
  archived: [],
};

export const tenantOperationalStatusLabels: Record<TenantOperationalStatus, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

export const tenantOperationalStatuses: TenantOperationalStatus[] = [
  "trial",
  "active",
  "suspended",
  "archived",
];

export function getTenantOperationalAccessPolicy(
  status: TenantOperationalStatus
): TenantOperationalAccessPolicy {
  if (status === "trial" || status === "active") {
    return {
      workspaceEntry: "allowed",
      firstAdminInvite: "allowed",
      staffInvites: "allowed",
      billingEnforcement: "not_enforced",
    };
  }

  return {
    workspaceEntry: "blocked",
    firstAdminInvite: "blocked",
    staffInvites: "blocked",
    billingEnforcement: "not_enforced",
  };
}

export function transitionTenantOperationalStatus({
  tenantId,
  previousStatus,
  nextStatus,
  operatorUserId,
  reason,
  at,
}: {
  tenantId: string;
  previousStatus: TenantOperationalStatus;
  nextStatus: TenantOperationalStatus;
  operatorUserId: string;
  reason: string;
  at: string;
}): TenantOperationalStatusTransitionResult {
  if (previousStatus === nextStatus) {
    return {
      ok: false,
      denialReason: "tenant_status_unchanged",
      previousStatus,
      nextStatus,
    };
  }

  if (!allowedTransitions[previousStatus].includes(nextStatus)) {
    return {
      ok: false,
      denialReason: "invalid_tenant_status_transition",
      previousStatus,
      nextStatus,
    };
  }

  return {
    ok: true,
    tenantStatus: nextStatus,
    auditEvent: {
      type: "ops.tenant_status_changed",
      tenantId,
      operatorUserId,
      previousStatus,
      nextStatus,
      reason,
      at,
    },
  };
}
