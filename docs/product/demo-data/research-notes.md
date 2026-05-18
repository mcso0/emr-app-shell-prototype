---
title: "Demo Data Research Notes"
status: "draft"
updated: "2026-05-19"
owner: "product"
source_issue: "DEN-99"
---

# Demo Data Research Notes

These notes summarize public references used to shape the synthetic demo dataset. The dataset does not copy real patient records and does not represent clinical advice.

## Reference Sources

| Source | What It Informs | Product Use |
| --- | --- | --- |
| [AAHA Guidelines](https://www.aaha.org/for-veterinary-professionals/aaha-guidelines/) | Small animal guideline categories such as preventive care, fluid therapy, allergic skin disease, pain, nutrition, and feline life stages | Scenario themes and order categories, not clinical protocol |
| [AAHA Standards of Accreditation](https://www.aaha.org/resources/aaha-standards/) | Practice areas including medical records, laboratory, imaging, pharmacy, safety, and data security | EMR modules and documentation expectations |
| [AAHA VCPR page](https://www.aaha.org/vcpr/) | Continuity of care, assessment/treatment plan, and readable medical records | Chart handoff, signed chart, and encounter continuity concepts |
| [WSAVA 2024 Vaccination Guidelines](https://wsava.org/wp-content/uploads/2024/04/WSAVA-Vaccination-guidelines-2024.pdf) | Core/non-core vaccine framing for dogs and cats | Preventive-care scenario and vaccine order examples |
| [ISFM/AAFP Cat Friendly Veterinary Environment Guidelines](https://catvets.com/resource/isfm-aafp-cat-friendly-veterinary-environment-guidelines/) | Cat-friendly visit flow and separation of cat/dog stressors | Cat lane, cat exam room, and cat scenario workflow |
| [VetSCT Browser](https://vtsl.vetmed.vt.edu/TerminologyMgt/browser/) | Veterinary extension of SNOMED CT and terminology hierarchy idea | Diagnosis catalog structure and terminology-code placeholder strategy |
| [SNOMED International VetSCT access note](https://ihtsdo.freshdesk.com/support/solutions/articles/4000204571-how-do-i-access-the-snomed-veterinary-extension-) | VetSCT licensing/access caveat | Avoid bulk importing licensed terminology without future review |
| [FDA animal drug/device adverse event reports](https://www.fda.gov/animal-veterinary/product-safety-information/adverse-event-reports-animal-drugs-and-devices) | Public animal drug/device adverse event data limitations | Possible future safety-data inspiration, not diagnosis or treatment truth |
| [openFDA Animal & Veterinary Adverse Events API](https://open.fda.gov/apis/animalandveterinary/event/) | Structured public API fields and limitations | Future synthetic adverse-event demo pattern only |

## Key Synthesis

- A portfolio EMR demo needs clear medical records, assessment/plan continuity, and task ownership, not exhaustive medical correctness.
- Order data should combine clinical intent, operational destination, billing behavior, and staff instruction.
- Diagnosis data should support search, grouping, status, and linkage to chart/order templates.
- Cat and dog workflows should be separated enough to show a premium mid-sized hospital operation.
- FDA/openFDA animal adverse event data can inspire field names or safety-report patterns, but it should not be treated as proof that a drug caused an event or used as clinical recommendation data.
- VetSCT is useful as a terminology model, but any real terminology import needs licensing and product/legal review.

## Dataset Design Constraints

- Names, phone numbers, chart numbers, record IDs, and scenarios must be synthetic.
- Medication names can be common generic-style examples for UI realism, but dose and safety claims must stay non-authoritative.
- Prices are synthetic Korean clinic-style demo prices and should be marked as configurable.
- Every scenario should include enough operational state to demonstrate handoff across modules.

## Recommended Research-To-Product Rule

Use references to answer "what kinds of workflow artifacts should exist?" rather than "what exact clinical decision should the EMR make?"
