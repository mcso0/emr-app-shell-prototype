import { test, expect } from "@playwright/test";
import { parseInpatientLocationConfiguration, parseInpatientLocationMutation } from "../src/features/inpatient/inpatient-location-contract";
import { readInpatientLocations, saveInpatientLocation } from "../src/features/inpatient/server-inpatient-location-core";
const location = { id: "97070000-0000-4000-8000-000000000001", label: "Synthetic registered cage", kind: "cage", active: true, rowRevision: 1 };
const configuration = { workspaceId: "workspace", canManage: true, locations: [location] };
test("locations preserve real ID and empty is empty; malformed and foreign payloads fail", () => {
  expect(parseInpatientLocationConfiguration(configuration, "workspace")).toEqual(configuration);
  expect(parseInpatientLocationConfiguration({ ...configuration, locations: [] }, "workspace")?.locations).toEqual([]);
  expect(parseInpatientLocationConfiguration(configuration, "foreign")).toBeNull();
  expect(parseInpatientLocationConfiguration({ ...configuration, locations: [location, location] }, "workspace")).toBeNull();
  expect(parseInpatientLocationConfiguration({ ...configuration, locations: [{ ...location, id: "mock-ward" }] }, "workspace")).toBeNull();
});
test("location mutation requires registered UUID and exact nonnegative revision; no arbitrary keys", () => {
  const input = { id: location.id, label: location.label, kind: location.kind, active: location.active, expectedRevision: 0 };
  expect(parseInpatientLocationMutation(input)).toEqual(input);
  for (const patch of [{ id: "ward A" }, { expectedRevision: -1 }, { expectedRevision: 0.5 }, { label: " " }, { label: " x " }, { active: "true" }, { kind: "bed" }, { actorUserId: "spoof" }]) {
    expect(parseInpatientLocationMutation({ ...input, ...patch })).toBeNull();
  }
});
test("RPC read and write reject foreign/stale response and retain explicit denial", async () => {
  let calls = 0;
  const client = { rpc: async () => { calls++; return { data: { ...configuration, workspaceId: "foreign" }, error: null }; } };
  expect(await readInpatientLocations(client, "workspace")).toMatchObject({ ok: false, status: 502 });
  expect(await saveInpatientLocation(client, "workspace", { id: "mock-ward" })).toMatchObject({ ok: false, status: 400 });
  expect(calls).toBe(1);
  expect(await readInpatientLocations({ rpc: async () => ({ data: null, error: { message: "permission_missing" } }) }, "workspace")).toMatchObject({ status: 403 });
  const input = { id: location.id, label: location.label, kind: location.kind, active: location.active, expectedRevision: 1 };
  expect(await saveInpatientLocation({ rpc: async () => ({ data: configuration, error: null }) }, "workspace", input)).toMatchObject({ status: 502 });
  expect(await saveInpatientLocation({ rpc: async () => ({ data: { ...configuration, locations: [{ ...location, rowRevision: 2 }] }, error: null }) }, "workspace", input)).toMatchObject({ ok: true, status: 200 });
});
