# API Boundary Selectors

Updated: 2026-05-02

## Purpose

This document defines a small read-side boundary between the current connected mock domain and a future API/DB implementation. The goal is to let feature modules eventually consume stable read models without coupling screen code to the current mock arrays.

This is a boundary draft only. It does not add API routes, DB clients, migrations, auth, audit wiring, or service catalog integration.

## Added Code

| File | Role |
|---|---|
| `src/lib/emr-domain/read-repository.ts` | Repository interface and read model type draft |
| `src/lib/emr-domain/read-selectors.ts` | Pure selectors that join a snapshot into patient, encounter, guardian, and billing read models |
| `src/lib/emr-domain/mock-read-repository.ts` | Thin mock adapter that exposes the current mock arrays through the repository boundary |
| `tests/api-boundary.spec.ts` | Contract tests for the selector/helper behavior |

## Boundary Shape

The boundary has three layers.

1. Snapshot

`EmrReadSnapshot` is a read-only collection of normalized domain arrays. Today it is backed by `src/mocks/emr-domain.ts`. Later it can be backed by route handlers, server actions, or DB queries that return the same normalized shape.

2. Selectors

Selectors in `read-selectors.ts` convert a snapshot into joined read models:

- `selectPatientReadModel`
- `selectEncounterReadModel`
- `selectGuardianReadModel`
- `selectBillingGroupsByGuardian`

They are pure functions and take `EmrReadScope` explicitly so workspace filtering stays visible.

3. Repository

`EmrReadRepository` is the interface feature modules can adopt later:

- `getSnapshot(scope)`
- `getPatient(scope, patientId)`
- `getEncounter(scope, encounterId)`
- `getGuardian(scope, guardianId)`
- `listBillingGroupsByGuardian(scope)`

`createSnapshotReadRepository` is the minimal helper that turns any snapshot provider into this repository interface.

## Design Rules

- Keep this read-only until the write workflows are planned separately.
- Keep workspace scope explicit in every call.
- Keep selectors pure and deterministic. Do not read globals inside selectors.
- Treat `latestWorkShortcuts` as an optional read model input. The mock adapter derives it from existing mock helpers for now.
- Do not import these helpers into feature modules until the target screen has a small integration plan and regression test.
- Do not use this boundary to force auth, audit, service catalog, or persistence concerns into the MVP prototype.

## Future API Mapping

A future API implementation can satisfy this boundary in either of two ways:

- Return normalized arrays and reuse selectors on the client/server boundary.
- Return pre-joined read models and implement `EmrReadRepository` directly.

The first option is safer during migration because it keeps one selector contract while the data source changes. The second option may be better once DB query performance and route contracts settle.
