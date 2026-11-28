// DEMO-DATA-PR-003. Turns the fictional visits in cheongdam-chart-history.data.mjs
// into replay input for private.clair_demo_replay_batch (see
// supabase/snippets/demo-data-pr-003_replay_engine.sql).
//
//   node scripts/demo-data/build-cheongdam-chart-replay.mjs [out-dir] [batch-size]
//
// Writes batch-NN.json (compact visit arrays) and replay-visits.sql. Abstract
// order keys become real catalog items, order sets and hospital drug names.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { vets, visits } from "./cheongdam-chart-history.data.mjs";

const outDir = process.argv[2] ?? "supabase/snippets/demo-data-pr-003_replay";
// Keep batches small. 16 visits in one call exhausted the hosted Free-plan database.
const batchSize = Number(process.argv[3] ?? 4);

// Reception accepts a start time inside treatment hours (09:00-19:00), so later visits are moved to 18:30.
// Seed patients CD-P-001..025: species and a plausible body weight (kg).
const patients = {
  1: ["dog", 2.1], 2: ["dog", 5.4], 3: ["cat", 4.0], 4: ["dog", 3.2], 5: ["cat", 4.8], 6: ["dog", 16.2], 7: ["dog", 6.0],
  8: ["cat", 4.6], 9: ["dog", 11.8], 10: ["cat", 3.9], 11: ["dog", 28.5], 12: ["cat", 2.7], 13: ["dog", 9.5], 14: ["cat", 5.6],
  15: ["dog", 6.9], 16: ["dog", 22.0], 17: ["cat", 4.7], 18: ["dog", 12.6], 19: ["cat", 4.4], 20: ["dog", 10.5], 21: ["dog", 11.2],
  22: ["cat", 4.1], 23: ["dog", 4.9], 24: ["cat", 5.8], 25: ["dog", 8.2],
};

const hash = (text) => [...text].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);
const pick = (seed, min, max, digits = 0) => Number((min + ((hash(seed) % 1000) / 1000) * (max - min)).toFixed(digits));

function drugs(v, species) {
  const text = `${v.dx.map((d) => d[0]).join(" ")} ${v.cc} ${v.P}`;
  const days = Number(/(\d+)일분/.exec(v.P)?.[1] ?? 0) || undefined;
  const rx = (name, d = days) => (d ? { rx: name, days: d } : { rx: name });
  if (/위장염|구토|설사|묽은 변|췌장염/.test(text)) return [rx("마로피탄트 16mg 정", 3), rx("파모티딘 10mg 정", days ?? 5)];
  if (/외이염/.test(text)) return [{ rx: "겐타마이신·베타메타손·클로트리마졸 점이액" }];
  if (/알레르기성 피부염/.test(text)) return species === "dog" ? [rx("오클라시티닙 5.4mg 정")] : [rx("프레드니솔론 5mg 정")];
  if (/피부염/.test(text)) {
    return [rx(species === "dog" ? "세팔렉신 250mg 캡슐" : "아목시실린·클라불란산 62.5mg 정"), { rx: "클로르헥시딘 2% 약용 샴푸" }];
  }
  if (/슬개골|추간판|관절|골연골/.test(text)) {
    return species === "dog" ? [rx("멜록시캄 1mg 정"), rx("가바펜틴 100mg 캡슐")] : [rx("가바펜틴 100mg 캡슐")];
  }
  if (/하부요로/.test(text)) return [rx("프라조신 1mg 정")];
  if (/상부호흡기/.test(text)) return [rx("독시사이클린 100mg 정")];
  if (/기관지염|기침|기도/.test(text)) return [rx("테오필린 100mg 서방정")];
  return [rx("아목시실린·클라불란산 62.5mg 정")];
}

function radiograph(v) {
  const text = `${(v.img ?? []).map((i) => i[0]).join(" ")} ${v.dx.map((d) => d[0]).join(" ")} ${v.cc}`;
  const finding = v.O.split(/(?<=\.)\s+/).filter((part) => /방사선/.test(part)).join(" ") || v.O;
  const row = (id, views) => ({ id, views, find: finding, interp: v.A });
  if (/stifle|슬개골|슬관절/.test(text)) return row("v4.imaging.06", ["좌측 슬관절 측면", "좌측 슬관절 전후"]);
  if (/spine|추간판|척추/.test(text)) return row("synthetic.imaging-03", ["흉요추 측면", "흉요추 복배"]);
  if (/hip|고관절/.test(text)) return row("v4.imaging.07", ["골반 복배 신전"]);
  if (/tarsus|골연골|족근/.test(text)) return row("v4.imaging.11", ["족근관절 측면", "족근관절 전후"]);
  if (/thorax|기침|기관|흉부|심장/.test(text)) return row("imaging.chest-radiography", ["흉부 우측면", "흉부 복배"]);
  return row("imaging.abdominal-radiography", ["복부 우측면", "복부 복배"]);
}

// The catalog default for subcutaneous fluids expects a linked drug order; a direct amount needs no link.
function fluid(weight) {
  const amount = Math.min(300, Math.max(50, Math.round((weight * 20) / 10) * 10));
  return {
    id: "synthetic.treatment-02",
    inputs: {
      procedureKind: "administration", method: "피하 주입", plannedProcedureCount: 1, procedureCountUnit: "session", frequency: "once",
      schedule: "진료 중 1회", administrationPolicy: "direct_quantity", plannedAmount: amount, plannedAmountUnit: "mL",
      productReference: "하트만 수액", plannedRoute: "SC", site: "견갑 사이 피하",
      stagedInstructions: `하트만 수액 ${amount}mL 피하 주입`, exceptions: "주입부 부종 지속 시 보고",
    },
  };
}

function orders(v, species, weight) {
  return v.orders.flatMap((key) => {
    switch (key) {
      case "consult-first": return [{ id: "consult.first-visit", did: "문진과 신체검사 시행", out: v.A }];
      case "consult-revisit": return [{ id: "consult.followup", did: "경과 확인과 신체검사 시행", out: v.A }];
      case "vaccine-core": return [{
        id: species === "dog" ? "synthetic.preventive-01" : "synthetic.preventive-04",
        did: "접종 전 신체검사 후 종합백신 접종", out: "접종 후 30분 관찰, 이상 반응 없음",
      }];
      case "cbc": return [{ set: "전혈구 기본 패널" }];
      case "chem10": return [{ set: "기본 혈청화학 패널" }];
      case "ua": return [{ set: "요검사 패널" }];
      case "fluid-sc": return [fluid(weight)];
      case "ear-clean": return [{ id: "treatment.ear-cleaning" }];
      case "xray2": return [radiograph(v)];
      case "us-abdomen": return [{ id: "imaging.abdominal-ultrasound", views: ["간·담낭", "신장", "위장관"], find: v.O, interp: v.A }];
      case "oral-rx": return drugs(v, species);
      default: throw new Error(`unknown order key ${key}`);
    }
  });
}

const lastWeight = {};
const replay = [...visits].sort((a, b) => a.at.localeCompare(b.at)).map((v) => {
  const [species, baseWeight] = patients[v.p];
  const weight = Number(/체중 ([\d.]+)\s*kg/.exec(v.O)?.[1] ?? lastWeight[v.p] ?? baseWeight);
  lastWeight[v.p] = weight;
  const seed = `${v.p}|${v.at}`;
  const vit = {
    weightKg: weight,
    temperatureC: Number(/체온 ([\d.]+)/.exec(v.O)?.[1] ?? pick(seed, 38.2, 38.9, 1)),
    heartRateBpm: species === "cat" ? pick(`${seed}h`, 160, 200) : pick(`${seed}h`, 88, 128),
    respiratoryRateRpm: pick(`${seed}r`, 20, 32),
  };
  return {
    pat: `49121000-0000-4000-8000-${String(v.p).padStart(12, "0")}`,
    vet: vets[v.vet], at: `${(v.at.slice(11) > "18:30" ? `${v.at.slice(0, 11)}18:30` : v.at).replace(" ", "T")}:00+09:00`, purpose: v.purpose, cc: v.cc, vit,
    S: v.S, O: v.O, A: v.A, P: v.P, dx: v.dx,
    ...(v.status === "draft" ? { draft: true } : {}),
    orders: orders(v, species, weight),
  };
});

mkdirSync(outDir, { recursive: true });
const sql = [
  "-- Generated by scripts/demo-data/build-cheongdam-chart-replay.mjs. Run after the replay engine is installed.",
  "-- Each statement is one transaction. A visit that already exists is skipped, so batches can be re-run.",
];
for (let i = 0; i * batchSize < replay.length; i += 1) {
  const batch = replay.slice(i * batchSize, (i + 1) * batchSize);
  const name = `batch-${String(i + 1).padStart(2, "0")}`;
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(batch));
  sql.push(
    `-- ${name}: ${batch.length} visits, ${batch[0].at.slice(0, 10)} to ${batch.at(-1).at.slice(0, 10)}`,
    `select private.clair_demo_replay_batch($replay$${JSON.stringify(batch)}$replay$::jsonb, false);`,
  );
}
writeFileSync(join(outDir, "replay-visits.sql"), `${sql.join("\n")}\n`);

const kinds = {};
for (const v of replay) {
  for (const o of v.orders) {
    const key = o.set ?? o.rx ?? o.id;
    kinds[key] = (kinds[key] ?? 0) + 1;
  }
}
console.log(JSON.stringify({ visits: replay.length, drafts: replay.filter((v) => v.draft).length, kinds }, null, 1));
