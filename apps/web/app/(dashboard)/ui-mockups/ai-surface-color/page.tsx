import { Suspense } from "react";
import type { Metadata } from "next";
import { AiSurfaceColorMockup } from "./mockup";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mockup: Farebný jazyk AI plôch",
  robots: { index: false, follow: false },
};

export default function AiSurfaceColorMockupPage() {
  return (
    <Suspense>
      <AiSurfaceColorMockup />
    </Suspense>
  );
}
