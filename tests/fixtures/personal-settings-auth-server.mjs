// Loopback-only deterministic Auth/PostgREST substitute. Never sends email.
import { createServer } from "node:http";
const userId = "91000000-0000-4000-8000-000000000001";
const otherId = "91000000-0000-4000-8000-000000000002";
let control = {};
let calls = [];
let preferences = new Map();
const user = id => ({ id, email: "settings@example.test", role: "authenticated", aud: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-09-08T00:00:00Z", identities: [] });
const token = id => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: id, role: "authenticated", email: "settings@example.test", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), aud: "authenticated", amr: [{ method: control.recovery ? "recovery" : "password", timestamp: Math.floor(Date.now() / 1000) }] })).toString("base64url"), "synthetic-signature"].join(".");
const session = id => ({ access_token: token(id), refresh_token: "synthetic-refresh-value", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(id) });
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:43113");
  res.setHeader("access-control-allow-origin", "http://127.0.0.1:43114");
  res.setHeader("access-control-allow-headers", "authorization,apikey,content-type,x-client-info,x-supabase-api-version");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("content-type", "application/json");
  function send(body, status = 200) { res.statusCode = status; res.end(JSON.stringify(body)); }
  if (req.method === "OPTIONS") return send({});
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  let body = {}; try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { return send({}, 400); }
  if (url.pathname === "/test/control") { control = body; calls = []; preferences = new Map(); return send({ ok: true }); }
  if (url.pathname === "/test/calls") return send(calls);
  if (url.pathname === "/test/session") return send(session(userId));
  if (url.pathname === "/health") return send({ ok: true });
  calls.push({ path: url.pathname, method: req.method, grant: url.searchParams.get("grant_type"), scope: url.searchParams.get("scope"), currentPasswordProvided: typeof body.current_password === "string", workspaceId: body.workspace_id, userId: body.user_id, queryUserId: url.searchParams.get("user_id") });
  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    if (!req.headers.authorization?.includes("synthetic-signature")) return send({ message: "No session", code: "bad_jwt" }, 401);
    return send(user(userId));
  }
  if (url.pathname === "/auth/v1/token") {
    if (url.searchParams.get("grant_type") === "password" && body.password !== "synthetic-current-password") return send({ error_code: "invalid_credentials", msg: "Invalid credentials" }, 400);
    return send(session(control.wrongUser ? otherId : userId));
  }
  if (url.pathname === "/auth/v1/user" && req.method === "PUT") return control.failUpdate ? send({ message: "Password policy rejected", code: "weak_password" }, 400) : send(user(userId));
  if (url.pathname === "/auth/v1/logout" || url.pathname === "/auth/v1/recover") return send({});
  if (url.pathname === "/rest/v1/user_memberships") return send([{ status: control.inactive ? "inactive" : "active" }]);
  if (url.pathname === "/rest/v1/users") return send([{ status: control.inactiveUser ? "inactive" : "active" }]);
  if (url.pathname === "/rest/v1/workspace_notification_preferences") {
    const workspace = body.workspace_id ?? url.searchParams.get("workspace_id")?.replace("eq.", "");
    if (req.method === "POST") {
      const value = { popup: body.popup, sound: body.sound, categories: body.categories };
      preferences.set(workspace, value);
      return send(value);
    }
    const found = preferences.get(workspace);
    return send(found ? [found] : []);
  }
  return send({ message: "Unconfigured synthetic endpoint" }, 404);
}).listen(43113, "127.0.0.1");
