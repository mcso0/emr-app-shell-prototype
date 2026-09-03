---
id: "RELEASE-OPS-PR-002"
status: "superseded"
area: "agent-orchestration"
priority: "P0"
target_pr: "User request / fixed staging queue controls and alias automation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-047-queue-filter-sort-task-action-ux.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-049-queue-header-inline-search-ux.md"
  - "docs/engineering/operations/release-environment-policy.md"
  - "docs/engineering/operations/hobby-free-staging-branch-release-plan.md"
  - "docs/engineering/operations/fixed-staging-alias-automation.md"
updated: "2026-09-03"
---

# Fixed Staging Queue Controls And Alias Automation

## Goal

Restore the compact shared queue header controls on fixed staging and automate the fixed staging alias update after successful `staging` branch Vercel deployments.

## Scope

- Keep 진료/차트 and 조제/처치 queue headers on the shared compact UX:
  visible `요청순` sort button, filter icon button, `M`/`S` display density button, and search icon button.
- Preserve inline queue search behavior.
- Add repo-owned fixed staging alias automation through GitHub Actions and a dry-run-capable script.
- Document required GitHub secrets and post-deploy smoke checks.

## Out Of Scope

- DB, Supabase schema/RLS, migration, or remote data mutation work.
- Production deploy, production alias changes, or `main` promote.
- Real patient, guardian, hospital, payment, or identity data.
- New server/API queue sort/filter/search contracts.
- Broad redesign of table, queue card, shell, or panel behavior.

## Done Criteria

- 진료/차트 and 조제/처치 left queue headers no longer expose `현재 정렬: ...`, `필터: ...`, or `표시 옵션: ...` as the primary controls.
- Search icon opens inline search on both queue surfaces.
- `staging` branch deployment success can update `emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` from the latest deployment URL.
- Automation has a local dry-run path and records required `VERCEL_TOKEN` setup without exposing secrets.
- Post-deploy smoke checklist is documented.

## Verification

- `npm run docs:check` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed with 5 pre-existing warnings outside this scope.
- `npm run build` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3116 npx playwright test tests/app-shell.spec.ts tests/chart.spec.ts -g "module side panel order type segmented control filters side orders|chart workspace renders queue, history, SOAP, assessment, and orders" --reporter=line` passed.
- `VERCEL_DEPLOYMENT_URL=https://emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app npm run release:staging-alias:dry-run` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.

## Handoff Notes

Keep production blocked. The fixed staging alias workflow is allowed only for successful `staging` branch deployments or a separately approved integration branch.

2026-09-03 status: the queue UI work remains historical implementation evidence, while the fixed staging alias workflow is superseded by `RELEASE-OPS-PR-004` and is no longer an active operating path.

2026-06-25 browser review correction: the treatment/chart queue header should not keep the visible `요청순` or `M`/`S` compact value labels. The accepted visible header pattern is now three icon-only controls matching the lab queue: sort, filter, and search.

Closeout:

- `docs/completed/agent-orchestration/2026-06-16-fixed-staging-queue-controls-alias-automation-report.html`
