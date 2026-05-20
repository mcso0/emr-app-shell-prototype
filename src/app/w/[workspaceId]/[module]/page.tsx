import { AppShell } from "@/shell/app-shell";
import { AuthGate } from "@/features/auth/auth-gate";

type WorkspaceModulePageProps = {
  params: Promise<{
    workspaceId: string;
    module: string;
  }>;
};

export default async function WorkspaceModulePage({
  params,
}: WorkspaceModulePageProps) {
  const { workspaceId, module } = await params;

  return (
    <AuthGate workspaceId={workspaceId}>
      <AppShell workspaceId={workspaceId} moduleId={module} />
    </AuthGate>
  );
}
