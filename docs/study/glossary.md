---
id: "STUDY-GLOSSARY"
type: "Study Reference"
title: "Study Glossary"
description: "Owner-friendly glossary for recurring CLAiR EMR product and engineering terms."
status: "active"
area: "study"
doc_type: "glossary"
tags: ["study", "glossary", "emr-domain"]
last_updated: "2026-06-17"
---

# Study Glossary

This glossary explains project terms in owner-friendly language. It is a study aid, not the canonical product or engineering source of truth.

## EMR Domain Terms

| Term | Plain meaning | CLAiR EMR mental model |
| --- | --- | --- |
| `workspace` | One hospital's working space inside the SaaS | The tenant boundary. Live-capable data must belong to a workspace. |
| `user` | A person who can log in | Login identity alone does not grant hospital access. |
| `membership` | A user's active relationship to a workspace | This is where workspace authority comes from. |
| `role` | A named job/authority set | Current MVP roles include `hospital_admin`, `vet`, `technician`, and `front_desk`. |
| `permission` | A specific allowed action | Example: view billing, mutate chart, invite staff, review audit. |
| `guardian` | 보호자 or customer contact | The person responsible for the animal patient. |
| `patient` | Animal patient | The animal receiving care across many visits. |
| `appointment` | Scheduled visit | A future or planned visit that may become an encounter. |
| `encounter` | One real visit/work episode | The core outpatient work unit after check-in or walk-in reception. |
| `queue entry` | A row in an operational work list | Shows where an encounter or order is waiting or being processed. |
| `SOAP note` | Clinical chart note | Subjective, Objective, Assessment, Plan record for an encounter. |
| `order` | Requested work | Lab, imaging, dispensing, treatment, or another billable/support action requested from charting. |
| `result` | Output of an order | Example: manually entered lab result or imaging review output. |
| `invoice` | Billing document for the encounter | Groups billable lines and payment state. |
| `invoice line` | One charge line | Usually linked to an order, service item, or explicit manual billing decision. |
| `payment` | Payment state record | Current demo/local work can use synthetic payment; this is not a real provider confirmation. |
| `audit event` | Important change history | Records who changed what, when, and in which workspace without exposing secrets. |

## Technical Terms

| Term | Plain meaning | CLAiR EMR mental model |
| --- | --- | --- |
| Next.js | React-based web app framework | Handles pages, routing, server rendering, and API routes in this repo. |
| React | UI component library | Lets us build screens from reusable components. |
| TypeScript | JavaScript with types | Helps catch wrong data shapes before runtime. |
| schema | Data structure plan | Tables, fields, relationships, constraints, and status values. |
| table | Structured data list | Like a spreadsheet with strict columns and rules. |
| row | One record in a table | Example: one patient, one encounter, one invoice. |
| primary key | Row identity | Usually an `id` field that uniquely identifies one row. |
| foreign key | Link to another table | Example: `encounter.patient_id` links an encounter to a patient. |
| migration | Versioned DB change | A repeatable file that changes tables, indexes, RLS, or database logic. |
| seed data | Synthetic starter data | Local/demo data used to test flows without real hospital data. |
| RLS | Row Level Security | Database rule that decides which rows a user can access. |
| API route | Server endpoint inside the app | A route that reads or mutates data behind a server boundary. |
| client component | Browser-interactive React component | Used for search inputs, filters, clicks, local UI state, and browser APIs. |
| server component | Server-rendered React component | Used to read files/data safely and reduce browser JavaScript. |

## Key Distinctions

| Pair | Difference |
| --- | --- |
| `patient` vs `encounter` | `patient` is who the record is about. `encounter` is the specific visit/work episode. |
| `appointment` vs `encounter` | `appointment` is planned. `encounter` starts when the visit is actually handled. |
| `encounter` vs `queue entry` | `encounter` is the work episode. `queue entry` is a display/operations row for handling it. |
| `order` vs `result` | `order` is the request. `result` is the output or completion evidence. |
| role vs permission | Role is a named set. Permission is the concrete action allowed by that role. |
| mock vs local-first | Mock is browser/session or fixture behavior. Local-first crosses local app/API/DB boundaries with synthetic data. |
