# Reception Queue Operational Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the reception side-panel queue as operationally distinct `접수` and `예약` groups instead of one mixed `대기` group, while preserving the existing icon assets, tokens, sizes, card layout, and top filter labels.

**Architecture:** The existing queue reader already emits two operational record forms: an `encounter_queue` record for an active encounter with a `waiting_queue_entries` row, and an `appointment` record only when an appointment has no encounter. Treat that record boundary—not `encounter.appointmentId`, which only records the encounter's origin—as the display classification. The UI will render existing `EmrSidePanelStateIcon` semantic variants through `EmrSidePanelCollapsibleGroup.stateIconState`; it will not edit shared icon SVGs, CSS tokens, dimensions, or colors.

**Tech Stack:** Next.js/React, TypeScript, existing EMR side-panel components, Supabase read contract, Playwright.

## Global Constraints

- Keep the top filter labels and controls exactly as `전체`, `외래`, and `예약`; only its counts change when a checked-in reservation is correctly classified as reception work.
- Keep the existing `EmrSidePanelStateIcon` assets, CSS token values, size variables, card layout, and `EmrSidePanelCollapsibleGroup` implementation unchanged.
- Use the existing `in-progress` icon state for `접수`, `to-do` for `예약`, and `cancel` for the existing `취소` group; do not add an icon, color, or token variant.
- Classify every `encounter_queue` record as `접수`, including encounters created from an appointment; classify only an appointment with no encounter as `예약`.
- Do not add a migration, change `waiting_queue_entries`, modify `clair_list_reception_queue`, or change route permissions/API payloads.
- Preserve existing cancellation restore behavior as the separate `취소` group.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/reception/server-reception-queue-read-core.ts` | Keep the API summary aligned with operational queue classification: all `encounter_queue` records are reception work and only `appointment` records are reservations. |
| `src/features/reception/module.tsx` | Convert side-panel item/group classification from generic waiting status to operational reception/reservation groups, assign existing icon states, and retain cancellation grouping. |
| `tests/reception-queue-read-server.spec.ts` | Prove the server summary does not count a checked-in appointment encounter as an appointment-only reservation. |
| `tests/reception.spec.ts` | Prove the visible side panel shows `접수 2` and `예약 1` as two groups, with the existing semantic icon states and unchanged top-filter labels. |

### Task 1: Align the queue summary with the persisted record contract

**Files:**

- Modify: `src/features/reception/server-reception-queue-read-core.ts:267-289`
- Test: `tests/reception-queue-read-server.spec.ts:365-406`

**Consumes:** `ReceptionQueueReadRecord.kind`, whose two values are `encounter_queue` and `appointment`.

**Produces:** `ReceptionQueueReadSummary` where `receptionCount` equals the number of `encounter_queue` rows and `appointmentCount` equals the number of appointment-only rows.

- [x] **Step 1: Write the failing summary regression test.**

  In `tests/reception-queue-read-server.spec.ts`, add an appointment-origin encounter fixture to the existing "appointment-only rows separate" test. Its shape must remain an `encounter_queue` record even though it has `appointmentId`:

  ```ts
  const checkedInAppointmentEncounter: Encounter = {
    ...encounter,
    id: "encounter-db-appointment-check-in",
    appointmentId: appointment.id,
    encounterNo: "E-DB-APPOINTMENT-CHECK-IN",
  };

  const checkedInAppointmentQueueEntry: WaitingQueueEntry = {
    ...queueEntry,
    id: "queue-db-appointment-check-in",
    encounterId: checkedInAppointmentEncounter.id,
  };

  // Queue input contains one walk-in encounter queue, one checked-in appointment
  // encounter queue, and one appointment-only reservation.
  queue: [
    { kind: "encounter_queue", encounter, queueEntry },
    {
      kind: "encounter_queue",
      encounter: checkedInAppointmentEncounter,
      queueEntry: checkedInAppointmentQueueEntry,
    },
    { kind: "appointment", appointment },
  ];

  expect(result).toMatchObject({
    ok: true,
    summary: { receptionCount: 2, appointmentCount: 1, totalCount: 3 },
  });
  ```

- [x] **Step 2: Run the focused server test and confirm the old implementation fails.**

  Run:

  ```bash
  npx playwright test tests/reception-queue-read-server.spec.ts -g "appointment-only rows separate" --reporter=line
  ```

  Expected: the old summary counts `appointmentId` on the checked-in encounter as an appointment, producing `receptionCount: 1` and `appointmentCount: 2`.

- [x] **Step 3: Change the summary discriminator to record kind only.**

  In `getReceptionQueueReadSummary`, replace the origin-based condition:

  ```ts
  if (record.kind === "appointment" || record.encounter.appointmentId) {
    summary.appointmentCount += 1;
  } else {
    summary.receptionCount += 1;
  }
  ```

  with the operational read-boundary condition:

  ```ts
  if (record.kind === "appointment") {
    summary.appointmentCount += 1;
  } else {
    summary.receptionCount += 1;
  }
  ```

- [x] **Step 4: Run the focused server test and confirm it passes.**

  Run:

  ```bash
  npx playwright test tests/reception-queue-read-server.spec.ts --reporter=line
  ```

  Expected: all reception queue reader tests pass, including `receptionCount: 2`, `appointmentCount: 1`, and `totalCount: 3` for the regression case.

- [x] **Step 5: Commit the contract correction.**

  ```bash
  git add src/features/reception/server-reception-queue-read-core.ts tests/reception-queue-read-server.spec.ts
  git commit -m "fix(reception): classify checked-in reservations as reception queue work"
  ```

### Task 2: Render active queue records in operational groups without redesigning icons

**Files:**

- Modify: `src/features/reception/module.tsx:2828-2837, 3299-3367, 3448-3635`
- Test: `tests/reception.spec.ts:414-446`

**Consumes:** `queueRows` from `getReceptionQueueRows` (encounter-backed queue rows) and `queueAppointments` from `getTodayAppointments` (appointment-only rows after checked-in IDs are removed).

**Produces:** `ReceptionQueueSideDisplayGroup` with `reception`, `appointment`, and `cancelled` values; a reception group labeled `접수` with `in-progress`, an appointment group labeled `예약` with `to-do`, and a cancellation group labeled `취소` with `cancel`.

- [x] **Step 1: Write the failing visible side-panel regression test.**

  In `tests/reception.spec.ts`, intercept `**/reception/queue**` with three records: a walk-in `encounter_queue`, an `encounter_queue` whose `encounter.appointmentId` is set, and one appointment-only `appointment`. Then assert the reception side panel retains the filter labels and separates the visible groups:

  ```ts
  const sideTabs = sidePanel.getByRole("group", { name: "접수 목록 유형" });
  await expect
    .poll(() =>
      sideTabs.getByRole("button").evaluateAll((buttons) =>
        buttons.map((button) => button.textContent?.trim()),
      ),
    )
    .toEqual(["전체 3", "외래 2", "예약 1"]);

  const receptionGroup = sidePanel.getByTestId("reception-queue-group-reception");
  const appointmentGroup = sidePanel.getByTestId("reception-queue-group-appointment");

  await expect(receptionGroup).toContainText("접수 2");
  await expect(appointmentGroup).toContainText("예약 1");
  await expect(
    receptionGroup.getByTestId("reception-queue-group-reception-status-icon"),
  ).toHaveAttribute("data-state-icon-state", "in-progress");
  await expect(
    appointmentGroup.getByTestId("reception-queue-group-appointment-status-icon"),
  ).toHaveAttribute("data-state-icon-state", "to-do");
  await expect(sidePanel.getByTestId("reception-queue-group-waiting")).toHaveCount(0);
  ```

  Use the current test's route-fixture helpers and profile IDs so the test remains a visible UI contract rather than a unit test of implementation details.

- [x] **Step 2: Run the focused UI regression and confirm the old implementation fails.**

  Run:

  ```bash
  npx playwright test tests/reception.spec.ts -g "reception side panel groups checked-in and pending reservations by operational state" --reporter=line
  ```

  Expected: the old UI renders one `reception-queue-status-waiting` group labeled `대기 3` and does not expose the two operational group test IDs.

- [x] **Step 3: Make display grouping independent from encounter origin.**

  In `src/features/reception/module.tsx`, use a distinct group type and include the existing semantic icon state in the local group model:

  ```ts
  type ReceptionQueueSideDisplayGroup = "reception" | "appointment" | "cancelled";

  type ReceptionQueueSideGroup = {
    iconState: EmrSidePanelStateIconState;
    items: ReceptionQueueSideItem[];
    label: string;
    statusGroup: ReceptionQueueSideDisplayGroup;
  };
  ```

  For an encounter-backed `draftItems` row, keep the card/drawer behavior but classify it as reception work even when it came from an appointment:

  ```ts
  const queueKind = "reception";
  const statusGroup = isCancelledReceptionQueueRow(row)
    ? "cancelled"
    : "reception";
  ```

  For an appointment-only row, classify an active record as `appointment` and preserve `cancelled` for its existing restoration behavior:

  ```ts
  const statusGroup = appointment.status === "cancelled"
    ? "cancelled"
    : "appointment";
  ```

  Update the collapsed-state record and callback parameter to use `ReceptionQueueSideDisplayGroup`:

  ```ts
  const [collapsedQueueGroups, setCollapsedQueueGroups] = useState<
    Record<ReceptionQueueSideDisplayGroup, boolean>
  >({ appointment: false, cancelled: false, reception: false });
  ```

- [x] **Step 4: Define ordered group metadata and pass only the existing icon state.**

  Replace the active/cancelled status loop with the local metadata below. It changes copy and classification only; it does not modify `EmrSidePanelCollapsibleGroup`, `EmrSidePanelStateIcon`, or any token/class value.

  ```ts
  const receptionQueueGroupMeta: Record<
    ReceptionQueueSideDisplayGroup,
    { iconState: EmrSidePanelStateIconState; label: string }
  > = {
    reception: { iconState: "in-progress", label: "접수" },
    appointment: { iconState: "to-do", label: "예약" },
    cancelled: { iconState: "cancel", label: "취소" },
  };

  function getReceptionSideQueueGroups(items: ReceptionQueueSideItem[]) {
    return (["reception", "appointment", "cancelled"] as const).flatMap(
      (statusGroup) => {
        const groupItems = items.filter((item) => item.statusGroup === statusGroup);
        if (!groupItems.length) return [];

        return [{
          ...receptionQueueGroupMeta[statusGroup],
          items: groupItems,
          statusGroup,
        }];
      },
    );
  }
  ```

  Pass `group.iconState` to the existing primitive and rename the feature test IDs to group semantics:

  ```tsx
  <EmrSidePanelCollapsibleGroup
    dataTestId={`reception-queue-group-${group.statusGroup}`}
    stateIconState={group.iconState}
    // Keep the existing count/indicator props and token values unchanged.
  >
  ```

  Keep the current `receptionType` card labels, top tab text, and card classes unchanged because this request is limited to operational group labels.

- [x] **Step 5: Run focused UI verification.**

  Run:

  ```bash
  npx playwright test tests/reception.spec.ts -g "reception side panel groups checked-in and pending reservations by operational state|reception side panel" --reporter=line
  npx eslint src/features/reception/module.tsx tests/reception.spec.ts tests/reception-queue-read-server.spec.ts
  npx tsc --noEmit --pretty false --incremental false
  ```

  Expected: the focused Playwright tests pass; lint has no new errors; TypeScript resolves the new display-group type and existing icon-state type.

- [ ] **Step 6: Perform a browser visual check on the supplied Cheongdam route.**

  Open the reception route with the same selected date and confirm:

  1. `전체` still shows every active queue item.
  2. The active encounter-backed rows appear under `접수` with the existing progress-state icon.
  3. The appointment-only row appears under `예약` with the existing waiting-state icon.
  4. The group labels/counts are `접수 2` and `예약 1` for the browser-comment dataset.
  5. Icon SVG geometry, CSS variables, icon dimensions, card spacing, and top filter labels did not change.
  6. Cancellation/restore behavior remains under `취소`, if cancellation data is present.

- [x] **Step 7: Commit the UI grouping change.**

  ```bash
  git add src/features/reception/module.tsx tests/reception.spec.ts
  git commit -m "fix(reception): separate reception and reservation queue groups"
  ```

### Task 3: Final regression and handoff

**Files:**

- Test: `tests/reception.spec.ts`, `tests/reception-queue-read-server.spec.ts`

**Consumes:** The two focused code/test changes above.

**Produces:** A verified, narrowly scoped queue presentation change with no DB migration or API contract expansion.

- [ ] **Step 1: Run the complete focused reception verification set.**

  ```bash
  npx playwright test tests/reception-queue-read-server.spec.ts tests/reception.spec.ts --reporter=line
  git diff --check
  ```

  Expected: both reception suites pass and `git diff --check` produces no whitespace errors.

  > Execution note (2026-07-14): the queue-reader suite and all queue-related UI
  > regressions passed. The complete `tests/reception.spec.ts` run also surfaced
  > unrelated pre-existing failures (including a stale date-selector expectation),
  > so no out-of-scope repairs were made in this change.

- [x] **Step 2: Review scope before delivery.**

  Confirm the diff contains only:

  ```text
  src/features/reception/server-reception-queue-read-core.ts
  src/features/reception/module.tsx
  tests/reception-queue-read-server.spec.ts
  tests/reception.spec.ts
  ```

  Do not include `supabase/migrations/**`, `src/components/emr/side-panel-state-icon.tsx`, `src/components/emr/side-panel-collapsible-group.tsx`, or token/CSS files.

- [x] **Step 3: Keep documentation scope at the result-review level.**

  This is a focused display-classification correction. Do not create a migration, a new `docs/work/` item, or a duplicate source-of-truth document unless 승욱 explicitly expands the scope beyond the saved implementation plan. Record the final behavior and verification in the implementation review/PR description instead.

## Risks and Explicit Checks

- A checked-in reservation has both `encounter.appointmentId` and an active `waiting_queue_entries` row. It must be shown and counted as `접수`, not `예약`; this is the primary regression case.
- A confirmed reservation with no encounter must remain in `예약` and retain the existing `접수하기` flow.
- Cancelled encounter and appointment rows stay visible under `취소`; do not lose restore actions while changing active group keys.
- The user asked not to alter icon visuals. Passing explicit existing icon states is allowed only because it reuses the current design-system assets and semantic tokens; no shared icon, CSS token, class, or size change is part of this work.
- The supplied browser dataset (`전체 3`) must render two active groups: `접수 2`, `예약 1`.

## Self-Review

- Spec coverage: Task 1 covers API summary classification, Task 2 covers visual grouping/copy/icon-state mapping, and Task 3 covers regression, visual confirmation, and scope control.
- No DB/schema work: `appointments`, `encounters`, and `waiting_queue_entries` are existing sufficient data sources; only their presentation mapping changes.
- No icon redesign: shared component source and tokens are explicitly excluded from the diff.
- Type consistency: `ReceptionQueueSideDisplayGroup` is used for item group keys, collapsed state, group metadata, and callbacks; `EmrSidePanelStateIconState` is the existing shared type.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-reception-queue-operational-groups.md`.

Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks.
2. Inline Execution - execute tasks in this session in small verified steps.
