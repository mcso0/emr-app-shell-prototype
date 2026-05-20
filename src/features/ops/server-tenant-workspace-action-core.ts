import {
  createSessionWorkspaceInvitation,
  normalizeWorkspaceInviteEmail,
  type SessionWorkspace,
  type SessionWorkspaceInvitation,
} from "@/features/auth/workspace-session";
import {
  getTenantApplicationWorkspaceGate,
  opsWorkspaceCreatedAuditEventType,
  tenantFirstAdminInvitationCreatedAuditEventType,
  type TenantApplication,
  type TenantApplicationAuditHook,
} from "@/features/ops/tenant-application-model";
import { opsTenantApplications } from "@/features/ops/tenant-approval-data";

export type OpsOperatorPermission = "tenant_approval:manage" | "tenant_approval:view";

export type OpsOperator = {
  userId: string;
  status: "active" | "inactive" | "suspended";
  permissions: OpsOperatorPermission[];
};

export type OpsOperatorAdapter = {
  resolveOperator(actorUserId: string): Promise<OpsOperator | null> | OpsOperator | null;
};

export type TenantWorkspaceActionInput = {
  firstAdminEmail: string;
  firstAdminDisplayName: string;
};

export type TenantWorkspaceActionFieldErrors = Partial<
  Record<"firstAdminEmail" | "firstAdminDisplayName", string>
>;

export type TenantWorkspaceActionWrite = {
  applicationId: string;
  workspace: SessionWorkspace;
  firstAdminInvitation: SessionWorkspaceInvitation;
  auditEvents: TenantApplicationAuditHook[];
};

export type OpsTenantApprovalGateway = {
  getTenantApplication(applicationId: string): Promise<TenantApplication | null> | TenantApplication | null;
  createWorkspaceAndFirstAdminInvite(
    write: TenantWorkspaceActionWrite
  ):
    | Promise<
        | { ok: true; tenantApplication: TenantApplication }
        | {
            ok: false;
            status: 409;
            denialReason: "tenant_workspace_exists" | "first_admin_invitation_exists";
          }
        | { ok: false; status: 500; error: "db_write_failed" }
      >
    | (
        | { ok: true; tenantApplication: TenantApplication }
        | {
            ok: false;
            status: 409;
            denialReason: "tenant_workspace_exists" | "first_admin_invitation_exists";
          }
        | { ok: false; status: 500; error: "db_write_failed" }
      );
};

export type TenantWorkspaceActionResult =
  | {
      ok: true;
      status: 201;
      tenantApplication: TenantApplication;
      workspace: SessionWorkspace;
      firstAdminInvitation: SessionWorkspaceInvitation;
      auditEvents: TenantApplicationAuditHook[];
      emailDelivery: "not_sent_approval_gated";
      enforcedBy: "clair-ops-tenant-workspace-action";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: TenantWorkspaceActionFieldErrors }
  | { ok: false; status: 401; denialReason: "unauthenticated" }
  | {
      ok: false;
      status: 403;
      denialReason: "operator_missing" | "operator_inactive" | "operator_permission_missing";
    }
  | {
      ok: false;
      status: 404;
      denialReason: "target_tenant_application_missing";
    }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "tenant_not_approved"
        | "tenant_rejected"
        | "tenant_workspace_exists"
        | "first_admin_invitation_exists";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createApprovedTenantWorkspaceAndFirstAdminInvite({
  actorUserId,
  applicationId,
  input,
  operatorAdapter = createDemoOpsOperatorAdapter(),
  gateway = createDemoOpsTenantApprovalGateway(),
  now = new Date().toISOString(),
}: {
  actorUserId: string | null;
  applicationId: string;
  input: TenantWorkspaceActionInput;
  operatorAdapter?: OpsOperatorAdapter;
  gateway?: OpsTenantApprovalGateway;
  now?: string;
}): Promise<TenantWorkspaceActionResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  const operator = await operatorAdapter.resolveOperator(actorUserId);
  if (!operator) {
    return { ok: false, status: 403, denialReason: "operator_missing" };
  }
  if (operator.status !== "active") {
    return { ok: false, status: 403, denialReason: "operator_inactive" };
  }
  if (!operator.permissions.includes("tenant_approval:manage")) {
    return { ok: false, status: 403, denialReason: "operator_permission_missing" };
  }

  const validation = validateTenantWorkspaceActionInput(input);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const application = await gateway.getTenantApplication(applicationId);
  if (!application) {
    return {
      ok: false,
      status: 404,
      denialReason: "target_tenant_application_missing",
    };
  }

  const gate = getTenantApplicationWorkspaceGate(application);
  if (!gate.canCreateWorkspace) {
    return {
      ok: false,
      status: 409,
      denialReason: gate.reason,
    };
  }

  if (application.firstAdminInvitationId) {
    return { ok: false, status: 409, denialReason: "first_admin_invitation_exists" };
  }

  const workspace = createTenantWorkspace(application, input, actorUserId, now);
  const firstAdminInvitation = createSessionWorkspaceInvitation(
    {
      email: normalizeWorkspaceInviteEmail(input.firstAdminEmail),
      roles: ["hospital_admin"],
      title: "최초 병원관리자",
      department: "병원관리",
    },
    workspace.id,
    { sessionId: actorUserId, storageMode: "cookie" },
    now
  );
  const auditEvents = createTenantWorkspaceActionAuditEvents({
    application,
    workspace,
    firstAdminInvitation,
    actorUserId,
    now,
  });
  const persisted = await gateway.createWorkspaceAndFirstAdminInvite({
    applicationId,
    workspace,
    firstAdminInvitation,
    auditEvents,
  });

  if (!persisted.ok) {
    return persisted.status === 409
      ? { ok: false, status: 409, denialReason: persisted.denialReason }
      : { ok: false, status: 500, error: persisted.error };
  }

  return {
    ok: true,
    status: 201,
    tenantApplication: persisted.tenantApplication,
    workspace,
    firstAdminInvitation,
    auditEvents,
    emailDelivery: "not_sent_approval_gated",
    enforcedBy: "clair-ops-tenant-workspace-action",
  };
}

export function createDemoOpsOperatorAdapter(
  operators: OpsOperator[] = [
    {
      userId: "clair-operator",
      status: "active",
      permissions: ["tenant_approval:manage", "tenant_approval:view"],
    },
    {
      userId: "manual-smoke-operator",
      status: "active",
      permissions: ["tenant_approval:manage", "tenant_approval:view"],
    },
  ]
): OpsOperatorAdapter {
  return {
    resolveOperator(actorUserId) {
      return operators.find((operator) => operator.userId === actorUserId) ?? null;
    },
  };
}

export function createDemoOpsTenantApprovalGateway(
  applications: TenantApplication[] = opsTenantApplications
): OpsTenantApprovalGateway {
  return {
    getTenantApplication(applicationId) {
      return applications.find((application) => application.id === applicationId) ?? null;
    },
    createWorkspaceAndFirstAdminInvite(write) {
      const application = applications.find(
        (item) => item.id === write.applicationId
      );

      if (!application) {
        return { ok: false, status: 500, error: "db_write_failed" };
      }
      if (application.workspaceId) {
        return { ok: false, status: 409, denialReason: "tenant_workspace_exists" };
      }
      if (application.firstAdminInvitationId) {
        return {
          ok: false,
          status: 409,
          denialReason: "first_admin_invitation_exists",
        };
      }

      return {
        ok: true,
        tenantApplication: {
          ...application,
          workspaceId: write.workspace.id,
          firstAdminInvitationId: write.firstAdminInvitation.id,
        },
      };
    },
  };
}

function validateTenantWorkspaceActionInput(input: TenantWorkspaceActionInput) {
  const fieldErrors: TenantWorkspaceActionFieldErrors = {};
  const email = normalizeWorkspaceInviteEmail(input.firstAdminEmail);

  if (!email) {
    fieldErrors.firstAdminEmail = "최초 관리자 이메일을 입력하세요.";
  } else if (!emailPattern.test(email)) {
    fieldErrors.firstAdminEmail = "올바른 이메일 형식으로 입력하세요.";
  }

  if (!input.firstAdminDisplayName.trim()) {
    fieldErrors.firstAdminDisplayName = "최초 관리자 이름을 입력하세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function createTenantWorkspace(
  application: TenantApplication,
  input: TenantWorkspaceActionInput,
  actorUserId: string,
  now: string
): SessionWorkspace {
  return {
    id: createTenantWorkspaceId(application.id),
    displayName: application.hospitalName,
    representativeName: input.firstAdminDisplayName.trim(),
    contactEmail: normalizeWorkspaceInviteEmail(input.firstAdminEmail),
    contactPhone: null,
    subscriptionStatus: "trialing",
    createdBySessionId: actorUserId,
    createdAt: now,
  };
}

function createTenantWorkspaceId(applicationId: string) {
  const suffix = applicationId.replace(/^tenant-app-/, "").replace(/[^a-z0-9-]/gi, "-");
  return `workspace-${suffix || "tenant"}`.toLowerCase();
}

function createTenantWorkspaceActionAuditEvents({
  application,
  workspace,
  firstAdminInvitation,
  actorUserId,
  now,
}: {
  application: TenantApplication;
  workspace: SessionWorkspace;
  firstAdminInvitation: SessionWorkspaceInvitation;
  actorUserId: string;
  now: string;
}): TenantApplicationAuditHook[] {
  return [
    {
      type: opsWorkspaceCreatedAuditEventType,
      tenantApplicationId: application.id,
      operatorUserId: actorUserId,
      reason: "approved_tenant_workspace_creation",
      workspaceId: workspace.id,
      at: now,
    },
    {
      type: tenantFirstAdminInvitationCreatedAuditEventType,
      tenantApplicationId: application.id,
      operatorUserId: actorUserId,
      reason: "first_hospital_admin_invitation",
      workspaceId: workspace.id,
      firstAdminInvitationId: firstAdminInvitation.id,
      at: now,
    },
  ];
}
