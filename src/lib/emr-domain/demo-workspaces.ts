export const LEGACY_SALES_DEMO_WORKSPACE_ID = "clair-demo";
export const PREPARED_EMPTY_CLINIC_WORKSPACE_ID = "workspace-clair-cheongdam";
// Cheongdam seed path is the default verification target; legacy Sales Demo must be explicit.
export const DEFAULT_SEED_VERIFICATION_WORKSPACE_ID =
  PREPARED_EMPTY_CLINIC_WORKSPACE_ID;

export const PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME =
  "VIP동물의료센터 청담점";
export const LEGACY_SALES_DEMO_WORKSPACE_DISPLAY_NAME =
  "VIP 동물의료센터 청담점";

export const DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF =
  `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open&aside=closed`;

export function isLegacySalesDemoWorkspace(workspaceId?: string | null) {
  return workspaceId === LEGACY_SALES_DEMO_WORKSPACE_ID;
}

export function isPreparedEmptyClinicWorkspace(workspaceId?: string | null) {
  return workspaceId === PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
}

export function resolveWorkspaceRouteParam(
  value?: string | string[] | null,
  fallbackWorkspaceId = DEFAULT_SEED_VERIFICATION_WORKSPACE_ID,
) {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value[0]) return value[0];

  return fallbackWorkspaceId;
}

export function resolveWorkspacePathname(
  pathname?: string | null,
  fallbackWorkspaceId = DEFAULT_SEED_VERIFICATION_WORKSPACE_ID,
) {
  if (!pathname) return fallbackWorkspaceId;

  const match = pathname.match(/^\/w\/([^/]+)/);
  return match?.[1] ?? fallbackWorkspaceId;
}
