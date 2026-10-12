const duplicateWarningPreferencePrefix = "clair-workspace-tabs-duplicate-warning-hidden:v1";

function getDuplicateWarningPreferenceKey(workspaceId: string) {
  return `${duplicateWarningPreferencePrefix}:${workspaceId}`;
}

export function readDuplicateWarningPreference(workspaceId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getDuplicateWarningPreferenceKey(workspaceId)) === "true";
}

export function writeDuplicateWarningPreference(workspaceId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getDuplicateWarningPreferenceKey(workspaceId), "true");
}
