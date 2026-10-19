import type { LiveNotificationSnapshotResult } from "./live-notifications-client";

type Channel = {
  postMessage: (message: unknown) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
  close: () => void;
};

export type NotificationSharingEnvironment = {
  channel: (name: string) => Channel;
  claim: (name: string, acquired: () => Promise<void>) => Promise<void>;
  now: () => number;
  visible: () => boolean;
  everySecond: (tick: () => void) => () => void;
};
type ReadFence = { revision: number; startedAt: number; tickets: string[] };
type Message = {
  version: 1;
  scope: string;
  sender: string;
} & (
  | { kind: "heartbeat"; startedAt: number }
  | { kind: "invalidate"; ticket: string }
  | { kind: "end" }
  | { kind: "snapshot"; startedAt: number; tickets: string[]; result: LiveNotificationSnapshotResult }
);
type OutgoingMessage = Message extends infer Item ? Item extends Message
  ? Omit<Item, "version" | "scope" | "sender"> : never : never;

const HEALTH_WINDOW_MS = 5_000;
const FRESHNESS_MS = 30_000;

function browserEnvironment(): NotificationSharingEnvironment | undefined {
  if (typeof BroadcastChannel === "undefined" || !navigator.locks?.request) return;
  return {
    channel: name => new BroadcastChannel(name),
    claim: async (name, acquired) => {
      await navigator.locks.request(name, { ifAvailable: true }, async lock => {
        if (lock) await acquired();
      });
    },
    now: () => performance.timeOrigin + performance.now(),
    visible: () => document.visibilityState === "visible",
    everySecond: tick => {
      const timer = window.setInterval(tick, 1_000);
      return () => window.clearInterval(timer);
    },
  };
}

// The caller must first obtain scope from its own authorized GET. Channel
// messages never bootstrap authorization, survive logout, or authorize writes.
export function createNotificationPollSharing({
  scope, onRefresh, onSnapshot, onInvalidate, onEnd,
  environment = browserEnvironment(),
}: {
  scope: string;
  onRefresh: (reason: "poll" | "invalidate" | "fallback") => void;
  onSnapshot: (result: LiveNotificationSnapshotResult) => void;
  onInvalidate: () => void;
  onEnd: () => void;
  environment?: NotificationSharingEnvironment;
}) {
  if (!environment) return undefined;
  const env = environment;
  let channel: Channel;
  try { channel = env.channel(`clair.notifications.v1:${scope}`); } catch { return undefined; }
  const sender = crypto.randomUUID();
  let closed = false;
  let broken = false;
  let leader = false;
  let claiming = false;
  let release: (() => void) | undefined;
  let revision = 0;
  let lastHeartbeat = env.now();
  let lastProgress = env.now();
  let lastAttempt = env.now();
  let lastStartedAt = env.now();
  let minimumReadAt = 0;
  let pendingSince: number | undefined;
  let fallback = false;
  let suspended = false;
  const tickets = new Set<string>();
  const requiredTickets = new Set<string>();

  function post(message: OutgoingMessage) {
    if (closed || broken) return;
    try { channel.postMessage({ ...message, version: 1, scope, sender }); }
    catch { broken = true; release?.(); }
  }
  function claim() {
    if (closed || broken || suspended || claiming || leader || !env.visible()) return;
    claiming = true;
    void env.claim(`clair.notifications.v1:${scope}`, async () => {
      if (closed || broken || suspended || !env.visible()) return;
      leader = true;
      const holding = new Promise<void>(resolve => { release = resolve; });
      post({ kind: "heartbeat", startedAt: lastStartedAt });
      await holding;
      release = undefined;
      leader = false;
    }).catch(() => { broken = true; }).finally(() => { claiming = false; });
  }
  function refresh(reason: "poll" | "invalidate" | "fallback" = "poll") {
    lastAttempt = env.now();
    onRefresh(reason);
  }
  function tick() {
    if (closed || suspended) return;
    if (!env.visible()) { release?.(); return; }
    claim();
    const now = env.now();
    if (leader && !broken) {
      post({ kind: "heartbeat", startedAt: lastStartedAt });
      return;
    }
    const unhealthy = broken || now - lastHeartbeat >= HEALTH_WINDOW_MS;
    const stale = now - lastProgress >= FRESHNESS_MS;
    const invalidationStalled = pendingSince !== undefined && now - pendingSince >= HEALTH_WINDOW_MS;
    if (unhealthy || stale || invalidationStalled) {
      // Do not queue behind a frozen lock holder. The original per-window
      // request path is the correctness fallback; no lock stealing is needed.
      if (!fallback || now - lastAttempt >= FRESHNESS_MS || invalidationStalled) {
        fallback = true;
        pendingSince = undefined;
        refresh("fallback");
      }
    } else fallback = false;
  }
  function rememberTicket(ticket: string) {
    tickets.add(ticket);
    requiredTickets.add(ticket);
    if (tickets.size > 128) tickets.delete(tickets.values().next().value!);
    revision += 1;
    pendingSince = env.now();
    onInvalidate();
  }
  function receive(event: MessageEvent) {
    const message = event.data as Message | undefined;
    if (closed || !message || message.version !== 1 || message.scope !== scope || message.sender === sender) return;
    if (message.kind === "end") { onEnd(); return; }
    if (message.kind === "heartbeat" && Number.isFinite(message.startedAt)) {
      lastHeartbeat = env.now();
      lastProgress = Math.max(lastProgress, message.startedAt);
      return;
    }
    if (message.kind === "invalidate" && typeof message.ticket === "string") {
      if (!tickets.has(message.ticket)) {
        rememberTicket(message.ticket);
        if (leader) refresh("invalidate");
      }
      return;
    }
    if (message.kind !== "snapshot" || !Number.isFinite(message.startedAt) ||
      message.startedAt < minimumReadAt || !Array.isArray(message.tickets) ||
      [...requiredTickets].some(ticket => !message.tickets.includes(ticket)) ||
      !isSnapshot(message.result, scope)) return;
    minimumReadAt = message.startedAt;
    lastProgress = env.now();
    requiredTickets.clear();
    pendingSince = undefined;
    onSnapshot(message.result);
  }
  channel.addEventListener("message", receive);
  const stopTimer = env.everySecond(tick);
  claim();

  return {
    scope,
    readStarted(): ReadFence {
      const startedAt = env.now();
      lastStartedAt = startedAt;
      if (leader) post({ kind: "heartbeat", startedAt });
      minimumReadAt = startedAt;
      lastAttempt = startedAt;
      return { revision, startedAt, tickets: [...tickets] };
    },
    accepts(fence: ReadFence) { return !closed && fence.revision === revision; },
    publish(result: LiveNotificationSnapshotResult, fence: ReadFence) {
      if (closed || fence.revision !== revision || (!result.ok && result.aborted)) return;
      // A cookie/session change can be discovered by this direct GET. Never
      // place the new session's payload on the previous session's channel.
      if (result.ok && result.sharingScope !== scope) return;
      lastProgress = env.now();
      requiredTickets.clear();
      pendingSince = undefined;
      if (leader || (!result.ok && (result.error.status === 401 || result.error.status === 403))) {
        post({ kind: "snapshot", startedAt: fence.startedAt, tickets: fence.tickets, result });
      }
    },
    invalidate() {
      if (closed) return;
      const ticket = crypto.randomUUID();
      rememberTicket(ticket);
      post({ kind: "invalidate", ticket });
    },
    poll() {
      if (closed || suspended || !env.visible()) return;
      if (broken) { refresh("fallback"); return; }
      if (leader) { refresh(); return; }
      tick();
    },
    visibilityChanged() {
      if (!env.visible()) release?.();
      else { suspended = false; claim(); }
    },
    suspend() { suspended = true; release?.(); },
    close({ sessionEnded = false } = {}) {
      if (closed) return;
      if (sessionEnded) post({ kind: "end" });
      closed = true;
      revision += 1;
      release?.();
      stopTimer();
      channel.removeEventListener("message", receive);
      channel.close();
    },
  };
}

function isSnapshot(result: LiveNotificationSnapshotResult | undefined, scope: string) {
  if (!result || typeof result !== "object") return false;
  if (result.ok === false) return !result.aborted && result.error &&
    typeof result.error.message === "string" && typeof result.error.status === "number";
  return result.ok === true && result.sharingScope === scope &&
    Array.isArray(result.notifications) && result.notifications.length <= 100 &&
    result.notifications.every(row => row && typeof row.id === "string") && result.counts &&
    [result.counts.badge, result.counts.unread, result.counts.important, result.counts.archived]
      .every(count => Number.isInteger(count) && count >= 0);
}

export type NotificationPollSharing = NonNullable<ReturnType<typeof createNotificationPollSharing>>;
