#!/usr/bin/env node
// Manual, bounded service-only cleanup for expired SOAP attachment capabilities.
// Dry run by default. Run --apply only after reviewing the count on the target.
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  process.stderr.write("Missing server-only Supabase configuration.\n");
  process.exit(1);
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
// A signed capability can be minted immediately before cancellation. Retain
// its tombstone for longer than the token lifetime before removing bytes.
const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { data: rows, error } = await client.from("chart_soap_attachments")
  .select("id,pending_path,storage_path,ready_at,cancelled_at,created_at")
  .is("pending_cleaned_at", null)
  .or(`and(ready_at.is.null,cancelled_at.is.null,created_at.lt.${cutoff}),ready_at.lt.${cutoff},cancelled_at.lt.${cutoff}`)
  .order("created_at", { ascending: true }).limit(100);
if (error) {
  process.stderr.write("Attachment reconciliation query failed.\n");
  process.exit(1);
}
process.stdout.write(`Expired pending rows: ${rows.length}${rows.length === 100 ? " (batch limit reached)" : ""}.\n`);
if (!apply) {
  process.stdout.write("Dry run. Pass --apply to tombstone and remove expired objects.\n");
  process.exit(0);
}
let cleaned = 0;
let tombstoned = 0;
let failed = 0;
for (const row of rows) {
  if (!row.ready_at && !row.cancelled_at) {
    const { data, error: updateError } = await client.from("chart_soap_attachments")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", row.id).is("ready_at", null).is("cancelled_at", null)
      .select("id").maybeSingle();
    if (updateError || data?.id !== row.id) {
      failed += 1;
      continue;
    }
    tombstoned += 1;
    continue;
  }
  // Keep completed final bytes. Both completed and cancelled rows retain
  // metadata; this removes only expired upload capabilities and orphan bytes.
  const { error: removeError } = await client.storage.from("chart-soap-attachments")
    .remove(row.ready_at ? [row.pending_path] : [row.pending_path, row.storage_path]);
  if (removeError) {
    failed += 1;
    continue;
  }
  const { data, error: updateError } = await client.from("chart_soap_attachments")
    .update({ pending_cleaned_at: new Date().toISOString() })
    .eq("id", row.id).is("pending_cleaned_at", null)
    .select("id").maybeSingle();
  if (updateError || data?.id !== row.id) failed += 1;
  else cleaned += 1;
}
process.stdout.write(`Tombstoned: ${tombstoned}; cleaned: ${cleaned}; retryable failures: ${failed}.\n`);
if (failed) process.exitCode = 1;
