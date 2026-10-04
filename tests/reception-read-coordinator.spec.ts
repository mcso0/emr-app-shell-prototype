import { expect, test } from "@playwright/test";
import { refreshReceptionReads } from "../src/features/reception/reception-read-coordinator";

import type { EffectiveOperatingHours } from "../src/features/hospital-admin/settings/hospital-basic-settings-model";
import type { ReceptionCalendarReadRecord, ReceptionCalendarReadResponse } from "../src/features/reception/reception-calendar-read";
import type { ReceptionQueueReadRecord, ReceptionQueueReadResponse } from "../src/features/reception/reception-queue-read";
import type { ReceptionPatientGuardianLookupItem, ReceptionPatientGuardianLookupResponse } from "../src/features/reception/patient-guardian-lookup";
import type { Patient } from "../src/types/emr-domain";

type RefreshResult = { ok: boolean; stale?: boolean };
type ReadInput = { actorId?: string; date: string; workspaceId: string };
type Failure = Extract<ReceptionCalendarReadResponse | ReceptionQueueReadResponse, { ok: false }>;

const date = "2026-05-01";
const workspaceId = "workspace-test";
const schedule: EffectiveOperatingHours = { date, timezone: "Asia/Seoul", isOpen: true, source: "weekly", treatmentStart: "09:00", treatmentEnd: "19:00", breakStart: "13:00", breakEnd: "14:00" };
const calendar = (records: ReceptionCalendarReadRecord[] = []): ReceptionCalendarReadResponse => ({
  ok: true, status: 200, workspaceId, date, records, operatingSchedule: schedule, enforcedBy: "reception-calendar-read",
});
const queue = (records: ReceptionQueueReadRecord[] = []): ReceptionQueueReadResponse => ({
  ok: true, status: 200, queue: records, summary: { workspaceId, date, appointmentCount: 0, receptionCount: 0, totalCount: records.length }, enforcedBy: "reception-queue-read",
});
const patient = (id: string): Patient => ({
  id, patientNo: id, workspaceId, name: id, species: "dog", sex: "unknown", handlingCautionLocked: false, status: "active", createdAt: date, updatedAt: date,
});
const appointmentRecord = (id: string): ReceptionCalendarReadRecord => ({
  appointment: { id: "appointment-" + id, workspaceId, patientId: id, scheduledStartAt: date, status: "confirmed", createdAt: date, updatedAt: date },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function createHarness() {
  const events: string[] = [];
  const lookups: ReceptionPatientGuardianLookupItem[] = [];
  const requests: Array<{ kind: string; input: ReadInput | Omit<ReadInput, "date"> }> = [];
  const knownPatients: Array<Pick<Patient, "id">> = [];
  const receptionReadInFlightRef = { current: null as { key: string; promise: Promise<RefreshResult> } | null };
  const receptionReadRequestSeqRef = { current: 0 };
  const context = {
    workspaceId, operatingDate: date, actorId: "actor-one",
    liveStaffSourceEnabled: false, receptionReadInFlightRef, receptionReadRequestSeqRef,
    shouldUseSupabaseAuth: () => false,
    async loadReceptionSnapshot(input: ReadInput): Promise<{ calendarResult: ReceptionCalendarReadResponse; queueResult: ReceptionQueueReadResponse }> {
      events.push("snapshot"); requests.push({ kind: "snapshot", input }); return { calendarResult: calendar(), queueResult: queue() };
    },
    async loadReceptionCalendar(input: ReadInput): Promise<ReceptionCalendarReadResponse> {
      events.push("calendar"); requests.push({ kind: "calendar", input }); return calendar();
    },
    async loadReceptionQueue(input: ReadInput): Promise<ReceptionQueueReadResponse> {
      events.push("queue"); requests.push({ kind: "queue", input }); return queue();
    },
    async loadReceptionPatientGuardianProfiles(input: Omit<ReadInput, "date">): Promise<ReceptionPatientGuardianLookupResponse> {
      events.push("profiles"); requests.push({ kind: "profiles", input }); return { ok: true, patients: [], enforcedBy: "reception-patient-guardian-lookup" };
    },
    getPatients: () => { events.push("get-patients"); return knownPatients; },
    applyPatientGuardianLookupItem: (item: ReceptionPatientGuardianLookupItem) => { events.push("patient:" + item.patient.id); lookups.push(item); knownPatients.push({ id: item.patient.id }); },
    applyPersistedReceptionCalendar: () => { events.push("apply-calendar"); },
    applyPersistedReceptionQueue: () => { events.push("apply-queue"); },
    setReceptionCalendarReadStatus: (status: string, error?: string) => { events.push("calendar:" + status + (error ? ":" + error : "")); },
    setReceptionQueueReadStatus: (status: string, error?: string) => { events.push("queue:" + status + (error ? ":" + error : "")); },
    setOperatingSchedule: () => { events.push("schedule"); },
    getReceptionReadFailureMessage: (result: Failure, scope?: string) => "failure:" + scope + ":" + result.status,
  };
  return { context, events, requests, lookups, knownPatients };
}



test("same workspace/date refresh shares the exact promise and one request pair", async () => {
  const h = createHarness();
  const gate = deferred<ReceptionCalendarReadResponse>();
  h.context.loadReceptionCalendar = async () => { h.events.push("calendar"); return gate.promise; };
  const first = refreshReceptionReads(h.context);
  const second = refreshReceptionReads(h.context, { showLoading: true });
  expect(second).toBe(first);
  expect(h.context.receptionReadRequestSeqRef.current).toBe(1);
  expect(h.events).toEqual(["calendar", "queue"]);
  gate.resolve(calendar());
  await expect(first).resolves.toEqual({ ok: true });
  expect(h.context.receptionReadInFlightRef.current).toBeNull();
});

test("fallback starts calendar then queue concurrently with current actor/date/workspace", async () => {
  const h = createHarness();
  const cal = deferred<ReceptionCalendarReadResponse>(), que = deferred<ReceptionQueueReadResponse>();
  h.context.loadReceptionCalendar = async input => { h.requests.push({ kind: "calendar", input }); return cal.promise; };
  h.context.loadReceptionQueue = async input => { h.requests.push({ kind: "queue", input }); return que.promise; };
  const pending = refreshReceptionReads(h.context, { showLoading: true });
  expect(h.requests).toEqual(["calendar", "queue"].map(kind => ({ kind, input: { actorId: "actor-one", date, workspaceId } })));
  expect(h.events).toEqual(["calendar:loading", "queue:loading"]);
  cal.resolve(calendar()); que.resolve(queue());
  await expect(pending).resolves.toEqual({ ok: true });
  expect(h.events).toEqual(["calendar:loading", "queue:loading", "get-patients", "apply-calendar", "schedule", "apply-queue"]);
});

for (const [live, supabase, expected] of [[true, true, ["snapshot"]], [true, false, ["calendar", "queue"]], [false, true, ["calendar", "queue"]]] as const) {
  test("snapshot selection preserves live=" + live + ", supabase=" + supabase, async () => {
    const h = createHarness(); h.context.liveStaffSourceEnabled = live; h.context.shouldUseSupabaseAuth = () => supabase;
    await refreshReceptionReads(h.context);
    expect(h.requests.map(request => request.kind)).toEqual(expected);
    expect(h.requests[0].input).toEqual({ actorId: "actor-one", date, workspaceId });
  });
}

for (const change of ["operatingDate", "workspaceId"] as const) {
  test("late response from previous " + change + " cannot apply stores or clear newer in-flight", async () => {
    const h = createHarness();
    const old = deferred<ReceptionCalendarReadResponse>(), latest = deferred<ReceptionCalendarReadResponse>();
    const previousDate = h.context.operatingDate, previousWorkspace = h.context.workspaceId;
    h.context.loadReceptionCalendar = async input => input.date === previousDate && input.workspaceId === previousWorkspace ? old.promise : latest.promise;
    const first = refreshReceptionReads(h.context);
    const secondContext = { ...h.context, [change]: change === "operatingDate" ? "2026-05-02" : "workspace-two" };
    const second = refreshReceptionReads(secondContext);
    expect(second).not.toBe(first);
    old.resolve(calendar([{ patient: patient("stale-patient") }]));
    await expect(first).resolves.toEqual({ ok: false, stale: true });
    expect(h.lookups).toEqual([]);
    expect(h.events).not.toContain("apply-calendar");
    expect(h.context.receptionReadInFlightRef.current?.promise).toBe(second);
    latest.resolve(calendar());
    await expect(second).resolves.toEqual({ ok: true });
    expect(h.context.receptionReadInFlightRef.current).toBeNull();
  });
}

test("embedded patient and guardian apply before current store read and avoid profile request", async () => {
  const h = createHarness(); h.context.liveStaffSourceEnabled = true;
  const record = { patient: patient("embedded"), primaryGuardian: { id: "guardian", workspaceId, name: "guardian", createdAt: date, updatedAt: date } };
  h.context.loadReceptionCalendar = async () => calendar([record]);
  await refreshReceptionReads(h.context);
  expect(h.lookups).toEqual([record]);
  expect(h.events.indexOf("patient:embedded")).toBeLessThan(h.events.indexOf("get-patients"));
  expect(h.requests.map(request => request.kind)).not.toContain("profiles");
});

test("only missing readback IDs are hydrated and profile request precedes store application", async () => {
  const h = createHarness(); h.context.liveStaffSourceEnabled = true;
  h.knownPatients.push({ id: "known" });
  h.context.loadReceptionCalendar = async () => calendar([appointmentRecord("known"), appointmentRecord("missing"), appointmentRecord("missing")]);
  h.context.loadReceptionPatientGuardianProfiles = async input => {
    h.requests.push({ kind: "profiles", input }); h.events.push("profiles");
    return { ok: true, patients: ["known", "missing", "unrelated"].map(id => ({ patient: patient(id) })), enforcedBy: "reception-patient-guardian-lookup" };
  };
  await refreshReceptionReads(h.context);
  expect(h.lookups.map(item => item.patient.id)).toEqual(["missing"]);
  expect(h.requests.find(request => request.kind === "profiles")?.input).toEqual({ actorId: "actor-one", workspaceId });
  expect(h.events.indexOf("profiles")).toBeLessThan(h.events.indexOf("apply-calendar"));
});

test("response made stale during profile hydration cannot apply profile or reception stores", async () => {
  const h = createHarness(); h.context.liveStaffSourceEnabled = true;
  const profiles = deferred<ReceptionPatientGuardianLookupResponse>();
  h.context.loadReceptionCalendar = async () => calendar([appointmentRecord("missing")]);
  h.context.loadReceptionPatientGuardianProfiles = async () => { h.events.push("profiles"); return profiles.promise; };
  const pending = refreshReceptionReads(h.context);
  await expect.poll(() => h.events.includes("profiles")).toBe(true);
  h.context.receptionReadRequestSeqRef.current += 1;
  profiles.resolve({ ok: true, patients: [{ patient: patient("missing") }], enforcedBy: "reception-patient-guardian-lookup" });
  await expect(pending).resolves.toEqual({ ok: false, stale: true });
  expect(h.lookups).toEqual([]);
  expect(h.events).not.toContain("apply-calendar");
  expect(h.events).not.toContain("apply-queue");
});

test("profile domain failure preserves successful calendar/queue application", async () => {
  const h = createHarness(); h.context.liveStaffSourceEnabled = true;
  h.context.loadReceptionCalendar = async () => calendar([appointmentRecord("missing")]);
  h.context.loadReceptionPatientGuardianProfiles = async () => ({ ok: false, error: "db_read_failed" });
  await expect(refreshReceptionReads(h.context)).resolves.toEqual({ ok: true });
  expect(h.lookups).toEqual([]);
  expect(h.events).toContain("apply-calendar"); expect(h.events).toContain("apply-queue");
});

for (const failed of ["calendar", "queue"] as const) {
  test(failed + " domain failure marks only its error and preserves the other result", async () => {
    const h = createHarness();
    if (failed === "calendar") h.context.loadReceptionCalendar = async () => ({ ok: false, status: 403, denialReason: "permission_missing" });
    else h.context.loadReceptionQueue = async () => ({ ok: false, status: 403, denialReason: "permission_missing" });
    await expect(refreshReceptionReads(h.context)).resolves.toEqual({ ok: false });
    expect(h.events).toContain(failed + ":error:failure:" + workspaceId + ":403");
    expect(h.events).not.toContain("apply-" + failed);
    expect(h.events).toContain("apply-" + (failed === "calendar" ? "queue" : "calendar"));
    expect(h.events.includes("schedule")).toBe(failed !== "calendar");
  });
}

test("rejected read propagates unchanged, clears in-flight and permits a later refresh", async () => {
  const h = createHarness(), error = new Error("read-rejected");
  h.context.loadReceptionCalendar = async () => { throw error; };
  const pending = refreshReceptionReads(h.context);
  await expect(pending).rejects.toBe(error);
  expect(h.context.receptionReadInFlightRef.current).toBeNull();
  expect(h.events).not.toContain("apply-queue");
  h.context.loadReceptionCalendar = async () => calendar();
  await expect(refreshReceptionReads(h.context)).resolves.toEqual({ ok: true });
  expect(h.context.receptionReadRequestSeqRef.current).toBe(2);
});

test("completed results are not a new cache and omitted loading remains silent", async () => {
  const h = createHarness();
  await refreshReceptionReads(h.context); await refreshReceptionReads(h.context);
  expect(h.requests.map(request => request.kind)).toEqual(["calendar", "queue", "calendar", "queue"]);
  expect(h.events.some(event => event.includes("loading"))).toBe(false);
});
