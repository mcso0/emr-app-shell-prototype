---
id: PRODUCT-DOMAIN-ROLE-PERMISSION-SOURCE-MAP
type: Domain Map
title: Role And Permission Source Map
status: approved
area: product
doc_type: domain-map
related_work:
  - DEN-178
  - AUTH-PR-044
supersedes: []
superseded_by: []
last_updated: 2026-07-02T00:00:00.000Z
description: >-
  Defines canonical role and permission truth sources and change gates for CLAiR
  EMR.
tags:
  - domain
  - roles
  - permissions
  - workspace-auth
---

# Role / Job Position Source Map

This document normalizes where CLAiR EMR role and permission truth lives. Use it before changing role labels, permission checks, workspace membership behavior, or admin UI.

## Canonical Product Source

The canonical product source for roles and workspace permissions is [Workspace Auth and Permission Domain](workspace-auth-permissions.md).

Current MVP permission roles:

* `소유자`
* `관리자`
* `일반`
* `커스텀 역할`

Current MVP default job positions / 기본 직무:

* `병원장`
* `수의사`
* `테크니션`
* `데스크`

`게스트` is excluded from MVP permission roles. Guest-style limited read access requires a later privacy and chart-scope decision.

Known legacy or compatibility names:

* `hospital_admin` maps to owner/admin compatibility during additive migration and must keep last-active-owner safety intact.
* `vet`, `technician`, and `front_desk` are legacy role strings. They may inform default backfill, but the product model treats `수의사`, `테크니션`, and `데스크` as job positions rather than permission roles.
* `nurse` should map conceptually to `technician` compatibility data only.
* `billing_admin` is not a canonical MVP role. Billing authority should be assigned through approved permission roles or custom roles until a separate billing role is approved.

## Source Responsibilities

| Source                       | Owns                                                                                                  | Does not own                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Product role/permission docs | Permission role meanings, job position meanings, user-facing matrix, policy decisions, approval gates | Implementation details or hidden client-only checks  |
| App DB / membership records  | Active workspace membership, assigned permission role, job position, membership status                | Password identity or user-editable profile authority |
| Permission resolver          | Effective permission union, denial reasons, server-side authorization decision                        | Product policy invention                             |
| Client UI                    | Helpful visibility, disabled states, labels, explanation                                              | Final security enforcement                           |
| Audit events                 | Evidence of sensitive mutations and denials                                                           | Raw secrets, tokens, full clinical note bodies       |

## Product Rules

* Workspace membership is the authorization source.
* Membership, permission-role, job-position, and invitation lifecycle follows [Membership, Permission Role, and Job Position Lifecycle](membership-role-job-lifecycle.md).
* Personal profile is never the authorization source.
* Permission role and job position / 직무 are separate concepts.
* Job position / 직무 is display/filter metadata and is not a general authorization source. `vital:write` is the approved clinical exception: the server requires both that permission and a veterinarian or technician job position, with legacy role-string fallback during migration.
* MVP permission roles are allow-only. Do not add deny rules without a product decision.
* Every active workspace must retain at least one active `소유자`.
* Custom roles cannot grant owner-only authority, wildcard authority, or cross-workspace authority.
* Custom-role deactivation requires an active same-workspace replacement for non-archived memberships and pending invitations; archived memberships preserve historical role attribution.
* Job-position deactivation preserves existing member assignments, blocks new selection, and requires replacement only for affected pending invitations.
* Role/permission policy changes require explicit 승욱 approval.

## Required Link Targets

Use these docs instead of rediscovering the same policy:

* [Workspace Auth and Permission Domain](workspace-auth-permissions.md)
* [SaaS Launch Role Permission Matrix](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/saas-launch-role-permission-matrix.md)
* [SaaS Operating Map](../service/clair-emr-saas-operating-map.md)
* [Product MVP Scope](../roadmap/product-mvp-scope.md)
* [SaaS Launch Approval Gates](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md)
* [Supabase Auth Mapping](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/supabase-auth-mapping.md)
* [DB-backed Permission Adapter](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/db-backed-permission-adapter.md)

## Change Gate

Before any role/permission change, answer:

1. Is this a label, UX, resolver, DB, or policy change?
2. Does it alter canonical permission roles, default job positions, or the permission matrix?
3. Does it affect `소유자` authority or last-owner protection?
4. Does it change who can mutate chart, order, billing, audit, or membership state?
5. Is explicit 승욱 approval required by launch gates?

If the change alters policy, stop and ask before implementation.
