---
id: "CLINICAL-MASTER-PR-017-SOURCE-LEDGER"
type: "Research Source Ledger"
title: "Evidence-grounded dispensing order master source ledger"
status: "completed"
owner: "CLINICAL-MASTER-PR-017"
updated: "2026-08-26"
---

# Dispensing order master source ledger

## Purpose and evidence boundary

This ledger records the reproducible Phase 1 research behind the dispensing
order dataset and Field Matrix. It is product and data-contract research, not a
substitute for named veterinary clinical review. No source alone authorizes a
record for real-patient use.

Only directly supported fields may be copied as `direct`. A normalized value or
cross-source mapping is `inferred` and must name the inference rule. An absent
or inaccessible value remains `not_found`; it must not be guessed. Product
labels, clinical guidance, legal requirements, and interoperability standards
retain separate scopes and must not be blended into a single authority claim.

## Research protocol

- Search date: 2026-08-26 KST.
- Tools: Exa Search plus ordinary web search; direct page/PDF retrieval follows
  discovery when required.
- Query minimum: three searches per workstream, with both tools represented in
  the complete research run.
- Source priority: regulator or standards owner, official product label or
  database, peer-reviewed guideline/consensus, then explanatory secondary
  material used only for discovery.
- Acceptance requires a stable URL or identifier, identifiable authority,
  applicable scope, supported claim, and explicit limitation.
- Rejection reasons include wrong species/scope, secondary-only content,
  inaccessible or unstable text, stale/superseded version, duplicate evidence,
  commercial marketing, and unverifiable dose or stability claims.
- Copyright boundary: store citations, short field-level facts, and
  paraphrased conclusions; do not copy monographs, standards, or product
  labels wholesale.

## Independent workstreams

| ID | Workstream | Primary questions | Status |
| --- | --- | --- | --- |
| A | Medication identity and formulation standards | Which identifiers, ingredient/composition, strength, dose form, route, unit, package, and terminology fields are canonical? | `completed` |
| B | Prescription, dispensing, labeling, and regulatory data | Which order, dispense, label, authorization, provenance, and audit fields are required or strongly supported? | `completed` |
| C | Approved veterinary products and labels | Which dog/cat product identities and label-level indications, routes, strengths, forms, storage, and warnings are directly supported? | `completed` |
| D | Clinical therapeutics and safety guidance | Which species, indication class, monitoring, caution, interaction, stewardship, and review fields are supported without turning the dataset into treatment advice? | `completed` |
| E | Compounding, stability, BUD, storage, and controlled substances | Which values require formulation-specific evidence or separate regulatory workflow, and which must remain unknown/inactive? | `completed` |
| F | Korean veterinary regulatory context | Which Korean authorities, legal instruments, product systems, prescription/dispensing boundaries, and terminology apply? | `completed` |
| G | Execution, dispense lifecycle, traceability, and audit | Which request/dispense status, performer, quantity, substitution, lot/expiry, provenance, event, and inventory links belong in execution snapshots? | `completed` |

## Search and review counts

Counts are finalized only after de-duplicating the combined Exa and ordinary
web results. A search result may be searched but not reviewed; a reviewed
source is either accepted or rejected.

| Workstream | Searches | Results searched | Sources reviewed | Accepted | Rejected | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| A | 5 | 26 | 12 | 9 | 3 | ISO/IDMP, EMA veterinary submission, FHIR product definitions |
| B | 5 | 28 | 14 | 10 | 4 | US/EU prescription and label law, FHIR request/dispense/dosage |
| C | 4 | 12 | 11 | 7 | 4 | FDA labels/FOI, EMA UPD, UK VMD product evidence |
| D | 4 | 21 | 18 | 6 | 12 | Peer-reviewed ISCAID, AAHA/AAFP, WSAVA guidance |
| E | 9 | 31 | 12 | 6 | 6 | FDA compounding, USP public material, DEA boundary |
| F | 12 | 42 | 9 | 5 | 4 | Extra searches distinguish current from future Korean law |
| G | 8 | 29 | 12 | 6 | 6 | FHIR lifecycle/provenance/audit and GS1 traceability |
| Supplemental discovery | 30 | 111 | 24 | 2 | 22 | Parent cross-check; only two novel VICH sources accepted, duplicates not double-counted |
| **Total decisions** | **77** | **300** | **112** | **51** | **61** | 48 unique accepted URLs after three cross-workstream duplicates |

## Accepted source registry

The registry below records 48 unique accepted public sources. All were accessed
2026-08-26. `Direct` means the cited authority directly supports the stated
field or boundary; `inferred` means only the CLAiR mapping is inferred. Public
summaries of paid standards support scope only, not inaccessible clauses.

### A. Medication identity and formulation

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| A01 | [Veterinary EU IG Chapter 2](https://www.ema.europa.eu/en/documents/regulatory-procedural-guideline/eu-implementation-guide-ig-veterinary-medicines-product-data-union-product-database-chapter-2-format-electronic-submission-veterinary-medicinal-product-information_en.pdf), EMA | v1.12, 2025-09-17 / EU | Product/package ID, ingredient role and strength, forms, route, species, pack/unit | Regulatory submission model, not prescribing UX |
| A02 | [ISO 11615:2017](https://www.iso.org/standard/70150.html), ISO | edition 2 / international | Public scope supports regulated medicinal-product identification and exchange | Full clauses are paid; element-level claims are `not_found` |
| A03 | [ISO 11238:2018](https://www.iso.org/standard/69697.html), ISO | edition 2 / international | Substance identity and information-model scope | Revision is under development; full clauses are paid |
| A04 | [ISO 11239:2023](https://www.iso.org/standard/81133.html), ISO | edition 2 / international | Dose forms, units of presentation, routes, packaging, multilingual/version concepts | Public abstract does not expose code-list rules |
| A05 | [FHIR R5 Medication](https://hl7.org/fhir/R5/medication.html), HL7 | 5.0.0 STU / international | Identifier, status, code, form, amount, ingredient/strength, lot and expiry | Operational resource; not complete regulatory definition |
| A06 | [FHIR R5 MedicinalProductDefinition](https://hl7.org/fhir/R5/medicinalproductdefinition.html), HL7 | 5.0.0 STU / international | Product code/name, jurisdiction/language, status, combined form | Trial Use; veterinary/local profile required |
| A07 | [FHIR R5 Ingredient](https://hl7.org/fhir/R5/ingredient.html), HL7 | 5.0.0 STU / international | Ingredient role/function, allergen, presentation and concentration strength, basis | CLAiR subset selection is `inferred` |
| A08 | [FHIR R5 AdministrableProductDefinition](https://hl7.org/fhir/R5/administrableproductdefinition.html), HL7 | 5.0.0 STU / international | Administrable form, unit, ingredients, routes, target species | Product definition, not dispense event |
| A09 | [ISO IDMP overview](https://www.ema.europa.eu/en/human-regulatory-overview/research-development/data-medicines-iso-idmp-standards-overview), EMA | 2016 / EU | Substance/product/organisation/referential separation | Human focus; veterinary mapping needs A01 |

### B. Prescription, dispensing, and labeling

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| B01 | [21 CFR 201.105](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-201/subpart-D/section-201.105), FDA/eCFR | current 2026-08-21 / US | Rx legend, ingredients, lot, usual dose/route, frequency, duration, hazards | Manufacturer/product labeling, not full hospital record |
| B02 | [21 CFR 530.5](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-E/part-530/subpart-A/section-530.5), FDA/eCFR | current 2026-08-17 / US | Extralabel ingredient, condition, species, dose, duration, animal count, record retention | US AMDUCA only |
| B03 | [21 CFR 530.12](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-E/part-530/subpart-B/section-530.12), FDA/eCFR | current 2026-08-19 / US | Prescriber/pharmacy, animal identity, ingredient, dose/frequency/route/duration, cautions | Extralabel labeling; state rules may add requirements |
| B04 | [Regulation (EU) 2019/6](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A02019R0006-20220128), EU | consolidated 2022-01-28 / EU | Prescription identity, medicine/form/strength, quantity, regimen, warnings; transaction batch | Not Korean law; member states can add rules |
| B05 | [Implementing Regulation (EU) 2024/875](https://eur-lex.europa.eu/eli/reg_impl/2024/875/oj/eng), EU | 2024-05-11 / EU | Route abbreviations and species/storage pictograms | Packaging expression only |
| B06 | [CVM Guide 1240.4021](https://www.fda.gov/media/70101/download), FDA CVM | 1997 / US | Product/name, quantity, manufacturer, ingredients, directions, warnings, expiry, control number | Old internal guidance; current eCFR prevails |
| B07 | [CVM GFI #45](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cvm-gfi-45-guideline-uniform-labeling-drugs-dairy-and-beef-cattle), FDA CVM | revised 1993 / US | Rx/OTC label, metric volume, lot/expiry and withdrawal field concepts | Nonbinding and cattle-only |
| B08 | [FHIR R5 MedicationRequest](https://www.hl7.org/fhir/R5/medicationrequest.html), HL7 | 5.0.0 STU / international | Status/intent, medication, subject, requester, reason, dosage, quantity, repeats, substitution | Human-oriented; CLAiR veterinary profile is `inferred` |
| B09 | [FHIR R5 MedicationDispense](https://www.hl7.org/fhir/R5/medicationdispense.html), HL7 | 5.0.0 STU / international | Performer, authorizing request, actual quantity, supply, prepared/handed-over time, substitution | Lot/expiry require linked Medication/inventory data |
| B10 | [FHIR R5 Dosage](https://www.hl7.org/fhir/R5/dosage.html), HL7 | 5.0.0 / international | SIG, timing, PRN, site/route/method, dose/rate, max-dose structure | Representation standard, never a dose authority |

### C. Approved products and labels

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| C01 | [ANADA 200-769 Selamectin FOI](https://animaldrugsatfda.fda.gov/adafda/app/search/public/document/downloadFoi/14985), FDA CVM | approved 2024-01-30 / US | Ingredient, form/concentration, package, Rx/route, dog/cat scope, application and safety | One generic topical product; reference-product lineage must remain |
| C02 | [Revolution selamectin SPL](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8032a1ae-d192-4514-80f1-9a3b50dc2155), NLM/FDA label | updated 2024-12-11 / US | Product/ingredient, strengths, species/age, route, warnings, storage, SPL/NDC/version | Product label must be version-frozen |
| C03 | [Carprofen tablets package insert](https://animaldrugsatfda.fda.gov/adafda/app/search/public/document/downloadLabeling/1739), FDA CVM | document 1739 / US | Dog-only form/indication, cat prohibition, contraindication and baseline/periodic monitoring concepts | Label revision date `not_found` |
| C04 | [EMA Union Product Database](https://www.ema.europa.eu/en/veterinary-regulatory-overview/veterinary-medicines-product-regulation/union-product-database), EMA | live since 2022 / EU/EEA | Authorization/status, member-state availability, SPC and public assessment links | Individual product values require a frozen SPC |
| C05 | [VMD Product Information Database](https://www.vmd.defra.gov.uk/ProductInformationDatabase/), UK VMD | live snapshot / UK | Current/suspended/expired status, product ID, ingredient, species, form/group, SPC/PAR links | Authorization does not prove current marketing; snapshot/version required |
| C06 | [VMD Product Literature Standard](https://www.gov.uk/guidance/product-literature-standard-pls-for-veterinary-medicinal-products), UK VMD | current page / UK | Label/SPC fields including species, route, warnings, storage, batch, package, authorization | UK labeling, not individual values or Korean law |

`B04` also supports the EU SPC minimum structure used by workstream C and is
not double-counted as a second accepted URL.

### D. Clinical therapeutics and safety guidance

| ID | Source and authority | Version / scope | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| D01 | [ISCAID bacterial UTI guideline](https://doi.org/10.1016/j.tvjl.2019.02.008), Veterinary Journal | 2019 / dog, cat | Diagnostic evidence, culture/susceptibility, recurrence, renal caution, follow-up and stewardship fields | Some recommendations rely on consensus; local resistance varies |
| D02 | [ISCAID respiratory antimicrobial guideline](https://doi.org/10.1111/jvim.14627), JVIM | 2017 / dog, cat | Infection type/severity, diagnostic sample, empirical-use rationale, culture, response/recheck | Limited controlled evidence; regional context required |
| D03 | [ISCAID canine pyoderma guideline](https://doi.org/10.1111/vde.13342), Veterinary Dermatology | 2025 / dog | Disease depth, cytology, topical/systemic decision, culture, evidence level, recheck | English evidence through 2023; not cats |
| D04 | [AAFP/AAHA antimicrobial stewardship guideline](https://www.aaha.org/globalassets/02-guidelines/2022-antimicrobial/2022-aafp_aaha-antimicrobial-stewardship-guidelines.pdf), AAFP/AAHA | 2022 / dog, cat | VCPR, diagnosis, tests, alternatives, interaction/adverse effects, reassessment and caregiver guidance | Framework, not product label or dose source |
| D05 | [AAHA pain management guideline](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/2022-pain-management/resources/2022-aaha-pain-management-guidelines-for-dog-and-cats_updated_060622.pdf), AAHA | 2022 / dog, cat | Pain context, baseline assessment, risk, reassessment, caregiver outcomes and change reason | Does not cover every medicine; US availability differs |
| D06 | [WSAVA pain guideline](https://doi.org/10.1111/jsap.13566), WSAVA | 2022/2023 / dog, cat | Assessment scales, repeated assessment, interaction/duplicate-pharmacology risk, follow-up | Global guidance; availability/authorization varies |

### E. Compounding, stability, BUD, and controlled substances

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| E01 | [CVM GFI #256](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cvm-gfi-256-compounding-animal-drugs-bulk-drug-substances), FDA CVM | final 2022 / US | Patient-specific/office-stock boundary, bulk substance, medical rationale and enforcement basis | Nonbinding and not Korean law |
| E02 | [GFI #256 Q&A](https://www.fda.gov/animal-veterinary/animal-drug-compounding/qa-gfi-256-compounding-animal-drugs-bulk-drug-substances), FDA CVM | updated 2024-08-27 / US | Clinical difference, rationale record, BUD-limited quantity, adverse-event guidance | No formulation-specific BUD values |
| E03 | [USP compounded preparation monographs](https://www.usp.org/compounding/compounded-preparation-monographs), USP | current page / US compendial context | Monograph field families: formula, process, stability/BUD, packaging/storage, pH/assay | Much content requires licensed access |
| E04 | [USP stability reference](https://doi.usp.org/USPNF/USPNF_S203286_10101_01.html), USP | 2024 / US compendial context | Stability-evidence and BUD-derivation boundary | Not official enforceable USP-NF text; partial access |
| E05 | [DEA Practitioner's Manual](https://www.deadiversion.usdoj.gov/GDP/%28DEA-DC-071%29%28EO-DEA226%29_Practitioner%27s_Manual_%28final%29.pdf), DEA | 2023 / US | Schedule, registered location, inventory/count, disposal/loss and retention concepts | US federal controlled-substance context only |
| E06 | [Extra-label drug use in animals](https://www.fda.gov/animal-veterinary/resources-you/ins-and-outs-extra-label-drug-use-animals-resource-veterinarians), FDA CVM | current page / US | Ingredient, condition, species, dose/frequency/route/duration, withdrawal and caution-label records | US AMDUCA only |

### F. Korean regulatory context

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| F01 | [수의사법 제12조의2](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024669311), 국가법령정보센터 | 시행 2024-07-24 / 대한민국 | 처방관리시스템, 예외 등록, 직접 처방·조제·투약 시 입력 | 처방대상 품목에 한정 |
| F02 | [수의사법 시행규칙 제11조](https://law.go.kr/LSW/lsLinkCommonInfo.do?lspttninfSeq=77276), 국가법령정보센터 | 시행 2026-04-21 / 대한민국 | 개체/종/체중/임신, 소유자, 성분/용량/용법/일수/판매수량, 면허, 부본 보관 | 개인정보는 실행 레코드에서 최소 수집해야 함 |
| F03 | [동물용 의약품등 취급규칙 제3조의2](https://law.go.kr/LSW/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=116799), 국가법령정보센터 | 현행 검색 2025-10-31 / 대한민국 | 약국/도매 투약지도: 대상, 용법, 효능, 부작용/금기, 휴약, 저장/유효기간 | 수의병원 동일 의무로 일반화 불가; 통합본 재확인 필요 |
| F04 | [처방대상 동물용의약품 지정 규정 검색](https://law.go.kr/LSW/unSc.do?eventGubun=060101&query=%EB%8F%99%EB%AC%BC%EC%9A%A9%EC%9D%98%EC%95%BD&section=&tabMenuId=tab73), 농림축산식품부 | 고시 제2020-90호 / 대한민국 | 처방대상 판정은 버전 있는 외부 규정 목록과 매칭해야 함 | 동적 목록을 코드 상수로 고정하면 안 됨 |
| F05 | [동물용의약품별 잔류허용기준](https://www.foodsafetykorea.go.kr/residue/vd/mrls/list.do?menuKey=2&subMenuKey=83), 식품의약품안전처 | live DB / 대한민국 | 식용동물 MRL source/review/prohibited-residue field | MRL은 휴약기간이 아니며 반려동물에 자동 적용 불가 |

### G. Execution, traceability, and audit

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| G01 | [FHIR R5 Provenance](https://hl7.org/FHIR/R5/provenance.html), HL7 | 5.0.0 / international | Target, occurred/recorded, activity, agent, entity, signature and version lineage | Does not establish clinical validity |
| G02 | [FHIR R5 AuditEvent](https://hl7.org/fhir/R5/auditevent.html), HL7 | 5.0.0 / international | Action, time, outcome, agent, source, entity and append-oriented audit semantics | FHIR server implementation is not required |
| G03 | [GS1 2D barcode in healthcare](https://www.gs1.org/industries/healthcare/2d-barcode-healthcare), GS1 | current page / international | GTIN, batch/lot, expiry/manufacture date, serial barcode fields | Not a universal requirement for Korean veterinary compounds |
| G04 | [FDA regulation of animal drugs](https://www.fda.gov/animal-veterinary/resources-you/fda-regulation-animal-drugs), FDA CVM | current page / US | Dispense serial/date, dispenser, prescriber, directions, warnings, ingredients and lot | US labeling rule context only |

`B08` and `B09` also directly support the atomic request and dispense-event
split used by workstream G and are not double-counted.

### Supplemental controlled terminology

| ID | Source and authority | Version / jurisdiction | Direct support | Limitation |
| --- | --- | --- | --- | --- |
| S01 | [CVM GFI #143 / VICH GL30](https://www.fda.gov/media/69988/download), FDA/VICH | current official PDF / international pharmacovigilance | Controlled terms for route, units of presentation/measurement and dosage forms | Adverse-event terminology, not prescribing/dosing authority |
| S02 | [CVM GFI #188](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cvm-gfi-188-data-elements-submission-veterinary-adverse-event-reports-center-veterinary-medicine), FDA CVM/VICH | January 2024 / international alignment | Veterinary medicinal-product adverse-event data elements and link to controlled terms | Pharmacovigilance scope only |

## Rejected source registry

The 61 rejected review decisions include: unofficial CFR mirrors when eCFR was
available; future Korean effective versions; superseded regulatory history;
duplicate landing pages, definition pages, examples, ballots, mirrors, and PDF
copies; inaccessible product snippets that could not identify a stable SPC;
commercial formularies/blogs; old USP BUD summaries; human-only DSCSA material;
and standards summaries that did not directly support the claimed field.

The raw-result count is intentionally larger than reviewed decisions. Search
snippets that were never promoted to full review are neither accepted nor
rejected. Queries and per-workstream counts above preserve that distinction.

## Research conclusions carried into Phase 2 and Phase 3

- Separate reusable medication/product definition, patient-specific
  prescription request, actual dispense event, inventory item, and billing
  candidate. None is an alias for another.
- Preserve presentation strength and concentration strength separately, and
  preserve manufactured form separately from administrable form.
- One atomic medication/formulation is one order master row. Multi-medication
  prescriptions use grouped atomic requests, not one composite execution row.
- Store route/frequency/dose/quantity/duration and label instructions as the
  clinician-confirmed immutable snapshot; the master provides typed inputs and
  evidence-backed constraints, never a universal patient dose answer.
- Lot, expiry, internal batch, actual quantity, preparation/check/handover time,
  performer/checker, substitution, and BUD belong to dispense/inventory events.
  The master may only state whether they are required and how evidence must be
  supplied.
- No generic BUD or stability default was found for Korean veterinary hospital
  compounding. Unsupported values remain null with `requires_source` and block
  activation.
- Korean prescription fields are versioned execution-profile requirements.
  Future-effective laws are not current requirements, and protected personal
  data never belongs in the shared master.
- Workspace administrative acceptance is not clinical approval. Evidence
  review, named veterinary review, controlled-substance authorization, and
  workspace adoption are separate states and events.
- Product labels and clinical guidelines support different assertions. A
  product label may support product identity, indication, form, route, storage,
  and warnings; a guideline may support diagnostic prerequisites, monitoring,
  stewardship, or reassessment. Neither silently overrides the other.
- The final candidate dataset must freeze source revision/access date and keep
  every unreviewed row inactive for real clinical use.

## Product-source sufficiency check

The official UK VMD workbook snapshot was downloaded read-only from the Product
Information Database on 2026-08-26. The HTTP source reported last modification
2026-08-25 18:10:55 GMT. Its SHA-256 is
`1b0582b41d169f7d4792ff8091c92d32cf07858bc5cee630ff24b1e490fe2360`.

Read-only spreadsheet inspection found:

- 5,293 current authorized product rows;
- 3,181 rows with dog or cat scope, active substance, pharmaceutical form, and
  a direct SPC URL;
- 452 conservative unique combinations after normalizing active-substance
  combination, pharmaceutical form, and dog/cat eligibility, before using
  product strength to create any additional distinction;
- 302 conservative unique non-vaccine candidates in dispensing-appropriate
  oral, topical, ophthalmic, otic, nasal/inhaled, and related forms;
- enough direct product evidence to form a balanced 140-row initial candidate
  set without counting manufacturer-only duplicates or package-size variants.

The 140-row selection has 140 distinct VMD product IDs and 140 distinct
conservative keys, with 54 dog-and-cat, 46 dog-only, and 40 cat-only rows. It
includes 15 coverage categories and 31 pharmaceutical-form labels. All 140
rows have direct SPC URLs; all 140 have `clinicalUseAllowed=false` pending
SPC extraction, Korean authorization review, and named veterinary review.

## Field-level provenance rule

Every clinically meaningful dataset assertion must resolve to one or more
accepted source IDs and store:

- source assertion ID and source revision;
- exact field path and normalized value;
- source scope and applicable species/product/formulation;
- direct quotation locator or table/section locator without wholesale copying;
- `direct`, `inferred`, or `not_found` mode;
- inference rule when applicable;
- confidence and conflict status;
- accessed-at and last-reviewed-at;
- named clinical-review status kept separate from research acceptance.

Conflicting sources remain separate assertions. The dataset cannot silently
pick the more convenient value, and `not_found` cannot become a default.
