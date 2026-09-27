export const workspaceVitalKeys = [
  "weight",
  "temperature",
  "heart_rate",
  "respiratory_rate",
  "blood_pressure",
] as const;

export type WorkspaceVitalKey = (typeof workspaceVitalKeys)[number];
export type WorkspaceVitalUnit = "kg" | "g" | "°C" | "°F" | "bpm" | "rpm" | "mmHg";

export type WorkspaceVitalPreset = {
  allowedDisplayUnits: WorkspaceVitalUnit[];
  canonicalUnit: WorkspaceVitalUnit;
  description: string;
  key: WorkspaceVitalKey;
  label: string;
  requiredInWorkspace: boolean;
};

export type WorkspaceVitalSetting = {
  displayUnit: WorkspaceVitalUnit;
  enabled: boolean;
  inputRequired: boolean;
  key: WorkspaceVitalKey;
  sortOrder: number;
};

export type WorkspaceVitalSettingsSnapshot = {
  canManage: boolean;
  items: WorkspaceVitalSetting[];
  presets: WorkspaceVitalPreset[];
};

export const defaultWorkspaceVitalPresets: WorkspaceVitalPreset[] = [
  {
    key: "weight",
    label: "체중",
    description: "환자의 현재 체중",
    canonicalUnit: "kg",
    allowedDisplayUnits: ["kg", "g"],
    requiredInWorkspace: false,
  },
  {
    key: "temperature",
    label: "체온",
    description: "체온계로 측정한 체온",
    canonicalUnit: "°C",
    allowedDisplayUnits: ["°C", "°F"],
    requiredInWorkspace: false,
  },
  {
    key: "heart_rate",
    label: "심박수",
    description: "분당 심장 박동 수",
    canonicalUnit: "bpm",
    allowedDisplayUnits: ["bpm"],
    requiredInWorkspace: false,
  },
  {
    key: "respiratory_rate",
    label: "호흡수",
    description: "분당 호흡 횟수",
    canonicalUnit: "rpm",
    allowedDisplayUnits: ["rpm"],
    requiredInWorkspace: false,
  },
  {
    key: "blood_pressure",
    label: "혈압(수축기/이완기)",
    description: "수축기와 이완기 혈압",
    canonicalUnit: "mmHg",
    allowedDisplayUnits: ["mmHg"],
    requiredInWorkspace: false,
  },
];

const defaultConfiguredKeys: WorkspaceVitalKey[] = [...workspaceVitalKeys];

export function createDefaultWorkspaceVitalSettingsSnapshot(
  canManage = true,
): WorkspaceVitalSettingsSnapshot {
  return {
    canManage,
    presets: defaultWorkspaceVitalPresets.map(clonePreset),
    items: defaultConfiguredKeys.map((key, sortOrder) => {
      const preset = getWorkspaceVitalPreset(key);
      return {
        key,
        enabled: true,
        inputRequired: false,
        displayUnit: preset.canonicalUnit,
        sortOrder,
      };
    }),
  };
}

export function parseWorkspaceVitalSettingsSnapshot(
  value: unknown,
): WorkspaceVitalSettingsSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.presets) || !Array.isArray(value.items)) {
    return null;
  }

  const presets = value.presets.flatMap((item): WorkspaceVitalPreset[] => {
    if (!isRecord(item) || !isWorkspaceVitalKey(item.key)) return [];
    if (
      typeof item.label !== "string" ||
      typeof item.description !== "string" ||
      typeof item.requiredInWorkspace !== "boolean" ||
      !isWorkspaceVitalUnit(item.canonicalUnit) ||
      !Array.isArray(item.allowedDisplayUnits) ||
      !item.allowedDisplayUnits.every(isWorkspaceVitalUnit)
    ) {
      return [];
    }
    return [{
      key: item.key,
      label: item.label,
      description: item.description,
      canonicalUnit: item.canonicalUnit,
      allowedDisplayUnits: [...item.allowedDisplayUnits],
      requiredInWorkspace: item.requiredInWorkspace,
    }];
  });
  if (presets.length !== value.presets.length || new Set(presets.map((item) => item.key)).size !== presets.length) {
    return null;
  }

  const presetByKey = new Map(presets.map((preset) => [preset.key, preset]));
  const items = value.items.flatMap((item): WorkspaceVitalSetting[] => {
    if (!isRecord(item) || !isWorkspaceVitalKey(item.key)) return [];
    const preset = presetByKey.get(item.key);
    if (
      !preset ||
      typeof item.enabled !== "boolean" ||
      (item.inputRequired !== undefined && typeof item.inputRequired !== "boolean") ||
      (item.inputRequired === true && !item.enabled) ||
      !isWorkspaceVitalUnit(item.displayUnit) ||
      !preset.allowedDisplayUnits.includes(item.displayUnit) ||
      typeof item.sortOrder !== "number" ||
      !Number.isInteger(item.sortOrder) ||
      item.sortOrder < 0
    ) {
      return [];
    }
    return [{
      key: item.key,
      enabled: item.enabled,
      inputRequired: item.inputRequired === true,
      displayUnit: item.displayUnit,
      sortOrder: item.sortOrder,
    }];
  });
  if (
    items.length !== value.items.length ||
    new Set(items.map((item) => item.key)).size !== items.length ||
    new Set(items.map((item) => item.sortOrder)).size !== items.length ||
    presets.some((preset) => preset.requiredInWorkspace && !items.some(
      (item) => item.key === preset.key && item.enabled,
    ))
  ) {
    return null;
  }

  return {
    canManage: value.canManage !== false,
    presets: presets.map(clonePreset),
    items: items.sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function getWorkspaceVitalPreset(key: WorkspaceVitalKey) {
  const preset = defaultWorkspaceVitalPresets.find((item) => item.key === key);
  if (!preset) throw new Error(`Unknown workspace vital preset: ${key}`);
  return preset;
}

export function getEnabledWorkspaceVitalSettings(snapshot: WorkspaceVitalSettingsSnapshot) {
  return snapshot.items
    .filter((item) => item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export type RequiredVitalValueKey =
  | "weightKg"
  | "temperatureC"
  | "heartRateBpm"
  | "respiratoryRateRpm"
  | "bloodPressureSystolicMmhg"
  | "bloodPressureDiastolicMmhg";

export function getRequiredWorkspaceVitalFieldErrors(
  snapshot: WorkspaceVitalSettingsSnapshot,
  values: Partial<Record<RequiredVitalValueKey, number | string | null>>,
): Partial<Record<RequiredVitalValueKey, string>> {
  const errors: Partial<Record<RequiredVitalValueKey, string>> = {};
  const missing = (key: RequiredVitalValueKey) =>
    values[key] === undefined || values[key] === null ||
    (typeof values[key] === "string" && !(values[key] as string).trim());

  for (const item of snapshot.items) {
    if (!item.enabled || !item.inputRequired) continue;
    if (item.key === "weight" && missing("weightKg")) errors.weightKg = "체중을 입력해 주세요.";
    if (item.key === "temperature" && missing("temperatureC")) errors.temperatureC = "체온을 입력해 주세요.";
    if (item.key === "heart_rate" && missing("heartRateBpm")) errors.heartRateBpm = "심박수를 입력해 주세요.";
    if (item.key === "respiratory_rate" && missing("respiratoryRateRpm")) errors.respiratoryRateRpm = "호흡수를 입력해 주세요.";
    if (item.key === "blood_pressure") {
      if (missing("bloodPressureSystolicMmhg")) errors.bloodPressureSystolicMmhg = "수축기 혈압을 입력해 주세요.";
      if (missing("bloodPressureDiastolicMmhg")) errors.bloodPressureDiastolicMmhg = "이완기 혈압을 입력해 주세요.";
    }
  }
  return errors;
}

export function toCanonicalVitalValue(
  key: WorkspaceVitalKey,
  value: number,
  displayUnit: WorkspaceVitalUnit,
) {
  if (key === "weight" && displayUnit === "g") return round(value / 1000, 2);
  if (key === "temperature" && displayUnit === "°F") {
    return round(((value - 32) * 5) / 9, 1);
  }
  return value;
}

export function fromCanonicalVitalValue(
  key: WorkspaceVitalKey,
  value: number,
  displayUnit: WorkspaceVitalUnit,
) {
  if (key === "weight" && displayUnit === "g") return round(value * 1000, 2);
  if (key === "temperature" && displayUnit === "°F") {
    return round((value * 9) / 5 + 32, 1);
  }
  return value;
}

export function cloneWorkspaceVitalSettingsSnapshot(
  snapshot: WorkspaceVitalSettingsSnapshot,
): WorkspaceVitalSettingsSnapshot {
  return {
    canManage: snapshot.canManage,
    presets: snapshot.presets.map(clonePreset),
    items: snapshot.items.map((item) => ({ ...item })),
  };
}

export function isWorkspaceVitalKey(value: unknown): value is WorkspaceVitalKey {
  return typeof value === "string" && workspaceVitalKeys.includes(value as WorkspaceVitalKey);
}

function clonePreset(preset: WorkspaceVitalPreset): WorkspaceVitalPreset {
  return { ...preset, allowedDisplayUnits: [...preset.allowedDisplayUnits] };
}

function isWorkspaceVitalUnit(value: unknown): value is WorkspaceVitalUnit {
  return ["kg", "g", "°C", "°F", "bpm", "rpm", "mmHg"].includes(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
