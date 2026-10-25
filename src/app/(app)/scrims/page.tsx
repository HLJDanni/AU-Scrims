import { requirePageUser } from "@/lib/auth";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ScrimsView } from "@/components/scrims/scrims-view";

export const metadata: Metadata = { title: "Scrims" };

export default async function ScrimsPage() {
  await requirePageUser();
  return (
    <Suspense>
      <ScrimsView />
    </Suspense>
  );
}
