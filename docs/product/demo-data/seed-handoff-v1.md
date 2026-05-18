---
title: "Seed Handoff V1"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Seed Handoff V1

This document maps the product demo-data docs to future app mock, seed, and persistence work.

## Target Data Families

| Product Doc | Future Mock/Seed Target | Notes |
| --- | --- | --- |
| `virtual-hospital-profile.md` | workspace, staff, rooms, role memberships | Use `vip-cheongdam-demo` as portfolio workspace |
| `demo-scenarios-v1.md` | guardians, patients, appointments, encounters, queue rows | Each scenario must have deterministic IDs |
| `order-catalog-v1.md` | service categories, service items, prices, order catalog | Separate standard preset from workspace override |
| `order-sets-and-templates-v1.md` | order sets, set items, clinical templates | Template expansion should create draft orders only |
| `diagnosis-catalog-v1.md` | diagnosis systems, diagnosis catalog, diagnosis aliases | Free-text diagnosis remains allowed |
| `staff-roles-workflow-v1.md` | role permissions, task ownership, audit seed | Existing role model should remain source of auth truth |

## Suggested Deterministic IDs

| Entity | Prefix | Example |
| --- | --- | --- |
| Workspace | `workspace-` | `workspace-vip-cheongdam` |
| Staff | `staff-` | `staff-vet-yuji` |
| Guardian | `guardian-` | `guardian-kim-haneul` |
| Patient | `patient-` | `patient-kong` |
| Encounter | `encounter-` | `encounter-kong-260501` |
| Appointment | `appointment-` | `appointment-kong-260501` |
| Order catalog | `ord-` | `ord-lab-cbc` |
| Order set | `set-` | `set-vomit-basic` |
| Template | `tpl-` | `tpl-gi-vomit` |
| Diagnosis | `dx-` | `dx-acute-gi-suspect` |
| Invoice | `invoice-` | `invoice-kong-260501` |

## Implementation Order

1. Add static demo-data seeds to mock domain data.
2. Add order catalog lookup that supports individual orders, sets, and templates.
3. Add diagnosis catalog lookup and catalog-linked/free-text distinction.
4. Connect chart order add UI to catalog source.
5. Connect confirmed orders to destination work queues.
6. Connect confirmed orders to billing invoice candidates.
7. Add resettable portfolio scenario launcher.

## Data Safety

- Keep all records synthetic.
- Do not import real clinical records.
- Do not store credentials, secrets, or external API keys in seed files.
- Mark public guideline references as inspiration only.
- Do not represent drug dose, diagnosis, or treatment as authoritative.

## Follow-Up Linear Candidates

| Suggested Issue | Project Placement | Purpose |
| --- | --- | --- |
| `00-04 Add demo data seed contract to clinical billing schema` | Project 04 / 00 milestone | Align schema with standard/workspace order catalog and diagnosis catalog |
| `02-00 Build catalog-backed chart order add flow` | Project 04 / 02 milestone | Let chart use individual orders, sets, and templates |
| `03-00 Fan out confirmed orders to lab imaging dispensing treatment queues` | Project 04 / 03 milestone | Make order workflow feel like a real hospital program |
| `05-00 Add portfolio scenario reset and QA checklist` | Project 05 | Validate the whole portfolio story |
