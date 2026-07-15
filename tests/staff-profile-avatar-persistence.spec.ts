import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  discardProfileAvatarUpload,
  finalizeProfileAvatarUpload,
  prepareProfileAvatarUpload,
  removeProfileAvatar,
  type ProfileAvatarGateway,
  type ProfileAvatarPointerState,
} from "../src/features/staff/server-profile-avatar-core";

const actorUserId = "10000000-0000-4000-8000-000000000001";
const uploadId = "20000000-0000-4000-8000-000000000002";
const avatarId = "30000000-0000-4000-8000-000000000003";
const oldAvatarId = "40000000-0000-4000-8000-000000000004";
const workspaceId = "workspace-avatar-qa";

test("prepare derives a private quarantine path from the authenticated user", async () => {
  const gateway = createAvatarGateway();
  const result = await prepareProfileAvatarUpload({
    actorUserId,
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    uploadId,
    workspaceId,
  });

  expect(result).toEqual({
    ok: true,
    status: 200,
    maxBytes: 5 * 1024 * 1024,
    objectPath: `${actorUserId}/incoming/${uploadId}`,
    uploadId,
    uploadToken: "signed-upload-token",
  });
  expect(gateway.calls.preparedPaths).toEqual([
    `${actorUserId}/incoming/${uploadId}`,
  ]);
});

test("prepare blocks inactive and cross-workspace actors before Storage", async () => {
  for (const permissionAdapter of [
    createPermissionAdapter("inactive"),
    createPermissionAdapter("active", "different-workspace"),
  ]) {
    const gateway = createAvatarGateway();
    const result = await prepareProfileAvatarUpload({
      actorUserId,
      gateway,
      permissionAdapter,
      uploadId,
      workspaceId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) continue;
    expect(result.status).toBe(403);
    expect(gateway.calls.preparedPaths).toEqual([]);
  }
});

test("finalize validates, normalizes, signs, swaps the pointer, and cleans old objects", async () => {
  const oldStoragePath = `${actorUserId}/avatars/${oldAvatarId}.webp`;
  const sourceBytes = await createValidPng();
  const gateway = createAvatarGateway({
    download: { bytes: sourceBytes, contentType: "image/png" },
    pointer: { storagePath: oldStoragePath, legacyHidden: true },
  });
  const result = await finalizeProfileAvatarUpload({
    actorUserId,
    avatarId,
    declaredMime: "image/png",
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    uploadId,
    workspaceId,
  });

  const newStoragePath = `${actorUserId}/avatars/${avatarId}.webp`;
  expect(result).toEqual({
    ok: true,
    status: 200,
    avatarUrl: `https://signed.local/${newStoragePath}`,
    cleanupPending: false,
  });
  expect(gateway.calls.uploads).toHaveLength(1);
  expect(gateway.calls.uploads[0]).toMatchObject({
    contentType: "image/webp",
    path: newStoragePath,
  });
  const normalized = await sharp(gateway.calls.uploads[0].bytes).metadata();
  expect(normalized).toMatchObject({ format: "webp", width: 512, height: 512 });
  expect(gateway.calls.pointerWrites).toEqual([
    {
      expected: { storagePath: oldStoragePath, legacyHidden: true },
      next: { storagePath: newStoragePath, legacyHidden: true },
      operation: "upload",
      workspaceId,
    },
  ]);
  expect(gateway.calls.removals).toEqual([
    [oldStoragePath],
    [`${actorUserId}/incoming/${uploadId}`],
  ]);
});

test("finalize leaves the old pointer authoritative when signed read creation fails", async () => {
  const oldStoragePath = `${actorUserId}/avatars/${oldAvatarId}.webp`;
  const gateway = createAvatarGateway({
    download: { bytes: await createValidPng(), contentType: "image/png" },
    pointer: { storagePath: oldStoragePath, legacyHidden: true },
    signedReadFailure: true,
  });

  const result = await finalizeProfileAvatarUpload({
    actorUserId,
    avatarId,
    declaredMime: "image/png",
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    uploadId,
    workspaceId,
  });

  expect(result).toEqual({
    ok: false,
    status: 500,
    error: "avatar_storage_failed",
  });
  expect(gateway.calls.pointerWrites).toEqual([]);
  expect(gateway.pointer).toEqual({
    storagePath: oldStoragePath,
    legacyHidden: true,
  });
  expect(gateway.calls.removals).toEqual([
    [`${actorUserId}/avatars/${avatarId}.webp`],
    [`${actorUserId}/incoming/${uploadId}`],
  ]);
});

test("finalize rejects malformed input and removes quarantine without changing the pointer", async () => {
  const gateway = createAvatarGateway({
    download: {
      bytes: Buffer.from("not-an-image"),
      contentType: "image/png",
    },
  });
  const result = await finalizeProfileAvatarUpload({
    actorUserId,
    avatarId,
    declaredMime: "image/png",
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    uploadId,
    workspaceId,
  });

  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "unsupported_avatar_type",
  });
  expect(gateway.calls.uploads).toEqual([]);
  expect(gateway.calls.pointerWrites).toEqual([]);
  expect(gateway.calls.removals).toEqual([
    [`${actorUserId}/incoming/${uploadId}`],
  ]);
});

test("discard removes only the authenticated user's derived quarantine object", async () => {
  const gateway = createAvatarGateway();
  const result = await discardProfileAvatarUpload({
    actorUserId,
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    uploadId,
    workspaceId,
  });

  expect(result).toEqual({ ok: true, status: 200, discarded: true });
  expect(gateway.calls.removals).toEqual([
    [`${actorUserId}/incoming/${uploadId}`],
  ]);
});

test("remove restores the pointer and reports failure when object deletion fails", async () => {
  const oldStoragePath = `${actorUserId}/avatars/${oldAvatarId}.webp`;
  const gateway = createAvatarGateway({
    pointer: { storagePath: oldStoragePath, legacyHidden: true },
    removalFailure: true,
  });
  const result = await removeProfileAvatar({
    actorUserId,
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    workspaceId,
  });

  expect(result).toEqual({
    ok: false,
    status: 503,
    error: "avatar_remove_failed",
  });
  expect(gateway.calls.pointerWrites).toEqual([
    {
      expected: { storagePath: oldStoragePath, legacyHidden: true },
      next: { storagePath: null, legacyHidden: true },
      operation: "remove",
      workspaceId,
    },
    {
      expected: { storagePath: null, legacyHidden: true },
      next: { storagePath: oldStoragePath, legacyHidden: true },
      operation: "restore",
      workspaceId,
    },
  ]);
  expect(gateway.pointer).toEqual({
    storagePath: oldStoragePath,
    legacyHidden: true,
  });
});

test("remove hides a legacy-only avatar and returns the initials fallback", async () => {
  const gateway = createAvatarGateway({
    pointer: { storagePath: null, legacyHidden: false },
  });
  const result = await removeProfileAvatar({
    actorUserId,
    gateway,
    permissionAdapter: createPermissionAdapter("active"),
    workspaceId,
  });

  expect(result).toEqual({ ok: true, status: 200, avatarUrl: null });
  expect(gateway.pointer).toEqual({ storagePath: null, legacyHidden: true });
  expect(gateway.calls.removals).toEqual([]);
});

test("private avatar migration keeps bucket, pointer, Storage RLS, CAS, and safe audit together", async () => {
  const source = await readFile(
    "supabase/migrations/20260716020000_private_profile_avatars.sql",
    "utf8",
  );
  const rpcSource = source.slice(
    source.indexOf("create or replace function public.clair_set_my_profile_avatar_state"),
  );

  expect(source).toContain("add column if not exists avatar_storage_path text");
  expect(source).toContain("add column if not exists avatar_legacy_hidden boolean");
  expect(source).toContain("'profile-avatars'");
  expect(source).toMatch(/'profile-avatars'[\s\S]*false[\s\S]*5242880/);
  expect(source).toContain("array['image/jpeg', 'image/png', 'image/webp']");
  expect(source).not.toContain("alter table storage.objects");
  expect(source).toContain("on storage.objects");
  expect(source).toContain("owner_id = (select auth.uid()::text)");
  expect(source).toContain("(storage.foldername(name))[1] = (select auth.uid()::text)");
  expect(source).toContain("target_membership.workspace_id = actor_membership.workspace_id");
  expect(source).toContain("auth.role() in ('authenticated', 'anon')");
  expect(source).toContain(
    "current_setting('clair.avatar_state_rpc', true) is distinct from 'allowed'",
  );
  expect(source).toContain(
    "perform set_config('clair.avatar_state_rpc', 'allowed', true)",
  );
  expect(source).not.toContain("current_user in ('authenticated', 'anon')");
  expect(source).toContain("public.clair_set_my_profile_avatar_state");
  expect(rpcSource).toContain("join public.users actor_user");
  expect(rpcSource).toContain("and actor_user.status = 'active'");
  expect(source).toContain("avatar_state_conflict");
  expect(source).not.toMatch(/p_(target_)?user_id/i);
  expect(source).toContain("user.profile_updated");
  expect(source).toContain(
    "p_metadata => jsonb_build_object('operation', p_operation)",
  );
  const auditMetadataLine = source
    .split("\n")
    .find((line) => line.includes("p_metadata =>"));
  expect(auditMetadataLine).not.toMatch(/avatar_storage_path|signedUrl/i);
  expect(source).toMatch(
    /revoke all on function public\.clair_set_my_profile_avatar_state[\s\S]*from public, anon/,
  );
});

type AvatarGatewayOptions = {
  download?: { bytes: Uint8Array; contentType: string | null };
  pointer?: ProfileAvatarPointerState;
  removalFailure?: boolean;
  signedReadFailure?: boolean;
};

function createAvatarGateway(options: AvatarGatewayOptions = {}) {
  const calls = {
    pointerWrites: [] as Array<{
      expected: ProfileAvatarPointerState;
      next: ProfileAvatarPointerState;
      operation: "remove" | "restore" | "upload";
      workspaceId: string;
    }>,
    preparedPaths: [] as string[],
    removals: [] as string[][],
    uploads: [] as Array<{
      bytes: Uint8Array;
      contentType: "image/webp";
      path: string;
    }>,
  };
  const gateway: ProfileAvatarGateway & {
    calls: typeof calls;
    pointer: ProfileAvatarPointerState;
  } = {
    calls,
    pointer: options.pointer ?? { storagePath: null, legacyHidden: false },
    async createSignedReadUrl(path) {
      if (options.signedReadFailure) {
        return { ok: false, error: "storage_sign_failed" };
      }
      return { ok: true, signedUrl: `https://signed.local/${path}` };
    },
    async createSignedUpload(path) {
      calls.preparedPaths.push(path);
      return { ok: true, uploadToken: "signed-upload-token" };
    },
    async downloadObject() {
      return {
        ok: true,
        ...(options.download ?? {
          bytes: Buffer.from("unused"),
          contentType: "image/png",
        }),
      };
    },
    async readPointer() {
      return { ok: true, pointer: { ...gateway.pointer } };
    },
    async removeObjects(paths) {
      calls.removals.push(paths);
      return options.removalFailure
        ? { ok: false, error: "storage_remove_failed" }
        : { ok: true };
    },
    async uploadNormalized(input) {
      calls.uploads.push(input);
      return { ok: true };
    },
    async writePointer(input) {
      calls.pointerWrites.push(input);
      if (
        gateway.pointer.storagePath !== input.expected.storagePath ||
        gateway.pointer.legacyHidden !== input.expected.legacyHidden
      ) {
        return { ok: false, error: "conflict" };
      }
      gateway.pointer = { ...input.next };
      return { ok: true };
    },
  };
  return gateway;
}

function createPermissionAdapter(
  status: "active" | "inactive",
  memberWorkspaceId = workspaceId,
) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-avatar-qa",
        workspaceId: memberWorkspaceId,
        userId: actorUserId,
        roles: ["front_desk"],
        status,
      },
    ],
  });
}

async function createValidPng() {
  return sharp({
    create: {
      width: 300,
      height: 320,
      channels: 3,
      background: "#557799",
    },
  })
    .png()
    .toBuffer();
}
