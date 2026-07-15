import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  MAX_PROFILE_AVATAR_BYTES,
  normalizeProfileAvatarImage,
  type ProfileAvatarImageError,
} from "@/features/staff/server-profile-avatar-image-core";

export const PRIVATE_PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_SIGNED_READ_SECONDS = 5 * 60;

export type ProfileAvatarPointerState = {
  legacyHidden: boolean;
  storagePath: string | null;
};

type ProfileAvatarPointerWriteInput = {
  expected: ProfileAvatarPointerState;
  next: ProfileAvatarPointerState;
  operation: "remove" | "restore" | "upload";
  workspaceId: string;
};

export type ProfileAvatarGateway = {
  createSignedReadUrl(
    path: string,
  ): Promise<
    | { ok: true; signedUrl: string }
    | { ok: false; error: "storage_sign_failed" }
  >;
  createSignedUpload(
    path: string,
  ): Promise<
    | { ok: true; uploadToken: string }
    | { ok: false; error: "storage_sign_failed" }
  >;
  downloadObject(
    path: string,
  ): Promise<
    | { ok: true; bytes: Uint8Array; contentType: string | null }
    | { ok: false; error: "storage_download_failed" }
  >;
  readPointer(): Promise<
    | { ok: true; pointer: ProfileAvatarPointerState }
    | { ok: false; error: "db_read_failed" }
  >;
  removeObjects(
    paths: string[],
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
    input: ProfileAvatarPointerWriteInput,
  ): Promise<
    | { ok: true }
    | { ok: false; error: "conflict" | "db_write_failed" }
  >;
};

type PermissionFailure = {
  ok: false;
  status: 401 | 403;
  denialReason: WorkspacePermissionDenialReason;
};

export async function prepareProfileAvatarUpload({
  actorUserId,
  gateway,
  permissionAdapter,
  uploadId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway: ProfileAvatarGateway;
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
  const permission = authorizeAvatarMutation(
    actorUserId,
    permissionAdapter,
    workspaceId,
  );
  if (!permission.ok) return permission;

  const objectPath = buildIncomingPath(permission.actorUserId, uploadId);
  if (!objectPath) return { ok: false, status: 500, error: "storage_sign_failed" };
  try {
    const signed = await gateway.createSignedUpload(objectPath);
    if (!signed.ok) return { ok: false, status: 500, error: signed.error };
    return {
      ok: true,
      status: 200,
      maxBytes: MAX_PROFILE_AVATAR_BYTES,
      objectPath,
      uploadId,
      uploadToken: signed.uploadToken,
    };
  } catch {
    return { ok: false, status: 500, error: "storage_sign_failed" };
  }
}

type FinalizeProfileAvatarResult =
  | {
      ok: true;
      status: 200;
      avatarUrl: string;
      cleanupPending: boolean;
    }
  | PermissionFailure
  | { ok: false; status: 400; error: ProfileAvatarImageError | "invalid_avatar_request" }
  | { ok: false; status: 409; error: "avatar_state_conflict" }
  | {
      ok: false;
      status: 500;
      error:
        | "avatar_pointer_read_failed"
        | "avatar_pointer_write_failed"
        | "avatar_storage_failed";
    };

export async function finalizeProfileAvatarUpload({
  actorUserId,
  avatarId,
  declaredMime,
  gateway,
  permissionAdapter,
  uploadId,
  workspaceId,
}: {
  actorUserId: string | null;
  avatarId: string;
  declaredMime: string;
  gateway: ProfileAvatarGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  uploadId: string;
  workspaceId: string;
}): Promise<FinalizeProfileAvatarResult> {
  const permission = authorizeAvatarMutation(
    actorUserId,
    permissionAdapter,
    workspaceId,
  );
  if (!permission.ok) return permission;
  const incomingPath = buildIncomingPath(permission.actorUserId, uploadId);
  const finalPath = buildFinalPath(permission.actorUserId, avatarId);
  if (!incomingPath || !finalPath || !isSupportedDeclaredMime(declaredMime)) {
    return { ok: false, status: 400, error: "invalid_avatar_request" };
  }

  let response: FinalizeProfileAvatarResult;
  try {
    const downloaded = await gateway.downloadObject(incomingPath);
    if (!downloaded.ok) {
      response = {
        ok: false,
        status: 500,
        error: "avatar_storage_failed",
      };
    } else {
      const normalized = await normalizeProfileAvatarImage({
        bytes: downloaded.bytes,
        declaredMime,
        storedMime: downloaded.contentType,
      });
      if (!normalized.ok) {
        response = { ok: false, status: 400, error: normalized.error };
      } else {
        response = await persistNormalizedAvatar({
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
      error: "avatar_storage_failed",
    };
  }

  const quarantineCleanup = await safeRemove(gateway, [incomingPath]);
  if (response.ok && !quarantineCleanup) response.cleanupPending = true;
  return response;
}

export async function discardProfileAvatarUpload({
  actorUserId,
  gateway,
  permissionAdapter,
  uploadId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway: ProfileAvatarGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  uploadId: string;
  workspaceId: string;
}): Promise<
  | { ok: true; status: 200; discarded: true }
  | PermissionFailure
  | { ok: false; status: 400; error: "invalid_avatar_request" }
  | { ok: false; status: 500; error: "avatar_storage_failed" }
> {
  const permission = authorizeAvatarMutation(
    actorUserId,
    permissionAdapter,
    workspaceId,
  );
  if (!permission.ok) return permission;
  const incomingPath = buildIncomingPath(permission.actorUserId, uploadId);
  if (!incomingPath) {
    return { ok: false, status: 400, error: "invalid_avatar_request" };
  }

  return (await safeRemove(gateway, [incomingPath]))
    ? { ok: true, status: 200, discarded: true }
    : { ok: false, status: 500, error: "avatar_storage_failed" };
}

async function persistNormalizedAvatar({
  finalPath,
  gateway,
  normalized,
  workspaceId,
}: {
  finalPath: string;
  gateway: ProfileAvatarGateway;
  normalized: Extract<
    Awaited<ReturnType<typeof normalizeProfileAvatarImage>>,
    { ok: true }
  >;
  workspaceId: string;
}): Promise<FinalizeProfileAvatarResult> {
  const pointerRead = await gateway.readPointer();
  if (!pointerRead.ok) {
    return {
      ok: false,
      status: 500,
      error: "avatar_pointer_read_failed",
    };
  }
  const upload = await gateway.uploadNormalized({
    bytes: normalized.bytes,
    contentType: normalized.contentType,
    path: finalPath,
  });
  if (!upload.ok) {
    return { ok: false, status: 500, error: "avatar_storage_failed" };
  }
  const signed = await gateway.createSignedReadUrl(finalPath);
  if (!signed.ok) {
    await safeRemove(gateway, [finalPath]);
    return { ok: false, status: 500, error: "avatar_storage_failed" };
  }
  const pointerWrite = await gateway.writePointer({
    expected: pointerRead.pointer,
    next: { storagePath: finalPath, legacyHidden: true },
    operation: "upload",
    workspaceId,
  });
  if (!pointerWrite.ok) {
    await safeRemove(gateway, [finalPath]);
    return pointerWrite.error === "conflict"
      ? { ok: false, status: 409, error: "avatar_state_conflict" }
      : {
          ok: false,
          status: 500,
          error: "avatar_pointer_write_failed",
        };
  }

  const oldStoragePath = pointerRead.pointer.storagePath;
  const oldCleanup =
    !oldStoragePath || oldStoragePath === finalPath
      ? true
      : await safeRemove(gateway, [oldStoragePath]);
  return {
    ok: true,
    status: 200,
    avatarUrl: signed.signedUrl,
    cleanupPending: !oldCleanup,
  };
}

export async function removeProfileAvatar({
  actorUserId,
  gateway,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway: ProfileAvatarGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<
  | { ok: true; status: 200; avatarUrl: null }
  | PermissionFailure
  | { ok: false; status: 409; error: "avatar_state_conflict" }
  | {
      ok: false;
      status: 500 | 503;
      error:
        | "avatar_pointer_read_failed"
        | "avatar_pointer_write_failed"
        | "avatar_remove_failed"
        | "avatar_remove_partial_failure";
    }
> {
  const permission = authorizeAvatarMutation(
    actorUserId,
    permissionAdapter,
    workspaceId,
  );
  if (!permission.ok) return permission;

  try {
    const pointerRead = await gateway.readPointer();
    if (!pointerRead.ok) {
      return {
        ok: false,
        status: 500,
        error: "avatar_pointer_read_failed",
      };
    }
    if (!pointerRead.pointer.storagePath && pointerRead.pointer.legacyHidden) {
      return { ok: true, status: 200, avatarUrl: null };
    }
    const cleared = { storagePath: null, legacyHidden: true } as const;
    const pointerWrite = await gateway.writePointer({
      expected: pointerRead.pointer,
      next: cleared,
      operation: "remove",
      workspaceId,
    });
    if (!pointerWrite.ok) return mapPointerWriteFailure(pointerWrite.error);
    if (!pointerRead.pointer.storagePath) {
      return { ok: true, status: 200, avatarUrl: null };
    }
    const removed = await gateway.removeObjects([
      pointerRead.pointer.storagePath,
    ]);
    if (removed.ok) return { ok: true, status: 200, avatarUrl: null };

    const restored = await gateway.writePointer({
      expected: cleared,
      next: pointerRead.pointer,
      operation: "restore",
      workspaceId,
    });
    return restored.ok
      ? { ok: false, status: 503, error: "avatar_remove_failed" }
      : {
          ok: false,
          status: 500,
          error: "avatar_remove_partial_failure",
        };
  } catch {
    return {
      ok: false,
      status: 500,
      error: "avatar_remove_partial_failure",
    };
  }
}

function authorizeAvatarMutation(
  actorUserId: string | null,
  permissionAdapter: WorkspacePermissionAdapter,
  workspaceId: string,
): { ok: true; actorUserId: string } | PermissionFailure {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });
  if (permission.allowed && actorUserId) return { ok: true, actorUserId };
  return {
    ok: false,
    status: permission.denialReason === "unauthenticated" ? 401 : 403,
    denialReason: permission.denialReason ?? "permission_missing",
  };
}

function buildIncomingPath(userId: string, uploadId: string) {
  return isUuid(userId) && isUuid(uploadId)
    ? `${userId}/incoming/${uploadId}`
    : null;
}

function buildFinalPath(userId: string, avatarId: string) {
  return isUuid(userId) && isUuid(avatarId)
    ? `${userId}/avatars/${avatarId}.webp`
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSupportedDeclaredMime(value: string) {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

async function safeRemove(gateway: ProfileAvatarGateway, paths: string[]) {
  try {
    return (await gateway.removeObjects(paths)).ok;
  } catch {
    return false;
  }
}

function mapPointerWriteFailure(error: "conflict" | "db_write_failed") {
  return error === "conflict"
    ? ({ ok: false, status: 409, error: "avatar_state_conflict" } as const)
    : ({
        ok: false,
        status: 500,
        error: "avatar_pointer_write_failed",
      } as const);
}
