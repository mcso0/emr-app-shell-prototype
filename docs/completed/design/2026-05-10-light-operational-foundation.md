---
area: "design-system"
work_item: "DESIGN-SYSTEM-PR-001"
completed: "2026-05-10"
source_docs:
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-001-light-operational-foundation.md"
---

# Light Operational Foundation Closeout

## Summary

Added the first CLAiR EMR light operational foundation pass. The change translates the Linear reference into a bright, restrained EMR-specific token alias layer and applies it to shared panel, list, side-panel card, and dense table surfaces.

## Completed

- Added `docs/design/system/light-operational-foundation.md` as current design-system guidance.
- Added `src/styles/tokens/emr-foundation.css` for hand-authored EMR operational aliases.
- Imported the EMR alias layer after the shadcn token bridge.
- Updated `.emr-panel`, `.emr-hairline`, and added `.emr-selected-surface`.
- Applied the aliases to shared EMR subpanel, list item, side-panel card, and data table surface states.
- Added `.superpowers/` to `.gitignore`.

## Out Of Scope

- Dark mode.
- Feature-screen redesigns.
- Button overhaul.
- Status badge or semantic status color redesign.
- CLAiR's canonical `DESIGN.md`; this should be written after visual validation of the foundation.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/app-shell.spec.ts tests/home.spec.ts tests/button-gallery.spec.ts --reporter=line`
- Manual visual check:
  - `/w/clair-demo/home?modulePanel=open`
  - `/w/clair-demo/dispensing?modulePanel=open&aside=closed`
