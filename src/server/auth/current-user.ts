import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

export function authSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_USERNAME?.trim() &&
    process.env.AUTH_PASSWORD_HASH?.trim() &&
    authSecret(),
  );
}

/** Current user id, or a redirect to the login screen. */
export async function requireUserId(): Promise<string> {
  const secret = authSecret();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySession(token, secret) : null;
  if (!session) redirect("/login");

  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!user) redirect("/login");
  return user.id;
}
