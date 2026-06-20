---
id: "ENGINEERING-ARCH-PR-001"
status: "human_review"
area: "engineering"
priority: "P1"
target_pr: "User request / system architecture overview"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/README.md"
  - "docs/_meta/intake-rules.md"
  - "docs/_meta/agent-rag-map.md"
  - "docs/engineering/README.md"
  - "docs/engineering/architecture/app-shell-layout-contract.md"
  - "docs/engineering/architecture/mock-live-boundary-map.md"
  - "docs/engineering/api-boundaries/api-boundary-integration-guide.md"
  - "docs/engineering/data-model/README.md"
dependencies: []
updated: "2026-06-20"
---

# System Architecture Overview

## Goal

Create a canonical first-read engineering architecture overview that helps humans, agents, and subagents understand the current repo structure, app layers, server/API boundaries, and source-of-truth architecture docs without duplicating deeper contracts.

## Scope

- Search existing docs and work items for architecture coverage before creating new docs.
- Use read-only subagent research to map existing architecture docs and current code structure.
- Add a concise `docs/engineering/architecture/system-architecture-overview.md` source doc.
- Link the new overview from the engineering README, human docs portal, and agent RAG map.
- Register the new overview in the internal `/docs` curated viewer registry.
- Keep the work limited to documentation and docs-reader navigation.

## Out Of Scope

- Next.js app behavior changes outside the docs-reader registry.
- Remote Supabase, migration push, RLS replay, production deploy, or secret use.
- Real patient, guardian, staff, hospital, billing, identity, or clinical data.
- Provider integrations, payment integrations, email/KakaoTalk side effects, or external publishing.
- Canonical role/permission policy changes.
- Replacing existing architecture, API, data-model, auth/security, or testing contracts.

## Done When

- Existing architecture docs are mapped and the gap is documented.
- A system architecture overview exists under `docs/engineering/architecture/`.
- The new overview links to the current source-of-truth docs for MVP status, mock/live boundaries, API boundaries, data model, auth/security, and testing.
- Docs navigation/routing surfaces point to the new overview.
- The internal `/docs` development area can open the new overview through the curated registry.
- Docs verification passes.

## Verification

- `npm run docs:check` passed on 2026-06-20.
- `npm run security:secrets` passed on 2026-06-20.
- `npx tsc --noEmit` passed on 2026-06-20 after regenerating Next route types with `npx next typegen`.
- `npm run lint` passed on 2026-06-20 with five pre-existing warnings outside this scope.
- `npx playwright test tests/prd-viewer.spec.ts --reporter=line --timeout=90000` passed on 2026-06-20.
- Manual surface check: local dev `/docs?area=development&doc=system-architecture-overview` returned 200 and rendered the new overview in the development navigation.
- `npm run build` passed on 2026-06-20 with a Turbopack NFT trace warning from the existing docs reader dynamic file-read path.

## Handoff Notes

- Subagent research found distributed architecture contracts but no single canonical system architecture overview.
- The overview is a routing map, not a replacement for detailed contracts.
- Keep future architecture edits source-backed and avoid expanding this overview into a duplicate status document.
- Closeout: `docs/completed/engineering/2026-06-20-system-architecture-overview-report.html`.
