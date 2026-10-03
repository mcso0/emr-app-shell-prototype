"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type LabAutosaveOutcome =
  | { ok: true; revision?: number }
  | { ok: false; reason: "error" | "invalid" | "permission_denied" | "conflict"; message: string; retryable: boolean };
export type LabAutosaveState<T = unknown> = {
  value: "idle" | "waiting" | "saving" | "saved" | "error" | "invalid" | "permission_denied" | "conflict";
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
  private blocked: LabAutosaveState["value"] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;
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
  ) {}

  configure(request: Request<T>, revision: number) {
    this.request = request;
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

  retry() {
    if (!this.failed || this.blocked !== "error") return;
    this.blocked = null;
    this.flush();
  }

  hasUnsavedChanges() { return this.inFlight || this.pending !== null || this.failed !== null; }
  getState() { return this.state; }
  attach(notify?: (state: LabAutosaveState<T>) => void) { if (notify) this.notify = notify; this.attached = true; this.notify(this.state); }
  dispose() { this.attached = false; this.flush(); }

  private async write() {
    if (this.inFlight || this.blocked || !this.ready) return;
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
      outcome = await this.request(job.value, job.requestId, job.revision);
    } catch {
      outcome = { ok: false, reason: "error", message: "네트워크 오류로 저장하지 못했습니다.", retryable: true };
    }
    this.inFlight = false;
    if (!outcome.ok) {
      // Retry the identical request before newer edits: a lost response may have
      // already committed, and the result-entry API deduplicates requestId.
      this.failed = job;
      this.blocked = outcome.reason;
      this.emit({ value: outcome.reason, message: outcome.message, retryable: outcome.retryable });
      if (!this.attached) this.onDetachedFailure?.();
      return;
    }
    this.revision = outcome.revision ?? this.revision;
    this.emit(this.pending ? { value: "waiting", message: "저장 대기 중" } : { value: "saved", message: "저장됨", revision: outcome.revision });
    if (this.pending && (this.ready || !this.attached)) { this.ready = true; void this.write(); }
    else if (!this.attached && !this.hasUnsavedChanges()) this.onDetachedSaved?.();
  }

  private emit(state: LabAutosaveState<T>) { this.state = { ...state, draft: this.draft }; if (this.attached) this.notify(this.state); }
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

export function useLabAutosave<T>(scope: string, request: Request<T>, revision: number, validate?: (value: T) => string | null) {
  const [coordinator] = useState(() => {
    const existing = pendingResults.get(scope) as LabAutosaveCoordinator<T> | undefined;
    if (existing) return existing;
    const created = new LabAutosaveCoordinator(request, revision, () => {}, validate, 800, () => {
      if (pendingResults.get(scope) === created) forgetResult(scope);
    }, () => toast.error("검사 결과를 저장하지 못했습니다. 검사를 다시 열어 입력을 확인해 주세요."));
    return created;
  });
  const [state, setState] = useState(() => coordinator.getState());
  useEffect(() => {
    if (pendingResults.size === 0) window.addEventListener("beforeunload", protectPendingDrafts);
    pendingResults.set(scope, coordinator as LabAutosaveCoordinator<unknown>);
    coordinator.attach(setState);
    const onHidden = () => { if (document.visibilityState === "hidden") coordinator.flush(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      // Keep the unload guard for detached failures as well as active inputs.
      coordinator.dispose();
      if (!coordinator.hasUnsavedChanges()) forgetResult(scope);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [coordinator, scope]);
  useEffect(() => { coordinator.configure(request, revision); }, [coordinator, request, revision]);
  const change = useCallback((value: T) => coordinator.change(value), [coordinator]);
  const flush = useCallback(() => coordinator.flush(), [coordinator]);
  const retry = useCallback(() => coordinator.retry(), [coordinator]);
  return { state, change, flush, retry };
}
