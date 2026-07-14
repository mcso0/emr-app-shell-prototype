---
type: Operating Rule
title: Supabase Migration History Reconciliation
description: Defines the verified timestamp aliases, preserved remote-only SQL, and genuinely pending remote migrations.
tags:
  - supabase
  - migrations
  - release
last_updated: 2026-07-15
---

# Supabase Migration History Reconciliation

## Current Contract

The linked synthetic/demo Supabase project and `supabase/migrations` now share every remotely recorded migration version. Remote-only history count is `0` as of 2026-07-15.

Do not delete or rename the compatibility aliases below. Their SQL was applied remotely under the remote timestamp, while an identical canonical file exists locally under a different timestamp. The alias files intentionally contain comments only so fresh local replay does not execute the same SQL twice.

| Remote history alias | Canonical local migration |
| --- | --- |
| `20260524121849_remote_history_alias_invite_acceptance.sql` | `20260524121000_invite_acceptance_app_user_upsert.sql` |
| `20260529090705_remote_history_alias_chart_encounter_bridge.sql` | `20260529090000_den_307_chart_encounter_id_bridge.sql` |
| `20260529090827_remote_history_alias_staging_encounter_bridge.sql` | `20260529090800_den_307_staging_demo_encounter_bridge_candidates.sql` |
| `20260601112430_remote_history_alias_billing_uuid_guardian.sql` | `20260601112352_den_381_billing_checkout_uuid_guardian_repair.sql` |
| `20260616062920_remote_history_alias_demo_session_reset.sql` | `20260616054000_demo_session_reset_rpc.sql` |
| `20260625082856_remote_history_alias_chart_consultation_flow.sql` | `20260625103000_chart_consultation_flow_rpc.sql` |
| `20260625082918_remote_history_alias_chart_consultation_room.sql` | `20260625113000_chart_consultation_room_selection.sql` |
| `20260702084035_remote_history_alias_permission_role_foundation.sql` | `20260702090000_workspace_permission_role_model_foundation.sql` |
| `20260702084325_remote_history_alias_invitation_role_job_dual_write.sql` | `20260702110000_workspace_invitation_role_job_dual_write.sql` |
| `20260702084357_remote_history_alias_invitation_role_job_lookup.sql` | `20260702130000_workspace_invitation_role_job_key_lookup.sql` |
| `20260702084417_remote_history_alias_membership_role_job_update.sql` | `20260702133000_workspace_membership_role_job_key_update.sql` |
| `20260705141026_remote_history_alias_home_operations_reader.sql` | `20260705120000_home_operations_work_items_reader.sql` |
| `20260714110720_remote_history_alias_hospital_schedule_operations.sql` | `20260711112810_hospital_schedule_operations.sql` |
| `20260714110730_remote_history_alias_reception_staff_operational_status_snapshot.sql` | `20260714194500_reception_staff_operational_status_snapshot.sql` |
| `20260714110738_remote_history_alias_cheongdam_reception_staff_schedule_backfill.sql` | `20260714202000_cheongdam_reception_staff_schedule_backfill.sql` |
| `20260714162034_remote_history_alias_workspace_operating_hours.sql` | `20260715100000_workspace_operating_hours.sql` |

The following remote-only SQL is preserved verbatim so a fresh local reset includes the actual remote behavior:

- `20260601111822_billing_guardian_checkout_hardening.sql`
- `20260615025340_den_505_rpc_role_audit_hardening.sql`
- `20260616090822_den_512_reception_walkin_event_time_writer.sql`
- `20260702152054_20260702142317_cheongdam_realistic_roster_remote_backfill.sql`

## Genuinely Pending Remote Migrations

The following 16 local migrations are not timestamp aliases and were not marked as applied. They require their own release scope and verification before remote application:

`20260601093000`, `20260609112000`, `20260616090000`, `20260616100000`, `20260616101000`, `20260616102000`, `20260617113000`, `20260618120000`, `20260618121000`, `20260625090000`, `20260627183000`, `20260701080619`, `20260702142317`, `20260705133000`, `20260708104700`, `20260711150000`.

The three reception schedule canonical versions listed in the alias table are no
longer pending behavior: their exact SQL was applied to the linked synthetic/demo
project on 2026-07-14 under the corresponding remote versions. Do not reapply them
merely to align timestamps. Any future history repair still requires the separate
review and approval described below.

The workspace operating-hours canonical migration is also no longer pending
behavior. Its exact SQL was applied and verified on 2026-07-15 under remote version
`20260714162034`; the alias preserves that remote history version locally. The
canonical version remains local-only metadata and must not be reapplied.

Do not use `migration repair --status applied` for these entries merely to make `db push` look clean. Supabase repair changes only the history table; it does not execute the migration SQL.

## Verification

```bash
npx supabase db reset --local --yes
npx playwright test tests/supabase-migration-history-reconciliation.spec.ts
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Expected remote interpretation:

- remote-only versions: `0`
- local-only versions: the 16 explicitly pending versions above, plus the canonical
  versions represented by reviewed remote aliases
- plain dry-run requests `--include-all` for those pending versions instead of reporting missing remote history files

Before any future repair, export `supabase_migrations.schema_migrations` and compare SQL content. Timestamp similarity or filename similarity alone is not enough evidence.
