import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function localPasswordTargets(sql, apiUrl, password) {
  const url = new URL(apiUrl);
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)
    || url.port !== "54321" || url.username || url.password || url.pathname !== "/"
    || url.search || url.hash) throw new Error("Only the local Supabase API on port 54321 is allowed");
  if (typeof password !== "string" || password.length < 16 || password.length > 72)
    throw new Error("Set CLAIR_SYNTHETIC_AUTH_PASSWORD to a private 16–72 character value");
  const ids = [...sql.matchAll(/'([0-9a-f-]{36})',\s*'authenticated',\s*'authenticated',\s*'[^']+@[^']+\.local'/g)].map((m) => m[1]);
  const targets = [...new Set(ids)];
  if (targets.length !== 28) throw new Error("Unexpected synthetic seed subjects; no accounts changed");
  return targets;
}

async function main() {
  const password = process.env.CLAIR_SYNTHETIC_AUTH_PASSWORD;
  if (!password) throw new Error("Set CLAIR_SYNTHETIC_AUTH_PASSWORD privately before running");
  const status = spawnSync("npx", ["--yes", "supabase@2.121.0", "status", "--output", "json"], { encoding: "utf8" });
  if (status.status !== 0) throw new Error("Local Supabase must be running; no accounts changed");
  const config = JSON.parse(status.stdout);
  const targets = localPasswordTargets(readFileSync("supabase/seed.sql", "utf8"), config.API_URL, password);
  if (!config.SERVICE_ROLE_KEY) throw new Error("Local Supabase admin key unavailable");
  for (const id of targets) {
    const response = await fetch(new URL(`/auth/v1/admin/users/${id}`, config.API_URL), {
      method: "PUT",
      redirect: "error",
      headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error(`Local password update failed (HTTP ${response.status}); credential omitted`);
  }
  console.log(`Configured ${targets.length} local synthetic accounts. No credentials saved or printed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Local synthetic password setup failed. Check local Supabase and the private environment value; no credential details printed.");
    process.exitCode = 1;
  });
}
