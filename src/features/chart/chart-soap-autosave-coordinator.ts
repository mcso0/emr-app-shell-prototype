import { areSoapBlockDocumentsEqual } from "@/features/chart/chart-soap-document";
import type { SoapBlockDocument, SoapNote } from "@/types/emr-domain";

export type SoapAutosaveMode = "autosave" | "manual_save";

export type SoapAutosaveResult =
  | {
      ok: true;
      soapNote: SoapNote;
      auditRecorded: boolean;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };

export type SoapAutosaveState =
  | "idle"
  | "saving"
  | "saved"
  | "saved_with_warning"
  | "conflict"
  | "error";

type SoapAutosaveCoordinatorOptions = {
  debounceMs?: number;
  expectedUpdatedAt?: string | null;
  request: (input: {
    document: SoapBlockDocument;
    expectedUpdatedAt?: string | null;
    mode: SoapAutosaveMode;
  }) => Promise<SoapAutosaveResult>;
  reconcileConflict?: (input: {
    ambiguousWrite: boolean;
    document: SoapBlockDocument;
  }) => Promise<SoapAutosaveResult | null>;
  onPersisted: (soapNote: SoapNote) => void;
  onStateChange: (state: SoapAutosaveState, result?: SoapAutosaveResult) => void;
};

export class SoapAutosaveCoordinator {
  private readonly debounceMs: number;
  private readonly request: SoapAutosaveCoordinatorOptions["request"];
  private readonly reconcileConflict: SoapAutosaveCoordinatorOptions["reconcileConflict"];
  private onPersisted: SoapAutosaveCoordinatorOptions["onPersisted"];
  private onStateChange: SoapAutosaveCoordinatorOptions["onStateChange"];
  private expectedUpdatedAt: string | null | undefined;
  private latestDocument: SoapBlockDocument | null = null;
  private pendingDocument: SoapBlockDocument | null = null;
  private pendingMode: SoapAutosaveMode = "autosave";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private pendingReady = false;
  private blocked = false;
  private conflictBlocked = false;
  private disposed = false;
  private flushWaiters: Array<(saved: boolean) => void> = [];
  private ambiguousDocument: SoapBlockDocument | null = null;

  constructor(options: SoapAutosaveCoordinatorOptions) {
    this.debounceMs = options.debounceMs ?? 800;
    this.expectedUpdatedAt = options.expectedUpdatedAt;
    this.request = options.request;
    this.reconcileConflict = options.reconcileConflict;
    this.onPersisted = options.onPersisted;
    this.onStateChange = options.onStateChange;
  }

  setCallbacks(
    onPersisted: SoapAutosaveCoordinatorOptions["onPersisted"],
    onStateChange: SoapAutosaveCoordinatorOptions["onStateChange"],
  ) {
    this.onPersisted = onPersisted;
    this.onStateChange = onStateChange;
  }

  setExpectedUpdatedAt(value?: string | null) {
    if (!this.inFlight) this.expectedUpdatedAt = value;
  }

  hydrate(document: SoapBlockDocument) {
    if (!this.pendingDocument && !this.inFlight) this.latestDocument = document;
  }

  change(document: SoapBlockDocument) {
    this.latestDocument = document;
    this.pendingDocument = document;
    this.pendingMode = "autosave";
    this.pendingReady = false;
    if (this.conflictBlocked) {
      this.clearTimer();
      return;
    }
    this.blocked = false;
    this.clearTimer();
    this.notify("saving");
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pendingReady = true;
      void this.flush();
    }, this.debounceMs);
  }

  saveNow() {
    if (!this.latestDocument) return;
    this.pendingDocument = this.latestDocument;
    this.pendingMode = "manual_save";
    this.pendingReady = true;
    this.clearTimer();
    if (this.conflictBlocked && this.reconcileConflict) {
      void this.retryConflictReadback();
      return;
    }
    this.blocked = false;
    void this.flush();
  }

  retry() {
    this.saveNow();
  }

  hasUnsavedChanges() { return this.inFlight || Boolean(this.pendingDocument); }

  async flushPending(): Promise<boolean> {
    this.clearTimer();
    if (this.blocked) return false;
    this.pendingReady = true;
    if (!this.inFlight && !this.pendingDocument) return true;
    const done = new Promise<boolean>((resolve) => this.flushWaiters.push(resolve));
    void this.flush();
    return done;
  }

  private settleFlushWaiters() {
    if (this.inFlight || (!this.blocked && this.pendingDocument)) return;
    for (const resolve of this.flushWaiters.splice(0)) resolve(!this.blocked);
  }

  attach() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
    if (this.pendingDocument && !this.blocked) {
      this.pendingReady = true;
      void this.flush();
    }
  }

  private async flush() {
    if (this.inFlight || !this.pendingReady || !this.pendingDocument || this.blocked) {
      return;
    }

    const document = this.pendingDocument;
    const mode = this.pendingMode;
    this.pendingDocument = null;
    this.pendingMode = "autosave";
    this.pendingReady = false;
    this.inFlight = true;
    this.notify("saving");

    let result: SoapAutosaveResult;
    try {
      result = await this.request({
        document,
        expectedUpdatedAt: this.expectedUpdatedAt,
        mode,
      });
    } catch (error) {
      this.ambiguousDocument = document;
      if (!this.pendingDocument) {
        this.pendingDocument = document;
        this.pendingMode = mode;
      }
      this.blocked = true;
      this.conflictBlocked = false;
      this.inFlight = false;
      this.settleFlushWaiters();
      this.notify("error", {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "soap_note_request_failed",
      });
      return;
    }

    if (!result.ok && result.denialReason === "soap_note_conflict") {
      result = (await this.tryReconcileConflict(document)) ?? result;
    }

    if (result.ok) {
      this.acceptSuccessfulResult(result);
    } else {
      if (result.status === 0 || result.status >= 500) {
        this.ambiguousDocument = document;
      }
      if (!this.pendingDocument) {
        this.pendingDocument = document;
        this.pendingMode = mode;
      }
      this.blocked = true;
      this.conflictBlocked = result.denialReason === "soap_note_conflict";
      this.notify(
        result.denialReason === "soap_note_conflict" ? "conflict" : "error",
        result,
      );
    }

    this.inFlight = false;
    this.settleFlushWaiters();
    if (!this.blocked && this.pendingDocument && this.pendingReady) {
      void this.flush();
    }
  }

  private async retryConflictReadback() {
    if (this.inFlight || !this.pendingDocument || !this.reconcileConflict) return;

    const document = this.pendingDocument;
    this.inFlight = true;
    this.notify("saving");
    const result = await this.tryReconcileConflict(document);

    if (result?.ok) {
      if (
        this.pendingDocument &&
        areSoapBlockDocumentsEqual(this.pendingDocument, document)
      ) {
        this.pendingDocument = null;
        this.pendingReady = false;
      }
      this.acceptSuccessfulResult(result);
    } else {
      this.blocked = true;
      this.conflictBlocked = true;
      this.notify("conflict", {
        ok: false,
        status: 409,
        denialReason: "soap_note_conflict",
      });
    }

    this.inFlight = false;
    this.settleFlushWaiters();
    if (!this.blocked && this.pendingDocument && this.pendingReady) {
      void this.flush();
    }
  }

  private async tryReconcileConflict(document: SoapBlockDocument) {
    if (!this.reconcileConflict) return null;
    const ambiguousWrite = Boolean(
      this.ambiguousDocument &&
        areSoapBlockDocumentsEqual(this.ambiguousDocument, document),
    );
    try {
      return await this.reconcileConflict({ ambiguousWrite, document });
    } catch {
      return null;
    }
  }

  private acceptSuccessfulResult(result: Extract<SoapAutosaveResult, { ok: true }>) {
    this.ambiguousDocument = null;
    this.blocked = false;
    this.conflictBlocked = false;
    this.expectedUpdatedAt = result.soapNote.updatedAt;
    if (!this.disposed) this.onPersisted(result.soapNote);
    this.notify(result.auditRecorded ? "saved" : "saved_with_warning", result);
  }

  private notify(state: SoapAutosaveState, result?: SoapAutosaveResult) {
    if (!this.disposed) this.onStateChange(state, result);
  }

  private clearTimer() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
