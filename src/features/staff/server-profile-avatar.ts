import "server-only";

import {
  PRIVATE_PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_SIGNED_READ_SECONDS,
  type ProfileAvatarGateway,
  type ProfileAvatarPointerState,
} from "./server-profile-avatar-core";

export * from "./server-profile-avatar-core";

type SupabaseError = { code?: string; message?: string } | null;
type SupabaseResult = { data: unknown; error: SupabaseError };

type SupabaseProfileAvatarBucket = {
  createSignedUrl(path: string, expiresIn: number): Promise<SupabaseResult>;
  createSignedUploadUrl(path: string): Promise<SupabaseResult>;
  download(path: string): Promise<SupabaseResult>;
  remove(paths: string[]): Promise<SupabaseResult>;
  upload(
    path: string,
    body: Uint8Array,
    options: {
      cacheControl: string;
      contentType: string;
      upsert: boolean;
    },
  ): Promise<SupabaseResult>;
};

export type SupabaseProfileAvatarClient = {
  storage: {
    from(bucket: string): SupabaseProfileAvatarBucket;
  };
  from(table: "user_profiles"): {
    select(columns: string): {
      eq(column: "user_id", value: string): {
        maybeSingle(): Promise<SupabaseResult>;
      };
    };
  };
  rpc(
    functionName: "clair_set_my_profile_avatar_state",
    args: {
      p_expected_legacy_hidden: boolean;
      p_expected_storage_path: string | null;
      p_new_legacy_hidden: boolean;
      p_new_storage_path: string | null;
      p_operation: "remove" | "restore" | "upload";
      p_workspace_id: string;
    },
  ): Promise<SupabaseResult>;
};

export function createSupabaseProfileAvatarGateway(
  client: SupabaseProfileAvatarClient,
  actorUserId: string,
): ProfileAvatarGateway {
  const bucket = client.storage.from(PRIVATE_PROFILE_AVATAR_BUCKET);

  return {
    async createSignedReadUrl(path) {
      try {
        const { data, error } = await bucket.createSignedUrl(
          path,
          PROFILE_AVATAR_SIGNED_READ_SECONDS,
        );
        const signedUrl = readString(data, "signedUrl");
        return !error && signedUrl
          ? { ok: true, signedUrl }
          : { ok: false, error: "storage_sign_failed" };
      } catch {
        return { ok: false, error: "storage_sign_failed" };
      }
    },
    async createSignedUpload(path) {
      try {
        const { data, error } = await bucket.createSignedUploadUrl(path);
        const uploadToken = readString(data, "token");
        return !error && uploadToken
          ? { ok: true, uploadToken }
          : { ok: false, error: "storage_sign_failed" };
      } catch {
        return { ok: false, error: "storage_sign_failed" };
      }
    },
    async downloadObject(path) {
      try {
        const { data, error } = await bucket.download(path);
        if (error || !(data instanceof Blob)) {
          return { ok: false, error: "storage_download_failed" };
        }
        return {
          ok: true,
          bytes: new Uint8Array(await data.arrayBuffer()),
          contentType: data.type || null,
        };
      } catch {
        return { ok: false, error: "storage_download_failed" };
      }
    },
    async readPointer() {
      try {
        const { data, error } = await client
          .from("user_profiles")
          .select("avatar_storage_path, avatar_legacy_hidden")
          .eq("user_id", actorUserId)
          .maybeSingle();
        if (error) return { ok: false, error: "db_read_failed" };
        if (data === null) {
          return {
            ok: true,
            pointer: { storagePath: null, legacyHidden: false },
          };
        }
        const pointer = parsePointer(data);
        return pointer
          ? { ok: true, pointer }
          : { ok: false, error: "db_read_failed" };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
    async removeObjects(paths) {
      try {
        if (paths.length === 0) return { ok: true };
        const { error } = await bucket.remove(paths);
        return error
          ? { ok: false, error: "storage_remove_failed" }
          : { ok: true };
      } catch {
        return { ok: false, error: "storage_remove_failed" };
      }
    },
    async uploadNormalized({ bytes, contentType, path }) {
      try {
        const { error } = await bucket.upload(path, bytes, {
          cacheControl: "300",
          contentType,
          upsert: false,
        });
        return error
          ? { ok: false, error: "storage_upload_failed" }
          : { ok: true };
      } catch {
        return { ok: false, error: "storage_upload_failed" };
      }
    },
    async writePointer({ expected, next, operation, workspaceId }) {
      try {
        const { error } = await client.rpc(
          "clair_set_my_profile_avatar_state",
          {
            p_expected_legacy_hidden: expected.legacyHidden,
            p_expected_storage_path: expected.storagePath,
            p_new_legacy_hidden: next.legacyHidden,
            p_new_storage_path: next.storagePath,
            p_operation: operation,
            p_workspace_id: workspaceId,
          },
        );
        if (!error) return { ok: true };
        return error.message?.includes("avatar_state_conflict") ||
          error.code === "40001"
          ? { ok: false, error: "conflict" }
          : { ok: false, error: "db_write_failed" };
      } catch {
        return { ok: false, error: "db_write_failed" };
      }
    },
  };
}

function parsePointer(value: unknown): ProfileAvatarPointerState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const storagePath = row.avatar_storage_path;
  const legacyHidden = row.avatar_legacy_hidden;
  if (storagePath !== null && typeof storagePath !== "string") return null;
  if (typeof legacyHidden !== "boolean") return null;
  return { storagePath, legacyHidden };
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate ? candidate : null;
}
