-- DEMO-DATA-PR-003. Remove the #1128 read-only 시연 이력 archive.
-- Seeded Cheongdam history now lives in ordinary chart tables. The archive
-- held only one fictional batch, so dropping it loses no clinical record.
-- Safe to apply before the app release: the previous route maps a missing
-- read function (PGRST202) to an empty list.
drop function if exists public.clair_read_cheongdam_demo_history(text, uuid);
drop function if exists public.clair_activate_cheongdam_demo_history(text, jsonb);
drop function if exists public.clair_retire_cheongdam_demo_history(text);
drop function if exists private.clair_can_manage_cheongdam_demo_history();
drop table if exists private.clair_cheongdam_demo_history_batches;
