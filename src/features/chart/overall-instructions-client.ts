import { overallInstructionsSchema, type OverallInstructions, type OverallInstructionsCommand } from "./overall-instructions-contract";

export class InstructionRequestError extends Error {
  constructor(public code: string, public uncertain = false) { super(code); }
}
export type OverallInstructionsClient = {
  load(signal: AbortSignal): Promise<OverallInstructions>;
  apply(command: OverallInstructionsCommand, signal: AbortSignal): Promise<OverallInstructions>;
};
export function createOverallInstructionsClient(workspaceId: string, chartId: string): OverallInstructionsClient {
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/charts/${encodeURIComponent(chartId)}/overall-instructions`;
  async function request(signal: AbortSignal, command?: OverallInstructionsCommand) {
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal, ...(command ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) } : {}) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new InstructionRequestError(body.error ?? "instruction_unavailable", !!command && response.status >= 500);
      const parsed = overallInstructionsSchema.safeParse(body.document);
      if (!parsed.success || parsed.data.chartId !== chartId) throw new InstructionRequestError("instruction_unavailable", !!command);
      return parsed.data;
    } catch (error) {
      if (error instanceof InstructionRequestError) throw error;
      throw new InstructionRequestError("instruction_unavailable", !!command);
    }
  }
  return { load: signal => request(signal), apply: (command, signal) => request(signal, command) };
}
