// Compare source labels, never select or apply a clinical specimen automatically.
export function compareSpecimenLabels(specimenKey, candidateSpecimen) {
  if (!specimenKey) return "unbound_fixture";
  if (!candidateSpecimen) return "missing_candidate";
  const fixtureLabel = specimenKey.replace(/^cm\.specimen\./, "");
  if (fixtureLabel === candidateSpecimen) return "same_source_label";
  if (candidateSpecimen === "blood" && ["edta-whole-blood", "serum", "citrate-plasma"].includes(fixtureLabel)) {
    return "blood_processing_unspecified";
  }
  if (fixtureLabel === "cytology-slide") return "collection_vs_preparation_needs_review";
  if (candidateSpecimen === "other") return "candidate_underspecified";
  return "conflicting_source_labels";
}
