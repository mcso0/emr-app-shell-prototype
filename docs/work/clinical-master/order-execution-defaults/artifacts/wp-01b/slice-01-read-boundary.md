# WP-01B Slice 01 — Catalog read boundary

Date: 2026-09-06. Status: local slice complete; WP-01B in progress.
Baseline HEAD: `f564a493b52be6f5592bda6484dd0bcf9a8a2c4b`.
No commit, remote DB mutation, migration application, publish/adopt or deployment.
Existing unrelated WIP was preserved. This supersedes only the old
"implementation not started" checkpoint, not earlier audit evidence.

## Implemented

- Typed Admin/chart RPC failures: auth 401, permission 403, revision 409,
  malformed response 500, unavailable read/missing construction 503.
- Removed Admin direct-table deploy-order fallback and both error-to-empty paths.
  Genuine successful empty arrays still return success. Any unmappable member
  rejects the whole response; Admin validates workspace and basic identity types.
- Individual chart rows require a catalog ID. Conflicting row/snapshot IDs and
  preset ID/version mismatches fail rather than creating ambiguous candidates.
- Removed implicit mock gateway/permission defaults from all six catalog core
  request handlers. Explicit isolated test fixture injection remains available.
- Product order-catalog GET/POST/PATCH reject demo-header mock identity.
  GET maps thrown read/setup errors to a sanitized 503 response.
- A failed catalog before-image read blocks mutation. Chart draft consultation
  preparation uses the permission-checked catalog wrapper and returns failures
  before save. This closes the SQL predicate-denial-as-empty path for that caller.

## Evidence

| Check | Result | Boundary |
| --- | --- | --- |
| `npx playwright test --config playwright.catalog-contract.config.ts` | 58 passed | 38 failure/identity/authorization regression cases plus 20 existing catalog contracts; injected clients, no DB |
| Targeted ESLint on 3 source files, 2 test files and config | Passed, no warnings | Not repository-wide lint |
| Local HTTP API checks, `NEXT_PUBLIC_AUTH_MODE=mock`, loopback port 3107 | 8/8 returned 401 | Admin GET, chart-search GET, POST, PATCH; each without and with synthetic demo header; no write reached |
| Independent read-only source review | Two findings repaired, no remaining must-fix found on re-review | ID consistency and catalog permission checks; not remote RLS verification |
| `npx tsc --noEmit --incremental false` | Failed | Missing installed `@blocknote/*` dependencies and related errors outside changed files; no diagnostics in touched source/tests/config |
| `npm run docs:check` | Failed on one pre-existing unrelated link | `_workspace/2026-08-01-002/summary.md` references the missing persona QA skill guide HTML; this records the historical failure, not a live document link |
| `git diff --check` | Passed | Whitespace/error-marker check |
| Report rendering | Desktop 1365px and mobile 390px inspected | Report only, not EMR UI acceptance; next-step anchor present, no broken in-page anchors |

Route failure status wiring is covered by static source assertions; the local
HTTP check covers auth rejection, not simulated DB failures through a live server.
No authenticated persisted-workspace browser acceptance was performed.
Korean report wording used humanize-korean fast run `2026-09-06-004`; its
installed preparation script was missing, so manual meaning/style checks were
used instead of automatic metrics. Render evidence is in
`output/playwright/wp01b-slice01-{desktop,mobile}.png` (local QA artifacts).

## Known limits / do not overclaim

- UI seed rows, literal dispensing defaults, schema defaults, stale workspace
  drafts, compact table summaries and label-based classification remain. The
  original Admin/chart symptom is **not yet fixed end to end**.
- The lab-test delete-lock route has no explicit persisted gateway. It now fails
  closed with `503 catalog_gateway_required`; it must not manufacture a lock.
- Other fixture-driven demo paths are not proof of persisted catalog behavior.
  Do not restore implicit gateways to make old demo-only tests pass.
- Snapshot source identifiers are checked, but full Admin/chart row reconciliation
  and workspace-switch UI acceptance remain later slice gates.
- No clinical research, numeric reference interval, CBC membership, price,
  prototype provenance or clinical-validation state was changed in this slice.

## Resume at Slice 02 — not OED-LAB-04 yet

1. Add a shared same-row parser: nonempty generic persisted details, otherwise
   bounded legacy nested persisted details, otherwise missing. Expose its source.
   Preserve zero/false/arrays and do not fill individual gaps from another source.
2. Remove dispensing read-time dose/unit/route/frequency/duration/quantity and
   instruction constants. Model missing values explicitly through edits/saves.
3. Remove `schema.defaultValue` substitution in chart display, correction edit
   and confirmation validation. Required missing inputs must block confirmation.
4. Add tests that remove one persisted field and assert Admin/new chart draft
   both remain missing. Keep legitimate encounter-derived runtime fields explicit.
5. Then Slice 03 classification/core summaries, Slice 04 candidate/draft parity,
   Slice 05 browser negatives and workspace isolation. Do not merge/deploy or
   claim WP-01B complete before all gates are met.

Historical OED-LAB-03 source hashes describe its audit checkpoint; they may drift
after this intentional implementation. Do not regenerate historical audit proof
to hide source changes.

## Files

- `src/features/hospital-admin/server-order-catalog-core.ts`
- `src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts`
- `src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts`
- `tests/hospital-admin-order-catalog-server.spec.ts`
- `tests/hospital-admin-order-catalog-read-failures.spec.ts`
- `playwright.catalog-contract.config.ts`

[Korean HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-slice-01-read-boundary-report.html)
