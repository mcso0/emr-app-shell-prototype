---
type: Operating Rule
title: Supabase Migration History Reconciliation
description: Defines the verified timestamp aliases, preserved remote-only SQL, and genuinely pending remote migrations.
tags:
  - supabase
  - migrations
  - release
last_updated: 2026-08-23
---

# Supabase Migration History Reconciliation

## Current Contract

The linked synthetic/demo Supabase project is `qmerxgzrwaaahpkhjqlc`. The
verified read-only snapshot immediately before this local reconciliation was:

| local files | remote versions | exact common | remote-only | local-only |
| ---: | ---: | ---: | ---: | ---: |
| 158 | 130 | 118 | 12 | 40 |

The 12 remote-only versions are represented below by comment-only aliases. The
14 versions listed as genuinely pending remain pending; no alias marks them as
applied, and no pending migration SQL was applied as part of this work.
After the local alias files are present, the expected local/remote shape is
170/130/130/0/40. The 40 local-only canonical files then comprise 26
behavior-applied canonical versions represented by reviewed aliases and 14
genuinely pending versions.

The final verified repository/remote snapshot after the history-only repair on
2026-08-23 is:

| local files | remote history rows | exact common | remote-only | local-only |
| ---: | ---: | ---: | ---: | ---: |
| 170 | 156 | 156 | 0 | 14 |

The repair targeted project `qmerxgzrwaaahpkhjqlc` and marked exactly the 26
behavior-applied canonical versions listed below as `applied` in remote
migration history. `migration repair` only updates the history table; it does
not execute migration SQL or mutate schema/data. The remaining 14 local-only
versions are a hard release gate.

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
| `20260714154910_remote_history_alias_workspace_member_activity_presence.sql` | `20260714213000_workspace_member_activity_presence.sql` |
| `20260714162034_remote_history_alias_workspace_operating_hours.sql` | `20260715100000_workspace_operating_hours.sql` |
| `20260715062205_remote_history_alias_staff_presence_broadcast_read_hotfix.sql` | `20260715014500_staff_presence_broadcast_read_hotfix.sql` |
| `20260715164007_remote_history_alias_workspace_member_status_messages.sql` | `20260716010000_workspace_member_status_messages.sql` |
| `20260715164307_remote_history_alias_workspace_status_message_rls_initplan.sql` | `20260716011000_workspace_status_message_rls_initplan.sql` |
| `20260715172425_remote_history_alias_private_profile_avatars.sql` | `20260716020000_private_profile_avatars.sql` |
| `20260715180209_remote_history_alias_staff_assigned_work_items_authenticated_select.sql` | `20260716030000_staff_assigned_work_items_authenticated_select.sql` |
| `20260722112553_remote_history_alias_workspace_vital_settings.sql` | `20260722143000_workspace_vital_settings.sql` |
| `20260722130209_remote_history_alias_required_workspace_vitals.sql` | `20260722190000_required_workspace_vitals.sql` |
| `20260815102642_remote_history_alias_chart_active_encounter_vitals.sql` | `20260815100223_chart_active_encounter_vitals.sql` |
| `20260815103052_remote_history_alias_chart_vital_permission_policy_compatibility.sql` | `20260815102956_chart_vital_permission_policy_compatibility.sql` |
| `20260719052222_remote_history_alias_notification_event_persistence.sql` | `20260705133000_notification_event_persistence.sql` |
| `20260719052236_remote_history_alias_performance_batch_rpc_followup.sql` | `20260719051725_performance_batch_rpc_followup.sql` |
| `20260719052453_remote_history_alias_notification_private_function_search_path.sql` | `20260719052433_notification_private_function_search_path.sql` |
| `20260719120330_remote_history_alias_chart_preconsultation_vital_comparison.sql` | `20260719000000_chart_preconsultation_vital_comparison.sql` |
| `20260723140134_remote_history_alias_workspace_space_management.sql` | `20260723220927_workspace_space_management.sql` |
| `20260723202954_remote_history_alias_workspace_hospital_profiles.sql` | `20260723110000_workspace_hospital_profiles.sql` |
| `20260723203002_remote_history_alias_private_hospital_logos.sql` | `20260723120000_private_hospital_logos.sql` |
| `20260723203008_remote_history_alias_hospital_settings_audit_event_types.sql` | `20260723223000_hospital_settings_audit_event_types.sql` |
| `20260808114420_remote_history_alias_customer_profile_live_read_projection.sql` | `20260808055307_customer_profile_live_read_projection.sql` |
| `20260816062243_remote_history_alias_chart_diagnosis_closure.sql` | `20260815120000_chart_diagnosis_closure.sql` |
| `20260821071846_remote_history_alias_clinical_master_phase1_permission_source_assignment_precedence.sql` | `20260821063113_clinical_master_phase1_permission_source_assignment_precedence.sql` |
| `20260823063449_remote_history_alias_clinical_master_diagnosis_foundation.sql` | `20260823035126_clinical_master_diagnosis_foundation.sql` |

The canonical-content proof hashes for the 12 new aliases are SHA-256 values
of the canonical local files. The alias files themselves remain comment-only.

| Canonical local migration | SHA-256 |
| --- | --- |
| `20260705133000_notification_event_persistence.sql` | `a07f383291b78abb5ccfa4035defec2541092fb3ba02a595fa4a5a0e70bacfc5` |
| `20260719051725_performance_batch_rpc_followup.sql` | `77fcf1e38c22241e59f10fbabe199dc8b72fddfa79926e3f88cc17cf93b1c869` |
| `20260719052433_notification_private_function_search_path.sql` | `99743ad3e4bf7f26db1cd6ee39f6cdbbb445456b9bd6d012bb31a4cfa7828ffb` |
| `20260719000000_chart_preconsultation_vital_comparison.sql` | `1057b3a181bee5b6c14aa74ffc546033673702585e94f7cb02a58965093f6c6c` |
| `20260723220927_workspace_space_management.sql` | `8d73eb3bbf79ecb10bfbfeacf43aaa022fd3b1345204975a916f468c5b2f30aa` |
| `20260723110000_workspace_hospital_profiles.sql` | `00692771145ff130546fc637c2de05f2f6a2f3b7cb4bf4b1ecc04894779e79f0` |
| `20260723120000_private_hospital_logos.sql` | `0127a16271d09adcd4c87a5e7528780f2640c31d475f0c67ed51cd6d47dcedbf` |
| `20260723223000_hospital_settings_audit_event_types.sql` | `e6fd19d052100875bd1d72ae7316ead714c1061ec72173b580662d3198895d0f` |
| `20260808055307_customer_profile_live_read_projection.sql` | `f9b0e061bc69d660aff20af739b6da7e206511458564e76fb6c148e326b2c39e` |
| `20260815120000_chart_diagnosis_closure.sql` | `a0a563d84506aea992f145d8088c4714d3045f6771826c0c4557231697f067a4` |
| `20260821063113_clinical_master_phase1_permission_source_assignment_precedence.sql` | `188328cde08de3b576214bb49e8847c4bf9ca1f68ab43ccb15a335c74e878484` |
| `20260823035126_clinical_master_diagnosis_foundation.sql` | `14aad7316e76bcfec084ffae701bb48652105ff66f7c9315578ee077deac1612` |

For the chart preconsultation alias (`20260719120330` -> `20260719000000`),
the raw canonical local file hash is
`1057b3a181bee5b6c14aa74ffc546033673702585e94f7cb02a58965093f6c6c`.
The remote/local comparison after terminal-LF normalization is
`6da8f83abfea862cf0707907e610b2d84bdef59a3a799033575e641c09b0a816`;
this is a normalized proof and must not be read as a raw byte-identity claim.

The following four remote-only SQL files are preserved verbatim so a fresh
local reset includes the actual remote behavior. These proof hashes are the
current local file bytes and are asserted by the focused test.

| Remote-only SQL file | Bytes | SHA-256 |
| --- | ---: | --- |
| `20260601111822_billing_guardian_checkout_hardening.sql` | 26442 | `9e7d2348e736ccf3f0827aeaf83c7a9fe65c0ae8c44384e196f7eceeca43b937` |
| `20260615025340_den_505_rpc_role_audit_hardening.sql` | 16588 | `049e5f75e35ba5049fdbdc36db165bedf96874d86266ef8e7b9b2c99d17bea10` |
| `20260616090822_den_512_reception_walkin_event_time_writer.sql` | 5387 | `fbe3f89c9bf802cce701d92b1e5ec5721f41a076e195a7b541013a9b5688ed97` |
| `20260702152054_20260702142317_cheongdam_realistic_roster_remote_backfill.sql` | 21120 | `e748ee7d420e263490da2e48962bb6f4940cefdd0c8b3fef1da57d0549a9f463` |

## Genuinely Pending Remote Migrations

At the verified snapshot, 26 local-only canonical versions were already
behavior-applied remotely through reviewed timestamp aliases. The following 14
local migrations are the genuinely pending set and were not marked as applied;
they require their own release scope and verification before remote application:

`20260601093000`, `20260616090000`, `20260616100000`, `20260616101000`, `20260616102000`, `20260617113000`, `20260618120000`, `20260618121000`, `20260625090000`, `20260627183000`, `20260701080619`, `20260702142317`, `20260708104700`, `20260711150000`.

The three reception schedule canonical versions listed in the alias table are no
longer pending behavior: their exact SQL was applied to the linked synthetic/demo
project on 2026-07-14 under the corresponding remote versions. Do not reapply them
merely to align timestamps. Any future history repair still requires the separate
review and approval described below.

The workspace operating-hours canonical migration is also no longer pending
behavior. Its exact SQL was applied and verified on 2026-07-15 under remote version
`20260714162034`; the alias preserves that remote history version locally. The
canonical version remains local-only metadata and must not be reapplied.

The Presence activity and receive-only hotfix canonical migrations are likewise
no longer pending behavior. Their SQL was applied and verified on 2026-07-15
under remote versions `20260714154910` and `20260715062205`; the aliases preserve
those remote history versions without replaying either schema change.

The workspace member status-message behavior is represented by a
behavior-equivalent remote chain rather than an exact single-file timestamp
match: remote version `20260715164007` carries the deployed status-message
behavior and remote version `20260715164307` carries the exact init-plan policy
optimization. Canonical `20260716010000` plus `20260716011000` remains the
deterministic fresh-replay chain; the two remote aliases preserve history
without claiming that `20260716010000` alone is byte-identical to one remote
version.

The private profile-avatar schema and Storage policies are also no longer
pending behavior. Their exact SQL was applied and verified on 2026-07-16 under
remote version `20260715172425`; the alias preserves that history version while
the canonical migration remains the deterministic fresh-replay source.

The workspace vital-settings foundation and required-vitals follow-up are also
no longer pending behavior. Their exact SQL was applied and verified on
2026-07-22 under remote versions `20260722112553` and `20260722130209`;
comment-only aliases preserve those history versions while canonical migrations
remain the deterministic fresh-replay source.

The CHART-PR-023 active encounter-vital writer was applied and verified on
2026-08-15 under remote version `20260815102642`; its exact SQL is kept in
canonical version `20260815100223`, and the comment-only alias preserves remote
history without duplicating the function definition during fresh replay.
The accompanying permission-policy compatibility fix was applied as remote
version `20260815103052`; canonical version `20260815102956` keeps the legacy DB
permission resolver aligned with the workspace permission-role model for
hospital administrators, veterinarians, and technicians only.

The authenticated assigned-work-item `SELECT` grant is represented by the
existing alias `20260715180209` for canonical
`20260716030000_staff_assigned_work_items_authenticated_select.sql`.

## Final Remote Verification (2026-08-23)

The exact-project history-only repair for `qmerxgzrwaaahpkhjqlc` marked these
26 canonical versions as applied, and no other version:

`20260705133000`, `20260711112810`, `20260714194500`, `20260714202000`,
`20260714213000`, `20260715014500`, `20260715100000`, `20260716010000`,
`20260716011000`, `20260716020000`, `20260716030000`, `20260719000000`,
`20260719051725`, `20260719052433`, `20260722143000`, `20260722190000`,
`20260723110000`, `20260723120000`, `20260723220927`, `20260723223000`,
`20260808055307`, `20260815100223`, `20260815102956`, `20260815120000`,
`20260821063113`, `20260823035126`.

The repair command returned `status: applied` with `repairAll: false`. It only
inserted the requested migration-history rows; it did not execute migration
SQL or mutate schema/data. The immediate remote list verified 156 history rows,
156 exact common versions, zero remote-only versions, and exactly the 14
pending local-only versions above.

The read-only post-repair fingerprint query returned:

| Read-only check | Result |
| --- | --- |
| `supabase_migrations.schema_migrations` count | `156` |
| schema catalog pieces / fingerprint | `4598` / `5b6046943b4317bf828110285007a24f82e8aaf74ae1e2bfa0b20695952170b4` |
| `master.master_records` rows / fingerprint | `29` / `8d51fb069dc582fc2bbaf7a96565c10f5a6d3e177711fab90e842c0bf5859901` |
| `public.diagnoses` rows / fingerprint | `14` / `ac9e4ad6fb7f5d7ce05a03e3dc01888937e47f083644a5da96b7684cb7fb31a3` |
| `public.diagnosis_catalog` rows / fingerprint | `0` / `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `master.diagnoses` rows / fingerprint | `0` / `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `master.diagnosis_categories` rows / fingerprint | `0` / `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `master.diagnosis_category_links` rows / fingerprint | `0` / `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The linked dry-run safety gate exited `1` with
`LegacyDbPushMissingRemoteError` and listed exactly the 14 pending versions;
that refusal is the expected hard stop. Do not use `--include-all`, apply the
14 pending versions, or re-execute canonical SQL to bypass it.

Future history repair must remain exact-project and history-only; do not use
`migration repair --status applied` merely to make `db push` look clean.

## Verification

```bash
npx supabase@2.115.0 db reset --local --yes --no-seed
npx playwright test tests/supabase-migration-history-reconciliation.spec.ts --project=chromium --reporter=line
npm run docs:check
git diff --check
npx supabase@2.115.0 migration list --project-ref qmerxgzrwaaahpkhjqlc
npx supabase@2.115.0 db push --project-ref qmerxgzrwaaahpkhjqlc --dry-run --skip-vault
```

Expected remote interpretation:

- final repository/remote shape: `170/156/156/0/14`
- remote-only versions: `0`
- local-only versions: the 14 explicitly pending versions above
- the linked dry-run refusal with `LegacyDbPushMissingRemoteError` is expected
  and must not be bypassed with `--include-all`

Before any future repair, export `supabase_migrations.schema_migrations` and compare SQL content. Timestamp similarity or filename similarity alone is not enough evidence.
