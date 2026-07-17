# Verification Matrix

Do not call the report or implementation complete until the relevant checks have evidence. Record `not-run` honestly when a check is out of scope or blocked.

## Report artifact

- `npm run build:report` succeeds.
- `dist/report.html` exists and opens from `file://` or an offline local server.
- no external script, stylesheet, font, image, or runtime network dependency remains unless the user explicitly approved it;
- embedded `figma-implementation-contract` JSON parses and passes the contract validator;
- every visible decision item has the same stable ID and status as the JSON;
- tabs, filters, scenario controls, viewport controls, and prototype controls work;
- console has no uncaught errors;
- report works at desktop and narrow report-shell widths.

## Figma fidelity

At the primary viewport, verify:

- frame dimensions and major regions;
- layout direction, ordering, alignment, padding, gap, and constraints;
- typography family, weight, size, line height, letter spacing, wrapping, and truncation;
- fills, strokes, radii, shadows, opacity, images, and icons;
- scroll and clipping behavior;
- visible default state;
- explicit prototype transitions.

Use screenshot or pixel comparison. Record the comparison method, viewport, browser scale, and intentional exclusions. A visual approximation is not an exact match.

## Responsive behavior

Use the Figma frame size as the exact target. For widths not defined in Figma:

- follow approved project layout and breakpoint conventions;
- label the behavior `project-existing` or `agent-generated`;
- verify narrow, target, and wider widths relevant to the route;
- test content growth, localization, and overflow, not only empty boxes.

## State coverage

Review applicable states:

- default;
- hover, focus-visible, active, selected, and disabled;
- loading and retry;
- empty and search-empty;
- read error and validation error;
- no permission or restricted action;
- partial data and long content;
- success or saved feedback;
- offline or stale data when the feature supports it.

## Accessibility

- semantic roles and names match behavior;
- heading and landmark order is coherent;
- keyboard order follows reading and visual order;
- focus is visible, not clipped, and restored after overlays;
- dialogs and menus manage focus and Escape correctly;
- form labels, descriptions, validation, and live feedback are exposed;
- color contrast and non-color status cues are checked;
- touch target and spacing are usable;
- reduced motion removes non-essential movement;
- screen-reader-only content does not contradict visible copy.

## Implementation verification

Run the repository's narrowest relevant checks, then widen in proportion to shared impact:

- typecheck or build;
- focused unit or component tests;
- Storybook stories and browser interaction tests for shared UI;
- route-level browser tests;
- visual comparison at the primary viewport;
- responsive and reduced-motion checks;
- regression checks for every affected shared consumer.

For data, permission, or API behavior, verify server and database boundaries; client-only gating is not sufficient.

## Evidence record

Each verification item should include:

```json
{
  "id": "VER-001",
  "name": "Standalone HTML structure",
  "result": "pass",
  "command": "npm run test:report",
  "evidence": "No external runtime assets; embedded contract parsed",
  "runAt": "2026-01-01T00:00:00.000Z"
}
```

Never reuse an old passing result after the corresponding Figma source, report source, application code, token, dependency, or repository revision changes.
