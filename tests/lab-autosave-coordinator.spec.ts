import { expect, test } from "@playwright/test";
import { LabAutosaveCoordinator, type LabAutosaveOutcome, type LabAutosaveState } from "../src/features/lab-imaging/lab-autosave";

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function fixture(validate?: (value: string) => string | null) {
  const calls: Array<{ value: string; requestId: string; revision: number; resolve: (outcome: LabAutosaveOutcome) => void }> = [];
  const states: LabAutosaveState[] = [];
  const coordinator = new LabAutosaveCoordinator<string>((value, requestId, revision) =>
    new Promise(resolve => calls.push({ value, requestId, revision, resolve })), 0, state => states.push(state), validate, 0);
  return { coordinator, calls, states };
}

test("lab autosave coalesces typing and does not write on mount", async () => {
  const { coordinator, calls, states } = fixture();
  await tick(); expect(calls).toHaveLength(0);
  coordinator.change("a"); coordinator.change("abc"); await tick();
  expect(calls).toHaveLength(1); expect(calls[0].value).toBe("abc");
  calls[0].resolve({ ok: true, revision: 1 }); await tick();
  expect(states.at(-1)).toMatchObject({ value: "saved", revision: 1 });
});

test("lab autosave serializes edits during saving with the returned revision", async () => {
  const { coordinator, calls, states } = fixture();
  coordinator.change("first"); await tick();
  coordinator.change("second"); await tick();
  coordinator.configure((value, requestId, revision) => new Promise(resolve => calls.push({ value, requestId, revision, resolve })), 99);
  expect(calls).toHaveLength(1);
  calls[0].resolve({ ok: true, revision: 1 }); await tick();
  expect(calls).toHaveLength(2); expect(calls[1]).toMatchObject({ value: "second", revision: 1 });
  expect(states.at(-1)?.value).toBe("saving");
  calls[1].resolve({ ok: true, revision: 2 }); await tick();
  expect(states.at(-1)).toMatchObject({ value: "saved", revision: 2 });
});

test("lab autosave retries the identical ambiguous request before newer edits", async () => {
  const { coordinator, calls, states } = fixture();
  coordinator.change("first"); await tick();
  calls[0].resolve({ ok: false, reason: "error", retryable: true, message: "저장 실패" }); await tick();
  coordinator.change("newest"); await tick(); expect(calls).toHaveLength(1);
  expect(states.at(-1)?.value).toBe("error");
  coordinator.retry(); await tick();
  expect(calls[1]).toMatchObject({ value: "first", requestId: calls[0].requestId, revision: 0 });
  calls[1].resolve({ ok: true, revision: 1 }); await tick();
  expect(calls[2]).toMatchObject({ value: "newest", revision: 1 });
  expect(calls[2].requestId).not.toBe(calls[0].requestId);
  calls[2].resolve({ ok: true, revision: 2 }); await tick();
  expect(states.at(-1)?.value).toBe("saved");
});

test("lab autosave leaves invalid input unsaved until corrected", async () => {
  const { coordinator, calls, states } = fixture(value => value === "-" ? "값 확인 필요" : null);
  coordinator.change("-"); await tick();
  expect(calls).toHaveLength(0); expect(states.at(-1)?.value).toBe("invalid");
  expect(coordinator.hasUnsavedChanges()).toBe(true);
  coordinator.change("-1"); await tick();
  expect(calls[0].value).toBe("-1"); calls[0].resolve({ ok: true, revision: 1 }); await tick();
});

test("lab autosave preserves and blocks conflicting or forbidden edits", async () => {
  for (const reason of ["conflict", "permission_denied"] as const) {
    const { coordinator, calls, states } = fixture();
    coordinator.change("first"); await tick();
    calls[0].resolve({ ok: false, reason, retryable: false, message: "수정 확인 필요" }); await tick();
    coordinator.change("keep this draft"); coordinator.flush(); coordinator.retry(); await tick();
    expect(calls).toHaveLength(1); expect(states.at(-1)?.value).toBe(reason);
    expect(coordinator.hasUnsavedChanges()).toBe(true);
  }
});

test("lab autosave flushes on unmount and drains edits after the in-flight request", async () => {
  const { coordinator, calls, states } = fixture();
  coordinator.change("first"); await tick();
  coordinator.change("last"); coordinator.dispose();
  const count = states.length;
  calls[0].resolve({ ok: true, revision: 1 }); await tick();
  expect(calls[1]).toMatchObject({ value: "last", revision: 1 });
  calls[1].resolve({ ok: true, revision: 2 }); await tick();
  expect(states).toHaveLength(count); expect(coordinator.hasUnsavedChanges()).toBe(false);
});
