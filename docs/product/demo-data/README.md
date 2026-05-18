---
title: "Portfolio Demo Data"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Portfolio Demo Data

This folder defines the synthetic demo dataset for the CLAiR EMR portfolio MVP.

## Purpose

승욱의 현재 목표는 production launch가 아니라, 실제 업무 프로그램처럼 작동하는 고완성도 포트폴리오 MVP다. 이 데이터셋은 접수, 차트, 오더, 검사, 영상, 조제, 처치, 수납이 하나의 outpatient workflow로 이어지는 모습을 보여주기 위한 기준이다.

## Ground Rules

- Use synthetic guardians, patients, staff, encounters, orders, diagnoses, results, and invoices.
- Do not use real hospital, client, patient, or identifiable medical data.
- Use public veterinary guidelines and terminology resources only as design references.
- Do not claim medical accuracy, dosage safety, diagnosis correctness, or clinical decision support.
- Keep all demo cases resettable and repeatable.
- Make `encounterId` and `workspaceId` the core linkage for downstream chart/order/billing flows.

## Documents

| Document | Purpose |
| --- | --- |
| `research-notes.md` | Public reference sources and synthesis rules |
| `virtual-hospital-profile.md` | VIP동물의료센터 청담점 synthetic hospital concept |
| `demo-scenarios-v1.md` | Representative outpatient scenarios |
| `order-catalog-v1.md` | Individual order catalog baseline |
| `order-sets-and-templates-v1.md` | Order sets and clinical templates |
| `diagnosis-catalog-v1.md` | Diagnosis systems and sample diagnoses |
| `staff-roles-workflow-v1.md` | Staff roles and workflow ownership |
| `seed-handoff-v1.md` | Handoff from product docs to app mock/seed data |

## MVP Data Shape

The portfolio demo should show:

1. Login into a workspace.
2. Role-aware access for desk, vet, technician, billing, and admin users.
3. Reception creates or checks in an encounter.
4. Chart uses diagnosis and order catalogs.
5. Orders fan out into lab, imaging, dispensing, treatment, or billing work.
6. Results and completion states flow back to the chart.
7. Billing receives invoice lines from confirmed orders.
8. Audit-style activity records show who changed what and when.

## Out Of Scope

- Real patient data.
- Real hospital import.
- Production clinical safety.
- Payment provider integration.
- PACS or device integration.
- Full veterinary terminology licensing and import.
- National-scale diagnosis or drug dictionary.

## Changelog

- 2026-05-19: Created DEN-99 synthetic virtual hospital demo dataset foundation.
