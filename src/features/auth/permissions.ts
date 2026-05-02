import type { MockAuthRole } from "@/features/auth/mock-session";

export type MockAuthCapability =
  | "view_reception"
  | "view_chart"
  | "view_lab_imaging"
  | "view_dispensing"
  | "view_billing"
  | "edit_orders"
  | "manage_hospital";

const roleCapabilities: Record<MockAuthRole, MockAuthCapability[]> = {
  front_desk: ["view_reception"],
  vet: ["view_reception", "view_chart", "view_lab_imaging", "view_dispensing", "edit_orders"],
  nurse: ["view_reception", "view_lab_imaging", "view_dispensing"],
  billing_admin: ["view_reception", "view_billing"],
  hospital_admin: [
    "view_reception",
    "view_chart",
    "view_lab_imaging",
    "view_dispensing",
    "view_billing",
    "edit_orders",
    "manage_hospital",
  ],
};

export function getMockAuthCapabilities(role: MockAuthRole): MockAuthCapability[] {
  return [...roleCapabilities[role]];
}

export function hasMockAuthCapability(role: MockAuthRole, capability: MockAuthCapability) {
  return roleCapabilities[role].includes(capability);
}

export function canViewBilling(role: MockAuthRole) {
  return hasMockAuthCapability(role, "view_billing");
}

export function canEditOrders(role: MockAuthRole) {
  return hasMockAuthCapability(role, "edit_orders");
}

export function canManageHospital(role: MockAuthRole) {
  return hasMockAuthCapability(role, "manage_hospital");
}
