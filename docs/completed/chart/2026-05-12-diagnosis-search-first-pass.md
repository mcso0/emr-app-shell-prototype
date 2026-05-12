# Chart Diagnosis Search First Pass Closeout

Date: 2026-05-12

## Summary

CHART-PR-005 adds a session-only first pass for diagnosis search in the 진료(차트) diagnosis panel.

## Completed

- Replaced the read-only diagnosis search placeholder with a searchable popover.
- Added mock catalog entries with Korean/English/synonym matching.
- Added SOAP/context-based recommendations before typing.
- Added session-only row creation from catalog results and free-text input.
- Added local row actions for confirmed marking, primary/focus marking, and removal.
- Added Playwright coverage for the interaction.

## Boundaries

- No live diagnosis catalog API, DB persistence, Supabase validation, migration, RLS, or server enforcement was added.
- Diagnosis row edits are local UI state only.
- The durable meaning and storage of `중점` remains an open product/data-model question.
- Diagnosis selection does not auto-change SOAP, Plan, orders, billing, chart completion, or audit logs.

## Verification

- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts --reporter=line` (`13 passed`)
- `npm run lint`
- Local browser smoke check on `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed`
