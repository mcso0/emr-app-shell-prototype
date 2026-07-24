---
id: PRODUCT-DOMAIN-WORKSPACE-HOSPITAL-PROFILE
type: Domain Contract
title: "Workspace Hospital Profile"
description: "Defines workspace-owned hospital profile and basic hospital settings product data requirements."
status: approved
area: product
doc_type: domain-contract
tags: [domain, workspace, hospital-profile, onboarding, settings]
related_work:
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-PR-007-hospital-settings-screen-split.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-021-hospital-profile-contact-persistence.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-022-hospital-logo-storage.md"
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-023-workspace-logo-shell-linkage.md"
supersedes: []
superseded_by: []
last_updated: 2026-07-24
---

# Workspace Hospital Profile

Updated: 2026-07-24

This document is the product source of truth for the hospital profile and basic hospital settings owned by a workspace. It defines product data requirements only; schema, migrations, RLS, and API implementation belong in engineering docs.

## Product Purpose

Hospital admins need one place in `병원관리` to review and maintain the hospital identity and contact information used across the EMR, onboarding, customer-facing documents, and future referral surfaces.

## Phase 1 Hospital Basic Settings

The hospital profile should include:

| Field group | Fields | Requirement |
| --- | --- | --- |
| Identity | Hospital name, workspace ID | Required |
| Location | Hospital address | Required |
| Brand assets | Symbol, logo | Optional but recommended |
| Contact | Representative phone number, fax number, homepage, Instagram, customer guidance memo | Phone required; the remaining fields are optional |
| Representative | Owner/director name or business representative name | Required |
| Business | Business registration number | Required when business/legal setup is in scope |
| Public links | Hospital URL, homepage, Instagram, and other social/profile URLs | Optional |
| Operations | Operating hours and basic operational settings | Required for onboarding, editable later |

CLAiR operations may prefill these values during B2B implementation. The first hospital admin should be able to confirm or edit them during onboarding or later from hospital settings.

## Deferred Referral Settings

Referral settings are a later product scope, not a phase-1 hospital basic settings requirement.

Future referral settings may include:

- Whether the hospital accepts external referral requests.
- Referral intake URL.
- Referral account creation URL.
- Referral owner or 담당자 assignment.
- Referral department/specialty configuration.
- Hospital introduction text.
- Referral 안내 text.

Do not implement or require referral settings until a separate referral workflow spec is approved.

## Product Boundaries

- This doc does not define public marketing pages.
- This doc does not define referral workflow, referral account policy, or external hospital collaboration.
- This doc does not define DB schema, storage buckets, file validation, or image upload implementation.
- The current engineering contract for the implemented workspace-scoped persistence boundary is `docs/engineering/data-model/workspace-hospital-settings.md`.
- Real hospital data must not be added to fixtures or docs without explicit approval.
