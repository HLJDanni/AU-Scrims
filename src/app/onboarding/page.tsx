import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requirePageUser({ needsTeam: false });
  if (user.teamId) redirect("/dashboard");
  return <OnboardingForm username={user.username} legend={user.role === "LEGEND"} />;
}
