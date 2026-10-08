import { expect, test } from "@playwright/test";
import { getChartOrderDraftInFlightSave } from "../src/features/chart/chart-order-draft-save-operation";

for (const locked of [false, true]) {
  test(`shares the exact pending Promise when the lock is ${locked}`, async () => {
    const operation = Promise.resolve(true);
    const pending = { current: operation as Promise<boolean> | null };
    const inFlight = { current: locked };

    const first = getChartOrderDraftInFlightSave(pending, inFlight);
    const second = getChartOrderDraftInFlightSave(pending, inFlight);
    expect(first).toBe(operation);
    expect(second).toBe(operation);
    expect(await first).toBe(true);
    expect(pending.current).toBe(operation);
    expect(inFlight.current).toBe(locked);
  });
}

test("leaves admission to the caller when no operation or lock exists", () => {
  const pending = { current: null as Promise<boolean> | null };
  const inFlight = { current: false };

  expect(getChartOrderDraftInFlightSave(pending, inFlight)).toBeNull();
  expect(pending.current).toBeNull();
  expect(inFlight.current).toBe(false);
});

test("returns false without releasing a lock that has no Promise", async () => {
  const pending = { current: null as Promise<boolean> | null };
  const inFlight = { current: true };

  const result = getChartOrderDraftInFlightSave(pending, inFlight);
  expect(result).toBeInstanceOf(Promise);
  expect(await result).toBe(false);
  expect(pending.current).toBeNull();
  expect(inFlight.current).toBe(true);
});

test("keeps separate resolved false results for repeated lock-only calls", async () => {
  const pending = { current: null as Promise<boolean> | null };
  const inFlight = { current: true };

  const first = getChartOrderDraftInFlightSave(pending, inFlight);
  const second = getChartOrderDraftInFlightSave(pending, inFlight);
  expect(first).not.toBe(second);
  expect(await first).toBe(false);
  expect(await second).toBe(false);
});

test("shares the original rejection without installing cleanup", async () => {
  const failure = new Error("synthetic shared save failure");
  let reject!: (error: Error) => void;
  const operation = new Promise<boolean>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  const pending = { current: operation as Promise<boolean> | null };
  const inFlight = { current: true };

  const result = getChartOrderDraftInFlightSave(pending, inFlight);
  expect(result).toBe(operation);
  const observed = result!.then(() => "unexpected resolution", (error: unknown) => error);
  reject(failure);
  expect(await observed).toBe(failure);
  expect(pending.current).toBe(operation);
  expect(inFlight.current).toBe(true);
});

test("a pending Promise takes precedence before the lock is read", async () => {
  const operation = Promise.resolve(true);
  const pending = { current: operation as Promise<boolean> | null };
  const inFlight = {
    get current(): boolean {
      throw new Error("lock must not be read for an existing Promise");
    },
  };

  const result = getChartOrderDraftInFlightSave(pending, inFlight);
  expect(result).toBe(operation);
  expect(await result).toBe(true);
});
