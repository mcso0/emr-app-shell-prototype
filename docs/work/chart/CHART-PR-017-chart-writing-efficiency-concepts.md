---
id: "CHART-PR-017"
status: "human_review"
area: "chart"
priority: "P1"
target_pr: "User-approved preservation / chart-writing efficiency concept package"
source_docs:
  - "docs/design/flows/2026-06-25-chart-consultation-call-workflow-plan.html"
  - "docs/work/chart/CHART-PR-006-soap-editor-ux-foundation.md"
  - "docs/work/chart/CHART-PR-013-preconsultation-figma-alignment.md"
depends_on:
  - "CHART-PR-006"
  - "CHART-PR-013"
---

# Goal

Preserve a review-ready, repository-local package of three chart-writing efficiency concepts and their desktop design QA evidence without changing the production chart implementation.

# Scope

- Add one interactive static prototype with three workflow hypotheses: focused writing, command charting, and symptom templates.
- Add 1280 × 720 and 1440 × 900 captures plus full-view and focused comparison evidence.
- Record interaction, accessibility, visual-fidelity, and known-limitation findings in a colocated design QA document.
- Keep all patient and encounter content synthetic and link the package from the work index.

# Out Of Scope

- Selecting a winning concept or adopting it in the Next.js chart workspace.
- Changing SOAP, diagnosis, order, persistence, permission, API, RLS, or production behavior.
- Mobile implementation, sub-980px browser capture, deployment, or external-user publishing.
- Vendoring the version-pinned Phosphor icon stylesheet used by the standalone prototype.

# Done Criteria

1. The concept HTML, QA HTML, QA document, and nine PNG evidence files are versioned as one review package.
2. Repository files contain no machine-specific absolute paths, secrets, or real patient, guardian, hospital, staff, payment, or identity data.
3. Relative image references resolve within the package and all PNG files are readable.
4. Documentation and secret checks pass, and the package remains isolated from production application code.

# Verification

- `npm run docs:check` passed (854 agent Markdown files checked).
- `npm run security:secrets` passed after staging (3,303 tracked files checked).
- Relative asset check passed for all four HTML and Markdown files in the package.
- PNG format and dimension check passed for all nine evidence files.
- Source-copy integrity check passed for the 12 unchanged HTML and PNG artifacts; only `design-qa.md` received repository-path and limitation cleanup.
- `git diff --check` passed.

# Review Notes

- `index.html` uses a version-pinned stylesheet from `unpkg.com`; prototype icons therefore require network access.
- The design QA records desktop validation at 1280 × 720 and 1440 × 900. Physical sub-980px capture remains a follow-up only if a concept is selected for implementation.
