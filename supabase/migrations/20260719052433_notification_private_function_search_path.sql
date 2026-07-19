-- ENGINEERING-PERF-PR-001: remove mutable search paths introduced by the
-- notification persistence foundation.

alter function private.clair_notification_scope_id(text)
  set search_path = public, private, pg_temp;

alter function private.clair_notification_event_json(public.notification_events)
  set search_path = public, private, pg_temp;
