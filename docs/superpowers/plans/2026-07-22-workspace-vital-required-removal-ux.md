# Required Workspace Vitals And Removal UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in a clean worktree. Do not dispatch subagents unless the user explicitly asks for delegated work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make weight and temperature permanent workspace vital settings, give optional vitals a reversible “목록에서 제거” flow, and replace the current list icon with a conventional accessible drag grip without changing historical measurements.

**Architecture:** Add `required_in_workspace` to the curated preset catalog, enforce it in TypeScript and the replacement RPC, and backfill existing workspaces additively. Keep removal as a draft-only editor change; the existing save dialog remains the single persistence confirmation. Reception, chart, and patient summaries continue to consume the same settings array, so an omitted optional preset disappears without measurement-row mutation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Base UI-backed shadcn components, Obra/CDS icons, dnd-kit, Sonner, Playwright.

## Global Constraints

- Implementation baseline is fresh `origin/main`; the inspected baseline was `1ff1e9ae` on 2026-07-22.
- The primary worktree is dirty and behind `origin/main`; execute in a clean worktree without absorbing or reverting user-owned changes.
- `weight` and `temperature` must always be present and `enabled: true`; they remain reorderable and keep allowed unit selectors.
- Actual patient measurement values, including weight and temperature, remain optional.
- `heart_rate`, `respiratory_rate`, and `blood_pressure` can be disabled or removed.
- Removal never deletes, clears, or rewrites `patient_vital_measurements`.
- Re-add uses the canonical unit, `enabled: true`, and the last position. Undo restores exact prior unit, enabled state, and index.
- Reuse installed Obra/CDS icons and existing `DropdownMenu`, `Badge`, `Button`, `Dialog`, and Sonner. Do not add Lucide, Alert Dialog, or another DnD library.
- Preserve workspace permissions, actor/session equality, RLS, revoked direct writes, RPC-only replacement, and audit emission.
- Species ranges, alerts, custom vital definitions, remote DB application, deployment, commits, push, PR, and merge are out of this planning scope.

---

## Current-State Findings

1. `WorkspaceVitalSettingsScreen` gives every row a switch and has no configured-row removal action.
2. The handle is `IconReorder`, a four-horizontal-line list icon, with `hover:bg-muted hover:text-foreground`; `setActivatorNodeRef` is not used.
3. The current shadcn dashboard registry uses a six-dot vertical grip, a ghost icon button, and `hover:bg-transparent`.
4. Although `components.json` names Lucide, `lucide-react` is not installed. Obra already provides `IconReorderAlt`, the equivalent six-dot grip; use it instead of adding a dependency.
5. The repo already provides `CdsFilesMoreVerticalIcon`, a Base UI-backed `DropdownMenu`, `Badge`, and Sonner undo actions.
6. `availablePresets` is derived from keys absent from `draft.items`; a removed optional item automatically reappears in `바이탈 추가`.
7. `clair_replace_workspace_vital_settings` accepts any non-empty subset, so the required rule must be enforced beyond the UI.
8. The API body remains `{ items }`; the route needs inspection but no expected change.

## File Map

**Create**

- `supabase/migrations/20260722190000_required_workspace_vitals.sql`
- `supabase/snippets/workspace_vital_required_settings_transaction_replay.sql`
- `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-019-required-vitals-removal-ux.md`
- A dated Korean closeout under `docs/completed/hospital-admin/` after implementation

**Modify**

- `src/features/patient-vitals/workspace-vital-settings.ts`
- `src/features/hospital-admin/vital-settings/server-workspace-vital-settings-core.ts`
- `src/features/hospital-admin/vital-settings/workspace-vital-settings-screen.tsx`
- `tests/workspace-vital-settings-model.spec.ts`
- `tests/workspace-vital-settings-server.spec.ts`
- `tests/workspace-vital-settings-migration.spec.ts`
- `tests/hospital-admin.spec.ts`
- `tests/reception.spec.ts`
- `tests/chart.spec.ts`
- `docs/product/features/hospital-admin/workspace-vital-settings.md`
- `docs/engineering/data-model/patient-vital-measurements.md`
- `docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md`
- `docs/engineering/current-status.md`
- `docs/work/index.md`

**Inspect only**

- `src/app/api/workspaces/[workspaceId]/vital-settings/route.ts`
- `src/features/patient-vitals/use-workspace-vital-settings.ts`
- `src/features/reception/module.tsx`
- `src/features/chart/preconsultation-context-panel.tsx`

---

### Task 1: Lock the product and typed preset contract

**Files:**
- Modify: `docs/product/features/hospital-admin/workspace-vital-settings.md`
- Modify: `src/features/patient-vitals/workspace-vital-settings.ts`
- Test: `tests/workspace-vital-settings-model.spec.ts`

**Interfaces:**
- Produces: `WorkspaceVitalPreset.requiredInWorkspace: boolean`.
- Preserves: `WorkspaceVitalSetting`, PUT `{ items }`, and canonical conversion functions.

- [ ] **Step 1: Update the durable product contract**

Add these exact rules:

```md
- `weight` and `temperature` are required workspace presets. They always remain configured and enabled, but their patient measurement values remain optional.
- Required presets can be reordered and use any display unit allowed by the curated catalog.
- Optional presets can be disabled while configured, or removed from the workspace list.
- Removing a setting hides it from new entry and ordinary summaries. It never deletes historical measurements and the preset can be added again.
```

- [ ] **Step 2: Write failing model tests**

```ts
test("weight and temperature are required workspace presets", () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();
  expect(snapshot.presets
    .filter((preset) => preset.requiredInWorkspace)
    .map((preset) => preset.key)).toEqual(["weight", "temperature"]);
});

test("parser rejects missing or disabled required presets", () => {
  const valid = createDefaultWorkspaceVitalSettingsSnapshot();
  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: valid.items.filter((item) => item.key !== "weight")
      .map((item, sortOrder) => ({ ...item, sortOrder })),
  })).toBeNull();
  expect(parseWorkspaceVitalSettingsSnapshot({
    ...valid,
    items: valid.items.map((item) => item.key === "temperature"
      ? { ...item, enabled: false }
      : item),
  })).toBeNull();
});
```

- [ ] **Step 3: Run the red test**

```bash
npx playwright test tests/workspace-vital-settings-model.spec.ts --reporter=line
```

Expected: FAIL because required metadata and validation are absent.

- [ ] **Step 4: Implement the typed contract**

```ts
export type WorkspaceVitalPreset = {
  allowedDisplayUnits: WorkspaceVitalUnit[];
  canonicalUnit: WorkspaceVitalUnit;
  description: string;
  key: WorkspaceVitalKey;
  label: string;
  requiredInWorkspace: boolean;
};
```

Set the property to `true` only for weight and temperature. Require and copy it in the parser, then reject invalid required items:

```ts
const requiredKeys = presets
  .filter((preset) => preset.requiredInWorkspace)
  .map((preset) => preset.key);
if (requiredKeys.some((key) =>
  !items.some((item) => item.key === key && item.enabled)
)) return null;
```

- [ ] **Step 5: Re-run the model spec and expect zero failures**

---

### Task 2: Enforce required presets in the server and database

**Files:**
- Create: `supabase/migrations/20260722190000_required_workspace_vitals.sql`
- Create: `supabase/snippets/workspace_vital_required_settings_transaction_replay.sql`
- Modify: `src/features/hospital-admin/vital-settings/server-workspace-vital-settings-core.ts`
- Test: `tests/workspace-vital-settings-server.spec.ts`
- Test: `tests/workspace-vital-settings-migration.spec.ts`

**Interfaces:**
- Reader preset JSON adds `requiredInWorkspace`.
- Writer rejects a missing or disabled required preset before replacing rows.

- [ ] **Step 1: Write the failing server test**

```ts
test("required presets cannot be omitted or disabled", async () => {
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();
  const invalidPayloads = [
    snapshot.items.filter((item) => item.key !== "weight")
      .map((item, sortOrder) => ({ ...item, sortOrder })),
    snapshot.items.map((item) => item.key === "temperature"
      ? { ...item, enabled: false }
      : item),
  ];

  for (const items of invalidPayloads) {
    let gatewayCalled = false;
    const result = await replaceWorkspaceVitalSettings({
      actorUserId,
      workspaceId,
      items,
      permissionAdapter: permissionAdapter("hospital_admin"),
      gateway: {
        async get() { return { ok: false, error: "db_read_failed" }; },
        async replace() {
          gatewayCalled = true;
          return { ok: false, error: "db_write_failed" };
        },
      },
    });
    expect(result).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
    expect(gatewayCalled).toBe(false);
  }
});
```

- [ ] **Step 2: Write failing migration assertions**

```ts
const requiredMigrationPath =
  "supabase/migrations/20260722190000_required_workspace_vitals.sql";

test("required vital migration backfills and enforces weight and temperature", () => {
  const sql = readFileSync(requiredMigrationPath, "utf8");
  expect(sql).toContain("required_in_workspace boolean not null default false");
  expect(sql).toContain("'requiredInWorkspace', preset.required_in_workspace");
  expect(sql).toContain("required_vital_setting_missing_or_disabled");
  expect(sql).not.toContain("delete from public.patient_vital_measurements");
});
```

- [ ] **Step 3: Run both specs and verify red**

```bash
npx playwright test tests/workspace-vital-settings-server.spec.ts tests/workspace-vital-settings-migration.spec.ts --reporter=line
```

- [ ] **Step 4: Create the additive migration**

Start with:

```sql
alter table public.vital_presets
  add column if not exists required_in_workspace boolean not null default false;

update public.vital_presets
set required_in_workspace = vital_key in ('weight', 'temperature'),
    default_enabled = case
      when vital_key in ('weight', 'temperature') then true
      else default_enabled
    end,
    updated_at = now();

alter table public.vital_presets
  add constraint vital_presets_required_default_enabled_check
  check (not required_in_workspace or default_enabled) not valid;
alter table public.vital_presets
  validate constraint vital_presets_required_default_enabled_check;
```

Backfill in this order:

1. For a workspace with zero rows, insert every `default_enabled` preset so untouched workspaces keep the four existing defaults.
2. For a partial workspace, append only missing required presets after its maximum `sort_order`, ordered by preset default order.
3. Set existing required rows to `enabled = true` without changing unit or order.

Do not rebuild existing settings or touch measurement rows.

Add to each reader preset object:

```sql
'requiredInWorkspace', preset.required_in_workspace
```

After item type/catalog validation and before the writer deletes configuration rows, add:

```sql
if exists (
  select 1
  from public.vital_presets preset
  where preset.required_in_workspace
    and not exists (
      select 1
      from jsonb_array_elements(p_items) item
      where item->>'key' = preset.vital_key
        and (item->>'enabled')::boolean
    )
) then
  raise exception 'required_vital_setting_missing_or_disabled';
end if;
```

Retain the existing actor, permission, workspace, search path, catalog, ordering, audit, grant, and revoke behavior.

- [ ] **Step 5: Keep pre-gateway validation explicit**

```ts
if (!parsed || parsed.items.some((item, index) => item.sortOrder !== index)) return null;
const requiredKeys = parsed.presets
  .filter((preset) => preset.requiredInWorkspace)
  .map((preset) => preset.key);
if (requiredKeys.some((key) =>
  !parsed.items.some((item) => item.key === key && item.enabled)
)) return null;
return parsed.items;
```

- [ ] **Step 6: Add a rollback-only SQL replay**

The replay must assert required metadata, missing/disabled rejection, optional removal and re-add, front-desk denial, unchanged measurement row counts, and finish with top-level `rollback`.

- [ ] **Step 7: Verify locally**

```bash
npx playwright test tests/workspace-vital-settings-model.spec.ts tests/workspace-vital-settings-server.spec.ts tests/workspace-vital-settings-migration.spec.ts --reporter=line
npx supabase db reset --local --yes
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/snippets/workspace_vital_required_settings_transaction_replay.sql
npx supabase db lint --local --schema public
```

Expected: focused specs and replay pass; any pre-existing DB lint findings are reported separately.

---

### Task 3: Implement grip, required state, removal, undo, and save summary

**Files:**
- Modify: `src/features/hospital-admin/vital-settings/workspace-vital-settings-screen.tsx`
- Test: `tests/hospital-admin.spec.ts`

**Interfaces:**
- Consumes: `preset.requiredInWorkspace`.
- Preserves: dirty/reset/save behavior, add dialog, pointer/keyboard DnD, and 920px width.

- [ ] **Step 1: Extend the mocked presets and write failing UI assertions**

```ts
await expect(screen.getByText("필수", { exact: true })).toHaveCount(2);
await expect(screen.getByRole("switch", { name: "체중 사용" })).toHaveCount(0);
await expect(screen.getByRole("switch", { name: "체온 사용" })).toHaveCount(0);
await expect(screen.getByRole("button", { name: "체중 작업" })).toHaveCount(0);
await expect(screen.getByRole("button", { name: "심박수 작업" })).toBeVisible();
await expect(screen).toContainText("실제 측정값 입력은 선택입니다.");
```

Also assert `.oi-reorder-alt`, stable computed background/color across hover, `cursor: grab`, visible focus, pointer reorder, and Space/Arrow/Escape keyboard reorder.

- [ ] **Step 2: Write the failing removal flow**

```ts
await screen.getByRole("button", { name: "심박수 작업" }).click();
await page.getByRole("menuitem", { name: "목록에서 제거" }).click();
await expect(screen.getByTestId("vital-setting-row-heart_rate")).toHaveCount(0);
await expect(saveButton).toBeEnabled();

await page.getByRole("button", { name: "되돌리기" }).click();
await expect(screen.getByTestId("vital-setting-row-heart_rate")).toBeVisible();
```

Remove it again, assert it appears in `바이탈 추가`, then save and assert the PUT payload keeps enabled weight/temperature and omits heart rate.

- [ ] **Step 3: Run the focused test and verify red**

```bash
npx playwright test tests/hospital-admin.spec.ts --grep "hospital vital settings" --reporter=line
```

- [ ] **Step 4: Replace the handle using installed assets**

```tsx
const {
  attributes,
  isDragging,
  listeners,
  setActivatorNodeRef,
  setNodeRef,
  transform,
  transition,
} = useSortable({ disabled: !canManage, id: item.key });

<Button
  {...attributes}
  {...listeners}
  aria-label={`${label} 순서 변경`}
  className="size-8 cursor-grab touch-none text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:cursor-grabbing"
  disabled={!canManage}
  ref={setActivatorNodeRef}
  size="icon"
  type="button"
  variant="ghost"
>
  <IconReorderAlt className="size-4" />
</Button>
```

Keep the Button focus ring and existing row-level dragging shadow/ring.

- [ ] **Step 5: Render required metadata, not a disabled switch**

```tsx
<div className="flex justify-center">
  {requiredInWorkspace ? (
    <Badge aria-label={`${label} 항상 사용`} variant="secondary">필수</Badge>
  ) : (
    <Switch
      aria-label={`${label} 사용`}
      checked={item.enabled}
      disabled={!canManage}
      onCheckedChange={onEnabledChange}
    />
  )}
</div>
```

Use this explanatory copy:

```text
체중과 체온은 항상 사용되며, 실제 측정값 입력은 선택입니다. 그립을 잡아 표시 순서를 바꿀 수 있습니다.
```

- [ ] **Step 6: Add the optional-row action menu**

Add a final 40px action column. Required rows render an empty spacer; optional rows render:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger
    render={
      <Button
        aria-label={`${label} 작업`}
        className="size-8 text-muted-foreground"
        disabled={!canManage}
        size="icon"
        variant="ghost"
      />
    }
  >
    <CdsFilesMoreVerticalIcon />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={onRemove} variant="destructive">
      목록에서 제거
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Do not add a second confirmation dialog. Removal is staged and reversible until global save.

- [ ] **Step 7: Implement non-clobbering remove and undo**

```tsx
const removeItem = (key: WorkspaceVitalKey) => {
  const removedIndex = draft.items.findIndex((item) => item.key === key);
  const removedItem = draft.items[removedIndex];
  const preset = draft.presets.find((item) => item.key === key);
  if (!removedItem || !preset || preset.requiredInWorkspace) return;

  setDraft((current) => current ? {
    ...current,
    items: normalizeOrder(current.items.filter((item) => item.key !== key)),
  } : current);

  toast.success(`${preset.label}을 목록에서 제거했어요.`, {
    action: {
      label: "되돌리기",
      onClick: () => setDraft((current) => {
        if (!current || current.items.some((item) => item.key === key)) return current;
        const items = [...current.items];
        items.splice(Math.min(removedIndex, items.length), 0, removedItem);
        return { ...current, items: normalizeOrder(items) };
      }),
    },
  });
};
```

- [ ] **Step 8: Add removal summary to the existing save dialog**

Compare `saved.items` with `draft.items`; only when keys were removed, show `목록에서 제거: 심박수` and:

```text
목록에서 제거한 항목은 신규 입력과 일반 화면에서 숨겨집니다. 기존 기록은 삭제되지 않으며, 바이탈 추가에서 다시 추가할 수 있습니다.
```

Keep disabled-item explanation separate. Never use “기록 삭제”.

- [ ] **Step 9: Verify compact layout and rerun the test**

At `390x844`, reduce responsive padding/gaps or wrap only the list in a labeled horizontal scroll region. Do not shrink action targets below 32px or create document-level overflow.

---

### Task 4: Prove consumer and history behavior without unnecessary production changes

**Files:**
- Test: `tests/reception.spec.ts`
- Test: `tests/chart.spec.ts`
- Inspect: `src/features/reception/module.tsx`
- Inspect: `src/features/chart/preconsultation-context-panel.tsx`

- [ ] **Step 1: Add a reception case with heart rate omitted from settings**

Return required weight/temperature and respiratory rate, but no heart rate. Assert new walk-in entry has no heart-rate input and still allows an empty measurement submission.

- [ ] **Step 2: Add a chart case with historical heart-rate data but no heart-rate setting**

Return an existing measurement containing `heartRateBpm` while settings omit `heart_rate`. Assert chart entry and comparison hide heart rate and the mocked measurement remains unchanged.

- [ ] **Step 3: Re-add heart rate in settings**

Assert the same historical value becomes visible without rewriting the measurement fixture.

- [ ] **Step 4: Run focused consumer tests**

```bash
npx playwright test tests/reception.spec.ts --grep "workspace-configured vitals" --reporter=line
npx playwright test tests/chart.spec.ts --grep "vital" --reporter=line
```

If the shared selector already satisfies the contract, leave consumer production files untouched and record the test-only proof.

---

### Task 5: Synchronize docs and run the complete local gate

**Files:**
- Create: `docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-019-required-vitals-removal-ux.md`
- Modify: `docs/work/index.md`
- Modify: `docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md`
- Modify: `docs/engineering/data-model/patient-vital-measurements.md`
- Modify: `docs/engineering/current-status.md`
- Create after implementation: a dated Korean closeout under `docs/completed/hospital-admin/`

- [ ] **Step 1: Register PR-019**

Link dependency `HOSPITAL-ADMIN-LIVE-PR-018`, use status `implementation`, and copy the constraints and focused commands from this plan.

- [ ] **Step 2: Update design and data truth**

Record that “필수” means always configured/enabled, not mandatory measurement entry; disable and removal differ; removal is staged with toast undo; historical rows remain canonical and untouched; migration-first rollout is required.

- [ ] **Step 3: Run the narrow gate**

```bash
npx playwright test \
  tests/workspace-vital-settings-model.spec.ts \
  tests/workspace-vital-settings-server.spec.ts \
  tests/workspace-vital-settings-migration.spec.ts \
  tests/hospital-admin.spec.ts \
  --grep "workspace vital|hospital vital settings|required" \
  --reporter=line
```

- [ ] **Step 4: Run affected consumer tests**

```bash
npx playwright test \
  tests/reception.spec.ts \
  tests/chart.spec.ts \
  tests/patient-vital-server.spec.ts \
  --grep "vital" \
  --reporter=line
```

- [ ] **Step 5: Run repository checks**

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run docs:check
npm run security:secrets
git diff --check
```

- [ ] **Step 6: Perform manual accessibility checks**

Verify desktop and `390x844`: tab order, required labels, Space/Arrow/Escape sorting, focus restoration after menu, keyboard-reachable undo, transparent hover, visible focus/drag states, and no document-level overflow.

- [ ] **Step 7: Record results without releasing**

Create the Korean closeout only after checks pass. Separate new failures from pre-existing failures. Do not apply remotely, deploy, commit, push, create a PR, or merge in this stage.

---

## Migration And Rollback

1. Apply the additive migration before the new application. The old app ignores the extra JSON property; the new parser expects it.
2. An application rollback remains compatible with the new catalog column and property.
3. Do not drop the column or delete backfilled rows. If policy changes, ship a forward migration that clears required flags and relaxes RPC validation.
4. Preserve existing units and order; append only missing required rows.
5. Prove measurement-row counts are unchanged in the rollback-only replay.

## Definition Of Done

- Weight and temperature cannot be omitted or disabled through UI, TypeScript validation, or SQL RPC.
- Existing and untouched-new workspaces retain valid defaults.
- Optional settings can be disabled, removed, undone, re-added, and saved with normalized ordering.
- The current list icon and hover fill are replaced by the installed six-dot Obra grip with `setActivatorNodeRef`.
- Reception, chart, and patient summaries honor omission and re-addition without modifying historical rows.
- Focused tests, local DB replay, lint, typecheck, build, docs, secret scan, and diff check pass or precisely document pre-existing failures.
- No remote mutation or release action has occurred.
