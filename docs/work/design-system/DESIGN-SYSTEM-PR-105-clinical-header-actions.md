---
id: "DESIGN-SYSTEM-PR-105"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User-approved HTML / clinical title action order and SM sizing"
created: "2026-10-04"
source_docs:
  - "docs/design/system/instruction-title-header.md"
  - "docs/design/system/workspace-document-width-contract.md"
dependencies:
  - "DESIGN-SYSTEM-PR-102"
---

# Clinical Header Actions

## Goal And Approval

Apply the HTML proposal approved by 승욱 on 2026-10-04 to 진료/차트,
영상검사, 조제, 처치, 임상병리검사, and 수납. The follow-up instruction
authorizes code investigation, a concrete plan, local implementation, and
non-destructive verification.

After reviewing the implementation result, 승욱 authorized delivery of this
same scope: "다하면 커밋, 푸시, 피알,오리진-메인에 머지." The target is
`main`/Production. Retain the exact-candidate Release Check, Ready Preview,
expected-head merge protection, Production source/alias proof, scoped read-only
smoke, and previous-deployment rollback evidence.

## Scope

- Move 넓게/좁게 보기 to the first action, other outline actions before the
  primary/status action, and existing icon/ellipsis menus to the right.
- Use SM 28px buttons with 12px text/icons and 8px group gaps. Keep text widths
  natural and icon buttons 28×28px.
- Remove billing's 32px height overrides; explicitly use SM for chart call and
  both completion segments. Set title-status chevrons to 12px without changing
  the shared ButtonGroup icon defaults or dense XS table actions.
- Let the existing execution action composition accept supporting children
  between the history trigger and lifecycle action, preserving dialog ownership.
- Preserve handlers, API/data/permission boundaries, state variants, visibility,
  width behavior, and disabled document output.

## Done Criteria And Verification

- Measure order, height, text, and SVG sizes in all six local mock screens at
  wide and narrow document widths; include lifecycle split-menu states.
- Check existing width/input/panel regression cases and keyboard menu access.
- Pass focused lint, TypeScript, production build, docs links, secret scan,
  and diff checks.
- Retain the existing primary checkout WIP and record the isolated worktree.

## Investigation

The production audit and source agree on SM for most controls. Billing overrides
XS buttons to 32px. Chart completion uses default MD controls with partial 28px
overrides. ButtonGroup intentionally defaults SM chevrons to 16px; these title
callers need explicit 12px icons. The running project-scoped clair_storybook MCP
confirmed Button sizes/variants and EmrPageHeader action composition.

The original checkout has unrelated WIP. Implementation starts from clean
origin/main 861aaecc in the managed clinical-header-actions worktree.

## Local Result

- Implemented the six-screen action order and SM geometry on
  `codex/clinical-header-actions`. Shared Button/ButtonGroup defaults are intact.
- Browser checks: six new geometry/order/keyboard cases pass at 1920px wide,
  1920px narrow, and 1303px compact; six existing document/input/panel regression
  cases and two execution-record/completion/amendment cases pass (14 total).
- Focused lint, TypeScript, production build with mock auth, docs links, secret
  scan, and diff checks pass. The build retains one NFT tracing warning through
  the untouched document-viewer/Next config import path.
- Synthetic screenshots and a local implementation comparison are available in
  the task's visualization artifact. An independent in-app browser measured the
  lab in-progress split buttons at 28px and their SVGs at 12px.
- The original checkout WIP is preserved. At the local implementation checkpoint,
  no remote data mutation, commit, PR, merge, or deployment had run. Delivery
  proceeds under the subsequent authorization above; evidence belongs to the
  resulting PR and release report.
