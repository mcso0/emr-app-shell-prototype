---
id: "DESIGN-SYSTEM-PR-069"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook EMR side-panel primitives"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
updated: "2026-06-15"
---

# Storybook EMR Side-Panel Primitives

## Goal

Register the remaining priority EMR side-panel, popover, and list primitives in Storybook.

## Scope

- Add co-located stories for:
  - `EmrIconButton`
  - `EmrPopoverShell`
  - `EmrSubpanel`
  - `EmrSidePanelStateIcon`
  - `EmrSidePanelCollapsibleGroup`
  - `EmrSidePanelCard`
  - `EmrTaskQueueCard`
  - `EmrContentAsidePanel`
  - `EmrContentHistoryList`
  - `EmrTextSidePanel`
  - `EmrModuleListSidePanel`
  - `OrderQueueSelectionSummary`
  - `EmrOrderQueueSidePanel`
- Keep titles under `Design System/EMR/...`.
- Include autodocs tags, args, argTypes, component docs descriptions, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use synthetic demo text only.
- Use local story state only; do not change runtime APIs.
- Use DOM API play only where interaction is needed.
- Update design-system README and work index.

## Out Of Scope

- Runtime component behavior or API changes.
- Feature workflow claims beyond synthetic fixtures.
- Real patient, guardian, hospital, payment, or identity data.
- Server query, persistence, DB, Supabase, RLS, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- Passed on 2026-06-15:
  - `npm run lint` passed with existing unrelated warnings.
  - `npx tsc --noEmit` passed.
  - `npm run docs:check` passed.
  - `npm run build-storybook` passed with existing Storybook build warnings.
  - `npm run storybook -- --ci --smoke-test` passed.
  - Storybook MCP docs visibility check found all 13 new EMR side-panel/list entries.
  - Focused Storybook MCP `run-story-tests` passed for the new story set. One initial MCP run hit a transient dynamic import reload error for two stories; the focused rerun passed.

## Handoff Notes

Ready for Human Review.
