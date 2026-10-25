import { getCurrentUser } from "@/lib/auth";
import { Landing } from "@/components/landing";

export default async function Home() {
  const user = await getCurrentUser();
  return <Landing loggedIn={Boolean(user)} />;
}
