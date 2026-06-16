import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "CLAiR Docs",
  description: "Compatibility route for the CLAiR Docs read-only viewer.",
};

interface PrdCompatPageProps {
  searchParams: Promise<{
    doc?: string | string[];
  }>;
}

function normalizeDocParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PrdCompatPage({ searchParams }: PrdCompatPageProps) {
  const params = await searchParams;
  const doc = normalizeDocParam(params.doc);

  redirect(doc ? `/docs?doc=${encodeURIComponent(doc)}` : "/docs");
}
