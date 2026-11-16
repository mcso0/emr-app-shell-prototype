import { isDispenseQuantityRule, type DispenseQuantityRule, type DispenseRuleSettings } from "@/features/chart/dispense-request-quantity";

export type DispenseRuleProduct = { catalogItemId: string; productKey: string; name: string; unit: string | null };
export type DispenseRuleRead = DispenseRuleSettings & { products: DispenseRuleProduct[]; canManage: boolean };
export type DispenseRuleMutation = {
  expectedRevision: number;
  target: "hospital" | "products";
  unit: string;
  rule: DispenseQuantityRule | null;
  catalogItemIds: string[];
};
export function isDispenseRuleMutation(value: unknown): value is DispenseRuleMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as DispenseRuleMutation;
  return Number.isInteger(input.expectedRevision) && input.expectedRevision >= 0 &&
    ["hospital", "products"].includes(input.target) &&
    typeof input.unit === "string" && input.unit.trim().length > 0 && input.unit.length <= 40 &&
    (input.rule === null || isDispenseQuantityRule(input.rule)) &&
    Array.isArray(input.catalogItemIds) && input.catalogItemIds.length <= 500 &&
    input.catalogItemIds.every(id => typeof id === "string" && id.trim().length > 0 && id.length <= 200) &&
    (input.target !== "products" || input.catalogItemIds.length > 0) &&
    (input.target !== "hospital" || input.rule === null || input.rule.unit === input.unit);
}
export function dispenseRuleErrorStatus(message: string) {
  if (message.includes("permission_missing")) return 403;
  if (message.includes("revision_conflict")) return 409;
  if (["invalid_rule_input", "rule_unit_mismatch", "catalog_item_unavailable"].some(key => message.includes(key))) return 422;
  return 503;
}
