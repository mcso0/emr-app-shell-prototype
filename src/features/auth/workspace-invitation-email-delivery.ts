import type { SessionWorkspaceInvitation } from "@/features/auth/workspace-session";

export type WorkspaceInvitationEmailDeliveryStatus =
  | "not_sent_approval_gated"
  | "not_sent_email_delivery_disabled"
  | "not_sent_non_staging_environment"
  | "not_sent_unapproved_recipient"
  | "failed_resend_delivery"
  | "sent_staging_resend";

export type WorkspaceInvitationInviteLinkStatus =
  | "not_generated_approval_gated"
  | "generated_for_email_only";

export type WorkspaceInvitationEmailDeliveryResult = {
  emailDelivery: WorkspaceInvitationEmailDeliveryStatus;
  inviteLink: WorkspaceInvitationInviteLinkStatus;
};

export type WorkspaceInvitationEmailDeliveryAdapter = {
  sendInvitationEmail(args: {
    workspaceId: string;
    invitation: SessionWorkspaceInvitation;
  }): Promise<WorkspaceInvitationEmailDeliveryResult>;
};

type ResendDeliveryEnv = {
  RESEND_API_KEY?: string;
  RESEND_INVITE_DELIVERY?: string;
  RESEND_EMAIL_DELIVERY_ENV?: string;
  RESEND_INVITE_FROM?: string;
  RESEND_ALLOWED_TEST_RECIPIENTS?: string;
  VERCEL_ENV?: string;
};

type FetchLike = typeof fetch;

export function createNoopWorkspaceInvitationEmailDelivery(): WorkspaceInvitationEmailDeliveryAdapter {
  return {
    async sendInvitationEmail() {
      return {
        emailDelivery: "not_sent_approval_gated",
        inviteLink: "not_generated_approval_gated",
      };
    },
  };
}

export function createResendWorkspaceInvitationEmailDelivery({
  env = process.env as ResendDeliveryEnv,
  fetchImpl = fetch,
  requestOrigin,
}: {
  env?: ResendDeliveryEnv;
  fetchImpl?: FetchLike;
  requestOrigin: string;
}): WorkspaceInvitationEmailDeliveryAdapter {
  return {
    async sendInvitationEmail({ workspaceId, invitation }) {
      const config = resolveResendWorkspaceInvitationConfig(env);

      if (!config.enabled) {
        return {
          emailDelivery: config.status,
          inviteLink: "not_generated_approval_gated",
        };
      }

      if (!config.allowedRecipients.has(invitation.email)) {
        return {
          emailDelivery: "not_sent_unapproved_recipient",
          inviteLink: "not_generated_approval_gated",
        };
      }

      const inviteUrl = createWorkspaceInvitationUrl({
        requestOrigin,
        workspaceId,
        invitation,
      });

      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [invitation.email],
          subject: "[CLAiR staging] Workspace invitation",
          text: [
            "You have been invited to a CLAiR staging workspace.",
            "",
            `Workspace: ${workspaceId}`,
            `Roles: ${invitation.invitedRoles.join(", ")}`,
            "",
            `Open invitation: ${inviteUrl}`,
            "",
            "This is a staging-only test email.",
          ].join("\n"),
          html: [
            "<p>You have been invited to a CLAiR staging workspace.</p>",
            `<p><strong>Workspace:</strong> ${escapeHtml(workspaceId)}</p>`,
            `<p><strong>Roles:</strong> ${escapeHtml(invitation.invitedRoles.join(", "))}</p>`,
            `<p><a href="${escapeHtml(inviteUrl)}">Open invitation</a></p>`,
            "<p>This is a staging-only test email.</p>",
          ].join(""),
        }),
      });

      if (!response.ok) {
        return {
          emailDelivery: "failed_resend_delivery",
          inviteLink: "not_generated_approval_gated",
        };
      }

      return {
        emailDelivery: "sent_staging_resend",
        inviteLink: "generated_for_email_only",
      };
    },
  };
}

function resolveResendWorkspaceInvitationConfig(env: ResendDeliveryEnv):
  | {
      enabled: true;
      apiKey: string;
      from: string;
      allowedRecipients: Set<string>;
    }
  | {
      enabled: false;
      status:
        | "not_sent_approval_gated"
        | "not_sent_email_delivery_disabled"
        | "not_sent_non_staging_environment";
    } {
  if (env.RESEND_INVITE_DELIVERY !== "enabled") {
    return { enabled: false, status: "not_sent_approval_gated" };
  }

  if (env.RESEND_EMAIL_DELIVERY_ENV !== "staging" || env.VERCEL_ENV !== "preview") {
    return { enabled: false, status: "not_sent_non_staging_environment" };
  }

  if (!env.RESEND_API_KEY || !env.RESEND_INVITE_FROM) {
    return { enabled: false, status: "not_sent_approval_gated" };
  }

  return {
    enabled: true,
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_INVITE_FROM,
    allowedRecipients: parseRecipientAllowlist(env.RESEND_ALLOWED_TEST_RECIPIENTS),
  };
}

function createWorkspaceInvitationUrl({
  requestOrigin,
  workspaceId,
  invitation,
}: {
  requestOrigin: string;
  workspaceId: string;
  invitation: SessionWorkspaceInvitation;
}) {
  const url = new URL(`/invite/${encodeURIComponent(invitation.id)}`, requestOrigin);
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("email", invitation.email);

  return url.toString();
}

function parseRecipientAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((recipient) => recipient.trim().toLowerCase())
      .filter(Boolean)
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
