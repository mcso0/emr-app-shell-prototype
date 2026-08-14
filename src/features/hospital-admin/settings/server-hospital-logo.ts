import "server-only";

import {
  HOSPITAL_LOGO_SIGNED_READ_SECONDS,
  PRIVATE_HOSPITAL_LOGO_BUCKET,
  type HospitalLogoGateway,
  type HospitalLogoPointer,
} from "@/features/hospital-admin/settings/server-hospital-logo-core";

export * from "@/features/hospital-admin/settings/server-hospital-logo-core";

type SupabaseError = { code?: string; message?: string } | null;
type SupabaseResult = { data: unknown; error: SupabaseError };

type SupabaseHospitalLogoBucket = {
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
    }
  ): Promise<SupabaseResult>;
};

export type SupabaseHospitalLogoClient = {
  storage: {
    from(bucket: string): SupabaseHospitalLogoBucket;
  };
  from(table: "workspace_hospital_profiles"): {
    select(columns: string): {
      eq(column: "workspace_id", value: string): {
        maybeSingle(): Promise<SupabaseResult>;
      };
    };
  };
  rpc(
    functionName: "clair_set_workspace_hospital_logo_state",
    args: {
      p_workspace_id: string;
      p_expected_revision: number;
      p_expected_storage_path: string | null;
      p_new_storage_path: string | null;
      p_operation: "upload" | "remove" | "restore";
      p_request_id: string | null;
    }
  ): Promise<SupabaseResult>;
};

export function createSupabaseHospitalLogoGateway(
  client: SupabaseHospitalLogoClient,
  workspaceId: string,
  requestId: string | null
): HospitalLogoGateway {
  const bucket = client.storage.from(PRIVATE_HOSPITAL_LOGO_BUCKET);
  return {
    async createSignedReadUrl(path) {
      try {
        const { data, error } = await bucket.createSignedUrl(
          path,
          HOSPITAL_LOGO_SIGNED_READ_SECONDS
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
          .from("workspace_hospital_profiles")
          .select("logo_storage_path, revision")
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        const pointer = parsePointer(data);
        return !error && pointer
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
    async writePointer({ expected, nextStoragePath, operation }) {
      try {
        const { data, error } = await client.rpc(
          "clair_set_workspace_hospital_logo_state",
          {
            p_workspace_id: workspaceId,
            p_expected_revision: expected.revision,
            p_expected_storage_path: expected.storagePath,
            p_new_storage_path: nextStoragePath,
            p_operation: operation,
            p_request_id: requestId,
          }
        );
        const pointer = parsePointer(data);
        if (!error && pointer) return { ok: true, pointer };
        return error?.message?.includes("hospital_logo_state_conflict") ||
          error?.code === "40001"
          ? { ok: false, error: "conflict" }
          : { ok: false, error: "db_write_failed" };
      } catch {
        return { ok: false, error: "db_write_failed" };
      }
    },
  };
}

function parsePointer(value: unknown): HospitalLogoPointer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const storagePath =
    "storagePath" in row ? row.storagePath : row.logo_storage_path;
  const revision = row.revision;
  if (
    (storagePath !== null && typeof storagePath !== "string") ||
    !Number.isSafeInteger(revision)
  ) {
    return null;
  }
  return { storagePath: storagePath as string | null, revision: revision as number };
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate ? candidate : null;
}
