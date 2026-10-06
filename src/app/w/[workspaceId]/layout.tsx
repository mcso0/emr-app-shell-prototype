import { AppShell } from "@/shell/app-shell";
import { AuthGate } from "@/features/auth/auth-gate";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  // Keep existing sidebar instances when a preview is pinned into another module.
  // AuthGate still checks the current session, route and workspace access.
  return (
    <AuthGate workspaceId={workspaceId}>
      <AppShell workspaceId={workspaceId} />
      {children}
    </AuthGate>
  );
}
