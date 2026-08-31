import { expect, test } from "@playwright/test";

import {
  SoapAutosaveCoordinator,
  type SoapAutosaveResult,
  type SoapAutosaveState,
} from "../src/features/chart/chart-soap-autosave-coordinator";
import type { SoapBlockDocument, SoapNote } from "../src/types/emr-domain";

const note = (updatedAt: string): SoapNote => ({
  id: "soap-1",
  encounterId: "encounter-1",
  authorUserId: "user-1",
  status: "autosaved",
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt,
});

const document = (id: string): SoapBlockDocument => ({
  schemaVersion: 1,
  blocks: [{ id }],
});

const waitForTimer = () => new Promise((resolve) => setTimeout(resolve, 5));

test("SOAP autosave serializes requests and advances expectedUpdatedAt before saving the newest pending document", async () => {
  const calls: Array<{
    document: SoapBlockDocument;
    expectedUpdatedAt?: string | null;
    resolve: (result: SoapAutosaveResult) => void;
  }> = [];
  const states: SoapAutosaveState[] = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    expectedUpdatedAt: "t0",
    request: ({ document: nextDocument, expectedUpdatedAt }) =>
      new Promise((resolve) => calls.push({ document: nextDocument, expectedUpdatedAt, resolve })),
    onPersisted: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  coordinator.change(document("first"));
  await waitForTimer();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ expectedUpdatedAt: "t0" });

  coordinator.change(document("second"));
  await waitForTimer();
  expect(calls).toHaveLength(1);

  calls[0]!.resolve({ ok: true, soapNote: note("t1"), auditRecorded: true });
  await waitForTimer();
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatchObject({
    document: document("second"),
    expectedUpdatedAt: "t1",
  });

  calls[1]!.resolve({ ok: true, soapNote: note("t2"), auditRecorded: true });
  await waitForTimer();
  expect(states.at(-1)).toBe("saved");
  coordinator.dispose();
});

test("SOAP autosave preserves a queued manual-save mode while an earlier request is in flight", async () => {
  const calls: Array<{
    mode: "autosave" | "manual_save";
    resolve: (result: SoapAutosaveResult) => void;
  }> = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    request: ({ mode }) =>
      new Promise((resolve) => calls.push({ mode, resolve })),
    onPersisted: () => undefined,
    onStateChange: () => undefined,
  });

  coordinator.change(document("first-autosave"));
  await waitForTimer();
  expect(calls.map((call) => call.mode)).toEqual(["autosave"]);

  coordinator.change(document("manual-pending"));
  coordinator.saveNow();
  calls[0]!.resolve({ ok: true, soapNote: note("t1"), auditRecorded: true });
  await waitForTimer();
  expect(calls.map((call) => call.mode)).toEqual(["autosave", "manual_save"]);

  calls[1]!.resolve({ ok: true, soapNote: note("t2"), auditRecorded: true });
  await waitForTimer();
  coordinator.dispose();
});

test("SOAP autosave keeps the local document blocked after conflicts and allows explicit retry", async () => {
  let attempts = 0;
  const states: SoapAutosaveState[] = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    expectedUpdatedAt: "stale",
    request: async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, status: 409, denialReason: "soap_note_conflict" }
        : { ok: true, soapNote: note("fresh"), auditRecorded: true };
    },
    onPersisted: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  coordinator.change(document("local"));
  await waitForTimer();
  expect(attempts).toBe(1);
  expect(states.at(-1)).toBe("conflict");

  await waitForTimer();
  expect(attempts).toBe(1);
  coordinator.setExpectedUpdatedAt("server-fresh");
  coordinator.retry();
  await waitForTimer();
  expect(attempts).toBe(2);
  expect(states.at(-1)).toBe("saved");
  coordinator.dispose();
});

test("SOAP autosave reports reconciled writes with unknown audit confirmation as saved with warning", async () => {
  const states: SoapAutosaveState[] = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    request: async () => ({
      ok: true,
      soapNote: note("saved"),
      auditRecorded: false,
    }),
    onPersisted: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  coordinator.change(document("audit-warning"));
  await waitForTimer();
  expect(states.at(-1)).toBe("saved_with_warning");
  coordinator.dispose();
});

test("SOAP autosave keeps the latest local document after a rejected request and retries explicitly", async () => {
  let attempts = 0;
  const calls: SoapBlockDocument[] = [];
  const states: SoapAutosaveState[] = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    request: async ({ document: nextDocument }) => {
      attempts += 1;
      calls.push(nextDocument);
      if (attempts === 1) throw new Error("network unavailable");
      return { ok: true, soapNote: note("recovered"), auditRecorded: true };
    },
    onPersisted: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  coordinator.change(document("local-after-network-error"));
  await waitForTimer();
  expect(states.at(-1)).toBe("error");
  expect(calls).toEqual([document("local-after-network-error")]);

  coordinator.retry();
  await waitForTimer();
  expect(states.at(-1)).toBe("saved");
  expect(calls).toEqual([
    document("local-after-network-error"),
    document("local-after-network-error"),
  ]);
  coordinator.dispose();
});

test("SOAP autosave reconciles a response-loss retry conflict when server readback matches", async () => {
  let attempts = 0;
  let reconciliations = 0;
  const states: SoapAutosaveState[] = [];
  const localDocument = document("committed-before-response-loss");
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    request: async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, status: 500, error: "db_write_failed" }
        : { ok: false, status: 409, denialReason: "soap_note_conflict" };
    },
    reconcileConflict: async ({ document: retryDocument }) => {
      reconciliations += 1;
      expect(retryDocument).toEqual(localDocument);
      return {
        ok: true,
        soapNote: { ...note("server-advanced"), blockDocument: localDocument },
        auditRecorded: false,
      };
    },
    onPersisted: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  coordinator.change(localDocument);
  await waitForTimer();
  expect(states.at(-1)).toBe("error");

  coordinator.retry();
  await waitForTimer();
  expect(attempts).toBe(2);
  expect(reconciliations).toBe(1);
  expect(states.at(-1)).toBe("saved_with_warning");
  coordinator.dispose();
});

test("SOAP autosave keeps a real conflict when ambiguous readback cannot reconcile", async () => {
  let attempts = 0;
  const states: SoapAutosaveState[] = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 0,
    request: async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, status: 500, error: "db_write_failed" }
        : { ok: false, status: 409, denialReason: "soap_note_conflict" };
    },
    reconcileConflict: async () => null,
    onPersisted: () => undefined,
    onStateChange: (state) => states.push(state),
  });

  coordinator.change(document("different-server-document"));
  await waitForTimer();
  coordinator.retry();
  await waitForTimer();
  expect(states.at(-1)).toBe("conflict");
  coordinator.dispose();
});

test("disposing a SOAP editor flushes a debounced encounter-scoped pending document", async () => {
  const saved: SoapBlockDocument[] = [];
  const coordinator = new SoapAutosaveCoordinator({
    debounceMs: 60_000,
    request: async ({ document: pendingDocument }) => {
      saved.push(pendingDocument);
      return { ok: true, soapNote: note("disposed-save"), auditRecorded: true };
    },
    onPersisted: () => undefined,
    onStateChange: () => undefined,
  });

  coordinator.change(document("pending-on-unmount"));
  coordinator.dispose();
  await waitForTimer();
  expect(saved).toEqual([document("pending-on-unmount")]);
});
