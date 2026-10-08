type ChartOrderSaveFailure = Readonly<{
  ok: false;
  status: number;
  denialReason?: string;
  error?: string;
}>;

// Classification only: the caller owns edits, ETags, notices and retry timing.
export function classifyChartOrderSaveFailure(result: ChartOrderSaveFailure): {
  conflict: boolean;
  retainPendingConfirmation: boolean;
} {
  return {
    conflict:
      result.denialReason === "revision_conflict" ||
      result.error === "revision_conflict",
    // Retain the existing command for a later explicit confirmation attempt.
    // This does not authorize or start an automatic retry.
    retainPendingConfirmation:
      result.status >= 500 ||
      result.denialReason === "confirmation_in_progress" ||
      result.error === "confirmation_in_progress",
  };
}
