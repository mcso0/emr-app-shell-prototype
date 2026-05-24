---
status: "active"
updated: "2026-05-24"
linear_issue: "DEN-249"
linear_project: "12 CLAiR EMR Table Density & Data Grid Ergonomics"
source_docs:
  - "docs/_meta/intake-rules.md"
  - "docs/_meta/documentation-depth-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/component-ownership-rules.md"
---

# UX/UI Research Before Implementation

This document defines when CLAiR EMR UX/UI work must start with research and proposal before implementation.

## Operating Principle

Reusable UX/UI pattern changes must not start from a single-screen implementation unless an approved design contract already exists.

For reusable interaction, layout, table, toolbar, navigation, density, filtering, sorting, resizing, wrapping, or component behavior, use this sequence:

1. Research external references and CLAiR internal use cases.
2. Write a proposal report with recommended and rejected patterns.
3. Confirm the implementation scope and reusable component/API contract.
4. Implement only the agreed scope.
5. Verify affected screens and record the closeout.

This reduces rework across repeated EMR surfaces such as 진료/차트, 임상병리검사, 영상검사, 조제/처치, 수납, 입원, 고객관리, and 병원관리.

## Research-First Required

Create or use a research/proposal issue first when the work introduces or changes:

- reusable table or data grid behavior
- header sorting, filtering, column menus, resizing, or text wrapping
- toolbar composition or action placement that repeats across screens
- density, row height, compactness, truncation, or line-clamp rules
- dialog, drawer, popover, command, tab, segmented control, or filter behavior intended for reuse
- shell, navigation, workspace tab, side panel, or right panel interaction patterns
- new shared EMR component APIs
- design-system rules that future screen work should follow

## Research-First Not Required

Skip the research issue when the change is:

- a one-off typo, label, icon, or spacing fix
- a visual regression hotfix that restores an already approved behavior
- adoption of an existing approved design-system contract
- a feature-local UI change that will not become a reusable pattern
- a test-only or docs-only correction that does not change UX guidance

If a one-off change repeats across multiple screens, promote it to research-first before broad rollout.

## Required Research Output

Each research/proposal issue should produce a Korean HTML report under `docs/completed/design/`.

The report should include:

- current CLAiR problem statement
- affected screens and user workflows
- external references or product/library patterns reviewed
- internal use case classification
- recommended pattern
- rejected pattern and reason
- accessibility and keyboard implications
- responsive/dense workspace risks
- reusable component/API proposal
- implementation issue scope and out-of-scope list
- verification recommendations

## Proposal Checklist

Before implementation starts, the proposal must answer:

| Question | Required answer |
| --- | --- |
| Is this a reusable pattern? | Yes/no, with affected surfaces. |
| What is the default behavior? | The expected base case for most screens. |
| What are the allowed variants? | Named variants and when to use each. |
| What is explicitly forbidden? | Anti-patterns that future agents should not reintroduce. |
| What component owns the behavior? | shadcn/ui primitive, shared EMR component, feature-local component, or inline one-off. |
| What are the accessibility requirements? | Labels, focus, keyboard, aria state, and tooltip limits. |
| What is the verification scope? | Docs-only, focused browser QA, Playwright, lint/type/build, or broader visual QA. |

## Linear Issue Shape

Use this structure for research/proposal issues:

```md
## 목표

Define the UX/UI question and expected CLAiR decision.

## 배경

Explain the current screen evidence, repeated pattern risk, and why implementation should wait.

## 조사 대상

List services, libraries, design systems, and CLAiR screens to review.

## 조사 질문

State the product and interaction decisions that must be made.

## 산출물

Korean HTML report, recommendation, reusable API/component proposal, and follow-up implementation issue scope.

## 완료 기준

Reference coverage, CLAiR recommendation, out-of-scope list, and implementation-ready proposal.
```

Implementation issues should link back to the research/proposal issue and should not reopen the product decision unless new evidence appears.

## Current Project 12 Applications

Active research-first examples:

- `DEN-250`: sort, filter, resize, and header ergonomics for EMR data grids
- `DEN-251`: table cell text wrapping and one-line default rules

Both should produce reports and proposals before shared table/header implementation begins.
