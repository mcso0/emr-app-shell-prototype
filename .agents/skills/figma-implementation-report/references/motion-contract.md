# Motion Contract

Motion is part of the implementation contract even when Figma contains no prototype transitions. Generated motion is allowed by default in report mode, but provenance and accessibility are mandatory.

## Provenance

Label every motion record with exactly one primary source:

- `figma-explicit`: timing or transition exists in the inspected Figma prototype.
- `project-existing`: reuse of an established project interaction or motion token.
- `agent-generated`: proposed because the static frame omits motion.
- `user-approved`: previously generated or conflicting motion accepted by the user.

Never describe `agent-generated` behavior as Figma fidelity.

## Library decision ladder

Use the first adequate option:

1. CSS transitions or keyframes for simple hover, focus, opacity, color, transform, and short enter or exit feedback.
2. Existing `framer-motion` for mounted layout transitions, presence, gesture, or coordinated React state motion.
3. Existing `lottie-web` only for supplied or approved vector animation assets where CSS or Framer Motion is not appropriate.
4. A new library only after a written proposal and explicit approval.

Do not add a motion dependency to the report template. The standalone report uses CSS for its own shell and demo behavior.

## Required fields

Each motion record includes:

- trigger and affected element;
- source;
- purpose: orientation, continuity, feedback, emphasis, or delight;
- from and to states;
- duration, delay, easing, and interruption behavior;
- chosen library or platform primitive;
- reduced-motion behavior;
- status and approval gate when applicable.

## Default generated motion

When Figma is silent, prefer:

- control feedback: 100–160 ms;
- small enter or exit: 160–240 ms;
- panel or layout transition: 200–320 ms;
- opacity plus small transform rather than large movement;
- no decorative continuous motion in task-dense clinical workflows;
- interruptible transitions that do not delay input.

Use existing project motion tokens when present. Exact timing is a project-aligned proposal, not a universal standard.

## Reduced motion

The report and implementation must honor `prefers-reduced-motion: reduce`.

- remove parallax, large translation, spring overshoot, and decorative looping;
- replace spatial movement with instant state change or short opacity when feedback is still needed;
- keep essential progress or state communication available without animation;
- provide a report control that previews reduced motion independently of OS settings.

## Interaction completeness

For each interactive component, review:

- pointer and keyboard activation;
- hover, focus-visible, pressed, selected, disabled, pending, success, and failure states;
- repeated activation and interruption;
- overlay focus management and Escape behavior;
- scroll locking and restoration;
- content resize and layout shift;
- touch target and coarse-pointer behavior.

Generated motion may fill presentation gaps. It must not invent product decisions such as navigation destination, irreversible action, permission, saved state, or server success.

## Approval conditions

Motion needs a user decision when it changes workflow timing, hides information during transition, introduces a new dependency or asset, conflicts with an established project pattern, or materially affects accessibility or performance.
