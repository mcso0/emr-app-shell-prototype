import type { AuthSession } from "@/features/auth/auth-client";
import { resolveDemoMockAuthRoleFromEmail } from "@/features/auth/mock-session";

export function resolveReceptionMockAssigneeUserId(
  session: AuthSession | null,
): string | undefined {
  const role =
    session?.role === "supabase"
      ? resolveDemoMockAuthRoleFromEmail(session.email ?? "")
      : session?.role;

  if (role === "hospital_admin") return "user-admin-minjae";
  if (role === "billing_admin") return "user-billing-harin";
  if (role === "vet") return "user-vet-suji";
  if (role === "nurse") return "user-tech-hayun";
  if (role === "front_desk") return "user-desk-yuna";
  return undefined;
}
