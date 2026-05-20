import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql",
  "utf8"
);

test("order catalog migration creates individual orders sets lab items and links", () => {
  expect(migration).toContain("create table if not exists public.order_catalog_items");
  expect(migration).toContain("create table if not exists public.order_sets");
  expect(migration).toContain("create table if not exists public.order_set_items");
  expect(migration).toContain("create table if not exists public.lab_test_categories");
  expect(migration).toContain("create table if not exists public.lab_test_items");
  expect(migration).toContain("create table if not exists public.order_catalog_lab_test_item_links");
});

test("order catalog migration preserves active paused inactive and chart search snapshots", () => {
  expect(migration).toContain("check (availability_status in ('active', 'paused', 'inactive'))");
  expect(migration).toContain("create or replace view public.order_catalog_chart_search");
  expect(migration).toContain("where availability_status = 'active'");
  expect(migration).toContain("'appliedPriceKrw'");
  expect(migration).toContain("'appliedAmountBasis'");
});

test("order catalog migration stores medication vaccine pricing and delete lock data", () => {
  expect(migration).toContain("pricing_rule jsonb not null");
  expect(migration).toContain("medication_metadata jsonb not null");
  expect(migration).toContain("vaccine_metadata jsonb not null");
  expect(migration).toContain("create or replace view public.lab_test_item_delete_locks");
  expect(migration).toContain("saved_result_usage_count");
});
