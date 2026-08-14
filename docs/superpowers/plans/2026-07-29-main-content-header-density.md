# Main Content Header Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Centralize the main-content header frame and its fixed/adaptive
height policy without changing feature state ownership or shell structure.

**Architecture:** Add one composition-only EMR primitive and semantic height
tokens. Existing shell header slots and feature/page owners render the
primitive at their current boundaries; domain content remains owned by the
current features.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, global
design tokens, Storybook, Playwright.

## Global Constraints

- Fixed modules always use 56px.
- Hospital-admin and customer use 44px only at
  `(min-width: 1024px) and (max-height: 820px)`; otherwise 56px.
- No new dependency, data/API/Supabase/permission change, or shell ownership
  redesign.
- Preserve feature state, callbacks, accessibility, and existing workflow
  behavior.

## Task 1: Contract And Regression Tests

- Add `EmrMainContentHeader` viewport and adoption Playwright coverage first.
- Run the focused test and confirm it fails because the shared slot does not
  exist.
- Add the work item and canonical design-system contract.

## Task 2: Shared Primitive And Tokens

- Add `src/components/emr/main-content-header.tsx`.
- Add default 56px and compact 44px tokens plus the single adaptive media
  query in `src/styles/tokens/emr-foundation.css`.
- Add Fixed, Adaptive, Content, and Empty Storybook examples.
- Run the focused viewport matrix until green.

## Task 3: Fixed Module Adoption

- Register empty fixed headers for Home, Reception, and Inpatient.
- Compose Chart, Lab, Imaging, Dispensing, and Billing context inside fixed
  headers.
- Return an empty fixed header when context is not selected.
- Verify every fixed module owns exactly one 56px shared slot.

## Task 4: Adaptive Feature Adoption

- Move the customer top frame to `CustomerContent` and remove table-local
  spacers.
- Adopt the shared adaptive header in all ten hospital-admin sections while
  keeping back actions and dirty state local.
- Remove only obsolete header-purpose `h-14`, `pt-14`, and billing `h-12`
  values.
- Verify the full adaptive viewport and screen matrix plus existing workflow
  regressions.

## Task 5: Closeout And Release

- Update canonical design guidance and write the Korean HTML closeout.
- Run all focused and repository gates.
- Commit, push, open a PR to `main`, run the exact-head Release Check, and
  verify Vercel Preview.
- Merge only the verified candidate, wait for Production Ready, run synthetic
  smoke checks, and retain the previous Production deployment as rollback.
