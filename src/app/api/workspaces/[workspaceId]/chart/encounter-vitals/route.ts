import { handlePatientVitalPatch } from "@/features/patient-vitals/server-patient-vital-route";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  return handlePatientVitalPatch({ mode: "chart", request, workspaceId });
}
