---
id: "RECEPTION-LIVE-PR-017"
type: "Work Item"
title: "Reception encounter vital detail read"
description: "Show only the patient vital values stored for the selected reception encounter."
status: "implemented"
area: "reception"
priority: "P0"
tags:
  - "reception"
  - "vitals"
  - "supabase"
  - "detail-panel"
target_pr: "Browser comment / reception encounter vital detail"
source_docs:
  - "docs/engineering/data-model/patient-vital-measurements.md"
dependencies:
  - "RECEPTION-QA-PR-011"
  - "HOSPITAL-ADMIN-LIVE-PR-018"
updated: "2026-09-30"
---

# Reception Encounter Vital Detail Read

## Goal

Make the reception detail panel show only values stored on the selected
encounter's `patient_vital_measurements` row instead of rendering only the
patient weight compatibility snapshot.

## Scope

- Add an exact selected-encounter vital read RPC guarded by active membership
  and `reception:view`.
- Add the server route and client resource states for loading, denial, failure,
  no measurement, and success.
- Respect workspace vital visibility and display-unit settings.
- Render only non-null stored values.
- Verify the reported Cheongdam encounter and the patient's date-based history
  in the linked synthetic/demo Supabase project.

## Out Of Scope

- Changing the existing atomic walk-in write transaction.
- Editing or deleting historical measurements.
- Changing chart waiting-vital write eligibility or central audit policy.
- Backfilling, rewriting, or deleting existing measurement rows.

## Done When

- The selected encounter cannot fall through to a different visit's latest
  patient measurement.
- Weight, temperature, heart rate, respiratory rate, and blood pressure appear
  only when their stored value is present and enabled for the workspace.
- Missing values do not render placeholder fields.
- Direct table access remains closed and the new function is authenticated-only.
- Focused server and browser regression coverage passes.

## Verification

- Focused exact-read server tests: 4 passed.
- Focused reception browser test: 1 passed.
- Existing patient vital/migration baseline: 14 passed.
- TypeScript and changed-file ESLint: passed.
- Remote migrations `20260724021247_reception_encounter_vital_read` and
  `20260724023220_reception_encounter_vital_patient_link_hardening`: applied.
- Remote catalog: `SECURITY DEFINER`, stable, fixed `search_path`, anonymous
  execute denied, authenticated execute granted.
- Reported synthetic encounter: one linked 2026-07-24 measurement row with
  weight, temperature, and heart rate; absent respiratory rate and blood
  pressure remain unrendered.
- Patient history: date-grouped rows remain present across multiple visit dates;
  no remote data mutation or backfill was performed.

## Result

Implemented and ready for release verification.

## 2026-09-30 Display Settings Permission Follow-Up

User approved the diagnosed reception-detail fix. The selected encounter's
measurement read succeeded while the administration settings read returned 403.
The detail required both reads and hid persisted measurements on settings denial.

- Compose the existing display-settings RPC into the reception encounter vital
  API after `reception:view` and the exact workspace/encounter read succeed.
- Return `vitalSettings` with `canManage: false`; no new role grants, SQL migration,
  measurement changes, or administrator GET/PUT permission changes.
- Use the composed response in detail; distinguish permission denial, display
  settings failure, measurement failure, and no recorded values.
- Keep existing unrelated primary-checkout WIP intact.

Release-worktree verification: 14 focused server checks, 5 mocked browser scenarios
(administration settings denied, settings failure/retry, malformed settings/retry,
permission denial, and no measurement), secrets/docs/UX-copy checks, full ESLint,
TypeScript, and production build passed. Full ESLint has five pre-existing
script warnings and zero errors.
The browser scenarios verify the selected-encounter display and absent-value
omission; they do not establish production delivery or authenticated remote smoke.
Read-only specialist review found no blocking permission/workspace issue.

승욱 explicitly authorized commit, push, PR, `origin/main` merge, and production
deployment for this fix on 2026-09-30. Direct `main` delivery follows that request;
the remote has no `staging` branch. Release preflight and the exact manually
triggered Release Check must pass before merge. The associated GitHub PR records
the exact candidate/merge SHA, Ready deployment, authenticated reception smoke,
and rollback evidence. No remote DB writes are part of this follow-up.

Rollback baseline: production deployment `dpl_4MQkvzrkEQGv5CzaEWbvR9FKPK6G`
(`origin/main` preparation baseline `a3a4e142d97a0fedde4f8d4ec42d66d4aeec7339`).
Refresh the previous deployment at merge time if another approved release lands.
Stop before merge if preflight, exact-candidate Release Check, or Preview fails;
stop and diagnose if production shell or scoped vital readback fails.
