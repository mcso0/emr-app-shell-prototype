---
type: "design-contract"
title: "Patient and guardian profile side panel"
description: "Shared shell, information hierarchy, interaction, and admin mutation boundary for customer profiles."
tags:
  - "customer"
  - "profile"
  - "side-panel"
  - "permissions"
last_updated: "2026-07-20"
---

# Patient and Guardian Profile Side Panel

## Decision

Patient, guardian, and staff profiles use the same structural right-side profile shell. The shell owns the 380px non-modal frame, header/body/footer regions, scroll containment, close behavior, keyboard Escape behavior, focus entry, and mobile full-width behavior. Domain content, data loading, actions, and permissions remain feature-owned.

## Information Architecture

- Patient and guardian profiles expose two tabs: `프로필` and `이력`.
- Patient `프로필` prioritizes today's visit context, safety/handling information, master data, and guardian relationships.
- Guardian `프로필` prioritizes contact/master data, consent summary, and a collapsible `등록 동물` list. Selecting an animal navigates to that patient profile instead of expanding the full record inline.
- `이력` contains communication history and source-linked recent work. Clinical, test, billing, and consent source records remain read-only projections here.
- Empty, loading, error, no-linked-animal, and unavailable-record states must stay explicit and must not manufacture values.

## Interaction Contract

- The panel is non-modal: no dimmed overlay, focus trap, or background interaction lock.
- Desktop width is `--emr-profile-panel-width` (380px); mobile uses the available full width.
- Close receives initial focus, Escape closes the panel, and navigation between patient and guardian replaces the current profile in the same panel layer.
- Master-data editing starts from the sticky footer. Save and cancel stay visible while editing.
- Guardian and patient lists use the existing `EmrSidePanelCollapsibleGroup` contract.

## Permission and Data Boundary

- Read: active workspace member with `patient:view`.
- Patient master-data edit: active `hospital_admin` with `patient_profile:manage`.
- Guardian master-data edit: active `hospital_admin` with `guardian_profile:manage`.
- Patient-guardian link, primary change, and unlink: active `hospital_admin` with `patient_guardian_relationship:manage`.
- The three management permissions are not part of the safe custom-role catalog. UI visibility is convenience only; API permission checks and database RLS are authoritative.
- Relationship mutations validate both subjects in the same workspace and execute primary changes transactionally. A patient cannot lose its only/primary guardian through unlink.
- Successful DB mutations write a redacted audit entry with actor, workspace, subject, changed field names, time, request correlation id, and result. Field names such as `mobile_phone` may appear so reviewers can tell what changed, but raw phone, email, address, memo, cash-receipt, and resident-identifier values are never stored in the change payload.

## Shared Shell Boundary

`EmrProfileSidePanelShell` is structural. It must not own staff, patient, or guardian APIs; domain-specific permissions; business actions; or field layouts. This keeps the visual hierarchy consistent without coupling unrelated profile domains.
