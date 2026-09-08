-- Durable operator-only evidence after a complete rollback rehearsal.
-- A gateway timeout must not force a blind retry or imply success.
create table private.wp10_ready_orders_rehearsal (
  packet_sha256 text primary key check(packet_sha256 ~ '^[a-f0-9]{64}$'),
  outcome jsonb not null check((
    outcome->'rehearsal'='true'::jsonb and outcome->'applied'='false'::jsonb
    and outcome->>'packetSha256'=packet_sha256) is true),
  completed_at timestamptz not null default clock_timestamp()
);
alter table private.wp10_ready_orders_rehearsal enable row level security;
revoke all on private.wp10_ready_orders_rehearsal from public,anon,authenticated,service_role;
