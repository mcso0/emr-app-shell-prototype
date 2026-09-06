import { isLabProfileRule, parseLabResultProfile, type LabProfileRule, type LabResultProfile } from "./result-profile-contract";
import { isExecutionRecord as record, isExecutionUuid as uuid } from "../fulfillment/execution-result-contract";

export type LabDevice = { id: string; workspace_id: string; name: string; manufacturer: string; model: string;
  kind: "manual" | "analyzer_reference"; entry_mode: "manual_entry"; integration_status: "not_integrated"; active: boolean; row_revision: number };
export type LabProfileBinding = { workspace_id: string; order_catalog_item_id: string; species: "dog" | "cat";
  device_id: string; profile_version_id: string; row_revision: number; override_version_id?: string | null };
export type LabProfileOverride = { workspace_id: string; id: string; order_catalog_item_id: string; base_profile_version_id: string;
  revision: number; rules: LabProfileRule[]; rules_sha256: string };
export type LabCompositionOption = { id: string; masterKey: string; revision: number; name: string; leafCount: number;
  currentSetRevisionId: string | null; currentCompositionVersionId: string | null; billingPolicy: string | null;
  leaves: Array<{ masterKey: string; defaultIncluded: boolean; path: Array<{ key: string; versionId: string; name: string; ordinal: number }> }> };
export type LabProfileConfiguration = { workspaceId: string; catalogItemId: string | null; canConfigure: boolean; canSelect: boolean;
  canRetest?: boolean;
  compositions?: LabCompositionOption[];
  overrides?: LabProfileOverride[];
  order: null | { id: string; updatedAt: string; confirmationStatus: string; species: string; requiresProfile: boolean;
    selectedProfileVersionId: string | null; selectedDeviceId: string | null; selectedOverrideVersionId?: string | null };
  profiles: LabResultProfile[]; devices: LabDevice[]; bindings: LabProfileBinding[] };
export type LabProfileRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }> };
const errors = new Set(["workspace_membership_missing", "permission_missing", "catalog_item_not_found", "order_unavailable", "invalid_lab_device",
  "lab_device_identity_conflict", "lab_result_device_profile_mismatch", "lab_result_profile_parameter_unsupported", "lab_profile_binding_revision_conflict",
  "confirmed_lab_profile_immutable", "lab_result_profile_binding_required", "order_revision_conflict"]);
for (const error of ["lab_composition_revision_conflict", "lab_composition_request_conflict", "lab_composition_version_missing",
  "lab_composition_catalog_pin_stale", "lab_composition_parent_price_unavailable", "lab_composition_local_override_requires_explicit_reconciliation",
  "lab_profile_override_request_conflict", "invalid_lab_profile_intervals", "lab_profile_override_scope_mismatch"]) errors.add(error);
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const nullableUuid = (v: unknown) => v === null || uuid(v);

export function parseLabProfileConfiguration(v: unknown, workspaceId: string, orderId?: string, catalogItemId?: string): LabProfileConfiguration | null {
  if (!record(v) || v.workspaceId !== workspaceId || !(v.catalogItemId === null || typeof v.catalogItemId === "string")
    || (catalogItemId !== undefined && v.catalogItemId !== catalogItemId) || typeof v.canConfigure !== "boolean" || typeof v.canSelect !== "boolean"
    || !Array.isArray(v.profiles) || v.profiles.some(p => !parseLabResultProfile(p))
    || !Array.isArray(v.devices) || v.devices.some(d => !record(d) || !uuid(d.id) || d.workspace_id !== workspaceId || typeof d.name !== "string"
      || typeof d.manufacturer !== "string" || typeof d.model !== "string" || !["manual", "analyzer_reference"].includes(String(d.kind))
      || d.entry_mode !== "manual_entry" || d.integration_status !== "not_integrated" || typeof d.active !== "boolean" || !positive(d.row_revision))
    || !Array.isArray(v.bindings) || v.bindings.some(b => !record(b) || b.workspace_id !== workspaceId || typeof b.order_catalog_item_id !== "string"
      || (catalogItemId !== undefined && b.order_catalog_item_id !== catalogItemId) || !["dog", "cat"].includes(String(b.species))
      || !uuid(b.device_id) || !uuid(b.profile_version_id) || !positive(b.row_revision))
    || new Set(v.profiles.map(p => p.id)).size !== v.profiles.length || new Set(v.devices.map(d => d.id)).size !== v.devices.length) return null;
  if (v.order !== null && (!record(v.order) || !uuid(v.order.id) || typeof v.order.updatedAt !== "string" || !Number.isFinite(Date.parse(v.order.updatedAt))
    || typeof v.order.confirmationStatus !== "string" || typeof v.order.species !== "string" || typeof v.order.requiresProfile !== "boolean"
    || !nullableUuid(v.order.selectedProfileVersionId) || !nullableUuid(v.order.selectedDeviceId)
    || (v.order.selectedDeviceId === null) !== (v.order.selectedProfileVersionId === null))) return null;
  if (orderId !== undefined && (!record(v.order) || v.order.id !== orderId)) return null;
  if (v.overrides !== undefined && (!Array.isArray(v.overrides) || new Set(v.overrides.map(o => record(o) ? o.id : null)).size !== v.overrides.length
    || v.overrides.some(o => !record(o) || o.workspace_id !== workspaceId || !uuid(o.id) || !uuid(o.base_profile_version_id)
      || typeof o.order_catalog_item_id !== "string" || (v.catalogItemId !== null && o.order_catalog_item_id !== v.catalogItemId)
      || !positive(o.revision) || typeof o.rules_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(o.rules_sha256)
      || !Array.isArray(o.rules) || !o.rules.length || o.rules.some(r => !isLabProfileRule(r))
      || new Set(o.rules.map(r => r.testMasterKey)).size !== o.rules.length))) return null;
  if (v.compositions !== undefined && (!Array.isArray(v.compositions) || new Set(v.compositions.map(c => record(c) ? c.id : null)).size !== v.compositions.length
    || v.compositions.some(c => !record(c) || !uuid(c.id) || typeof c.masterKey !== "string" || typeof c.name !== "string" || !positive(c.revision)
      || !positive(c.leafCount) || !nullableUuid(c.currentSetRevisionId) || !nullableUuid(c.currentCompositionVersionId)
      || ![null, "preserve_parent_price", "sum_leaf_prices", "no_charge"].includes(c.billingPolicy as null | string)
      || !Array.isArray(c.leaves) || c.leaves.length !== c.leafCount || c.leaves.length > 200
      || c.leaves.some(l => !record(l) || typeof l.masterKey !== "string" || typeof l.defaultIncluded !== "boolean" || !Array.isArray(l.path)
        || l.path.length < 1 || l.path.length > 4 || l.path.some(p => !record(p) || typeof p.key !== "string" || !uuid(p.versionId) || typeof p.name !== "string" || !positive(p.ordinal)))))) return null;
  if (new Set(v.bindings.map(b => `${b.order_catalog_item_id}:${b.species}`)).size !== v.bindings.length) return null;
  for (const binding of v.bindings) {
    const profile = v.profiles.find(p => p.id === binding.profile_version_id);
    const device = v.devices.find(d => d.id === binding.device_id);
    if (!profile || !device || (v.catalogItemId !== null && binding.order_catalog_item_id !== v.catalogItemId) || profile.species !== binding.species
      || profile.device.model !== device.model || profile.device.manufacturer !== device.manufacturer || profile.device.kind !== device.kind
      || (record(v.order) && binding.species !== v.order.species)) return null;
    if (binding.override_version_id !== undefined && binding.override_version_id !== null && (!uuid(binding.override_version_id)
      || !Array.isArray(v.overrides) || !v.overrides.some(o => o.id === binding.override_version_id && o.base_profile_version_id === binding.profile_version_id
        && o.order_catalog_item_id === binding.order_catalog_item_id))) return null;
  }
  if (record(v.order) && v.order.selectedProfileVersionId !== null) {
    const profile = v.profiles.find(p => p.id === (v.order as Record<string, unknown>).selectedProfileVersionId);
    const device = v.devices.find(d => d.id === (v.order as Record<string, unknown>).selectedDeviceId);
    if (!profile || !device || profile.species !== v.order.species || profile.device.model !== device.model
      || profile.device.manufacturer !== device.manufacturer || profile.device.kind !== device.kind) return null;
    if (v.order.selectedOverrideVersionId !== undefined && v.order.selectedOverrideVersionId !== null
      && (!uuid(v.order.selectedOverrideVersionId) || !Array.isArray(v.overrides) || !v.overrides.some(o => record(o)
        && o.id === (v.order as Record<string, unknown>).selectedOverrideVersionId && o.order_catalog_item_id === v.catalogItemId && o.base_profile_version_id === profile.id))) return null;
  }
  return v as LabProfileConfiguration;
}
const failure = (message?: string) => ({ ok: false as const, status: ["workspace_membership_missing", "permission_missing"].includes(message ?? "") ? 403 : errors.has(message ?? "") ? 409 : 503,
  error: errors.has(message ?? "") ? message! : "lab_profile_request_failed" });

export async function readLabProfileConfiguration(client: LabProfileRpcClient, workspaceId: string, orderId?: string, catalogItemId?: string) {
  if (!workspaceId.trim() || (orderId !== undefined && !uuid(orderId)) || (catalogItemId !== undefined && !catalogItemId.trim())) return { ok: false as const, status: 400, error: "invalid_lab_profile_request" };
  try {
    const { data, error } = await client.rpc("clair_get_lab_result_profile_configuration", { p_workspace_id: workspaceId, p_order_id: orderId ?? null, p_catalog_item_id: catalogItemId ?? null });
    if (error) return failure(error.message);
    const configuration = parseLabProfileConfiguration(data, workspaceId, orderId, catalogItemId);
    return configuration ? { ok: true as const, status: 200, configuration } : { ok: false as const, status: 502, error: "invalid_lab_profile_response" };
  } catch { return failure(); }
}

export async function mutateLabProfileConfiguration(client: LabProfileRpcClient, workspaceId: string, input: unknown) {
  if (record(input) && input.action === "save_intervals") {
    if (!workspaceId.trim() || !uuid(input.profileVersionId) || !uuid(input.requestId) || typeof input.catalogItemId !== "string" || !input.catalogItemId.trim()
      || !positive(input.expectedBindingRevision) || !Array.isArray(input.intervals) || !input.intervals.length || input.intervals.length > 200
      || Object.keys(input).some(k => !["action", "profileVersionId", "requestId", "catalogItemId", "expectedBindingRevision", "intervals"].includes(k))
      || input.intervals.some(p => !record(p) || Object.keys(p).length !== 2 || typeof p.testMasterKey !== "string" || !(p.referenceInterval === null
        || record(p.referenceInterval) && Object.keys(p.referenceInterval).length === 4 && typeof p.referenceInterval.low === "number" && Number.isFinite(p.referenceInterval.low)
          && typeof p.referenceInterval.high === "number" && Number.isFinite(p.referenceInterval.high) && p.referenceInterval.low <= p.referenceInterval.high
          && p.referenceInterval.lowInclusive === true && p.referenceInterval.highInclusive === true))
      || new Set(input.intervals.map(p => p.testMasterKey)).size !== input.intervals.length) return { ok: false as const, status: 400, error: "invalid_lab_profile_intervals" };
    try {
      const { data, error } = await client.rpc("clair_save_lab_profile_intervals", { p_workspace_id: workspaceId, p_catalog_item_id: input.catalogItemId,
        p_profile_version_id: input.profileVersionId, p_request_id: input.requestId, p_expected_binding_revision: input.expectedBindingRevision, p_intervals: input.intervals });
      if (error) return failure(error.message);
      if (!record(data) || data.workspaceId !== workspaceId || data.catalogItemId !== input.catalogItemId || data.overrideVersionId !== input.requestId || !positive(data.revision))
        return { ok: false as const, status: 502, error: "invalid_lab_profile_response" };
      return { ok: true as const, status: 200 };
    } catch { return failure(); }
  }
  if (record(input) && input.action === "apply_composition") {
    if (!workspaceId.trim() || !uuid(input.versionId) || !uuid(input.requestId) || !nullableUuid(input.expectedSetRevisionId)
      || !["preserve_parent_price", "sum_leaf_prices", "no_charge"].includes(String(input.billingPolicy))
      || Object.keys(input).some(k => !["action", "versionId", "requestId", "expectedSetRevisionId", "billingPolicy"].includes(k)))
      return { ok: false as const, status: 400, error: "invalid_lab_composition_request" };
    try {
      const { data, error } = await client.rpc("clair_apply_lab_composition", { p_workspace_id: workspaceId, p_version_id: input.versionId,
        p_request_id: input.requestId, p_expected_set_revision_id: input.expectedSetRevisionId, p_billing_policy: input.billingPolicy });
      if (error) return failure(error.message);
      if (!record(data) || data.ok !== true || data.workspaceId !== workspaceId || data.compositionVersionId !== input.versionId
        || data.billingPolicy !== input.billingPolicy || !uuid(data.orderSetRevisionId) || typeof data.orderSetId !== "string" || !positive(data.leafCount))
        return { ok: false as const, status: 502, error: "invalid_lab_profile_response" };
      return { ok: true as const, status: 200 };
    } catch { return failure(); }
  }
  if (!record(input) || !uuid(input.profileVersionId)) return { ok: false as const, status: 400, error: "invalid_lab_profile_request" };
  let name: string; let args: Record<string, unknown>; let allowed: string[];
  if (input.action === "register_device" && uuid(input.id) && typeof input.name === "string" && input.name.trim().length > 0 && input.name.length <= 200) {
    name = "clair_register_workspace_lab_device"; args = { p_id: input.id, p_name: input.name, p_profile_version_id: input.profileVersionId };
    allowed = ["action", "id", "name", "profileVersionId"];
  } else if (input.action === "bind_profile" && typeof input.catalogItemId === "string" && input.catalogItemId.trim() && uuid(input.deviceId)
    && Number.isSafeInteger(input.expectedRevision) && Number(input.expectedRevision) >= 0) {
    name = "clair_bind_workspace_lab_result_profile"; args = { p_catalog_item_id: input.catalogItemId, p_device_id: input.deviceId, p_profile_version_id: input.profileVersionId, p_expected_revision: input.expectedRevision };
    allowed = ["action", "catalogItemId", "deviceId", "profileVersionId", "expectedRevision"];
  } else if (input.action === "select_profile" && uuid(input.orderId) && uuid(input.deviceId) && typeof input.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
    name = "clair_select_lab_order_result_profile"; args = { p_order_id: input.orderId, p_device_id: input.deviceId, p_profile_version_id: input.profileVersionId, p_expected_updated_at: input.expectedUpdatedAt };
    allowed = ["action", "orderId", "deviceId", "profileVersionId", "expectedUpdatedAt"];
  } else return { ok: false as const, status: 400, error: "invalid_lab_profile_request" };
  if (Object.keys(input).some(k => !allowed.includes(k))) return { ok: false as const, status: 400, error: "invalid_lab_profile_request" };
  try {
    const { data, error } = await client.rpc(name, { ...args, p_workspace_id: workspaceId });
    if (error) return failure(error.message);
    if (!record(data) || (input.action === "select_profile" ? data.orderId !== input.orderId || typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))
      : data.workspace_id !== workspaceId || !positive(data.row_revision)
        || (input.action === "register_device" ? data.id !== input.id || data.name !== String(args.p_name).trim()
          : data.order_catalog_item_id !== input.catalogItemId || data.device_id !== input.deviceId || data.profile_version_id !== input.profileVersionId))) return { ok: false as const, status: 502, error: "invalid_lab_profile_response" };
    return { ok: true as const, status: 200 };
  } catch { return failure(); }
}
