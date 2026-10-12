import "server-only";
// Shared by mock routes only. Supabase requests use the durable invoice RPCs.
type MockAssignment = { userId: string | null; revision: number };
// Next route bundles must share the same synthetic workspace ownership.
const runtime = globalThis as typeof globalThis & { clairMockBillingAssignments?: Map<string, MockAssignment> };
export const mockBillingAssignments = runtime.clairMockBillingAssignments ??= new Map<string, MockAssignment>();
export const mockBillingAssignmentStaff = [
  { userId: "user-tech", displayName: "송하윤" },
  { userId: "user-admin", displayName: "송민재" },
  { userId: "user-front-desk", displayName: "정하린" },
];
export function mockBillingOwnerAllowed(workspaceId: string, invoiceId: string, actorUserId: string) {
  return workspaceId === "clair-demo" && mockBillingAssignments.get(`${workspaceId}:${invoiceId}`)?.userId === actorUserId;
}
