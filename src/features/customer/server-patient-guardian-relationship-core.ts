import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockGuardians, mockPatientGuardians, mockPatients } from "@/mocks/emr-domain";
import type { Guardian, Patient, PatientGuardian } from "@/types/emr-domain";

export type CustomerRelationshipActionInput =
  | { action: "link"; patientId: string; guardianId: string; relationship?: string }
  | { action: "set_primary"; patientId: string; guardianId: string }
  | { action: "unlink"; patientId: string; guardianId: string };

export type CustomerRelationshipGateway = {
  updateRelationship(input: {
    actorUserId: string;
    input: CustomerRelationshipActionInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; relationships: PatientGuardian[] }
    | {
        ok: false;
        status: 409;
        denialReason:
          | "duplicate_relationship"
          | "guardian_unavailable"
          | "patient_unavailable"
          | "primary_unlink_blocked"
          | "relationship_unavailable";
      }
    | { ok: false; status: 500; error: "db_write_failed" }
  >;
};

export type SupabaseCustomerRelationshipClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type CustomerRelationshipResult =
  | {
      ok: true;
      status: 200;
      relationships: PatientGuardian[];
      enforcedBy: "customer-patient-guardian-relationship";
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "duplicate_relationship"
        | "guardian_unavailable"
        | "patient_unavailable"
        | "primary_unlink_blocked"
        | "relationship_unavailable";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export async function updateCustomerPatientGuardianRelationship({
  actorUserId,
  gateway = createMockCustomerRelationshipGateway(),
  input,
  permissionAdapter = createDemoCustomerRelationshipPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerRelationshipGateway;
  input: CustomerRelationshipActionInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<CustomerRelationshipResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient_guardian_relationship:manage",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.updateRelationship({
    actorUserId: actorUserId ?? "",
    workspaceId,
    input: normalizeRelationshipInput(input),
  });
  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    relationships: result.relationships,
    enforcedBy: "customer-patient-guardian-relationship",
  };
}

export function createMockCustomerRelationshipGateway(
  dataset: {
    guardians?: Guardian[];
    links?: PatientGuardian[];
    patients?: Patient[];
  } = {},
  now = new Date().toISOString()
): CustomerRelationshipGateway {
  const guardians = dataset.guardians ?? mockGuardians;
  const patients = dataset.patients ?? mockPatients;
  const links = [...(dataset.links ?? mockPatientGuardians)];

  return {
    async updateRelationship({ actorUserId, input, workspaceId }) {
      const patient = patients.find(
        (item) => item.id === input.patientId && item.workspaceId === workspaceId
      );
      if (!patient) return { ok: false, status: 409, denialReason: "patient_unavailable" };

      const guardian = guardians.find(
        (item) => item.id === input.guardianId && item.workspaceId === workspaceId
      );
      if (!guardian) return { ok: false, status: 409, denialReason: "guardian_unavailable" };

      const activeLinks = () =>
        links.filter((link) => link.patientId === input.patientId && !isSoftUnlinked(link));
      const existing = activeLinks().find((link) => link.guardianId === input.guardianId);

      if (input.action === "link") {
        if (existing) return { ok: false, status: 409, denialReason: "duplicate_relationship" };
        links.push({
          id: `relationship-${input.patientId}-${input.guardianId}`,
          patientId: input.patientId,
          guardianId: input.guardianId,
          relationship: input.relationship ?? "additional",
          isPrimary: activeLinks().length === 0,
          canReceiveMessages: true,
          createdAt: now,
        });
      }

      if (input.action === "set_primary") {
        if (!existing) return { ok: false, status: 409, denialReason: "relationship_unavailable" };
        links.forEach((link, index) => {
          if (link.patientId !== input.patientId || isSoftUnlinked(link)) return;
          links[index] = { ...link, isPrimary: link.guardianId === input.guardianId };
        });
      }

      if (input.action === "unlink") {
        if (!existing) return { ok: false, status: 409, denialReason: "relationship_unavailable" };
        if (existing.isPrimary) return { ok: false, status: 409, denialReason: "primary_unlink_blocked" };
        const index = links.findIndex((link) => link.id === existing.id);
        links[index] = { ...existing, relationship: `${existing.relationship ?? "additional"}|unlinked:${now}` };
      }

      void actorUserId;
      return { ok: true, relationships: activeLinks() };
    },
  };
}

export function createSupabaseCustomerRelationshipGateway(
  client: SupabaseCustomerRelationshipClient,
): CustomerRelationshipGateway {
  return {
    async updateRelationship({ input, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_manage_patient_guardian_relationship",
        {
          p_action: input.action,
          p_guardian_id: input.guardianId,
          p_patient_id: input.patientId,
          p_relationship: input.action === "link" ? input.relationship ?? null : null,
          p_workspace_id: workspaceId,
        },
      );

      if (error) {
        const reason = getRelationshipDenialReason(error.message);
        if (reason) return { ok: false, status: 409, denialReason: reason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return { ok: true, relationships: mapRelationshipRows(data) };
    },
  };
}

export function createDemoCustomerRelationshipPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
    ],
  });
}

function normalizeRelationshipInput(input: CustomerRelationshipActionInput): CustomerRelationshipActionInput {
  if (input.action === "link") {
    return {
      action: "link",
      patientId: input.patientId.trim(),
      guardianId: input.guardianId.trim(),
      relationship: input.relationship?.trim() || "additional",
    };
  }

  return {
    action: input.action,
    patientId: input.patientId.trim(),
    guardianId: input.guardianId.trim(),
  };
}

function isSoftUnlinked(link: PatientGuardian) {
  return link.relationship?.includes("|unlinked:") ?? false;
}

function getRelationshipDenialReason(message?: string) {
  const reasons = [
    "duplicate_relationship",
    "guardian_unavailable",
    "patient_unavailable",
    "primary_unlink_blocked",
    "relationship_unavailable",
  ] as const;
  return reasons.find((reason) => message?.includes(reason));
}

function mapRelationshipRows(data: unknown): PatientGuardian[] {
  if (!Array.isArray(data)) return [];
  return data.map((value) => {
    const row = value as Record<string, unknown>;
    return {
      id: typeof row.id === "string" ? row.id : "",
      patientId: typeof row.patient_id === "string" ? row.patient_id : "",
      guardianId: typeof row.guardian_id === "string" ? row.guardian_id : "",
      relationship:
        typeof row.relationship_label === "string"
          ? row.relationship_label
          : typeof row.relationship === "string"
            ? row.relationship
            : undefined,
      isPrimary: row.is_primary === true,
      canReceiveMessages:
        row.message_consent_status === "granted" || row.can_receive_messages === true,
      createdAt:
        typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    };
  });
}
