import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import { ModuleKind, transpileModule } from "typescript";
import * as zustand from "zustand";
import { SHELL_LAYOUT } from "../src/shell/layout-contract";
import type { useLayoutStore } from "../src/stores/layout-store";

function layoutStore(): typeof useLayoutStore {
  const exports: { useLayoutStore?: typeof useLayoutStore } = {};
  const source = transpileModule(readFileSync("src/stores/layout-store.ts", "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { exports, require: (name: string) => {
    if (name === "zustand") return zustand;
    if (name === "@/shell/layout-contract") return { SHELL_LAYOUT };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports.useLayoutStore!;
}

for (const type of ["patient", "guardian", "staff-operational-profile"]) {
  test(`${type} can switch profiles and close without losing the reception task`, () => {
    const store = layoutStore();
    const task = { type: "reception-form", id: "walk-in", hasUnsavedChanges: true };
    store.getState().setReceptionCalendarScope("synthetic-workspace");
    store.getState().setActiveDrawer(task);
    store.getState().setActiveDrawer({ type, id: "synthetic-profile" });
    expect(store.getState().retainedReceptionDrawer).toEqual(task);
    store.getState().setActiveDrawer({ type: "guardian", id: "related-profile" });
    expect(store.getState().retainedReceptionDrawer).toEqual(task);
    store.getState().setActiveDrawer(null);
    expect(store.getState().activeDrawer).toEqual(task);
    expect(store.getState().retainedReceptionDrawer).toBeNull();
  });
}

test("closing a calendar form preserves the profile and cannot resurrect the form", () => {
  const store = layoutStore();
  store.getState().setReceptionCalendarScope("synthetic-workspace");
  store.getState().setActiveDrawer({ type: "reception-reservation-form", id: "new" });
  const profile = { type: "patient", id: "synthetic-profile" };
  store.getState().setActiveDrawer(profile);
  store.getState().setReceptionCalendarOpen(false);
  store.getState().setReceptionCalendarDrawer(null);
  expect(store.getState().activeDrawer).toEqual(profile);
  expect(store.getState().rightPanelOpen).toBe(true);
  expect(store.getState().retainedReceptionDrawer).toBeNull();
  store.getState().setActiveDrawer(null);
  expect(store.getState().activeDrawer).toBeNull();
});

test("explicit profile returns and module changes clear retained calendar state", () => {
  const store = layoutStore();
  const task = { type: "reception-form", id: "walk-in" };
  store.getState().setReceptionCalendarScope("synthetic-workspace");
  store.getState().setActiveDrawer(task);
  store.getState().setReceptionCalendarDrawer({ type: "patient", id: "return-target" });
  expect(store.getState().retainedReceptionDrawer).toBeNull();
  store.getState().setActiveDrawer(task);
  store.getState().setActiveDrawer({ type: "patient", id: "synthetic-profile" });
  store.getState().enterModule();
  store.getState().setReceptionCalendarScope(null);
  expect(store.getState().retainedReceptionDrawer).toBeNull();
  expect(store.getState().activeDrawer).toBeNull();
  store.getState().setActiveDrawer(task);
  store.getState().setActiveDrawer({ type: "patient", id: "other-module-profile" });
  expect(store.getState().retainedReceptionDrawer).toBeNull();
});
