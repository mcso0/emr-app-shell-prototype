# Agent-first Docs Restructure Closeout

Date: 2026-05-03

## Goal

Make `docs/` usable as an agent-first workspace for two-person collaboration, new chats, and sub-agents.

## Result

- Added `docs/agent-start-here.md` as the routing document for new work.
- Added team lens folders for business, product, design, and engineering.
- Added repo-native work tracking under `docs/work/`.
- Moved product, data model, design, engineering, and historical docs into canonical locations.
- Left moved stubs at important old paths.
- Added deterministic internal docs checking with `npm run docs:check`.
- Added non-blocking external link checking workflow with lychee.

## Verification

- `npm run docs:check`
- `npm run lint`

## Follow-up

- Split `docs/product/features/legacy-mvp-feature-spec.md` into feature-level specs when product planning resumes.
- Shape the next Product MVP implementation unit as a PR-sized work item before coding.
