#!/usr/bin/env node
// Local-only, bounded synthetic concurrency test; guarded schema-only database.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const database = 'notification_bounded_local';
const actor = '94000000-0000-4000-8000-000000000001';
export function sql(query, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', 'supabase_db_emr-app-shell-prototype', 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1']);
    let output = '', error = '';
    child.stdout.on('data', data => { output += data; if (ready && output.includes('STATE_READY')) { ready(); ready = undefined; } });
    child.stderr.on('data', data => { error += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(query);
  });
}
export async function setup(rows = 250) {
  assert(Number.isInteger(rows) && rows >= 0 && rows <= 1750);
  const fixture = readFileSync('tests/sql/notification-bounded-snapshot.sql', 'utf8').replace('generate_series(1,250)', `generate_series(1,${rows})`);
  await sql(fixture.slice(fixture.indexOf('begin;'), fixture.indexOf('-- FIXTURE_END')) + 'commit;');
}
export async function cleanup() {
  await sql(`begin;
    do $$ begin
      if current_database() <> 'notification_bounded_local'
        or exists(select 1 from public.users where id::text not like '94000000-0000-4000-8000-%')
        or exists(select 1 from auth.users where id::text not like '94000000-0000-4000-8000-%')
        or exists(select 1 from public.workspaces where id not in ('notification-alpha','notification-beta')) then
        raise exception 'refuse cleanup outside this synthetic fixture'; end if;
    end $$;
    truncate public.workspaces, public.users, auth.users cascade; commit;`);
}
export async function rpc(action, id = null) {
  const result = await sql(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    select public.clair_mutate_notification_user_state_v2('notification-alpha',auth.uid(),auth.uid()::text,
      '${action}',${id ? `'${id}'` : 'null'}); commit;`);
  return JSON.parse(result.split('\n').at(-1));
}
if (process.argv[1]?.endsWith('test-notification-bounded-concurrency.mjs')) {
  await setup();
  try {
    let markReady;
    const ready = new Promise(resolve => { markReady = resolve; });
    // Legacy state writer does not take the event lock: hold its archive open
    // while new read-all races, exercising ON CONFLICT's state recheck.
    const archive = sql(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      select public.clair_upsert_notification_user_state('notification-alpha',auth.uid(),auth.uid()::text,
        'synthetic-0200','2026-10-03T01:00:00Z','2026-10-03T02:00:00Z');
      select 'STATE_READY'; select pg_sleep(1); commit;`, markReady);
    await Promise.race([ready, archive.then(() => { throw new Error('marker missing'); })]);
    const bulk = await rpc('read-all'); await archive;
    assert.equal(bulk.updatedCount, 246); assert.equal(bulk.counts.archived, 3); assert.equal(bulk.counts.unread, 0);
    assert.equal(await sql(`select read_at='2026-10-03T01:00:00Z' and archived_at='2026-10-03T02:00:00Z'
      from public.notification_user_states where notification_id='synthetic-0200';`), 't');
    await Promise.all(Array.from({ length: 6 }, () => rpc('read-all')));
    await Promise.all([rpc('archive', 'synthetic-0150'), rpc('read', 'synthetic-0150')]);
    assert.equal(await sql(`select archived_at is not null from public.notification_user_states where notification_id='synthetic-0150';`), 't');
    await rpc('restore', 'synthetic-0150');
    assert.equal(await sql(`select read_at is not null and archived_at is null from public.notification_user_states where notification_id='synthetic-0150';`), 't');
    // PR895 acknowledgement survives threshold escalation with new RPC states.
    const emitted = JSON.stringify({ eventKey: 'waiting_over_30m', dedupeKey: 'synthetic-150', domain: 'reception', priority: 'urgent',
      title: 'Synthetic alert', preview: 'Synthetic preview', detail: 'Synthetic detail', workTypeLabel: '접수', sourceLabel: 'Synthetic queue', sourceActionLabel: '접수 대기 열기',
      recipient: { kind: 'role_queue', id: 'desk' }, source: { kind: 'reception_queue', route: '/w/notification-alpha/reception' }, requiresAction: true, badgeCount: true });
    const before = await sql(`select to_jsonb(s) from public.notification_user_states s where notification_id='synthetic-0150';`);
    await sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true);
      select public.clair_emit_notification_event('notification-alpha',auth.uid(),$event$${emitted}$event$::jsonb)->>'action'; commit;`);
    assert.equal(await sql(`select to_jsonb(s) from public.notification_user_states s where notification_id='synthetic-0150';`), before);
    console.log('PASS: legacy archive vs full read-all; 6 overlapping full read-all requests; concurrent archive/read; restore; PR895 escalation preserves acknowledgement.');
  } finally { await cleanup(); }
}
