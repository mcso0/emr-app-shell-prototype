# Workspace width and bilateral panels proposal

Status: research and synthetic interaction prototype; human review pending.
Date: 2026-09-29.

- `report.html`: Korean UX research, source links, width budget, module exceptions, rejected alternatives, and rollout proposal.
- `prototype.html`: five-module static prototype with width/panel/queue controls and synthetic inputs.
- `assets/*-1920.png`: comparable current/focused/bilateral layout screenshots. These reconstruct the layout with synthetic content; they are not production captures.
- `qa-results.json`: browser observations and verification limits.

No application source, clinical data, API, database, shared token, or deployment was changed. Third-party research was grounded in official product/design-system documents and W3C/NN/g guidance. Width values are CLAiR-specific design hypotheses rather than published UX standards.

Run only this artifact directory on loopback:

```sh
python3 -m http.server 4186 --bind 127.0.0.1 --directory /Users/iseung-ug/project/emr-app-shell-prototype/docs/completed/design/2026-09-29-workspace-width-proposal
```

Open `/report.html` or `/prototype.html`. Files also work without a build step. The prototype has no network writes and does not persist clinical values. Lucide icon licensing is included under `assets/LUCIDE-LICENSE`.

Approved follow-up: show the width toggle only when the available document width exceeds the module cap. Measure the unrestricted center space after queue, inline panels, padding and scrollbar; preserve the selected mode while the toggle is hidden. Explicit width-button changes animate between actual widths for 180ms with ease-out; layout changes apply immediately, and reduced motion disables the transition. No application implementation is included.

The browser proof covers virtual CSS layout widths from 1366 to 2560, synthetic input preservation, panel fallback, Escape/focus restoration, queue collapse, module switching, imaging wide preference, explicit receipt application, and profile/panel separation. Intermediate width measurements during the 180ms transition are marked in the QA record; CSS targets are verified independently. Actual clinical task performance, 200 percent browser zoom, real PACS imagery, production implementation, and persistent preferences remain untested.

Follow-up browser verification covers conditional visibility at 1366–2560 CSS px, hidden-mode restoration, both-panel and queue changes, all five module caps, observed transition interpolation, rapid reversal, pointer/keyboard activation, and preserved synthetic inputs. The reduced-motion CSS rule is verified in source; OS/browser reduced-motion emulation was not performed. Comparable screenshots were refreshed.
