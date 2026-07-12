-- Synthetic staff avatars use a public read-only bucket. Uploads are performed
-- by the trusted seed/upload workflow, not by arbitrary browser clients.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Store the object path in the existing nullable profile reference field.
-- The application resolves this path through the public `avatars` bucket.
update public.user_profiles
set avatar_url = user_id::text || '.png', updated_at = now()
where user_id in (
  '49110000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  '49110000-0000-4000-8000-000000000005',
  '49110000-0000-4000-8000-000000000006',
  '49110000-0000-4000-8000-000000000007',
  '49110000-0000-4000-8000-000000000008',
  '49110000-0000-4000-8000-000000000009',
  '49110000-0000-4000-8000-000000000010',
  '49110000-0000-4000-8000-000000000011',
  '49110000-0000-4000-8000-000000000012',
  '49110000-0000-4000-8000-000000000013'
);
