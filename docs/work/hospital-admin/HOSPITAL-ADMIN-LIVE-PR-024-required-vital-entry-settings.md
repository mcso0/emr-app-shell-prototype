---
id: "HOSPITAL-ADMIN-LIVE-PR-024"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "Workspace vital input requirement and five-preset defaults"
source_docs:
  - "docs/product/features/hospital-admin/workspace-vital-settings.md"
  - "docs/engineering/data-model/patient-vital-measurements.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-018"
  - "HOSPITAL-ADMIN-LIVE-PR-019"
updated: "2026-09-27"
---

# Required Vital Entry Settings

## Authorization And Goal

On 2026-09-27, 승욱 reviewed the interactive vital-settings report, decided the outstanding blood-pressure, history-edit, and re-add behaviors, then explicitly requested investigation and implementation. This authorizes scoped local app, server, test, documentation, and migration changes. It does not authorize a remote migration or release.

In a follow-up, 승욱 requested commit, push, PR, and `origin/main` merge. The Git candidate and Preview may be prepared under that request. `main` is Production; its exact-candidate approval gate and the separate remote Supabase migration gate still apply before merge.

Make workspace vital settings control measurement requirements in reception and chart entry. A new workspace starts with five enabled presets and no required measurements.

## Scope

- Remove the permanent weight/temperature configuration lock. All five presets can be enabled, required, removed, and re-added.
- Add persisted `input_required` to workspace vital settings, with server/RPC validation and audit through the existing replacement boundary.
- Use one blood-pressure setting row; when required, both systolic and diastolic values are required.
- When disabling a required row, confirm and clear both states. When requiring a disabled row, confirm and enable both states. Deletion requires confirmation; re-add uses enabled, optional, canonical unit, and bottom order.
- Show requirement markers and field errors in reception and chart editors. Apply current workspace rules to new writes and edits of old records; keep historical reads unchanged.
- Enforce the same policy in the local server and database write boundaries with workspace isolation.
- Update owning product/data contracts and focused regression coverage.

## Out Of Scope

- Remote Supabase migration and real customer data. Production merge and deployment require the exact release gate recorded by the release runbook.
- Unit-setting menu, custom vital types, and retrospective history rewrites.

## Done When

- Required and enabled cannot be stored in conflict; disabled/deleted presets do not require entry.
- New workspace defaults are weight, temperature, heart rate, respiratory rate, and blood pressure, all enabled and optional. Existing workspace configuration is preserved.
- All five rows support the approved menu, badge, switch, delete, re-add, and confirmation interactions.
- Reception and chart show the same current requirement, including both blood-pressure components, and reject empty required values before save.
- Server and database boundaries reject direct writes omitting required values; historical reads remain available and edited records follow current settings.
- Focused model, server, SQL, reception, chart, type, lint, build, docs, secret, and diff checks are recorded.

## Verification

- Focused `tests/workspace-vital-settings-*.spec.ts`, `tests/patient-vital-server.spec.ts`, and reception/chart vital specs.
- Local migration replay and boundary checks when a local Supabase runtime is available.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run docs:check`, `npm run security:secrets`, `git diff --check`.

## Result

Local implementation is ready for human review in the isolated
`codex/vital-required-settings` worktree. The settings UI supports all five
independent enabled/required states and the approved confirmation flows. New
workspace reads provide five enabled, optional presets. Reception and chart
entry share the current requirement, including both blood-pressure values;
server validation and the forward SQL migration enforce the same rule without
rewriting historical measurements.

Verification on 2026-09-27:

- Focused model, settings server, patient vital server, reception server,
  settings browser, reception browser, and chart browser tests passed. The
  browser coverage includes disable/re-enable, delete/re-add, a blocked empty
  required reception value, and a historical chart edit requiring both blood
  pressure values.
- The new migration executed in a local PostgreSQL transaction and rolled
  back. Checks confirmed five optional catalog defaults, preservation of
  existing workspace settings and legacy four-item fallbacks, required-value
  rejection, and authenticated empty-list save/readback.
- A final rollback-only replay checked the old app's settings payload, which
  omits `inputRequired`: saves remain accepted, existing required flags stay
  set, and an old payload cannot silently delete a required row. This keeps
  the database-first release window compatible with the current app.
- `npm run lint` passed with five pre-existing script warnings and no errors.
  `npm run build -- --webpack`, standalone `tsc --noEmit`, `npm run docs:check`,
  `npm run security:secrets`, and `git diff --check` passed. Webpack was used
  for the isolated worktree because Turbopack rejects the external
  `node_modules` symlink used for local verification.

Remote migration, release, and user acceptance have not occurred. The schema
change must be applied to the scoped remote database before a Production app
release that depends on `input_required`; the remote target and execution need
separate authorization and verification.
