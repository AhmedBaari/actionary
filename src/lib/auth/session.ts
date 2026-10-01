import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getUserByEmail } from "@/server/repositories/users.repository";
import type { User } from "@/types";

/** Server-side authorization boundary. Proxy only performs an optimistic redirect. */
export async function requireCurrentUser(): Promise<User> {
  const session = await auth.api.getSession({ headers: await headers() });
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    throw new Error("Authentication required");
  }

  const user = await getUserByEmail(email);
  if (!user || user.active === false) {
    throw new Error("This account is not active in the SastraNet workspace.");
  }

  return user;
}

export function auditActor(user: User) {
  return {
    actorId: user._id.toString(),
    actorName: user.name || user.email,
  };
}
