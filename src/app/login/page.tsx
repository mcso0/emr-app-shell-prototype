import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Mock Login | CLAiR EMR",
  description: "Role-based mock session foundation for the CLAiR EMR prototype.",
};

export default function LoginPage() {
  return <LoginForm />;
}
