---
id: "HOSPITAL-ADMIN-LIVE-PR-023"
status: "implemented"
area: "hospital-admin"
priority: "P0"
target_pr: "User request / workspace switcher hospital-logo linkage"
completion_report: "docs/completed/hospital-admin/2026-07-24-workspace-logo-shell-linkage-report.html"
source_docs:
  - "docs/product/domain/workspace-hospital-profile.md"
  - "docs/engineering/data-model/workspace-hospital-settings.md"
  - "docs/engineering/current-status.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-021"
  - "HOSPITAL-ADMIN-LIVE-PR-022"
updated: "2026-07-24"
---

# Workspace Logo Shell Linkage

## Goal

Render the current workspace hospital logo in the app-shell workspace switcher
from the same private profile pointer used by hospital basic settings.

## Scope

- Extend the authenticated workspace-list read model with a safe signed logo URL
  and profile revision.
- Read current logo pointers in one RLS-scoped profile query and sign only
  non-empty pointers.
- Keep workspace listing usable when the optional logo read or signing step
  fails.
- Render the signed logo in the existing 18px workspace-switcher mark while
  preserving the current mark as fallback.
- Use that same default mark in the hospital-logo editor when no custom logo is
  stored.
- Refresh the shell identity after a successful hospital-logo upload or removal.
- Add focused server-contract and browser regression coverage.

## Out Of Scope

- New logo tables, public buckets, duplicated `workspaces.logo_url` fields, or
  changes to existing Storage/RLS/RPC mutation contracts.
- Uploading or replacing a remote workspace logo asset.
- Changing workspace selection behavior, shell geometry, or hospital-logo
  validation and normalization rules.
- Real hospital data.

## Done When

- A workspace with a stored logo renders that logo in both hospital settings and
  the workspace switcher.
- A workspace without a logo, or with a failed optional logo read, keeps the
  existing switcher fallback without blocking workspace entry.
- Upload and removal success refresh the current switcher without a page reload.
- Storage paths, upload tokens, and secrets are absent from the workspace-list
  response.
- Focused browser/server tests, lint, typecheck, docs, secret scan, build, and
  diff checks pass.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3127 npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts tests/hospital-settings.spec.ts --project=chromium --grep "workspace switcher|workspace list|hospital logo" --reporter=line` — 10 passed.
- `npm run lint` — passed.
- `npx tsc --noEmit` — passed.
- `npm run docs:check` — passed.
- `npm run security:secrets` — passed.
- `npm run ux-copy:check` — passed.
- `npm run build` — passed.
- `git diff --check` — passed before closeout; rerun on the release candidate.

## Implementation Result

- `/api/workspaces` now returns only the current signed logo URL and revision,
  never the private Storage object path.
- The shell switcher, hospital settings preview, and logo editor now share the
  same custom-image-or-default-mark identity rule.
- Successful upload or removal emits a workspace-identity event so the shell
  refreshes without a page reload.
- No schema, migration, bucket policy, or remote logo object was changed.
