import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localPasswordTargets } from "../scripts/set-local-synthetic-password.mjs";

const seed = readFileSync("supabase/seed.sql", "utf8");
const password = "private-" + "x".repeat(20);

test("local bootstrap selects only the existing 28 synthetic subjects", () => {
  const ids = localPasswordTargets(seed, "http://127.0.0.1:54321", password);
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, 28);
});

test("local bootstrap fails closed for hosted, redirected and unexpected endpoints", () => {
  for (const url of ["https://example.supabase.co", "http://127.0.0.1:54321.evil.invalid", "https://127.0.0.1:54321", "http://127.0.0.1:54322", "http://127.0.0.1:54321/proxy", "http://user@127.0.0.1:54321", "http://127.0.0.1:54321?remote=true"])
    assert.throws(() => localPasswordTargets(seed, url, password));
  assert.throws(() => localPasswordTargets(seed, "http://127.0.0.1:54321", ""));
  assert.throws(() => localPasswordTargets("", "http://127.0.0.1:54321", password));
});
