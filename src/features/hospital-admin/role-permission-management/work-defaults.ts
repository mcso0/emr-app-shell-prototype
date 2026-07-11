export type WorkspaceRoleWorkDefaults = {
  billingReviewPositionKey: string;
  chartPositionKey: string;
  labResultPositionKey: string;
  receptionPositionKey: string;
};

export const DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS: WorkspaceRoleWorkDefaults = {
  receptionPositionKey: "front_desk",
  chartPositionKey: "veterinarian",
  labResultPositionKey: "technician",
  billingReviewPositionKey: "front_desk",
};

const workspaceRoleWorkDefaultsStoragePrefix = "clair.workspaceRoleWorkDefaults.v1";

export function getWorkspaceRoleWorkDefaultsStorageKey(workspaceId: string) {
  return `${workspaceRoleWorkDefaultsStoragePrefix}:${workspaceId}`;
}

export function readWorkspaceRoleWorkDefaults(
  workspaceId: string,
  storage: Pick<Storage, "getItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): WorkspaceRoleWorkDefaults {
  const raw = storage?.getItem(getWorkspaceRoleWorkDefaultsStorageKey(workspaceId));
  if (!raw) return { ...DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS };

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceRoleWorkDefaults>;
    return {
      receptionPositionKey:
        typeof parsed.receptionPositionKey === "string"
          ? parsed.receptionPositionKey
          : DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS.receptionPositionKey,
      chartPositionKey:
        typeof parsed.chartPositionKey === "string"
          ? parsed.chartPositionKey
          : DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS.chartPositionKey,
      labResultPositionKey:
        typeof parsed.labResultPositionKey === "string"
          ? parsed.labResultPositionKey
          : DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS.labResultPositionKey,
      billingReviewPositionKey:
        typeof parsed.billingReviewPositionKey === "string"
          ? parsed.billingReviewPositionKey
          : DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS.billingReviewPositionKey,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_ROLE_WORK_DEFAULTS };
  }
}

export function persistWorkspaceRoleWorkDefaults(
  workspaceId: string,
  defaults: WorkspaceRoleWorkDefaults,
  storage: Pick<Storage, "setItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
) {
  storage?.setItem(getWorkspaceRoleWorkDefaultsStorageKey(workspaceId), JSON.stringify(defaults));
}
