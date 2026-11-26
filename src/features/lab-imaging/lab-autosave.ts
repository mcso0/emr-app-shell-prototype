"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthClient } from "@/features/auth/auth-client";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { useMockAuthStore } from "@/features/auth/session-store";
import { getSharedReadActorScope, useSharedReadActorScope } from "@/features/auth/shared-read-actor-scope";
import { toast } from "sonner";

export type LabAutosaveOutcome =
  | { ok: true; revision?: number }
  | { ok: false; reason: "error" | "invalid" | "permission_denied" | "conflict" | "held" | "superseded"; message: string; retryable: boolean };
export type LabAutosaveState<T = unknown> = {
  value: "idle" | "waiting" | "saving" | "saved" | "error" | "invalid" | "permission_denied" | "conflict" | "held" | "superseded";
  message?: string;
  retryable?: boolean;
  revision?: number;
  draft?: T;
};
type Job<T> = { value: T; requestId: string; revision?: number };
type Request<T> = (value: T, requestId: string, revision: number) => Promise<LabAutosaveOutcome>;

// The result rows and overall finding use separate revisions and separate queues.
export class LabAutosaveCoordinator<T> {
  private pending: Job<T> | null = null;
  private failed: Job<T> | null = null;
  private inFlight = false;
  private activeRequest: Promise<LabAutosaveOutcome> | null = null;
  private blocked: LabAutosaveState["value"] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;
  private paused = false;
  private superseded = false;
  private authorityRetired = false;
  private attached = true;
  private state: LabAutosaveState<T> = { value: "idle" };
  private draft: T | undefined;

  constructor(
    private request: Request<T>,
    private revision: number,
    private notify: (state: LabAutosaveState<T>) => void,
    private validate: (value: T) => string | null = () => null,
    private debounceMs = 800,
    private onDetachedSaved?: () => void,
    private onDetachedFailure?: () => void,
    private isAuthorized: () => boolean = () => true,
  ) {}

  configure(request: Request<T>, revision: number, paused = false) {
    const resumed = this.paused && !paused;
    this.paused = paused;
    this.request = request;
    if (paused) {
      this.clearTimer();
      if (this.hasUnsavedChanges() && !this.inFlight && (!this.blocked || this.blocked === "held") && this.state.value !== "held") {
        this.blocked = "held";
        this.emit({ value: "held", message: "오더 수정 중입니다. 입력은 이 화면에 보관됩니다." });
      }
    } else if (resumed && (!this.blocked || this.blocked === "held") && !this.superseded) {
      this.blocked = null;
      if (this.attached) this.flush();
    }
    // A readback can arrive late. Never rebase unsaved edits onto another write.
    if (!this.hasUnsavedChanges()) {
      this.revision = Math.max(this.revision, revision);
      if (this.state.value === "saved" && this.state.revision !== undefined && revision >= this.state.revision && this.draft !== undefined) {
        this.draft = undefined;
        this.emit({ ...this.state, draft: undefined });
      }
    }
  }

  change(value: T) {
    if (this.authorityRetired) return;
    this.clearTimer();
    this.pending = { value, requestId: crypto.randomUUID() };
    this.draft = value;
    this.ready = false;
    if (this.blocked && this.blocked !== "invalid") { this.emit(this.state); return; }
    if (this.blocked === "invalid") this.failed = null;
    this.blocked = null;
    this.emit({ value: "waiting", message: "저장 대기 중" });
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.debounceMs);
  }

  flush() {
    this.clearTimer();
    this.ready = true;
    void this.write();
  }

  /** Drain the actual writes, including a newer draft queued behind a slow write. */
  async flushForCompletion(): Promise<boolean> {
    while (this.hasUnsavedChanges()) {
      if (this.authorityRetired || !this.isAuthorized() || this.blocked || this.paused || this.superseded) return false;
      this.flush();
      const active = this.activeRequest;
      if (!active) return false; // Validation failed synchronously; keep the draft.
      // write() processes the outcome first and retains failed/conflicting jobs for the editor.
      await active.catch(() => {});
    }
    return !this.authorityRetired && !this.superseded && this.isAuthorized();
  }

  retry() {
    if (this.superseded || this.paused || !this.failed || !["error", "held"].includes(this.blocked ?? "")) return;
    this.blocked = null;
    this.flush();
  }

  supersede() {
    if (this.superseded) return;
    this.superseded = true; this.clearTimer();
  }
  discard() {
    if (this.inFlight) return false;
    this.pending = null; this.failed = null; this.draft = undefined;
    this.emit({ value: "idle" });
    return true;
  }
  hasUnsavedChanges() { return this.inFlight || this.pending !== null || this.failed !== null; }
  getState() { return this.state; }
  attach(notify?: (state: LabAutosaveState<T>) => void) { if (notify) this.notify = notify; this.attached = true; this.notify(this.state); }
  dispose() {
    this.attached = false;
    if (!this.isAuthorized()) { this.retireAuthority(); return; }
    this.flush();
  }
  private retireAuthority() {
    this.authorityRetired = true; this.clearTimer();
    this.pending = null; this.failed = null; this.draft = undefined;
    this.inFlight = false; this.emit({ value: "idle" });
  }

  private async write() {
    if (this.authorityRetired) return;
    if (!this.isAuthorized()) { this.retireAuthority(); return; }
    if (this.inFlight || this.blocked || this.paused || this.superseded || !this.ready) return;
    const job = this.failed ?? this.pending;
    if (!job) return;
    const invalid = this.validate(job.value);
    if (invalid) {
      this.blocked = "invalid";
      this.emit({ value: "invalid", message: invalid });
      if (!this.attached) this.onDetachedFailure?.();
      return;
    }
    const retryHasPending = job === this.failed && this.pending !== null;
    if (job === this.pending) this.pending = null;
    this.failed = null;
    job.revision ??= this.revision;
    this.inFlight = true;
    this.ready = retryHasPending;
    this.emit({ value: "saving", message: "저장 중" });
    let outcome: LabAutosaveOutcome;
    try {
      this.activeRequest = this.request(job.value, job.requestId, job.revision);
      outcome = await this.activeRequest;
    } catch {
      outcome = { ok: false, reason: "error", message: "네트워크 오류로 저장하지 못했습니다.", retryable: true };
    }
    this.activeRequest = null;
    this.inFlight = false;
    if (this.authorityRetired || !this.isAuthorized()) { this.retireAuthority(); return; }
    if (!outcome.ok) {
      // Retry the identical request before newer edits: a lost response may have
      // already committed, and the result-entry API deduplicates requestId.
      if (outcome.reason === "superseded") this.supersede();
      this.failed = job;
      this.blocked = outcome.reason;
      this.emit({ value: outcome.reason, message: outcome.message, retryable: outcome.retryable });
      if (!this.attached) this.onDetachedFailure?.();
      return;
    }
    this.revision = outcome.revision ?? this.revision;
    if (this.superseded && !this.pending) this.draft = undefined;
    this.emit(this.pending ? { value: "waiting", message: "저장 대기 중" } : { value: "saved", message: "저장됨", revision: outcome.revision });
    if (this.pending && (this.ready || !this.attached)) { this.ready = true; void this.write(); }
    else if (!this.attached && !this.hasUnsavedChanges()) this.onDetachedSaved?.();
  }

  private emit(state: LabAutosaveState<T>) {
    this.state = { ...state, draft: this.draft };
    if (this.attached) this.notify(this.state);
    if (this.superseded && typeof window !== "undefined") window.dispatchEvent(new Event("clair-lab-superseded-draft"));
  }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
}

// Only unsaved queues survive component unmount. This is session memory, not
// browser storage; returning to a result restores its draft and failure state.
const pendingResults = new Map<string, LabAutosaveCoordinator<unknown>>();
const protectPendingDrafts = (event: BeforeUnloadEvent) => {
  if (![...pendingResults.values()].some(queue => queue.hasUnsavedChanges())) return;
  event.preventDefault(); event.returnValue = "";
};
function forgetResult(scope: string) {
  pendingResults.delete(scope);
  if (pendingResults.size === 0 && typeof window !== "undefined") window.removeEventListener("beforeunload", protectPendingDrafts);
}

export function useLabAutosaveActorScope() {
  const { session } = useAuthClient();
  const scope = useSharedReadActorScope(session);
  return getAuthRuntimeMode().authProvider === "supabase" || session ? scope : null;
}
function currentAutosaveActor() {
  if (getAuthRuntimeMode().authProvider === "supabase") return getSharedReadActorScope();
  const session = useMockAuthStore.getState().session;
  return session ? JSON.stringify([session.role, session.id]) : null;
}
const ownedScope = (actor: string | null, scope: string) => JSON.stringify([actor, scope]);

export function useLabAutosave<T>(resultScope: string, request: Request<T>, revision: number, validate?: (value: T) => string | null, paused = false) {
  const actor = useLabAutosaveActorScope();
  const scope = ownedScope(actor, resultScope);
  const coordinator = useMemo(() => {
    const existing = pendingResults.get(scope) as LabAutosaveCoordinator<T> | undefined;
    if (existing) return existing;
    const created = new LabAutosaveCoordinator(request, revision, () => {}, validate, 800, () => {
      if (pendingResults.get(scope) === created) forgetResult(scope);
    }, () => toast.error("검사 결과를 저장하지 못했습니다. 검사를 다시 열어 입력을 확인해 주세요."),
    () => actor !== null && currentAutosaveActor() === actor);
    return created;
    // A new actor/result gets a separate queue; requests/revisions update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const [snapshot, setSnapshot] = useState(() => ({ coordinator, state: coordinator.getState() }));
  const state = snapshot.coordinator === coordinator ? snapshot.state : coordinator.getState();
  useEffect(() => {
    if (pendingResults.size === 0) window.addEventListener("beforeunload", protectPendingDrafts);
    pendingResults.set(scope, coordinator as LabAutosaveCoordinator<unknown>);
    coordinator.attach(state => setSnapshot({ coordinator, state }));
    const onHidden = () => { if (document.visibilityState === "hidden") coordinator.flush(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      // Keep the unload guard for detached failures as well as active inputs.
      coordinator.dispose();
      if (!coordinator.hasUnsavedChanges()) forgetResult(scope);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [coordinator, scope]);
  useEffect(() => { coordinator.configure(request, revision, paused); }, [coordinator, request, revision, paused]);
  const change = useCallback((value: T) => coordinator.change(value), [coordinator]);
  const flush = useCallback(() => coordinator.flush(), [coordinator]);
  const retry = useCallback(() => coordinator.retry(), [coordinator]);
  return { state, change, flush, retry };
}

/** A mounted result/actor/attempt owns its own lock; leaving invalidates even a later return to the same result. */
export class LabCompletionGate {
  private active = true;
  private pending = false;

  leave() { this.active = false; }

  async run(drain: () => Promise<boolean>, complete: () => Promise<boolean>, pendingChanged: (pending: boolean) => void) {
    if (!this.active || this.pending) return false;
    this.pending = true;
    pendingChanged(true);
    try {
      if (!await drain() || !this.active) return false;
      return await complete();
    } finally {
      this.pending = false;
      if (this.active) pendingChanged(false);
    }
  }
}

/** Only the current actor's two result editors participate; never mix attempts. */
export async function flushLabResultForCompletion(actor: string | null, workspaceId: string, resultId: string) {
  if (!actor || actor !== currentAutosaveActor()) return false;
  const queues = ["rows", "overall"].map(kind => pendingResults.get(ownedScope(actor, `${workspaceId}:${resultId}:${kind}`)));
  const saved = await Promise.all(queues.map(queue => queue?.flushForCompletion() ?? true));
  return actor === currentAutosaveActor() && saved.every(Boolean) && queues.every(queue => !queue?.hasUnsavedChanges());
}

/** Superseded inputs remain recoverable in the previous result, never in a new attempt. */
export function supersedeLabResultDraft(actor: string | null, workspaceId: string, resultId: string) {
  for (const kind of ["rows", "overall"]) pendingResults.get(ownedScope(actor, `${workspaceId}:${resultId}:${kind}`))?.supersede();
}
export function getLabResultDraft<T>(actor: string | null, workspaceId: string, resultId: string, kind: "rows" | "overall"): T | undefined {
  const queue = pendingResults.get(ownedScope(actor, `${workspaceId}:${resultId}:${kind}`));
  return queue?.hasUnsavedChanges() ? queue.getState().draft as T | undefined : undefined;
}
export function discardLabResultDraft(actor: string | null, workspaceId: string, resultId: string) {
  for (const kind of ["rows", "overall"]) {
    const scope = ownedScope(actor, `${workspaceId}:${resultId}:${kind}`);
    if (pendingResults.get(scope)?.discard()) forgetResult(scope);
  }
}
