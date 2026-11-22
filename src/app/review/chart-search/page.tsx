import { notFound } from "next/navigation";
import { ReviewWorkspace } from "./review-workspace";

export const metadata = {
  title: "차트 상세 검색 검수",
  robots: { index: false, follow: false },
};

export default function ChartSearchReviewPage() {
  if (
    process.env.VERCEL_ENV !== "preview" &&
    process.env.NODE_ENV !== "development"
  )
    notFound();
  return <ReviewWorkspace />;
}
