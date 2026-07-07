import { NextResponse, type NextRequest } from "next/server";
import { resolveInviteAcceptanceRecord } from "@/features/auth/invite-acceptance-model";
import { readServerInviteAcceptanceRecord } from "@/features/auth/server-invite-acceptance";
import { enforceRequestRateLimit } from "@/lib/security/rate-limit";

type ReinviteRequestBody = {
  email?: unknown;
};

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      workspaceId: string;
      invitationId: string;
    }>;
  },
) {
  const { workspaceId, invitationId } = await params;
  const body = (await request.json().catch(() => ({}))) as ReinviteRequestBody;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

  const rateLimitResponse = enforceRequestRateLimit({
    request,
    keyParts: [
      "workspace-invitation-reinvite-request",
      workspaceId,
      invitationId,
      email,
    ],
  });
  if (rateLimitResponse) return rateLimitResponse;

  const localRecord = resolveInviteAcceptanceRecord({
    invitationId,
    workspaceId,
    email: null,
  });
  const record =
    localRecord.status !== "missing"
      ? localRecord
      : ((await readServerInviteAcceptanceRecord({
          invitationId,
          workspaceId,
          email,
        })) ??
        resolveInviteAcceptanceRecord({
          invitationId,
          workspaceId,
          email: null,
        }));

  if (!record.workspace || !record.invitation) {
    return NextResponse.json(
      {
        ok: false,
        denialReason: "target_invitation_missing",
      },
      { status: 404 },
    );
  }

  if (!email || email !== record.invitation.email.toLowerCase()) {
    return NextResponse.json(
      {
        ok: false,
        denialReason: "invite_email_mismatch",
      },
      { status: 403 },
    );
  }

  const verifiedRecord =
    (await readServerInviteAcceptanceRecord({
      invitationId,
      workspaceId,
      email,
    })) ?? record;

  if (!verifiedRecord.workspace || !verifiedRecord.invitation) {
    return NextResponse.json(
      {
        ok: false,
        denialReason: "target_invitation_missing",
      },
      { status: 404 },
    );
  }

  if (verifiedRecord.status === "pending") {
    return NextResponse.json(
      {
        ok: false,
        denialReason: "invitation_still_pending",
      },
      { status: 409 },
    );
  }

  if (verifiedRecord.status === "accepted") {
    return NextResponse.json(
      {
        ok: false,
        denialReason: "invitation_already_accepted",
      },
      { status: 409 },
    );
  }

  if (
    verifiedRecord.status !== "expired" &&
    verifiedRecord.status !== "canceled"
  ) {
    return NextResponse.json(
      {
        ok: false,
        denialReason: "invitation_reinvite_unavailable",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    requestStatus: "queued",
    notification: "admin_reinvite_request_queued",
    workspaceId: verifiedRecord.workspace.id,
    invitationId: verifiedRecord.invitation.id,
  });
}
