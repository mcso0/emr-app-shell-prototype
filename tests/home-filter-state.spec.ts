import { expect, test } from "@playwright/test";
import { createInitialEmrTableFilterBuilderModel } from "../src/components/emr/table-filter-builder-model";
import { useHomeWorkspaceStore } from "../src/features/home/home-workspace-store";

test("Home builder state survives view navigation and resets at workspace or session boundaries", () => {
  const store = useHomeWorkspaceStore;
  store.getState().endSession();
  store.getState().activate("test-user:workspace-a", "2026-09-08");
  const model = createInitialEmrTableFilterBuilderModel("selected-hospital-filter");
  model.groups[0].rules[0] = { id: "owner-rule", fieldId: "owner", operatorId: "is", value: "김수의", applied: { fieldId: "owner", operatorId: "is", value: "김수의" } };
  store.getState().updateFilter("hospital", model);
  store.getState().setView("mine");
  expect(store.getState().filters.mine.groups[0].rules[0].applied).toBeNull();
  store.getState().setView("hospital");
  store.getState().activate("test-user:workspace-a", "2026-09-08");
  expect(store.getState().filters.hospital).toEqual(model);
  store.getState().activate("test-user:workspace-b", "2026-09-08");
  expect(store.getState().filters.hospital.groups[0].rules[0].applied).toBeNull();
  store.getState().updateFilter("hospital", model);
  store.getState().endSession();
  expect(store.getState().filters.hospital.groups[0].rules[0].applied).toBeNull();
});
