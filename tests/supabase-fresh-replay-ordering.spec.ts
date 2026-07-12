import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

test("Cheongdam backfill creates auth identities before public users", () => {
  const source = readFileSync(
    "supabase/migrations/20260702142317_cheongdam_realistic_roster_remote_backfill.sql",
    "utf8"
  );

  expect(source.indexOf("insert into auth.users")).toBeLessThan(
    source.indexOf("insert into public.users")
  );
});
