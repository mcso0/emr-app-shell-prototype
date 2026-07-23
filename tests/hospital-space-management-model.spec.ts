import { expect, test } from "@playwright/test";

import {
  createDefaultWorkspaceSpaceManagementSnapshot,
  parseSpaceManagementMutationInput,
  parseWorkspaceSpaceManagementSnapshot,
} from "../src/features/hospital-admin/space-management/model";

test("space management defaults expose category-first navigation with semantic icons", () => {
  const snapshot = createDefaultWorkspaceSpaceManagementSnapshot("clair-demo");

  expect(snapshot).toMatchObject({
    workspaceId: "clair-demo",
    canManage: true,
  });
  expect(snapshot.categories.map(({ iconKey, name, spaces }) => ({
    iconKey,
    name,
    spaces: spaces.map((space) => space.name),
  }))).toEqual([
    { iconKey: "consult", name: "진료 공간", spaces: ["진료실 1", "진료실 2"] },
    { iconKey: "treatment", name: "처치 공간", spaces: ["처치실 1"] },
    { iconKey: "exam", name: "검사 공간", spaces: ["검사실 1", "영상 검사실"] },
    { iconKey: "surgery", name: "수술 공간", spaces: ["수술실 1"] },
  ]);
});

test("space management parser normalizes names and sorts nested records", () => {
  const parsed = parseWorkspaceSpaceManagementSnapshot({
    workspaceId: "clair-demo",
    canManage: false,
    categories: [
      {
        id: "category-b",
        name: "  검사   공간 ",
        iconKey: "exam",
        sortOrder: 2,
        spaces: [
          { id: "space-b", categoryId: "category-b", name: "  검사실   2 ", sortOrder: 1 },
          { id: "space-a", categoryId: "category-b", name: "검사실 1", sortOrder: 0 },
        ],
      },
      {
        id: "category-a",
        name: "진료 공간",
        iconKey: "consult",
        sortOrder: 0,
        spaces: [],
      },
    ],
  });

  expect(parsed?.categories.map((category) => category.name)).toEqual(["진료 공간", "검사 공간"]);
  expect(parsed?.categories[1]?.spaces.map((space) => space.name)).toEqual(["검사실 1", "검사실 2"]);
});

test("space management parser rejects unknown icons and case-insensitive duplicate names", () => {
  const snapshot = createDefaultWorkspaceSpaceManagementSnapshot("clair-demo");

  expect(parseWorkspaceSpaceManagementSnapshot({
    ...snapshot,
    categories: [
      ...snapshot.categories,
      {
        id: "duplicate-category",
        name: " 진료 공간 ",
        iconKey: "default",
        sortOrder: 10,
        spaces: [],
      },
    ],
  })).toBeNull();

  expect(parseWorkspaceSpaceManagementSnapshot({
    ...snapshot,
    categories: snapshot.categories.map((category, index) => index === 0
      ? {
          ...category,
          spaces: [
            ...category.spaces,
            {
              id: "duplicate-space",
              categoryId: category.id,
              name: "진료실 1",
              sortOrder: 10,
            },
          ],
        }
      : category),
  })).toBeNull();

  expect(parseWorkspaceSpaceManagementSnapshot({
    ...snapshot,
    categories: snapshot.categories.map((category, index) => index === 0
      ? { ...category, iconKey: "clock" }
      : category),
  })).toBeNull();
});

test("space management mutation parser accepts only the six approved commands", () => {
  expect(parseSpaceManagementMutationInput({
    action: "category.create",
    name: "  입원   공간 ",
  })).toEqual({ action: "category.create", name: "입원 공간" });

  expect(parseSpaceManagementMutationInput({
    action: "category.delete",
    categoryId: "category-consult",
    moveTargetCategoryId: "category-treatment",
  })).toEqual({
    action: "category.delete",
    categoryId: "category-consult",
    moveTargetCategoryId: "category-treatment",
  });

  expect(parseSpaceManagementMutationInput({
    action: "space.update",
    spaceId: "space-consult-1",
    categoryId: "category-consult",
    name: "진료실 3",
  })).toEqual({
    action: "space.update",
    spaceId: "space-consult-1",
    categoryId: "category-consult",
    name: "진료실 3",
  });

  for (const invalid of [
    { action: "category.create", name: "   " },
    { action: "category.rename", categoryId: "", name: "진료 공간" },
    { action: "category.delete", categoryId: "category-a", moveTargetCategoryId: "category-a" },
    { action: "space.create", categoryId: "category-a", name: "x".repeat(51) },
    { action: "space.update", spaceId: "space-a", categoryId: "", name: "진료실" },
    { action: "space.delete", spaceId: "" },
    { action: "category.reorder", categoryId: "category-a" },
  ]) {
    expect(parseSpaceManagementMutationInput(invalid)).toBeNull();
  }
});
