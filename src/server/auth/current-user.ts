import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

export interface CurrentUser {
  id: string;
  email: string;
}

/** Current user, or a redirect to the login screen. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return { id: session.user.id, email: session.user.email };
}

/** Current user id, or a redirect to the login screen. */
export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}
