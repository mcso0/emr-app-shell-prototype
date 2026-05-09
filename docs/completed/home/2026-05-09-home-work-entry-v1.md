# Home Work Entry v1 Closeout

Date: 2026-05-09
Work item: `docs/work/home/HOME-PR-002-home-work-entry-v1.md`

## Completed

- Reworked default Home into a My Work-first work-entry surface.
- Added Home v1 mock data for requested/assigned tasks, role queue tasks, role-specific empty launchers, quick status chips, and compact flow summary.
- Remapped mock roles so `billing_admin` behaves as `수납 담당` and `hospital_admin` behaves as `원장/관리자`.
- Removed the old large Alerts & Exceptions panel, role widget grid, and full hospital flow board from the default Home body.
- Preserved `/w/clair-demo/home?view=demo` Sales Demo launcher.
- Updated Home Playwright coverage for v1 work-entry behavior, desk empty state, billing role, unassigned role queue, mobile readability, and demo preservation.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser visual check on `/w/clair-demo/home?modulePanel=open`
- Browser route check on `/w/clair-demo/home?view=demo`

## Notes

Home remains an entry surface. It routes users to source workflows and intentionally does not implement claim, complete, finalize, messaging, lab confirmation, chart completion, or payment completion actions.
