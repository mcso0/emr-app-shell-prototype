import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Next also loads dotenv files. Refuse them instead of inheriting hosted credentials.
for (const file of [".env", ".env.local", ".env.development", ".env.development.local"]) {
  if (existsSync(file)) throw new Error(`Synthetic chart tests require a checkout without ${file}`);
}
const keys = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SHELL"];
const env = Object.fromEntries(keys.filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { NEXT_PUBLIC_AUTH_MODE: "mock", NEXT_TELEMETRY_DISABLED: "1" });
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", "3194"], {
  cwd: process.cwd(), env, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
child.on("exit", code => process.exit(code ?? 1));
