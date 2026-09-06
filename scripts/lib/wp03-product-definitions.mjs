// Reviewed public identity references. Every quantity/course below is an authored
// functional fixture, NOT animal prescribing guidance or clinical validation.
const dm = id => `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${id}`;
const vmd = id => `https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_${id}.PDF`;

export const wp03NewProducts = [
  ["13", "neurontin-100mg-capsule", "Neurontin 100 mg capsule", "Hard capsule", "gabapentin 100 mg/capsule", dm("ee9ad9ed-6d9f-4ee1-9d7f-cfad438df388"), ["human"], "capsule", "PO", 1, "sid", 3, "완전한 캡슐 계수; 과거 인체용 제품 참조, 실제 동물 투여 지시 아님"],
  ["14", "omeprazole-10mg-delayed-capsule", "Sandoz omeprazole 10 mg delayed-release capsule", "Delayed-release capsule", "omeprazole 10 mg/capsule; enteric granules", dm("516170d4-4913-4577-a2d2-f5c52d1e79c6"), ["human"], "capsule", "PO", 1, "sid", 5, "장용 과립을 분쇄하지 않는 캡슐 취급 시나리오"],
  ["15", "famotidine-20mg-tablet", "Precision Dose famotidine 20 mg tablet", "Film-coated tablet", "famotidine 20 mg/tablet", dm("de42b6c4-c44b-4ec1-b505-fc5266452d57"), ["human"], "tablet", "PO", 1, "sid", 3, "완전한 정제 계수; 분할 가능성을 가정하지 않음"],
  ["18", "ursodiol-300mg-capsule", "PuraCap ursodiol 300 mg capsule", "Capsule", "ursodiol 300 mg/capsule", dm("9d7f26d5-d8a9-4610-8d78-80ca3d442a79"), ["human"], "capsule", "PO", 1, "sid", 7, "인체용 제품의 형태만 참조한 합성 캡슐 계수"],
  ["19", "legalon-silymarin-140mg-capsule", "Legalon silymarin 140 mg capsule", "Capsule", "180 mg milk-thistle dry extract equivalent to 140 mg silymarin", "https://www.viatris.com/-/media/project/common/viatris/pdf/brazil/leaflets_legacy_myl_brazil/legalon_bula_profissional_de_saude.pdf", ["human"], "capsule", "PO", 1, "sid", 7, "추출물 180 mg과 실리마린 140 mg을 구분; 캡슐 개봉·분할 없음"],
  ["23", "vetmedin-1-25mg-tablet", "Vetmedin 1.25 mg chewable tablet", "Chewable tablet", "pimobendan 1.25 mg/tablet; divisible halves", vmd("2583819"), ["dog"], "tablet", "PO", 0.5, "bid", 5, "0.5정 단위 분할 계수; 체중별 임상 처방값을 의미하지 않음"],
  ["25", "prilactone-next-10mg-tablet", "Prilactone Next 10 mg chewable tablet", "Chewable tablet", "spironolactone 10 mg/tablet; divisible halves", vmd("2765469"), ["dog"], "tablet", "PO", 0.5, "sid", 5, "분할 정제 계수와 식이 안내 구분; 합성 수량·기간"],
  ["27", "fortiflora-canine-1g-sachet", "FortiFlora Canine 1 g sachet", "Supplement powder sachet", "1 g/sachet; E. faecium SF68 1e8 CFU/sachet; no CFU-to-mass conversion", "https://www.purina.com/dogs/shop/pro-plan-veterinary-supplements-fortiflora", ["dog"], "g", "PO", 1, "sid", 5, "1 g 완제품 포 단위 취급; CFU를 약물 mg으로 환산하지 않음"],
  ["28", "oralade-advanced-gi-500ml", "Oralade Advanced GI+ 500 mL", "Oral hydration drink", "Na 0.14%; K 0.08%; Cl 0.2%; 500 mL bottle", "https://www.oralade.com/pages/advanced-gi", ["dog", "cat"], "ml", "PO", 5, "bid", 2, "경구 완제품 체적 계량; 개봉 후 보관 기한을 처방 일수로 해석하지 않음"],
  ["29", "durvet-chlorhexidine-2-percent", "Durvet chlorhexidine 2% solution", "Aqueous cutaneous solution", "chlorhexidine gluconate 2.0%; manufacturer printed label, conflicting structured 99 g/L excluded", "https://www.durvet.com/product/chlorhexidine-2-solution/", ["dog", "horse"], "ml", "topical", 1, "once", 1, "용기에서 계량하는 합성 준비량; 희석·환부 투여량 또는 관류액으로 사용하지 않음"],
  ["30", "topcare-povidone-iodine-10-percent", "TopCare povidone-iodine 10% solution", "Cutaneous solution", "povidone-iodine 10%; available iodine 1%", dm("e42eee1b-3539-fb17-e053-2995a90af61d"), ["human"], "ml", "topical", 1, "once", 1, "PVP-I와 유효 요오드 함량 구분; 안과용 제품이 아님"],
  ["31", "muricin-mupirocin-2-percent", "Muricin mupirocin 2% ointment", "Cutaneous ointment", "mupirocin 20 mg/g; 15 g tube", dm("ded00eb4-5edb-46d6-9f86-460d9de01d0b"), ["dog"], "g", "topical", 0.25, "bid", 3, "면적에서 g을 환산하지 않는 합성 계량 시나리오; 안과용 아님"],
  ["32", "silvadene-silver-sulfadiazine-1-percent", "Silvadene silver sulfadiazine 1% cream", "Cutaneous cream", "silver sulfadiazine 10 mg/g", dm("c437213a-1cd4-445e-a39f-bbcacb9f746f"), ["human"], "g", "topical", 0.5, "sid", 3, "도포 면적·두께를 질량으로 환산하지 않음; 합성 계량값"],
  ["33", "refresh-tears-cmc-0-5-percent", "Refresh Tears 0.5% ophthalmic solution", "Sterile ophthalmic solution", "carboxymethylcellulose sodium 5 mg/mL; 15 mL bottle", dm("329d1fe0-4432-4565-b7b1-65666bd86526"), ["human"], "drop", "ophthalmic", 1, "bid", 3, "방울 계수만 사용; 방울에서 mL로 환산하지 않음"],
  ["34", "caplin-ofloxacin-0-3-percent", "Caplin ofloxacin 0.3% ophthalmic solution", "Sterile ophthalmic solution", "ofloxacin 3 mg/mL; 5 mL bottle", dm("53f7ec2e-5b4c-4f8c-b8ba-7f8844e0c01b"), ["human"], "drop", "ophthalmic", 1, "sid", 3, "인체 적응증별 투여법을 동물 기본값으로 복사하지 않은 합성 방울 계수"],
  ["35", "optimmune-ciclosporin-0-2-percent", "Optimmune ciclosporin 0.2% ophthalmic ointment", "Ophthalmic ointment", "ciclosporin A 2 mg/g; reference application approximately 0.5 cm strip", vmd("138967"), ["dog"], "application", "ophthalmic", 1, "bid", 3, "점안액이 아닌 안연고로 재정의; 1 application은 참조된 약 0.5 cm 스트립, g·방울 환산 없음"],
  ["36", "epi-otic-za-ear-cleaner", "Epi-Otic South Africa ear cleaner", "Otic cleaning solution", "salicylic acid 0.2% w/w; EDTA 0.5%; chloroxylenol 0.09%; diethylhexyl sodium sulfosuccinate 0.5%", "https://vet-za.virbac.com/home/products/dogs/otics/epi-otic.html", ["dog", "cat"], "ml", "otic", 1, "once", 1, "남아공 제형으로 고정; 임의 고막 상태나 치료 효과를 가정하지 않는 계량 시나리오"],
  ["37", "humilac-jp-moisturizer-spray", "Humilac Japan moisturizer spray 250 mL", "Leave-on moisturizer spray", "urea, lactic acid, glycerin, propylene glycol; concentrations and volume per spray unpublished", "https://jp.virbac.com/products/dermalcare/humilac", ["dog", "cat"], "spray", "topical", 1, "sid", 3, "분무 횟수만 계수; 농도·분무 체적·약물 질량은 생성하지 않음"],
  ["synthetic07", "cerenia-maropitant-10mg-ml-sc", "Cerenia maropitant 10 mg/mL SC injection", "Injectable solution", "maropitant 10 mg/mL; SC route reference", dm("6aeda328-97c9-4868-8ecb-b3a4dcdbc0a0"), ["dog", "cat"], "ml", "SC", 1, "once", 1, "일반 주사제가 아닌 명시된 제품·SC 경로로 재정의; 1 mL는 계량 UI 검증용 합성값이며 체중별 임상 용량이 아님"],
].map(([legacySuffix, key, productName, dosageForm, strengthDescription, sourceUri, referenceSpecies, unit, route, dose, frequency, durationDays, instruction]) => ({
  legacySuffix, key, productName, dosageForm, strengthDescription, sourceUri, referenceSpecies,
  unit, route, dose, frequency, durationDays, instruction,
}));

export const wp03ExistingProductReplacements = {
  "01": "a011336", "02": "a011579", "03": "a011528", "04": "a011677", "05": "a000129",
  "06": "a012088", "07": "a014491", "08": "a011451", "09": "a002967", "10": "a007863",
  "11": "a006858", "12": "a007661", "16": "a006644", "17": "a011738", "20": "a009275",
  "21": "a008547", "22": "a011385", "24": "a014343", "26": "a014092",
};

export const wp03GenericProductReplacements = {
  "cm.order.dispensing.oral": "a011336", "cm.order.dispensing.topical": "a010528",
  "01": "a011595", "02": "a001642", "03": "a012406", "04": "a014340", "05": "a011336",
  "06": "a000129", "08": "a011300", "09": "a010528", "10": "a014092",
  // Packaging-only services are explicitly redefined as these complete products.
  "11": "a000129", "12": "a010528",
};
