---
id: DESIGN-SYSTEM-PR-110
status: implemented
area: design-system
priority: P1
target_pr: User-approved scoped spacing release after required verification
created: 2026-10-20
source_docs:
  - docs/design/system/DESIGN.md
dependencies: []
---

# Size-Aware Semantic Icon Label Spacing

## Outcome And Scope

Apply the directly approved contract: displayed12px SVG with4px separation;
displayed16px SVG with6px separation for directly adjacent horizontal semantic
icon-label pairs. Preserve glyph size, text, font, control height, outer padding,
stroke/viewBox, handlers, permissions and data behavior.

Initial authorization covered local implementation and synthetic verification.
The user subsequently accepted this bounded spacing slice and explicitly
authorized commit, push, PR, and conditional main/Production delivery after
required current checks and matching Ready Preview. Reuse this approval for
routine synchronization within the same scope; do not ask again when its
conditions pass. Remote data, provider, dependency, environment and security
changes remain outside this authorization.
Use the isolated worktree based on49169bd448b58b656958e3442be998b977ebca75;
preserve primary WIP and any unrelated worktree changes.

## Ownership And Decisions

- Narrow Button size-aware recipe supports inherited16px/default and explicit
  size-4 overrides, retaining compact12px/4px and undecided-size behavior.
- Shared command/search content, menu/select leading content and confirmed
  feature metadata/warning/loading callers own their inner separation.
- Filter and Home status-heading icon-label groups isolate the semantic pair
  from counts. Home icon-only filtering selectors preserve its responsive mode.
- Default inline alerts preserve the20px slot and16px artwork; adjust slot gap
  so its2px inset plus4px gap yields6px. Custom/icon-box slots remain excluded.
- Independent trailing indicators, tiles,14/20/24px artwork and ambiguous
  dynamic layouts are not normalized. No universal SVG or parent-gap rule.

## Done Criteria And Verification

- Required known12/16 pairs satisfy the contract in focused actual mock callers
  and the existing Button IconUsage story, including compact explicit16px.
- Icon/font/height/padding and counts/trailing indicator layout remain unchanged.
- Changed-file lint, typecheck, docs references and diff checks pass.
- Record measured local results and unresolved candidates separately; do not
  claim exhaustive or deployed coverage. Primary path/hash manifest before and
  after lives in the external icon-audit/label-spacing artifact directory.

## Current Evidence

Static audit includes the existing representative shared/feature inventory and
the additional confirmed direct-pair audit. The additional10 confirmed direct
pairs were rechecked after the source patch with no remaining known mismatch.
Known 16px attachment read-failure status also changed 4px to 6px without changing
its 10px label or file glyph. Focused lint for that class-only change passed.
The shared queue state-heading now isolates its icon-label pair at 6px while
preserving the optional indicator's 8px separation and label-count gap of 6px.
Home personal search removes only its extra leading text padding; Home hospital
list state labels use 6px. The final personal-search trigger measurement passed.
The queue group (fixture403), empty hospital list and attachment-error state
remain source-only checks; no extra data or runtime setup was attempted.
The assignee dropdown retains its previous outer gap because its leading SVG
is hidden in the wide layout and its trailing disclosure is independent.

- Changed-file ESLint, typecheck, docs references (1075 documents) and diff check
  passed. The first typecheck found an unsupported Storybook TestingLibrary
  exact option; it was removed and the subsequent typecheck passed.
- Actual synthetic Home headings:16px glyph/6px label gap,4px count gap;
  icon-only filter remains32px with a visible16px glyph.
- Actual Home and shared queue searches include their1px input border and
  resolve to6px content separation after text-inset correction.
- Existing Button IconUsage story matrix: default16/6, compact12/4, compact
  explicit16/6, default explicit12/4 and large explicit12/4 all passed measured
  SVG-rectangle-to-text-Range checks.
- Actual chart: Order16/6; 좁게 보기, 차트 작성 완료 and 상세 오더12/4;
  담당자14/6 unchanged. All measured controls remain28px high with12px labels.
- Verification evidence is in the external label-spacing/implementation folder:
  verification.json and the synthetic button/Home/search/chart PNG captures.
  Dedicated local3218 and6008 servers were stopped; no live data was used.
- Primary WIP151/151 paths hash-matched before/after with zero new paths and
  unchanged primary HEAD. The isolated Next-generated AGENTS block was removed
  after the local servers stopped; no unrelated AGENTS change remains.

Undecided 14/20/24px families, identity tiles, independent trailing indicators,
custom inline-alert icon slots and unproven dynamic/custom CSS size forms remain
outside this bounded normalization. Customer navigation supplies a size-4 class,
but its shared descendant rule forces 14px; that owner remains unchanged under
the undecided 14px rule. No existing explicit important 16px semantic mismatch
was found in the bounded source audit; existing important 12px compact sites
already have 4px separation.

Local implementation and representative verification are complete with the
source-only limits above. The user approved scoped delivery on 2026-10-20.

## Authorized Release Plan

1. Keep the approved 23-file allowlist isolated from the primary checkout.
   Fetch main, synchronize only if required, and record the final candidate.
2. Run local secrets, docs, diff, full lint, typecheck and Production build;
   require the current automatic PR Release Check and exact-head Ready Preview.
   Reuse the recorded synthetic caller/Storybook evidence for unchanged code.
3. Capture the current Ready Production source/deployment as rollback evidence
   in the external release packet. Use expected-head-protected squash merge
   only after all conditions pass, without bypassing strict branch protection.
4. Verify origin/main and exact merged-source Ready Production at the existing
   alias. Probe /login and inspect only Home/chart toolbar geometry through an
   existing source-allowlisted synthetic workspace session. Do not read or
   capture clinical text or perform record/provider mutations.
5. Keep source-only fixture limits explicit. Stop for scope conflicts, failed
   or unknown required gates, unexpected deployment source, or data/security
   risk. No global settings/protection changes or paid resources are authorized.

A canceled automatic Preview may be rebuilt from the exact same source with
only that deployment's official Ignore Build Step option unchecked. Do not
change the project's global rule. Record final PR/head/merge/deployment,
smoke, rollback and primary-WIP hash evidence externally after delivery.
