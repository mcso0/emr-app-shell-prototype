-- Cover release-scoped service-review event lookups and the release foreign key.

set lock_timeout = '5s';
set statement_timeout = '120s';

create index if not exists clinical_master_dispensing_service_review_events_release_idx
  on private.clinical_master_dispensing_service_review_events (release_id);
