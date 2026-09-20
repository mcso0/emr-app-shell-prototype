---
type: screen-implementation
title: "Plan/Order Table Body — Column, Density, and Resize Contract"
description: "Implementation contract for the Plan/Order table body column order, pinned area, Figma minimum widths, density-aware cells, transparent gutters, and onChange resizing."
status: in_progress
area: chart
related_work: [CHART-PR-031, CHART-PR-036, CHART-PR-038]
source_docs:
  - "docs/product/domain/plan-order-all-tab-legacy-column-contract.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/chart/CHART-PR-031-plan-order-legacy-column-contract-foundation.md"
  - "docs/work/chart/CHART-PR-036-plan-order-status-presentation.md"
figma_references:
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163188&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163225&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163228&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163191&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163196&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163295&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163452&m=dev"
  - "https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28441-163361&m=dev"
last_updated: "2026-09-20"
---

# Plan/Order Table Body Implementation

## Purpose and current status

Decision revision: `2026-09-20-decisions-4`. 승욱's latest decisions supersede
the earlier seven open proposals. Implementation is now in progress under
[CHART-PR-038](../../../../../work/chart/CHART-PR-038-plan-order-table-contract.md):
Luna 5.6 xhigh implements and the parent supervises with TDD. Code delivery through
PR, origin/main merge and deployment is authorized after verification. Remote DB
apply for the described optional-reason CHECK/RPC was subsequently approved and
completed. Local implementation, focused tests and build pass; the remote synthetic
transaction passes with zero fixture residue. PR/Preview/Production delivery is the
remaining phase. Exact evidence is recorded in CHART-PR-038. Neither release nor acceptance is
complete. The HTML is a local reading companion, not a pixel-perfect application
preview or persisted test record.

Target: **26 visible columns = 4 pinned + 22 scrolling**. The original measured
Figma has27; keep that source evidence in the appendix. Order 명's original170px
is superseded by initial180 / minimum160 / maximum400.

## Latest product decision register

| ID | 상태 | 결정 내용 |
|---|---|---|
| DEC-01 | 명칭 정정 반영 / 기존 부호 유지 | 컬럼명은 할인/할증 및 %. 금액과 비율 양방향 연동, 같은 조정값을 한 번만 적용. 기존 음수 할인·양수 할증 계산 유지. 캡처는 명칭만 참고하며 디자인은 미적용. |
| DEC-02 | 확정 | 할인/할증 사유는 자유 입력·optional. 할인/할증이 있어도 빈 사유 허용. 설정 목록 선택과 필수 검증을 제거하는 서버·SQL 변경도 준비 범위에 포함. |
| DEC-03 | 반영 방향 | 별도 단위 컬럼 삭제 → 목표26개(고정4+스크롤22). 필요한 값과 인풋에 해당 데이터의 단위를 표시. 임의 변환·dose/strength/dispense fallback 금지. |
| DEC-04 | 확정 | 업무 담당:24px avatar trigger + picker; 이름은 hover/focus로 제공. 미지정 기본 아이콘, 로딩/저장 상태, 실패 시 기존값, readonly에서는 picker 없음. |
| DEC-05 | 확정 | known ON/OFF만 switch; unknown은 Neutral400 `-` 및 데이터 없음 설명. 과세 readonly, 청구반영은 기존 편집 가능 조건 유지; saving 잠금/실패 복원. |
| DEC-06 | 확정 | Order 명 기본180 / 최소160 / 최대400px. 오른쪽 최소240px 확보, 불가능하면 전체 가로 스크롤로 전환(고정 해제). 너비는 화면 수명 동안 유지, 초기화180; 영구 저장 없음. |
| DEC-07 | 확정 | 현재 확정 여부 오름차순과 정렬 기능·아이콘 유지(시안 차이 기록). 총횟수 숫자 정렬 추가. 실제 정렬 가능한 헤더만 아이콘. resize는 sort로 전파하지 않음. |

### Corrected column meaning and calculation

The user corrected the labels to `할인/할증` (amount) and `%` (rate).
The attached screenshot is a naming reference ONLY: do not copy its typography,
spacing, colors, borders, sizes or other column labels. Preserve the existing
approved Figma geometry: amount114px, rate72px, and the26-column target.

Keep the existing signed additive calculation: negative means discount, positive
means surcharge. Amount and rate are two views of ONE adjustment, not two charges.
For a100,000원 base with billing reflection enabled:

| 할인/할증 | % | 총 청구금액 |
|---:|---:|---:|
| -10,000원 | -10% | 90,000원 |
| +10,000원 | +10% | 110,000원 |
| 0원 | 0% | 100,000원 |

Editing either view recomputes the other. Do not invert stored signs or migrate
existing values because of a label change. The former naming-related question is
closed; implementation verification remains outstanding.

## Scope and execution boundary

- Table header/body only; existing category tabs, toolbar, footer, surrounding
  chart and vertical scroll ownership remain unchanged.
- Implement UI/layout, existing shared components, linked amount/percent state and
  optional free-text reason end-to-end changes. Do not treat free text as a
  frontend-only change: existing API/core/SQL reason checks conflict with the target.
- Preserve IDs, set hierarchy, selection cohorts, confirmation/work lifecycle,
  workspace isolation, permission, revision/idempotency, audit and billing ownership.
- The owner has now authorized local implementation, TDD, commit, push, PR,
  origin/main merge and deployment after checks pass. Do not rewrite old
  migrations or publish a tunnel. The later remote approval covers only the
  described optional-reason CHECK/RPC and synthetic verification.
- Before local API/DB implementation, record the exact slice in the appropriate
  active work item; CHART-PR-031 is a historical documentation foundation, not
  blanket authorization for DB writes. Remote apply remains separately gated.
- The active checkout has overlapping user WIP in chart/API/domain/tests. Record
  scoped baseline hashes/diff and preserve it; do not clean/reset or copy only HEAD
  into an implementation worktree while silently dropping needed WIP.

## Visible column contract

Widths exclude the separate8px inter-column allocation. The first three columns
are fixed width. Order 명 is the explicit user override; other columns use measured
widths as initial/minimum. Body heights remain density-controlled.

| # | Column | Region | Width / alignment | Composition |
|---|---|---|---|---|
| 1 | `선택` | Pinned | 20px fixed; center/center | Header/body checkbox is 16×16; the 20px column contains 2px horizontal padding. Vertical size follows density. |
| 2 | `분류` | Pinned | 88px fixed; left/vertical-center | Body uses a 6px transparent leading spacer, 4px content gap, and an outline pill badge. |
| 3 | `확정 여부` | Pinned | 88px fixed; left/vertical-center | Body uses a 6px transparent leading spacer and the state badge. |
| 4 | `Order 명` | Pinned | 180px initial / 160px minimum / 400px maximum; left/vertical-center; single-line ellipsis | Boundary-resizable. User widths override Figma170. |
| 5 | `업무 상태` | Scroll | 88px initial/minimum; left/vertical-center | 6px leading spacer; unconfirmed `-`, confirmed 16px state icon plus label. First scrolling column. |
| 6 | `청구서명` | Scroll | 144px initial/minimum; left/vertical-center | 28px text input in editable states; 6px trailing transparent spacer in the Figma row. |
| 7 | `청구반영` | Scroll | 64px initial/minimum; left/vertical-center | 6px leading spacer plus Figma switch-only control; separate from final total. |
| 8 | `일수` | Scroll | 64px initial/minimum; right/vertical-center | Numeric value with 6px trailing transparent spacer. |
| 9 | `횟수` | Scroll | 64px initial/minimum; right/vertical-center | Frequency/count projection; numeric display is right-aligned. |
| 10 | `총횟수` | Scroll | 88px initial/minimum; right/vertical-center | Total occurrence projection; numeric display is right-aligned. |
| 11 | `head/kg당` | Scroll | 88px initial/minimum; right/vertical-center | Dose-basis projection; Figma sample is right-aligned. |
| 12 | `1회당` | Scroll | 64px initial/minimum; right/vertical-center | Dose-per-administration projection; numeric display is right-aligned. |
| 13 | `성분량` | Scroll | 88px initial/minimum; right/vertical-center for values | Ingredient strength/amount; the Figma row sample is right-aligned. |
| 14 | `조제량` | Scroll | 88px initial/minimum; right/vertical-center | Calculated dispensing quantity; Figma sample carries reduced-opacity header treatment. |
| 15 | `보관` | Scroll | 88px initial/minimum; left/vertical-center | Storage value is rendered as an outline/filled badge-style token. |
| 16 | `투여/복약` | Scroll | 114px initial/minimum; left/vertical-center | Route and medication instruction text, joined with the existing `·` composition. |
| 17 | `단가` | Scroll | 114px initial/minimum; right/vertical-center | Numeric unit price; right-aligned. |
| 18 | `수량` | Scroll | 65px initial/minimum; right/vertical-center | Numeric 28px input when editable; right-aligned value and tabular numerals. |
| 19 | `합계` | Scroll | 126px initial/minimum; right/vertical-center | Base line total, distinct from final billing total; right-aligned. |
| 20 | `할인/할증` | Scroll | 114px initial/minimum; right/vertical-center | Linked amount view of the same adjustment as %; 원 suffix. Corrected label; negative discount / positive surcharge. |
| 21 | `%` | Scroll | 72px initial/minimum; right/vertical-center | Linked percent view; updates amount from the same base, never cumulative. |
| 22 | `총 청구금액` | Scroll | 126px initial/minimum; right/vertical-center | Final billing amount; right-aligned and distinct from `합계`. |
| 23 | `할인/할증 사유` | Scroll | 126px initial/minimum; left/vertical-center | 28px free-text Input; optional, including nonzero adjustments; remove allowlist/required rejection across write paths. |
| 24 | `과세` | Scroll | 64px initial/minimum; left/vertical-center | Known values use read-only Switch; unknown uses - with 미설정 accessible explanation. |
| 25 | `업무 담당` | Scroll | 66px initial/minimum; left/vertical-center | 24px avatar trigger opens picker only when editable; retain current assignment route/readback. |
| 26 | `요청 수의사` | Scroll | 77px initial/minimum; left/vertical-center | Figma sample is also a 24px avatar with initials; requesting veterinarian is distinct from assignee. |

The standalone 단위 column is removed from both header and body, including its
separator allocation. Do not delete underlying unit data. Render the correct unit
beside the value or as a non-editable input suffix; units are excluded from numeric
parsing. Keep doseUnit with dose, strength ratio with ingredient strength, and
dispenseUnit with calculated dispense quantity. Do not convert or invent missing
units. Monetary suffix 원 and percent suffix % remain visible.

## Width and scroll contract

### Width model

Each visible column receives a minimum width measured from the referenced Figma
design. The explicitly fixed values are:

```ts
type PlanOrderColumnWidth = {
  id: string;
  figmaWidthPx: number;
  minSize: number;
  size: number;
};

const fixedWidths = {
  select: 20,
  category: 88,
  confirmation: 88,
} as const;
```

Required behavior:

- Scroll columns start at their Figma widths and use those widths as minimums.
- `Order 명` overrides the Figma170 source: `size:180`, `minSize:160`, `maxSize:400`.
- For fixed-region overhead F=232px and boundary allocation B, the pinned
  order width must satisfy `width <= min(400, viewportWidth - F - B - 240)`.
  If that cap is below160, unpin the table and allow whole-table horizontal
  scrolling. Restore pinning when the minimum fit returns, clamping the
  retained width to the available cap. Reuse the existing horizontal owner.
- Initial/reset width is180px; retain sizing only in the mounted screen state.
  No localStorage/server persistence. Place reset in the existing header sizing
  affordance; do not add an out-of-scope toolbar redesign.
- The fixed span is408px initially,388px at minimum,628px at maximum,
  including the terminal 8px boundary allocation. There is no leading inset:
  its first four starts are0,28,124,220 and Order 명's visible content ends at
  400px; the divider/resize boundary is at408px. This keeps horizontally
  scrolled columns from bleeding into the fixed area.
- The `Plan/Order` title, classification tab list, and selection checkbox share
  the same left edge: 10px from the panel's content edge. The table remains
  full-bleed; an 8px transparent leading gap precedes the logical 20px
  selection-control area, whose checkbox keeps its internal 2px inset.
- `분류`, `확정 여부`, and `선택` do not have direct resize handles.
- `Order 명` is resized only through the fixed/scroll boundary. Dragging that
  boundary changes `Order 명` width, not the other pinned columns.
- Resizable scroll columns use their header Grab and the shared table sizing
  mechanism.
- Keep four columns pinned while minimum fixed content + boundary +240px
  scroll viewport fits; use the accepted narrow-viewport unpin fallback otherwise.
- Let the existing horizontal scroll owner absorb overflow.
- Do not replace the current bounded table viewport with a feature-local
  `ScrollArea` or an additional vertical scroll owner.
- Keep header and body column starts aligned after horizontal scroll, column
  resize, density changes, and panel resize.

The Figma-referenced outer width is the sizing reference. The 8px Grab or
transparent gutter allocation must not be accidentally counted twice: preserve
one shared column-width calculation for header and body. The implementation
must record the measured Figma width for every scroll column before code changes.

### Optional resize configuration

Resize is a table capability, not a requirement for every data table. Use the
existing shared table configuration with a feature-local opt-in equivalent to:

```ts
type ColumnResizeConfig = {
  enabled: boolean;
  mode: "onChange";
};

type PlanOrderColumnMeta = {
  resize: "none" | "data-column" | "pinned-order-boundary";
};
```

Plan/Order enables the capability. Its metadata is:

- `선택`, `분류`, `확정 여부`: `resize: "none"`.
- `Order 명`: `resize: "pinned-order-boundary"`.
- Scrollable data columns with an approved Figma width: `resize:
  "data-column"`.

Other tables leave `enabled` false unless they explicitly opt in. The body
8px gutter is part of this same table-level geometry contract and should not be
introduced for a table with resizing disabled unless its own design requires
the spacing.

## Density and cell presentation contract

The current table already provides narrow, default, and wide spacing choices.
Reuse those choices as the source of vertical cell height. Do not introduce
new row-height values or a second density state for this work.

| Density | Korean UI | Body row | Header |
|---|---|---:|---:|
| `compact` | 좁은 간격 | 36px | 36px |
| `standard` | 기본 간격 | 40px | 36px |
| `comfortable` | 넓은 간격 | 52px | 44px |

These are the applied `[data-emr-data-table="true"]` CSS overrides in
`src/app/globals.css`. The linked general density document and foundation tokens
instead list standard 44px/40px; do not use those generic defaults for this table.
Verify computed sizes against these existing table overrides during implementation.

- `선택` keeps a 20px horizontal width in the header and body. Its checkbox is
  centered in both axes inside the active header or row height.
- `분류` keeps an 88px horizontal width. Its content is left-aligned and
  vertically centered.
- `확정 여부` keeps an 88px horizontal width. Its status presentation is
  left-aligned and vertically centered; the cell stretches with the active row
  density rather than forcing a separate fixed height. The Figma reference
  shows the status component's 88px-wide geometry and centered vertical layout.
- `Order 명` is left-aligned, vertically centered, single-line, and truncated
  with an ellipsis until its width is increased through the boundary Grab.
- The 8px inter-column space is transparent. It is not a cell background, a
  divider, or an interactive control.

## Grab, gutter, and boundary contract

### Fixed-area internal gaps

Between `선택`, `분류`, `확정 여부`, and `Order 명`, both header and body use an
8px transparent gap. These gaps have:

- no vertical divider;
- no Grab;
- no pointer resize interaction;
- no sorting or other click interaction.

### Fixed/scroll boundary

The boundary after `Order 명` is the one exception inside the pinned area:

- the header and body share a 1px vertical boundary line at the fixed/scroll edge;
- the resize hit area remains an invisible 8px header-only handle on the `Order 명` edge;
- dragging it changes only the `Order 명` width;
- the resize updates live with `columnResizeMode: "onChange"`;
- the body line is visual only and has no resize control; the transparent 8px
  spacing remains part of the boundary allocation.

### Scrollable columns

For a resizable scroll column:

```text
Header: [header content][8px Grab]
Body:   [cell content][8px transparent gutter]
```

Rules:

- The Grab is the header resize hit area at the approved column boundary.
- `td` cells never contain a second resize control or duplicate Grab icon.
- No extra vertical divider is rendered in the body gutter.
- The body gap does not shift following columns relative to the header.
- A header label click may sort according to the existing table contract.
- A Grab pointer-down/drag must stop propagation to sorting and perform resize
  only.
- Keep the existing shared keyboard-resize behavior.

### Grab states and tokens

- Normal state: scroll-column headers retain the subtle visible Grab treatment
  from the Figma source. The pinned `Order 명` boundary uses the line above and
  hides the Grab stroke while preserving its hit area.
- Hover/focus state: use the design token `blackAlpha/6`.
- Dragging/active state: use the design token `blackAlpha/8`.
- Use the repository's existing semantic token names or token aliases for
  these values; do not introduce local hard-coded rgba/hex values.
- Do not substitute the generic `--emr-state-hover` token if it resolves to a
  different alpha value.

### Follow-up corrections applied during implementation

- `업무 상태` is resizable from its 88px minimum; the former `maxSize: 88px`
  was preventing the existing header handle from changing the column width.
- Every editable table input/select uses the available cell width and grows with
  its column. The approved insets remain: `청구서명` keeps a trailing 6px,
  `수량` keeps its leading 10px, and suffix inputs keep their unit suffix.
- `청구반영` and `과세` headers and row switches are centered on both axes.
- Empty display values use ASCII `-` with Neutral400 styling. Meaningful domain
  values such as `계산 불가` remain unchanged; the empty-state explanation is
  available through the accessible label/tooltip.
- The pinned viewport's horizontal scrollbar starts after the terminal 8px
  fixed-area gap, so it cannot paint over the pinned checkbox/fixed cells.


### Shared typography and spacing primitives

- Header labels use Pretendard Medium 12px, line-height 16px, letter-spacing
  0.3px (`label/2`), with `neutral/500` text. Sortable headers wrap the label
  in the existing transparent button treatment, with 8px horizontal padding,
  4px vertical padding, a 4px content gap, and a 12px sort icon.
- Standard body text uses Pretendard Medium 14px, line-height 20px,
  letter-spacing 0.196px (`body/3/normal`), normally `neutral/700` in the
  Figma samples. Numeric values use right alignment and tabular numerals in
  the application layer.
- A Figma `spacing` primitive is transparent, 6px wide, and 24px high. It is
  used at the leading edge of most body cells and at the trailing edge of
  right-aligned numeric cells. It is not a divider and has no hit target.
- Body badges use a 12px label, line-height 16px, letter-spacing 0.3px,
  horizontal padding 8px, vertical padding 3px, and a 2px internal gap.
- The table row and header remain density-controlled. The Figma 40px body
  and 36px header are the standard-density reference only.


## `업무 상태` presentation contract

The `업무 상태` cell keeps the existing lifecycle projection. This section adds
the Figma visual details for the two display states; it does not change the
confirmation, work-item, cancellation, or billing rules.

### Before order confirmation

When the selected order is not confirmed yet, render the cell as a muted `-`:

- Text: literal ASCII hyphen `-`, not the longer em dash `—` from the older
  accessibility copy or domain contract.
- Color: Figma `neutral/400`, mapped in this repository to
  `var(--clair-color-atomic-neutral-400)`.
- Alignment: left-aligned and vertically centered in the density-controlled
  row height.
- Typography: Pretendard Medium, 14px, line-height 20px, letter-spacing
  0.196px (the Figma `body/3/normal` style).
- Leading spacing: a transparent 6px-wide by 24px-high `spacing` element.
- Outer content gap: 4px between the leading spacing element and the text
  container.
- Text container: horizontal padding 2px; retain the Figma 6px internal gap
  contract even though this state contains only the text node.
- Keep the existing keyboard-focus and hover explanation that the work status
  appears after confirmation; visual text is the Figma `-`.

The Figma node structure is effectively:

```text
Column: items-center, gap 4px
  spacing: transparent, 6px × 24px
  text: horizontal padding 2px, text `-`
```

### After order confirmation

When a confirmed order has a downstream work status, render the existing state
icon and the domain label together:

- Icon: existing `EmrSidePanelStateIcon`, rendered at 16px × 16px; keep the
  existing explicit status-to-icon mapping rather than selecting an icon from
  an unknown label.
- Label: existing domain label such as `대기중`, `진행중`, `조제중`, `처치중`,
  `완료`, `취소`, or `반려`, according to the current presentation projection.
- Text color: Figma `neutral/900`, mapped to
  `var(--clair-color-atomic-neutral-900)` for the normal confirmed state.
- Alignment: the complete icon/text group is left-aligned and vertically
  centered in the density-controlled row height.
- Typography: same Pretendard Medium 14px, line-height 20px, and 0.196px
  letter-spacing as the unconfirmed state.
- Spacing: retain the same transparent 6px × 24px leading spacing element;
  use a 4px outer gap before the 16px icon and a **4px icon-to-label gap**.
  Node `28441:163452` places the icon at x10 and the label at x30. The
  text wrapper internal gap6 is not the icon-to-label distance.

The Figma node structure is effectively:

```text
Column: items-center, gap 4px
  spacing: transparent, 6px × 24px
  stateIcon: existing icon, 16px × 16px
  text: gap 6px, existing domain label
```

If a confirmed order has no downstream work item, or if cancellation takes
precedence under the existing domain projection, preserve the current fallback
and cancellation rules. This visual contract does not create a work item or
change the source status.


## Editable state and linked-value contract

- One adjustment, two synchronized views; the most recently edited valid field
  determines calculation source (`amount` or `percent`). Never add both results.
- Preserve the active input's in-progress text (empty, minus sign, decimal point)
  rather than overwriting it on every keystroke. Recompute the companion on valid
  input and persist through the existing guarded save boundary.
- Amount is integer KRW. Percent finite numeric, display precision inherited
  (currently max2 decimals); server source/rounding remains authoritative.
  Source switching must not save a rounded display value as a new user edit.
- Base0 must never produce Infinity/NaN. Exact undefined-percent presentation and
  fractional KRW test expectations belong in the implementation test matrix before
  enabling the linked editor; do not silently reinterpret old adjustments.
- Reason is free text and optional. Blank/whitespace means no reason; removing an
  existing reason must be possible even with a nonzero adjustment. Reason-only
  edits must not clear amount/percent/source. Clearing adjustment must not silently
  erase a voluntarily entered reason. Preserve text-safe rendering and existing
  length/schema safeguards unless specifically changed in the reviewed slice.
- Remove configured-reason allowlist and nonzero-reason-required rejection in all
  authoritative write paths, not only the Input. Keep unrelated price, lifecycle,
  nonnegative-final-charge, permission and revision checks.
- Draft billingName/quantity and candidate overrides retain their distinct commit
  paths. Keep invalid local drafts, existing error feedback, reload/conflict and
  authoritative billing-summary checks; do not claim successful synchronization
  after failed readback.
- Assignee uses24px avatar + picker in66px. Default icon for unassigned; reveal name
  on hover/focus; pending states prevent duplicate writes. Read-only cells are not
  interactive. Preserve existing persisted-draft prerequisite and ACK/readback logic.
- Known billing reflection/tax values use switch-only UI with accessible names.
  Unknown uses `-` and 미설정 description, never false. Tax is read-only; billing
  reflection remains gated by its current candidate predicate. Save locks and
  failure restoration remain.
- Keep confirmation ascending as default and show its sortable affordance despite
  Figma lacking its icon. Add numeric totalOccurrences sorting. Missing values,
  tie stability and set-child grouping must match existing comparator conventions.
  Icons must correspond to implemented sort actions.

### Presentation sources by column

| Column | Current source/derivation | State rules |
|---|---|---|
| `선택` | TanStack row-selection state keyed by `order.id` | Preserve the existing draft/confirmed selection cohort rule, disabled rows, set-child exclusion, and select-all behavior. |
| `분류` | `getChartOrderClinicalType(row)` plus clinical schema label; set/set-child handling remains explicit | Label changes with clinical type/set row semantics, not with the badge styling. |
| `확정 여부` | `getChartOrderConfirmationState(row, invalidOrderIds)` | `ready`/`invalid`/`confirmed` remains domain-derived; opening detail remains the existing action. |
| `Order 명` | `row.order.displayName` | Set parent/child emphasis and inclusion state remain; only width/overflow changes. |
| `업무 상태` | `getChartOrderWorkPresentation(row)` | Unconfirmed renders the Figma `-`; confirmed renders the existing lifecycle icon/label; cancellation and no-task fallbacks remain. |
| `청구서명` | `row.billingName`, applied/prebilling override | Unconfirmed draft uses `onUpdateBillingName`; confirmed candidate uses prebilling override only when the current editable predicate allows it. |
| `청구반영` | `runtimeRow.billingReflectionEnabled` or applied snapshot | The switch is editable only under the current prebilling predicate; save the boolean override, then reconcile authoritative readback. |
| `일수` | `detailInputs.durationDays` | Numeric field schema controls validation/editability; empty is represented by the existing empty-value policy. |
| `횟수` | `detailInputs.frequency` or `occurrenceCount` fallback | Display label uses the existing field option map; do not persist a display label in place of the domain key. |
| `총횟수` | Explicit `totalOccurrences`/`maximumAuthorizedCount`, otherwise `durationDays × frequency count` | Derived only when both inputs are valid; no invented value when inputs are absent. |
| `head/kg당` | `detailInputs.doseBasis` mapped from `patient` to `head` | Keep configured basis semantics; do not treat the label as a unit conversion. |
| `1회당` | `detailInputs.dose` and `detailInputs.doseUnit` | Numeric dose remains validated by the clinical field schema; unit is displayed with the value. |
| `성분량` | `getChartOrderAuthority(row).productStrength` | Read from the applied plan/order authority; empty when no valid authority is available. |
| `조제량` | `calculationOutputs.calculatedDispenseQuantity` or theoretical quantity plus authority dispense unit | Preserve `계산 불가`, not-applicable, precision, and confirmed/unconfirmed states. |
| `보관` | `detailInputs.storageMethod` mapped through field option labels | Display only configured options; edit through the existing clinical field schema when allowed. |
| `투여/복약` | `detailInputs.route` plus `medicationInstruction` | Existing option label mapping and ` · ` join are preserved. |
| `단가` | `row.unitPrice`, seeded from invoice line or runtime `unitPriceSnapshot` | Read-only in this table slice unless a later approved contract adds an edit route. |
| `수량` | `row.quantityInput` and `getDraftQuantity` | Draft quantity uses `onUpdateQuantity`; confirmed prebilling quantity uses the prebilling override path; invalid/zero values remain blocked. |
| `합계` | `getDraftLineTotal(row)` | Uses fixed-order-price authority or `quantity × unitPrice`; unknown inputs remain empty rather than fabricated. |
| `할인/할증` | Existing signed `preBillingOverride.adjustmentAmountKrw` | Linked amount/percent target; preserve existing signed additive semantics: negative discount / positive surcharge. |
| `%` | `preBillingOverride.adjustmentPercent`, or derived amount/base percentage | Finite decimal input; percent and amount are alternate override sources, not two independent adjustments. |
| `총 청구금액` | `getChartOrderChargeAmount(row)` | If billing reflection is not `반영`, charge is zero; otherwise base total plus adjustment, clamped to non-negative. |
| `할인/할증 사유` | `preBillingOverride.adjustmentReason` | Target is OPTIONAL FREE TEXT. Existing runtime reason options/required validation are no longer target constraints. |
| `과세` | `planOrderAuthority.taxClass`, legacy `appliedSnapshot.taxIncluded` fallback | Read-only; known ON/OFF, unknown `-` with 미설정 explanation. |
| `업무 담당` | `executionTask.assignedToUserId` or `runtimeRow.intendedAssigneeUserId` | Avatar trigger in66px; retain picker loading, versioned save, conflict and readback behavior. |
| `요청 수의사` | `row.order.requestedByUserId` through `getChartStaffName` | Render the resolved staff identity as the Figma avatar/initials treatment; retain `미기록` fallback semantics. |


## Supervised implementation preparation

- Supervisor/integration/review: current parent (루멘); preserve parent model.
- Requested implementer: `gpt-5.6-luna`, `xhigh`; one bounded worker at a time
  for overlapping chart files. Actual worker was started with these controls for
  READ-ONLY impact preparation, not app implementation.
- Jev: rank compact non-sensitive context, then final checkpoint AFTER deterministic
  checks. It is an advisory coprocessor, not an approval gate or replacement model.
- No separate sidebar task is created. Worker receives explicit file ownership,
  WIP boundaries, source docs, acceptance criteria and required tests.

| Slice | Worker ownership to assign | Supervisor exit check |
|---|---|---|
| A — geometry / units / sorting | Feature-local columns, necessary shared table geometry and focused tests | 26 columns;180/160/400;4 fixed/22 scroll; density; narrow fallback; no shared consumer regression |
| B — component presentation | Existing Switch/Input/status/identity usage and focused stories/tests | Known/unknown/readonly; exact inset and suffix; avatar loading/save/errors; accessibility |
| C — linked adjustment / optional reason | Chart editor, route/core and NEW migration if required, focused domain/server tests | Signed linkage preserved; arbitrary/empty reason accepted; paired views; source switch/rounding/zero-base; audit/version guards |
| D — integration | Supervisor reviews bounded patches and runs relevant checks | No WIP loss; no API/DB mismatch; report local vs remote evidence separately |

DEC-01 naming clarification is closed. Do not dispatch broad concurrent edits to module.tsx. Storybook
component documentation should be queried through local clair_storybook when
available; do not invent props or expose Storybook externally.

### Acceptance and verification plan

- MD/HTML target names/order/widths:26; source measurement appendix:27 clearly
  labeled historical source. Seven decision IDs remain traceable, not seven open.
- Default pinned starts0/28/124/220 and boundary span408, min388/max628.
  The table starts at the viewport's left edge; the terminal 8px boundary
  allocation is included once and scroll content is clipped behind the pinned
  span.
  Scroll target widths sum1992;22 columns have21 internal8px gaps. Leading/source
  boundary allocation must be measured once, not counted twice.
- Header/body same grid widths through resize, density and scroll start/middle/end.
  No controls/lines in fixed internal8px gaps or body gutters.
- Checkbox20px column/16px control center on both axes; fixed category/status88px
  left/vertical center. Row/header36/36,40/36,52/44.
- Minimum remaining scroll240px; constrained cap and unpin/re-pin fallback;
  reset180; no persistence; pointer/keyboard resize never sorts/selects rows.
- Numeric units/suffixes excluded from parsing; no standalone unit column.
- Linked amounts100,000↔10,000↔10%, source switching, fractions,0 base, empty and
  invalid input, min/max and locale formatting; negative-discount and positive-surcharge scenarios above.
- Arbitrary optional reason with nonzero adjustment, blank clear, reason-only save,
  text rendering/length, permission denial, foreign workspace, revision conflict,
  retry/idempotency, ACK/readback failure and billing-summary refresh.
- Confirmation/default sort, totalOccurrences numeric sort, missing/tied values,
  set grouping, selection/detail interactions.
- Run docs:check and HTML structure/JS/parity checks now. Typecheck and focused UI/
  server/domain tests belong to the implementation slices; remote migrations and
  authenticated live smoke are not proved by local tests.

### Preparation evidence

Luna xhigh read-only preparation completed; no files or remote state changed and no app tests were run. Parent inspected the reason validator and SQL CHECK evidence. The following paths are implementation owners, not a statement that fixes are already applied.

| 범위 | 근거 / 변경 지점 | 준비 내용 |
|---|---|---|
| UI / linked editor | src/features/chart/module.tsx:7393–7592 | 연동 금액·비율과 optional 자유 사유 Input. 사유 단독 변경·공란 저장·조정 변경 시 사유 보존을 함께 테스트. |
| API / server core | src/app/api/workspaces/[workspaceId]/chart/order-prebilling-overrides/route.ts:34–90; src/features/chart/server-order-prebilling-override-core.ts:267–299 | 현재 whitespace는 normalize 전에 거절됨. blank→null 허용, 타입 안전 검증 유지. workspace/permission/CAS/idempotency 유지. |
| DB CHECK + RPC | supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql:799–826,2501–2818 | 기존 파일 수정 금지. 새 migration에서 사유 필수 CHECK와 RPC required/allowlist 조건 제거. nullable text 컬럼은 이미 존재. 정확한 제약명은 구현 시 catalog 검증. |
| 계산 일관성 | src/features/chart/plan-order-authority-domain.ts:612–647,969 | 0 base 파생 비율은 현재0. 음수 half rounding 및 SQL/UI/mock 차이를 테스트해 서버 권위와 일치시킬 것. 표시2자리와 입력 정밀도 혼동 금지. |
| UI 회귀 | tests/chart.spec.ts; tests/chart-order-table-density.spec.ts; tests/order-intended-assignee-server.spec.ts | 기존 폭·핀·resize·sort/density 테스트 갱신. avatar picker의 전용 UI 회귀 테스트 추가 필요. |
| WIP | src/features/chart/module.tsx; tests/chart.spec.ts; tests/chart-order-table-presentation.spec.ts | 앞의 두 파일은 수정 중, 마지막은 untracked. 기존 변경 보존 및 작업 전 기준 diff/hash 기록. 원격 적용·실제 저장 테스트는 이번에 하지 않음. |

Focused commands for future implementation (not executed in this preparation):

```bash
npx playwright test tests/plan-order-prebilling-override.spec.ts tests/plan-order-authority-domain.spec.ts
npx playwright test tests/order-intended-assignee-server.spec.ts
npx playwright test tests/chart-order-table-density.spec.ts
npx playwright test tests/chart.spec.ts -g 'chart Plan/Order keeps|chart Order all tab|chart grab divider|chart order table supports single sort'
```

Database migration must preserve membership, permissions, candidate/order checks,
advisory lock, CAS, idempotency replay/conflict, immutable versions and audit events.
The existing adjustment_reasons settings may remain for compatibility but must no
longer constrain free-text row reasons. Do not query/change real records to test it.
Migration/rollback tests must run in a scoped synthetic environment before any
separately authorized remote apply.

Documentation validation: docs:check and target26/source27 parity, width sums,
HTML inline script, anchor/frontmatter/whitespace checks passed. This revision's
file-URL browser verification was blocked by browser policy; rendered geometry is
not claimed verified. Jev ranked current decisions/artifacts ahead of historical
measurements and flagged residual preparation risk; supervisor traced and recorded
the DB CHECK, rounding, zero-base and WIP risks above.



## Source evidence appendix — historical Figma and current-code baseline

The following is SOURCE EVIDENCE, not the latest target. Original Figma has27
columns including 단위 and Order 명170. Current code requires configured reasons;
the approved target above deliberately changes those behaviors. Retain node IDs
and measurements for traceability. Product decisions in the latest register win.

### 2026-09-20 재조사: 근거와 좌표 정의

27개 컬럼의 헤더·첫 body instance를 Figma API로 직접 재측정했다. 아래 x는 각 셀 왼쪽 기준이며, 너비는 컬럼 프레임 자체 값이다. 컬럼 간 8px은 이 너비 바깥이다. 텍스트 우측 inset은 셀 오른쪽부터 텍스트까지의 거리다. 배지 폭은 예시 라벨에 따른 관측값이며 고정값으로 구현하지 않는다.

측정은 Figma 시안과 현재 로컬 소스 조사다. 앱 수정·배포·실제 저장 테스트를 완료했다는 뜻이 아니다. MD가 원본이고 HTML은 현재 목표와 원본 측정을 구분하는 읽기용 가이드다.

### 27개 컬럼: 노드·최소 폭·정렬·실제 안쪽 여백
| 컬럼 | 헤더 / body 노드 (28441:) | 폭 px | 헤더 / body 정렬 | 시안 정렬 아이콘 | body 내부 측정 |
| --- | --- | --- | --- | --- | --- |
| 선택 | 163191 / 163196 | 20 고정 | 중앙 / 중앙 | 없음 | 체크박스 x2 / 16×16, 셀 20px 중앙 |
| 분류 | 163192 / 163197 | 88 고정 | 왼쪽 / 왼쪽 | 있음 | Badge x10 / 59×22; 라벨 x18 |
| 확정 여부 | 163193 / 163198 | 88 고정 | 왼쪽 / 왼쪽 | 없음 | Badge x10 / 48×22; 라벨 x18 |
| Order 명 | 163194 / 163199 | 170 최소 | 왼쪽 / 왼쪽 | 있음 | 텍스트 x10; 한 줄 말줄임 |
| 업무 상태 | 163227 / 163295 | 88 최소 | 왼쪽 / 왼쪽 | 있음 | - x12 (6+4+2); 확정 아이콘 x10 / 라벨 x30 |
| 청구서명 | 163230 / 163298 | 144 최소 | 왼쪽 / 왼쪽 | 있음 | Input x0 / 138×28; px10; 오른쪽 빈 영역 6 |
| 청구반영 | 163233 / 163301 | 64 최소 | 중앙 / 중앙 | 없음 | Switch 32×18, header/body center |
| 일수 | 163236 / 163304 | 64 최소 | 오른쪽 / 오른쪽 | 없음 | 오른쪽 10 (gap4+spacer6) |
| 횟수 | 163239 / 163307 | 64 최소 | 오른쪽 / 오른쪽 | 없음 | 오른쪽 10 (gap4+spacer6) |
| 총횟수 | 163242 / 163310 | 88 최소 | 오른쪽 / 오른쪽 | 있음 | 오른쪽 10 (gap4+spacer6) |
| head/kg당 | 163245 / 163313 | 88 최소 | 오른쪽 / 오른쪽 | 없음 | 오른쪽 10; 예시 숫자는 도메인 값이 아님 |
| 1회당 | 163248 / 163316 | 64 최소 | 오른쪽 / 오른쪽 | 없음 | 오른쪽 10; 기존 dose+unit |
| 성분량 | 163251 / 163319 | 88 최소 | 오른쪽 / 오른쪽 | 없음 | 오른쪽 10; 기존 성분량 비율 |
| 단위 | 163254 / 163322 | 88 최소 | 왼쪽 / 왼쪽 | 없음 | 텍스트 x10; 원본 전용(목표에서 컬럼 삭제) |
| 조제량 | 163257 / 163325 | 88 최소 | 오른쪽 / 오른쪽 | 없음 | 오른쪽 10; 헤더 opacity 0.88 / body 1 |
| 보관 | 163260 / 163328 | 88 최소 | 왼쪽 / 왼쪽 | 없음 | Badge x10 / 38×22; blackAlpha/4 |
| 투여/복약 | 163263 / 163331 | 114 최소 | 왼쪽 / 왼쪽 | 없음 | 텍스트 x10 |
| 단가 | 163266 / 163334 | 114 최소 | 오른쪽 / 오른쪽 | 있음 | 오른쪽 10; 원 표시 |
| 수량 | 163269 / 163337 | 65 최소 | 오른쪽 / 오른쪽 | 있음 | Input x10 / 55×28; px10; 선행 6+4 |
| 합계 | 163272 / 163340 | 126 최소 | 오른쪽 / 오른쪽 | 있음 | 오른쪽 10; 원 표시 |
| 할인 금액 | 163275 / 163343 | 114 최소 | 오른쪽 / 오른쪽 | 없음 | Input x10 / 104×28; px10; 숫자↔원 gap4 |
| 할증(%) | 163278 / 163346 | 72 최소 | 오른쪽 / 오른쪽 | 없음 | Input x10 / 62×28; px10; 숫자↔% gap4 |
| 총 청구금액 | 163281 / 163349 | 126 최소 | 오른쪽 / 오른쪽 | 있음 | 오른쪽 10; 원 표시 |
| 할인/할증 사유 | 163284 / 163352 | 126 최소 | 왼쪽 / 왼쪽 | 없음 | Input x0 / 126×28; px10; 외부 spacer 없음 |
| 과세 | 163287 / 163355 | 64 최소 | 중앙 / 중앙 | 없음 | Switch 32×18, header/body center |
| 업무 담당 | 163290 / 163358 | 66 최소 | 왼쪽 / 왼쪽 | 없음 | Avatar x10 / 24×24 |
| 요청 수의사 | 163293 / 163361 | 77 최소 | 왼쪽 / 왼쪽 | 없음 | Avatar x10 / 24×24 |

선택 체크박스는 선행 투명 여백 8px 뒤의 논리적 20px 영역에서 가로·세로 중앙 정렬하며, 그 왼쪽 외곽선은 Plan/Order 제목·분류 탭 그룹과 일치한다. 나머지 셀은 세로 중앙. 헤더 Button은 px8 + 내부 wrapper px2라 왼쪽 라벨 inset이 10px이다. 오른쪽 정렬 헤더는 버튼 그룹이 우측으로 붙으며 아이콘이 없으면 라벨 오른쪽 10px, 아이콘이 있으면 라벨 오른쪽 26px(아이콘12+gap4+10)이다.

body wrapper는 선택만 선행 gap8 + 내부 px2이며 나머지는 px0. 대부분 spacer6 + gap4로 콘텐츠 시작 또는 끝 여백이 10px이다. 청구서명은 gap0이며 Input138 + trailing6, 수량·할인·할증은 선행6+4 뒤 Input이므로 단순한 공통 trailing padding 규칙으로 구현하면 틀린다.

조제량 헤더 instance만 opacity 0.88이고 body는 1이다. 시안에 조건부 비활성화 의미는 명시되어 있지 않으므로 opacity로 편집 가능 여부를 판단하지 않는다. head/kg당의 88, 단위의 mmlg/lg 등 예시 문자열은 유효 임상 데이터나 단위 정의로 채택하지 않는다.

### 프레임 너비와 오버레이를 분리
| 항목 | 실측 / 합의 | 구현 시 의미 |
| --- | --- | --- |
| 원본 고정 영역 | 394px; 셀 시작 x12,32,128,224 | 원본은 선택–분류 사이 8px이 없음 |
| 이전 합의 고정 영역 (최신 너비 전) | 이전402px; 최신 목표는 기본408 / 최소388 / 최대628 | 선행 인셋 없음. 내부 3개 간격과 터미널 8px 경계 할당은 투명하며, 디바이더는 고정–스크롤 경계에만 표시 |
| 스크롤 컬럼 흐름 | 너비 합2080 + 22×8 + 선행10 = 2266px | 마지막 요청 수의사 x2189 +77 =2266 |
| 원본 스크롤 프레임 | 2317px | 남은51px은 빈 패딩이라고 추정하면 안 됨 |
| 원본 action overlay | 28441:163362, ABSOLUTE, x2203 / w114 / 끝2317 | 요청 수의사 영역과 겹치는 별도 오버레이. 내부 24px 버튼3개, px20/10, gap6. 28번째 컬럼이 아님 |
| 고정–스크롤 경계 | Order 명 resize handle 유지, 8px | 스크롤 원본 선행10과 경계8의 포함 관계는 적용 시 좌표 검증 필요. 임의로 둘을 합쳐18px로 만들지 않음 |

원본 구조 근거: 고정 frame 28441:163189, scroll frame 28441:163225, 행 28441:163195 / 163294. action overlay의 기존 기능·표시 조건은 변경 범위 밖이지만 끝 컬럼을 가리지 않는지 검증한다.

### 컴포넌트 상태: 관측값과 미제공 상태
| 컴포넌트 / 상태 | 확인한 시안 값 | 근거 / 적용 주의 |
| --- | --- | --- |
| 분류 Badge | h22, px8 py3, gap2, r9999, border1 blackAlpha/8, white, neutral/600 | 163197; 12/16 Pretendard Medium, spacing0.3 |
| 확정 여부 Badge | h22 r6 px8 py3 gap2; 미확정 gray/50·100·600, 미입력 orange/50·100·600, 확정 green/50·100·600 | 163198 / 163203 / 163208; 순서: 배경·테두리·텍스트 |
| 보관 Badge | h22 r6 px8 py3 gap2; blackAlpha/4 배경, visible border 없음, neutral/900 | 163328; secondary variant. 분류 outline과 다름 |
| Input 공통 | h28 r8 border1, target px10 py4, 12/16 value neutral/800 | set 27344:11196. base sm의 px8을 복사하지 말고 target instance px10 유지 |
| Input 기본/placeholder | white, neutral/200 border; placeholder neutral/500 | 27357:15 / 19 / 29 |
| Input focus | neutral/400 border; neutral/300, spread3, offset0 blur0 focus ring | 27357:39 |
| Input invalid / invalid-focus | red/600 border; red/200 at20%, spread3, offset0 blur0 ring | 27357:49 / 59 |
| Input disabled | neutral/100 배경, neutral/200 border, neutral/400 text, opacity1 | 27357:69; 전체 opacity50% 처리 아님 |
| Input 접미사 | 할인 금액 원, 할증 %: 값과 별도 텍스트, gap4 | 163343 get_design_context와 screenshot으로 원 확인. 원은 paragraph mini/regular 12/16 neutral/600; 숫자 파싱에서 제외 |
| Input hover / read-only | 검사한 component set에 전용 variant 없음 | 임의의 Figma 값 생성 금지. 기존 접근성·read-only 표시를 유지하며 필요 시 디자인 결정 |
| Switch Off / On | track32×18 r9999, border없음; Off neutral/300, On neutral/900; thumb16 white | 27807:80702 / 80710; thumb x1→15, y1, 이동14 |
| Switch hover | track 색 유지; thumb shadow: 0 1px 3px 0 black10%, 0 1px 2px -1px black10% | 27807:81824 / 81832 |
| Switch focus / disabled | 검사한 set에 전용 variant 없음; 현재 공유 Switch는 최소40×40 hit area | focus/keyboard/disabled semantics 보존. 64px 열에서 인접 클릭 간섭과 border·thumb margin 실제 좌표 검증 |
| Avatar | 24×24 circle, neutral/100, border1 blackAlpha/6; initials10/14 Medium general/foreground | 163358 / 163361; small PictureOff 27290:111189 / PictureOn 27290:111197. loading/error 전용 variant 없음 |
| 업무 상태 | 미확정 - x12 neutral/400; 확정 icon16 x10, label x30 neutral/900 | 163295 / 163452. 아이콘–라벨 gap4; 내부 text wrapper gap6과 혼동 금지 |
| Grab | 8×22 hit frame; 중앙 stroke1×14, x3.5 y4 neutral/300 | 163228 / 163229. 스크롤 헤더는 visible Grab, 고정 경계는 1px header/body line + invisible header-only hit area. hover blackAlpha/6, drag blackAlpha/8은 사용자 합의. 고정 내부 gap과 scroll body gutter에는 선 없음 |

공유 Input은 이미 px10 py4, invalid ring, disabled opacity100을 제공한다. 높이·색상·focus ring은 semantic CSS 변수와 현재 사용처를 대조해 최소 변경한다. 공유 Switch sm/default는 이미32×18/16이며 청구반영도 default 사용 중이다. 확인된 차이는 OFF neutral/200→300, thumb border/margin 좌표 및 hover 세부 값이지 새 size 추가가 아니다.

상태 시안이 없는 항목은 조사를 생략한 것이 아니라 해당 set에 variant가 없는 것으로 기록했다. focus-visible, 접근 가능한 이름, 오류 설명, 비활성 이유와 키보드 동작을 삭제해서 모양만 맞추지 않는다.

### 편집·저장·실패: 현재 코드 계약
| 컬럼 / 상태 | 입력·저장 시점 | 검증 / 잠금 / 복구 |
| --- | --- | --- |
| 청구서명 · draft | controlled onChange→onUpdateBillingName; continuous draft autosave700ms; Enter는 blur | set/child/catalog-set/set-preview/confirmed noneditable는 텍스트. writeDisabled/pendingRemoval 잠금 |
| 수량 · draft | controlled onChange→onUpdateQuantity; positive finite; autosave700ms | fixed_one / set / preview / confirmed는 직접 draft 편집 제외. 잘못된 값은 로컬 유지+aria-invalid |
| 청구서명 · candidate | uncontrolled Input; blur에 trim, 비어 있지 않고 변경됐을 때 {billingName}; Enter→blur | 빈 값·변경 없음은 이전 값 복원; writeDisabled 또는 같은 order saving이면 disabled |
| 수량 · candidate | blur에 finite >0 변경만 {billingQuantity}; Enter→blur | 잘못된 값·변경 없음은 이전 값 복원; 소수 허용 |
| 청구반영 · candidate | onCheckedChange 즉시 {billingReflectionEnabled} | 그 외 현재는 텍스트 projection. true/false/unknown 보존; unknown을 false로 강제하지 않음 |
| 금액 · candidate | blur에 safe integer; {adjustmentAmountKrw, adjustmentSource: amount, adjustmentReason}; Enter→blur | 현재 Number(빈 문자열)=0. 0이면 reason:null, 아니면 기존 reason 사용. 실패 시 toast+서버 이전 값. 기존 additive 부호 유지: 음수 할인, 양수 할증 |
| 비율 · candidate | blur에 finite; {adjustmentPercent, adjustmentSource: percent, adjustmentReason}; Enter→blur | 표시는 최대2자리 소수. 현재 빈 문자열=0. 금액과 누적하지 않는 alternate source |
| 사유 · candidate | 현재 Select 변경 즉시 {adjustmentReason}; options=runtimeRow.billingAdjustmentReasons | 옵션 없음/편집 불가는 텍스트. 과거 Select 기준선. DEC-02에서 optional 자유 입력으로 변경 결정 |
| 업무 담당 · persisted draft | picker open 시 목록 로드; 선택 변경 시 nullable assignee ID 저장 | writeDisabled / 미저장 / saving 잠금. draft 저장을 먼저 끝내고 expectedOrderUpdatedAt+idempotency로 저장 |
| 과세 / 요청 수의사 / 파생 필드 | 기존 authority projection 읽기 전용 | 새 write route 추가 금지. 업무 담당과 요청 수의사 ID를 혼합하지 않음 |

candidate 편집 predicate는 confirmed AND order.status != cancelled AND orderConfirmationStatus != billed AND billingCandidateStatus == candidate_created. 셀의 쓰기 권한·saving guard를 추가 적용한다. 확정이라는 사실만으로 모든 인풋을 활성화하지 않는다.

prebilling route는 workspaceId/encounterId/orderId, expectedVersion, idempotencyKey, override를 보낸다. 성공 응답 전 row optimistic mutation은 없다. 성공하면 draft/committed projection을 갱신하고 billing summary를 새로 읽는다. revision_conflict는 reload와 summary refresh; reason-required/allowed, negative_charge, unavailable, permission 오류는 각각 toast로 알린다. saving flag를 포함한 input key로 이전 서버 값이 복원된다. 전용 Escape 취소 처리는 현재 셀에 없으므로 있다고 문서화하지 않는다.

draft route는 expectedEtag로 저장하며 continuous700ms / discrete150ms 지연을 쓴다. 같은 실패 edit version은 자동 재시도하지 않는다. 실패 시 편집값 유지, error/conflict 상태와 피드백; revision conflict는 자동 덮어쓰지 않는다. 저장 중 추가 편집은 edit version으로 보존한다. 저장 응답의 billing summary 범위를 검증하지 못하면 저장 성공으로 처리하지 않는다.

담당자 저장은 dirty draft commit과 경쟁하지 않도록 기다린다. revision conflict는 현재 편집을 conflict 상태로 둔다. 저장 ACK 후 readback이 실패하면 ACK identity는 반영하지만 버전 미검증 conflict를 표시하고 재조회를 요구한다. 이 경우 완전한 저장·동기화 성공으로 표시하면 안 된다. avatar picker로 바꾸더라도 이 경로를 유지한다.

로컬 근거: src/features/chart/module.tsx의 isChartOrderPrebillingEditable, commitDraftRows, autoSaveDraftRef, savePrebillingOverride 및 intended-assignee handlers; src/components/ui/input.tsx, switch.tsx; supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql. 운영 DB 적용 여부와 실제 네트워크 동작은 이번 조사에서 검증하지 않았다.

### 현재 코드 계산 예시 — 기존 부호 유지
| 조건 (합계10,000원, 청구반영 true) | 현재 signed 계약 결과 | 결정 또는 주의 |
| --- | --- | --- |
| amount +1,000 | 총11,000; percent +10 | 양수는 할증. 최신 할인/할증 명칭에서도 부호 변환 없이 유지 |
| amount -1,000 | 총9,000; percent -10 | 할인 효과. 독립 할인·할증 동시 적용 모델은 아님 |
| percent +10 | amount+1,000; 총11,000 | 비율 source로 전환하면 기존 amount를 더하지 않고 대체; 목표도 중복 적용 금지 |
| percent -10 | amount-1,000; 총9,000 | 기존 음수 할인 계산 유지 |
| clear amount 또는 percent | 현재 Number(빈 값)=0; adjustmentReason:null; 총10,000 | 빈 값=0 유지 여부를 정할 것. 변경 요청 없이 silent validation 변경 금지 |
| nonzero 조정 + 이유 없음/미허용 | 현재 서버 거절 | 설정된 이유를 먼저 선택 후 조정하거나 amount+reason 원자 payload UX 결정 |
| 총액이 음수 | 서버 negative_charge 거절 | UI의 max(0) 표시는 서버 validation 대체가 아님 |

SQL은 percent source에서 round(base×percent/100)로 KRW 정수 금액을 만들고 amount source에서 역산 비율을 만든다. allowlist 검사는 nonzero 조정일 때 적용된다. 현재 UI는 설정된 사유 목록만 선택한다. 이는 폐기 예정 정책이며, 목표에서는 자유 입력·optional이므로 서버와 SQL 검증을 함께 변경해야 한다.

DEC-03의 단위 동반 표시를 설명하는 합성 예시(임상 용량 지시 아님): dose=2 tablet, productStrength=10 mg/1 tablet, dispense=6 tablet이면 현재 1회당=2 tablet / 성분량=10 mg/tablet / 조제량=6 tablet로 서로 다른 의미가 섞여 있다. 주사형 dose=1 mL, strength=20 mg/mL, dispense=3 mL도 같다. 별도 단위 컬럼은 없애고 각 값에 자체 단위를 유지한다. 값이 없는 비약품 행에는 임의 단위를 만들지 않는다.

### 검증 상태와 다음 구현의 테스트 경계
| 검증 ID | 이번 문서 조사 결과 | 구현 후 남은 확인 |
| --- | --- | --- |
| VERIFY-01 | 27/27 헤더·body 노드, 폭, 정렬, inset, 아이콘 존재 기록 완료 | 렌더된 모든 열의 bounding box와 overflow |
| VERIFY-02 | Badge/Input/Switch/Avatar/status/Grab의 제공 상태 및 미제공 상태 기록 완료 | 공유 사용처 회귀, focus/disabled/hit area, 상태 전환 screenshot |
| VERIFY-03 | 394→402 차이와 scroll2266/overlay2317 원인 확인 | 경계8과 scroll선행10 할당; 가로 끝 overlay와 마지막 열 가림 |
| VERIFY-04 | draft/candidate/read-only 저장·오류·readback 경로 소스 조사 완료 | 허용·거절·경쟁 업데이트·readback 실패 실제 테스트 |
| VERIFY-05 | compact row/header36/36, standard40/36, comfortable52/44 확인 | 3 density × scroll 시작/중간/끝 × set parent/child × 긴 라벨 |

리사이즈는 사용자 확정 onChange이며 현재 크기는 component state(새로 mount되면 초기화)다. 공유 키보드 스텝은8px, Shift24px이고 min/max를 clamp한다. DEC-06의180/160/400·최소240·좁은 화면 고정 해제·초기화 정책은 최신 목표로 승인되었고, Order 명 기본/최소/최대와 onChange 경로는 구현되어 있다.

측정용 HTML의 체크박스는 새로고침하면 초기화되는 임시 체크다. 체크 자체가 테스트 실행이나 구현 수락을 뜻하지 않는다. 숫자·노드·부호 계약 등은 결정론적 검사, Jev는 조사 우선순위와 누락 가능성에 대한 보조 판정으로만 사용한다.
