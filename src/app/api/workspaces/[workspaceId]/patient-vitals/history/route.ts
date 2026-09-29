import { handlePatientVitalHistoryRequest } from "@/features/patient-vitals/server-patient-vital-history";

type RouteContext = { params: Promise<{ workspaceId: string }> };

async function handle(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  return handlePatientVitalHistoryRequest({ request, workspaceId });
}

export { handle as GET, handle as POST, handle as PATCH };
