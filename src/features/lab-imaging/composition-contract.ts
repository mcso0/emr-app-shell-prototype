export type LabComposition = {
  schemaVersion: 1; id: string; masterKey: string; revision: number; displayName: string;
  originalOrderMasterKey: string | null; targetSpecies: Array<"dog" | "cat">;
  members: Array<{ kind: "composition" | "order"; memberKey: string; defaultIncluded: boolean }>;
};
export type ExpandedLabLeaf = { masterKey: string; defaultIncluded: boolean; path: Array<{ key: string; versionId: string; name: string; ordinal: number }> };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const nonempty = (v: unknown, max = 200): v is string => typeof v === "string" && !!v.trim() && v.length <= max;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys = new Set(["schemaVersion", "id", "masterKey", "revision", "displayName", "originalOrderMasterKey", "targetSpecies", "members"]);
export function parseLabComposition(value: unknown): LabComposition | null {
  if (!record(value) || Object.keys(value).some(key => !keys.has(key)) || value.schemaVersion !== 1 || !nonempty(value.id) || !uuid.test(value.id) || !nonempty(value.masterKey)
    || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || !nonempty(value.displayName, 300)
    || !(value.originalOrderMasterKey === null || nonempty(value.originalOrderMasterKey))
    || !Array.isArray(value.targetSpecies) || !value.targetSpecies.length || value.targetSpecies.some(s => !["dog", "cat"].includes(s))
    || new Set(value.targetSpecies).size !== value.targetSpecies.length
    || !Array.isArray(value.members) || value.members.length < 1 || value.members.length > 200
    || value.members.some(m => !record(m) || Object.keys(m).some(key => !["kind", "memberKey", "defaultIncluded"].includes(key)) || !["composition", "order"].includes(String(m.kind)) || !nonempty(m.memberKey) || typeof m.defaultIncluded !== "boolean")
    || new Set(value.members.map(m => m.memberKey)).size !== value.members.length) return null;
  return value as LabComposition;
}

// Source hierarchy is preserved in each execution leaf's path. Runtime execution
// consumes only pinned atomic orders, not recursively executable container tasks.
export function expandLabComposition(graph: LabComposition[], rootKey: string, atomicOrderKeys: Set<string>): ExpandedLabLeaf[] {
  if (graph.some(node => !parseLabComposition(node)) || new Set(graph.map(node => node.masterKey)).size !== graph.length)
    throw Error("invalid_lab_composition_graph");
  const nodes = new Map(graph.map(node => [node.masterKey, node]));
  const leaves: ExpandedLabLeaf[] = []; const seen = new Set<string>();
  const visit = (key: string, path: ExpandedLabLeaf["path"], selected: boolean) => {
    const node = nodes.get(key);
    if (!node) throw Error("lab_composition_child_missing");
    if (path.some(step => step.key === key)) throw Error("lab_composition_cycle");
    if (path.length >= 4) throw Error("lab_composition_depth_exceeded");
    node.members.forEach((member, index) => {
      const nextPath = [...path, { key, versionId: node.id, name: node.displayName, ordinal: index + 1 }];
      if (member.kind === "composition") visit(member.memberKey, nextPath, selected && member.defaultIncluded);
      else {
        if (!atomicOrderKeys.has(member.memberKey)) throw Error("lab_composition_order_missing");
        if (seen.has(member.memberKey)) throw Error("lab_composition_duplicate_leaf");
        seen.add(member.memberKey);
        leaves.push({ masterKey: member.memberKey, defaultIncluded: selected && member.defaultIncluded, path: nextPath });
        if (leaves.length > 200) throw Error("lab_composition_leaf_limit");
      }
    });
  };
  visit(rootKey, [], true);
  return leaves;
}
