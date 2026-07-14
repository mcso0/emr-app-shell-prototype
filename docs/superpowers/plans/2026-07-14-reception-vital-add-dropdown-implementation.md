# Reception Vital Add Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `바이탈 추가` action in both walk-in reception and reservation creation with the approved dropdown and removable inline vital rows.

**Architecture:** Add one creation-only vital-fields component inside the reception module and reuse it from both creation forms. Keep the existing parent-owned weight value and submission path, while keeping temperature, respiration, and blood-pressure values as local draft-only UI until a server contract exists. Reuse the existing Popover and side-panel field primitives; do not change the separate detail/edit vital flow.

**Tech Stack:** Next.js App Router, React client components, TypeScript, existing CLAiR UI primitives, Playwright, ESLint, TypeScript compiler, repository docs checks.

## Global Constraints

- Apply the feature to both walk-in reception creation and reservation creation.
- The creation dropdown contains exactly `체중 kg`, `체온 °C`, `호흡 rpm`, and `혈압 mmHg`; `심박수` remains available only where it already exists outside this creation flow.
- `체중` is initially visible. Optional rows start blank.
- Rows have a consistent `10px` vertical gap.
- When two or more rows exist, every row can be removed. When one row remains, no remove action is rendered.
- Removing and re-adding a row restores its current form-draft value.
- Removing `체중` must clear the parent-owned weight submission value; re-adding it must restore the cached draft value.
- Hide `바이탈 추가` when all four options are present and show a removed option again in the menu.
- The dropdown icon tile uses CLAiR Neutral/50 (`var(--clair-color-atomic-neutral-50)`) while retaining the existing domain-icon color.
- Preserve existing patient selection, weight validation, create submission, and disabled-state behavior.
- Do not add dependencies, migrations, API fields, persistence claims, clinical thresholds, or changes to the detail/edit vital UI.
- Temperature, respiration, and blood-pressure values are interaction drafts only in this slice and must not be added to the create payload.

---

## File Structure

- Modify: `src/features/reception/module.tsx`
  - Define the four creation-only vital options.
  - Add a shared `ReceptionCreateVitalFields` component and its menu/row interactions.
  - Replace both placeholder add-vital button blocks.
- Modify: `tests/reception.spec.ts`
  - Add focused regression coverage for reservation and walk-in creation.
- Create: `docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md`
  - Record scope, persistence boundary, completion criteria, and verification.
- Modify: `docs/work/index.md`
  - Register the new work item.
- Modify: `docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md`
  - Move the approved design from `draft` to `implemented` only after verification.
- Modify: `docs/design/screens/reception/planning/reception-vital-add-dropdown-prototype.html`
  - Keep as the approved planning artifact; change only if implementation uncovers a reviewed contract mismatch.
- Create under `docs/completed/reception/`: `2026-07-14-reception-vital-add-dropdown-report.html`
  - Summarize the implemented interaction, persistence boundary, and test evidence.

---

## Task 1: Register the Implementation Slice

**Files:**
- Create: `docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md`
- Modify: `docs/work/index.md`

- [ ] **Step 1: Create the work item**

Document the user-approved interaction contract, both creation surfaces, the four-option set, the one-row minimum, and the explicit out-of-scope persistence for non-weight vitals.

- [ ] **Step 2: Add the work item to the index**

Add `RECEPTION-QA-PR-011` after `RECEPTION-QA-PR-010` with status `in_progress`, area `reception`, priority `P1`, and a target reference to the approved vital dropdown prototype.

- [ ] **Step 3: Validate documentation structure**

Run:

```bash
npm run docs:check
```

Expected: the new work item and index entry pass the docs gate.

- [ ] **Step 4: Commit the routing artifact**

```bash
git add docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md docs/work/index.md
git commit -m "docs: register reception vital dropdown work"
```

---

## Task 2: Add Failing Reservation-Creation Interaction Coverage

**Files:**
- Modify: `tests/reception.spec.ts`

- [ ] **Step 1: Add a focused reservation-create test**

Add one test near the existing reservation create-drawer coverage that:

1. Opens the reservation creation drawer and selects a patient.
2. Confirms only the `체중` row is initially visible and no remove button exists.
3. Opens `바이탈 추가` and confirms `체중` is absent while `체온 °C`, `호흡 rpm`, and `혈압 mmHg` are present.
4. Selects `체온`, confirms the menu closes, the new empty input receives focus, and both rows expose labelled remove buttons.
5. Confirms the rendered row gap is `10px`.
6. Removes `체중`, confirms only `체온` remains, all remove buttons disappear, and `체중 kg` returns to the menu.
7. Re-adds `체중` and confirms the prior weight draft is restored.
8. Adds the remaining options and confirms the add trigger is hidden.

Use role and label queries (`바이탈 추가`, `체온`, `체중 삭제`) instead of CSS selectors wherever possible.

- [ ] **Step 2: Run the new test and confirm RED**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts --grep "reservation creation manages optional vital rows" --reporter=line
```

Expected: FAIL because the current button only emits the follow-up toast and no menu or row is rendered.

- [ ] **Step 3: Review the failure boundary**

Confirm the failure is caused by missing vital-row behavior, not patient fixture setup, authentication, or an unrelated calendar assertion.

---

## Task 3: Implement the Shared Creation Vital Component

**Files:**
- Modify: `src/features/reception/module.tsx`

- [ ] **Step 1: Define creation-only option metadata**

Add a `ReceptionCreateVitalId` union for `weight`, `temperature`, `respiration`, and `bloodPressure`, plus option metadata for Korean label, exact unit, icon, and accessible input label. Keep the existing `ReceptionSidePanelVitalId` and `receptionSidePanelVitalOptions` unchanged for detail/edit behavior.

- [ ] **Step 2: Add the shared component state contract**

Implement `ReceptionCreateVitalFields` with props for:

```ts
type ReceptionCreateVitalFieldsProps = {
  disabled: boolean;
  patientKey: string | null;
  weightValue: string;
  weightInvalid: boolean;
  onWeightValueChange: (value: string) => void;
};
```

The component owns selected option order, local values for non-weight rows, a draft-value cache for removed rows, the open menu state, and the live-region message. Reset selection to `체중` and clear non-weight drafts when `patientKey` changes; use the incoming patient weight as the new weight draft.

- [ ] **Step 3: Render rows and enforce removal rules**

Render selected rows in selection order inside a `10px`-gap stack. Reuse `ReceptionSidePanelField`, `ReceptionSidePanelInput`, existing icons, and the existing validation presentation for weight. Render a labelled icon remove button for every row only when `selectedVitalIds.length > 1`.

On removal:

- Cache the current value.
- If removing weight, call `onWeightValueChange("")` so the existing create payload omits it.
- Return focus to a stable remaining control or the add trigger.
- Announce the removal through the live region.

- [ ] **Step 4: Implement the dropdown interaction**

Use the repository Popover primitives anchored to the full-width `바이탈 추가` trigger. Render only unselected options, each with Neutral/50 icon tile, label, and unit. On selection:

- Restore the cached value for that row.
- Close the menu.
- Append the option to selection order.
- Focus the new input after render.
- Announce the addition.

Hide the trigger when no options remain. Preserve outside-click and Escape dismissal from the Popover primitive and expose `aria-expanded`, menu semantics, and stable labels.

- [ ] **Step 5: Replace both placeholder blocks**

In the walk-in form and reservation form, replace the standalone weight field plus toast-only `ReceptionSidePanelAddVitalButton` with `ReceptionCreateVitalFields`. Pass each form's selected patient ID as `patientKey`, existing `weightKg`, validation flag, disabled state, and setter.

Do not alter create payload types or add non-weight values to submit handlers.

- [ ] **Step 6: Run the reservation test and confirm GREEN**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts --grep "reservation creation manages optional vital rows" --reporter=line
```

Expected: PASS.

- [ ] **Step 7: Run static checks for the touched code**

```bash
npx eslint src/features/reception/module.tsx tests/reception.spec.ts
npx tsc --noEmit --pretty false
```

Expected: no new ESLint errors and TypeScript passes. Existing unrelated warnings may remain and must be reported exactly.

- [ ] **Step 8: Commit the first working slice**

```bash
git add src/features/reception/module.tsx tests/reception.spec.ts
git commit -m "feat: add reservation creation vital dropdown"
```

---

## Task 4: Add Walk-In Reuse and Submission-Boundary Coverage

**Files:**
- Modify: `tests/reception.spec.ts`
- Modify if needed: `src/features/reception/module.tsx`

- [ ] **Step 1: Add a focused walk-in test**

Add one test near the existing walk-in creation coverage that:

1. Confirms the add trigger remains disabled before patient selection.
2. Selects a patient and confirms the existing patient weight appears.
3. Adds `혈압`, enters a draft value, removes it, and re-adds it to verify draft restoration.
4. Confirms the blood-pressure unit is exactly `mmHg`.
5. Removes weight, submits a valid walk-in reception with the remaining vital row, and verifies the request payload does not contain a stale `weightKg` value.
6. Confirms non-weight draft values are not added to the current request payload.

- [ ] **Step 2: Run the walk-in test and confirm the current state**

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts --grep "walk-in creation reuses vital rows without expanding persistence" --reporter=line
```

Expected: PASS if the shared component contract is complete; otherwise fail only at the missing reuse or payload-boundary assertion.

- [ ] **Step 3: Make the smallest corrective change**

If RED, modify only the shared creation component or form wiring needed to satisfy the failed interaction. Do not change API types or server routes.

- [ ] **Step 4: Run both focused tests together**

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts --grep "(reservation creation manages optional vital rows|walk-in creation reuses vital rows without expanding persistence)" --reporter=line
```

Expected: both tests PASS.

- [ ] **Step 5: Run nearby creation regressions**

Run the existing reservation and walk-in creation tests that assert patient selection, weight population, disabled state, and successful submission. Use their exact test titles after locating them with:

```bash
rg -n "test\(.*(reservation|walk-in)|바이탈 추가|weight" tests/reception.spec.ts
```

Expected: existing create flows remain green.

- [ ] **Step 6: Commit cross-surface coverage**

```bash
git add src/features/reception/module.tsx tests/reception.spec.ts
git commit -m "test: cover reception creation vital row rules"
```

---

## Task 5: Verify Accessibility and Visual Contract

**Files:**
- Modify if needed: `src/features/reception/module.tsx`
- Modify if needed: `tests/reception.spec.ts`

- [ ] **Step 1: Add keyboard assertions to one focused test**

Verify the trigger opens with keyboard activation, focus moves to the first available option, Escape closes without adding a row, and selecting an option moves focus to the inserted input.

- [ ] **Step 2: Assert visual tokens through computed styles**

Verify the dropdown icon tile resolves to `rgb(250, 250, 250)` and the row container resolves to a `10px` gap. Keep these assertions focused on the approved design decisions rather than broad screenshot snapshots.

- [ ] **Step 3: Verify accessible names and live feedback**

Confirm remove controls expose names such as `체온 삭제`, the menu items include label and unit, and an `aria-live` region reports additions and removals without adding visible noise.

- [ ] **Step 4: Run focused accessibility/visual coverage**

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts --grep "creation manages optional vital rows" --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Re-run static checks**

```bash
npx eslint src/features/reception/module.tsx tests/reception.spec.ts
npx tsc --noEmit --pretty false
git diff --check
```

Expected: no new errors, TypeScript passes, and no whitespace errors.

---

## Task 6: Close Out Documentation and Full Verification

**Files:**
- Modify: `docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md`
- Modify: `docs/work/index.md`
- Modify: `docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md`
- Create under `docs/completed/reception/`: `2026-07-14-reception-vital-add-dropdown-report.html`

- [ ] **Step 1: Update durable status only after behavior passes**

Set the work item and index status to `implemented`. Change the design spec status from `draft` to `implemented` and update its out-of-scope language so it distinguishes the now-implemented UI from the still-unimplemented non-weight persistence contract.

- [ ] **Step 2: Create the closeout report**

Create a concise designer-friendly HTML report that links the prototype, work item, and implementation files; explains both creation surfaces; and clearly states that only weight uses the existing persistence path.

- [ ] **Step 3: Run the final focused and repository checks**

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/reception.spec.ts --grep "(reservation creation manages optional vital rows|walk-in creation reuses vital rows without expanding persistence)" --reporter=line
npx eslint src/features/reception/module.tsx tests/reception.spec.ts
npx tsc --noEmit --pretty false
npm run docs:check
git diff --check
```

Expected: both focused tests pass, static checks introduce no new errors, docs pass, and the diff is whitespace-clean.

- [ ] **Step 4: Run a production build when the focused suite is green**

```bash
npm run build
```

Expected: production build passes. If an unrelated environment or pre-existing build failure occurs, capture the exact command and error without weakening the implementation claim.

- [ ] **Step 5: Review the final diff against scope**

```bash
git status --short
git diff --stat HEAD~3..HEAD
git diff HEAD~3..HEAD -- src/features/reception/module.tsx tests/reception.spec.ts docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md docs/work/index.md docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md docs/completed/reception/2026-07-14-reception-vital-add-dropdown-report.html
```

Confirm there are no server, migration, API-type, detail/edit vital, or unrelated dirty-tree changes.

- [ ] **Step 6: Commit closeout artifacts**

```bash
git add docs/work/reception/RECEPTION-QA-PR-011-create-vital-add-dropdown.md docs/work/index.md docs/superpowers/specs/2026-07-14-reception-vital-add-dropdown-design.md docs/completed/reception/2026-07-14-reception-vital-add-dropdown-report.html
git commit -m "docs: close out reception vital dropdown"
```

---

## Final Review Checklist

- [ ] Both creation surfaces use the same component and interaction rules.
- [ ] The initial single weight row has no delete action.
- [ ] Two or more rows expose delete actions on every row.
- [ ] The last remaining row cannot be removed.
- [ ] Removed options return to the dropdown and restore their draft values when re-added.
- [ ] Removing weight clears the submitted weight value and re-adding it restores the draft.
- [ ] `mmHg`, `rpm`, `°C`, and `kg` match the approved units.
- [ ] Row spacing is `10px`; menu icon tiles use Neutral/50.
- [ ] Focus, Escape, outside click, and live-region behavior are verified.
- [ ] Existing weight validation and submission regressions pass.
- [ ] Non-weight values are not represented as persisted data.
- [ ] Documentation and verification results match the actual implementation state.
