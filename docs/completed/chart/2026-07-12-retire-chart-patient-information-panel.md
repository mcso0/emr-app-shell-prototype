---
type: "closeout"
title: "Retire Chart Patient Information Panel"
description: "Removed the obsolete treatment/chart patient information right panel and its legacy route state."
tags: ["chart", "ui", "regression"]
related_work: "CHART-PR-010"
updated: "2026-07-12"
---

# Retire Chart Patient Information Panel

## Result

The treatment/chart workspace no longer renders or reserves the retired patient information right panel. Existing `right=open` treatment URLs now normalize to the standard chart URL without the stale query.

## Preserved

- Chart history content-aside and its open/close control.
- Patient context information in the chart header.
- Right-panel behavior in reception, billing, lab, and imaging.

## Verification

- Focused Playwright coverage passed for both direct treatment URLs and the legacy `/chart` alias.
- Typecheck, scoped lint, docs check, and production build passed.
- The broader `tests/chart.spec.ts` and `tests/app-shell.spec.ts` runs still have unrelated pre-existing failures: a chart source-string expectation already absent from `origin/main`, a SOAP editor state assertion, and a dispensing-shell heading assertion. None exercise the retired chart right panel.
