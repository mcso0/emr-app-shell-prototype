import { expect, test } from "@playwright/test";

import {
  createDefaultWorkspaceVitalSettingsSnapshot,
  fromCanonicalVitalValue,
  getEnabledWorkspaceVitalSettings,
  parseWorkspaceVitalSettingsSnapshot,
  toCanonicalVitalValue,
} from "../src/features/patient-vitals/workspace-vital-settings";

test("workspace vital defaults enable the four approved presets in input order", () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();

  expect(snapshot.items.map((item) => [item.key, item.enabled, item.displayUnit])).toEqual([
    ["weight", true, "kg"],
    ["temperature", true, "°C"],
    ["heart_rate", true, "bpm"],
    ["respiratory_rate", true, "rpm"],
  ]);
  expect(snapshot.presets.map((preset) => preset.key)).toEqual([
    "weight",
    "temperature",
    "heart_rate",
    "respiratory_rate",
    "blood_pressure",
  ]);
});

test("workspace vital parser rejects unknown presets and unsupported display units", () => {
  const valid = createDefaultWorkspaceVitalSettingsSnapshot();

  expect(parseWorkspaceVitalSettingsSnapshot(valid)).toEqual(valid);
  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: [{ key: "weight", enabled: true, displayUnit: "lb", sortOrder: 0 }],
  })).toBeNull();
  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: [{ key: "unknown", enabled: true, displayUnit: "kg", sortOrder: 0 }],
  })).toBeNull();
});

test("workspace vital units convert through canonical storage without rewriting the source model", () => {
  expect(toCanonicalVitalValue("weight", 7400, "g")).toBe(7.4);
  expect(fromCanonicalVitalValue("weight", 7.4, "g")).toBe(7400);
  expect(toCanonicalVitalValue("temperature", 101.7, "°F")).toBe(38.7);
  expect(fromCanonicalVitalValue("temperature", 38.7, "°F")).toBe(101.7);
  expect(toCanonicalVitalValue("heart_rate", 88, "bpm")).toBe(88);
});

test("enabled vital selection follows saved order and keeps disabled items configured", () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();
  snapshot.items = [
    { key: "temperature", enabled: true, displayUnit: "°C", sortOrder: 0 },
    { key: "weight", enabled: false, displayUnit: "kg", sortOrder: 1 },
    { key: "heart_rate", enabled: true, displayUnit: "bpm", sortOrder: 2 },
  ];

  expect(getEnabledWorkspaceVitalSettings(snapshot).map((item) => item.key)).toEqual([
    "temperature",
    "heart_rate",
  ]);
  expect(snapshot.items).toHaveLength(3);
});
