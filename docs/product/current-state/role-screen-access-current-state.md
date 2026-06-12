# Role Screen Access Current State

Updated: 2026-06-12

This document records the current implemented module list and how it should be compared against the product role/permission v1. It is an inventory layer, not the canonical policy. Canonical policy lives in [Workspace Auth and Permission Domain](../domain/workspace-auth-permissions.md).

## Implemented Workspace Modules

Current workspace modules from the app registry:

| Route module | User-facing label | Current product area |
| --- | --- | --- |
| `home` | 원내 현황 | Home/work dashboard |
| `reception` | 접수/예약 | Reception, appointment, walk-in, patient/guardian entry |
| `treatment` | 진료/차트 | Chart, SOAP, diagnosis, order request |
| `lab` | 검사 | Clinical pathology/lab work queue |
| `imaging` | 영상 | Imaging work queue |
| `dispensing` | 조제 | Dispensing and treatment fulfillment surface |
| `billing` | 수납 | Billing, checkout, payment state |
| `customer` | 고객관리 | Guardian/patient master data |
| `orders` | 병원관리 | Hospital admin, order catalog, members, audit, settings placeholders |
| `inpatient` | 입원 | Inpatient board and care surface |

## Current Implementation Notes

- Current mock capabilities are still coarser than the product matrix.
- Current demo/mock role names include legacy compatibility names such as `nurse` and `billing_admin`.
- The product canonical roles remain `hospital_admin`, `vet`, `technician`, and `front_desk`.
- `billing_admin` should not be treated as a product role unless a later decision introduces a separate large-hospital billing role.
- Hospital admin surfaces currently include `병원기본설정`, `병원구성원 관리`, `감사 로그`, `Order 관리`, and several future menu placeholders.
- Current `/workspace/new` workspace creation is a prototype/local-first flow and does not fully match the agreed B2B baseline where CLAiR operations creates the workspace first.

## Comparison Against Product V1

| Area | Product v1 expectation | Current-state risk |
| --- | --- | --- |
| Reception/appointment | 데스크 owns create/edit; 수의사/테크니션 can view operational context. | Current mock capabilities allow broad reception visibility, but exact create/edit gating needs server-backed verification per route. |
| Chart/SOAP/diagnosis | 수의사 owns clinical authoring; 테크니션/데스크 should not author diagnosis or SOAP. | Current UI should be checked screen by screen before claiming final clinical mutation enforcement. |
| Lab/imaging | 수의사 can request/review; 테크니션 can execute/complete operational work. | Product distinction between review/approve and complete/status update needs later implementation detail. |
| Dispensing/treatment | 수의사 can request/review; 테크니션 can complete assigned fulfillment work. | Controlled substance workflows are explicitly out of phase 1. |
| Billing | 데스크 can perform front-office checkout; 병원관리자 can administer/refund; 수의사 is view-only. | Current legacy `billing_admin` demo role can view billing but is not a product role. |
| Hospital admin | 병원관리자 owns settings, members, roles, audit, and order catalog. | Current menu contains placeholders beyond phase-1 confirmed behavior. |
| Hospital profile | 병원관리자 owns edit; others should not edit. | Hospital profile source doc exists, but full UI implementation is not confirmed in this inventory. |

## Next Planning Need

Before implementation work, convert the product matrix into route/API permission IDs and verify:

- which screens hide or disable actions by role
- which server routes enforce the same permissions
- which DB/RLS rules are required for production security
- which demo-only aliases remain for Sales Demo compatibility
