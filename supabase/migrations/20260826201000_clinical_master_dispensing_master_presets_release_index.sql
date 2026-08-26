-- Cover the release foreign key used by release-bounded preset validation.

set lock_timeout = '5s';
set statement_timeout = '30s';

create index if not exists dispensing_order_prescription_presets_release_idx
  on master.dispensing_order_prescription_presets (source_release_id);
