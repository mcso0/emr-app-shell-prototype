# Work Index

This is the current work board. Work items are PR-sized unless explicitly marked otherwise.

## How To Read This Board

Use this file as the repo-side work inventory, not as the only next-work queue. Linear remains the control plane for active issue status, Human Review handoff, and representative acceptance.

`human_review` means the scoped work has been handed to 승욱 or the representative for review. It does not mean the issue is still implementation-ready next work, and it should not be moved to `done` unless 승욱 explicitly accepts it or asks for the status transition.

## Review Visibility Snapshot

DEN-255 review on 2026-05-24 confirmed the large status counts are intentional, but they make the board hard to scan:

| Status         | Count | How to read it                                                                                                          |
| -------------- | ----: | ----------------------------------------------------------------------------------------------------------------------- |
| `done`         |    49 | Completed historical work items already closed in this repo board.                                                      |
| `human_review` |   108 | Completed or handed-off work waiting for representative review, project-level acceptance, or explicit status migration. |

Large `human_review` groups:

| Group                        | Count | Current meaning                                                                                                                                                                         |
| ---------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone or legacy PR rows |    40 | Historical PR-sized work items. Do not pick these as next work unless a current Linear issue points back to them.                                                                       |
| Project 03                   |    11 | Historical reception/live-persistence review queue; keep status unchanged until a representative review or migration task explicitly handles it.                                        |
| Project 04                   |    19 | Active sequence was accepted for `Done` in Linear on 2026-05-20, but this repo board still records the older Human Review rows. Proposed status migration needs explicit 승욱 approval. |
| Project 05                   |    12 | Active sequence was accepted for `Done` in Linear on 2026-05-20, but this repo board still records the older Human Review rows. Proposed status migration needs explicit 승욱 approval. |
| Project 06                   |    10 | Customer Management Persistence is ready for representative Human Review.                                                                                                               |
| Project 07                   |     9 | Hospital Admin Order Catalog Persistence is ready for representative Human Review.                                                                                                      |
| Project 08                   |     8 | Clinical Order Fulfillment Handoff Persistence is ready for representative Human Review; remote staging remains approval-gated.                                                         |

For actual next work, start from the active Linear project and issue, then use the table below only to locate the matching repo work item.

## Status Board

| ID                          | Status       | Area                 | Priority | Target PR            | Work Item                                                                                              |
| --------------------------- | ------------ | -------------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| DOCS-PR-001                 | done         | docs-restructure     | P0       | PR 1                 | `docs/work/docs-restructure/DOCS-PR-001-agent-first-docs-foundation.md`                                |
| DOCS-PR-002                 | done         | docs-restructure     | P0       | PR 2                 | `docs/work/docs-restructure/DOCS-PR-002-product-planning-migration.md`                                 |
| DOCS-PR-003                 | done         | docs-restructure     | P0       | PR 3                 | `docs/work/docs-restructure/DOCS-PR-003-work-item-operations.md`                                       |
| DOCS-PR-004                 | done         | docs-restructure     | P0       | PR 4                 | `docs/work/docs-restructure/DOCS-PR-004-engineering-design-migration.md`                               |
| DOCS-PR-005                 | done         | docs-restructure     | P1       | PR 5                 | `docs/work/docs-restructure/DOCS-PR-005-archive-and-link-checking.md`                                  |
| DOCS-PR-006                 | done         | docs-restructure     | P0       | PR 6                 | `docs/work/docs-restructure/DOCS-PR-006-agent-first-docs-operations.md`                                |
| ENGINEERING-ARCH-PR-001     | human_review | engineering          | P1       | User request / system architecture overview | `docs/work/engineering/ENGINEERING-ARCH-PR-001-system-architecture-overview.md`              |
| PRD-VIEWER-PR-001           | human_review | product              | P0       | PRD viewer PR 1      | `docs/work/product/PRD-VIEWER-PR-001-product-docs-readonly-viewer.md`                                  |
| CLAIR-DOCS-PR-001           | human_review | product              | P1       | CLAiR Docs Study Center v1 | `docs/work/product/CLAIR-DOCS-PR-001-study-center.md`                                            |
| SYMPHONY-PR-001             | done         | agent-orchestration  | P1       | PR 1                 | `docs/work/agent-orchestration/SYMPHONY-PR-001-orchestration-foundation.md`                            |
| SYMPHONY-PR-002             | done         | agent-orchestration  | P1       | PR 2                 | `docs/work/agent-orchestration/SYMPHONY-PR-002-linear-pilot-kit.md`                                    |
| RELEASE-OPS-PR-001          | done         | agent-orchestration  | P0       | Project Release & Deployment Operations / DEN-443-DEN-451 | `docs/work/agent-orchestration/RELEASE-OPS-PR-001-release-deployment-policy-skill.md` |
| RELEASE-OPS-PR-002          | human_review | agent-orchestration  | P0       | User request / fixed staging queue controls and alias automation | `docs/work/agent-orchestration/RELEASE-OPS-PR-002-fixed-staging-queue-controls-alias-automation.md` |
| OWNER-OS-PR-001             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-420 | `docs/work/agent-orchestration/OWNER-OS-PR-001-implementation-scope-contract.md`              |
| OWNER-OS-PR-002             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-421 | `docs/work/agent-orchestration/OWNER-OS-PR-002-router-skill.md`                              |
| OWNER-OS-PR-003             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-422 | `docs/work/agent-orchestration/OWNER-OS-PR-003-work-packet-template-validator.md`             |
| OWNER-OS-PR-004             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-423 | `docs/work/agent-orchestration/OWNER-OS-PR-004-eval-dataset-judge-rubric.md`                 |
| OWNER-OS-PR-005             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-424 | `docs/work/agent-orchestration/OWNER-OS-PR-005-trace-contract.md`                            |
| OWNER-OS-PR-006             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-425 | `docs/work/agent-orchestration/OWNER-OS-PR-006-local-cli.md`                                  |
| OWNER-OS-PR-007             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-426 | `docs/work/agent-orchestration/OWNER-OS-PR-007-eval-command.md`                               |
| OWNER-OS-PR-008             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-427 | `docs/work/agent-orchestration/OWNER-OS-PR-008-dashboard-prototype.md`                        |
| OWNER-OS-PR-009             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-428 | `docs/work/agent-orchestration/OWNER-OS-PR-009-scenario-qa-regression.md`                     |
| OWNER-OS-PR-010             | done         | agent-orchestration  | P0       | Project CLAiR Owner OS Implementation / DEN-429 | `docs/work/agent-orchestration/OWNER-OS-PR-010-project-closeout.md`                           |
| DESIGN-SYSTEM-PR-001        | done         | design-system        | P1       | PR 1                 | `docs/work/design-system/DESIGN-SYSTEM-PR-001-light-operational-foundation.md`                         |
| DESIGN-SYSTEM-PR-002        | done         | design-system        | P1       | PR 2                 | `docs/work/design-system/DESIGN-SYSTEM-PR-002-ui-consistency-audit.md`                                 |
| DESIGN-SYSTEM-PR-003        | done         | design-system        | P1       | PR 3                 | `docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md`               |
| DESIGN-SYSTEM-PR-004        | done         | design-system        | P1       | PR 4                 | `docs/work/design-system/DESIGN-SYSTEM-PR-004-chart-feature-token-cleanup.md`                          |
| DESIGN-SYSTEM-PR-005        | done         | design-system        | P1       | PR 5                 | `docs/work/design-system/DESIGN-SYSTEM-PR-005-reception-feature-token-cleanup.md`                      |
| DESIGN-SYSTEM-PR-006        | done         | design-system        | P1       | PR 6                 | `docs/work/design-system/DESIGN-SYSTEM-PR-006-lab-feature-token-cleanup.md`                            |
| DESIGN-SYSTEM-PR-007        | done         | design-system        | P1       | PR 7                 | `docs/work/design-system/DESIGN-SYSTEM-PR-007-imaging-feature-token-cleanup.md`                        |
| DESIGN-SYSTEM-PR-008        | done         | design-system        | P1       | PR 8                 | `docs/work/design-system/DESIGN-SYSTEM-PR-008-dispensing-treatment-feature-token-cleanup.md`           |
| DESIGN-SYSTEM-PR-009        | done         | design-system        | P1       | PR 9                 | `docs/work/design-system/DESIGN-SYSTEM-PR-009-billing-feature-token-cleanup.md`                        |
| DESIGN-SYSTEM-PR-010        | done         | design-system        | P1       | PR 10                | `docs/work/design-system/DESIGN-SYSTEM-PR-010-inpatient-feature-token-cleanup.md`                      |
| DESIGN-SYSTEM-PR-011        | done         | design-system        | P1       | PR 11                | `docs/work/design-system/DESIGN-SYSTEM-PR-011-customer-feature-token-cleanup.md`                       |
| DESIGN-SYSTEM-PR-012        | done         | design-system        | P1       | PR 12                | `docs/work/design-system/DESIGN-SYSTEM-PR-012-hospital-admin-feature-token-cleanup.md`                 |
| DESIGN-SYSTEM-PR-013        | done         | design-system        | P1       | PR 13                | `docs/work/design-system/DESIGN-SYSTEM-PR-013-profile-drawer-token-cleanup.md`                         |
| DESIGN-SYSTEM-PR-014        | done         | design-system        | P1       | PR 14                | `docs/work/design-system/DESIGN-SYSTEM-PR-014-home-workspace-token-cleanup.md`                         |
| DESIGN-SYSTEM-PR-015        | done         | design-system        | P1       | PR 15                | `docs/work/design-system/DESIGN-SYSTEM-PR-015-auth-login-token-cleanup.md`                             |
| DESIGN-SYSTEM-PR-016        | done         | design-system        | P1       | PR 16                | `docs/work/design-system/DESIGN-SYSTEM-PR-016-shell-chrome-token-cleanup.md`                           |
| DESIGN-SYSTEM-PR-017        | done         | design-system        | P1       | PR 17                | `docs/work/design-system/DESIGN-SYSTEM-PR-017-shared-emr-components-token-cleanup.md`                  |
| DESIGN-SYSTEM-PR-018        | done         | design-system        | P1       | PR 18                | `docs/work/design-system/DESIGN-SYSTEM-PR-018-residual-color-audit.md`                                 |
| DESIGN-SYSTEM-PR-019        | human_review | design-system        | P0       | Project 06 / DEN-129 | `docs/work/design-system/DESIGN-SYSTEM-PR-019-hospital-admin-table-form-standardization.md`            |
| DESIGN-SYSTEM-PR-020        | human_review | design-system        | P0       | Project 06 / DEN-131 | `docs/work/design-system/DESIGN-SYSTEM-PR-020-inpatient-table-status-standardization.md`               |
| DESIGN-SYSTEM-PR-021        | human_review | design-system        | P0       | Project 12 / DEN-264 | `docs/work/design-system/DESIGN-SYSTEM-PR-021-shared-table-header-cell-text-primitives.md`             |
| DESIGN-SYSTEM-PR-022        | human_review | design-system        | P0       | Project 12 / DEN-265 | `docs/work/design-system/DESIGN-SYSTEM-PR-022-chart-order-table-shared-primitives.md`                  |
| DESIGN-SYSTEM-PR-023        | human_review | design-system        | P0       | Project 12 / DEN-266 | `docs/work/design-system/DESIGN-SYSTEM-PR-023-billing-table-shared-primitives.md`                      |
| DESIGN-SYSTEM-PR-024        | human_review | design-system        | P0       | Project 12 / DEN-267 | `docs/work/design-system/DESIGN-SYSTEM-PR-024-customer-table-shared-primitives.md`                     |
| DESIGN-SYSTEM-PR-025        | human_review | design-system        | P0       | Project 12 / DEN-269 | `docs/work/design-system/DESIGN-SYSTEM-PR-025-hospital-admin-order-catalog-table-shared-primitives.md` |
| DESIGN-SYSTEM-PR-026        | done         | design-system        | P0       | Project 13 / DEN-270 | `docs/work/design-system/DESIGN-SYSTEM-PR-026-table-sort-filter-behavior-contract.md`                  |
| DESIGN-SYSTEM-PR-027        | done         | design-system        | P0       | Project 13 / DEN-271 | `docs/work/design-system/DESIGN-SYSTEM-PR-027-billing-table-sort-filter-behavior.md`                   |
| DESIGN-SYSTEM-PR-028        | done         | design-system        | P0       | Project 13 / DEN-272 | `docs/work/design-system/DESIGN-SYSTEM-PR-028-chart-order-table-sort-filter-behavior.md`               |
| DESIGN-SYSTEM-PR-029        | done         | design-system        | P0       | Project 13 / DEN-273 | `docs/work/design-system/DESIGN-SYSTEM-PR-029-customer-table-sort-filter-behavior.md`                  |
| DESIGN-SYSTEM-PR-030        | done         | design-system        | P0       | Project 13 / DEN-274 | `docs/work/design-system/DESIGN-SYSTEM-PR-030-hospital-admin-order-catalog-sort-filter-behavior.md`    |
| DESIGN-SYSTEM-PR-031        | done         | design-system        | P0       | Project 13 / DEN-275 | `docs/work/design-system/DESIGN-SYSTEM-PR-031-adopted-table-sort-filter-qa.md`                         |
| DESIGN-SYSTEM-PR-032        | human_review | design-system        | P0       | Project 13 / DEN-276 | `docs/work/design-system/DESIGN-SYSTEM-PR-032-final-sort-filter-behavior-closeout.md`                  |
| DESIGN-SYSTEM-PR-033        | done         | design-system        | P0       | Project 13 / DEN-293 | `docs/work/design-system/DESIGN-SYSTEM-PR-033-advanced-table-filter-builder-foundation.md`             |
| DESIGN-SYSTEM-PR-034        | done         | design-system        | P0       | Project 13 / DEN-294 | `docs/work/design-system/DESIGN-SYSTEM-PR-034-advanced-filter-builder-table-adoption.md`               |
| DESIGN-SYSTEM-PR-035        | human_review | design-system        | P0       | Project 13 / DEN-295 | `docs/work/design-system/DESIGN-SYSTEM-PR-035-advanced-filter-builder-rollout-qa.md`                   |
| DESIGN-SYSTEM-PR-036        | done         | design-system        | P0       | Project 13 / DEN-296 | `docs/work/design-system/DESIGN-SYSTEM-PR-036-customer-advanced-filter-builder-migration.md`           |
| DESIGN-SYSTEM-PR-037        | human_review | design-system        | P0       | Project 13 / DEN-297 | `docs/work/design-system/DESIGN-SYSTEM-PR-037-hospital-admin-advanced-filter-builder-migration.md`     |
| DESIGN-SYSTEM-PR-038        | human_review | design-system        | P0       | Project 17 / DEN-350 | `docs/work/design-system/DESIGN-SYSTEM-PR-038-cds-v2-app-shell-scope.md`                               |
| DESIGN-SYSTEM-PR-039        | human_review | design-system        | P0       | Project 17 / DEN-351 | `docs/work/design-system/DESIGN-SYSTEM-PR-039-cds-v2-shell-surfaces-command-entry.md`                  |
| DESIGN-SYSTEM-PR-040        | human_review | design-system        | P0       | Project 17 / DEN-352 | `docs/work/design-system/DESIGN-SYSTEM-PR-040-cds-v2-workspace-topbar-tabs-chrome.md`                  |
| DESIGN-SYSTEM-PR-041        | human_review | design-system        | P0       | Project 17 / DEN-353 | `docs/work/design-system/DESIGN-SYSTEM-PR-041-cds-v2-sidepanel-status-title-icons.md`                  |
| DESIGN-SYSTEM-PR-042        | human_review | design-system        | P0       | User request / module list side panel | `docs/work/design-system/DESIGN-SYSTEM-PR-042-module-list-side-panel-unification.md`          |
| DESIGN-SYSTEM-PR-043        | human_review | design-system        | P0       | Project 17 / DEN-410 | `docs/work/design-system/DESIGN-SYSTEM-PR-043-desktop-product-design-audit.md`                         |
| DESIGN-SYSTEM-PR-044        | done         | design-system        | P1       | Project common UX/UI / DEN-433 | `docs/work/design-system/DESIGN-SYSTEM-PR-044-border-shadow-depth-contract.md`                |
| DESIGN-SYSTEM-PR-045        | human_review | design-system        | P1       | Project common UX/UI / DEN-434 | `docs/work/design-system/DESIGN-SYSTEM-PR-045-empty-info-state-contract.md`                   |
| DESIGN-SYSTEM-PR-046        | human_review | design-system        | P0       | DEN-435              | `docs/work/design-system/DESIGN-SYSTEM-PR-046-tab-table-density-contract.md`                           |
| DESIGN-SYSTEM-PR-047        | human_review | design-system        | P0       | DEN-436              | `docs/work/design-system/DESIGN-SYSTEM-PR-047-queue-filter-sort-task-action-ux.md`                     |
| DESIGN-SYSTEM-PR-048        | done         | design-system        | P1       | DEN-437              | `docs/work/design-system/DESIGN-SYSTEM-PR-048-patient-info-bar-memo-action-ux.md`                      |
| DESIGN-SYSTEM-PR-049        | human_review | design-system        | P1       | DEN-441              | `docs/work/design-system/DESIGN-SYSTEM-PR-049-queue-header-inline-search-ux.md`                        |
| DESIGN-SYSTEM-PR-050        | human_review | design-system        | P0       | DEN-442              | `docs/work/design-system/DESIGN-SYSTEM-PR-050-customer-hospital-table-content-layout.md`               |
| DESIGN-SYSTEM-PR-048        | human_review | design-system        | P1       | User request / Storybook foundation | `docs/work/design-system/DESIGN-SYSTEM-PR-048-storybook-foundation.md`                      |
| DESIGN-SYSTEM-PR-049        | human_review | design-system        | P1       | User request / Storybook first UI primitive stories | `docs/work/design-system/DESIGN-SYSTEM-PR-049-storybook-first-ui-stories.md`      |
| DESIGN-SYSTEM-PR-050        | human_review | design-system        | P1       | User request / Storybook EMR component stories | `docs/work/design-system/DESIGN-SYSTEM-PR-050-storybook-emr-component-stories.md` |
| DESIGN-SYSTEM-PR-051        | human_review | design-system        | P1       | User request / Storybook MCP local endpoint | `docs/work/design-system/DESIGN-SYSTEM-PR-051-storybook-mcp-local-endpoint.md`    |
| DESIGN-SYSTEM-PR-052        | human_review | design-system        | P1       | User request / Storybook MCP documentation quality | `docs/work/design-system/DESIGN-SYSTEM-PR-052-storybook-mcp-doc-quality.md` |
| DESIGN-SYSTEM-PR-053        | human_review | design-system        | P1       | User request / Storybook project-scoped MCP client | `docs/work/design-system/DESIGN-SYSTEM-PR-053-storybook-project-mcp-client.md` |
| DESIGN-SYSTEM-PR-054        | human_review | design-system        | P1       | User request / Storybook MCP dogfood pass | `docs/work/design-system/DESIGN-SYSTEM-PR-054-storybook-mcp-dogfood-pass.md` |
| DESIGN-SYSTEM-PR-055        | human_review | design-system        | P1       | User request / Storybook form-feedback primitive stories | `docs/work/design-system/DESIGN-SYSTEM-PR-055-storybook-form-feedback-primitives.md` |
| DESIGN-SYSTEM-PR-056        | human_review | design-system        | P1       | User request / Storybook interaction test policy | `docs/work/design-system/DESIGN-SYSTEM-PR-056-storybook-interaction-test-policy.md` |
| DESIGN-SYSTEM-PR-057        | human_review | design-system        | P1       | User request / Storybook table-queue pattern entry | `docs/work/design-system/DESIGN-SYSTEM-PR-057-storybook-table-queue-patterns.md` |
| DESIGN-SYSTEM-PR-058        | human_review | design-system        | P1       | User request / Design System README Storybook summary | `docs/work/design-system/DESIGN-SYSTEM-PR-058-design-system-readme-storybook-summary.md` |
| DESIGN-SYSTEM-PR-059        | human_review | design-system        | P1       | User request / Storybook UI primitive third batch | `docs/work/design-system/DESIGN-SYSTEM-PR-059-storybook-ui-primitives-third-batch.md` |
| DESIGN-SYSTEM-PR-060        | human_review | design-system        | P1       | User request / Storybook dialog-popover primitive stories | `docs/work/design-system/DESIGN-SYSTEM-PR-060-storybook-dialog-popover-primitives.md` |
| DESIGN-SYSTEM-PR-061        | human_review | design-system        | P1       | User request / Storybook table-queue pattern second pass | `docs/work/design-system/DESIGN-SYSTEM-PR-061-storybook-table-queue-patterns-second-pass.md` |
| DESIGN-SYSTEM-PR-062        | human_review | design-system        | P1       | User request / Storybook Vitest optimizer stability | `docs/work/design-system/DESIGN-SYSTEM-PR-062-storybook-vitest-optimizer-stability.md` |
| DESIGN-SYSTEM-PR-063        | human_review | design-system        | P1       | User request / Storybook dropdown-sheet primitive stories | `docs/work/design-system/DESIGN-SYSTEM-PR-063-storybook-dropdown-sheet-primitives.md` |
| DESIGN-SYSTEM-PR-064        | human_review | design-system        | P1       | User request / Storybook empty-info-feedback patterns | `docs/work/design-system/DESIGN-SYSTEM-PR-064-storybook-empty-info-feedback-patterns.md` |
| DESIGN-SYSTEM-PR-065        | human_review | design-system        | P1       | User request / Storybook UI primitive fourth batch | `docs/work/design-system/DESIGN-SYSTEM-PR-065-storybook-ui-primitives-fourth-batch.md` |
| DESIGN-SYSTEM-PR-066        | human_review | design-system        | P1       | User request / Storybook table-separator-inputotp primitives | `docs/work/design-system/DESIGN-SYSTEM-PR-066-storybook-table-separator-inputotp-primitives.md` |
| DESIGN-SYSTEM-PR-067        | human_review | design-system        | P1       | User request / Storybook EMR shell-action primitives | `docs/work/design-system/DESIGN-SYSTEM-PR-067-storybook-emr-shell-action-primitives.md` |
| DESIGN-SYSTEM-PR-068        | human_review | design-system        | P1       | User request / Storybook EMR table controls | `docs/work/design-system/DESIGN-SYSTEM-PR-068-storybook-emr-table-controls.md` |
| DESIGN-SYSTEM-PR-069        | human_review | design-system        | P1       | User request / Storybook EMR side-panel primitives | `docs/work/design-system/DESIGN-SYSTEM-PR-069-storybook-emr-side-panel-primitives.md` |
| DESIGN-SYSTEM-PR-070        | human_review | design-system        | P1       | User request / EmrEmptyState component contract and Storybook variants | `docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md` |
| HOME-PR-001                 | done         | home                 | P1       | PR 1                 | `docs/work/home/HOME-PR-001-role-command-home-foundation.md`                                           |
| HOME-PR-002                 | done         | home                 | P1       | PR 2                 | `docs/work/home/HOME-PR-002-home-work-entry-v1.md`                                                     |
| HOME-PR-003                 | done         | home                 | P1       | PR 3                 | `docs/work/home/HOME-PR-003-home-kanban-workspace.md`                                                  |
| HOME-PR-004                 | human_review | home                 | P0       | Project 17 / DEN-411 | `docs/work/home/HOME-PR-004-den-411-home-unified-workspace.md`                                         |
| HOME-PR-005                 | human_review | home                 | P0       | Project 17 / DEN-417 | `docs/work/home/HOME-PR-005-den-417-home-non-modal-task-detail.md`                                     |
| HOME-PR-006                 | human_review | home                 | P0       | Project 17 / DEN-418 | `docs/work/home/HOME-PR-006-den-418-home-shared-task-queue-card.md`                                    |
| HOME-PR-007                 | human_review | home                 | P0       | Project 17 / DEN-419 | `docs/work/home/HOME-PR-007-den-419-home-kanban-visual-noise-cleanup.md`                               |
| HOME-PR-008                 | human_review | home                 | P0       | Project 17 / DEN-430 | `docs/work/home/HOME-PR-008-den-430-home-workspace-frame-alignment.md`                                 |
| HOME-PR-009                 | human_review | home                 | P0       | Project 17 / DEN-431 | `docs/work/home/HOME-PR-009-den-431-home-shell-sidepanel.md`                                           |
| HOME-PR-010                 | human_review | home                 | P0       | Project 17 / DEN-432 | `docs/work/home/HOME-PR-010-den-432-home-internal-status-labels.md`                                    |
| HOME-PR-011                 | human_review | home                 | P0       | User request / Home operations live work items | `docs/work/home/HOME-PR-011-home-operations-live-work-items.md`                     |
| NOTIFICATION-PR-001         | human_review | notifications        | P0       | Project 20 / DEN-395 | `docs/work/notifications/NOTIFICATION-PR-001-v0-contract-fixture-schema.md`                            |
| NOTIFICATION-PR-002         | human_review | notifications        | P0       | Project 20 / DEN-396 | `docs/work/notifications/NOTIFICATION-PR-002-event-matrix-ux-badge-toast-policy.md`                    |
| NOTIFICATION-PR-003         | human_review | notifications        | P0       | Project 20 / DEN-397 | `docs/work/notifications/NOTIFICATION-PR-003-shell-drawer-foundation.md`                               |
| NOTIFICATION-PR-004         | human_review | notifications        | P0       | Project 20 / DEN-398 | `docs/work/notifications/NOTIFICATION-PR-004-row-filter-read-archive-states.md`                        |
| NOTIFICATION-PR-005         | human_review | notifications        | P0       | Project 20 / DEN-399 | `docs/work/notifications/NOTIFICATION-PR-005-localstorage-role-queue-disclaimer.md`                    |
| NOTIFICATION-PR-006         | human_review | notifications        | P0       | Project 20 / DEN-400 | `docs/work/notifications/NOTIFICATION-PR-006-v0-event-matrix-fixtures.md`                              |
| NOTIFICATION-PR-007         | human_review | notifications        | P0       | Project 20 / DEN-401 | `docs/work/notifications/NOTIFICATION-PR-007-badge-recipient-action-rules.md`                          |
| NOTIFICATION-PR-008         | human_review | notifications        | P0       | Project 20 / DEN-402 | `docs/work/notifications/NOTIFICATION-PR-008-dedupe-update-bump-rules.md`                              |
| NOTIFICATION-PR-009         | human_review | notifications        | P0       | Project 20 / DEN-403 | `docs/work/notifications/NOTIFICATION-PR-009-toast-stack-status-variants.md`                           |
| NOTIFICATION-PR-010         | human_review | notifications        | P0       | Project 20 / DEN-404 | `docs/work/notifications/NOTIFICATION-PR-010-source-navigation-fallback-detail.md`                      |
| NOTIFICATION-PR-011         | human_review | notifications        | P0       | Project 20 / DEN-405 | `docs/work/notifications/NOTIFICATION-PR-011-dirty-state-notification-navigation-guard.md`              |
| NOTIFICATION-PR-012         | human_review | notifications        | P0       | Project 20 / DEN-406 | `docs/work/notifications/NOTIFICATION-PR-012-event-ui-surface-qa.md`                                    |
| NOTIFICATION-PR-013         | human_review | notifications        | P0       | Project 20 / DEN-407 | `docs/work/notifications/NOTIFICATION-PR-013-focused-state-regression-tests.md`                         |
| NOTIFICATION-PR-014         | human_review | notifications        | P0       | Project 20 / DEN-408 | `docs/work/notifications/NOTIFICATION-PR-014-project-closeout-report.md`                                |
| NOTIFICATION-PR-015         | human_review | notifications        | P0       | Project 20 / DEN-409 | `docs/work/notifications/NOTIFICATION-PR-015-human-review-readiness-pass.md`                            |
| APP-SHELL-PR-001            | done         | app-shell            | P1       | PR 1                 | `docs/work/app-shell/APP-SHELL-PR-001-workspace-tabs.md`                                               |
| WORKSPACE-TABS-PR-001       | human_review | app-shell            | P0       | Workspace Tabs v1 shipping closeout | `docs/work/app-shell/WORKSPACE-TABS-PR-001-workspace-tabs-v1-shipping-closeout.md`       |
| WORKSPACE-TABS-PR-002       | human_review | app-shell            | P0       | Workspace tab work-surface independence | `docs/work/app-shell/WORKSPACE-TABS-PR-002-workspace-surface-independence.md`          |
| AUTH-PR-001                 | human_review | auth                 | P0       | PR 1                 | `docs/work/auth/AUTH-PR-001-workspace-auth-scope-permission-matrix.md`                                 |
| AUTH-PR-002                 | human_review | auth                 | P0       | PR 2                 | `docs/work/auth/AUTH-PR-002-workspace-membership-data-security-plan.md`                                |
| AUTH-PR-003                 | human_review | auth                 | P0       | PR 3                 | `docs/work/auth/AUTH-PR-003-next-security-patch.md`                                                    |
| AUTH-PR-004                 | human_review | auth                 | P0       | PR 4                 | `docs/work/auth/AUTH-PR-004-workspace-creation-foundation.md`                                          |
| AUTH-PR-005                 | human_review | auth                 | P0       | PR 5                 | `docs/work/auth/AUTH-PR-005-member-invitation-status-flow.md`                                          |
| AUTH-PR-006                 | human_review | auth                 | P0       | PR 6                 | `docs/work/auth/AUTH-PR-006-server-permission-resolver-contract.md`                                    |
| AUTH-PR-007                 | human_review | auth                 | P0       | PR 7                 | `docs/work/auth/AUTH-PR-007-role-management-admin-ui.md`                                               |
| AUTH-PR-008                 | human_review | auth                 | P0       | PR 8                 | `docs/work/auth/AUTH-PR-008-personal-profile-settings.md`                                              |
| AUTH-PR-009                 | human_review | auth                 | P0       | PR 9                 | `docs/work/auth/AUTH-PR-009-first-server-permission-enforcement-slice.md`                              |
| AUTH-PR-010                 | human_review | auth                 | P0       | PR 10                | `docs/work/auth/AUTH-PR-010-security-review-workspace-auth-permission-boundary.md`                     |
| AUTH-PR-011                 | human_review | auth                 | P0       | PR 11                | `docs/work/auth/AUTH-PR-011-live-supabase-readiness-execution-mode.md`                                 |
| AUTH-PR-012                 | human_review | auth                 | P0       | PR 12                | `docs/work/auth/AUTH-PR-012-auth-db-env-secret-verification-gates.md`                                  |
| AUTH-PR-013                 | human_review | auth                 | P0       | PR 13                | `docs/work/auth/AUTH-PR-013-server-side-supabase-session-reader-contract.md`                           |
| AUTH-PR-014                 | human_review | auth                 | P0       | PR 14                | `docs/work/auth/AUTH-PR-014-role-update-verified-session-seam.md`                                      |
| AUTH-PR-015                 | human_review | auth                 | P0       | PR 15                | `docs/work/auth/AUTH-PR-015-auth-guard-server-session-regression.md`                                   |
| AUTH-PR-016                 | human_review | auth                 | P0       | PR 16                | `docs/work/auth/AUTH-PR-016-workspace-auth-schema-migration.md`                                        |
| AUTH-PR-017                 | human_review | auth                 | P0       | PR 17                | `docs/work/auth/AUTH-PR-017-local-migration-validation-auth-seed-contract.md`                          |
| AUTH-PR-018                 | human_review | auth                 | P0       | PR 18                | `docs/work/auth/AUTH-PR-018-db-level-last-admin-protection-foundation.md`                              |
| AUTH-PR-019                 | human_review | auth                 | P0       | PR 19                | `docs/work/auth/AUTH-PR-019-workspace-membership-rls-policy-baseline.md`                               |
| AUTH-PR-020                 | human_review | auth                 | P0       | PR 20                | `docs/work/auth/AUTH-PR-020-db-backed-permission-adapter.md`                                           |
| AUTH-PR-021                 | human_review | auth                 | P0       | PR 21                | `docs/work/auth/AUTH-PR-021-cross-workspace-denial-regression.md`                                      |
| AUTH-PR-022                 | human_review | auth                 | P0       | PR 22                | `docs/work/auth/AUTH-PR-022-security-review-live-auth-db-rls-foundation.md`                            |
| AUTH-PR-023                 | human_review | auth                 | P0       | PR 23                | `docs/work/auth/AUTH-PR-023-workspace-persistence-handoff-project-closeout.md`                         |
| AUTH-PR-024                 | human_review | auth                 | P0       | PR 24                | `docs/work/auth/AUTH-PR-024-docker-local-supabase-rls-execution-gate.md`                               |
| AUTH-PR-025                 | human_review | auth                 | P0       | PR 25                | `docs/work/auth/AUTH-PR-025-workspace-live-persistence-scope-dependencies.md`                          |
| AUTH-PR-026                 | human_review | auth                 | P0       | PR 26                | `docs/work/auth/AUTH-PR-026-workspace-member-server-route-contract.md`                                 |
| AUTH-PR-027                 | human_review | auth                 | P0       | PR 27                | `docs/work/auth/AUTH-PR-027-workspace-creation-live-persistence.md`                                    |
| AUTH-PR-028                 | human_review | auth                 | P0       | PR 28                | `docs/work/auth/AUTH-PR-028-workspace-membership-list-live-read.md`                                    |
| AUTH-PR-029                 | human_review | auth                 | P0       | PR 29                | `docs/work/auth/AUTH-PR-029-workspace-invitation-create-live-persistence.md`                           |
| AUTH-PR-030                 | human_review | auth                 | P0       | PR 30                | `docs/work/auth/AUTH-PR-030-workspace-invitation-lifecycle-live-persistence.md`                        |
| AUTH-PR-031                 | human_review | auth                 | P0       | PR 31                | `docs/work/auth/AUTH-PR-031-workspace-membership-status-live-read.md`                                  |
| AUTH-PR-032                 | human_review | auth                 | P0       | PR 32                | `docs/work/auth/AUTH-PR-032-workspace-role-edit-server-enforcement-ui.md`                              |
| AUTH-PR-033                 | human_review | auth                 | P0       | PR 33                | `docs/work/auth/AUTH-PR-033-workspace-role-status-db-persistence.md`                                   |
| AUTH-PR-034                 | human_review | auth                 | P0       | PR 34                | `docs/work/auth/AUTH-PR-034-workspace-role-management-regression-coverage.md`                          |
| AUTH-PR-035                 | human_review | auth                 | P0       | PR 35                | `docs/work/auth/AUTH-PR-035-personal-profile-live-persistence.md`                                      |
| AUTH-PR-036                 | human_review | auth                 | P0       | PR 36                | `docs/work/auth/AUTH-PR-036-live-persistence-secret-scanning-gate.md`                                  |
| AUTH-PR-037                 | human_review | auth                 | P0       | PR 37                | `docs/work/auth/AUTH-PR-037-api-error-telemetry-contract.md`                                           |
| AUTH-PR-038                 | human_review | auth                 | P0       | PR 38                | `docs/work/auth/AUTH-PR-038-workspace-live-api-rate-limiting.md`                                       |
| AUTH-PR-039                 | human_review | auth                 | P0       | PR 39                | `docs/work/auth/AUTH-PR-039-workspace-persistence-security-review.md`                                  |
| AUTH-PR-044                 | in_progress  | auth                 | P0       | PR 44                | `docs/work/auth/AUTH-PR-044-workspace-permission-role-model-mvp.md`                                    |
| AUTH-PR-040                 | human_review | auth                 | P0       | PR 40                | `docs/work/auth/AUTH-PR-040-project-02-workspace-persistence-closeout.md`                              |
| AUTH-PR-041                 | done         | auth                 | P0       | Project 03 / DEN-268 | `docs/work/auth/AUTH-PR-041-invite-password-setup-returning-login.md`                                  |
| AUTH-PR-042                 | human_review | auth                 | P1       | Project 14 / DEN-277 | `docs/work/auth/AUTH-PR-042-login-production-entry-polish.md`                                          |
| AUTH-PR-043                 | human_review | auth                 | P1       | Project 14 / DEN-278 | `docs/work/auth/AUTH-PR-043-invite-link-password-onboarding-implementation.md`                         |
| AUDIT-SECURITY-PR-001       | human_review | audit-security       | P0       | Project 05 / DEN-82  | `docs/work/audit-security/AUDIT-SECURITY-PR-001-mvp-pilot-readiness-criteria.md`                       |
| AUDIT-SECURITY-PR-002       | human_review | audit-security       | P0       | Project 05 / DEN-83  | `docs/work/audit-security/AUDIT-SECURITY-PR-002-live-mvp-audit-event-matrix.md`                        |
| AUDIT-SECURITY-PR-003       | human_review | audit-security       | P0       | Project 05 / DEN-84  | `docs/work/audit-security/AUDIT-SECURITY-PR-003-live-mvp-audit-log-persistence.md`                     |
| AUDIT-SECURITY-PR-004       | human_review | audit-security       | P0       | Project 05 / DEN-85  | `docs/work/audit-security/AUDIT-SECURITY-PR-004-live-mutation-audit-emission.md`                       |
| AUDIT-SECURITY-PR-005       | human_review | audit-security       | P0       | Project 05 / DEN-86  | `docs/work/audit-security/AUDIT-SECURITY-PR-005-live-audit-review-surface.md`                          |
| AUDIT-SECURITY-PR-006       | human_review | audit-security       | P0       | Project 05 / DEN-87  | `docs/work/audit-security/AUDIT-SECURITY-PR-006-live-auth-db-rls-workspace-threat-model.md`            |
| AUDIT-SECURITY-PR-007       | human_review | audit-security       | P0       | Project 05 / DEN-88  | `docs/work/audit-security/AUDIT-SECURITY-PR-007-clinical-billing-audit-mutation-security-review.md`    |
| AUDIT-SECURITY-PR-008       | human_review | audit-security       | P0       | Project 05 / DEN-89  | `docs/work/audit-security/AUDIT-SECURITY-PR-008-full-live-outpatient-workflow-qa.md`                   |
| AUDIT-SECURITY-PR-009       | human_review | audit-security       | P0       | Project 05 / DEN-90  | `docs/work/audit-security/AUDIT-SECURITY-PR-009-role-workspace-boundary-denial-ux-qa.md`               |
| AUDIT-SECURITY-PR-010       | human_review | audit-security       | P0       | Project 05 / DEN-91  | `docs/work/audit-security/AUDIT-SECURITY-PR-010-representative-pilot-rehearsal-defect-triage.md`       |
| AUDIT-SECURITY-PR-011       | human_review | audit-security       | P0       | Project 05 / DEN-92  | `docs/work/audit-security/AUDIT-SECURITY-PR-011-product-mvp-live-transition-closeout.md`               |
| AUDIT-SECURITY-PR-012       | human_review | audit-security       | P0       | Project 05 / DEN-93  | `docs/work/audit-security/AUDIT-SECURITY-PR-012-post-mvp-backlog-next-initiative-candidates.md`        |
| PWA-PR-001                  | done         | pwa                  | P1       | PR 1                 | `docs/work/pwa/PWA-PR-001-installable-app-shell.md`                                                    |
| RECEPTION-PR-001            | done         | reception            | P0       | PR 1                 | `docs/work/reception/RECEPTION-PR-001-walk-in-checkin.md`                                              |
| RECEPTION-PR-002            | done         | reception            | P1       | PR 2                 | `docs/work/reception/RECEPTION-PR-002-calendar-visual-ux.md`                                           |
| RECEPTION-PR-003            | done         | reception            | P1       | PR 3                 | `docs/work/reception/RECEPTION-PR-003-registration-quality-ux.md`                                      |
| RECEPTION-PR-004            | done         | reception            | P1       | PR 4                 | `docs/work/reception/RECEPTION-PR-004-unified-registration-entry.md`                                   |
| RECEPTION-PR-005            | done         | reception            | P1       | Project 18 / DEN-382-DEN-385 | `docs/work/reception/RECEPTION-PR-005-calendar-task-creation-ux.md`                             |
| RECEPTION-PR-006            | human_review | reception            | P1       | Project 19 / DEN-388-DEN-394 | `docs/work/reception/RECEPTION-PR-006-calendar-selection-guardrails.md`                         |
| RECEPTION-LIVE-PR-001       | human_review | reception            | P0       | Project 03 / DEN-54  | `docs/work/reception/RECEPTION-LIVE-PR-001-encounter-persistence-contract.md`                          |
| RECEPTION-LIVE-PR-002       | human_review | reception            | P0       | Project 03 / DEN-55  | `docs/work/reception/RECEPTION-LIVE-PR-002-schema-extension-plan.md`                                   |
| RECEPTION-LIVE-PR-003       | human_review | reception            | P0       | Project 03 / DEN-56  | `docs/work/reception/RECEPTION-LIVE-PR-003-schema-migration.md`                                        |
| RECEPTION-LIVE-PR-004       | human_review | reception            | P0       | Project 03 / DEN-57  | `docs/work/reception/RECEPTION-LIVE-PR-004-patient-guardian-lookup.md`                                 |
| RECEPTION-LIVE-PR-005       | human_review | reception            | P0       | Project 03 / DEN-58  | `docs/work/reception/RECEPTION-LIVE-PR-005-patient-guardian-registration-write.md`                     |
| RECEPTION-LIVE-PR-006       | human_review | reception            | P0       | Project 03 / DEN-60  | `docs/work/reception/RECEPTION-LIVE-PR-006-walk-in-encounter-create.md`                                |
| RECEPTION-LIVE-PR-007       | human_review | reception            | P0       | Project 03 / DEN-59  | `docs/work/reception/RECEPTION-LIVE-PR-007-appointment-check-in-transition.md`                         |
| RECEPTION-LIVE-PR-008       | human_review | reception            | P0       | Project 03 / DEN-61  | `docs/work/reception/RECEPTION-LIVE-PR-008-reception-mutation-permission-hardening.md`                 |
| RECEPTION-LIVE-PR-009       | human_review | reception            | P0       | Project 03 / DEN-62  | `docs/work/reception/RECEPTION-LIVE-PR-009-reception-queue-read.md`                                    |
| RECEPTION-LIVE-PR-010       | human_review | reception            | P0       | Project 03 / DEN-63  | `docs/work/reception/RECEPTION-LIVE-PR-010-reception-day-calendar-read.md`                             |
| RECEPTION-LIVE-PR-011       | human_review | reception            | P0       | Project 03 / DEN-64  | `docs/work/reception/RECEPTION-LIVE-PR-011-sales-demo-mock-fallback-preservation.md`                   |
| RECEPTION-LIVE-PR-012       | human_review | reception            | P0       | Project 04 / DEN-65  | `docs/work/reception/RECEPTION-LIVE-PR-012-reception-persistence-regression-coverage.md`               |
| RECEPTION-LIVE-PR-013       | human_review | reception            | P0       | Project 04 / DEN-66  | `docs/work/reception/RECEPTION-LIVE-PR-013-chart-order-billing-handoff-closeout.md`                    |
| RECEPTION-QA-PR-001         | human_review | reception            | P0       | Reception QA / DEN-519 | `docs/work/reception/RECEPTION-QA-PR-001-db-api-fallback-boundary.md`                                |
| RECEPTION-QA-PR-002         | human_review | reception            | P0       | Reception QA / DEN-514 | `docs/work/reception/RECEPTION-QA-PR-002-date-filter-search.md`                                      |
| RECEPTION-QA-PR-003         | human_review | reception            | P0       | Reception QA / DEN-515 | `docs/work/reception/RECEPTION-QA-PR-003-create-drawer-weight.md`                                    |
| RECEPTION-QA-PR-004         | human_review | reception            | P0       | Reception QA / DEN-516 | `docs/work/reception/RECEPTION-QA-PR-004-reservation-create-flow.md`                                 |
| RECEPTION-QA-PR-005         | human_review | reception            | P0       | Reception QA / DEN-517 | `docs/work/reception/RECEPTION-QA-PR-005-detail-edit-drawer.md`                                      |
| RECEPTION-QA-PR-006         | human_review | reception            | P0       | Reception QA / DEN-518 | `docs/work/reception/RECEPTION-QA-PR-006-regression-closeout.md`                                     |
| RECEPTION-QA-PR-008         | done         | reception            | P1       | Browser Comment 1 / codex/reception-today-command-navigation | `docs/work/reception/RECEPTION-QA-PR-008-global-command-today-reception-navigation.md`      |
| CLINICAL-BILLING-PR-001     | human_review | clinical-billing     | P0       | Project 04 / DEN-67  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-001-scope-encounter-dependency.md`                     |
| CLINICAL-BILLING-PR-002     | human_review | clinical-billing     | P0       | Project 04 / DEN-68  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-002-schema-migration.md`                               |
| CLINICAL-BILLING-PR-003     | human_review | clinical-billing     | P0       | Project 04 / DEN-100 | `docs/work/clinical-billing/CLINICAL-BILLING-PR-003-chart-order-snapshot-bridge.md`                    |
| CLINICAL-BILLING-PR-004     | human_review | clinical-billing     | P0       | Project 04 / DEN-69  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-004-soap-note-persistence.md`                          |
| CLINICAL-BILLING-PR-005     | human_review | clinical-billing     | P0       | Project 04 / DEN-70  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-005-chart-completion-persistence.md`                   |
| CLINICAL-BILLING-PR-006     | human_review | clinical-billing     | P0       | Project 04 / DEN-71  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-006-diagnosis-persistence.md`                          |
| CLINICAL-BILLING-PR-007     | human_review | clinical-billing     | P0       | Project 04 / DEN-72  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-007-order-draft-persistence.md`                        |
| CLINICAL-BILLING-PR-008     | human_review | clinical-billing     | P0       | Project 04 / DEN-73  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-008-order-action-persistence.md`                       |
| CLINICAL-BILLING-PR-009     | human_review | clinical-billing     | P0       | Project 04 / DEN-74  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-009-order-lifecycle-persistence.md`                    |
| CLINICAL-BILLING-PR-010     | human_review | clinical-billing     | P0       | Project 04 / DEN-75  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-010-invoice-candidate-sync.md`                         |
| CLINICAL-BILLING-PR-011     | human_review | clinical-billing     | P0       | Project 04 / DEN-76  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-011-cross-screen-persisted-read.md`                    |
| CLINICAL-BILLING-PR-012     | human_review | clinical-billing     | P0       | Project 04 / DEN-77  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-012-invoice-line-billing-confirmation-persistence.md`  |
| CLINICAL-BILLING-PR-013     | human_review | clinical-billing     | P0       | Project 04 / DEN-78  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-013-payment-status-persistence.md`                     |
| CLINICAL-BILLING-PR-014     | human_review | clinical-billing     | P0       | Project 04 / DEN-79  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-014-billing-permission-amount-integrity-regression.md` |
| CLINICAL-BILLING-PR-015     | human_review | clinical-billing     | P0       | Project 04 / DEN-80  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-015-outpatient-persistence-regression.md`              |
| CLINICAL-BILLING-PR-016     | human_review | clinical-billing     | P0       | Project 04 / DEN-81  | `docs/work/clinical-billing/CLINICAL-BILLING-PR-016-audit-security-readiness-handoff.md`               |
| CLINICAL-FULFILLMENT-PR-001 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-235 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-001-scope-data-contract.md`                    |
| CLINICAL-FULFILLMENT-PR-002 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-236 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-002-schema-route-contract.md`                  |
| CLINICAL-FULFILLMENT-PR-003 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-237 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-003-chart-confirmation-sync.md`                |
| CLINICAL-FULFILLMENT-PR-004 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-238 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-004-lab-imaging-queue-adoption.md`             |
| CLINICAL-FULFILLMENT-PR-005 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-239 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-005-dispensing-treatment-queue-adoption.md`    |
| CLINICAL-FULFILLMENT-PR-006 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-240 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-006-lifecycle-billing-sync.md`                 |
| CLINICAL-FULFILLMENT-PR-007 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-241 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-007-handoff-replay-regression.md`              |
| CLINICAL-FULFILLMENT-PR-008 | human_review | clinical-fulfillment | P0       | Project 08 / DEN-242 | `docs/work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-008-project-closeout-staging-readiness.md`     |
| DEMO-DATA-PR-001            | human_review | demo-data            | P0       | Project 04 / DEN-99  | `docs/work/demo-data/DEMO-DATA-PR-001-portfolio-virtual-hospital-dataset-foundation.md`                |
| DEMO-DATA-PR-002            | ready        | demo-data            | P0       | TBD                  | `docs/work/demo-data/DEMO-DATA-PR-002-clinic-start-state-demo-operations.md`                           |
| DEMO-DB-PR-001              | human_review | demo-data            | P0       | Demo DB PR 1         | `docs/work/demo-data/DEMO-DB-PR-001-seed-inventory-readback-contract.md`                               |
| DEMO-DB-PR-002              | human_review | demo-data            | P0       | Demo DB PR 2         | `docs/work/demo-data/DEMO-DB-PR-002-order-catalog-set-seed-foundation.md`                              |
| DEMO-DB-PR-003              | human_review | demo-data            | P0       | Demo DB PR 3         | `docs/work/demo-data/DEMO-DB-PR-003-fulfillment-work-item-seed-foundation.md`                          |
| DEMO-DB-PR-004              | human_review | demo-data            | P0       | Demo DB PR 4         | `docs/work/demo-data/DEMO-DB-PR-004-lab-result-sheet-catalog-seed-foundation.md`                       |
| DEMO-DB-PR-005              | human_review | demo-data            | P0       | Demo DB PR 5         | `docs/work/demo-data/DEMO-DB-PR-005-billing-checkout-session-family-seed-foundation.md`                |
| UI-PR-001                   | human_review | demo-data            | P0       | UI PR 1              | `docs/work/demo-data/UI-PR-001-reception-chart-api-wiring-e2e.md`                                      |
| UI-PR-002                   | human_review | demo-data            | P0       | UI PR 2              | `docs/work/demo-data/UI-PR-002-fulfillment-billing-ui-wiring-e2e.md`                                   |
| DEN-452                     | human_review | demo-data            | P0       | Linear DEN-452       | `docs/work/demo-data/DEN-452-lab-result-persistence-db-rls-api.md`                                     |
| DEN-453                     | human_review | demo-data            | P0       | Linear DEN-453       | `docs/work/demo-data/DEN-453-lab-result-ux-loading-error-retry-permission-states.md`                   |
| DEN-454                     | human_review | demo-data            | P0       | Linear DEN-454       | `docs/work/demo-data/DEN-454-billing-api-primary-invoice-payment-checkout-state.md`                    |
| DEN-455                     | human_review | demo-data            | P0       | Linear DEN-455       | `docs/work/demo-data/DEN-455-billing-ux-loading-failure-retry-payment-state-clarity.md`                |
| DEN-456                     | human_review | demo-data            | P0       | Linear DEN-456       | `docs/work/demo-data/DEN-456-dispensing-treatment-fulfillment-work-item-adoption.md`                   |
| DEN-457                     | human_review | demo-data            | P0       | Linear DEN-457       | `docs/work/demo-data/DEN-457-full-visible-e2e-demo-reception-to-audit.md`                              |
| DEN-458                     | human_review | demo-data            | P0       | Linear DEN-458       | `docs/work/demo-data/DEN-458-local-supabase-replay-hardening.md`                                       |
| DEN-459                     | human_review | demo-data            | P0       | Linear DEN-459       | `docs/work/demo-data/DEN-459-permission-rls-api-boundary-test-coverage.md`                             |
| DEN-460                     | human_review | demo-data            | P0       | Linear DEN-460       | `docs/work/demo-data/DEN-460-engineering-docs-sync-current-status-api-contracts-demo-runbook.md`        |
| DEN-461                     | human_review | demo-data            | P0       | Linear DEN-461       | `docs/work/demo-data/DEN-461-project-closeout-demo-readiness-remaining-gaps.md`                        |
| CUSTOMER-LIVE-PR-001        | human_review | customer             | P0       | Project 06 / DEN-101 | `docs/work/customer/CUSTOMER-LIVE-PR-001-customer-management-persistence-scope.md`                     |
| CUSTOMER-LIVE-PR-002        | human_review | customer             | P0       | Project 06 / DEN-102 | `docs/work/customer/CUSTOMER-LIVE-PR-002-customer-schema-delta-plan.md`                                |
| CUSTOMER-LIVE-PR-003        | human_review | customer             | P0       | Project 06 / DEN-105 | `docs/work/customer/CUSTOMER-LIVE-PR-003-customer-schema-migration.md`                                 |
| CUSTOMER-LIVE-PR-004        | human_review | customer             | P0       | Project 06 / DEN-106 | `docs/work/customer/CUSTOMER-LIVE-PR-004-guardian-profile-persistence.md`                              |
| CUSTOMER-LIVE-PR-005        | human_review | customer             | P0       | Project 06 / DEN-107 | `docs/work/customer/CUSTOMER-LIVE-PR-005-patient-profile-persistence.md`                               |
| CUSTOMER-LIVE-PR-006        | human_review | customer             | P0       | Project 06 / DEN-108 | `docs/work/customer/CUSTOMER-LIVE-PR-006-relationship-management-persistence.md`                       |
| CUSTOMER-LIVE-PR-007        | human_review | customer             | P0       | Project 06 / DEN-109 | `docs/work/customer/CUSTOMER-LIVE-PR-007-soft-delete-restore-persistence.md`                           |
| CUSTOMER-LIVE-PR-008        | human_review | customer             | P0       | Project 06 / DEN-110 | `docs/work/customer/CUSTOMER-LIVE-PR-008-customer-management-regression-handoff.md`                    |
| CHART-PR-001                | done         | chart                | P1       | PR 1                 | `docs/work/chart/CHART-PR-001-workspace-restructure.md`                                                |
| CHART-PR-002                | done         | chart                | P1       | PR 2                 | `docs/work/chart/CHART-PR-002-soap-order-scroll-boundary.md`                                           |
| CHART-PR-003                | done         | chart                | P1       | PR 3                 | `docs/work/chart/CHART-PR-003-chart-safety-mvp-ux.md`                                                  |
| CHART-PR-004                | done         | chart                | P1       | PR 4                 | `docs/work/chart/CHART-PR-004-chart-operational-polish.md`                                             |
| CHART-PR-005                | done         | chart                | P1       | PR 5                 | `docs/work/chart/CHART-PR-005-diagnosis-search-first-pass.md`                                          |
| CHART-PR-006                | done         | chart                | P1       | PR 6                 | `docs/work/chart/CHART-PR-006-soap-editor-ux-foundation.md`                                            |
| CHART-PR-007                | done         | chart                | P1       | PR 7                 | `docs/work/chart/CHART-PR-007-editable-order-table.md`                                                 |
| CHART-PR-008                | human_review | chart                | P0       | User request / consultation call-start flow | `docs/work/chart/CHART-PR-008-consultation-call-start-flow.md`                     |
| CHART-PR-009                | human_review | chart                | P0       | User request / consultation room selection and pre-start chart lock | `docs/work/chart/CHART-PR-009-consultation-room-lock-ux.md` |
| LAB-PR-001                  | done         | lab                  | P1       | PR 1                 | `docs/work/lab/LAB-PR-001-result-workspace-structure.md`                                               |
| IMAGING-PR-001              | done         | imaging              | P1       | PR 1                 | `docs/work/imaging/IMAGING-PR-001-workspace-restructure.md`                                            |
| HOSPITAL-ADMIN-PR-001       | done         | hospital-admin       | P1       | PR 1                 | `docs/work/hospital-admin/HOSPITAL-ADMIN-PR-001-order-management-catalog.md`                           |
| HOSPITAL-ADMIN-LIVE-PR-001  | human_review | hospital-admin       | P0       | Project 07 / DEN-103 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-001-order-catalog-persistence-scope.md`               |
| HOSPITAL-ADMIN-LIVE-PR-002  | human_review | hospital-admin       | P0       | Project 07 / DEN-104 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-002-order-catalog-schema-plan.md`                     |
| HOSPITAL-ADMIN-LIVE-PR-003  | human_review | hospital-admin       | P0       | Project 07 / DEN-111 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-003-order-catalog-schema-migration.md`                |
| HOSPITAL-ADMIN-LIVE-PR-004  | human_review | hospital-admin       | P0       | Project 07 / DEN-112 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-004-order-catalog-read-boundary.md`                   |
| HOSPITAL-ADMIN-LIVE-PR-005  | human_review | hospital-admin       | P0       | Project 07 / DEN-113 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-005-order-catalog-admin-mutations.md`                 |
| HOSPITAL-ADMIN-LIVE-PR-006  | human_review | hospital-admin       | P0       | Project 07 / DEN-114 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-006-order-set-persistence.md`                         |
| HOSPITAL-ADMIN-LIVE-PR-007  | human_review | hospital-admin       | P0       | Project 07 / DEN-115 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-007-lab-test-item-linkage.md`                         |
| HOSPITAL-ADMIN-LIVE-PR-008  | human_review | hospital-admin       | P0       | Project 07 / DEN-116 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-008-medication-vaccine-pricing.md`                    |
| HOSPITAL-ADMIN-LIVE-PR-009  | human_review | hospital-admin       | P0       | Project 07 / DEN-117 | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-009-order-catalog-regression-handoff.md`              |
| HOSPITAL-ADMIN-LIVE-PR-010  | human_review | hospital-admin       | P0       | DEN-440              | `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-010-den-440-lab-order-search-db-contract-boundaries.md` |
| BILLING-PR-001              | done         | billing              | P1       | PR 1                 | `docs/work/billing/BILLING-PR-001-billing-workspace-restructure.md`                                    |
| INPATIENT-PR-001            | done         | inpatient            | P1       | PR 1                 | `docs/work/inpatient/INPATIENT-PR-001-ward-workspace.md`                                               |
| CUSTOMER-PR-001             | done         | customer             | P1       | PR 1                 | `docs/work/customer/CUSTOMER-PR-001-customer-management-workspace.md`                                  |

## Current Next Work

The original docs restructure and docs operating-system sequence is complete and in representative review. The newer GitBook/docs 운영 고도화 sequence is tracked in Linear project `CLAiR EMR GitBook/docs 운영 고도화`; use that Linear project for the current docs navigation work instead of inferring from older board rows.

Product MVP implementation work should start from:

- `docs/agent-start-here.md`
- `docs/_meta/README.md`
- `docs/engineering/current-status.md`
- `docs/work/inbox.md`

Recommended next shaping target:

- Project 04 and Project 05 have completed their active issue sequences and were accepted for `Done` in Linear on 2026-05-20.
- Project 06 `Customer Management Persistence` has completed its active issue sequence through DEN-110 and is ready for representative Human Review.
- Project 07 `Hospital Admin Order Catalog Persistence` has completed its active issue sequence through DEN-117 and is ready for representative Human Review.
- Project 08 `Clinical Order Fulfillment Handoff Persistence` has completed DEN-235 through DEN-242 through Human Review. Representative approval is needed before moving issues to `Done` or running remote staging validation.
- Keep Project 06 and Project 07 local-first unless 승욱 separately approves remote Supabase, staging/live migration, real data, or production deploy.

Proposed board cleanup candidates for 승욱 review:

- Move Project 04 rows from `human_review` to `done` only if 승욱 confirms the Linear acceptance should be mirrored in `docs/work/index.md`.
- Move Project 05 rows from `human_review` to `done` only if 승욱 confirms the Linear acceptance should be mirrored in `docs/work/index.md`.
- Leave Project 06, Project 07, Project 08, and standalone legacy rows unchanged unless a focused review/migration issue is opened.

## Inbox

See `docs/work/inbox.md`.
