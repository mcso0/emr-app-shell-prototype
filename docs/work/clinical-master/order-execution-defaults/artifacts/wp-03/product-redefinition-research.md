# WP-03 product redefinition evidence — 2026-09-06

Read-only primary-source research by the two bounded product reviewers. These are
reference product identities for explicitly synthetic, not-clinically-validated
new order definitions. They are not proof of Korean authorization, clinical
validation, current availability, or the historical identity of a generic order.
No product/default data was applied by this research.

## Exact identity reconciliation

Frozen dispensing159 = PR017 product-profile108 + ambiguous51. The51 are:
`cm.order.dispensing.oral`, `cm.order.dispensing.topical`,
`cm.order.synthetic.dispensing-01` through12, and
`cm.order.v4.dispensing.01` through37. Derive this set by exact frozen master-key
join to PR017 dispensingProfiles, not runtime name matching.

Existing product replacement candidates for19 v4 ingredient scopes (left suffix
is `cm.order.v4.dispensing.NN`, right is `cm.order.dispensing-v1-uk-vmd-aNNNNNN`):

```text
01:a011336 02:a011579 03:a011528 04:a011677 05:a000129
06:a012088 07:a014491 08:a011451 09:a002967 10:a007863
11:a006858 12:a007661 16:a006644 17:a011738 20:a009275
21:a008547 22:a011385 24:a014343 26:a014092
```

20 uses l-thyroxine sodium for the explicitly authored levothyroxine alias;21
uses thiamazole for methimazole. Retain the source terms. Do not choose A012549's
ingredient associations as active-only data: excipients were also extracted.
Product selection must carry complete identity, strength/form and source species,
not just copy a dose into an unchanged ambiguous name.

Generic reference options: oral→a011336, topical→a010528; synthetic01→a011595,
02→a001642,03→a012406,04→a014340,05→a011336 (splitting separately evidenced),
06→a000129,07→new injectable below,08→a011300 (explicitly redefine as spray),
09→a010528,10→a014092.11/12 packaging scopes must explicitly choose a product;
packaging alone is not an identity. These are proposals for authored replacements,
not silently applied substitutions.

## New product reference specifications

All sources below were opened by the research agents on2026-09-06. Human-reference
labels must not supply purported animal prescribing directions. Separately authored
demo quantities/courses require `synthetic_assumption` field provenance. Preserve
reference species separately from synthetic demonstration applicability.

| v4 suffix / generic | Reference identity and specification | Scope and direct source |
| --- | --- | --- |
|13 | Neurontin100mg hard capsule; gabapentin100mg/capsule; oral | Human Rx, historical reference: this package has marketing-end2026-07-31. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee9ad9ed-6d9f-4ee1-9d7f-cfad438df388) |
|14 | Sandoz omeprazole delayed-release10mg capsule; enteric granules, oral | Human Rx; do not crush/chew granules or redefine as ordinary powder. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=516170d4-4913-4577-a2d2-f5c52d1e79c6) |
|15 | Precision Dose famotidine20mg film-coated tablet, oral | Human OTC, no animal course authority. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=de42b6c4-c44b-4ec1-b505-fc5266452d57) |
|18 | PuraCap ursodiol300mg capsule, oral; ursodeoxycholic acid alias | Human Rx, human long-term indication is not a veterinary course. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=9d7f26d5-d8a9-4610-8d78-80ca3d442a79&type=display) |
|19 | Legalon capsule:180mg milk-thistle dry extract equivalent to140mg silymarin | Human adult Brazilian label2021-12-02; distinguish extract and silymarin amounts, do not open/split capsule. [Viatris label](https://www.viatris.com/-/media/project/common/viatris/pdf/brazil/leaflets_legacy_myl_brazil/legalon_bula_profissional_de_saude.pdf) |
|23 | Vetmedin1.25mg pimobendan chewable tablet, oral, divisible halves | Dog veterinary label: preferred0.5mg/kg/day in2 doses; no fixed course. [VMD SPC](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2583819.PDF) |
|25 | Prilactone Next10mg spironolactone chewable tablet, oral, divisible halves | Dogs;2mg/kg once daily with food; no fixed course. [VMD SPC](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2765469.PDF) |
|27 | FortiFlora Canine1g sachet; Enterococcus faecium SF68 1e8CFU/sachet, oral powder | Dog supplement, not medication. One sachet/day or veterinarian direction; no course. Never CFU→mg. [Purina](https://www.purina.com/dogs/shop/pro-plan-veterinary-supplements-fortiflora) |
|28 | Oralade Advanced GI+500mL oral hydration drink; Na0.14%,K0.08%,Cl0.2% | Dogs/cats, not injection. Four-day refrigerated after-opening limit is storage, not treatment duration. No inferred%→mg/mL. [Manufacturer](https://www.oralade.com/pages/advanced-gi) |
|29 | Durvet chlorhexidine gluconate2.0% aqueous topical solution | Dogs/horses. Label dilution1fl oz/gallon water; no fixed application volume. [Manufacturer](https://www.durvet.com/product/chlorhexidine-2-solution/) |
|30 | TopCare povidone-iodine10% topical solution, available iodine1% | Human OTC; distinguish PVP-I from available iodine; not eyes. Small amount1–3 times/day; no numeric mL. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e42eee1b-3539-fb17-e053-2995a90af61d) |
|31 | Muricin2% mupirocin20mg/g topical ointment,15g tube | Dogs, not ophthalmic. Enough to cover area twice daily, max30days; no g/application. [Veterinary label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ded00eb4-5edb-46d6-9f86-460d9de01d0b) |
|32 | Silvadene1% silver sulfadiazine10mg/g topical cream | Human Rx burn-care reference.1–2 times/day,1/16-inch layer; no fixed g/course. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=c437213a-1cd4-445e-a39f-bbcacb9f746f) |
|33 | Refresh Tears carboxymethylcellulose sodium0.5%=5mg/mL sterile ophthalmic solution,15mL bottle | Human OTC.1–2drops as needed; no mL/drop or animal dose. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=329d1fe0-4432-4565-b7b1-65666bd86526) |
|34 | Caplin ofloxacin0.3%=3mg/mL sterile ophthalmic solution,5mL | Human Rx, staged indication-specific regimen; do not use as animal default or infer drop volume. [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=53f7ec2e-5b4c-4f8c-b8ba-7f8844e0c01b) |
|35 | Optimmune ciclosporin A2mg/g (0.2%) ophthalmic ointment | Dogs; explicit eyedrop→ointment redefinition. Approx0.5cm strip every12h, no strip→g/drop conversion. [VMD SPC March2026](https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_138967.PDF) |
|36 | Epi-Otic South African ear cleaner: salicylic acid0.2%w/w,EDTA0.5%w/w,chloroxylenol0.09%w/w,diethylhexyl sodium sulfosuccinate0.5%w/w | Dogs/cats; not therapeutic otic drug. Routine2–3/week, no mL/application; not ruptured eardrum. [Virbac ZA](https://vet-za.virbac.com/home/products/dogs/otics/epi-otic.html) |
|37 | Humilac Japanese leave-on moisturizer liquid/spray250mL; urea,lactic acid,glycerin,propylene glycol | Dogs/cats; concentrations, spray volume and fixed frequency unpublished. Finished-product count only, no invented active-mass formula. [Virbac JP](https://jp.virbac.com/products/dermalcare/humilac) |
| synthetic07 | Cerenia maropitant10mg/mL injectable solution, selected SC identity | Dogs/cats with label age/route restrictions.1mg/kg=0.1mL/kg once daily up to5days for acute vomiting; not universal injectable dose. [Veterinary label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6aeda328-97c9-4868-8ecb-b3a4dcdbc0a0) |

Durvet's DailyMed structured ingredient table states99g/L, conflicting with its
printed2% label/manufacturer page. Do not ingest the conflicting structured value:
[conflicting record](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=98c833c7-9db4-457a-89fc-6e12fc9292c3).
Pin Epi-Otic regional formulation; US Advanced is different. No drop→mL,
strip→g, spray→mL or area→g inference is permitted. Unpublished moisturizer
concentration does not authorize inventing one.

## Two quantity conflicts

`a006858`:0.25×1×1=0.25tablet, stored0.5. `a014075`:0.25×3×5=3.75tablets,
stored4. PR019 generator line221 uses `Math.ceil(value*2)/2` on the course total;
its metadata preserves `dispenseRoundingRule=ceil_0_5`. Generic schemaV1 lost this
structured reason, so WP00 correctly blocked it. Restore explicit preparation
scope/increment/direction and separate theoretical total, practical planned total
and actual fulfillment. Do not alter dose to make totals equal.

## Reusable source files

- PR017 `clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json`:
  products, dispensingProfiles, productIngredients, ingredients and direct evidence.
- PR019 `clinical-master-pr-019/dispensing-master-presets.v1.json`:
  entries with exact detailInputs, metadata and fieldEvidence.
- PR019 `dispensing-default-source-extracts.v1.json`: original extracted sources.
- Frozen manifest and WP01A non-applied candidates are the exact51-set authority.
