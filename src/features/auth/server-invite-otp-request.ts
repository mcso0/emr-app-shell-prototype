import "server-only";

import { resolveInviteAcceptanceRecord } from "@/features/auth/invite-acceptance-model";
import {
  getSafeInviteNextHref,
  normalizeInviteEmail,
  readInviteContextFromNext,
} from "@/features/auth/invite-otp-handoff";
import { readServerInviteAcceptanceRecord } from "@/features/auth/server-invite-acceptance";
import { getAuthRuntimeMode } from "@/lib/supabase/config";

export type InviteOtpRequestResolution =
  | {
      ok: true;
      status: 200;
      delivery: "mock" | "supabase";
      email: string;
      next: string;
    }
  | {
      ok: false;
      status: 400 | 409;
      denialReason:
        | "invalid_request"
        | "unsafe_next"
        | "invite_context_missing"
        | "invite_email_mismatch"
        | "invite_not_pending";
    };

export async function resolveInviteOtpRequest({
  email,
  next,
}: {
  email: unknown;
  next: unknown;
}): Promise<InviteOtpRequestResolution> {
  const normalizedEmail = normalizeInviteEmail(email);
  const safeNext = getSafeInviteNextHref(next);

  if (!normalizedEmail) return { ok: false, status: 400, denialReason: "invalid_request" };
  if (!safeNext) return { ok: false, status: 400, denialReason: "unsafe_next" };

  const context = readInviteContextFromNext(safeNext);
  if (!context) return { ok: false, status: 400, denialReason: "invite_context_missing" };
  if (context.email !== normalizedEmail) {
    return { ok: false, status: 409, denialReason: "invite_email_mismatch" };
  }

  const runtime = getAuthRuntimeMode();
  const record =
    runtime.authProvider === "supabase"
      ? await readServerInviteAcceptanceRecord({
          invitationId: context.invitationId,
          workspaceId: context.workspaceId,
          email: context.email,
        })
      : resolveInviteAcceptanceRecord({
          invitationId: context.invitationId,
          workspaceId: context.workspaceId,
          email: context.email,
        });

  if (!record || record.status !== "pending" || record.invitation?.email !== normalizedEmail) {
    return { ok: false, status: 409, denialReason: "invite_not_pending" };
  }

  return {
    ok: true,
    status: 200,
    delivery: runtime.authProvider,
    email: normalizedEmail,
    next: safeNext,
  };
}
