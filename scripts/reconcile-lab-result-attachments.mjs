// Manual bounded service-only cleanup for deleted and expired pending lab files.
// Pending metadata is kept at least three hours, past the two-hour signed-upload token life.
// Dry run by default. Running --apply against a remote project needs approval.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
if (!url || !key) throw new Error("Supabase URL and service key are required");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = client.storage.from("lab-result-attachments");
const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { data: tombstones, error: readError } = await client.from("lab_result_attachments")
  .select("id, workspace_id, storage_path")
  .not("deleted_at", "is", null).is("storage_deleted_at", null).limit(100);
if (readError) throw readError;
const { data: pending, error: pendingError } = await client.from("lab_result_attachments")
  .select("id, workspace_id, storage_path").is("ready_at", null).is("deleted_at", null)
  .lt("created_at", cutoff).limit(100);
if (pendingError) throw pendingError;
process.stdout.write(JSON.stringify({ deleted: tombstones?.length ?? 0, expiredPending: pending?.length ?? 0, apply }) + "\n");
if (!apply) process.exit(0);
for (const item of tombstones ?? []) {
  const removed = await bucket.remove([item.storage_path]);
  if (removed.error) continue;
  const marked = await client.from("lab_result_attachments")
    .update({ storage_deleted_at: new Date().toISOString() })
    .eq("workspace_id", item.workspace_id).eq("id", item.id)
    .not("deleted_at", "is", null).is("storage_deleted_at", null);
  if (marked.error) throw marked.error;
}
for (const item of pending ?? []) {
  const removed = await bucket.remove([item.storage_path]);
  if (removed.error) continue;
  const discarded = await client.from("lab_result_attachments").delete()
    .eq("workspace_id", item.workspace_id).eq("id", item.id)
    .is("ready_at", null).is("deleted_at", null);
  if (discarded.error) throw discarded.error;
}
process.stdout.write("Cleanup batch completed.\n");
