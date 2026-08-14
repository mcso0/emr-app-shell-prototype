# CLAiR chart-writing efficiency concepts — design QA

## Comparison target

- Source visual truth: [`source-current-chart-1440.png`](source-current-chart-1440.png)
- Implementation: [`index.html`](index.html)
- Implementation captures:
  - [`qa-concept-a-1440.png`](qa-concept-a-1440.png)
  - [`qa-concept-b-1440.png`](qa-concept-b-1440.png)
  - [`qa-concept-c-1440.png`](qa-concept-c-1440.png)
- Viewport: 1440 × 900 desktop
- State: Cheongdam synthetic patient `초코`, in-progress encounter, each concept's default state
- Full-view comparison evidence: [`qa-comparison.png`](qa-comparison.png)
- Focused clinical-workspace comparison evidence: [`qa-focused-comparison.png`](qa-focused-comparison.png)

## Intentional redesign boundary

The source is the shell and product-language reference, not a pixel-clone target. The prototype intentionally replaces the simultaneous blank SOAP, diagnosis, and order regions with three distinct workflow hypotheses while retaining the recognizable CLAiR rail, queue, patient context, neutral palette, brand blue, dense desktop rhythm, and completion boundary.

## Findings

- No actionable P0, P1, or P2 findings remain.
- [P3] Icon family differs from production.
  - Location: navigation and action icons across all concepts.
  - Evidence: production uses Obra icons; the standalone HTML uses the Phosphor web icon library.
  - Impact: stroke and optical proportions are close but not identical.
  - Follow-up: replace icon classes with the production `src/components/icons.ts` wrappers when a selected concept moves into the Next.js app.
- [P3] Sub-980px behavior is CSS-reviewed but not browser-captured.
  - Location: tablet/mobile media queries.
  - Evidence: the chosen in-app browser kept a 1280px minimum working viewport during this run. The prototype has explicit 980px and 680px collapse rules, but the requested deliverable is desktop-first.
  - Impact: no desktop blocker; mobile implementation needs a separate physical-width review before product adoption.
  - Follow-up: validate the selected concept at 960px and 640px during implementation.
- [P3] The standalone prototype loads version-pinned Phosphor icon CSS from `unpkg.com`.
  - Location: `index.html` icon stylesheet.
  - Impact: the prototype content remains readable offline, but icons require network access.
  - Follow-up: replace the external stylesheet with production icon wrappers if a concept moves into the Next.js app.

## Required fidelity surfaces

- Fonts and typography: Pretendard-first system stack, macOS antialiasing, compact 10–14px operational hierarchy, balanced headings, pretty body wrapping, and tabular dynamic numbers are present. No clipped core labels were found at 1280 × 720 or 1440 × 900.
- Spacing and layout rhythm: the 52px rail, 284px queue, 52px patient context bar, compact control heights, 8–16px spacing rhythm, 8–14px radii, and restrained elevation remain coherent with CLAiR. The three concept bodies intentionally use different grids while keeping the shell stable.
- Colors and visual tokens: the prototype maps CLAiR Sky `#1085FF`, white/near-white surfaces, dark neutral rail, and semantic green/orange/red states. Controls and text preserve sufficient visible contrast in the reviewed desktop captures.
- Image quality and asset fidelity: the source screen contains no clinical photography or custom raster artwork that needs recreation. Patient identity is rendered as a text fallback, and icons come from one real icon library; no inline SVG, emoji, CSS illustration, or placeholder image substitutes are used.
- Copy and content: all three concepts use the same synthetic patient, complaint, vitals, diagnosis, and order vocabulary. Copy is action-oriented and keeps suggested diagnoses/orders explicitly reviewable rather than silently applied.
- Icons: one consistent outlined family is loaded from the Phosphor web package. Icon-only controls have accessible labels and at least a 40px hit area.
- States and interactions: concept switching, quick-text insertion, SOAP step progression, diagnosis/order queueing, `/` command opening, command execution, template switching, checklist progress, bundle totals, save/saving/error/retry feedback, toast success, and completion confirmation were exercised in the in-app browser.
- Accessibility: semantic tabs/tabpanels, dialog labeling, input labels, visible focus rings, reduced-motion handling, 40px minimum controls, and live toast announcements are present. A DOM check found zero buttons/inputs/textareas without an accessible name.

## Comparison history

### Iteration 1

- Earlier finding: [P2] the initial `min-height: 720px` on the application frame pushed the persistent completion summary below the 1280 × 720 viewport.
- Fix: removed the frame minimum height and let the concept body scroll inside the fixed application grid.
- Post-fix evidence: `concept-a.png`, `concept-b.png`, and `concept-c.png` show the completion summary fixed at the bottom while each concept body remains independently scrollable.

### Iteration 2

- Re-captured source and all three concepts at 1440 × 900.
- Reviewed the full 2×2 comparison and the focused clinical-workspace comparison.
- Re-ran the primary interactions and checked console warnings/errors; no P0/P1/P2 finding remained and the console result was empty.

## Verification summary

- Primary interaction checks: passed
- Save error and recovery: passed
- Completion dialog open/close: passed
- 1280 × 720 and 1440 × 900 desktop layouts: passed
- Console warnings/errors: none
- Accessible-name DOM check: passed (`0` unnamed controls)
- Lower-width physical browser capture: not run; desktop scope only

final result: passed
