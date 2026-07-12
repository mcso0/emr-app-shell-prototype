export const AVATAR_STORAGE_BUCKET = "avatars";

export const CHEONGDAM_AVATAR_USER_IDS = [
  "49110000-0000-4000-8000-000000000001",
  "49110000-0000-4000-8000-000000000003",
  "49110000-0000-4000-8000-000000000005",
  "49110000-0000-4000-8000-000000000006",
  "49110000-0000-4000-8000-000000000007",
  "49110000-0000-4000-8000-000000000008",
  "49110000-0000-4000-8000-000000000009",
  "49110000-0000-4000-8000-000000000010",
  "49110000-0000-4000-8000-000000000011",
  "49110000-0000-4000-8000-000000000012",
  "49110000-0000-4000-8000-000000000013",
] as const;

export const CHEONGDAM_FALLBACK_USER_IDS = [
  "49110000-0000-4000-8000-000000000002",
  "49110000-0000-4000-8000-000000000004",
  "49110000-0000-4000-8000-000000000014",
] as const;

const avatarUserIds = new Set<string>(CHEONGDAM_AVATAR_USER_IDS);

const mockStaffAvatarUserIds: Record<string, string> = {
  "user-vet-suji": "49110000-0000-4000-8000-000000000003",
  "user-vet-doyun": "49110000-0000-4000-8000-000000000006",
  "user-vet-seoyeon": "49110000-0000-4000-8000-000000000007",
  "user-vet-minjae": "49110000-0000-4000-8000-000000000008",
  "user-vet-harin": "49110000-0000-4000-8000-000000000009",
  "user-vet-jihoon": "49110000-0000-4000-8000-000000000010",
  "user-vet-gayeon": "49110000-0000-4000-8000-000000000011",
  "user-vet-taeoh": "49110000-0000-4000-8000-000000000012",
  "user-vet-eunseo": "49110000-0000-4000-8000-000000000013",
  "user-desk-yuna": "49110000-0000-4000-8000-000000000005",
};

export function getStaffAvatarStoragePath(userId: string): string | null {
  return avatarUserIds.has(userId) ? `${userId}.png` : null;
}

export function getLocalStaffAvatarUrl(userId: string): string | null {
  const storagePath = getStaffAvatarStoragePath(userId);
  return storagePath ? `/avatars/${storagePath}` : null;
}

export function getMockStaffAvatarUrl(mockUserId: string): string | null {
  const userId = mockStaffAvatarUserIds[mockUserId];
  return userId ? getLocalStaffAvatarUrl(userId) : null;
}
