---
id: "STUDY-HOME"
type: "Study Index"
title: "CLAiR Study Center"
description: "Non-developer study hub for learning the CLAiR EMR project through archived lessons, diagrams, glossary, and review prompts."
status: "active"
area: "study"
doc_type: "study-index"
tags: ["study", "owner-learning", "clair-docs"]
last_updated: "2026-06-17"
---

# CLAiR Study Center

This folder is 승욱's local project-study archive. It records lessons with 루멘, keeps the learning path visible, and turns useful explanations into reviewable Markdown.

## Purpose

- Help a non-developer owner understand this project's product, frontend, backend, and data structure.
- Keep study notes inside the repo so they can be reviewed in CLAiR Docs.
- Preserve diagrams, questions, answers, and follow-up topics without treating chat history as the only source.

## Reader Path

Use the `스터디` tab in CLAiR Docs.

Current local route:

- `/docs?doc=study-home`

Legacy `/prd` remains a compatibility route for the original product-doc viewer, but the preferred human reader path for the expanded docs hub is `/docs`.

## Study Boundaries

- This is local/internal learning material.
- Do not add real hospital, staff, guardian, patient, billing, payment, identity, credential, or provider data.
- Prefer synthetic examples such as `콩이`, `보호자 A`, or `clair-demo`.
- Study notes may summarize product or engineering source docs, but source-of-truth changes still belong in `docs/product`, `docs/design`, or `docs/engineering`.
- Do not use this folder to claim production, compliance, remote Supabase, payment, email, or provider readiness.

## How Lessons Are Recorded

Each lesson should capture:

| Section | Purpose |
| --- | --- |
| Learning goal | What 승욱 should understand after the lesson |
| Source context | Which project docs or code informed the lesson |
| 승욱's answer | The owner's explanation in his own words |
| 루멘's correction | Short correction, confirmation, and clearer model |
| Diagram | A small visual relation or flow when helpful |
| Review questions | Questions 루멘 can reuse later |
| Next lesson | The next useful topic |

Use the template at `docs/study/templates/lesson-session.md`.

## Current Learning Path

1. [Study Curriculum](curriculum.md)
2. [01. EMR Domain Basics](sessions/2026-06-17-01-emr-domain-basics.md)
3. [Study Glossary](glossary.md)
4. [Study Diagrams](diagrams.md)

## Operating Prompt

승욱 can say:

```text
루멘, 오늘 수업 기록 저장해줘.
```

Then 루멘 should add or update the relevant `docs/study/sessions/` note with a concise summary, diagrams, review questions, and next lesson.
