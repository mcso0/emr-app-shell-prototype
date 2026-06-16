---
id: PRODUCT-DOMAIN-WORKSPACE-HOSPITAL-PROFILE
type: Domain Contract
title: "Workspace Hospital Profile"
description: "Defines workspace-owned hospital profile and basic hospital settings product data requirements."
status: approved
area: product
doc_type: domain-contract
tags: [domain, workspace, hospital-profile, onboarding, settings]
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-06-12
---

# Workspace Hospital Profile

Updated: 2026-06-12

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
| Contact | Representative phone number, representative contact number, fax number | Phone required; fax optional |
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
- Real hospital data must not be added to fixtures or docs without explicit approval.
