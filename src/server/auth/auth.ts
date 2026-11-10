import { createHash } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { signInLinks } from "@/db/schema";
import { sendSignInEmail } from "@/server/mail/transport";
import { isValidEmail, normalizeEmail } from "./email";
import { canSendSignInLink, SIGN_IN_LINK_WINDOW_MS } from "./sign-in-limit";

const DAY_SECONDS = 24 * 60 * 60;
const LINK_LIFETIME_SECONDS = 15 * 60;
const JOURNAL_KEEP_MS = DAY_SECONDS * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Codes returned to the sign-in form; `requestSignInLink` maps them to texts. */
export const INVALID_EMAIL = "INVALID_EMAIL";
export const TOO_MANY_SIGN_IN_LINKS = "TOO_MANY_SIGN_IN_LINKS";

async function recentSignInLinks(email: string): Promise<Date[]> {
  const since = new Date(Date.now() - SIGN_IN_LINK_WINDOW_MS);
  const rows = await getDb()
    .select({ createdAt: signInLinks.createdAt })
    .from(signInLinks)
    .where(and(eq(signInLinks.email, email), gt(signInLinks.createdAt, since)));
  return rows.map((r) => r.createdAt);
}

/** True when this token is not in the journal or a newer link was sent to the same email. */
async function isSupersededLink(token: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({
      id: signInLinks.id,
      email: signInLinks.email,
      createdAt: signInLinks.createdAt,
    })
    .from(signInLinks)
    .where(eq(signInLinks.tokenHash, hashToken(token)));
  if (!row) return true;
  const [newer] = await db
    .select({ id: signInLinks.id })
    .from(signInLinks)
    .where(
      and(
        eq(signInLinks.email, row.email),
        // Postgres keeps microseconds, a JS Date only milliseconds: without the
        // id check the row itself would look newer than its own timestamp.
        ne(signInLinks.id, row.id),
        gt(signInLinks.createdAt, row.createdAt),
      ),
    )
    .limit(1);
  return Boolean(newer);
}

function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    advanced: {
      database: { generateId: "uuid" },
      // nginx sets X-Forwarded-For; the built-in limit works per client address.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    session: {
      // 30 days since the last visit: proxy.ts renews the session and the cookie.
      expiresIn: 30 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Checks run here, so they hold for any request, not only for our form.
        if (ctx.path === "/sign-in/magic-link") {
          const raw = (ctx.body as { email?: unknown } | undefined)?.email;
          const email = normalizeEmail(typeof raw === "string" ? raw : "");
          if (!isValidEmail(email)) {
            throw new APIError("BAD_REQUEST", {
              code: INVALID_EMAIL,
              message: "Invalid email address",
            });
          }
          if (!canSendSignInLink(await recentSignInLinks(email), new Date())) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: TOO_MANY_SIGN_IN_LINKS,
              message: "Too many sign-in links requested for this email",
            });
          }
          return { context: { body: { ...ctx.body, email } } };
        }

        // Only the newest link per email works; a replaced one is as good as expired.
        if (ctx.path === "/magic-link/verify") {
          const token = (ctx.query as { token?: unknown } | undefined)?.token;
          if (typeof token !== "string" || (await isSupersededLink(token))) {
            throw ctx.redirect(
              new URL("/login/expired", ctx.context.baseURL).toString(),
            );
          }
        }
      }),
    },
    plugins: [
      magicLink({
        expiresIn: LINK_LIFETIME_SECONDS,
        // Built-in limit by client address: only a guard against floods.
        // The 3-per-10-minutes limit per email is in the hook above.
        rateLimit: { window: 60, max: 30 },
        sendMagicLink: async ({ email, url, token }) => {
          const db = getDb();
          const [entry] = await db
            .insert(signInLinks)
            .values({ email, tokenHash: hashToken(token) })
            .returning({ id: signInLinks.id });
          try {
            await sendSignInEmail(email, url);
          } catch (error) {
            // A link that was never sent must not count against the limit.
            await db.delete(signInLinks).where(eq(signInLinks.id, entry.id));
            throw error;
          }
          await db
            .delete(signInLinks)
            .where(
              lt(signInLinks.createdAt, new Date(Date.now() - JOURNAL_KEEP_MS)),
            );
        },
      }),
      nextCookies(), // must stay last
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { dearMoneyAuth?: Auth };

/** One instance per process; created on first use so `next build` needs no database. */
export function getAuth(): Auth {
  globalForAuth.dearMoneyAuth ??= createAuth();
  return globalForAuth.dearMoneyAuth;
}
