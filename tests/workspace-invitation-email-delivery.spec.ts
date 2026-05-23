import { expect, test } from "@playwright/test";

import {
  createResendWorkspaceInvitationEmailDelivery,
  type WorkspaceInvitationEmailDeliveryStatus,
} from "@/features/auth/workspace-invitation-email-delivery";
import type { SessionWorkspaceInvitation } from "@/features/auth/workspace-session";

const baseEnv = {
  RESEND_API_KEY: "test_resend_key",
  RESEND_INVITE_DELIVERY: "enabled",
  RESEND_EMAIL_DELIVERY_ENV: "staging",
  RESEND_INVITE_FROM: "CLAiR Staging <invites@send.clairemr.org>",
  RESEND_ALLOWED_TEST_RECIPIENTS: "vet@hanbit.test",
  VERCEL_ENV: "preview",
};

test("workspace invitation email delivery stays disabled unless staging resend gates are present", async () => {
  const delivery = createResendWorkspaceInvitationEmailDelivery({
    env: {},
    requestOrigin: "https://preview.example.test",
    fetchImpl: async () => {
      throw new Error("unexpected send");
    },
  });
  const result = await delivery.sendInvitationEmail({
    workspaceId: "workspace-a",
    invitation: createTestInvitation("vet@hanbit.test"),
  });

  expect(result).toMatchObject({
    emailDelivery: "not_sent_approval_gated",
    inviteLink: "not_generated_approval_gated",
  });
});

test("workspace invitation email delivery sends only approved staging recipients", async () => {
  const sentPayloads: unknown[] = [];
  const delivery = createResendWorkspaceInvitationEmailDelivery({
    env: baseEnv,
    requestOrigin: "https://preview.example.test",
    fetchImpl: async (_url, init) => {
      sentPayloads.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    },
  });
  const result = await delivery.sendInvitationEmail({
    workspaceId: "workspace-a",
    invitation: createTestInvitation("vet@hanbit.test", ["vet", "front_desk"]),
  });

  expect(result).toMatchObject({
    emailDelivery: "sent_staging_resend",
    inviteLink: "generated_for_email_only",
  });
  expect(JSON.stringify(result)).not.toMatch(/test_resend_key|magic.?link|otp/i);
  expect(sentPayloads).toHaveLength(1);
  expect(sentPayloads[0]).toMatchObject({
    from: "CLAiR Staging <invites@send.clairemr.org>",
    to: ["vet@hanbit.test"],
    subject: "[CLAiR staging] Workspace invitation",
  });
  expect(JSON.stringify(sentPayloads[0])).toContain("/invite/");
});

test("workspace invitation email delivery blocks unapproved recipients and non-preview envs", async () => {
  const statuses: WorkspaceInvitationEmailDeliveryStatus[] = [];

  for (const [email, env] of [
    ["other@hanbit.test", baseEnv],
    ["vet@hanbit.test", { ...baseEnv, VERCEL_ENV: "production" }],
  ] as const) {
    const delivery = createResendWorkspaceInvitationEmailDelivery({
      env,
      requestOrigin: "https://preview.example.test",
      fetchImpl: async () => {
        throw new Error("unexpected send");
      },
    });
    const result = await delivery.sendInvitationEmail({
      workspaceId: "workspace-a",
      invitation: createTestInvitation(email),
    });

    statuses.push(result.emailDelivery);
  }

  expect(statuses).toEqual([
    "not_sent_unapproved_recipient",
    "not_sent_non_staging_environment",
  ]);
});

function createTestInvitation(
  email: string,
  invitedRoles: SessionWorkspaceInvitation["invitedRoles"] = ["vet"]
): SessionWorkspaceInvitation {
  return {
    id: "invitation-test-id",
    workspaceId: "workspace-a",
    email,
    invitedRoles,
    title: "Vet",
    department: "Clinical",
    status: "pending",
    invitedBySessionId: "user-admin",
    acceptedBySessionId: null,
    expiresAt: "2026-05-23T00:00:00.000Z",
    acceptedAt: null,
    canceledAt: null,
    resentAt: null,
    resendCount: 0,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
  };
}
