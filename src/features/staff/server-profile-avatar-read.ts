import {
  PRIVATE_PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_SIGNED_READ_SECONDS,
} from "@/features/staff/server-profile-avatar-core";
import { AVATAR_STORAGE_BUCKET } from "@/features/staff/staff-avatar";

export type ProfileAvatarReadRow = {
  avatar_legacy_hidden?: unknown;
  avatar_storage_path?: unknown;
  avatar_url?: unknown;
};

export type ProfileAvatarReadStorage = {
  from(bucket: string): {
    createSignedUrl(path: string, expiresIn: number): Promise<{
      data: { signedUrl?: string } | null;
      error: { message?: string } | null;
    }>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  };
};

export async function resolveProfileAvatarUrl(
  storage: ProfileAvatarReadStorage,
  row: ProfileAvatarReadRow | undefined,
): Promise<string | undefined> {
  const privatePath = row?.avatar_storage_path;
  if (typeof privatePath === "string" && privatePath.trim()) {
    try {
      const { data, error } = await storage
        .from(PRIVATE_PROFILE_AVATAR_BUCKET)
        .createSignedUrl(privatePath.trim(), PROFILE_AVATAR_SIGNED_READ_SECONDS);
      return !error && typeof data?.signedUrl === "string" && data.signedUrl
        ? data.signedUrl
        : undefined;
    } catch {
      return undefined;
    }
  }

  if (row?.avatar_legacy_hidden === true) return undefined;

  const legacyReference = row?.avatar_url;
  if (typeof legacyReference !== "string" || !legacyReference.trim()) {
    return undefined;
  }

  const reference = legacyReference.trim();
  if (
    reference.startsWith("/") ||
    reference.startsWith("https://") ||
    reference.startsWith("http://")
  ) {
    return reference;
  }

  return storage.from(AVATAR_STORAGE_BUCKET).getPublicUrl(reference).data.publicUrl;
}
