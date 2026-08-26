# CLAiR Evidence-Grounded Dispensing Order Master V1

Status: `technical dataset, Airtable authoring, and inactive Supabase publish/adoption complete; clinical review and activation pending`

> **Do not use for real clinical care.** All 108 final rows have
> `clinicalUseAllowed = false`. Dose, frequency, duration, quantity, repeats,
> instructions, and BUD remain null. UK product authorization does not establish
> Korean authorization or controlled-substance clearance.

## Executive Result

CLAiR now has an auditable initial funnel of 140
official-product candidates and a final technical dataset of
108 unique atomic dispensing-order profiles.
The final set meets the numeric dataset gate without promoting incomplete rows:
19 candidates remain in manual review and 13 were rejected because the official
SPC PDF was not directly available in the captured source path.

| Metric | Result |
| --- | ---: |
| Initial candidates | 140 |
| Final technical passes | 108 |
| Manual-review candidates | 19 |
| Source-unavailable rejections | 13 |
| Unique stable IDs | 108 |
| Unique canonical semantic keys | 108 |
| Unique official product IDs | 108 |
| Clinically active rows | 0 |

## Evidence And Method

- Seven independent research workstreams used both Exa and ordinary web search.
  The ledger records 77 searches, 300 raw results, 112 reviewed decisions, 51
  accepted decisions, and 48 unique accepted URLs after cross-stream deduplication.
- Primary product discovery used the official UK Veterinary Medicines Directorate
  product database workbook captured on 2026-08-26. The workbook SHA-256 is
  `1b0582b41d169f7d4792ff8091c92d32cf07858bc5cee630ff24b1e490fe2360`.
- The workbook contained 5,293 current authorized product rows. The conservative
  dog/cat filter found 3,181 rows with SPC, active-substance, and form data; 302
  eligible non-vaccine dispensing-form profiles remained after exclusion rules.
- A balanced 140-row initial sample was selected. Official SPC PDFs were captured
  for 127 rows, text-extracted, and checked against both current and legacy SPC
  section numbering. Product identity, form, species, route, structured strength,
  evidence hash, and required section availability were validated deterministically.
- No dosing schedule was copied from a product label. No BUD, stability, Korean
  authorization, controlled status, or clinical review decision was inferred.

See the [source ledger](source-ledger.md), [field matrix](field-matrix.md), and
[dataset README](datasets/README.md) for the complete decision trail.

## Coverage

### Therapeutic review buckets

| Bucket | Count |
| --- | ---: |
| 항균·항진균 (`antimicrobial_antifungal`) | 20 |
| 구충·외부기생충 (`antiparasitic`) | 13 |
| 통증·NSAID (`pain_nsaid`) | 13 |
| 심혈관 (`cardiovascular`) | 12 |
| 내분비 (`endocrine`) | 10 |
| 신경·행동 (`neurology_behavior`) | 9 |
| 안과·이과 (`ophthalmic_otic`) | 7 |
| 피부 국소 (`dermatology_topical`) | 5 |
| 기타 항염증 (`anti_inflammatory_other`) | 4 |
| 위장관 (`gastrointestinal`) | 4 |
| 면역조절 (`immunomodulator`) | 3 |
| 기타 (`other`) | 3 |
| 비뇨기 (`urinary`) | 3 |
| 응급·지지 (`emergency_supportive`) | 1 |
| 호흡기 (`respiratory`) | 1 |

### Routes

| Route | Count |
| --- | ---: |
| 경구 (`oral`) | 89 |
| 피부 (`cutaneous`) | 10 |
| 안과 (`ophthalmic`) | 5 |
| 이과 (`otic`) | 2 |
| 구강점막 (`oromucosal`) | 1 |
| 경피 (`transdermal`) | 1 |

### Species and form breadth

- Species applicability references: dog 76, cat 74.
- Final products span 26 official pharmaceutical
  form labels. Oral profiles dominate (89/108); the
  smaller ophthalmic, otic, cutaneous, transdermal, and oromucosal buckets remain
  visible rather than being coerced into the current four-route runtime type.
- Respiratory and emergency/supportive coverage are each one row. This is a known
  breadth limitation for clinical review, not a reason to add weakly evidenced rows.

## Canonical Atomic Key

The semantic duplicate key is deterministic and does not include a display name or
source product ID:

`normalized ingredients | structured strengths | official dosage form | routes | species | manufactured`

Stable record IDs use the official authority and product identity. A brand rename
therefore cannot silently create a new semantic identity, while two products with
different strengths, forms, routes, or species remain distinct.

## Clinical Safety State

Every final row is blocked by all four V1 activation reasons:

1. named veterinary clinical review missing;
2. Korean authorization not verified;
3. Korean controlled-substance screening missing; and
4. Korean display translation review missing.

Keyword-derived safety and monitoring flags are review-queue signals only. They are
not clinical decision support. Product packaged/open shelf-life fields are official
label extractions; they are not a lot expiry or compounded preparation BUD.

## Cross-System Design Result

The current generic master and runtime medication metadata cannot safely hold this
dataset. The runtime requires non-null dose defaults and supports only PO, IV, CRI,
and SC, while this set includes oral, cutaneous, ophthalmic, otic, oromucosal, and
transdermal products. The approved design direction is additive normalized product,
composition, applicability, evidence, regulatory-profile, and named-review tables.

A chart search selection creates no downstream artifact. Confirmation snapshots the
exact reviewed master/workspace/product revision plus clinician-entered prescription
values. One confirmed dispensing order creates one fulfillment work item and one
queue projection. Billing creates at most one candidate only on the trusted chart
billing action. Lot, expiry, opening/reconstitution time, BUD, checker, actual
quantity, substitution, and waste belong to a later immutable dispense event.

## Data Quality And Reproducibility

The repository validator enforces:

- at least 120 initial and 100 final records;
- zero duplicate master IDs, canonical keys, and source product IDs;
- required ingredient, strength, form, route, species, and official SPC evidence;
- zero clinical-use-enabled rows and zero CDS-enabled signals;
- null dose/frequency/duration/quantity/repeats/instructions/BUD;
- pending Korean authorization, controlled screening, translation, and named review;
- deterministic file fingerprints.

Rebuild and validate with:

`node scripts/build-dispensing-order-master-v1.mjs`

`node scripts/validate-dispensing-order-master-v1.mjs`

## Risks And Open Decisions

| Risk or gap | Current control | Required next decision |
| --- | --- | --- |
| No named Korean veterinarian review | All rows inactive | Review exact immutable revisions and record reviewer eligibility/decision |
| UK source jurisdiction | Korean authorization remains `not_verified` | Build and approve Korean regulatory mappings |
| Controlled status unscreened | Separate activation blocker | Approve a controlled-substance permission/audit design or exclude affected rows |
| Korean names are partial drafts | Translation status stays pending | Named bilingual clinical terminology review |
| 19 incomplete parses and 13 unavailable SPCs | Excluded from final | Manual primary-source recovery; never backfill by guessing |
| Current runtime route/default mismatch | No adoption or activation | Add nullable prescription input and reviewed route vocabulary |
| Current outbox has no worker | No external delivery claim | Implement and verify claim/retry/dead-letter semantics separately |
| Persistent targets are live/prod-bound | No write performed | Use exact approval packets, hashes, row counts, rollback, and stop conditions |

## Approval-Gated Next Actions

The following are separate actions and are not authorized by this report: creating
the additive Airtable schema or 100+ records; publishing to the private master;
applying a production migration/upsert; adopting into target workspaces; merging a
production-deploying change; transitioning a production alias; enabling a feature;
or exposing any row to real-patient clinical use.

## Fingerprints

| Artifact | SHA-256 |
| --- | --- |
| Final JSON | `cc3ef6c977122bef5a708d5c6a800a3120b257584bd78ee72c26a67d2b95260f` |
| Final CSV | `7b835fbcade53279056bfec766ae30b00e64a635c4724db2e0a545663d162398` |
| VMD workbook snapshot | `1b0582b41d169f7d4792ff8091c92d32cf07858bc5cee630ff24b1e490fe2360` |
| Enriched 140-candidate dataset | `f4466724f09a4317665bcf4efce5e3555621a20ee21ef02d8bcba6eca933dba1` |

## Final Technical Dataset (108)

| ID | English product | Korean draft | Ingredients | Strength | Form | Route | Species | Category | Official SPC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dispensing-v1-uk-vmd-a000129` | Antirobe 25 mg Capsules for Dogs and Cats | Clindamycin 경질캡슐 | clindamycin | 25 mg | Capsule, hard | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_125687.PDF) |
| `dispensing-v1-uk-vmd-a001270` | Betamox Palatable Drops Powder for Oral Suspension 50 mg/ml | Amoxicillin 경구현탁용산제 | amoxicillin | 50 mg/1 ml | Powder for oral suspension | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_139560.PDF) |
| `dispensing-v1-uk-vmd-a001642` | Isathal 10 mg/g Eye Drops, Suspension for Dogs, Cats and Rabbits | Fusidic Acid 점안현탁액 | fusidic acid | 10 mg/1 g | Eye drops, suspension | ophthalmic | cat, dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_136431.PDF) |
| `dispensing-v1-uk-vmd-a001709` | Tolfedine Tablets 6 mg | Tolfenamic Acid 정 | tolfenamic acid | 6 mg | Tablet | oral | cat, dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_117060.PDF) |
| `dispensing-v1-uk-vmd-a002457` | Synulox Palatable Drops 40 mg/ml + 10 mg/ml, Powder for Oral Suspension | Amoxicillin, Clavulanic Acid 경구현탁용산제 | amoxicillin, clavulanic acid | 40 mg/1 ml; 10 mg/1 ml | Powder for oral suspension | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_138553.PDF) |
| `dispensing-v1-uk-vmd-a002967` | Prednicare 1 mg Tablets | Prednisolone 정 | prednisolone | 1 mg | Tablet | oral | cat, dog | anti_inflammatory_other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_113502.PDF) |
| `dispensing-v1-uk-vmd-a003212` | Ovarid 20 mg Tablets | Megestrol Acetate 정 | megestrol acetate | 20 mg | Tablet | oral | cat, dog | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_85159.PDF) |
| `dispensing-v1-uk-vmd-a003564` | Medrone V Tablets 2 mg | Methylprednisolone 정 | methylprednisolone | 2 mg | Tablet | oral | cat, dog | anti_inflammatory_other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_139017.PDF) |
| `dispensing-v1-uk-vmd-a006644` | Cerenia 16 mg Tablets for Dogs | Maropitant 정 | maropitant | 16 mg | Tablet | oral | dog | gastrointestinal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2243320.PDF) |
| `dispensing-v1-uk-vmd-a006680` | Benazecare Flavour 20 mg Tablets for Dogs | Benazepril Hydrochloride 정 | benazepril hydrochloride | 20 mg | Tablet | oral | dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_162576.PDF) |
| `dispensing-v1-uk-vmd-a006858` | Canidryl 100 mg Tablets for Dogs | Carprofen 정 | carprofen | 100 mg | Tablet | oral | dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_168045.PDF) |
| `dispensing-v1-uk-vmd-a007066` | Profender 15 mg/3 mg Modified-Release Tablets for Small Dogs | Emodepside, Praziquantel 정 | emodepside, praziquantel | 15 mg; 3 mg | Tablet | oral | dog | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3155947.PDF) |
| `dispensing-v1-uk-vmd-a007101` | Xeden 15 mg Tablet for Cats | Enrofloxacin 정 | enrofloxacin | 15 mg | Tablet | oral | cat | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_213322.PDF) |
| `dispensing-v1-uk-vmd-a007654` | Veraflox 15 mg Tablets for Cats and Dogs | Pradofloxacin 정 | pradofloxacin | 15 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3105295.PDF) |
| `dispensing-v1-uk-vmd-a007656` | Profender 150 mg/30 mg Modified-Release Tablets for Large Dogs | Emodepside, Praziquantel 방출조절정 | emodepside, praziquantel | 150 mg; 30 mg | Modified-release tablet | oral | dog | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3155934.PDF) |
| `dispensing-v1-uk-vmd-a007661` | Onsior 6 mg Tablets for Cats | Robenacoxib 정 | robenacoxib | 6 mg | Tablet | oral | cat | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652572.PDF) |
| `dispensing-v1-uk-vmd-a007860` | Procox 0.9 mg/ml + 18 mg/ml Oral Suspension for Dogs | Emodepside, Toltrazuril 경구현탁액 | emodepside, toltrazuril | 0.9 mg/1 ml; 18 mg/1 ml | Oral suspension | oral | dog | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2614759.PDF) |
| `dispensing-v1-uk-vmd-a007863` | Loxicom 0.5 mg/ml Oral Suspension for Cats | Meloxicam 경구점적현탁액 | meloxicam | 0.5 mg/1 ml | Oral drops, suspension | oral | cat | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2894015.PDF) |
| `dispensing-v1-uk-vmd-a008164` | Cimalgex 30mg Chewable Tablets for Dogs | Cimicoxib 츄어블정 | cimicoxib | 30 mg | Chewable tablet | oral | dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2740815.PDF) |
| `dispensing-v1-uk-vmd-a008340` | Pexion 100 mg Tablets for Dogs | Imepitoin 정 | imepitoin | 100 mg | Tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3030205.PDF) |
| `dispensing-v1-uk-vmd-a008454` | Semintra 4 mg/ml Oral Solution for Cats | Telmisartan 경구용액 | telmisartan | 4 mg/1 ml | Oral solution | oral | cat | other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2599215.PDF) |
| `dispensing-v1-uk-vmd-a008547` | Thiafeline 2.5 mg Film-coated Tablets for Cats | Thiamazole 필름코팅정 | thiamazole | 2.5 mg | Film-coated tablet | oral | cat | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_485699.PDF) |
| `dispensing-v1-uk-vmd-a008570` | Cardalis 10 mg/80 mg Chewable Tablets for Dogs | Benazepril Hydrochloride, Spironolactone 츄어블정 | benazepril hydrochloride, spironolactone | 10 mg; 80 mg | Chewable tablet | oral | dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2545753.PDF) |
| `dispensing-v1-uk-vmd-a008873` | Ectotix 134 mg/1200 mg Spot-on Solution for Medium Dogs | Fipronil, Permethrin (Cis:Trans 40:60) 점적용액 | fipronil, permethrin (cis:trans 40:60) | 134 mg; 1200 mg | Spot-on solution | cutaneous | dog | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_620154.PDF) |
| `dispensing-v1-uk-vmd-a008889` | Milbeworm 16 mg/40 mg Film-coated Tablets for Cats | Milbemycin Oxime (A3 and A4), Praziquantel 정 | milbemycin oxime (a3 and a4), praziquantel | 16 mg; 40 mg | Tablet | oral | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_763629.PDF) |
| `dispensing-v1-uk-vmd-a008970` | Fortekor Plus 1.25 mg/2.5 mg Tablets | Benazepril Hydrochloride, Pimobendan 정 | benazepril hydrochloride, pimobendan | 1.25 mg; 2.5 mg | Tablet | oral | dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2652849.PDF) |
| `dispensing-v1-uk-vmd-a009275` | Thyroxanil 200 Microgram Tablets for Dogs and Cats | L Thyroxine Sodium 정 | l thyroxine sodium | 200 microgram | Tablet | oral | cat, dog | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1009834.PDF) |
| `dispensing-v1-uk-vmd-a009753` | Bravecto Plus 112.5 mg / 5.6 mg Spot-on Solution for Small Cats (1.2 – 2.8 kg) | Fluralaner, Moxidectin 점적용액 | fluralaner, moxidectin | 112.5 mg; 5.6 mg | Spot-on solution | cutaneous | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2146633.PDF) |
| `dispensing-v1-uk-vmd-a009895` | Semintra 10 mg/ml Oral Solution for Cats | Telmisartan 경구현탁액 | telmisartan | 10 mg/1 ml | Oral suspension | oral | cat | other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2599190.PDF) |
| `dispensing-v1-uk-vmd-a009989` | Arixil Vet 20 mg Film-coated Tablet for Dogs | Benazepril Hydrochloride 필름코팅정 | benazepril hydrochloride | 20 mg | Film-coated tablet | oral | dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1498266.PDF) |
| `dispensing-v1-uk-vmd-a009990` | Chanhold 15 mg Spot-on Solution for Cats and Dogs < 2.5 kg | Selamectin 점적용액 | selamectin | 15 mg | Spot-on solution | cutaneous | cat, dog | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3110551.PDF) |
| `dispensing-v1-uk-vmd-a009992` | Chanhold 45 mg Spot-on Solution for Cats 2.6–7.5 kg | Selamectin 점적용액 | selamectin | 45 mg | Spot-on solution | cutaneous | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3109816.PDF) |
| `dispensing-v1-uk-vmd-a010086` | Mirataz 20 mg/ml Transdermal Ointment for Cats | Mirtazapine 경피용액 | mirtazapine | 20 mg/1 ml | Transdermal Solution | transdermal | cat | dermatology_topical | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3025132.PDF) |
| `dispensing-v1-uk-vmd-a010345` | Felisecto Plus 15 mg/2.5 mg Spot-on Solution for Cats ≤2.5 kg | Sarolaner, Selamectin 점적용액 | sarolaner, selamectin | 15 mg; 2.5 mg | Spot-on solution | cutaneous | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2153788.PDF) |
| `dispensing-v1-uk-vmd-a010369` | Tsefalen 50mg/ml Powder for Oral Suspension for Dogs up to 20 kg and Cats | Cefalexin 경구현탁용산제 | cefalexin | 50 mg/1 ml | Powder for oral suspension | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2048181.PDF) |
| `dispensing-v1-uk-vmd-a010528` | Clindacutin 10 mg/g Ointment for Dogs | Clindamycin 연고 | clindamycin | 10 mg/1 g | Ointment | cutaneous | dog | dermatology_topical | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2045513.PDF) |
| `dispensing-v1-uk-vmd-a010636` | Daxocox 100 mg Tablets for Dogs | Enflicoxib 정 | enflicoxib | 100 mg | Tablet | oral | dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2050514.PDF) |
| `dispensing-v1-uk-vmd-a010697` | Alphafluben 44 mg/ml Oral Gel for Dogs | Flubendazole 경구겔 | flubendazole | 44 mg/1 ml | Oral gel | oral | dog | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2264213.PDF) |
| `dispensing-v1-uk-vmd-a010709` | Bonqat 50 mg/ml Oral Solution for Cats | Pregabalin 경구용액 | pregabalin | 50 mg/1 ml | Oral solution | oral | cat | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2128235.PDF) |
| `dispensing-v1-uk-vmd-a011300` | Alfamed 2.5 mg/ml Cutaneous Spray, Solution for Cats and Dogs | Fipronil 피부분무용액 | fipronil | 2.5 mg/1 ml | Cutaneous spray, solution | cutaneous | cat, dog | dermatology_topical | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2981283.PDF) |
| `dispensing-v1-uk-vmd-a011336` | Amoxibactin 50 mg Tablets for Dogs and Cats | Amoxicillin 정 | amoxicillin | 50 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_697208.PDF) |
| `dispensing-v1-uk-vmd-a011385` | Arixil Vet 5 mg Film-coated Tablet for Dogs and Cats | Benazepril Hydrochloride 필름코팅정 | benazepril hydrochloride | 5 mg | Film-coated tablet | oral | cat, dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1498048.PDF) |
| `dispensing-v1-uk-vmd-a011393` | Atopica 10 mg Soft Capsules for Dogs | Ciclosporin A 연질캡슐 | ciclosporin a | 10 mg | Capsule, soft | oral | dog | immunomodulator | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2393777.PDF) |
| `dispensing-v1-uk-vmd-a011395` | Atopica 100 mg/ml Oral Solution for Cats and Dogs | Ciclosporin A 경구용액 | ciclosporin a | 100 mg/1 ml | Oral solution | oral | cat, dog | immunomodulator | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2393747.PDF) |
| `dispensing-v1-uk-vmd-a011419` | Banacep Vet 5 mg Film-coated Tablet for Dogs and Cats Benazepril Hydrochloride | Benazepril Hydrochloride 정 | benazepril hydrochloride | 5 mg | Tablet | oral | cat, dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2649027.PDF) |
| `dispensing-v1-uk-vmd-a011451` | Boflox Flavour 20 mg Tablets for Dogs and Cats | Marbofloxacin 정 | marbofloxacin | 20 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1129519.PDF) |
| `dispensing-v1-uk-vmd-a011490` | Caniphedrin 20 mg Tablets for Dogs | Ephedrine Hydrochloride 정 | ephedrine hydrochloride | 20 mg | Tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1801529.PDF) |
| `dispensing-v1-uk-vmd-a011516` | Carprodyl Quadri 120 mg Chewable Tablets for Dogs | Carprofen 츄어블정 | carprofen | 120 mg | Chewable tablet | oral | dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2756010.PDF) |
| `dispensing-v1-uk-vmd-a011528` | Cefabactin 250 mg Tablets for Dogs and Cats | Cefalexin 정 | cefalexin | 250 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2579731.PDF) |
| `dispensing-v1-uk-vmd-a011579` | Clavaseptin 50 mg Palatable Tablets for Dogs and Cats | Amoxicillin, Clavulanic Acid 정 | amoxicillin, clavulanic acid | 50 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2751551.PDF) |
| `dispensing-v1-uk-vmd-a011588` | Clearium 31.2 mg/ml Shampoo for Dog | Chlorhexidine Gluconate 약용샴푸 | chlorhexidine gluconate | 31.2 mg/1 ml | Shampoo | cutaneous | dog | dermatology_topical | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1493635.PDF) |
| `dispensing-v1-uk-vmd-a011594` | Clindabactin 55 mg Chewable Tablets for Dogs and Cats | Clindamycin 츄어블정 | clindamycin | 55 mg | Chewable tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1588067.PDF) |
| `dispensing-v1-uk-vmd-a011595` | Clindaseptin 25 mg/ml Oral Solution for Cats & Dogs | Clindamycin 경구용액 | clindamycin | 25 mg/1 ml | Oral solution | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_359611.PDF) |
| `dispensing-v1-uk-vmd-a011642` | Dermanolon 1.77 mg/ml + 17.7 mg/ml Cutaneous Spray, Solution for Dogs and Cats | Salicylic Acid, Triamcinolone Acetonide 피부분무용액 | salicylic acid, triamcinolone acetonide | 1.77 mg/1 ml; 17.7 mg/1 ml | Cutaneous spray, solution | cutaneous | cat, dog | dermatology_topical | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2655683.PDF) |
| `dispensing-v1-uk-vmd-a011648` | Dexacortone 0.5 mg Chewable Tablets for Dogs and Cats | Dexamethasone 츄어블정 | dexamethasone | 0.5 mg | Chewable tablet | oral | cat, dog | anti_inflammatory_other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2655500.PDF) |
| `dispensing-v1-uk-vmd-a011677` | Doxybactin 50 mg Tablets for Dogs and Cats | Doxycycline 정 | doxycycline | 50 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1247313.PDF) |
| `dispensing-v1-uk-vmd-a011717` | Efex 10 mg Chewable Tablets for Cats and Dogs | Marbofloxacin 츄어블정 | marbofloxacin | 10 mg | Chewable tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_492508.PDF) |
| `dispensing-v1-uk-vmd-a011738` | Emeprid 1 mg/ml Oral Solution for Dogs and Cats | Metoclopramide Hydrochloride 경구용액 | metoclopramide hydrochloride | 1 mg/1 ml | Oral solution | oral | cat, dog | gastrointestinal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2582049.PDF) |
| `dispensing-v1-uk-vmd-a011749` | Enrocat Flavour 25 mg/ml Oral Suspension for Cats | Enrofloxacin 경구현탁액 | enrofloxacin | 25 mg/1 ml | Oral suspension | oral | cat | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1818251.PDF) |
| `dispensing-v1-uk-vmd-a011769` | Enurace 10, 10 mg Tablets for Dogs | Ephedrine 정 | ephedrine | 10 mg | Tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_272135.PDF) |
| `dispensing-v1-uk-vmd-a011817` | Felimazole 1.25 mg Coated Tablets for Cats | Thiamazole 코팅정 | thiamazole | 1.25 mg | Coated tablet | oral | cat | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_504406.PDF) |
| `dispensing-v1-uk-vmd-a011819` | Felimazole 5 mg Coated Tablets for Cats | Thiamazole 정 | thiamazole | 5 mg | Tablet | oral | cat | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_104872.PDF) |
| `dispensing-v1-uk-vmd-a011831` | Finilac 50 microgram/ml Oral Solution for Dogs and Cats | Cabergoline 경구용액 | cabergoline | 50 microgram/1 ml | Oral solution | oral | cat, dog | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_736360.PDF) |
| `dispensing-v1-uk-vmd-a012004` | Intubeaze 20 mg/ml Laryngopharyngeal Spray, Solution for Cats | Lidocaine Hydrochloride 후두인두분무용액 | lidocaine hydrochloride | 20 mg/1 ml | Laryngopharyngeal Spray, Solution | oromucosal | cat | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1476533.PDF) |
| `dispensing-v1-uk-vmd-a012044` | Libeo 10 mg Chewable Tablets for Dogs | Furosemide 츄어블정 | furosemide | 10 mg | Chewable tablet | oral | dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_538423.PDF) |
| `dispensing-v1-uk-vmd-a012051` | Lodisure 1 mg Tablets for Cats | Amlodipine 정 | amlodipine | 1 mg | Tablet | oral | cat | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1972413.PDF) |
| `dispensing-v1-uk-vmd-a012078` | Mektix Chewable 16 mg/40 mg Film-coated Tablets for Cats Weighing at Least 2 kg | Milbemycin Oxime (A3 and A4), Praziquantel 필름코팅정 | milbemycin oxime (a3 and a4), praziquantel | 16 mg; 40 mg | Film-coated tablet | oral | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2460085.PDF) |
| `dispensing-v1-uk-vmd-a012088` | Metrobactin 250 mg Tablets for Dogs and Cats | Metronidazole 정 | metronidazole | 250 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_870563.PDF) |
| `dispensing-v1-uk-vmd-a012127` | Modulis 100 mg/ml Oral Solution for Dogs | Ciclosporin A 경구용액 | ciclosporin a | 100 mg/1 ml | Oral solution | oral | dog | immunomodulator | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_695652.PDF) |
| `dispensing-v1-uk-vmd-a012147` | Nelio 2.5 mg Tablet for Cats | Benazepril 정 | benazepril | 2.5 mg | Tablet | oral | cat | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_271921.PDF) |
| `dispensing-v1-uk-vmd-a012149` | Nelio 5 mg Tablet for Cats | Benazepril Hydrochloride 정 | benazepril hydrochloride | 5 mg | Tablet | oral | cat | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_233185.PDF) |
| `dispensing-v1-uk-vmd-a012217` | Ophtocycline 10 mg/g Eye Ointment for Dogs, Cats and Horses | Chlortetracycline Hydrochloride 안연고 | chlortetracycline hydrochloride | 10 mg/1 g | Eye ointment | ophthalmic | cat, dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1231631.PDF) |
| `dispensing-v1-uk-vmd-a012355` | Prinocate 40 mg/4 mg Spot-on Solution for Small Cats and Ferrets | Imidacloprid, Moxidectin 점적용액 | imidacloprid, moxidectin | 40 mg; 4 mg | Spot-on solution | cutaneous | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1757116.PDF) |
| `dispensing-v1-uk-vmd-a012373` | Proin 15 mg Chewable Tablets for Dogs | Phenylpropanolamine Hydrochloride 츄어블정 | phenylpropanolamine hydrochloride | 15 mg | Chewable tablet | oral | dog | urinary | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3115064.PDF) |
| `dispensing-v1-uk-vmd-a012406` | Recicort 1.77 mg/ml + 17.7 mg/ml Ear Drops, Solution for Dogs and Cats | Salicylic Acid, Triamcinolone Acetonide 점이액 | salicylic acid, triamcinolone acetonide | 1.77 mg/1 ml; 17.7 mg/1 ml | Ear drops, solution | otic | cat, dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1151650.PDF) |
| `dispensing-v1-uk-vmd-a012537` | Therios 75 mg Chewable Tablets for Cats | Cefalexin 정 | cefalexin | 75 mg | Tablet | oral | cat | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2824844.PDF) |
| `dispensing-v1-uk-vmd-a012549` | Thyroxanil 600 Microgram Tablets for Dogs and Cats | L Thyroxine Sodium, Magnesium Oxide Heavy, Magnesium Stearate 정 | l thyroxine sodium, magnesium oxide heavy, magnesium stearate | 600 microgram | Tablet | oral | cat, dog | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1009774.PDF) |
| `dispensing-v1-uk-vmd-a012666` | Vitamivet K1 50 mg Film-coated Tablets for Dogs | Phytomenadione 정 | phytomenadione | 50 mg | Tablet | oral | dog | emergency_supportive | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2422420.PDF) |
| `dispensing-v1-uk-vmd-a012686` | Zitac Vet 100 mg Tablets for Dogs | Cimetidine 정 | cimetidine | 100 mg | Tablet | oral | dog | gastrointestinal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2993617.PDF) |
| `dispensing-v1-uk-vmd-a012852` | Felinta 10 mg Prolonged-release Tablets for Cats | Carbimazole 서방정 | carbimazole | 10 mg | Prolonged-release tablet | oral | cat | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2418213.PDF) |
| `dispensing-v1-uk-vmd-a012862` | IncoVet, 40.28 mg/ml, Syrup for Dogs | Phenylpropanolamine, Phenylpropanolamine Hydrochloride 시럽 | phenylpropanolamine, phenylpropanolamine hydrochloride | 40.28 mg/1 ml | Syrup | oral | dog | urinary | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2278144.PDF) |
| `dispensing-v1-uk-vmd-a012911` | Cladaxxa 200 mg/50 mg Chewable Tablets for Cats and Dogs | Amoxicillin, Clavulanic Acid 츄어블정 | amoxicillin, clavulanic acid | 200 mg; 50 mg | Chewable tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2124104.PDF) |
| `dispensing-v1-uk-vmd-a012998` | StromEase 25 mg/ml Eye Drops, Solution for Dogs and Cats | Acetylcysteine 점안액 | acetylcysteine | 25 mg/1 ml | Eye drops, solution | ophthalmic | cat, dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2204834.PDF) |
| `dispensing-v1-uk-vmd-a013016` | Metaxx 0.25 mg Chewable Tablets for Cats | Meloxicam 츄어블정 | meloxicam | 0.25 mg | Chewable tablet | oral | cat | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2463721.PDF) |
| `dispensing-v1-uk-vmd-a013034` | Eluracat 20 mg/ml Oral Solution for Cats | Capromorelin tartrate 경구용액 | capromorelin tartrate | 20 mg/1 ml | Oral solution | oral | cat | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2812731.PDF) |
| `dispensing-v1-uk-vmd-a013216` | Elanco Milbemycin - Praziquantel 16 mg/40 mg Film-Coated Tablets for Cats | Milbemycin Oxime (A3 and A4), Praziquantel 코팅정 | milbemycin oxime (a3 and a4), praziquantel | 16 mg; 40 mg | Coated tablet | oral | cat | antiparasitic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2469521.PDF) |
| `dispensing-v1-uk-vmd-a013337` | Felimazole 5 mg/ml Oral Solution for Cats | Thiamazole 경구용액 | thiamazole | 5 mg/1 ml | Oral solution | oral | cat | endocrine | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2643761.PDF) |
| `dispensing-v1-uk-vmd-a013391` | Arthrocam 0.5 mg/ml Oral Suspension for Cats | Meloxicam 경구현탁액 | meloxicam | 0.5 mg/1 ml | Oral suspension | oral | cat | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2716260.PDF) |
| `dispensing-v1-uk-vmd-a013459` | Clavusan 250 mg + 62.5 mg Tablets for Dogs and Cats | Amoxicillin Trihydrate, Potassium Clavulanate 정 | amoxicillin trihydrate, potassium clavulanate | 250 mg; 62.5 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2604890.PDF) |
| `dispensing-v1-uk-vmd-a013551` | Meloxicam Ceva 0.5 mg/ml Oral Suspension for Cats | Meloxicam 경구용액 | meloxicam | 0.5 mg/1 ml | Oral solution | oral | cat | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2802494.PDF) |
| `dispensing-v1-uk-vmd-a013555` | Fluoxevet 32 mg, Tablets for Dogs | Fluoxetine 정 | fluoxetine | 32 mg | Tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2839968.PDF) |
| `dispensing-v1-uk-vmd-a013587` | Phenosan 100 mg Chewable Tablets for Dogs | Phenobarbital 츄어블정 | phenobarbital | 100 mg | Chewable tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2903818.PDF) |
| `dispensing-v1-uk-vmd-a013597` | Phenocoat 12.5 mg Film-coated Tablets for Dogs | Phenobarbital 필름코팅정 | phenobarbital | 12.5 mg | Film-coated tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2902525.PDF) |
| `dispensing-v1-uk-vmd-a013664` | Bexatil 15 mg Tablets for Cats | Bexagliflozin 정 | bexagliflozin | 15 mg | Tablet | oral | cat | other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3099451.PDF) |
| `dispensing-v1-uk-vmd-a013686` | Elanco Ilunocitinib 15 mg Film-coated Tablets for Dogs | Ilunocitinib 필름코팅정 | ilunocitinib | 15 mg | Film-coated tablet | oral | dog | anti_inflammatory_other | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3068704.PDF) |
| `dispensing-v1-uk-vmd-a013695` | Urixine 40 mg/ml Syrup for Dogs | Phenylpropanolamine 경구용액 | phenylpropanolamine | 40 mg/1 ml | Oral solution | oral | dog | urinary | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2827722.PDF) |
| `dispensing-v1-uk-vmd-a013760` | Cepfenidex 2 mg/ml + 1 mg/ml Eye Drops, Solution for Dogs and Cats | Chloramphenicol, Dexamethasone 점안액 | chloramphenicol, dexamethasone | 2 mg/1 ml; 1 mg/1 ml | Eye drops, solution | ophthalmic | cat, dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2847798.PDF) |
| `dispensing-v1-uk-vmd-a013761` | Cepfenicol 5 mg/ml Eye Drops, Solution for Dogs and Cats | Chloramphenicol 점안액 | chloramphenicol | 5 mg/1 ml | Eye drops, solution | ophthalmic | cat, dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2845829.PDF) |
| `dispensing-v1-uk-vmd-a013835` | Amlodicor 1.25 mg Chewable Tablets for Cats | Amlodipine 츄어블정 | amlodipine | 1.25 mg | Chewable tablet | oral | cat | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3016548.PDF) |
| `dispensing-v1-uk-vmd-a013840` | DuOtic 10 mg / 1 mg Ear Gel for Dogs | Betamethasone acetate, Terbinafine 점이겔 | betamethasone acetate, terbinafine | 10 mg; 1 mg | Ear gel | otic | dog | ophthalmic_otic | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3084538.PDF) |
| `dispensing-v1-uk-vmd-a014075` | Pardale-V 400 mg/9 mg Tablets | Codeine Phosphate, Paracetamol 정 | codeine phosphate, paracetamol | 400 mg; 9 mg | Tablet | oral | dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_134468.PDF) |
| `dispensing-v1-uk-vmd-a014092` | Laxasan 667 mg/ml Syrup for Dogs and Cats | Lactulose 시럽 | lactulose | 667 mg/1 ml | Syrup | oral | cat, dog | gastrointestinal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3274311.PDF) |
| `dispensing-v1-uk-vmd-a014184` | Robexera 6 mg Chewable Tablets for Cats | Robenacoxib 츄어블정 | robenacoxib | 6 mg | Chewable tablet | oral | cat | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3151222.PDF) |
| `dispensing-v1-uk-vmd-a014340` | Bisolvon 10 mg/g Oral Powder | Bromhexine Hydrochloride 경구용산제 | bromhexine hydrochloride | 10 mg/1 g | Oral powder | oral | cat, dog | respiratory | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_102778.PDF) |
| `dispensing-v1-uk-vmd-a014343` | Furosemide Tablets BP (Vet) 20 mg | Furosemide 정 | furosemide | 20 mg | Tablet | oral | cat, dog | cardiovascular | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3074173.PDF) |
| `dispensing-v1-uk-vmd-a014435` | Ketofen 20 mg Tablets | Ketoprofen 정 | ketoprofen | 20 mg | Tablet | oral | cat, dog | pain_nsaid | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_3097093.PDF) |
| `dispensing-v1-uk-vmd-a014491` | Baytril Flavour Tablets 15 mg | Enrofloxacin 정 | enrofloxacin | 15 mg | Tablet | oral | cat, dog | antimicrobial_antifungal | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_120175.PDF) |
| `dispensing-v1-uk-vmd-a05081` | Clomicalm 20 mg Tablets for Dogs | Clomipramine Hydrochloride 정 | clomipramine hydrochloride | 20 mg | Tablet | oral | dog | neurology_behavior | [source](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2937796.PDF) |
