---
id: "OWNER-OS-PR-006"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-425"
source_docs:
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "scripts/owner-os.mjs"
dependencies:
  - "OWNER-OS-PR-003"
  - "OWNER-OS-PR-005"
updated: "2026-06-05"
---

# OWNER-OS-PR-006: Local CLI

## Goal

Build the local `owner-os` CLI prototype for DEN-425.

## Scope

- Add `scripts/owner-os.mjs`.
- Add `npm run owner-os`.
- Implement `intake`, `packet`, `review`, `trace`, `eval`, and `dashboard` commands.
- Keep the CLI local repo only.

## Out Of Scope

- OpenAI API calls.
- Remote Linear mutation automation.
- Remote Supabase, production, provider, payment, or email operations.

## Done When

- CLI commands produce local draft outputs.
- `npm run owner-os -- intake --request "..."` works.
- `npm run owner-os -- packet --request "..."` works.
- `npm run owner-os -- review` works.

## Verification

- `npm run owner-os -- intake --request "Owner OS status"`
- `npm run owner-os -- packet --request "Create packet" --title "Create packet"`
- `npm run owner-os -- review`

## Completion Notes

- Added `scripts/owner-os.mjs`.
- Added `npm run owner-os`.
- Implemented local `intake`, `packet`, `review`, `trace`, `eval`, and `dashboard` commands.
- Generated `output/owner-os/packet.md` and `output/owner-os/review.md`.
- Verified intake, packet, and review commands locally.
