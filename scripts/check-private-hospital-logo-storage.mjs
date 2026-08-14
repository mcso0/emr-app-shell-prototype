import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const syntheticPassword = process.env.CLAIR_SYNTHETIC_AUTH_PASSWORD;
const allowRemote = process.env.ALLOW_REMOTE_HOSPITAL_LOGO_QA === "1";

if (!supabaseUrl || !publishableKey || !syntheticPassword) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and CLAIR_SYNTHETIC_AUTH_PASSWORD are required.",
  );
}

const hostname = new URL(supabaseUrl).hostname;
if (!allowRemote && hostname !== "127.0.0.1" && hostname !== "localhost") {
  throw new Error(
    "Remote hospital-logo QA is disabled. Set ALLOW_REMOTE_HOSPITAL_LOGO_QA=1 only for an approved synthetic target.",
  );
}

const actor = createClient(supabaseUrl, publishableKey, authOptions());
const secondAdmin = createClient(supabaseUrl, publishableKey, authOptions());
const member = createClient(supabaseUrl, publishableKey, authOptions());
const bucketName = "hospital-logos";
const workspaceId = "workspace-clair-cheongdam";
let incomingPath = null;
let finalPath = null;
let originalPointer = null;
let currentPointer = null;

try {
  const actorSession = await signIn(actor, "owner@clair.local");
  await signIn(secondAdmin, "manager@clair.local");
  await signIn(member, "vet-cheongdam@clair.local");
  incomingPath = `${workspaceId}/incoming/${actorSession.user.id}/${randomUUID()}`;
  finalPath = `${workspaceId}/logos/${randomUUID()}.webp`;

  const pointerRead = await actor
    .from("workspace_hospital_profiles")
    .select("logo_storage_path, revision")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  assertNoError(pointerRead.error, "pointer_read_failed");
  if (!pointerRead.data || !Number.isSafeInteger(pointerRead.data.revision)) {
    throw new Error("pointer_state_missing");
  }
  originalPointer = {
    storagePath: pointerRead.data.logo_storage_path,
    revision: pointerRead.data.revision,
  };

  const actorBucket = actor.storage.from(bucketName);
  const memberBucket = member.storage.from(bucketName);
  const png = await sharp({
    create: {
      width: 320,
      height: 300,
      channels: 4,
      background: { r: 31, g: 93, b: 184, alpha: 0.9 },
    },
  })
    .png()
    .toBuffer();
  const webp = await sharp(png)
    .rotate()
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 82 })
    .toBuffer();

  const signedUpload = await actorBucket.createSignedUploadUrl(incomingPath);
  assertNoError(signedUpload.error, "signed_upload_prepare_failed");
  if (!signedUpload.data?.token) throw new Error("signed_upload_token_missing");
  const quarantineUpload = await actorBucket.uploadToSignedUrl(
    incomingPath,
    signedUpload.data.token,
    png,
    { cacheControl: "0", contentType: "image/png", upsert: false },
  );
  assertNoError(quarantineUpload.error, "signed_upload_failed");
  assertNoError(
    (await actorBucket.download(incomingPath)).error,
    "admin_quarantine_read_failed",
  );
  if (!(await memberBucket.download(incomingPath)).error) {
    throw new Error("member_quarantine_read_unexpectedly_succeeded");
  }

  const normalizedUpload = await actorBucket.upload(finalPath, webp, {
    cacheControl: "300",
    contentType: "image/webp",
    upsert: false,
  });
  assertNoError(normalizedUpload.error, "normalized_upload_failed");
  assertNoError(
    (await actorBucket.createSignedUrl(finalPath, 60)).error,
    "admin_unpointed_sign_failed",
  );
  if (!(await memberBucket.createSignedUrl(finalPath, 60)).error) {
    throw new Error("member_unpointed_sign_unexpectedly_succeeded");
  }

  const pointerWrite = await actor.rpc(
    "clair_set_workspace_hospital_logo_state",
    {
      p_workspace_id: workspaceId,
      p_expected_revision: originalPointer.revision,
      p_expected_storage_path: originalPointer.storagePath,
      p_new_storage_path: finalPath,
      p_operation: "upload",
      p_request_id: `hospital-logo-local-check-${randomUUID()}`,
    },
  );
  assertNoError(pointerWrite.error, "pointer_write_failed");
  currentPointer = parsePointer(pointerWrite.data);
  assertNoError(
    (await memberBucket.createSignedUrl(finalPath, 60)).error,
    "workspace_member_current_logo_sign_failed",
  );

  await restorePointer();
  if (!(await memberBucket.createSignedUrl(finalPath, 60)).error) {
    throw new Error("member_restored_logo_sign_unexpectedly_succeeded");
  }
  assertNoError(
    (
      await secondAdmin.storage
        .from(bucketName)
        .remove([finalPath])
    ).error,
    "workspace_admin_cross_owner_cleanup_failed",
  );
  finalPath = null;
  assertNoError(
    (await actorBucket.remove([incomingPath])).error,
    "storage_cleanup_failed",
  );
  incomingPath = null;

  console.log(
    JSON.stringify({
      signedDirectUpload: true,
      quarantineAdminOnly: true,
      adminUnpointedFinalizeRead: true,
      workspaceMemberCurrentRead: true,
      pointerRestore: true,
      workspaceAdminCrossOwnerDelete: true,
      storageApiCleanup: true,
      target: allowRemote ? "approved-remote-synthetic" : "local",
    }),
  );
} finally {
  await restorePointer().catch(() => undefined);
  const paths = [incomingPath, finalPath].filter(
    (path) => typeof path === "string",
  );
  if (paths.length > 0) {
    await actor.storage.from(bucketName).remove(paths).catch(() => undefined);
  }
  await Promise.all([
    actor.auth.signOut().catch(() => undefined),
    secondAdmin.auth.signOut().catch(() => undefined),
    member.auth.signOut().catch(() => undefined),
  ]);
}

async function restorePointer() {
  if (!originalPointer || !currentPointer || !finalPath) return;
  const restored = await actor.rpc("clair_set_workspace_hospital_logo_state", {
    p_workspace_id: workspaceId,
    p_expected_revision: currentPointer.revision,
    p_expected_storage_path: finalPath,
    p_new_storage_path: originalPointer.storagePath,
    p_operation: "restore",
    p_request_id: `hospital-logo-local-restore-${randomUUID()}`,
  });
  assertNoError(restored.error, "pointer_restore_failed");
  currentPointer = null;
}

function parsePointer(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !Number.isSafeInteger(value.revision) ||
    typeof value.storagePath !== "string"
  ) {
    throw new Error("pointer_write_result_invalid");
  }
  return {
    storagePath: value.storagePath,
    revision: value.revision,
  };
}

async function signIn(client, email) {
  const result = await client.auth.signInWithPassword({
    email,
    password: syntheticPassword,
  });
  assertNoError(result.error, "synthetic_login_failed");
  if (!result.data.session || !result.data.user) {
    throw new Error("synthetic_session_missing");
  }
  return result.data;
}

function authOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };
}

function assertNoError(error, fallback) {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}
