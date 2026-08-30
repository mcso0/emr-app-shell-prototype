import type { AuthSession } from "@/features/auth/auth-client";

export type BillingProtectedSnapshot<T> = {
  ownerKey: string;
  value: T;
};

export function getBillingProtectedSnapshotOwnerKey(
  session: AuthSession | null,
  workspaceId: string,
) {
  if (!session) return `anonymous:${workspaceId}`;
  const actorId = "userId" in session ? session.userId : session.id;
  const provider = "provider" in session ? session.provider : "mock";
  return `${provider}:${actorId}:${session.id}:${workspaceId}`;
}

export function resolveBillingProtectedSnapshot<T>(
  snapshot: BillingProtectedSnapshot<T> | undefined,
  ownerKey: string,
) {
  return snapshot?.ownerKey === ownerKey ? snapshot.value : undefined;
}
