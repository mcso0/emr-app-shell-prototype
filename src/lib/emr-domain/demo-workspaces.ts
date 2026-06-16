export const LEGACY_SALES_DEMO_WORKSPACE_ID = "clair-demo";
export const PREPARED_EMPTY_CLINIC_WORKSPACE_ID = "workspace-clair-cheongdam";

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
