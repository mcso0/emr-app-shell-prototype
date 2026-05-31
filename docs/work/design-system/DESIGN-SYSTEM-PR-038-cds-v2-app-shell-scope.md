---
id: "DESIGN-SYSTEM-PR-038"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 17 / DEN-350"
source_docs:
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/ux-ui-research-before-implementation.md"
dependencies:
  - "Linear project: 17 CLAiR EMR CDS V2 App Shell Refinement"
updated: "2026-05-31"
---

# CDS V2 App Shell Scope And Acceptance Mapping

## Goal

Map the CDS V2 `key_screen` Figma frame to repo-owned components and define implementation-ready acceptance criteria for Project 17 without changing code yet.

## Figma Source

- File: `[CDS.V2] CLAiR EMR Design System Ver.2`
- Frame: `key_screen`
- Node: `27290:67969`
- URL: `https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27290-67969&t=f9WcQkeeromZ4Bem-4`
- Observed frame size: `1920x1084`

## Scope

- Shell surfaces, background tokens, left navigation, workspace switcher, command entry, topbar, and workspace tabs.
- Module side panel group titles, status icons, order queue task card layout, selection state, metadata chips, and overflow action affordance.
- Patient context bar, document or instruction information header, content aside, and history or test-card metadata patterns.
- Visual behavior only: density, spacing, radius, borders, surface color, icon placement, hierarchy, and selected/hover/focus states.

## Out Of Scope

- The central 조제/처치 order table body, row/cell layout, table data columns, table sort/filter behavior, and order group table density.
- Live Supabase work, DB schema, RLS, server enforcement, production deploy, external integrations, payment, email, or role/permission policy changes.
- Mock data contract changes unless a label or metadata value must be rendered differently from existing mock fields.
- Reopening broad table/data-grid design decisions already tracked by earlier design-system work.

## Component Ownership Map

| Figma area | Primary owner | Candidate repo files | Notes |
| --- | --- | --- | --- |
| App background and shell surfaces | `src/shell/*`, token CSS | `src/shell/shell-main.tsx`, `src/shell/workspace-frame.tsx`, `src/shell/layout-contract.ts`, `src/styles/tokens/emr-foundation.css`, `src/app/globals.css` | Keep route, drawer, tab, and viewport behavior unchanged while aligning CDS V2 surface colors. |
| Workspace switcher | `src/shell/*` | `src/shell/workspace-switcher.tsx` | Update compact button visuals and workspace label/icon treatment only. |
| Left nav and quick search command entry | `src/shell/*` | `src/shell/nav-rail.tsx`, `src/shell/global-command-palette.tsx`, `src/shell/workspace-tabs-bar.tsx` | Move or expose quick search from the top menu area into the nav rail while preserving command palette keyboard behavior. |
| Topbar and workspace tabs | `src/shell/*` | `src/shell/workspace-tabs-bar.tsx`, `src/shell/workspace-chrome-tabs.tsx` | Preserve tab open/close, active state, back/forward, and workspace state. |
| Side panel title groups | shared EMR components | `src/components/emr/side-panel-collapsible-group.tsx`, `src/components/emr/side-panel-status-title.ts`, `src/components/emr/order-queue-side-panel.tsx`, `src/components/emr/subpanel.tsx` | Add status-leading icons for 재요청, 진행중, 완료 and peers without hardcoding feature-only markup in callers. |
| Side panel task cards | shared EMR components | `src/components/emr/side-panel-card.tsx`, `src/components/emr/order-queue-side-panel.tsx` | Rebuild hierarchy, selected state, tags, time chips, and overflow action while preserving click/keyboard selection. |
| Patient context bar | shared EMR components | `src/components/emr/patient-context-bar.tsx` | Align density, surface, memo/vital affordances, and right-side controls; keep popovers and toggles accessible. |
| Document or instruction info bar | shared EMR + feature caller | `src/components/emr/instruction-header-stack.tsx`, `src/components/emr/page-header.tsx`, `src/features/dispensing/module.tsx` | Align title/action row and metadata block around the order document; do not alter the order table body. |
| Content aside and history cards | shared EMR + feature caller | `src/components/emr/content-aside-panel.tsx`, `src/components/emr/content-history-list.tsx`, `src/features/dispensing/module.tsx` | Update right-side background, time/icon metadata, card hierarchy, and collapse/scroll behavior. |

## Behavior Preservation Checklist

- Command palette remains keyboard reachable and search results still route to the same workspaces or actions.
- Workspace tabs preserve active tab, close button behavior, tab history, and overflow behavior.
- Navigation keeps existing route, query, and drawer state semantics.
- Side panel group collapse, selected order, card click target, and overflow action propagation remain stable.
- Patient info interactions keep memo, guardian, vital, and content-side-panel toggles usable by keyboard and pointer.
- Content aside collapse, scroll containment, and selected history/test card behavior remain stable.
- Existing Playwright-facing test IDs and accessible labels are preserved unless the matching implementation issue explicitly updates tests.

## Downstream Acceptance Criteria

### DEN-351: Shell Surfaces, Workspace Switcher, Nav Command Entry

- The shell uses CDS V2 background and panel surface tokens across the root, left section, content section, and content aside boundaries.
- The workspace switcher visually matches the compact Figma control without changing workspace selection semantics.
- The quick search or command trigger is available from the nav rail, and the command palette opens with the same keyboard/search behavior as before.
- Verification target: `tests/app-shell.spec.ts`, lint/typecheck, and desktop plus narrow browser visual QA.

### DEN-352: Workspace Topbar And Tabs Chrome

- Topbar height, icon button density, tab shape, divider treatment, and active/inactive states align with CDS V2.
- Back/forward, tab close, tab creation, and active workspace tab behavior are unchanged.
- Verification target: `tests/app-shell.spec.ts`, lint/typecheck, and focused tab interaction QA.

### DEN-353: Side Panel Status Title Icons

- 재요청, 진행중, 완료, and peer status titles render leading icons that improve scanning while keeping counts and collapse affordances readable.
- Icon variants are data-driven or mapped in the shared EMR layer, not duplicated in every feature caller.
- Figma references:
  - Sidebar component: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27286-70720&t=f9WcQkeeromZ4Bem-4
  - List item title: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27311-27315&t=f9WcQkeeromZ4Bem-4
- Verification target: focused component inspection, lint/typecheck, and side-panel visual QA.

### DEN-354: Order Queue Task Card Visual States

- Task cards match CDS V2 hierarchy for patient/guardian, order name, metadata chips, selected state, overflow action, border, radius, and shadow.
- Selected and hover states are visually distinct and remain accessible without relying on color alone.
- Figma references:
  - Sidebar component: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27286-70720&t=f9WcQkeeromZ4Bem-4
  - Task card: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27295-16474&t=f9WcQkeeromZ4Bem-4
  - List item title: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27311-27315&t=f9WcQkeeromZ4Bem-4
- Verification target: focused side-panel tests or app-shell route QA, lint/typecheck, and desktop visual QA.

### DEN-355: Patient Context Bar And Document Info Header

- Patient context bar and document info area align with CDS V2 density, surface, typography, divider, and metadata layout.
- Existing patient memo/vital interactions and document action buttons remain intact.
- Figma references:
  - Patient info bar: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27383-24831&t=f9WcQkeeromZ4Bem-4
  - Content document title: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27388-72167&t=f9WcQkeeromZ4Bem-4
- Verification target: dispensing route QA, relevant feature tests if touched, lint/typecheck, and desktop visual QA.

### DEN-356: Content Aside And History Sidebar Patterns

- Content aside background, card metadata, time icon treatment, and selected/hover states align with CDS V2.
- Aside collapse/open, independent scrolling, and history/test-card selection remain stable.
- Figma reference:
  - Contents sidebar component: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27383-67619&t=f9WcQkeeromZ4Bem-4
- Verification target: dispensing route QA, lint/typecheck, and desktop visual QA.

### DEN-357: Visual QA And Closeout

- The Project 17 shell is verified as a coherent full-frame implementation against the Figma `key_screen` while keeping the central order table body out of scope.
- Any remaining visual gaps are documented as follow-up issues instead of being hidden in the closeout.
- Verification target: lint, typecheck, focused Playwright, desktop screenshot, narrow viewport check, and Korean closeout report.

## Sequencing Notes

- Start with DEN-351 before DEN-352 because moving the command trigger affects topbar composition.
- Keep DEN-353 and DEN-354 close together because they share side-panel component files.
- Run DEN-355 before DEN-356 when document/patient surface tokens are still settling, then apply the same surface decisions to the content aside.
- Do not parallelize work that edits `src/shell/*`, `src/components/emr/side-panel-*`, or `src/features/dispensing/module.tsx` without a fresh merge check.
- For DEN-353 through DEN-356, use existing components first and align their color, spacing, size, state, and density to the Figma references. Do not hardcode one-off values in component bodies; prefer existing CLAiR/CDS tokens, and add or adjust EMR alias tokens only when the current token set cannot express the referenced design.

## Verification

- `npm run docs:check`
- No application code verification is required for DEN-350 because this issue only creates scope and acceptance documentation.

## Handoff Notes

- This is the implementation gate for Project 17. Later issues should link back to this work item instead of rediscovering the same Figma-to-code boundary.
- The user explicitly excluded the central 조제/처치 order table content area. Treat any table-body polish as a separate future issue.
- The local branch had unrelated dirty product and API changes when this item started; keep Project 17 docs changes isolated from those files.
