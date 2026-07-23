import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  MAX_HOSPITAL_LOGO_BYTES,
  normalizeHospitalLogoImage,
  type HospitalLogoImageError,
} from "@/features/hospital-admin/settings/server-hospital-logo-image-core";

export const PRIVATE_HOSPITAL_LOGO_BUCKET = "hospital-logos";
export const HOSPITAL_LOGO_SIGNED_READ_SECONDS = 5 * 60;

export type HospitalLogoPointer = {
  storagePath: string | null;
  revision: number;
};

type HospitalLogoPointerWriteInput = {
  expected: HospitalLogoPointer;
  nextStoragePath: string | null;
  operation: "upload" | "remove" | "restore";
  workspaceId: string;
};

export type HospitalLogoGateway = {
  createSignedReadUrl(
    path: string
  ): Promise<
    | { ok: true; signedUrl: string }
    | { ok: false; error: "storage_sign_failed" }
  >;
  createSignedUpload(
    path: string
  ): Promise<
    | { ok: true; uploadToken: string }
    | { ok: false; error: "storage_sign_failed" }
  >;
  downloadObject(
    path: string
  ): Promise<
    | { ok: true; bytes: Uint8Array; contentType: string | null }
    | { ok: false; error: "storage_download_failed" }
  >;
  readPointer(): Promise<
    | { ok: true; pointer: HospitalLogoPointer }
    | { ok: false; error: "db_read_failed" }
  >;
  removeObjects(
    paths: string[]
  ): Promise<
    | { ok: true }
    | { ok: false; error: "storage_remove_failed" }
  >;
  uploadNormalized(input: {
    bytes: Uint8Array;
    contentType: "image/webp";
    path: string;
  }): Promise<
    | { ok: true }
    | { ok: false; error: "storage_upload_failed" }
  >;
  writePointer(
    input: HospitalLogoPointerWriteInput
  ): Promise<
    | { ok: true; pointer: HospitalLogoPointer }
    | { ok: false; error: "conflict" | "db_write_failed" }
  >;
};

type PermissionFailure = {
  ok: false;
  status: 401 | 403;
  denialReason: WorkspacePermissionDenialReason;
};

export async function prepareHospitalLogoUpload({
  actorUserId,
  gateway,
  permissionAdapter,
  uploadId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway: HospitalLogoGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  uploadId: string;
  workspaceId: string;
}): Promise<
  | {
      ok: true;
      status: 200;
      maxBytes: number;
      objectPath: string;
      uploadId: string;
      uploadToken: string;
    }
  | PermissionFailure
  | { ok: false; status: 500; error: "storage_sign_failed" }
> {
  const permission = authorizeLogoMutation(
    actorUserId,
    permissionAdapter,
    workspaceId
  );
  if (!permission.ok) return permission;
  const path = buildIncomingPath(workspaceId, permission.actorUserId, uploadId);
  if (!path) return { ok: false, status: 500, error: "storage_sign_failed" };
  try {
    const signed = await gateway.createSignedUpload(path);
    return signed.ok
      ? {
          ok: true,
          status: 200,
          maxBytes: MAX_HOSPITAL_LOGO_BYTES,
          objectPath: path,
          uploadId,
          uploadToken: signed.uploadToken,
        }
      : { ok: false, status: 500, error: "storage_sign_failed" };
  } catch {
    return { ok: false, status: 500, error: "storage_sign_failed" };
  }
}

type FinalizeHospitalLogoResult =
  | {
      ok: true;
      status: 200;
      logoUrl: string;
      revision: number;
      cleanupPending: boolean;
    }
  | PermissionFailure
  | {
      ok: false;
      status: 400;
      error: HospitalLogoImageError | "invalid_logo_request";
    }
  | { ok: false; status: 409; error: "hospital_logo_state_conflict" }
  | {
      ok: false;
      status: 500;
      error:
        | "hospital_logo_pointer_read_failed"
        | "hospital_logo_pointer_write_failed"
        | "hospital_logo_storage_failed";
    };

export async function finalizeHospitalLogoUpload({
  actorUserId,
  declaredMime,
  expectedRevision,
  gateway,
  logoId,
  permissionAdapter,
  uploadId,
  workspaceId,
}: {
  actorUserId: string | null;
  declaredMime: string;
  expectedRevision: number;
  gateway: HospitalLogoGateway;
  logoId: string;
  permissionAdapter: WorkspacePermissionAdapter;
  uploadId: string;
  workspaceId: string;
}): Promise<FinalizeHospitalLogoResult> {
  const permission = authorizeLogoMutation(
    actorUserId,
    permissionAdapter,
    workspaceId
  );
  if (!permission.ok) return permission;
  const incomingPath = buildIncomingPath(
    workspaceId,
    permission.actorUserId,
    uploadId
  );
  const finalPath = buildFinalPath(workspaceId, logoId);
  if (
    !incomingPath ||
    !finalPath ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    (declaredMime !== "image/jpeg" && declaredMime !== "image/png")
  ) {
    return { ok: false, status: 400, error: "invalid_logo_request" };
  }

  let response: FinalizeHospitalLogoResult;
  try {
    const downloaded = await gateway.downloadObject(incomingPath);
    if (!downloaded.ok) {
      response = {
        ok: false,
        status: 500,
        error: "hospital_logo_storage_failed",
      };
    } else {
      const normalized = await normalizeHospitalLogoImage({
        bytes: downloaded.bytes,
        declaredMime,
        storedMime: downloaded.contentType,
      });
      if (!normalized.ok) {
        response = { ok: false, status: 400, error: normalized.error };
      } else {
        response = await persistNormalizedLogo({
          expectedRevision,
          finalPath,
          gateway,
          normalized,
          workspaceId,
        });
      }
    }
  } catch {
    response = {
      ok: false,
      status: 500,
      error: "hospital_logo_storage_failed",
    };
  }

  const quarantineCleaned = await safeRemove(gateway, [incomingPath]);
  if (response.ok && !quarantineCleaned) response.cleanupPending = true;
  return response;
}

async function persistNormalizedLogo({
  expectedRevision,
  finalPath,
  gateway,
  normalized,
  workspaceId,
}: {
  expectedRevision: number;
  finalPath: string;
  gateway: HospitalLogoGateway;
  normalized: Extract<
    Awaited<ReturnType<typeof normalizeHospitalLogoImage>>,
    { ok: true }
  >;
  workspaceId: string;
}): Promise<FinalizeHospitalLogoResult> {
  const pointerRead = await gateway.readPointer();
  if (!pointerRead.ok) {
    return {
      ok: false,
      status: 500,
      error: "hospital_logo_pointer_read_failed",
    };
  }
  if (pointerRead.pointer.revision !== expectedRevision) {
    return {
      ok: false,
      status: 409,
      error: "hospital_logo_state_conflict",
    };
  }
  const uploaded = await gateway.uploadNormalized({
    bytes: normalized.bytes,
    contentType: normalized.contentType,
    path: finalPath,
  });
  if (!uploaded.ok) {
    return {
      ok: false,
      status: 500,
      error: "hospital_logo_storage_failed",
    };
  }
  const signed = await gateway.createSignedReadUrl(finalPath);
  if (!signed.ok) {
    await safeRemove(gateway, [finalPath]);
    return {
      ok: false,
      status: 500,
      error: "hospital_logo_storage_failed",
    };
  }
  const pointerWrite = await gateway.writePointer({
    expected: pointerRead.pointer,
    nextStoragePath: finalPath,
    operation: "upload",
    workspaceId,
  });
  if (!pointerWrite.ok) {
    await safeRemove(gateway, [finalPath]);
    return pointerWrite.error === "conflict"
      ? {
          ok: false,
          status: 409,
          error: "hospital_logo_state_conflict",
        }
      : {
          ok: false,
          status: 500,
          error: "hospital_logo_pointer_write_failed",
        };
  }
  const oldPath = pointerRead.pointer.storagePath;
  const oldCleaned =
    !oldPath || oldPath === finalPath
      ? true
      : await safeRemove(gateway, [oldPath]);
  return {
    ok: true,
    status: 200,
    logoUrl: signed.signedUrl,
    revision: pointerWrite.pointer.revision,
    cleanupPending: !oldCleaned,
  };
}

export async function discardHospitalLogoUpload({
  actorUserId,
  gateway,
  permissionAdapter,
  uploadId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway: HospitalLogoGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  uploadId: string;
  workspaceId: string;
}): Promise<
  | { ok: true; status: 200; discarded: true }
  | PermissionFailure
  | { ok: false; status: 400; error: "invalid_logo_request" }
  | { ok: false; status: 500; error: "hospital_logo_storage_failed" }
> {
  const permission = authorizeLogoMutation(
    actorUserId,
    permissionAdapter,
    workspaceId
  );
  if (!permission.ok) return permission;
  const path = buildIncomingPath(
    workspaceId,
    permission.actorUserId,
    uploadId
  );
  if (!path) return { ok: false, status: 400, error: "invalid_logo_request" };
  return (await safeRemove(gateway, [path]))
    ? { ok: true, status: 200, discarded: true }
    : { ok: false, status: 500, error: "hospital_logo_storage_failed" };
}

export async function removeHospitalLogo({
  actorUserId,
  expectedRevision,
  gateway,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  expectedRevision: number;
  gateway: HospitalLogoGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<
  | { ok: true; status: 200; logoUrl: null; revision: number }
  | PermissionFailure
  | { ok: false; status: 409; error: "hospital_logo_state_conflict" }
  | {
      ok: false;
      status: 500 | 503;
      error:
        | "hospital_logo_pointer_read_failed"
        | "hospital_logo_pointer_write_failed"
        | "hospital_logo_remove_failed"
        | "hospital_logo_remove_partial_failure";
    }
> {
  const permission = authorizeLogoMutation(
    actorUserId,
    permissionAdapter,
    workspaceId
  );
  if (!permission.ok) return permission;
  try {
    const pointerRead = await gateway.readPointer();
    if (!pointerRead.ok) {
      return {
        ok: false,
        status: 500,
        error: "hospital_logo_pointer_read_failed",
      };
    }
    if (pointerRead.pointer.revision !== expectedRevision) {
      return {
        ok: false,
        status: 409,
        error: "hospital_logo_state_conflict",
      };
    }
    if (!pointerRead.pointer.storagePath) {
      return {
        ok: true,
        status: 200,
        logoUrl: null,
        revision: pointerRead.pointer.revision,
      };
    }
    const cleared = await gateway.writePointer({
      expected: pointerRead.pointer,
      nextStoragePath: null,
      operation: "remove",
      workspaceId,
    });
    if (!cleared.ok) return mapPointerWriteFailure(cleared.error);
    const removed = await gateway.removeObjects([
      pointerRead.pointer.storagePath,
    ]);
    if (removed.ok) {
      return {
        ok: true,
        status: 200,
        logoUrl: null,
        revision: cleared.pointer.revision,
      };
    }
    const restored = await gateway.writePointer({
      expected: cleared.pointer,
      nextStoragePath: pointerRead.pointer.storagePath,
      operation: "restore",
      workspaceId,
    });
    return restored.ok
      ? {
          ok: false,
          status: 503,
          error: "hospital_logo_remove_failed",
        }
      : {
          ok: false,
          status: 500,
          error: "hospital_logo_remove_partial_failure",
        };
  } catch {
    return {
      ok: false,
      status: 500,
      error: "hospital_logo_remove_partial_failure",
    };
  }
}

function authorizeLogoMutation(
  actorUserId: string | null,
  permissionAdapter: WorkspacePermissionAdapter,
  workspaceId: string
): { ok: true; actorUserId: string } | PermissionFailure {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "hospital_settings:manage",
  });
  if (permission.allowed && actorUserId) {
    return { ok: true, actorUserId };
  }
  return {
    ok: false,
    status: permission.denialReason === "unauthenticated" ? 401 : 403,
    denialReason: permission.denialReason ?? "permission_missing",
  };
}

function buildIncomingPath(
  workspaceId: string,
  actorUserId: string,
  uploadId: string
) {
  return isWorkspaceId(workspaceId) &&
    isUuid(actorUserId) &&
    isUuid(uploadId)
    ? `${workspaceId}/incoming/${actorUserId}/${uploadId}`
    : null;
}

function buildFinalPath(workspaceId: string, logoId: string) {
  return isWorkspaceId(workspaceId) && isUuid(logoId)
    ? `${workspaceId}/logos/${logoId}.webp`
    : null;
}

function isWorkspaceId(value: string) {
  return (
    value.length >= 3 &&
    value.length <= 64 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function safeRemove(gateway: HospitalLogoGateway, paths: string[]) {
  try {
    return (await gateway.removeObjects(paths)).ok;
  } catch {
    return false;
  }
}

function mapPointerWriteFailure(
  error: "conflict" | "db_write_failed"
):
  | { ok: false; status: 409; error: "hospital_logo_state_conflict" }
  | {
      ok: false;
      status: 500;
      error: "hospital_logo_pointer_write_failed";
    } {
  return error === "conflict"
    ? { ok: false, status: 409, error: "hospital_logo_state_conflict" }
    : {
        ok: false,
        status: 500,
        error: "hospital_logo_pointer_write_failed",
      };
}
