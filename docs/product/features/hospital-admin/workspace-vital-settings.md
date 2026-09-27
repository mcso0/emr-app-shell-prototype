---
id: PRODUCT-HOSPITAL-ADMIN-WORKSPACE-VITAL-SETTINGS
type: Feature Spec
title: "Workspace Vital Settings"
description: "Workspace-wide vital presets, order, visibility, and display-unit behavior for hospital settings and clinical entry surfaces."
status: approved
area: product
doc_type: feature-spec
tags: [hospital-admin, vitals, workspace-settings, reception, chart]
related_work:
  - "HOSPITAL-ADMIN-LIVE-PR-018"
  - "HOSPITAL-ADMIN-LIVE-PR-019"
  - "HOSPITAL-ADMIN-PR-008"
  - "HOSPITAL-ADMIN-LIVE-PR-024"
  - "RECEPTION-QA-PR-014"
last_updated: 2026-09-27
---

# Workspace Vital Settings

## Goal

Give each hospital one workspace-wide list of vital fields. Administrators choose which product presets the hospital uses, their order, and supported display units. Reception and chart entry surfaces consume the same saved configuration.

## Product Contract

- Scope is one configuration per workspace. It is not user-, role-, room-, or species-specific.
- Members with `hospital_settings:view` can read the configuration. Only members with `hospital_settings:manage` can save it.
- Each configured preset has independent `enabled` and `inputRequired` states. Only an enabled preset may be required. All five presets can be disabled or removed.
- Disabling or removing a preset hides it from new entry and current summary surfaces. Existing measurements remain stored and reappear when the preset is enabled or added again.
- Product presets are curated centrally. Workspace users cannot create arbitrary field definitions.
- The first supported preset catalog is `weight`, `temperature`, `heart_rate`, `respiratory_rate`, and `blood_pressure`.
- New workspaces receive all five presets in catalog order, enabled with `inputRequired: false`.
- Blood pressure is one workspace setting. When optional, systolic alone is valid and diastolic cannot exist without systolic. When required, both systolic and diastolic values must be entered.
- Current workspace requirements apply to reception, chart creation, and chart edits, including edits to older measurements. Read-only history is unaffected.

## Units And Storage

| Preset           | Canonical storage | Allowed display/input units |
| ---------------- | ----------------- | --------------------------- |
| Weight           | `kg`              | `kg`, `g`                   |
| Temperature      | `°C`              | `°C`, `°F`                  |
| Heart rate       | `bpm`             | `bpm`                       |
| Respiratory rate | `rpm`             | `rpm`                       |
| Blood pressure   | `mmHg`            | `mmHg`                      |

Storage remains canonical. The UI converts grams to kilograms and Fahrenheit to Celsius before writes, then converts canonical values back to the configured unit for display. Unit changes do not rewrite historical measurement rows.

## Reception Entry Feedback

- Empty measurements remain neutral for optional presets. Required presets show a label marker and a field error when empty.
- Invalid formats, non-positive values, unsupported precision, storage overflow, diastolic-only blood pressure, and diastolic values greater than or equal to systolic values block creation with field-level errors.
- Dog and cat values far outside broad input-plausibility guardrails show a warning but remain creatable through `확인하고 생성`. This is an entry-review aid, not a diagnosis or clinical decision-support rule.
- The initial broad guardrails are weight below `0.05 kg` or above `200 kg`, temperature below `30°C` or above `45°C`, heart rate below `20 bpm` or above `400 bpm`, respiratory rate below `5 rpm` or above `200 rpm`, systolic pressure below `20 mmHg` or above `400 mmHg`, and diastolic pressure below `10 mmHg` or above `300 mmHg`.
- When a prior weight exists, a new value below one quarter or above four times that weight also receives a unit-and-measurement warning.
- Server-returned vital field errors remain linked to their inputs. Unknown creation failures preserve the draft and ask the user to retry.

## Settings UX

- The page uses the shared hospital-settings constrained content width (`max-width: 720px`).
- The clean state follows CDS V2 Figma node `27804:117826` and keeps page-header actions hidden. Once the draft changes, the shared hospital-settings change bar exposes `변경 전으로 되돌리기` and `변경사항 저장`.
- `변경 전으로 되돌리기` confirms before restoring the last saved snapshot.
- `변경사항 저장` opens a confirmation dialog that names the enabled vital list and explains that reception/chart input will change while historical records remain.
- `사용할 바이탈 목록` contains the only `바이탈 추가` action, placed in the card footer.
- Every row exposes a six-dot drag handle, display-unit control, `활성` switch, and action menu. `inputRequired` rows show a `필수 입력` badge with a tooltip explaining the entry requirement.
- The action menu changes between `필수 입력으로 설정` and `필수 입력 해제`, plus `삭제하기`. Unit changes remain in the existing unit select; the separate unit-setting menu is outside this slice.
- Disabling a required row asks for confirmation, then clears both `enabled` and `inputRequired`. Requiring a disabled row asks for confirmation, then enables both. Cancel leaves the draft unchanged.
- Removing any row asks for confirmation, then changes only the draft and offers toast undo. Existing measurements remain. Re-adding starts enabled and optional with the canonical unit at the bottom of the list.
- Reordering must support pointer, touch, and keyboard interaction through a maintained drag-and-drop library.

## Data And Audit

- A product preset table owns labels, descriptions, canonical units, supported units, and default order/state.
- A workspace setting table owns inclusion, enabled state, input requirement, display unit, and sort order. A saved empty configuration remains empty rather than falling back to defaults.
- Reads are workspace-member scoped. Replacement is server-authorized, actor-bound, validated against the preset catalog, and audit-emitting.
- Server entry validation and a database write boundary enforce current requirements. Existing incomplete historical rows are checked only if edited; setting changes do not rewrite them.
- Direct browser writes to configuration tables are not an accepted security boundary.

## Out Of Scope

- Diagnostic normal ranges, severity classification, or clinical decision support.
- Workspace-configurable, breed-, age-, weight-class-, stress-, anesthesia-, or inpatient-context thresholds.
- Arbitrary user-created vital definitions.
- Destructive deletion of historical patient vital measurements.
