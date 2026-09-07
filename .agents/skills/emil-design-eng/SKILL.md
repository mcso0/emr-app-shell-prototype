---
name: emil-design-eng
description: Refine component motion and interaction polish using Emil Kowalski's design-engineering guidance.
---

# Design Engineering

Use for a concrete component-motion or interaction-polish task. Respect the requested output: review stays read-only; a scoped fix includes implementation and relevant verification. No introductory monologue or prescribed review table is needed.

Start with the interaction's purpose and frequency. Frequent EMR workflows may need immediate feedback with little or no motion. Preserve existing semantic tokens, shared component ownership, keyboard behavior, and reduced-motion support; this style guidance does not authorize a new dependency or product direction.

Read only the relevant reference:

- [Animation decisions and springs](references/animation-decisions.md): whether to animate, easing, timing, or spring behavior.
- [Component motion](references/component-motion.md): buttons, popovers, tooltips, interrupted transitions, or enter states.
- [Transforms and gestures](references/transforms-and-gestures.md): transform origin, clip paths, drag, momentum, or pointer handling.
- [Performance, accessibility, and review](references/performance-accessibility-and-review.md): rendering concerns, reduced motion, hover capabilities, stagger, or debugging.

Treat reference values as design examples subordinate to the approved component contract. Match verification to the touched interaction and report concrete findings or results; do not require next-day review or device matrices for every small change.
