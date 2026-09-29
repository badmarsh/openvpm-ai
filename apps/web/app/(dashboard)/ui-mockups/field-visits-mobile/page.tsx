import { Suspense } from "react";
import type { Metadata } from "next";
import { FieldVisitsMobileMockup } from "./mockup";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mockup: Terénne návštevy — mobilný layout",
  robots: { index: false, follow: false },
};

export default function FieldVisitsMobileMockupPage() {
  return (
    <Suspense>
      <FieldVisitsMobileMockup />
    </Suspense>
  );
}
