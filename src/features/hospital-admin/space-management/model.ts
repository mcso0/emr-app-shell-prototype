export const spaceCategoryIconKeys = [
  "consult",
  "treatment",
  "exam",
  "surgery",
  "default",
] as const;

export type SpaceCategoryIconKey = (typeof spaceCategoryIconKeys)[number];

export type WorkspaceSpace = {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
};

export type WorkspaceSpaceCategory = {
  id: string;
  name: string;
  iconKey: SpaceCategoryIconKey;
  sortOrder: number;
  spaces: WorkspaceSpace[];
};

export type WorkspaceSpaceManagementSnapshot = {
  workspaceId: string;
  canManage: boolean;
  categories: WorkspaceSpaceCategory[];
};

export type SpaceManagementMutationInput =
  | { action: "category.create"; name: string }
  | { action: "category.rename"; categoryId: string; name: string }
  | {
      action: "category.delete";
      categoryId: string;
      moveTargetCategoryId?: string;
    }
  | { action: "space.create"; categoryId: string; name: string }
  | {
      action: "space.update";
      spaceId: string;
      categoryId: string;
      name: string;
    }
  | { action: "space.delete"; spaceId: string };

export type SpaceManagementErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "permission_missing"
  | "workspace_membership_missing"
  | "category_not_found"
  | "space_not_found"
  | "duplicate_category_name"
  | "duplicate_space_name"
  | "category_move_target_required"
  | "invalid_move_target"
  | "db_read_failed"
  | "db_write_failed";

const nameMaxLength = 50;

export function createDefaultWorkspaceSpaceManagementSnapshot(
  workspaceId: string,
): WorkspaceSpaceManagementSnapshot {
  return {
    workspaceId,
    canManage: true,
    categories: [
      createCategory("consult", "진료 공간", "consult", 0, ["진료실 1", "진료실 2"]),
      createCategory("treatment", "처치 공간", "treatment", 1, ["처치실 1"]),
      createCategory("exam", "검사 공간", "exam", 2, ["검사실 1", "영상 검사실"]),
      createCategory("surgery", "수술 공간", "surgery", 3, ["수술실 1"]),
    ],
  };
}

export function cloneWorkspaceSpaceManagementSnapshot(
  snapshot: WorkspaceSpaceManagementSnapshot,
): WorkspaceSpaceManagementSnapshot {
  return {
    ...snapshot,
    categories: snapshot.categories.map((category) => ({
      ...category,
      spaces: category.spaces.map((space) => ({ ...space })),
    })),
  };
}

export function parseWorkspaceSpaceManagementSnapshot(
  value: unknown,
): WorkspaceSpaceManagementSnapshot | null {
  if (!isRecord(value)) return null;
  const workspaceId = parseId(value.workspaceId);
  if (!workspaceId || typeof value.canManage !== "boolean" || !Array.isArray(value.categories)) {
    return null;
  }

  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  const spaceIds = new Set<string>();
  const categories: WorkspaceSpaceCategory[] = [];

  for (const item of value.categories) {
    if (!isRecord(item) || !Array.isArray(item.spaces)) return null;
    const id = parseId(item.id);
    const name = parseName(item.name);
    const iconKey = parseIconKey(item.iconKey);
    const sortOrder = parseSortOrder(item.sortOrder);
    if (!id || !name || !iconKey || sortOrder === null) return null;

    const categoryNameKey = normalizeComparisonKey(name);
    if (categoryIds.has(id) || categoryNames.has(categoryNameKey)) return null;
    categoryIds.add(id);
    categoryNames.add(categoryNameKey);

    const spaceNames = new Set<string>();
    const spaces: WorkspaceSpace[] = [];
    for (const spaceItem of item.spaces) {
      if (!isRecord(spaceItem)) return null;
      const spaceId = parseId(spaceItem.id);
      const categoryId = parseId(spaceItem.categoryId);
      const spaceName = parseName(spaceItem.name);
      const spaceSortOrder = parseSortOrder(spaceItem.sortOrder);
      if (
        !spaceId
        || categoryId !== id
        || !spaceName
        || spaceSortOrder === null
      ) {
        return null;
      }

      const spaceNameKey = normalizeComparisonKey(spaceName);
      if (spaceIds.has(spaceId) || spaceNames.has(spaceNameKey)) return null;
      spaceIds.add(spaceId);
      spaceNames.add(spaceNameKey);
      spaces.push({
        id: spaceId,
        categoryId,
        name: spaceName,
        sortOrder: spaceSortOrder,
      });
    }

    categories.push({
      id,
      name,
      iconKey,
      sortOrder,
      spaces: spaces.sort(compareBySortOrderThenName),
    });
  }

  return {
    workspaceId,
    canManage: value.canManage,
    categories: categories.sort(compareBySortOrderThenName),
  };
}

export function parseSpaceManagementMutationInput(
  value: unknown,
): SpaceManagementMutationInput | null {
  if (!isRecord(value) || typeof value.action !== "string") return null;

  switch (value.action) {
    case "category.create": {
      const name = parseName(value.name);
      return name ? { action: value.action, name } : null;
    }
    case "category.rename": {
      const categoryId = parseId(value.categoryId);
      const name = parseName(value.name);
      return categoryId && name ? { action: value.action, categoryId, name } : null;
    }
    case "category.delete": {
      const categoryId = parseId(value.categoryId);
      if (!categoryId) return null;
      if (value.moveTargetCategoryId === undefined) {
        return { action: value.action, categoryId };
      }
      const moveTargetCategoryId = parseId(value.moveTargetCategoryId);
      if (!moveTargetCategoryId || moveTargetCategoryId === categoryId) return null;
      return { action: value.action, categoryId, moveTargetCategoryId };
    }
    case "space.create": {
      const categoryId = parseId(value.categoryId);
      const name = parseName(value.name);
      return categoryId && name ? { action: value.action, categoryId, name } : null;
    }
    case "space.update": {
      const spaceId = parseId(value.spaceId);
      const categoryId = parseId(value.categoryId);
      const name = parseName(value.name);
      return spaceId && categoryId && name
        ? { action: value.action, spaceId, categoryId, name }
        : null;
    }
    case "space.delete": {
      const spaceId = parseId(value.spaceId);
      return spaceId ? { action: value.action, spaceId } : null;
    }
    default:
      return null;
  }
}

function createCategory(
  key: string,
  name: string,
  iconKey: SpaceCategoryIconKey,
  sortOrder: number,
  spaceNames: string[],
): WorkspaceSpaceCategory {
  const id = `category-${key}`;
  return {
    id,
    name,
    iconKey,
    sortOrder,
    spaces: spaceNames.map((spaceName, index) => ({
      id: `space-${key}-${index + 1}`,
      categoryId: id,
      name: spaceName,
      sortOrder: index,
    })),
  };
}

function parseName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= nameMaxLength ? name : null;
}

function parseId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 && id.length <= 128 ? id : null;
}

function parseIconKey(value: unknown): SpaceCategoryIconKey | null {
  return typeof value === "string"
    && (spaceCategoryIconKeys as readonly string[]).includes(value)
    ? value as SpaceCategoryIconKey
    : null;
}

function parseSortOrder(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function normalizeComparisonKey(value: string) {
  return value.toLocaleLowerCase("ko-KR");
}

function compareBySortOrderThenName(
  left: { sortOrder: number; name: string },
  right: { sortOrder: number; name: string },
) {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ko-KR");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
