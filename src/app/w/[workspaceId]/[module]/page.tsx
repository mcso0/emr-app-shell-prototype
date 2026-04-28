import { AppShell } from "@/shell/app-shell";

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

  return <AppShell workspaceId={workspaceId} moduleId={module} />;
}
