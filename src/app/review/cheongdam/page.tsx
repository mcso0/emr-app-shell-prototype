import { notFound } from "next/navigation";
import { CheongdamReview } from "./review";
import { readCheongdamReview } from "./server-review";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function CheongdamReviewPage() {
  const records = await readCheongdamReview();
  if (!records) notFound();

  return <CheongdamReview records={records} />;
}
