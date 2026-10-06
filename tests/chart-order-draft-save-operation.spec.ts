import { expect, test } from "@playwright/test";
import { registerChartOrderDraftSaveOperation } from "../src/features/chart/chart-order-draft-save-operation";

function deferred() {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<boolean>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function refs() {
  return {
    pending: { current: null as Promise<boolean> | null },
    inFlight: { current: true },
  };
}

test("registers synchronously and returns the original save Promise", async () => {
  const save = deferred();
  const { pending, inFlight } = refs();
  const returned = registerChartOrderDraftSaveOperation(save.promise, pending, inFlight);

  expect(returned).toBe(save.promise);
  expect(pending.current).toBe(save.promise);
  expect(inFlight.current).toBe(true);
  save.resolve(true);
  await returned;
});

test("clears in a settlement microtask before the waiting caller resumes", async () => {
  const save = deferred();
  const { pending, inFlight } = refs();
  const returned = registerChartOrderDraftSaveOperation(save.promise, pending, inFlight);

  save.resolve(true);
  expect(pending.current).toBe(save.promise);
  expect(inFlight.current).toBe(true);
  expect(await returned).toBe(true);
  expect(pending.current).toBeNull();
  expect(inFlight.current).toBe(false);
});

test("preserves a false save result and releases the registered operation", async () => {
  const save = deferred();
  const { pending, inFlight } = refs();
  const returned = registerChartOrderDraftSaveOperation(save.promise, pending, inFlight);

  save.resolve(false);
  expect(await returned).toBe(false);
  expect(pending.current).toBeNull();
  expect(inFlight.current).toBe(false);
});

test("preserves the rejection object and releases the registered operation", async () => {
  const save = deferred();
  const { pending, inFlight } = refs();
  const failure = new Error("synthetic save rejection");
  const returned = registerChartOrderDraftSaveOperation(save.promise, pending, inFlight);
  const observed = returned.then(() => "unexpected resolution", (error: unknown) => error);

  save.reject(failure);
  expect(await observed).toBe(failure);
  expect(pending.current).toBeNull();
  expect(inFlight.current).toBe(false);
});

for (const settlement of ["resolve", "reject"] as const) {
  test(`retains a replaced Promise reference after the old operation ${settlement}s`, async () => {
    const save = deferred();
    const replacement = deferred();
    const { pending, inFlight } = refs();
    const returned = registerChartOrderDraftSaveOperation(save.promise, pending, inFlight);
    const observed = returned.then((value) => value, (error: unknown) => error);
    pending.current = replacement.promise;

    if (settlement === "resolve") save.resolve(true);
    else save.reject(new Error("synthetic superseded rejection"));
    await observed;
    expect(pending.current).toBe(replacement.promise);
    // The current caller's cleanup releases this flag unconditionally.
    expect(inFlight.current).toBe(false);
    replacement.resolve(false);
  });
}

test("keeps registration synchronous for an already-settled Promise", async () => {
  const operation = Promise.resolve(true);
  const { pending, inFlight } = refs();
  const returned = registerChartOrderDraftSaveOperation(operation, pending, inFlight);

  expect(returned).toBe(operation);
  expect(pending.current).toBe(operation);
  expect(inFlight.current).toBe(true);
  expect(await returned).toBe(true);
  expect(pending.current).toBeNull();
  expect(inFlight.current).toBe(false);
});
