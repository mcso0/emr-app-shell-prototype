---
id: "STUDY-DIAGRAMS"
type: "Study Reference"
title: "Study Diagrams"
description: "Study-oriented diagrams for CLAiR EMR workflow, entities, tenancy, and app structure."
status: "active"
area: "study"
doc_type: "diagram-reference"
tags: ["study", "diagrams", "emr-domain"]
last_updated: "2026-06-17"
---

# Study Diagrams

These diagrams are simplified learning aids. Product and engineering source-of-truth diagrams remain in `docs/product` and `docs/engineering`.

## Outpatient Work Spine

```mermaid
flowchart LR
  Appointment["Appointment\nplanned visit"] --> Encounter["Encounter\nreal visit work unit"]
  WalkIn["Walk-in reception"] --> Encounter
  Encounter --> Chart["SOAP / Chart"]
  Chart --> Order["Order request"]
  Order --> Result["Result / fulfillment"]
  Order --> Invoice["Invoice candidate"]
  Result --> Invoice
  Invoice --> Payment["Payment / unpaid closure"]
  Payment --> Audit["Audit event"]
```

Study note:

- Appointment is a possible future visit.
- Encounter is the actual visit work unit.
- Orders and billing should stay connected to the encounter.

## Entity Relationship Learning Map

```mermaid
erDiagram
  WORKSPACE ||--o{ USER_MEMBERSHIP : contains
  WORKSPACE ||--o{ PATIENT : owns
  WORKSPACE ||--o{ GUARDIAN : owns
  GUARDIAN ||--o{ PATIENT_GUARDIAN : links
  PATIENT ||--o{ APPOINTMENT : schedules
  APPOINTMENT ||--o| ENCOUNTER : checks_in_to
  PATIENT ||--o{ ENCOUNTER : visits
  ENCOUNTER ||--o{ SOAP_NOTE : records
  ENCOUNTER ||--o{ ORDER : requests
  ORDER ||--o{ RESULT : produces
  ENCOUNTER ||--o{ INVOICE : bills
  INVOICE ||--o{ INVOICE_LINE : contains
  WORKSPACE ||--o{ AUDIT_EVENT : records
```

Study note:

- Workspace is the tenant boundary.
- Encounter is the outpatient workflow context.
- Patient and guardian are reusable master records, not the visit itself.

## Queue Entry Mental Model

```mermaid
flowchart TD
  Encounter["Encounter\nKongi vomiting visit"] --> ReceptionQueue["Reception queue entry"]
  Encounter --> ConsultQueue["Consultation queue entry"]
  Encounter --> BillingQueue["Billing queue entry"]
  Encounter --> Order["CBC lab order"]
  Order --> LabQueue["Lab queue entry"]
  Order --> Result["Lab result"]
```

Study note:

- Queue entries are operational list rows.
- Encounter and order are the more durable source objects.
- A queue can be done while the encounter still has open chart, order, or billing work.

## Multi-Tenant Boundary

```mermaid
flowchart TD
  User["User login identity"] --> MembershipA["Membership in Hospital A workspace"]
  User --> MembershipB["Membership in Hospital B workspace"]
  MembershipA --> RoleA["Role / permissions for A"]
  MembershipB --> RoleB["Role / permissions for B"]
  RoleA --> DataA["Hospital A data"]
  RoleB --> DataB["Hospital B data"]
```

Study note:

- Login identity is not enough.
- Workspace membership determines which hospital data the user can access.
- Client UI can guide, but server/API/DB/RLS checks define live-capable security.

## Repo Structure Learning Map

```mermaid
flowchart TD
  Docs["docs/\nsource docs"] --> ClairDocs["CLAiR Docs\nread-only viewer"]
  App["src/app\nroutes and API"] --> Features["src/features\nworkflow modules"]
  Features --> Components["src/components\nUI primitives and EMR components"]
  Features --> Lib["src/lib\nshared helpers and Supabase"]
  Supabase["supabase/\nmigrations and seed"] --> Lib
```

Study note:

- `docs/` explains the product and engineering intent.
- `src/app` gives routes.
- `src/features` contains the actual workflow modules.
- `supabase/` holds database changes and synthetic seed data.
