export type BillingAssignment = {
  assignedToUserId: string | null;
  assignedToDisplayName: string | null;
  revision: number;
  pauseReason?: "order_edit" | null;
  canManage: boolean;
  assignees: { userId: string; displayName: string }[];
};
export function parseBillingAssignment(value: unknown): BillingAssignment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as BillingAssignment;
  return (row.assignedToUserId === null || typeof row.assignedToUserId === "string")
    && (row.assignedToDisplayName === null || typeof row.assignedToDisplayName === "string")
    && (row.pauseReason === undefined || row.pauseReason === null || row.pauseReason === "order_edit")
    && Number.isSafeInteger(row.revision) && row.revision >= 0 && typeof row.canManage === "boolean"
    && Array.isArray(row.assignees) && row.assignees.every(x => typeof x.userId === "string" && typeof x.displayName === "string") ? row : null;
}
