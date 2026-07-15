import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const syntheticPassword = process.env.CLAIR_SYNTHETIC_AUTH_PASSWORD;
const allowRemote = process.env.ALLOW_REMOTE_STAFF_PROFILE_QA === "1";
const workspaceId = "workspace-clair-cheongdam";
const topic = `workspace:${workspaceId}:staff-presence`;
const timeoutMs = 10_000;

if (!supabaseUrl || !publishableKey || !syntheticPassword) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and CLAIR_SYNTHETIC_AUTH_PASSWORD are required.",
  );
}

const hostname = new URL(supabaseUrl).hostname;
if (!allowRemote && hostname !== "127.0.0.1" && hostname !== "localhost") {
  throw new Error(
    "Remote staff-profile QA is disabled. Set ALLOW_REMOTE_STAFF_PROFILE_QA=1 only for the approved synthetic target.",
  );
}

const actor = createClient(supabaseUrl, publishableKey, authOptions());
const peer = createClient(supabaseUrl, publishableKey, authOptions());
const outsider = createClient(supabaseUrl, publishableKey, authOptions());
let actorChannel = null;
let peerChannel = null;
let outsiderChannel = null;

try {
  const actorSession = await signIn(actor, "vet-cheongdam@clair.local");
  const peerSession = await signIn(peer, "tech-cheongdam@clair.local");
  const outsiderSession = await signIn(outsider, "foreign-admin@clair.local");

  await Promise.all([
    actor.realtime.setAuth(actorSession.access_token),
    peer.realtime.setAuth(peerSession.access_token),
    outsider.realtime.setAuth(outsiderSession.access_token),
  ]);

  peerChannel = peer.channel(topic, {
    config: { private: true, presence: { key: peerSession.user.id } },
  });
  const actorVisibleToPeer = waitForPresence(
    peerChannel,
    actorSession.user.id,
    true,
  );
  await expectSubscribed(peerChannel);

  actorChannel = actor.channel(topic, {
    config: { private: true, presence: { key: actorSession.user.id } },
  });
  await expectSubscribed(actorChannel);
  const trackStatus = await actorChannel.track({
    onlineAt: new Date().toISOString(),
    synthetic: true,
    userId: actorSession.user.id,
  });
  if (trackStatus !== "ok") {
    throw new Error(`presence_track_failed: ${trackStatus}`);
  }
  await actorVisibleToPeer;

  const heartbeat = await actor.rpc("clair_touch_workspace_member_activity", {
    p_workspace_id: workspaceId,
  });
  assertNoError(heartbeat.error, "activity_heartbeat_failed");
  if (!heartbeat.data || Number.isNaN(Date.parse(heartbeat.data))) {
    throw new Error("activity_heartbeat_timestamp_missing");
  }

  outsiderChannel = outsider.channel(topic, {
    config: { private: true, presence: { key: outsiderSession.user.id } },
  });
  await expectDenied(outsiderChannel);

  const actorRemovedFromPeer = waitForPresenceState(
    peerChannel,
    actorSession.user.id,
    false,
  );
  const untrackStatus = await actorChannel.untrack();
  if (untrackStatus !== "ok") {
    throw new Error(`presence_untrack_failed: ${untrackStatus}`);
  }
  await actorRemovedFromPeer;

  console.log(
    JSON.stringify({
      activityHeartbeat: true,
      crossWorkspaceDenied: true,
      presenceCleanup: true,
      sameWorkspaceSubscribe: true,
      sameWorkspaceTrackAndObserve: true,
      target: allowRemote ? "approved-remote-synthetic" : "local",
    }),
  );
} finally {
  await Promise.all([
    removeChannel(actor, actorChannel),
    removeChannel(peer, peerChannel),
    removeChannel(outsider, outsiderChannel),
  ]);
  await Promise.all([
    actor.auth.signOut().catch(() => undefined),
    peer.auth.signOut().catch(() => undefined),
    outsider.auth.signOut().catch(() => undefined),
  ]);
  actor.realtime.disconnect();
  peer.realtime.disconnect();
  outsider.realtime.disconnect();
}

function authOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };
}

async function signIn(client, email) {
  const result = await client.auth.signInWithPassword({
    email,
    password: syntheticPassword,
  });
  assertNoError(result.error, `synthetic_login_failed:${email}`);
  if (!result.data.session || !result.data.user) {
    throw new Error(`synthetic_session_missing:${email}`);
  }
  return result.data.session;
}

function expectSubscribed(channel) {
  return withTimeout(
    new Promise((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(
            new Error(
              `same_workspace_subscribe_failed:${status}:${error?.message ?? "unknown"}`,
            ),
          );
        }
      });
    }),
    "same_workspace_subscribe_timeout",
  );
}

function expectDenied(channel) {
  return withTimeout(
    new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") resolve();
        if (status === "TIMED_OUT") {
          reject(new Error("cross_workspace_subscribe_timed_out"));
        }
        if (status === "SUBSCRIBED") {
          reject(new Error("cross_workspace_subscribe_unexpectedly_succeeded"));
        }
      });
    }),
    "cross_workspace_denial_timeout",
  );
}

function waitForPresence(channel, userId, expectedPresent) {
  return withTimeout(
    new Promise((resolve) => {
      const inspect = () => {
        const present = (channel.presenceState()[userId]?.length ?? 0) > 0;
        if (present === expectedPresent) resolve();
      };
      channel.on("presence", { event: "sync" }, inspect);
      channel.on("presence", { event: "join" }, inspect);
      channel.on("presence", { event: "leave" }, inspect);
    }),
    expectedPresent ? "presence_join_timeout" : "presence_leave_timeout",
  );
}

function waitForPresenceState(channel, userId, expectedPresent) {
  return new Promise((resolve, reject) => {
    let timeout;
    const interval = setInterval(() => {
      const present = (channel.presenceState()[userId]?.length ?? 0) > 0;
      if (present !== expectedPresent) return;
      clearInterval(interval);
      clearTimeout(timeout);
      resolve();
    }, 50);
    timeout = setTimeout(() => {
      clearInterval(interval);
      reject(
        new Error(
          expectedPresent ? "presence_join_timeout" : "presence_leave_timeout",
        ),
      );
    }, timeoutMs);
  });
}

async function removeChannel(client, channel) {
  if (!channel) return;
  await client.removeChannel(channel).catch(() => undefined);
}

function withTimeout(promise, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function assertNoError(error, fallback) {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}
