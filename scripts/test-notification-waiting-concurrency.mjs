#!/usr/bin/env node
// Local-only synthetic Postgres test. Requires the isolated schema-only DB and
// the candidate migration; never connects to hosted Supabase or the source DB.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const container = process.env.WAITING_TEST_CONTAINER ?? 'supabase_db_emr-app-shell-prototype';
const database = 'reception_idempotency_local';
const actor = '93000000-0000-4000-8000-000000000001';
function sql(query, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1']);
    let out = '', err = '';
    child.stdout.on('data', data => { out += data; if (ready && out.includes('ACK_READY')) { ready(); ready = undefined; } });
    child.stderr.on('data', data => { err += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)));
    child.stdin.end(query);
  });
}
function event(priority, key) {
  return JSON.stringify({ eventKey: 'waiting_over_30m', dedupeKey: key,
    domain: 'reception', priority, toastPolicy: 'role_active',
    title: 'Synthetic waiting', preview: 'Synthetic preview', detail: 'Synthetic detail',
    workTypeLabel: '접수', sourceLabel: 'Synthetic queue', sourceActionLabel: '접수 대기 열기',
    recipient: { kind: 'role_queue', id: 'desk', label: 'Synthetic desk' },
    source: { kind: 'reception_queue', entity_id: key, route: '/w/waiting-alpha/reception' },
    occurredAt: '2026-10-03T00:30:00Z', requiresAction: true, badgeCount: true,
  });
}
function emit(priority, key) {
  return sql(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    select public.clair_emit_notification_event('waiting-alpha',auth.uid(),$payload$${event(priority,key)}$payload$::jsonb)->>'action'; commit;`);
}
// Refuse to touch an already populated database, including our own previous run.
assert.equal(await sql(`select (select count(*) from public.users)+(select count(*) from public.workspaces)+(select count(*) from public.notification_events);`), '0', 'test database must be schema-only and empty');
const fixture = readFileSync('tests/sql/notification-waiting-threshold-idempotency.sql','utf8');
const setup = fixture.slice(fixture.indexOf('begin;'),fixture.indexOf('create function pg_temp.waiting_event'));
try {
  await sql(setup + `
    create schema waiting_test;
    create table waiting_test.writes(kind text);
    create function waiting_test.record_write() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
    begin insert into waiting_test.writes values(TG_TABLE_NAME||':'||TG_OP); return null; end; $$;
    create trigger test_waiting_writes after insert or update or delete on public.notification_events for each row execute function waiting_test.record_write();
    create trigger test_waiting_state_writes after insert or update or delete on public.notification_user_states for each row execute function waiting_test.record_write();
    commit;`);
  const first = await Promise.all(Array.from({length:16},()=>emit('high','concurrent-first')));
  assert.equal(first.filter(x=>x.endsWith('created')).length,1);
  assert.equal(first.filter(x=>x.endsWith('unchanged')).length,15);
  const mixed = await Promise.all(Array.from({length:20},(_,i)=>emit(i%2?'urgent':'high','concurrent-first')));
  assert.equal(mixed.filter(x=>x.endsWith('bumped')).length,1);
  assert.equal(mixed.filter(x=>x.endsWith('unchanged')).length,19);
  assert.equal(await sql(`select priority||':'||bump_count from public.notification_events where dedupe_key='concurrent-first';`),'urgent:2');
  // Concurrent first requests from opposite sides of the 60-minute boundary.
  await Promise.all(Array.from({length:16},(_,i)=>emit(i%2?'urgent':'high','concurrent-boundary')));
  assert.equal(await sql(`select count(*)=1 and bool_and(priority='urgent' and bump_count<=2) from public.notification_events where dedupe_key='concurrent-boundary';`),'t');
  await emit('high','ack-during-escalation');
  const notificationId = await sql(`select notification_id from public.notification_events where dedupe_key='ack-during-escalation';`);
  assert.match(notificationId, /^[a-zA-Z0-9-]+$/);
  let releaseReady;
  const ready = new Promise(resolve => { releaseReady=resolve; });
  // Hold an uncommitted, first-ever acknowledgement while the emitter escalates.
  const acknowledgement = sql(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    select public.clair_upsert_notification_user_state('waiting-alpha',auth.uid(),auth.uid()::text,
      '${notificationId}',
      '2026-10-03T00:35:00Z','2026-10-03T00:36:00Z');
    select 'ACK_READY'; select pg_sleep(2); commit;`, releaseReady);
  await Promise.race([ready, acknowledgement.then(()=>{throw new Error('ack marker missing');})]);
  let acknowledgementCommitted = false;
  const committed = acknowledgement.then(() => { acknowledgementCommitted = true; });
  await emit('urgent','ack-during-escalation');
  assert.equal(acknowledgementCommitted, false, 'escalation waited on the acknowledgement state');
  await committed;
  assert.equal(await sql(`select count(*)=1 and bool_and(read_at='2026-10-03T00:35:00Z' and archived_at='2026-10-03T00:36:00Z') from public.notification_user_states;`),'t');
  assert.equal(await sql(`select count(*) from waiting_test.writes where kind like 'notification_user_states:%';`),'1');
  assert.equal(await sql(`select count(*) from waiting_test.writes where kind='notification_events:INSERT';`),'3');
  console.log('PASS: 16 concurrent first requests -> 1 insert; 20 mixed high/urgent -> 1 update; concurrent boundary monotone; acknowledgement survives escalation with only its own state insert.');
} finally {
  // Delete only this run's synthetic workspace/users and test objects.
  await sql(`begin;
    drop trigger if exists test_waiting_writes on public.notification_events;
    drop trigger if exists test_waiting_state_writes on public.notification_user_states;
    drop schema if exists waiting_test cascade;
    delete from public.workspaces where id in ('waiting-alpha','waiting-beta');
    delete from public.users where id in ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000004');
    delete from auth.users where id in ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000004'); commit;`);
}
