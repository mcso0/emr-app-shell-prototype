import { parseInpatientLocationConfiguration, parseInpatientLocationMutation } from "./inpatient-location-contract";
export type InpatientLocationRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }> };
const knownErrors = new Set(["workspace_membership_missing", "permission_missing", "inpatient_location_invalid", "inpatient_location_revision_conflict", "inpatient_location_name_conflict"]);
function failure(message?: string) {
  const error = message && knownErrors.has(message) ? message : "inpatient_location_unavailable";
  return { ok: false as const, status: error.includes("permission") || error.includes("membership") ? 403 : error.includes("conflict") ? 409 : error.endsWith("invalid") ? 400 : 503, error };
}
export async function readInpatientLocations(client: InpatientLocationRpcClient, workspaceId: string) {
  const { data, error } = await client.rpc("clair_get_workspace_inpatient_locations", { p_workspace_id: workspaceId });
  if (error) return failure(error.message);
  const configuration = parseInpatientLocationConfiguration(data, workspaceId);
  return configuration ? { ok: true as const, status: 200, ...configuration } : { ok: false as const, status: 502, error: "inpatient_location_response_invalid" };
}
export async function saveInpatientLocation(client: InpatientLocationRpcClient, workspaceId: string, input: unknown) {
  const command = parseInpatientLocationMutation(input);
  if (!command) return { ok: false as const, status: 400, error: "inpatient_location_invalid" };
  const { data, error } = await client.rpc("clair_save_workspace_inpatient_location", { p_workspace_id: workspaceId, p_command: command });
  if (error) return failure(error.message);
  const configuration = parseInpatientLocationConfiguration(data, workspaceId);
  const changed = configuration?.locations.find(location => location.id === command.id);
  if (!configuration || !changed || changed.rowRevision !== command.expectedRevision + 1 || changed.label !== command.label
    || changed.kind !== command.kind || changed.active !== command.active) return { ok: false as const, status: 502, error: "inpatient_location_response_invalid" };
  return { ok: true as const, status: 200, ...configuration };
}
