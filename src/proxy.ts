import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/server/auth/auth";

// Every page needs a signed-in user except the login screens, /health and the
// install page. Server code checks the session again before touching any data.
//
// Server components cannot set cookies, so the session is renewed here: when
// Better Auth extends it (a visit more than a day after the last renewal) the
// response carries a fresh Set-Cookie, and it is passed on to the browser.
// Without that the cookie would end 30 days after sign-in, not after the last visit.
export async function proxy(request: NextRequest) {
  const response = await getAuth().api.getSession({
    headers: request.headers,
    asResponse: true,
  });
  const session = await response.json();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const next = NextResponse.next();
  for (const cookie of response.headers.getSetCookie()) {
    next.headers.append("set-cookie", cookie);
  }
  return next;
}

export const config = {
  matcher: [
    "/((?!login|api/auth|health|install|manifest.webmanifest|icon|apple-icon|_next/static|_next/image|favicon.ico).*)",
  ],
};
