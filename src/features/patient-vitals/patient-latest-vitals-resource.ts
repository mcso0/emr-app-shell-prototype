import type { PatientVitalMeasurement, PatientVitalSummary } from "./patient-vital-types";
import { createDefaultWorkspaceVitalSettingsSnapshot, parseWorkspaceVitalSettingsSnapshot } from "./workspace-vital-settings";
import type { WorkspaceVitalSettingsReadStatus } from "./use-workspace-vital-settings";

type LatestResult = {
  status: "loading" | "ready" | "error";
  canWriteVitals: boolean;
  vital?: PatientVitalMeasurement | null;
  summary?: PatientVitalSummary;
};
const initialSnapshot = {
  latest: { status: "loading", canWriteVitals: false } as LatestResult,
  settings: createDefaultWorkspaceVitalSettingsSnapshot(false),
  settingsStatus: "loading" as WorkspaceVitalSettingsReadStatus,
};
type Snapshot = typeof initialSnapshot;
type Entry = {
  snapshot: Snapshot;
  listeners: Set<() => void>;
  generation: number;
  latestController?: AbortController;
  settingsController?: AbortController;
};
// Only mounted browser subscribers own entries. No persistent or cross-tab cache.
const entries = new Map<string, Entry>();

export function createPatientLatestVitalsResource({ key, workspaceId, encounterId, actorHeaders, enabled }: {
  key: string;
  enabled: boolean;
  workspaceId: string;
  encounterId?: string | null;
  actorHeaders?: Record<string, string>;
}) {
  const publish = (entry: Entry, update: Partial<Snapshot>) => {
    if (entries.get(key) !== entry) return;
    entry.snapshot = { ...entry.snapshot, ...update };
    entry.listeners.forEach(listener => listener());
  };
  const readLatest = async (entry: Entry) => {
    if (!encounterId) return;
    // A post-save read must supersede a pre-save in-flight response.
    entry.latestController?.abort();
    const controller = new AbortController();
    entry.latestController = controller;
    const generation = ++entry.generation;
    publish(entry, { latest: { ...entry.snapshot.latest, status: "loading", canWriteVitals: false } });
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/patient-vitals/latest?encounterId=${encodeURIComponent(encounterId)}`, {
        cache: "no-store", headers: actorHeaders, signal: controller.signal,
      });
      const body = await response.json() as { ok: boolean; canWriteVitals: boolean; vital: PatientVitalMeasurement | null; summary?: PatientVitalSummary };
      if (!response.ok || !body.ok) throw new Error("patient_latest_vital_unavailable");
      if (entry.generation !== generation || entries.get(key) !== entry) return;
      publish(entry, { latest: { status: "ready", canWriteVitals: body.canWriteVitals, vital: body.vital, summary: body.summary } });
    } catch (error) {
      if (entry.generation !== generation || entries.get(key) !== entry) return;
      publish(entry, { latest: { ...entry.snapshot.latest, status: "error", canWriteVitals: false } });
      throw error;
    }
  };
  const readSettings = async (entry: Entry) => {
    const controller = new AbortController();
    entry.settingsController = controller;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/vital-settings`, {
        cache: "no-store", headers: actorHeaders, signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        publish(entry, { settingsStatus: "denied" });
        return;
      }
      const parsed = parseWorkspaceVitalSettingsSnapshot(body);
      publish(entry, response.ok && parsed ? { settings: parsed, settingsStatus: "ready" } : { settingsStatus: "error" });
    } catch {
      publish(entry, { settingsStatus: "error" });
    }
  };
  return {
    getSnapshot: () => entries.get(key)?.snapshot ?? initialSnapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) {
      if (!enabled) return () => {};
      let entry = entries.get(key);
      const isNew = !entry;
      if (!entry) {
        entry = { snapshot: initialSnapshot, listeners: new Set(), generation: 0 };
        entries.set(key, entry);
      }
      const subscribedEntry = entry;
      entry.listeners.add(listener);
      if (isNew) {
        void readLatest(entry).catch(() => {});
        void readSettings(entry);
      }
      return () => {
        subscribedEntry.listeners.delete(listener);
        // React StrictMode may immediately resubscribe; retain that same request.
        queueMicrotask(() => {
          if (subscribedEntry.listeners.size || entries.get(key) !== subscribedEntry) return;
          entries.delete(key);
          subscribedEntry.generation++;
          subscribedEntry.latestController?.abort();
          subscribedEntry.settingsController?.abort();
        });
      };
    },
    async refresh() {
      const entry = entries.get(key);
      // A save completed after selection/account changed. Never revive that scope.
      if (!entry || !entry.listeners.size) return;
      await readLatest(entry);
    },
  };
}
