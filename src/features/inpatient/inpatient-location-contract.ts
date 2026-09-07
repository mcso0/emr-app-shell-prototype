export type InpatientLocation = {
  id: string;
  label: string;
  kind: "ward" | "cage";
  active: boolean;
  rowRevision: number;
};
export type InpatientLocationConfiguration = {
  workspaceId: string;
  canManage: boolean;
  locations: InpatientLocation[];
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function parseInpatientLocation(value: unknown): InpatientLocation | null {
  if (!record(value) || !uuid(value.id) || typeof value.label !== "string" || value.label !== value.label.trim()
    || value.label.length < 1 || value.label.length > 80 || !["ward", "cage"].includes(String(value.kind))
    || typeof value.active !== "boolean" || !Number.isSafeInteger(value.rowRevision) || Number(value.rowRevision) < 1) return null;
  return { id: value.id, label: value.label, kind: value.kind as "ward" | "cage", active: value.active, rowRevision: Number(value.rowRevision) };
}
export function parseInpatientLocationConfiguration(value: unknown, workspaceId: string): InpatientLocationConfiguration | null {
  if (!record(value) || value.workspaceId !== workspaceId || typeof value.canManage !== "boolean" || !Array.isArray(value.locations)) return null;
  const locations = value.locations.map(parseInpatientLocation);
  if (locations.some(location => !location) || new Set(locations.map(location => location!.id)).size !== locations.length) return null;
  return { workspaceId, canManage: value.canManage, locations: locations as InpatientLocation[] };
}
export function parseInpatientLocationMutation(value: unknown) {
  if (!record(value) || Object.keys(value).some(key => !["id", "label", "kind", "active", "expectedRevision"].includes(key))
    || !Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 0) return null;
  const location = parseInpatientLocation({ ...value, rowRevision: 1 });
  return location ? { id: location.id, label: location.label, kind: location.kind, active: location.active, expectedRevision: Number(value.expectedRevision) } : null;
}
