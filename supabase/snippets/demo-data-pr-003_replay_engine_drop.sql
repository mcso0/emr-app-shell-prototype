-- DEMO-DATA-PR-003. Removes the temporary replay engine functions after the
-- seed is done. They are executable by postgres only, so leaving them changes
-- no app behavior, but they are not part of the migration history.
-- Run in the Supabase SQL editor. The last statement must return 0.

drop function if exists private.clair_demo_replay_batch(jsonb, boolean);
drop function if exists private.clair_demo_replay_visit(jsonb);
drop function if exists private.clair_demo_replay_shift(timestamptz, timestamptz, uuid);
drop function if exists private.clair_demo_replay_as(text);

select count(*) as remaining
from pg_proc
where pronamespace = 'private'::regnamespace and proname like 'clair_demo_replay%';
