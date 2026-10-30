import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

// Every page needs a valid session except the login screen and /health.
// Server code checks the session again before touching any data.
export async function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SECRET?.trim();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session =
    secret && secret.length >= 32 && token
      ? await verifySession(token, secret)
      : null;
  if (session) return NextResponse.next();

  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!login|health|install|manifest.webmanifest|icon|apple-icon|_next/static|_next/image|favicon.ico).*)",
  ],
};
