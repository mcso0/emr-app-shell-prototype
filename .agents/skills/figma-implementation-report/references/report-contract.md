# Report Contract

The report is both a human review artifact and an executable handoff contract. Keep the visible report and the embedded JSON synchronized.

## Required visible structure

Use these primary views. Labels may be shortened for narrow screens, but the information must remain present.

1. **수정 명세**
   - goal, target viewport, fidelity status, scope, assumptions, and source freshness;
   - change cards with Figma and project evidence;
   - conflict and decision queue shown before low-priority notes.
2. **컴포넌트 · 토큰**
   - existing reuse, change, and new component proposals;
   - shared, feature, local, and primitive ownership;
   - public API, variants, states, consumers, token mapping, and migration impact.
3. **상태 · 접근성**
   - state matrix, responsive rules, keyboard and focus behavior, semantics, contrast, reduced motion, localization, and content overflow.
4. **인터랙티브 시안**
   - target viewport rendered first;
   - scenario, viewport, and motion controls;
   - explicit labels for Figma, project-existing, agent-generated, and user-approved behavior.
5. **구현 · 검증**
   - file-level slices, dependency plan, approval gates, test hooks, evidence, known gaps, and status history.

The header must show Figma node identity, repository revision, generation time, primary viewport, mode, and freshness.

## Status vocabulary

Use only these lifecycle statuses:

- `draft`: captured but not ready for a decision.
- `decision-needed`: user choice required.
- `proposed`: agent recommendation that can be reviewed.
- `approved`: user approved; not yet implemented.
- `implemented`: code changed; verification not complete.
- `verified`: required checks passed with recorded evidence.
- `rejected`: user chose not to proceed.
- `stale`: Figma or repository source changed after capture.
- `not-applicable`: reviewed and intentionally excluded.

Use `pass`, `fail`, `blocked`, or `not-run` only for verification results, not lifecycle status.

## Embedded JSON

Embed one script tag in `dist/report.html`:

```html
<script id="figma-implementation-contract" type="application/json">
  { ...valid JSON... }
</script>
```

Minimum top-level shape:

```json
{
  "schemaVersion": "1.0.0",
  "report": {
    "id": "figma-implementation-report",
    "title": "Feature implementation review",
    "language": "ko",
    "mode": "report",
    "status": "decision-needed",
    "generatedAt": "2026-01-01T00:00:00.000Z"
  },
  "source": {
    "figma": {
      "url": "https://www.figma.com/design/FILE/NAME?node-id=1-2",
      "fileKey": "FILE",
      "nodeId": "1:2",
      "nodeName": "Feature / Default",
      "retrievedAt": "2026-01-01T00:00:00.000Z",
      "fingerprint": "figma-file-version-or-captured-hash",
      "viewport": { "width": 1440, "height": 1024 }
    },
    "repository": {
      "path": "/absolute/path/to/repository",
      "revision": "git-commit-sha",
      "retrievedAt": "2026-01-01T00:00:00.000Z",
      "feature": "feature-or-route"
    }
  },
  "summary": {
    "goal": "What must become implementable",
    "fidelityTarget": "exact-at-source-viewport",
    "readiness": "decision-needed",
    "assumptions": [],
    "knownGaps": []
  },
  "changes": [],
  "conflicts": [],
  "components": [],
  "tokens": [],
  "states": [],
  "responsive": [],
  "accessibility": [],
  "motion": [],
  "implementation": {
    "approvalGates": [],
    "slices": [],
    "dependencies": []
  },
  "verification": {
    "checks": [],
    "visualEvidence": [],
    "lastRunAt": null
  }
}
```

All arrays are required even when empty. Explain important omissions in `summary.knownGaps`.

## Stable item IDs

Give every decision-capable record a stable ID:

- changes: `CHG-001`
- conflicts: `CNF-001`
- components: `CMP-001`
- tokens: `TOK-001`
- states: `STA-001`
- responsive rules: `RSP-001`
- accessibility items: `A11Y-001`
- motion: `MOT-001`
- approval gates: `APR-001`
- implementation slices: `IMP-001`
- verification checks: `VER-001`

Do not renumber IDs after user decisions. Retire records with `rejected` or `not-applicable` instead of deleting decision history.

## Evidence requirements

Evidence objects should identify:

- source type;
- node ID, file path, Storybook story, test, or screenshot;
- captured value or observation;
- retrieval time when freshness matters.

Never use “looks similar” as the only evidence for an exact-fidelity claim.

## Freshness

Record both Figma and repository fingerprints. At minimum, use the Figma file version or retrieval timestamp plus the Git commit SHA. Mark the report `stale` when either source differs from the recorded value before implementation or verification finishes.
