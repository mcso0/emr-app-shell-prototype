import type { UserRole } from "@/features/home/home.types";

export const HOME_ROLE_LABELS: Record<UserRole, string> = {
  owner: "원장/관리자",
  veterinarian: "수의사",
  technician: "테크니션",
  desk: "데스크",
  billing: "수납 담당",
};

export const HOME_ROLE_USER_NAMES: Record<UserRole, string> = {
  owner: "송원장님",
  veterinarian: "이수지 수의사님",
  technician: "송하윤 테크니션님",
  desk: "최유나 매니저님",
  billing: "한지민 수납 담당님",
};

export function mapAuthRoleToHomeRole(role?: string): UserRole {
  if (role === "front_desk") return "desk";
  if (role === "vet") return "veterinarian";
  if (role === "nurse") return "technician";
  if (role === "billing_admin") return "billing";
  if (role === "hospital_admin") return "owner";

  return "veterinarian";
}
