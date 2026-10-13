// Loopback-only auth substitute for login entry regressions. No email, SMS or remote calls.
import { createServer } from "node:http";
const port = 3224;
const userId = "91000000-0000-4000-8000-000000000001";
let control = {};
let calls = [];
const user = () => ({ id: userId, email: "login@example.test", role: "authenticated", aud: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-10-14T00:00:00Z", identities: [] });
const session = () => {
  const now = Math.floor(Date.now() / 1000);
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", email: "login@example.test", exp: now + 3600, iat: now, aud: "authenticated", amr: [{ method: control.recovery ? "recovery" : "otp", timestamp: now }] })).toString("base64url"), "synthetic-signature"].join(".");
  return { access_token: token, refresh_token: "synthetic-refresh-value", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: user() };
};
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  res.setHeader("access-control-allow-origin", "http://127.0.0.1:3223");
  res.setHeader("access-control-allow-headers", "authorization,apikey,content-type,x-client-info,x-supabase-api-version");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("content-type", "application/json");
  const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send({});
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  let body; try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { return send({}, 400); }
  if (url.pathname === "/health") return send({ ok: true });
  if (url.pathname === "/test/control") { control = body; calls = []; return send({ ok: true }); }
  if (url.pathname === "/test/calls") return send(calls);
  if (url.pathname === "/test/session") return send(session());
  calls.push({ path: url.pathname, method: req.method, createUser: body.create_user, email: body.email, redirectTo: url.searchParams.get("redirect_to"), grant: url.searchParams.get("grant_type") });
  if (control.delayMs) await new Promise(resolve => setTimeout(resolve, control.delayMs));
  if (url.pathname === "/auth/v1/otp") {
    if (control.sendError) return send({ message: "Synthetic send failure", error_code: control.sendError }, control.sendError === "over_email_send_rate_limit" ? 429 : 400);
    return send({});
  }
  if (url.pathname === "/auth/v1/verify") return body.token === "12345678" ? send(session()) : send({ message: "Synthetic invalid code", error_code: "otp_expired" }, 403);
  if (url.pathname === "/auth/v1/recover") return control.recoverError ? send({ message: "Synthetic recovery error", error_code: "over_email_send_rate_limit" }, 429) : send({});
  if (url.pathname === "/auth/v1/user" && req.method === "GET") return req.headers.authorization?.includes("synthetic-signature") ? send(user()) : send({ message: "No session", error_code: "bad_jwt" }, 401);
  if (url.pathname === "/auth/v1/user" && req.method === "PUT") return control.updateError ? send({ message: "Synthetic policy error", error_code: "weak_password" }, 400) : send(user());
  if (url.pathname === "/auth/v1/token") return control.tokenError ? send({ message: "Synthetic invalid link", error_code: "otp_expired" }, 400) : send(session());
  if (url.pathname === "/auth/v1/logout") return send({});
  return send({ message: "Unconfigured synthetic endpoint" }, 404);
}).listen(port, "127.0.0.1");
