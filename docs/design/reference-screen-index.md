---
id: DESIGN-REFERENCE-SCREEN-INDEX
status: approved
area: design
doc_type: screen
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-05-06
---

# Reference Screen Index

Updated: 2026-05-06

This index records the screenshots reviewed during MVP planning. The images are workflow and layout references only. They are not pixel-perfect implementation specs.

## Current Asset Status

PR7 has started capturing binary reference images under `docs/design/assets/reference-screens/*`. At this point, only the 접수/예약 reception form drawer capture is present. Rows marked reference missing are still planned paths and must not be described as pixel-level alignment sources.

## Usage Rules

- Use project foundation, tokens, and existing components first.
- Do not copy screenshots 1:1.
- Hospital admin Order 관리 / Order 세트 examples are reference only in PR 1-6.
- Binary screenshots from chat must be exported or copied into the paths below if persistent visual lookup is needed.
- If a listed file does not exist, treat the row as a planned reference path, not an available asset.

## Index

| Area | Reference file | Notes |
|---|---|---|
| 접수/예약 | `docs/design/assets/reference-screens/reception/reception-calendar-day.png` | Reference missing. Day calendar layout reference. |
| 접수/예약 | `docs/design/assets/reference-screens/reception/reception-calendar-week.png` | Reference missing. Week calendar density reference. |
| 접수/예약 | `docs/design/assets/reference-screens/reception/reception-calendar-month.png` | Reference missing. Month summary reference. |
| 접수/예약 | `docs/design/assets/reference-screens/reception/reception-form-drawer.png` | Exists. Captured from Figma node `3600:14339`; walk-in reception drawer reference for field density, header/footer spacing, and action hierarchy. |
| 접수/예약 | `docs/design/assets/reference-screens/reception/reception-current-time-line.png` | Reference missing. Current-time line alignment reference. |
| 접수/예약 | `docs/design/assets/reference-screens/reception/reception-toolbar-tabs.png` | Reference missing. Toolbar and side-panel tab feedback reference. |
| 진료(차트) | `docs/design/assets/reference-screens/chart/chart-workspace.png` | Chart workspace reference. |
| 진료(차트) | `docs/design/assets/reference-screens/chart/chart-queue-side-panel.png` | Contracted treatment queue reference. |
| 임상병리/계통 검사 | `docs/design/assets/reference-screens/lab/lab-result-entry.png` | Result entry workflow reference. |
| 영상검사 | `docs/reference/imaging/imaging-workspace-wireframe.html` | Generated HTML wireframe from the chat-provided imaging reference. Chat screenshot is not stored as a binary asset, so this is not a pixel-level reference. |
| 수납 | `docs/design/assets/reference-screens/billing/billing-waiting-unpaid.png` | Billing wait/unpaid workflow reference. |
| 입원 | `docs/reference/inpatient/inpatient-workspace-wireframe.html` | Generated HTML wireframe from the chat-provided admission reference. Chat screenshot is not stored as a binary asset, so this is not a pixel-level reference. |
| 고객관리 | `docs/reference/customer/customer-management-wireframe.html` | Generated HTML wireframe from the chat-provided customer management references. Chat screenshots are not stored as binary assets, so this is not a pixel-level reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/patient-drawer-read-edit.png` | Patient drawer read/edit reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/guardian-drawer-read-edit.png` | Guardian drawer read/edit reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/patient-guardian-links.png` | Patient-guardian relationship management reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/new-patient-modal.png` | New patient registration modal reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/new-patient-rules.png` | Registration validation notes reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/cs-history.png` | CS history reference. |
| 환자/보호자 | `docs/design/assets/reference-screens/patient-guardian/latest-work-shortcuts.png` | Latest work shortcut reference. |
| 병원관리 reference | `docs/design/assets/reference-screens/hospital-admin-reference/order-management-reference.png` | Order management reference only. |
| 병원관리 reference | `docs/design/assets/reference-screens/hospital-admin-reference/order-editor-reference.png` | Order editor reference only. |
| 병원관리 reference | `docs/design/assets/reference-screens/hospital-admin-reference/order-set-reference.png` | Order set reference only. |
| 병원관리 reference | `docs/design/assets/reference-screens/hospital-admin-reference/order-set-editor-reference.png` | Order set editor reference only. |
