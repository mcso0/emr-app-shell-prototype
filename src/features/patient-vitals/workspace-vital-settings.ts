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
    requiredInWorkspace: true,
  },
  {
    key: "temperature",
    label: "체온",
    description: "체온계로 측정한 체온",
    canonicalUnit: "°C",
    allowedDisplayUnits: ["°C", "°F"],
    requiredInWorkspace: true,
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
    label: "혈압",
    description: "수축기 단독 또는 수축기/이완기",
    canonicalUnit: "mmHg",
    allowedDisplayUnits: ["mmHg"],
    requiredInWorkspace: false,
  },
];

const defaultConfiguredKeys: WorkspaceVitalKey[] = [
  "weight",
  "temperature",
  "heart_rate",
  "respiratory_rate",
];

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
