import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { createMockWorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import {
  discardHospitalLogoUpload,
  finalizeHospitalLogoUpload,
  prepareHospitalLogoUpload,
  removeHospitalLogo,
  type HospitalLogoGateway,
  type HospitalLogoPointer,
} from "@/features/hospital-admin/settings/server-hospital-logo-core";

const actorUserId = "10000000-0000-4000-8000-000000000001";
const workspaceId = "workspace-logo-qa";
const uploadId = "20000000-0000-4000-8000-000000000002";
const logoId = "30000000-0000-4000-8000-000000000003";

test("hospital logo prepare requires manage permission and derives the quarantine path", async () => {
  const gateway = createLogoGateway();
  const result = await prepareHospitalLogoUpload({
    actorUserId,
    workspaceId,
    uploadId,
    gateway,
    permissionAdapter: permissionAdapter("hospital_admin"),
  });
  expect(result).toEqual({
    ok: true,
    status: 200,
    maxBytes: 5 * 1024 * 1024,
    objectPath: `${workspaceId}/incoming/${actorUserId}/${uploadId}`,
    uploadId,
    uploadToken: "signed-upload-token",
  });

  const deniedGateway = createLogoGateway();
  await expect(
    prepareHospitalLogoUpload({
      actorUserId,
      workspaceId,
      uploadId,
      gateway: deniedGateway,
      permissionAdapter: permissionAdapter("front_desk"),
    })
  ).resolves.toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(deniedGateway.calls.prepared).toEqual([]);
});

test("hospital logo finalize signs before CAS swap and cleans old and quarantine objects", async () => {
  const oldPath = `${workspaceId}/logos/40000000-0000-4000-8000-000000000004.webp`;
  const gateway = createLogoGateway({
    pointer: { storagePath: oldPath, revision: 8 },
    download: {
      bytes: await createValidPng(),
      contentType: "image/png",
    },
  });
  const result = await finalizeHospitalLogoUpload({
    actorUserId,
    workspaceId,
    uploadId,
    logoId,
    declaredMime: "image/png",
    expectedRevision: 8,
    gateway,
    permissionAdapter: permissionAdapter("hospital_admin"),
  });
  const nextPath = `${workspaceId}/logos/${logoId}.webp`;
  expect(result).toEqual({
    ok: true,
    status: 200,
    logoUrl: `https://signed.local/${nextPath}`,
    revision: 9,
    cleanupPending: false,
  });
  expect(gateway.calls.sequence).toEqual([
    "download",
    "read-pointer",
    "upload",
    "sign-read",
    "write-pointer",
    "remove",
    "remove",
  ]);
  expect(gateway.calls.pointerWrites[0]).toEqual({
    expected: { storagePath: oldPath, revision: 8 },
    nextStoragePath: nextPath,
    operation: "upload",
    workspaceId,
  });
});

test("hospital logo finalize keeps the current pointer when signing or CAS fails", async () => {
  const current: HospitalLogoPointer = { storagePath: null, revision: 2 };
  const gateway = createLogoGateway({
    pointer: current,
    download: {
      bytes: await createValidPng(),
      contentType: "image/png",
    },
    pointerConflict: true,
  });
  const result = await finalizeHospitalLogoUpload({
    actorUserId,
    workspaceId,
    uploadId,
    logoId,
    declaredMime: "image/png",
    expectedRevision: 2,
    gateway,
    permissionAdapter: permissionAdapter("hospital_admin"),
  });
  expect(result).toEqual({
    ok: false,
    status: 409,
    error: "hospital_logo_state_conflict",
  });
  expect(gateway.pointer).toEqual(current);
  expect(gateway.calls.removedPaths).toContainEqual([
    `${workspaceId}/logos/${logoId}.webp`,
  ]);
  expect(gateway.calls.removedPaths).toContainEqual([
    `${workspaceId}/incoming/${actorUserId}/${uploadId}`,
  ]);
});

test("hospital logo discard and removal use derived paths and restore pointer on delete failure", async () => {
  const oldPath = `${workspaceId}/logos/40000000-0000-4000-8000-000000000004.webp`;
  const discardGateway = createLogoGateway();
  await expect(
    discardHospitalLogoUpload({
      actorUserId,
      workspaceId,
      uploadId,
      gateway: discardGateway,
      permissionAdapter: permissionAdapter("hospital_admin"),
    })
  ).resolves.toEqual({ ok: true, status: 200, discarded: true });
  expect(discardGateway.calls.removedPaths).toEqual([
    [`${workspaceId}/incoming/${actorUserId}/${uploadId}`],
  ]);

  const removalGateway = createLogoGateway({
    pointer: { storagePath: oldPath, revision: 3 },
    removalFailure: true,
  });
  await expect(
    removeHospitalLogo({
      actorUserId,
      workspaceId,
      expectedRevision: 3,
      gateway: removalGateway,
      permissionAdapter: permissionAdapter("hospital_admin"),
    })
  ).resolves.toEqual({
    ok: false,
    status: 503,
    error: "hospital_logo_remove_failed",
  });
  expect(removalGateway.pointer).toEqual({
    storagePath: oldPath,
    revision: 5,
  });
});

function permissionAdapter(role: "hospital_admin" | "front_desk") {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-logo",
        workspaceId,
        userId: actorUserId,
        roles: [role],
        status: "active",
      },
    ],
  });
}

function createLogoGateway(
  options: {
    pointer?: HospitalLogoPointer;
    download?: { bytes: Uint8Array; contentType: string | null };
    pointerConflict?: boolean;
    removalFailure?: boolean;
  } = {}
) {
  let pointer = options.pointer ?? { storagePath: null, revision: 1 };
  let removalCalls = 0;
  const calls = {
    prepared: [] as string[],
    sequence: [] as string[],
    pointerWrites: [] as Array<{
      expected: HospitalLogoPointer;
      nextStoragePath: string | null;
      operation: "upload" | "remove" | "restore";
      workspaceId: string;
    }>,
    removedPaths: [] as string[][],
  };
  const gateway: HospitalLogoGateway & {
    calls: typeof calls;
    pointer: HospitalLogoPointer;
  } = {
    calls,
    get pointer() {
      return pointer;
    },
    set pointer(value) {
      pointer = value;
    },
    async createSignedUpload(path) {
      calls.prepared.push(path);
      return { ok: true, uploadToken: "signed-upload-token" };
    },
    async createSignedReadUrl(path) {
      calls.sequence.push("sign-read");
      return { ok: true, signedUrl: `https://signed.local/${path}` };
    },
    async downloadObject() {
      calls.sequence.push("download");
      return options.download
        ? { ok: true, ...options.download }
        : { ok: false, error: "storage_download_failed" };
    },
    async readPointer() {
      calls.sequence.push("read-pointer");
      return { ok: true, pointer: { ...pointer } };
    },
    async uploadNormalized() {
      calls.sequence.push("upload");
      return { ok: true };
    },
    async removeObjects(paths) {
      calls.sequence.push("remove");
      calls.removedPaths.push(paths);
      removalCalls += 1;
      return options.removalFailure && removalCalls === 1
        ? { ok: false, error: "storage_remove_failed" }
        : { ok: true };
    },
    async writePointer(input) {
      calls.sequence.push("write-pointer");
      calls.pointerWrites.push(input);
      if (options.pointerConflict) {
        return { ok: false, error: "conflict" };
      }
      if (
        input.expected.storagePath !== pointer.storagePath ||
        input.expected.revision !== pointer.revision
      ) {
        return { ok: false, error: "conflict" };
      }
      pointer = {
        storagePath: input.nextStoragePath,
        revision: pointer.revision + 1,
      };
      return { ok: true, pointer: { ...pointer } };
    },
  };
  return gateway;
}

async function createValidPng() {
  return sharp({
    create: {
      width: 320,
      height: 300,
      channels: 4,
      background: { r: 20, g: 80, b: 180, alpha: 0.8 },
    },
  })
    .png()
    .toBuffer();
}
