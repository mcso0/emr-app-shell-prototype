import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const bucket = "avatars";
const projectRoot = process.cwd();
const avatarDirectory = path.join(projectRoot, "public", "avatars");
const avatarUserIds = [
  "49110000-0000-4000-8000-000000000001",
  "49110000-0000-4000-8000-000000000003",
  "49110000-0000-4000-8000-000000000005",
  "49110000-0000-4000-8000-000000000006",
  "49110000-0000-4000-8000-000000000007",
  "49110000-0000-4000-8000-000000000008",
  "49110000-0000-4000-8000-000000000009",
  "49110000-0000-4000-8000-000000000010",
  "49110000-0000-4000-8000-000000000011",
  "49110000-0000-4000-8000-000000000012",
  "49110000-0000-4000-8000-000000000013",
];

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const isLocalUrl = /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\b/.test(url);
if (!isLocalUrl && process.env.ALLOW_REMOTE_AVATAR_UPLOAD !== "1") {
  throw new Error(
    "Refusing a non-local avatar upload. Set ALLOW_REMOTE_AVATAR_UPLOAD=1 only when the remote synthetic target is explicitly approved.",
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const userId of avatarUserIds) {
  const storagePath = `${userId}.png`;
  const file = await readFile(path.join(avatarDirectory, storagePath));
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: "31536000",
    contentType: "image/png",
    upsert: true,
  });

  if (uploadError) throw new Error(`Avatar upload failed for ${userId}: ${uploadError.message}`);

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: storagePath, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (profileError) throw new Error(`Profile mapping failed for ${userId}: ${profileError.message}`);
}

console.log(`Uploaded and mapped ${avatarUserIds.length} synthetic staff avatars to ${bucket}.`);
