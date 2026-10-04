#!/usr/bin/env node
// Same isolated synthetic fixtures for legacy and v2; no billing/egress claims.
import assert from 'node:assert/strict';
import { setup, cleanup, sql } from './test-notification-bounded-concurrency.mjs';
const measurements = [];
for (const events of [0, 100, 1000, 1750]) {
  await setup(events);
  try {
    const actor = '94000000-0000-4000-8000-000000000001';
    const output = await sql(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      with responses as (
        select public.clair_list_notification_events('notification-alpha') as old_events,
          public.clair_list_notification_user_states('notification-alpha',auth.uid(),auth.uid()::text) as old_states,
          public.clair_read_notification_snapshot_v2('notification-alpha',auth.uid(),auth.uid()::text,null,'snapshot',100) as bounded
      ) select jsonb_build_object('old_events',old_events,'old_states',old_states,'bounded',bounded,
        'old_pg_json_text_bytes',octet_length(old_events::text)+octet_length(old_states::text),
        'bounded_pg_json_text_bytes',octet_length(bounded::text)) from responses; rollback;`);
    const r = JSON.parse(output.split('\n').at(-1));
    const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
    assert.equal(r.old_events.notifications.length, events);
    assert.equal(r.bounded.notifications.length, Math.min(100, events));
    assert.equal(r.bounded.counts.unread, events - (events >= 249 ? 3 : events >= 231 ? 2 : events >= 230 ? 1 : 0));
    measurements.push({ events, old_returned_events: events, bounded_returned_events: r.bounded.notifications.length,
      old_returned_states: r.old_states.states.length, bounded_returned_states: r.bounded.states.length,
      old_pg_json_text_bytes: r.old_pg_json_text_bytes, bounded_pg_json_text_bytes: r.bounded_pg_json_text_bytes,
      old_json_stringify_bytes: bytes(r.old_events)+bytes(r.old_states), bounded_json_stringify_bytes: bytes(r.bounded),
      unread: r.bounded.counts.unread });
  } finally { await cleanup(); }
}
console.log(JSON.stringify({ fixture: 'synthetic only; before mutations',
  units: 'UTF-8 serialized JSON bytes. PostgreSQL JSONB text and JSON.stringify measured separately; neither is measured HTTP wire bytes or production egress.', measurements }, null, 2));
