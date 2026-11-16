export function isPendingFulfillmentRerequest(
  status: string,
  attemptNo: number,
  assigneeId?: string | null,
) {
  return attemptNo > 1 && (status === "requested" || (status === "paused" && !assigneeId));
}
