import { PasswordRecovery } from "@/features/auth/password-recovery";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <PasswordRecovery invalidLink={error === "expired"} />;
}
