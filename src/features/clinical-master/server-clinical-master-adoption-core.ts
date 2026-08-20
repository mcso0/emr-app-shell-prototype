export type ClinicalMasterAdoptionSummary = {
  ok: true;
  workspaceId: string;
  releaseId: string;
  createdCount: number;
  autoAppliedCount: number;
  reviewCount: number;
  notificationCount: number;
  enforcedBy: "clinical-master-workspace-adoption";
};

export type ClinicalMasterAdoptionError = {
  ok: false;
  code:
    | "release_not_published"
    | "release_not_latest"
    | "workspace_required"
    | "adoption_failed";
  message: string;
};

export type ClinicalMasterAdoptionExecutor = {
  adoptMasterReleaseToWorkspace(input: {
    releaseId: string;
    workspaceId: string;
  }): Promise<unknown>;
};

export async function adoptClinicalMasterReleaseToWorkspace({
  executor,
  releaseId,
  workspaceId,
}: {
  executor: ClinicalMasterAdoptionExecutor;
  releaseId: string;
  workspaceId: string;
}): Promise<ClinicalMasterAdoptionSummary | ClinicalMasterAdoptionError> {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedReleaseId = releaseId.trim();
  if (!normalizedWorkspaceId) {
    return {
      ok: false,
      code: "workspace_required",
      message: "워크스페이스가 필요합니다.",
    };
  }
  if (!normalizedReleaseId) {
    return {
      ok: false,
      code: "adoption_failed",
      message: "마스터 릴리스가 필요합니다.",
    };
  }

  try {
    const response = await executor.adoptMasterReleaseToWorkspace({
      releaseId: normalizedReleaseId,
      workspaceId: normalizedWorkspaceId,
    });
    if (isRecord(response) && response.ok === true) {
      return {
        ok: true,
        workspaceId: normalizedWorkspaceId,
        releaseId: normalizedReleaseId,
        createdCount: readNonNegativeInteger(response.createdCount),
        autoAppliedCount: readNonNegativeInteger(response.autoAppliedCount),
        reviewCount: readNonNegativeInteger(response.reviewCount),
        notificationCount: readNonNegativeInteger(response.notificationCount),
        enforcedBy: "clinical-master-workspace-adoption",
      };
    }

    return mapAdoptionError(response);
  } catch (error) {
    return mapAdoptionError(error);
  }
}

function mapAdoptionError(value: unknown): ClinicalMasterAdoptionError {
  const message =
    value instanceof Error
      ? value.message
      : isRecord(value) && typeof value.message === "string"
        ? value.message
        : "임상 마스터 릴리스를 적용하지 못했습니다.";
  if (message.includes("clinical_master_release_not_published")) {
    return { ok: false, code: "release_not_published", message };
  }
  if (message.includes("clinical_master_release_not_latest")) {
    return { ok: false, code: "release_not_latest", message };
  }
  if (message.includes("workspace_id_required")) {
    return { ok: false, code: "workspace_required", message };
  }
  return { ok: false, code: "adoption_failed", message };
}

function readNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
