// Test-only loopback harness. No env files, database, login, or hosted services.
import { createServer } from "vite";
import { resolve } from "node:path";
const server = await createServer({
  configFile: false, envFile: false,
  resolve: { alias: { "@": resolve("src") } },
  esbuild: { jsx: "automatic" },
  define: { "process.env.NEXT_PUBLIC_SUPABASE_URL": '""', "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""' },
  server: { host: "127.0.0.1", port: 0, hmr: false },
});
await server.listen();
console.log(`NOTIFICATION_HARNESS_URL=http://127.0.0.1:${server.httpServer.address().port}`);
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, async () => { await server.close(); process.exit(0); });
