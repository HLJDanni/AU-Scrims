import { withUser } from "@/lib/api";

export const GET = withUser(async ({ user }) => ({ user }));
