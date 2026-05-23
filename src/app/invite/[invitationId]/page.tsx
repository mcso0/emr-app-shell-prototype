import type { Metadata } from "next";
import { InviteAcceptanceScreen } from "@/features/auth/invite-acceptance-screen";
import { readServerInviteAcceptanceRecord } from "@/features/auth/server-invite-acceptance";

export const metadata: Metadata = {
  title: "Invite Acceptance",
  description: "Invite-only account linking flow for CLAiR EMR workspaces.",
};

type InviteAcceptancePageProps = {
  params: Promise<{
    invitationId: string;
  }>;
  searchParams: Promise<{
    workspaceId?: string;
    email?: string;
  }>;
};

export default async function InviteAcceptancePage({
  params,
  searchParams,
}: InviteAcceptancePageProps) {
  const [{ invitationId }, query] = await Promise.all([params, searchParams]);
  const initialRecord = await readServerInviteAcceptanceRecord({
    invitationId,
    workspaceId: query.workspaceId ?? null,
    email: query.email ?? null,
  });

  return (
    <InviteAcceptanceScreen
      invitationId={invitationId}
      workspaceId={query.workspaceId ?? null}
      email={query.email ?? null}
      initialRecord={initialRecord}
    />
  );
}
