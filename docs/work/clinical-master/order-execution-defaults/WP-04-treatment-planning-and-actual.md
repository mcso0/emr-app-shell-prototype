---
type: Work Item
title: Treatment planning V2 and actual execution
status: in_progress
updated: 2026-09-06
---

# Scope and current evidence

All111 original treatment identities are retained. New V2 planned schemas separate
procedure count/unit from medicine/material quantity and actual performed values.
Historical V1 schemas and confirmed snapshots are not rewritten. The generator
authors explicit procedures, scope, phases, one-session/load functional fixtures,
staged instructions and exceptions; no runtime name-based inference is introduced.

Eight medicine-dependent procedures require a same-encounter medication-order
link at confirmation. The chart uses an explicit order selector, and a database
guard rejects foreign, wrong-encounter, non-medication or cancelled links. A
session is never converted into a missing medication dose.

Eleven material scenarios pin reference identity/form/route/unit with primary
URLs and source limitations. Their amount of1 is explicitly an arbitrary synthetic
storage/UI fixture, not clinical guidance or a recommended treatment quantity.
Human/regional product sources are not represented as veterinary approval.
Device protocols remain explicit manual synthetic metadata with no integration.

## Local implementation and verification

- Treatment V2 schema getter, validators, publisher projection, workspace copying
  and source merge are version-aware; unsupported versions fail closed. Unmodified
  source-version transitions may migrate atomically; local execution overrides
  retain a conflict rather than silently losing fields.
- Admin and chart use each row's schema version. Optional amount requires its
  unit; direct quantity requires explicit product and route; measurement plans
  require their unit, without prefilled actual readings.
- Actual recording supports performed count/unit, numeric measurement/unit,
  typed device settings or explicitly non-adjustable equipment, observation
  records and material use. Plan-dependent required fields are enforced in the
  API and insertion guard. Amount/count/unit variance requires a reason.
- Actual completion/retry/amendment preserves the original plan and first result;
  every correction appends another immutable record. Old V1 remains readable.
-180 catalog contracts pass, including treatment planned/actual validation.
- Local PostgreSQL rollback test passes all111 publish/adopt/retry, typed Admin
  edit, snapshot and chart-search readback. A real tonometry confirm/start/result
  RPC test passes missing-measurement rejection, count variance, completion,
  idempotent retry and12→13 synthetic measurement correction with old12 retained.
- TypeScript and focused ESLint pass after the selector/result editor changes.
- Two focused actual-execution browser tests pass (dispensing and treatment V2):
  blank actual count/measurement, explicit current time, actual device identity,
  non-adjustable settings and save/readback. These use synthetic mocked APIs.

## Not yet accepted

- The narrow SQL harness manually activates fixture rows inside rollback for
  snapshot/search testing. This is **not** proof of the production synthetic
  activation workflow; existing accepted-review activation behavior still needs
  reconciliation under WP09's explicit prototype policy.
- Whole111 confirm/actual coverage,
  V1→V2 source upgrade with price override, and custom-version conflict resolution
  require additional acceptance coverage.
- No remote migration, publish, adoption, commit, PR or deployment is claimed.
- The full remaining objective continues through CBC/all86 labs, imaging/other
  categories, common execution gaps and full522 reconciliation/delivery.

## Artifacts

- [Non-applied111 definitions](./artifacts/wp-04/treatment-definitions.non-applied.v2.json)
- [Rollback-only publish/actual assertions](./artifacts/wp-04/treatment-v2-local-assert.sql)
- [Full execution ledger](./EXECUTION-remaining-packages.md)
