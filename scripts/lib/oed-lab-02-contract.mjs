// Offline research proof only. Never import into application/runtime code.
export function evaluateNumeric({ profile, definition, species, unit, value, qualifier = "exact", deviceFlag = null }) {
  if (!profile) return { state: "profile_required", interpretation: null };
  if (profile.species !== species) return { state: "species_mismatch", interpretation: null };
  const rule = profile.rules.find((row) => row.resultDefinitionId === definition.resultDefinitionId);
  if (!rule) return { state: "unsupported_parameter", interpretation: null };
  if (!rule.resultSupported) return { state: "unsupported_parameter", interpretation: null };
  if (unit !== rule.unit) return { state: "unit_mismatch", interpretation: null };
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return { state: "not_entered", interpretation: null };
  }
  if (value === "--.--") return { state: "instrument_no_result", interpretation: null };
  if (qualifier !== "exact") return { state: "qualified_result", interpretation: "not_evaluated" };
  if ((typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))) {
    return { state: "invalid_number", interpretation: null };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (unit === "%" && number > 100)) {
    return { state: "invalid_number", interpretation: null };
  }
  if (deviceFlag) return { state: "flagged_result", interpretation: "not_evaluated", value: number, deviceFlag };
  if (rule.displayRange && (number < rule.displayRange.low || number > rule.displayRange.high)) {
    return { state: "outside_documented_display_range", interpretation: "not_evaluated", value: number };
  }
  if (!rule.referenceInterval) return { state: "recorded_without_interval", interpretation: "not_evaluated", value: number };
  const { low, high } = rule.referenceInterval;
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) throw new Error("Invalid research interval");
  return { state: "recorded", interpretation: number < low ? "low" : number > high ? "high" : "normal", value: number };
}

export function expandSet(rootId, sets, atomicOrders, selectedOptionalIds = []) {
  const setById = new Map(sets.map((row) => [row.setId, row]));
  const orderById = new Map(atomicOrders.map((row) => [row.orderId, row]));
  const leaves = new Map();
  const selected = new Set(selectedOptionalIds);
  const visit = (id, path) => {
    if (path.includes(id)) throw new Error("Cycle in candidate set");
    const nextPath = [...path, id];
    const set = setById.get(id);
    if (set) {
      for (const member of set.members) {
        if (member.defaultIncluded || selected.has(member.memberId)) visit(member.memberId, nextPath);
      }
      return;
    }
    if (!orderById.has(id)) throw new Error(`Unknown candidate order: ${id}`);
    const leaf = leaves.get(id) ?? { orderId: id, requestedPaths: [] };
    leaf.requestedPaths.push(nextPath);
    leaves.set(id, leaf);
  };
  visit(rootId, []);
  return [...leaves.values()];
}

export function snapshotOrder({ order, definition, profile, species, requestId, rootRequestId, requestedAt }) {
  if (!profile || !(Array.isArray(profile.species) ? profile.species.includes(species) : profile.species === species)) throw new Error("Explicit matching profile required");
  if (order.resultDefinitionId !== definition.resultDefinitionId) throw new Error("Order/definition mismatch");
  const rule = profile.rules.find((row) => row.resultDefinitionId === definition.resultDefinitionId);
  if (!rule?.resultSupported) throw new Error("Unsupported result/profile combination");
  return structuredClone({ requestId, rootRequestId, orderId: order.orderId, requestedAt,
    species, orderRevision: order.revision, definitionSnapshot: definition,
    profileSnapshot: { profileId: profile.profileId, revision: profile.revision,
      species: profile.species, provenance: profile.provenance, method: profile.method,
      equipment: profile.equipment, specimenKey: profile.specimenKey, rule },
    status: "requested", previousRequestId: null, previousResultId: null });
}

export function requestRetest(previous, { requestId, previousResultId, requestedAt, reason, specimenDecision }) {
  if (previous.status !== "completed" || previous.result?.resultId !== previousResultId
      || !requestId || requestId === previous.requestId || !previousResultId || !reason?.trim()
      || !["new_collection", "reuse_confirmed_by_operator"].includes(specimenDecision)) throw new Error("Explicit retest context required");
  return { ...structuredClone(previous), requestId, requestedAt, status: "requested",
    previousRequestId: previous.requestId, previousResultId, reason, specimenDecision,
    retainedProfilePolicy: "explicit_same_profile_for_comparison", result: null };
}

export function evaluateManual({ profile, species, interpretation, findings, attachments = [] }) {
  if (!profile) return { state: "profile_required" };
  if (!Array.isArray(profile.species) || !profile.species.includes(species)) return { state: "species_mismatch" };
  if (!interpretation && !findings?.trim()) return { state: "not_entered" };
  if (!profile.rules[0]?.codeSet.includes(interpretation)) return { state: "invalid_code" };
  if (!findings?.trim() && interpretation !== "not_performed") return { state: "findings_required" };
  return { state: "recorded", interpretation, findings: findings ?? "", attachments: structuredClone(attachments), referenceInterval: null };
}

export function calculateDerived(code, inputs) {
  const formulas = {
    HCT: ["RBC","MCV",(a,b)=>a*b/10], MCH: ["HGB","RBC",(a,b)=>a*10/b],
    MCHC: ["HGB","HCT",(a,b)=>a*100/b], PCT: ["PLT","MPV",(a,b)=>a*b/10000],
    RETIC_PCT: ["RETIC_ABS","RBC",(a,b)=>a/(b*1000)*100],
  };
  for(const cell of ["NEU","LYM","MONO","EOS","BASO"]) formulas[`${cell}_PCT`]=[`${cell}_ABS`,"WBC",(a,b)=>a/b*100];
  const rule=formulas[code];
  if(!rule) throw new Error("Unsupported calculation");
  const [a,b,calculate]=rule;
  if(!Number.isFinite(inputs[a])||!Number.isFinite(inputs[b])||inputs[a]<0||inputs[b]<=0) throw new Error("Same-attempt valid supporting measurements required");
  return calculate(inputs[a],inputs[b]);
}
