import type { Metadata } from "next";
import { Suspense } from "react";
import { ScrimsView } from "@/components/scrims/scrims-view";

export const metadata: Metadata = { title: "Scrims" };

export default function ScrimsPage() {
  return (
    <Suspense>
      <ScrimsView />
    </Suspense>
  );
}
