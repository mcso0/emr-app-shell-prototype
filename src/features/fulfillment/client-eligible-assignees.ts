import type { FulfillmentEligibleAssignee } from "./server-fulfillment-assignee-core";

export async function loadFulfillmentEligibleAssigneesRoute({
  workItemId,
  workspaceId,
}: {
  workItemId: string;
  workspaceId: string;
}): Promise<FulfillmentEligibleAssignee[]> {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}/assignees`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  const body = (await response.json()) as {
    assignees?: FulfillmentEligibleAssignee[];
    ok?: boolean;
  };
  if (!response.ok || !body.ok || !Array.isArray(body.assignees)) {
    throw new Error("eligible_assignees_unavailable");
  }
  return body.assignees;
}
