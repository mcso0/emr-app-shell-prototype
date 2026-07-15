import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const syntheticPassword = process.env.CLAIR_SYNTHETIC_AUTH_PASSWORD;
const allowRemote = process.env.ALLOW_REMOTE_PRIVATE_AVATAR_QA === "1";

if (!supabaseUrl || !publishableKey || !syntheticPassword) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and CLAIR_SYNTHETIC_AUTH_PASSWORD are required.",
  );
}

const hostname = new URL(supabaseUrl).hostname;
if (!allowRemote && hostname !== "127.0.0.1" && hostname !== "localhost") {
  throw new Error(
    "Remote avatar QA is disabled. Set ALLOW_REMOTE_PRIVATE_AVATAR_QA=1 only for the approved synthetic target.",
  );
}

const actor = createClient(supabaseUrl, publishableKey, authOptions());
const peer = createClient(supabaseUrl, publishableKey, authOptions());
const bucketName = "profile-avatars";
const workspaceId = "workspace-clair-cheongdam";
let incomingPath = null;
let finalPath = null;
let originalPointer = null;
let actorUserId = null;
let pointerSwapped = false;

try {
  const actorSession = await signIn(actor, "vet-cheongdam@clair.local");
  await signIn(peer, "tech-cheongdam@clair.local");
  actorUserId = actorSession.user.id;
  incomingPath = `${actorUserId}/incoming/${randomUUID()}`;
  finalPath = `${actorUserId}/avatars/${randomUUID()}.webp`;

  const actorBucket = actor.storage.from(bucketName);
  const peerBucket = peer.storage.from(bucketName);
  const png = await sharp({
    create: {
      width: 300,
      height: 320,
      channels: 3,
      background: "#557799",
    },
  })
    .png()
    .toBuffer();
  const webp = await sharp(png)
    .resize(512, 512, { fit: "cover" })
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

  const ownerQuarantineRead = await actorBucket.download(incomingPath);
  assertNoError(ownerQuarantineRead.error, "owner_quarantine_read_failed");
  const peerQuarantineRead = await peerBucket.download(incomingPath);
  if (!peerQuarantineRead.error) {
    throw new Error("peer_quarantine_read_unexpectedly_succeeded");
  }

  const normalizedUpload = await actorBucket.upload(finalPath, webp, {
    cacheControl: "300",
    contentType: "image/webp",
    upsert: false,
  });
  assertNoError(normalizedUpload.error, "normalized_upload_failed");
  const ownerPrePointerSignedRead = await actorBucket.createSignedUrl(finalPath, 60);
  assertNoError(
    ownerPrePointerSignedRead.error,
    "unpointed_owner_sign_failed",
  );
  const peerPrePointerSignedRead = await peerBucket.createSignedUrl(finalPath, 60);
  if (!peerPrePointerSignedRead.error) {
    throw new Error("unpointed_peer_sign_unexpectedly_succeeded");
  }

  const pointerRead = await actor
    .from("user_profiles")
    .select("avatar_storage_path, avatar_legacy_hidden")
    .eq("user_id", actorUserId)
    .maybeSingle();
  assertNoError(pointerRead.error, "pointer_read_failed");
  originalPointer = pointerRead.data ?? {
    avatar_storage_path: null,
    avatar_legacy_hidden: false,
  };

  const pointerWrite = await actor.rpc("clair_set_my_profile_avatar_state", {
    p_workspace_id: workspaceId,
    p_expected_storage_path: originalPointer.avatar_storage_path,
    p_expected_legacy_hidden: originalPointer.avatar_legacy_hidden,
    p_new_storage_path: finalPath,
    p_new_legacy_hidden: true,
    p_operation: "upload",
  });
  assertNoError(pointerWrite.error, "pointer_write_failed");
  pointerSwapped = true;

  const peerFinalRead = await peerBucket.download(finalPath);
  assertNoError(peerFinalRead.error, "same_workspace_pointer_read_failed");
  const signedRead = await peerBucket.createSignedUrl(finalPath, 60);
  assertNoError(signedRead.error, "same_workspace_sign_failed");
  if (!signedRead.data?.signedUrl) throw new Error("signed_read_url_missing");

  await restorePointer();
  const peerAfterRestore = await peerBucket.createSignedUrl(finalPath, 60);
  if (!peerAfterRestore.error) {
    throw new Error("unpointed_peer_sign_unexpectedly_succeeded");
  }
  const finalRemoval = await actorBucket.remove([finalPath]);
  assertNoError(finalRemoval.error, "final_object_remove_failed");
  finalPath = null;
  const quarantineRemoval = await actorBucket.remove([incomingPath]);
  assertNoError(quarantineRemoval.error, "quarantine_remove_failed");
  incomingPath = null;

  console.log(
    JSON.stringify({
      signedDirectUpload: true,
      quarantineOwnerOnly: true,
      ownerCanFinalizeBeforePointer: true,
      pointerScopedWorkspaceRead: true,
      pointerRestore: true,
      storageApiCleanup: true,
      target: allowRemote ? "approved-remote-synthetic" : "local",
    }),
  );
} finally {
  await restorePointer().catch(() => undefined);
  if (actorUserId) {
    const paths = [incomingPath, finalPath].filter(
      (path) => typeof path === "string",
    );
    if (paths.length > 0) {
      await actor.storage.from(bucketName).remove(paths).catch(() => undefined);
    }
  }
  await Promise.all([
    actor.auth.signOut().catch(() => undefined),
    peer.auth.signOut().catch(() => undefined),
  ]);
}

async function restorePointer() {
  if (!pointerSwapped || !originalPointer || !finalPath) return;
  const restored = await actor.rpc("clair_set_my_profile_avatar_state", {
    p_workspace_id: workspaceId,
    p_expected_storage_path: finalPath,
    p_expected_legacy_hidden: true,
    p_new_storage_path: originalPointer.avatar_storage_path,
    p_new_legacy_hidden: originalPointer.avatar_legacy_hidden,
    p_operation: "restore",
  });
  assertNoError(restored.error, "pointer_restore_failed");
  pointerSwapped = false;
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
