---
id: DESIGN-SYSTEM-PR-043
status: human_review
area: design-system
priority: P0
target_pr: Project 17 / DEN-410
created: 2026-06-03
---

# DESIGN-SYSTEM-PR-043: 1920x1080 Desktop Product Design Audit

## Goal

Audit the CLAiR EMR staging workspace across core modules at the product baseline desktop viewport, `1920x1080`, and turn the findings into follow-up PR-sized candidates.

## Scope

- Capture the main staging modules at CSS viewport `1920x1080`.
- Review app shell, navigation rail, workspace topbar, module side panel, table/list density, status badges, filter/action controls, and right/aside panel rhythm.
- Compare against current design-system guidance, Product Design onboarding context, and repo-local component/token sources.
- Produce a Korean HTML report and record the result in Linear issue `DEN-410`.

## Out Of Scope

- Code changes.
- Figma edits.
- Live Supabase, DB migration, RLS, production deploy, or real data validation.
- Mobile/narrow viewport redesign.
- Full accessibility compliance certification.

## Acceptance Criteria

- Screenshots for home, reception, treatment/chart, lab, imaging, dispensing/treatment, billing, inpatient, customer, and hospital-admin order catalog are saved.
- Screenshot metadata confirms CSS viewport `1920x1080`.
- The report identifies the most important cross-module UX/design/accessibility risks.
- Follow-up candidates are PR-sized and avoid gated live-data/security scope.
- Linear issue `DEN-410` is updated with report and evidence paths, then moved to Human Review.

## Verification

- Passed: CSS viewport metadata for all 10 captures is `1920x1080`.
- Passed: contact sheet visually confirmed that the nav rail and module surfaces are not cropped.
- Passed: local evidence and report files were created.
- Passed: `npm run docs:check`.

## Result

- Evidence folder: `output/product-design-audit-2026-06-03-den-410/`
- Report: `docs/completed/design/2026-06-03-den-410-desktop-product-design-audit-report.html`
- Linear: `DEN-410`
