---
id: "STUDY-CURRICULUM"
type: "Study Plan"
title: "CLAiR EMR Study Curriculum"
description: "Recommended non-developer learning path for understanding CLAiR EMR from product workflow to code structure."
status: "active"
area: "study"
doc_type: "study-plan"
tags: ["study", "curriculum", "owner-learning"]
last_updated: "2026-06-17"
---

# CLAiR EMR Study Curriculum

This curriculum starts from the service model, then moves into data, permissions, backend, and frontend code. The goal is not to turn 승욱 into a full-time engineer; the goal is to make product, design, and implementation conversations clearer.

## Learning Order

| Step | Topic | Core question | Project docs to pair with |
| --- | --- | --- | --- |
| 1 | EMR domain basics | What is the work unit of this service? | `docs/product/domain/emr-domain-entity-map.md` |
| 2 | Outpatient workflow | How does reception become charting, orders, and billing? | `docs/product/domain/outpatient-workflow-state-model.md` |
| 3 | Data relationships | How do workspace, patient, encounter, order, and invoice connect? | `docs/engineering/data-model/README.md` |
| 4 | Multi-tenant SaaS | How can many hospitals share one app without sharing data? | `docs/product/service/clair-emr-saas-operating-map.md` |
| 5 | Roles and permissions | Who can do what inside a workspace? | `docs/product/domain/role-permission-source-map.md` |
| 6 | Mock, local-first, live | What can the app claim right now? | `docs/engineering/architecture/mock-live-boundary-map.md` |
| 7 | Supabase and PostgreSQL | What are tables, rows, foreign keys, migrations, RLS, and seed data? | `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md` |
| 8 | Next.js app structure | Where do pages, API routes, server logic, and client UI live? | `src/app`, `src/features`, `src/lib` |
| 9 | React UI structure | How do components, props, state, and events make screens work? | `src/features/reception`, `src/components` |
| 10 | CLAiR UI system | How do shadcn primitives, EMR components, and Storybook fit together? | `src/components/ui`, `src/components/emr`, Storybook |

## First Five Lessons

1. **Patient, Appointment, Encounter, Queue Entry, Order**
   - Understand the smallest workflow units.
   - Explain why `patient` is not enough.

2. **Reception To Billing Spine**
   - Walk through check-in, charting, order request, fulfillment, invoice, and audit.
   - Separate clinical state from queue display state.

3. **Workspace And Membership**
   - Explain multi-tenant isolation in plain language.
   - Separate login identity from workspace authority.

4. **Schema And Tables**
   - Read a table definition.
   - Understand primary key, foreign key, nullable field, enum-like status, and JSONB at a high level.

5. **Next.js In This Repo**
   - Find the route for a page.
   - Find the feature module behind a screen.
   - Find the API route or server helper behind a live/local-first behavior.

## Study Routine

Each study session should follow this rhythm:

1. Start with one project question.
2. Read the smallest relevant doc or code slice.
3. Let 승욱 explain the concept in his own words.
4. 루멘 confirms, corrects, and adds a small diagram.
5. Save the lesson under `docs/study/sessions/`.
6. Add two or three review questions for the next session.

## Completion Standard

승욱 understands a topic when he can explain:

- what object or workflow state the concept belongs to
- which screen or module uses it
- which data object stores or represents it
- which role or boundary can affect it
- whether the current project behavior is mock, local-first, remote staging, or production/live
