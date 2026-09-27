import { expect, test } from "@playwright/test";

import { formatPatientVitalDisplayItemsForSettings } from "../src/features/patient-vitals/patient-vital-types";
import {
  createDefaultWorkspaceVitalSettingsSnapshot,
  fromCanonicalVitalValue,
  getEnabledWorkspaceVitalSettings,
  getRequiredWorkspaceVitalFieldErrors,
  parseWorkspaceVitalSettingsSnapshot,
  toCanonicalVitalValue,
} from "../src/features/patient-vitals/workspace-vital-settings";

test("workspace vital defaults enable all five presets without required inputs", () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();

  expect(snapshot.items.map((item) => [item.key, item.enabled, item.displayUnit])).toEqual([
    ["weight", true, "kg"],
    ["temperature", true, "°C"],
    ["heart_rate", true, "bpm"],
    ["respiratory_rate", true, "rpm"],
    ["blood_pressure", true, "mmHg"],
  ]);
  expect(snapshot.items.every((item) => !item.inputRequired)).toBe(true);
  expect(snapshot.presets.map((preset) => preset.key)).toEqual([
    "weight",
    "temperature",
    "heart_rate",
    "respiratory_rate",
    "blood_pressure",
  ]);
  expect(snapshot.presets.map((preset) => [preset.key, preset.requiredInWorkspace])).toEqual([
    ["weight", false],
    ["temperature", false],
    ["heart_rate", false],
    ["respiratory_rate", false],
    ["blood_pressure", false],
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

test("workspace vital parser allows deletion and disabling but rejects required disabled items", () => {
  const valid = createDefaultWorkspaceVitalSettingsSnapshot();

  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: valid.items.filter((item) => item.key !== "weight"),
  })?.items).toHaveLength(4);
  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: valid.items.map((item) => item.key === "temperature"
      ? { ...item, enabled: false }
      : item),
  })?.items.find((item) => item.key === "temperature")?.enabled).toBe(false);
  expect(parseWorkspaceVitalSettingsSnapshot({ ...valid, items: [] })?.items).toEqual([]);
  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: valid.items.map((item) => item.key === "temperature"
      ? { ...item, enabled: false, inputRequired: true }
      : item),
  })).toBeNull();
});

test("required vital validation includes both blood pressure values", () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();
  snapshot.items = snapshot.items.map((item) => item.key === "blood_pressure"
    ? { ...item, inputRequired: true }
    : item);

  expect(getRequiredWorkspaceVitalFieldErrors(snapshot, {
    bloodPressureSystolicMmhg: 120,
  })).toEqual({ bloodPressureDiastolicMmhg: "이완기 혈압을 입력해 주세요." });
  expect(getRequiredWorkspaceVitalFieldErrors(snapshot, {
    bloodPressureSystolicMmhg: 120,
    bloodPressureDiastolicMmhg: 80,
  })).toEqual({});
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
    { key: "temperature", enabled: true, inputRequired: false, displayUnit: "°C", sortOrder: 0 },
    { key: "weight", enabled: false, inputRequired: false, displayUnit: "kg", sortOrder: 1 },
    { key: "heart_rate", enabled: true, inputRequired: false, displayUnit: "bpm", sortOrder: 2 },
  ];

  expect(getEnabledWorkspaceVitalSettings(snapshot).map((item) => item.key)).toEqual([
    "temperature",
    "heart_rate",
  ]);
  expect(snapshot.items).toHaveLength(3);
});

test("patient context vital items follow workspace visibility, order, units, and systolic-only blood pressure", () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();
  snapshot.items = [
    { key: "temperature", enabled: true, inputRequired: false, displayUnit: "°F", sortOrder: 0 },
    { key: "weight", enabled: false, inputRequired: false, displayUnit: "g", sortOrder: 1 },
    { key: "blood_pressure", enabled: true, inputRequired: false, displayUnit: "mmHg", sortOrder: 2 },
    { key: "heart_rate", enabled: true, inputRequired: false, displayUnit: "bpm", sortOrder: 3 },
  ];

  expect(formatPatientVitalDisplayItemsForSettings({
    temperatureC: 38.7,
    weightKg: 7.4,
    bloodPressureSystolicMmhg: 120,
    heartRateBpm: 88,
  }, snapshot)).toEqual([
    { label: "체온", value: "101.7°F" },
    { label: "혈압", value: "120 mmHg" },
    { label: "심박수", value: "88 bpm" },
  ]);
});
