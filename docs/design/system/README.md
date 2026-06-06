# Design System Docs

Design system docs describe reusable UI foundations, tokens, components, density rules, and interaction conventions.

Do not extract new shared UI rules here until a repeated pattern is stable.

Current files:

- `DESIGN.md`: canonical CLAiR EMR design direction.
- `light-operational-foundation.md`: first implemented foundation pass and Linear reference translation.
- `border-shadow-depth-contract.md`: border line, radius, and shadow depth usage contract for common EMR surfaces.
- `empty-info-state-contract.md`: empty state and info box contract for missing data, guidance, boundaries, and alert separation.
- `ui-refactor-operating-model.md`: Linear UI/UX refactor initiative operating model and scope guardrails.
- `ui-debt-inventory.md`: evidence-based UI hardcoding, duplicate pattern, and extraction candidate inventory.
- `component-ownership-rules.md`: rules for shadcn/ui, EMR shared, feature-local, and inline UI ownership.
- `ui-refactor-dod.md`: Definition of Done and verification levels for UI refactor issues.
- `arbitrary-value-token-audit.md`: arbitrary Tailwind value audit and EMR token promotion candidate guidance.
- `global-feedback-ui-audit.md`: loading, empty, error, toast, and confirmation UI baseline for remaining refactors.
- `inline-alert-feedback-rules.md`: `EmrInlineAlert` severity, placement, and recovery-action rules for persistent workflow feedback.
- `dialog-shell-rules.md`: `EmrDialogShell` variants, action order, width, scroll, and migration rules for product dialogs.
- `cta-risk-taxonomy.md`: CTA risk levels, confirmation, financial preflight, destructive, and unavailable-action rules.
- `row-action-menu-rules.md`: `EmrRowActionMenu` trigger, item copy, unavailable feedback, and close behavior rules.
- `tab-table-density-contract.md`: workspace tabs, section tabs, segmented/filter-like controls, and density dropdown conditions.
- `table-density-and-grid-ergonomics.md`: table density, scroll width, header role, resize, and cell text policy.
- `table-sort-filter-behavior.md`: real table sort/filter behavior contract for selected EMR data grids.
