export function getReceptionDemoActorId(role?: string) {
  if (role === "hospital_admin" || role === "billing_admin")
    return "user-admin";
  if (role === "vet") return "user-vet";
  return "user-front-desk";
}
