import type { AuthSession } from "@/features/auth/auth-client";

export const demoClientSessionIdHeader = "x-clair-demo-client-session-id";
export const demoSessionUserIdHeader = "x-clair-demo-session-user-id";

const demoActorUserIdByRole: Partial<Record<AuthSession["role"], string>> = {
  billing_admin: "user-tech",
  front_desk: "user-front-desk",
  hospital_admin: "user-admin",
  nurse: "user-tech",
  vet: "user-vet",
};

export function getDemoActorUserId(session: AuthSession): string | null {
  if (session.role === "supabase") return null;

  return demoActorUserIdByRole[session.role] ?? session.id;
}

export function getDemoActorHeaders(
  session: AuthSession | null,
): Record<string, string> | undefined {
  if (!session) return undefined;

  const actorUserId = getDemoActorUserId(session);
  if (!actorUserId) return undefined;

  return {
    [demoClientSessionIdHeader]: getDemoClientSessionId(),
    [demoSessionUserIdHeader]: actorUserId,
  };
}

export function getDemoClientSessionId() {
  if (typeof window === "undefined") return "server-render";

  const storageKey = "clair-demo-client-session-id";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `client-${Date.now().toString(36)}`;
  window.sessionStorage.setItem(storageKey, next);
  return next;
}
