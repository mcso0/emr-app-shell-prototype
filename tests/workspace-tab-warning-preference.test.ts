import { afterEach, expect, it, vi } from "vitest";
import {
  readDuplicateWarningPreference,
  writeDuplicateWarningPreference,
} from "../src/shell/workspace-tab-warning-preference";

afterEach(() => vi.unstubAllGlobals());

it("keeps server rendering free of browser storage access", () => {
  vi.stubGlobal("window", undefined);
  expect(readDuplicateWarningPreference("synthetic-a")).toBe(false);
  expect(writeDuplicateWarningPreference("synthetic-a")).toBeUndefined();
});

it("restores only the existing exact v1 opt-out flag", () => {
  const values = new Map<string, string>();
  const key = "clair-workspace-tabs-duplicate-warning-hidden:v1:synthetic-a";
  vi.stubGlobal("window", { localStorage: { getItem: (name: string) => values.get(name) ?? null } });
  expect(readDuplicateWarningPreference("synthetic-a")).toBe(false);
  for (const value of ["false", "1", "TRUE"]) {
    values.set(key, value);
    expect(readDuplicateWarningPreference("synthetic-a")).toBe(false);
  }
  values.set(key, "true");
  expect(readDuplicateWarningPreference("synthetic-a")).toBe(true);
});

it("persists opt-out for one workspace while retaining other preferences", () => {
  const values = new Map([["unrelated-preference", "retained"]]);
  vi.stubGlobal("window", { localStorage: {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
  } });
  writeDuplicateWarningPreference("synthetic-a");
  expect(values.get("clair-workspace-tabs-duplicate-warning-hidden:v1:synthetic-a")).toBe("true");
  expect(readDuplicateWarningPreference("synthetic-a")).toBe(true);
  expect(readDuplicateWarningPreference("synthetic-b")).toBe(false);
  expect(values.get("unrelated-preference")).toBe("retained");
});
