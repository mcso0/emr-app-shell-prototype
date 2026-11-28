import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261128110000_set_parent_billing_authority.sql",
  "utf8",
);
const previous = readFileSync(
  "supabase/migrations/20260912113946_dispensing_set_confirmation_compatibility.sql",
  "utf8",
);
const contract = readFileSync("tests/sql/set-parent-billing-authority.sql", "utf8");

test("candidate authority falls back to the parent-billed set price snapshot", () => {
  expect(migration).toContain("create or replace function private.clair_snapshot_order_billing_authority()");
  expect(migration).toContain("orders.row_type = 'set'");
  expect(migration).toContain("orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'");
  expect(migration).toContain("orders.applied_price_snapshot ->> 'amountBasis' in ('set_fixed_price', 'range_price')");
  expect(migration).toContain("case when v_set_price is not null then 'fixed_set' end");
  expect(migration).toContain("case when v_set_price is not null then 'parent' end");
  // A non-concrete tax type such as "derived" must not become a tax class.
  expect(migration).toContain("when v_set_price ->> 'taxType' in ('taxable', 'non_taxable')");
});

test("explicit authority and the legacy amount basis keep priority over the set fallback", () => {
  const priceBasis = migration.slice(
    migration.indexOf("new.price_basis_snapshot := coalesce("),
    migration.indexOf("new.billing_unit_snapshot := coalesce("),
  );
  const order = [
    "new.price_basis_snapshot,",
    "nullif(v_authority ->> 'priceBasis', '')",
    "case v_legacy_amount_basis",
    "case when v_set_price is not null then 'fixed_set' end",
  ].map((part) => priceBasis.indexOf(part));
  expect(order.every((index) => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // Every source the previous definition read is still read.
  for (const source of [
    "new.source_snapshot -> 'dispensingAuthoritySnapshot'",
    "new.source_snapshot -> 'planOrderAuthority'",
    "new.source_snapshot #> '{appliedSnapshot,planOrderAuthority}'",
    "nullif(new.source_snapshot ->> 'taxType', '')",
  ]) {
    expect(previous).toContain(source);
    expect(migration).toContain(source);
  }
});

test("function stays private and existing candidates are not rewritten", () => {
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = pg_catalog, public, private");
  expect(migration).toMatch(/revoke all on function private\.clair_snapshot_order_billing_authority\(\)\s+from public, anon, authenticated, service_role;/);
  expect(migration).not.toMatch(/update public\.order_billing_candidates/);
});

test("SQL contract drives a fixed-price set to a paid invoice and always rolls back", () => {
  expect(contract).toContain("clair_request_selected_chart_order_billing");
  expect(contract).toContain("'fixed_set'");
  expect(contract).toContain("raise exception 'SET_PARENT_BILLING_CONTRACT_ROLLBACK");
  expect(contract).not.toMatch(/^\s*commit\s*;/im);
});
