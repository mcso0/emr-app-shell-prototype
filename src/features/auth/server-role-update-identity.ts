import type { ServerSessionReaderResult } from "@/features/auth/server-session-contract";

export const demoSessionUserIdHeader = "x-clair-demo-session-user-id";

export type RoleUpdateActorIdentityResult =
  | {
      ok: true;
      actorUserId: string;
      source: "supabase_session" | "demo_header_mock_mode";
    }
  | {
      ok: false;
      denialReason: "unauthenticated";
      sessionStatus: ServerSessionReaderResult["status"];
      sessionReason?: string;
    };

export function resolveRoleUpdateActorIdentity({
  serverSession,
  demoHeaderUserId,
}: {
  serverSession: ServerSessionReaderResult;
  demoHeaderUserId: string | null;
}): RoleUpdateActorIdentityResult {
  if (serverSession.ok) {
    return {
      ok: true,
      actorUserId: serverSession.sessionUserId,
      source: "supabase_session",
    };
  }

  if (serverSession.status === "mock_mode" && demoHeaderUserId) {
    return {
      ok: true,
      actorUserId: demoHeaderUserId,
      source: "demo_header_mock_mode",
    };
  }

  return {
    ok: false,
    denialReason: "unauthenticated",
    sessionStatus: serverSession.status,
    sessionReason: "reason" in serverSession ? serverSession.reason : undefined,
  };
}
